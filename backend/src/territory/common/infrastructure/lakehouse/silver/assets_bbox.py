"""Read assets by bounding box and primary key."""

from __future__ import annotations

from typing import Any

from territory.common.infrastructure.lakehouse.catalog import IngestResolution
from territory.common.infrastructure.lakehouse.duckdb_client import (
    connect_lakehouse,
    parquet_glob,
)
from territory.common.infrastructure.lakehouse.filter_test_log import emit_filter_test_log
from territory.common.infrastructure.lakehouse.metrics import timed_op
from territory.common.infrastructure.lakehouse.table_filters import asset_filter_where

from .geom import _wkb_to_geojson
from .sql import _green_area_id_in_sql


def read_assets_in_bbox(
    resolutions: list[IngestResolution],
    bbox: tuple[float, float, float, float],
    limit: int,
    *,
    green_area_id: int | None = None,
    green_area_ids: list[int] | None = None,
    clip_geom=None,
    filters: dict[str, Any] | None = None,
) -> list[tuple]:
    """Return rows (id, geometry_dict, asset_type, geometry_type, species, region_id, province_id).

    Point assets (P) stay lon/lat markers for pan latency. Line/surface assets
    (L/S) keep full geom_wkb so hedges/flowerbeds show their true silhouette
    (same product rule as managed areas).
    """
    if not resolutions or limit <= 0:
        return []
    if green_area_ids is not None and not green_area_ids:
        return []
    minx, miny, maxx, maxy = bbox
    if clip_geom is not None:
        cx0, cy0, cx1, cy1 = clip_geom.bounds
        ix0, iy0 = max(minx, cx0), max(miny, cy0)
        ix1, iy1 = min(maxx, cx1), min(maxy, cy1)
        if ix0 > ix1 or iy0 > iy1:
            # Cerca area clip outside current camera (debug 4fe799 villa@z19).
            minx, miny, maxx, maxy = cx0, cy0, cx1, cy1
        else:
            minx, miny, maxx, maxy = ix0, iy0, ix1, iy1
    globs = [parquet_glob(r.object_prefix) for r in resolutions]
    # DuckDB list of files
    files_sql = ", ".join(f"'{g}'" for g in globs)
    where_parts = [
        f"lon BETWEEN {minx} AND {maxx}",
        f"lat BETWEEN {miny} AND {maxy}",
    ]
    if green_area_id is not None:
        where_parts.append(f"green_area_id = {int(green_area_id)}")
    if green_area_ids is not None:
        clause = _green_area_id_in_sql(green_area_ids)
        if clause is None:
            return []
        where_parts.append(clause)
    where_parts.extend(asset_filter_where(filters))
    where_sql = " AND ".join(where_parts)
    fetch_limit = int(limit) if clip_geom is None else int(limit) * 4

    con = connect_lakehouse()
    try:
        with timed_op(
            "silver_assets_bbox",
            municipalities=len(resolutions),
            limit=limit,
        ):
            rows = con.execute(
                f"""
                SELECT id, lon, lat, asset_type, geometry_type, species,
                       region_id, province_id, municipality_id, geom_wkb
                FROM read_parquet([{files_sql}], union_by_name=true)
                WHERE {where_sql}
                LIMIT {fetch_limit}
                """
            ).fetchall()
    finally:
        con.close()

    out: list[tuple] = []
    clip_prep = None
    if clip_geom is not None:
        from shapely.geometry import Point

        try:
            from shapely.prepared import prep

            clip_prep = prep(clip_geom)
        except Exception:
            clip_prep = None

    for r in rows:
        lon, lat = r[1], r[2]
        if lon is None or lat is None:
            continue
        lon_f, lat_f = float(lon), float(lat)
        if clip_geom is not None:
            from shapely.geometry import Point

            pt = Point(lon_f, lat_f)
            hit = clip_prep.intersects(pt) if clip_prep is not None else clip_geom.intersects(pt)
            if not hit:
                continue
        geom_type_raw = r[4]
        geom_type = str(geom_type_raw or "").strip().upper()
        geom_wkb = r[9]
        use_full = geom_type in ("L", "S") and geom_wkb is not None
        if use_full:
            geom = _wkb_to_geojson(geom_wkb, lon_f, lat_f)
            if geom is None:
                geom = {"type": "Point", "coordinates": [lon_f, lat_f]}
                use_full = False
        else:
            geom = {"type": "Point", "coordinates": [lon_f, lat_f]}
        out.append(
            (
                int(r[0]),
                geom,
                r[3],
                r[4],
                r[5],
                int(r[6]),
                int(r[7]),
                int(r[8]) if r[8] is not None else None,
            )
        )
        if len(out) >= limit:
            break
    emit_filter_test_log(
        kind="asset",
        surface="viewport",
        filters=filters,
        n_features=len(out),
        where_sql=where_sql,
    )
    return out


def read_asset_by_pk(
    resolutions: list[IngestResolution],
    asset_id: int,
    region_id: int,
    province_id: int,
    municipality_id: int | None = None,
) -> dict[str, Any] | None:
    """Resolve one asset. ``id`` is unique only within a municipality."""
    if not resolutions:
        return None
    globs = [parquet_glob(r.object_prefix) for r in resolutions]
    files_sql = ", ".join(f"'{g}'" for g in globs)
    muni_sql = (
        f" AND municipality_id = {int(municipality_id)}"
        if municipality_id is not None
        else ""
    )
    con = connect_lakehouse()
    try:
        row = con.execute(
            f"""
            SELECT id, green_area_id, region_id, province_id, municipality_id,
                   asset_type, geometry_type, lon, lat, geom_wkb,
                   species, family, genus, variety,
                   health_status, asset_status, survey_date,
                   species_code, trunk_diameter_cm, plant_height_m, crown_diameter_m,
                   growth_stage, protection_status
            FROM read_parquet([{files_sql}], union_by_name=true)
            WHERE id = {int(asset_id)}
              AND region_id = {int(region_id)}
              AND province_id = {int(province_id)}
              {muni_sql}
            LIMIT 1
            """
        ).fetchone()
    finally:
        con.close()
    if not row:
        return None
    return {
        "id": int(row[0]),
        "green_area_id": int(row[1]) if row[1] is not None else None,
        "region_id": int(row[2]),
        "province_id": int(row[3]),
        "municipality_id": int(row[4]),
        "asset_type": row[5],
        "geometry_type": row[6],
        "lon": float(row[7]) if row[7] is not None else None,
        "lat": float(row[8]) if row[8] is not None else None,
        "geom_wkb": bytes(row[9]) if row[9] is not None else None,
        "species": row[10],
        "family": row[11],
        "genus": row[12],
        "variety": row[13],
        "health_status": row[14],
        "asset_status": row[15],
        "survey_date": row[16],
        "species_code": row[17],
        "trunk_diameter_cm": float(row[18]) if row[18] is not None else None,
        "plant_height_m": float(row[19]) if row[19] is not None else None,
        "crown_diameter_m": float(row[20]) if row[20] is not None else None,
        "growth_stage": row[21],
        "protection_status": row[22],
    }
