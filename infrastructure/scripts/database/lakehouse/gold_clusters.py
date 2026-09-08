"""Build gold cluster Parquet tables from silver asset lon/lat.

Used by lakehouse_writer.ingest_municipality_tables (seeders / fixture), not by PostGIS export.
"""

from __future__ import annotations

import math
from collections import defaultdict
from datetime import date
from typing import Any

import pyarrow as pa

_WEB_MERCATOR_HALF = 20037508.34
WEB_MERCATOR_BASE_RESOLUTION = 156543.03392804097
GRID_REFERENCE_LATITUDE = 41.9
CLUSTER_MAX_ZOOM_THRESHOLD = 13
CLUSTER_GRID_MAX_REFINE_ZOOM = 18
CLUSTER_DISTANCE_AT_16 = 80
CLUSTER_DISTANCE_AT_10 = 260
CLUSTER_ZOOM_DETAIL = 16
CLUSTER_ZOOM_OVERVIEW = 10

# Gold zoom_band values written at ingest
GOLD_BAND_MUNICIPALITY = "municipality"
GOLD_GRID_BANDS = tuple(range(CLUSTER_MAX_ZOOM_THRESHOLD, CLUSTER_GRID_MAX_REFINE_ZOOM + 1))


def lonlat_to_mercator(lon: float, lat: float) -> tuple[float, float]:
    x = lon * _WEB_MERCATOR_HALF / 180.0
    y = math.log(math.tan(math.radians(90.0 + lat) / 2.0)) * _WEB_MERCATOR_HALF / math.pi
    return x, y


def resolution_for_zoom(zoom: float) -> float:
    scale = WEB_MERCATOR_BASE_RESOLUTION * math.cos(math.radians(GRID_REFERENCE_LATITUDE))
    return scale / 2**zoom


def cluster_distance_px(zoom: float) -> float:
    z = math.floor(zoom)
    if z >= CLUSTER_MAX_ZOOM_THRESHOLD:
        return float(CLUSTER_DISTANCE_AT_16)
    t = max(
        0.0,
        min(1.0, (CLUSTER_ZOOM_DETAIL - z) / (CLUSTER_ZOOM_DETAIL - CLUSTER_ZOOM_OVERVIEW)),
    )
    return float(round(CLUSTER_DISTANCE_AT_16 + t * (CLUSTER_DISTANCE_AT_10 - CLUSTER_DISTANCE_AT_16)))


def grid_cell_size_m(zoom: float) -> float:
    z = math.floor(zoom)
    if z >= CLUSTER_MAX_ZOOM_THRESHOLD:
        cluster_zoom = min(z, CLUSTER_GRID_MAX_REFINE_ZOOM)
        return resolution_for_zoom(cluster_zoom) * cluster_distance_px(zoom)
    return resolution_for_zoom(z) * cluster_distance_px(z)


def gold_hive_prefix(
    region_id: int,
    province_id: int,
    municipality_id: int,
    ingest_date: date,
    zoom_band: str,
) -> str:
    return (
        f"green_assets_clusters/region_id={region_id}/province_id={province_id}/"
        f"municipality_id={municipality_id}/ingest_date={ingest_date.isoformat()}/"
        f"zoom_band={zoom_band}"
    )


# Consolidated admin gold (one parquet per region; rollup job).
ADMIN_CLUSTERS_ROOT = "green_assets_admin_clusters"


def admin_region_prefix(region_id: int) -> str:
    """Hive prefix for consolidated municipality-band rows of one region."""
    return f"{ADMIN_CLUSTERS_ROOT}/region_id={region_id}"


def admin_region_part_key(region_id: int) -> str:
    return f"{admin_region_prefix(region_id)}/part-municipality-bands.parquet"


def _points_from_assets_table(assets: pa.Table) -> list[tuple[int, float, float]]:
    ids = assets.column("id").to_pylist()
    lons = assets.column("lon").to_pylist()
    lats = assets.column("lat").to_pylist()
    out: list[tuple[int, float, float]] = []
    for i, lon, lat in zip(ids, lons, lats, strict=True):
        if lon is None or lat is None:
            continue
        out.append((int(i), float(lon), float(lat)))
    return out


def build_municipality_band(
    assets: pa.Table,
    *,
    region_id: int,
    province_id: int,
    municipality_id: int,
) -> pa.Table:
    pts = _points_from_assets_table(assets)
    if not pts:
        return _empty_gold_table()
    lons = [p[1] for p in pts]
    lats = [p[2] for p in pts]
    return pa.table(
        {
            "level": pa.array(["municipality"], type=pa.string()),
            "region_id": pa.array([region_id], type=pa.int32()),
            "province_id": pa.array([province_id], type=pa.int32()),
            "municipality_id": pa.array([municipality_id], type=pa.int32()),
            "cell_x": pa.array([0], type=pa.int32()),
            "cell_y": pa.array([0], type=pa.int32()),
            "count": pa.array([len(pts)], type=pa.int64()),
            "sample_id": pa.array([pts[0][0]], type=pa.int64()),
            "lon": pa.array([sum(lons) / len(lons)], type=pa.float64()),
            "lat": pa.array([sum(lats) / len(lats)], type=pa.float64()),
            "min_lon": pa.array([min(lons)], type=pa.float64()),
            "min_lat": pa.array([min(lats)], type=pa.float64()),
            "max_lon": pa.array([max(lons)], type=pa.float64()),
            "max_lat": pa.array([max(lats)], type=pa.float64()),
        }
    )


def build_grid_band(
    assets: pa.Table,
    zoom_level: int,
    *,
    region_id: int,
    province_id: int,
    municipality_id: int,
) -> pa.Table:
    pts = _points_from_assets_table(assets)
    if not pts:
        return _empty_gold_table()
    cell = grid_cell_size_m(float(zoom_level))
    buckets: dict[tuple[int, int], list[tuple[int, float, float]]] = defaultdict(list)
    for asset_id, lon, lat in pts:
        mx, my = lonlat_to_mercator(lon, lat)
        cx = int(math.floor(mx / cell))
        cy = int(math.floor(my / cell))
        buckets[(cx, cy)].append((asset_id, lon, lat))

    levels: list[str] = []
    region_ids: list[int] = []
    province_ids: list[int] = []
    municipality_ids: list[int] = []
    cell_xs: list[int] = []
    cell_ys: list[int] = []
    counts: list[int] = []
    sample_ids: list[int] = []
    lons_o: list[float] = []
    lats_o: list[float] = []
    min_lons: list[float] = []
    min_lats: list[float] = []
    max_lons: list[float] = []
    max_lats: list[float] = []

    for (cx, cy), members in buckets.items():
        mlons = [m[1] for m in members]
        mlats = [m[2] for m in members]
        levels.append(f"grid_{zoom_level}")
        region_ids.append(region_id)
        province_ids.append(province_id)
        municipality_ids.append(municipality_id)
        cell_xs.append(cx)
        cell_ys.append(cy)
        counts.append(len(members))
        sample_ids.append(members[0][0])
        lons_o.append(sum(mlons) / len(mlons))
        lats_o.append(sum(mlats) / len(mlats))
        min_lons.append(min(mlons))
        min_lats.append(min(mlats))
        max_lons.append(max(mlons))
        max_lats.append(max(mlats))

    return pa.table(
        {
            "level": pa.array(levels, type=pa.string()),
            "region_id": pa.array(region_ids, type=pa.int32()),
            "province_id": pa.array(province_ids, type=pa.int32()),
            "municipality_id": pa.array(municipality_ids, type=pa.int32()),
            "cell_x": pa.array(cell_xs, type=pa.int32()),
            "cell_y": pa.array(cell_ys, type=pa.int32()),
            "count": pa.array(counts, type=pa.int64()),
            "sample_id": pa.array(sample_ids, type=pa.int64()),
            "lon": pa.array(lons_o, type=pa.float64()),
            "lat": pa.array(lats_o, type=pa.float64()),
            "min_lon": pa.array(min_lons, type=pa.float64()),
            "min_lat": pa.array(min_lats, type=pa.float64()),
            "max_lon": pa.array(max_lons, type=pa.float64()),
            "max_lat": pa.array(max_lats, type=pa.float64()),
        }
    )


def _empty_gold_table() -> pa.Table:
    return pa.table(
        {
            "level": pa.array([], type=pa.string()),
            "region_id": pa.array([], type=pa.int32()),
            "province_id": pa.array([], type=pa.int32()),
            "municipality_id": pa.array([], type=pa.int32()),
            "cell_x": pa.array([], type=pa.int32()),
            "cell_y": pa.array([], type=pa.int32()),
            "count": pa.array([], type=pa.int64()),
            "sample_id": pa.array([], type=pa.int64()),
            "lon": pa.array([], type=pa.float64()),
            "lat": pa.array([], type=pa.float64()),
            "min_lon": pa.array([], type=pa.float64()),
            "min_lat": pa.array([], type=pa.float64()),
            "max_lon": pa.array([], type=pa.float64()),
            "max_lat": pa.array([], type=pa.float64()),
        }
    )


def build_all_gold_bands(
    assets: pa.Table,
    *,
    region_id: int,
    province_id: int,
    municipality_id: int,
) -> dict[str, pa.Table]:
    out: dict[str, pa.Table] = {
        GOLD_BAND_MUNICIPALITY: build_municipality_band(
            assets,
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
        )
    }
    for z in GOLD_GRID_BANDS:
        out[f"grid_{z}"] = build_grid_band(
            assets,
            z,
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
        )
    return out
