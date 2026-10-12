"""Read assets for catalog and intersection queries."""

from __future__ import annotations

from territory.common.infrastructure.lakehouse.catalog import IngestResolution
from territory.common.infrastructure.lakehouse.duckdb_client import (
    connect_lakehouse,
    parquet_glob,
)

from .geom import _wkb_to_geojson

# Hard cap for municipality-wide catalog FeatureCollections (parity with previous PG unbounded loads).
_CATALOG_FEATURE_LIMIT = 50_000


def _files_sql(resolutions: list[IngestResolution]) -> str:
    globs = [parquet_glob(r.object_prefix) for r in resolutions]
    return ", ".join(f"'{g}'" for g in globs)


def read_assets_catalog(
    resolutions: list[IngestResolution],
    *,
    municipality_id: int,
    region_id: int,
    province_id: int,
    green_area_id: int | None = None,
    limit: int = _CATALOG_FEATURE_LIMIT,
) -> list[tuple]:
    """Municipality (or area-scoped) assets → FC row tuples for catalog."""
    if not resolutions or limit <= 0:
        return []
    files_sql = _files_sql(resolutions)
    where = (
        f"municipality_id = {int(municipality_id)}"
        f" AND region_id = {int(region_id)}"
        f" AND province_id = {int(province_id)}"
    )
    if green_area_id is not None:
        where += f" AND green_area_id = {int(green_area_id)}"
    con = connect_lakehouse()
    try:
        rows = con.execute(
            f"""
            SELECT id, geom_wkb, lon, lat, asset_type, geometry_type, species, region_id, province_id
            FROM read_parquet([{files_sql}], union_by_name=true)
            WHERE {where}
            LIMIT {int(limit)}
            """
        ).fetchall()
    finally:
        con.close()
    out: list[tuple] = []
    for r in rows:
        geom = _wkb_to_geojson(r[1], r[2], r[3])
        if geom is None:
            continue
        out.append(
            (
                int(r[0]),
                geom,
                r[4],
                r[5],
                r[6],
                int(r[7]),
                int(r[8]),
            )
        )
    return out


def read_assets_intersecting_geom(
    resolutions: list[IngestResolution],
    *,
    municipality_id: int,
    region_id: int,
    province_id: int,
    clip_geom,
    limit: int = _CATALOG_FEATURE_LIMIT,
) -> list[tuple]:
    """Assets whose point/geom intersects ``clip_geom`` (shapely). Prefetch via bbox then refine."""
    from shapely import wkb as shapely_wkb
    from shapely.geometry import Point

    minx, miny, maxx, maxy = clip_geom.bounds
    files_sql = _files_sql(resolutions)
    where = (
        f"municipality_id = {int(municipality_id)}"
        f" AND region_id = {int(region_id)}"
        f" AND province_id = {int(province_id)}"
        f" AND lon BETWEEN {minx} AND {maxx}"
        f" AND lat BETWEEN {miny} AND {maxy}"
    )
    con = connect_lakehouse()
    try:
        rows = con.execute(
            f"""
            SELECT id, geom_wkb, lon, lat, asset_type, geometry_type, species, region_id, province_id
            FROM read_parquet([{files_sql}], union_by_name=true)
            WHERE {where}
            LIMIT {int(limit)}
            """
        ).fetchall()
    finally:
        con.close()
    out: list[tuple] = []
    for r in rows:
        lon, lat = r[2], r[3]
        hit = False
        if r[1] is not None:
            try:
                hit = shapely_wkb.loads(bytes(r[1])).intersects(clip_geom)
            except Exception:
                hit = False
        if not hit and lon is not None and lat is not None:
            hit = clip_geom.intersects(Point(float(lon), float(lat)))
        if not hit:
            continue
        geom = _wkb_to_geojson(r[1], lon, lat)
        if geom is None:
            continue
        out.append(
            (
                int(r[0]),
                geom,
                r[4],
                r[5],
                r[6],
                int(r[7]),
                int(r[8]),
            )
        )
    return out
