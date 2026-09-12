"""Build green_areas_stats municipality-band tables (root area counts).

Used by lakehouse_writer.ingest_municipality_tables for table totals (not map clusters).
``count`` = number of silver area rows with parent_id IS NULL.
"""

from __future__ import annotations

from datetime import date

import pyarrow as pa

from gold_clusters import GOLD_BAND_MUNICIPALITY

AREAS_STATS_ROOT = "green_areas_stats"
AREAS_ADMIN_STATS_ROOT = "green_areas_admin_stats"


def areas_stats_hive_prefix(
    region_id: int,
    province_id: int,
    municipality_id: int,
    ingest_date: date,
    zoom_band: str = GOLD_BAND_MUNICIPALITY,
) -> str:
    return (
        f"{AREAS_STATS_ROOT}/region_id={region_id}/province_id={province_id}/"
        f"municipality_id={municipality_id}/ingest_date={ingest_date.isoformat()}/"
        f"zoom_band={zoom_band}"
    )


def admin_areas_region_prefix(region_id: int) -> str:
    return f"{AREAS_ADMIN_STATS_ROOT}/region_id={region_id}"


def admin_areas_region_part_key(region_id: int) -> str:
    return f"{admin_areas_region_prefix(region_id)}/part-municipality-bands.parquet"


def _root_points_from_areas_table(areas: pa.Table) -> list[tuple[int, float, float]]:
    """Root areas (parent_id IS NULL) with optional lon/lat for centroid."""
    ids = areas.column("id").to_pylist()
    parents = areas.column("parent_id").to_pylist()
    lons = areas.column("lon").to_pylist() if "lon" in areas.column_names else [None] * len(ids)
    lats = areas.column("lat").to_pylist() if "lat" in areas.column_names else [None] * len(ids)
    out: list[tuple[int, float, float]] = []
    for i, parent, lon, lat in zip(ids, parents, lons, lats, strict=True):
        if parent is not None:
            continue
        # Missing lon/lat: still count the root; use 0,0 only for empty centroid math.
        out.append(
            (
                int(i),
                float(lon) if lon is not None else 0.0,
                float(lat) if lat is not None else 0.0,
            )
        )
    return out


def build_areas_municipality_band(
    areas: pa.Table,
    *,
    region_id: int,
    province_id: int,
    municipality_id: int,
) -> pa.Table:
    """One municipality-band row: count = # roots (parent_id IS NULL)."""
    roots = _root_points_from_areas_table(areas)
    if not roots:
        # Explicit zero-count row so admin rollup still sees the municipality.
        return pa.table(
            {
                "level": pa.array(["municipality"], type=pa.string()),
                "region_id": pa.array([region_id], type=pa.int32()),
                "province_id": pa.array([province_id], type=pa.int32()),
                "municipality_id": pa.array([municipality_id], type=pa.int32()),
                "cell_x": pa.array([0], type=pa.int32()),
                "cell_y": pa.array([0], type=pa.int32()),
                "count": pa.array([0], type=pa.int64()),
                "sample_id": pa.array([0], type=pa.int64()),
                "lon": pa.array([0.0], type=pa.float64()),
                "lat": pa.array([0.0], type=pa.float64()),
                "min_lon": pa.array([0.0], type=pa.float64()),
                "min_lat": pa.array([0.0], type=pa.float64()),
                "max_lon": pa.array([0.0], type=pa.float64()),
                "max_lat": pa.array([0.0], type=pa.float64()),
            }
        )
    lons = [p[1] for p in roots]
    lats = [p[2] for p in roots]
    return pa.table(
        {
            "level": pa.array(["municipality"], type=pa.string()),
            "region_id": pa.array([region_id], type=pa.int32()),
            "province_id": pa.array([province_id], type=pa.int32()),
            "municipality_id": pa.array([municipality_id], type=pa.int32()),
            "cell_x": pa.array([0], type=pa.int32()),
            "cell_y": pa.array([0], type=pa.int32()),
            "count": pa.array([len(roots)], type=pa.int64()),
            "sample_id": pa.array([roots[0][0]], type=pa.int64()),
            "lon": pa.array([sum(lons) / len(lons)], type=pa.float64()),
            "lat": pa.array([sum(lats) / len(lats)], type=pa.float64()),
            "min_lon": pa.array([min(lons)], type=pa.float64()),
            "min_lat": pa.array([min(lats)], type=pa.float64()),
            "max_lon": pa.array([max(lons)], type=pa.float64()),
            "max_lat": pa.array([max(lats)], type=pa.float64()),
        }
    )


