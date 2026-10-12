"""Read areas for catalog, hierarchy, and intersection queries."""

from __future__ import annotations

import math
from typing import Any

from territory.common.infrastructure.lakehouse.catalog import IngestResolution
from territory.common.infrastructure.lakehouse.duckdb_client import (
    connect_lakehouse,
    parquet_glob,
)
from territory.common.infrastructure.lakehouse.table_filters import area_filter_where

from .geom import _wkb_to_geojson

# Hard cap for municipality-wide catalog FeatureCollections (parity with previous PG unbounded loads).
_CATALOG_FEATURE_LIMIT = 50_000
# Minimum geodesic overlap (m²) between candidate and selected area; excludes boundary-only adjacency.
_MIN_GREEN_AREA_INTERSECTION_M2 = 1.0
_METERS_PER_DEGREE = 111_320.0


def _files_sql(resolutions: list[IngestResolution]) -> str:
    globs = [parquet_glob(r.object_prefix) for r in resolutions]
    return ", ".join(f"'{g}'" for g in globs)


def _raw_area_to_fc_tuple(r: tuple) -> tuple | None:
    """Map DuckDB area row → (id, geom, name, level, parent_id, region_id, province_id, municipality_id)."""
    geom = _wkb_to_geojson(r[1], r[2], r[3])
    if geom is None:
        return None
    return (
        int(r[0]),
        geom,
        r[4],
        int(r[5]),
        int(r[6]) if r[6] is not None else None,
        int(r[7]),
        int(r[8]),
        int(r[9]),
    )


def _approx_intersection_m2(a, b) -> float:
    """Approximate geodesic intersection area from WGS84 geometries (degrees → m²)."""
    inter = a.intersection(b)
    if inter.is_empty:
        return 0.0
    lat = float(inter.centroid.y)
    m_lat = _METERS_PER_DEGREE
    m_lon = _METERS_PER_DEGREE * max(0.01, abs(math.cos(math.radians(lat))))
    return float(inter.area) * m_lat * m_lon


def _fetch_area_raw_rows(resolutions: list[IngestResolution], where_sql: str, limit: int) -> list[tuple]:
    if not resolutions or limit <= 0:
        return []
    files_sql = _files_sql(resolutions)
    con = connect_lakehouse()
    try:
        return con.execute(
            f"""
            SELECT id, geom_wkb, lon, lat, name, level, parent_id, region_id, province_id, municipality_id
            FROM read_parquet([{files_sql}], union_by_name=true)
            WHERE {where_sql}
            LIMIT {int(limit)}
            """
        ).fetchall()
    finally:
        con.close()


def read_area_roots(
    resolutions: list[IngestResolution],
    *,
    municipality_id: int,
    region_id: int,
    province_id: int,
    limit: int = _CATALOG_FEATURE_LIMIT,
) -> list[tuple]:
    """Root areas (parent_id IS NULL) for a municipality → FC row tuples."""
    where = (
        f"parent_id IS NULL"
        f" AND municipality_id = {int(municipality_id)}"
        f" AND region_id = {int(region_id)}"
        f" AND province_id = {int(province_id)}"
    )
    out: list[tuple] = []
    for r in _fetch_area_raw_rows(resolutions, where, limit):
        t = _raw_area_to_fc_tuple(r)
        if t is not None:
            out.append(t)
    return out


def read_areas_by_parent(
    resolutions: list[IngestResolution],
    *,
    parent_id: int,
    region_id: int,
    province_id: int | None = None,
    municipality_id: int | None = None,
    limit: int = _CATALOG_FEATURE_LIMIT,
    filters: dict[str, Any] | None = None,
) -> list[tuple]:
    """Direct children of parent_id → FC row tuples.

    Prefer province/municipality filters so DuckDB does not scan every
    municipality parquet under the region (region-wide parent probes were
    multi-second and could 500 when MinIO was under load).
    """
    where = f"parent_id = {int(parent_id)} AND region_id = {int(region_id)}"
    if province_id is not None:
        where += f" AND province_id = {int(province_id)}"
    if municipality_id is not None:
        where += f" AND municipality_id = {int(municipality_id)}"
    extra = area_filter_where(filters)
    if extra:
        where += " AND " + " AND ".join(extra)
    out: list[tuple] = []
    for r in _fetch_area_raw_rows(resolutions, where, limit):
        t = _raw_area_to_fc_tuple(r)
        if t is not None:
            out.append(t)
    return out


def read_area_roots_intersecting_geom(
    resolutions: list[IngestResolution],
    *,
    municipality_id: int,
    region_id: int,
    province_id: int,
    clip_geom,
    limit: int = _CATALOG_FEATURE_LIMIT,
) -> list[tuple]:
    """Root areas whose geometry intersects ``clip_geom`` (shapely)."""
    from shapely import wkb as shapely_wkb

    where = (
        f"parent_id IS NULL"
        f" AND municipality_id = {int(municipality_id)}"
        f" AND region_id = {int(region_id)}"
        f" AND province_id = {int(province_id)}"
    )
    out: list[tuple] = []
    for r in _fetch_area_raw_rows(resolutions, where, limit):
        if r[1] is None:
            continue
        try:
            geom = shapely_wkb.loads(bytes(r[1]))
        except Exception:
            continue
        if not geom.intersects(clip_geom):
            continue
        t = _raw_area_to_fc_tuple(r)
        if t is not None:
            out.append(t)
    return out


def read_area_roots_intersecting_clip(
    resolutions: list[IngestResolution],
    *,
    clip_geom,
    limit: int = _CATALOG_FEATURE_LIMIT,
) -> list[tuple]:
    """Root areas intersecting ``clip_geom`` across pre-pruned resolutions (draw national).

    Callers must pass resolutions already limited to municipalities intersecting the
    clip (e.g. via ``municipalities_intersecting_clip``). Unlike
    ``read_area_roots_intersecting_geom``, no single-municipality SQL filter.
    """
    from shapely import wkb as shapely_wkb

    if clip_geom is None or getattr(clip_geom, "is_empty", False):
        return []
    # No lon/lat shrink to clip.bounds — centroids of intersecting roots can sit
    # just outside the clip envelope (same failure mode as Santa Rosa Area 5).
    # Resolutions must already be municipality-pruned to the clip.
    out: list[tuple] = []
    for r in _fetch_area_raw_rows(resolutions, "parent_id IS NULL", limit):
        if r[1] is None:
            continue
        try:
            geom = shapely_wkb.loads(bytes(r[1]))
        except Exception:
            continue
        if not geom.intersects(clip_geom):
            continue
        t = _raw_area_to_fc_tuple(r)
        if t is not None:
            out.append(t)
    return out


def read_areas_contained_or_intersecting(
    resolutions: list[IngestResolution],
    *,
    area_id: int,
    region_id: int,
    province_id: int,
    municipality_id: int,
    limit: int = _CATALOG_FEATURE_LIMIT,
    filters: dict[str, Any] | None = None,
) -> list[tuple]:
    """Selected area first, then level+1 areas with real overlap (≥ 1 m²).

    Attribute filters (Cerca) apply to candidates. Selected is always loaded for
    the overlap test; it is included in the result only when it also matches
    filters (or when no filters are set).
    """
    from shapely import wkb as shapely_wkb

    scope_sql = (
        f"municipality_id = {int(municipality_id)}"
        f" AND region_id = {int(region_id)}"
        f" AND province_id = {int(province_id)}"
    )
    # Selected geom must load even when attribute filters exclude it.
    selected_rows = _fetch_area_raw_rows(
        resolutions, f"{scope_sql} AND id = {int(area_id)}", 1
    )
    selected_raw = selected_rows[0] if selected_rows else None
    if selected_raw is None or selected_raw[1] is None:
        return []
    try:
        selected_geom = shapely_wkb.loads(bytes(selected_raw[1]))
    except Exception:
        return []
    selected_level = int(selected_raw[5])
    selected_tuple = _raw_area_to_fc_tuple(selected_raw)
    if selected_tuple is None:
        return []

    where_cand = scope_sql
    extra = area_filter_where(filters)
    if extra:
        where_cand += " AND " + " AND ".join(extra)
    raw = _fetch_area_raw_rows(resolutions, where_cand, limit)

    children: list[tuple] = []
    selected_matches_filters = False
    for r in raw:
        if int(r[0]) == int(area_id):
            selected_matches_filters = True
            continue
        if r[1] is None:
            continue
        if int(r[5]) != selected_level + 1:
            continue
        try:
            cand = shapely_wkb.loads(bytes(r[1]))
        except Exception:
            continue
        if not cand.intersects(selected_geom):
            continue
        if _approx_intersection_m2(selected_geom, cand) < _MIN_GREEN_AREA_INTERSECTION_M2:
            continue
        t = _raw_area_to_fc_tuple(r)
        if t is not None:
            children.append(t)
    if not filters or selected_matches_filters:
        return [selected_tuple] + children
    return children


def union_geom_for_area_ids(
    resolutions: list[IngestResolution],
    area_ids: list[int],
    *,
    limit: int = 500,
):
    """Union shapely geometry for area ids (internal Cerca clip; avoid long WKT).

    Callers must pass a **small** resolution list (matched municipalities only).
    Scanning national area_res opens thousands of MinIO prefixes and hangs.
    """
    if not resolutions or not area_ids:
        return None
    # Hard guard: never open nationwide parquet for a clip geom.
    if len(resolutions) > 32:
        return None
    from shapely import wkb as shapely_wkb
    from shapely.ops import unary_union

    id_clause = "id IN (" + ",".join(str(int(i)) for i in area_ids[:limit]) + ")"
    rows = _fetch_area_raw_rows(resolutions, id_clause, limit)
    geoms = []
    for r in rows:
        if r[1] is None:
            continue
        try:
            geoms.append(shapely_wkb.loads(bytes(r[1])))
        except Exception:
            continue
    if not geoms:
        return None
    try:
        merged = unary_union(geoms)
    except Exception:
        return None
    if merged is None or merged.is_empty:
        return None
    return merged
