"""Aggregate assets in clip for clustering."""

from __future__ import annotations

import math
from typing import Literal

from territory.assets.infrastructure.repository.viewport_cluster import ViewportCluster
from territory.common.infrastructure.lakehouse.catalog import IngestResolution
from territory.common.infrastructure.lakehouse.duckdb_client import (
    connect_lakehouse,
    parquet_glob,
)
from territory.common.infrastructure.lakehouse.metrics import timed_op
from territory.common.infrastructure.lakehouse.silver.sql import _green_area_id_in_sql

_WEB_MERCATOR_HALF = 20037508.34
_CLIP_AGG_FETCH_CAP = 300_000
_AREA_IDS_AGG_FETCH_CAP = 50_000


def _lonlat_to_mercator(lon: float, lat: float) -> tuple[float, float]:
    x = lon * _WEB_MERCATOR_HALF / 180.0
    y = math.log(math.tan(math.radians(90.0 + lat) / 2.0)) * _WEB_MERCATOR_HALF / math.pi
    return x, y


def _files_sql(resolutions: list[IngestResolution]) -> str:
    globs = [parquet_glob(r.object_prefix) for r in resolutions]
    return ", ".join(f"'{g}'" for g in globs)


def aggregate_assets_in_clip(
    resolutions: list[IngestResolution],
    clip_geom,
    *,
    mode: Literal["grid", "municipality"],
    cell_size_m: float | None = None,
    view_bbox: tuple[float, float, float, float] | None = None,
) -> list:
    """Exact cluster buckets for draw clip (silver ∩ clip). Returns ViewportCluster list."""
    from shapely.geometry import Point
    from shapely.prepared import prep

    if not resolutions or clip_geom is None or clip_geom.is_empty:
        return []
    if mode == "grid" and (cell_size_m is None or cell_size_m <= 0):
        return []

    minx, miny, maxx, maxy = clip_geom.bounds
    if view_bbox is not None:
        vx0, vy0, vx1, vy1 = view_bbox
        minx, miny = max(minx, vx0), max(miny, vy0)
        maxx, maxy = min(maxx, vx1), min(maxy, vy1)
        if minx > maxx or miny > maxy:
            return []

    files_sql = _files_sql(resolutions)
    con = connect_lakehouse()
    try:
        with timed_op(
            "clip_exact_cluster",
            mode=mode,
            municipalities=len(resolutions),
        ):
            rows = con.execute(
                f"""
                SELECT id, lon, lat, municipality_id, region_id, province_id
                FROM read_parquet([{files_sql}], union_by_name=true)
                WHERE lon BETWEEN {minx} AND {maxx}
                  AND lat BETWEEN {miny} AND {maxy}
                LIMIT {_CLIP_AGG_FETCH_CAP}
                """
            ).fetchall()
    finally:
        con.close()

    buckets: dict[tuple, list] = {}
    clip_prep = prep(clip_geom)
    for r in rows:
        lon, lat = r[1], r[2]
        if lon is None or lat is None:
            continue
        # Point + prepared clip (no geom_wkb): cheaper than WKB load per row.
        if not clip_prep.intersects(Point(float(lon), float(lat))):
            continue
        lon_f, lat_f = float(lon), float(lat)
        mid = int(r[3])
        rid, pid = int(r[4]), int(r[5])
        if mode == "municipality":
            key: tuple = ("M", rid, pid, mid)
            cx = cy = 0
        else:
            mx, my = _lonlat_to_mercator(lon_f, lat_f)
            assert cell_size_m is not None
            cx = int(math.floor(mx / cell_size_m))
            cy = int(math.floor(my / cell_size_m))
            key = ("G", cx, cy)
        b = buckets.get(key)
        if b is None:
            buckets[key] = [
                1,
                int(r[0]),
                lon_f,
                lat_f,
                lon_f,
                lat_f,
                lon_f,
                lat_f,
                cx,
                cy,
                rid,
                pid,
                mid,
            ]
        else:
            b[0] += 1
            b[2] += lon_f
            b[3] += lat_f
            b[4] = min(b[4], lon_f)
            b[5] = min(b[5], lat_f)
            b[6] = max(b[6], lon_f)
            b[7] = max(b[7], lat_f)

    out: list[ViewportCluster] = []
    for _key, b in buckets.items():
        n = int(b[0])
        lon_c, lat_c = b[2] / n, b[3] / n
        mx, my = _lonlat_to_mercator(lon_c, lat_c)
        admin_key = None
        if mode == "municipality":
            admin_key = f"M{b[10]}_{b[11]}_{b[12]}"
        out.append(
            ViewportCluster(
                cell_x=int(b[8]),
                cell_y=int(b[9]),
                count=n,
                merc_x=mx,
                merc_y=my,
                bbox=(float(b[4]), float(b[5]), float(b[6]), float(b[7])),
                sample_id=int(b[1]),
                admin_key=admin_key,
                lon=lon_c,
                lat=lat_c,
            )
        )
    return out


def aggregate_assets_by_green_area_ids(
    resolutions: list[IngestResolution],
    green_area_ids: list[int],
    *,
    cell_size_m: float,
    view_bbox: tuple[float, float, float, float],
    clip_geom=None,
    filters: dict | None = None,
) -> list:
    """Live grid clusters for assets belonging to matched green areas (FK ± clip).

    ``filters`` applies the same silver predicates as /table and raw viewport
    (debug 4fe799: trunk_diameter 11–12 → table total=20 but live clusters
    stayed at unfiltered 808).
    """
    from shapely.geometry import Point
    from shapely.prepared import prep

    from territory.common.infrastructure.lakehouse.table_filters import (
        asset_filter_where,
    )

    if not resolutions or not green_area_ids or cell_size_m <= 0:
        return []
    ga_clause = _green_area_id_in_sql(green_area_ids)
    if ga_clause is None:
        return []

    minx, miny, maxx, maxy = view_bbox
    if clip_geom is not None and not clip_geom.is_empty:
        cx0, cy0, cx1, cy1 = clip_geom.bounds
        ix0, iy0 = max(minx, cx0), max(miny, cy0)
        ix1, iy1 = min(maxx, cx1), min(maxy, cy1)
        if ix0 > ix1 or iy0 > iy1:
            # Camera still on a prior Cerca target (debug 4fe799: villa clip in
            # Lecce while view was Area boost at z19) — query the clip envelope.
            minx, miny, maxx, maxy = cx0, cy0, cx1, cy1
        else:
            minx, miny, maxx, maxy = ix0, iy0, ix1, iy1

    where_parts = [
        ga_clause,
        f"lon BETWEEN {minx} AND {maxx}",
        f"lat BETWEEN {miny} AND {maxy}",
    ]
    where_parts.extend(asset_filter_where(filters))
    where_sql = " AND ".join(where_parts)

    files_sql = _files_sql(resolutions)
    con = connect_lakehouse()
    try:
        with timed_op(
            "ga_ids_exact_cluster",
            municipalities=len(resolutions),
            n_area_ids=len(green_area_ids),
            n_filters=len(filters or {}),
        ):
            rows = con.execute(
                f"""
                SELECT id, lon, lat, municipality_id, region_id, province_id
                FROM read_parquet([{files_sql}], union_by_name=true)
                WHERE {where_sql}
                LIMIT {_AREA_IDS_AGG_FETCH_CAP}
                """
            ).fetchall()
    finally:
        con.close()

    clip_prep = prep(clip_geom) if clip_geom is not None else None
    buckets: dict[tuple, list] = {}
    for r in rows:
        lon, lat = r[1], r[2]
        if lon is None or lat is None:
            continue
        lon_f, lat_f = float(lon), float(lat)
        if clip_prep is not None and not clip_prep.intersects(Point(lon_f, lat_f)):
            continue
        mx, my = _lonlat_to_mercator(lon_f, lat_f)
        cx = int(math.floor(mx / cell_size_m))
        cy = int(math.floor(my / cell_size_m))
        key = (cx, cy)
        b = buckets.get(key)
        if b is None:
            buckets[key] = [
                1,
                int(r[0]),
                lon_f,
                lat_f,
                lon_f,
                lat_f,
                lon_f,
                lat_f,
                cx,
                cy,
            ]
        else:
            b[0] += 1
            b[2] += lon_f
            b[3] += lat_f
            b[4] = min(b[4], lon_f)
            b[5] = min(b[5], lat_f)
            b[6] = max(b[6], lon_f)
            b[7] = max(b[7], lat_f)

    out: list[ViewportCluster] = []
    for _key, b in buckets.items():
        n = int(b[0])
        lon_c, lat_c = b[2] / n, b[3] / n
        mx, my = _lonlat_to_mercator(lon_c, lat_c)
        out.append(
            ViewportCluster(
                cell_x=int(b[8]),
                cell_y=int(b[9]),
                count=n,
                merc_x=mx,
                merc_y=my,
                bbox=(float(b[4]), float(b[5]), float(b[6]), float(b[7])),
                sample_id=int(b[1]),
                admin_key=None,
                lon=lon_c,
                lat=lat_c,
            )
        )
    return out
