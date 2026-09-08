"""DuckDB reads against lakehouse silver Parquet (assets / areas)."""

from __future__ import annotations

import json
from datetime import date
from typing import Any, Literal

from territory.common.infrastructure.lakehouse.catalog import (
    IngestResolution,
    resolve_latest_ingests,
)
from territory.common.infrastructure.lakehouse.duckdb_client import (
    connect_lakehouse,
    parquet_glob,
)
from territory.common.infrastructure.lakehouse.metrics import timed_op

DatasetName = Literal["assets", "areas"]


def resolve_prefixes(
    *,
    dataset: DatasetName,
    date_from: date | None,
    date_to: date | None,
    region_id: int | None = None,
    province_id: int | None = None,
    municipality_id: int | None = None,
    municipality_ids: list[int] | None = None,
) -> list[IngestResolution]:
    if date_from is None or date_to is None:
        return []
    ids: list[int] | None
    if municipality_id is not None:
        ids = [municipality_id]
    elif municipality_ids is not None:
        ids = list(municipality_ids)
    else:
        ids = None
    resolved = resolve_latest_ingests(
        dataset=dataset,
        date_from=date_from,
        date_to=date_to,
        municipality_ids=ids,
    )
    if region_id is not None:
        resolved = [r for r in resolved if r.region_id == region_id]
    if province_id is not None:
        resolved = [r for r in resolved if r.province_id == province_id]
    return resolved


def _wkb_to_geojson(geom_wkb: bytes | memoryview | None, lon: float | None, lat: float | None) -> dict | None:
    if geom_wkb is not None:
        try:
            from shapely import to_geojson, wkb

            geom = wkb.loads(bytes(geom_wkb))
            return json.loads(to_geojson(geom))
        except Exception:
            pass
    if lon is not None and lat is not None:
        return {"type": "Point", "coordinates": [float(lon), float(lat)]}
    return None


def read_assets_in_bbox(
    resolutions: list[IngestResolution],
    bbox: tuple[float, float, float, float],
    limit: int,
    *,
    green_area_id: int | None = None,
    clip_geom=None,
) -> list[tuple]:
    """Return rows (id, geometry_dict, asset_type, geometry_type, species, region_id, province_id).

    Viewport markers use lon/lat Points only (no geom_wkb decode): detail views
    still load full WKB via read_asset_by_pk. Skipping WKB cut measured pan
    latency at raw zoom (800 rows).
    """
    if not resolutions or limit <= 0:
        return []
    minx, miny, maxx, maxy = bbox
    if clip_geom is not None:
        cx0, cy0, cx1, cy1 = clip_geom.bounds
        minx, miny = max(minx, cx0), max(miny, cy0)
        maxx, maxy = min(maxx, cx1), min(maxy, cy1)
        if minx > maxx or miny > maxy:
            return []
    globs = [parquet_glob(r.object_prefix) for r in resolutions]
    # DuckDB list of files
    files_sql = ", ".join(f"'{g}'" for g in globs)
    where_extra = ""
    if green_area_id is not None:
        where_extra = f" AND green_area_id = {int(green_area_id)}"
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
                SELECT id, lon, lat, asset_type, geometry_type, species, region_id, province_id
                FROM read_parquet([{files_sql}], union_by_name=true)
                WHERE lon BETWEEN {minx} AND {maxx}
                  AND lat BETWEEN {miny} AND {maxy}
                  {where_extra}
                LIMIT {fetch_limit}
                """
            ).fetchall()
    finally:
        con.close()

    out: list[tuple] = []
    if clip_geom is not None:
        from shapely.geometry import Point

        clip_prep = None
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
            pt = Point(lon_f, lat_f)
            hit = clip_prep.intersects(pt) if clip_prep is not None else clip_geom.intersects(pt)
            if not hit:
                continue
        geom = {"type": "Point", "coordinates": [lon_f, lat_f]}
        out.append((int(r[0]), geom, r[3], r[4], r[5], int(r[6]), int(r[7])))
        if len(out) >= limit:
            break
    return out


def read_asset_by_pk(
    resolutions: list[IngestResolution],
    asset_id: int,
    region_id: int,
    province_id: int,
) -> dict[str, Any] | None:
    if not resolutions:
        return None
    globs = [parquet_glob(r.object_prefix) for r in resolutions]
    files_sql = ", ".join(f"'{g}'" for g in globs)
    con = connect_lakehouse()
    try:
        row = con.execute(
            f"""
            SELECT id, green_area_id, region_id, province_id, municipality_id,
                   asset_type, geometry_type, lon, lat, geom_wkb,
                   species, family, genus, variety,
                   health_status, asset_status, survey_date
            FROM read_parquet([{files_sql}], union_by_name=true)
            WHERE id = {int(asset_id)}
              AND region_id = {int(region_id)}
              AND province_id = {int(province_id)}
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
    }


def read_asset_geometry(row: dict[str, Any]) -> dict[str, Any] | None:
    return _wkb_to_geojson(row.get("geom_wkb"), row.get("lon"), row.get("lat"))


def read_asset_bbox(row: dict[str, Any]) -> list[float] | None:
    geom = read_asset_geometry(row)
    if geom is None:
        return None
    try:
        from shapely.geometry import shape

        b = shape(geom).bounds  # minx, miny, maxx, maxy
        return [float(b[0]), float(b[1]), float(b[2]), float(b[3])]
    except Exception:
        lon, lat = row.get("lon"), row.get("lat")
        if lon is None or lat is None:
            return None
        return [float(lon), float(lat), float(lon), float(lat)]


def _parse_clip_geom(clip_wkt: str | None):
    """Parse validated POLYGON/MULTIPOLYGON WKT to shapely geometry, or None."""
    if not clip_wkt:
        return None
    from shapely import wkt as shapely_wkt

    from territory.common.infrastructure.clip_wkt import normalize_clip_wkt

    text = normalize_clip_wkt(clip_wkt)
    if text is None:
        return None
    return shapely_wkt.loads(text)


def _id_in_sql(ids: list[int]) -> str | None:
    """Return ``id IN (...)`` or None when the allow-list is empty (caller should short-circuit)."""
    if not ids:
        return None
    return "id IN (" + ",".join(str(int(i)) for i in ids) + ")"


def list_assets_table(
    resolutions: list[IngestResolution],
    *,
    page: int,
    page_size: int,
    green_area_id: int | None = None,
    id_allowlist: list[int] | None = None,
    sort_by: str | None = None,
    sort_dir: str = "asc",
    filters: dict[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], int]:
    if not resolutions:
        return [], 0
    globs = [parquet_glob(r.object_prefix) for r in resolutions]
    files_sql = ", ".join(f"'{g}'" for g in globs)
    where: list[str] = ["1=1"]
    if green_area_id is not None:
        where.append(f"green_area_id = {int(green_area_id)}")
    if id_allowlist is not None:
        clause = _id_in_sql(id_allowlist)
        if clause is None:
            return [], 0
        where.append(clause)
    filters = filters or {}
    for key in ("asset_type", "geometry_type", "health_status", "asset_status"):
        val = filters.get(key)
        if val:
            safe = str(val).replace("'", "''")
            where.append(f"{key} = '{safe}'")
    q = filters.get("q")
    if q:
        safe = str(q).replace("'", "''")
        where.append(
            "("
            f"species ILIKE '%{safe}%' OR family ILIKE '%{safe}%' "
            f"OR genus ILIKE '%{safe}%' OR variety ILIKE '%{safe}%'"
            ")"
        )
    where_sql = " AND ".join(where)
    allowed_sort = {
        "id",
        "species",
        "family",
        "genus",
        "asset_type",
        "survey_date",
        "health_status",
    }
    order_col = sort_by if sort_by in allowed_sort else "id"
    order_dir = "DESC" if sort_dir.lower() == "desc" else "ASC"
    offset = max(0, (page - 1) * page_size)

    con = connect_lakehouse()
    try:
        total = con.execute(
            f"""
            SELECT count(*) FROM read_parquet([{files_sql}], union_by_name=true)
            WHERE {where_sql}
            """
        ).fetchone()[0]
        rows = con.execute(
            f"""
            SELECT id, green_area_id, region_id, province_id, municipality_id,
                   asset_type, geometry_type, lon, lat,
                   species, family, genus, variety,
                   health_status, asset_status, survey_date
            FROM read_parquet([{files_sql}], union_by_name=true)
            WHERE {where_sql}
            ORDER BY {order_col} {order_dir}
            LIMIT {int(page_size)} OFFSET {int(offset)}
            """
        ).fetchall()
    finally:
        con.close()

    data = [
        {
            "id": int(r[0]),
            "green_area_id": int(r[1]) if r[1] is not None else None,
            "region_id": int(r[2]),
            "province_id": int(r[3]),
            "municipality_id": int(r[4]),
            "asset_type": r[5],
            "geometry_type": r[6],
            "longitude": float(r[7]) if r[7] is not None else None,
            "latitude": float(r[8]) if r[8] is not None else None,
            "species": r[9],
            "family": r[10],
            "genus": r[11],
            "variety": r[12],
            "health_status": r[13],
            "asset_status": r[14],
            "survey_date": r[15],
        }
        for r in rows
    ]
    return data, int(total)


def read_areas_in_bbox(
    resolutions: list[IngestResolution],
    bbox: tuple[float, float, float, float],
    limit: int,
    *,
    clip_geom=None,
    simplify_tolerance_deg: float = 0.0,
) -> list[tuple]:
    """Rows (id, geometry_dict, name, region_id, province_id, municipality_id, level)."""
    if not resolutions or limit <= 0:
        return []
    minx, miny, maxx, maxy = bbox
    if clip_geom is not None:
        cx0, cy0, cx1, cy1 = clip_geom.bounds
        minx, miny = max(minx, cx0), max(miny, cy0)
        maxx, maxy = min(maxx, cx1), min(maxy, cy1)
        if minx > maxx or miny > maxy:
            return []
    globs = [parquet_glob(r.object_prefix) for r in resolutions]
    files_sql = ", ".join(f"'{g}'" for g in globs)
    con = connect_lakehouse()
    try:
        rows = con.execute(
            f"""
            SELECT id, geom_wkb, lon, lat, name, level, parent_id, region_id, province_id, municipality_id
            FROM read_parquet([{files_sql}], union_by_name=true)
            WHERE lon BETWEEN {minx} AND {maxx}
              AND lat BETWEEN {miny} AND {maxy}
            LIMIT {int(limit) if clip_geom is None else int(limit) * 4}
            """
        ).fetchall()
    finally:
        con.close()
    out: list[tuple] = []
    from shapely import to_geojson, wkb as shapely_wkb

    tol = float(simplify_tolerance_deg or 0.0)
    for r in rows:
        if r[1] is None and (r[2] is None or r[3] is None):
            continue
        try:
            geom = shapely_wkb.loads(bytes(r[1])) if r[1] is not None else None
        except Exception:
            geom = None
        if clip_geom is not None:
            if geom is None:
                continue
            try:
                if not geom.intersects(clip_geom):
                    continue
            except Exception:
                continue
        if geom is not None and tol > 0:
            try:
                # preserve_topology=False is faster and fine for map silhouettes.
                geom = geom.simplify(tol, preserve_topology=False)
            except Exception:
                pass
        if geom is not None:
            try:
                geojson = json.loads(to_geojson(geom))
            except Exception:
                geojson = _wkb_to_geojson(r[1], r[2], r[3])
        else:
            geojson = _wkb_to_geojson(None, r[2], r[3])
        if geojson is None:
            continue
        # id, geometry, name, level, parent_id, region_id, province_id, municipality_id
        out.append(
            (
                int(r[0]),
                geojson,
                r[4],
                int(r[5]),
                int(r[6]) if r[6] is not None else None,
                int(r[7]),
                int(r[8]),
                int(r[9]),
            )
        )
        if len(out) >= limit:
            break
    return out


def read_area_by_pk(
    resolutions: list[IngestResolution],
    area_id: int,
    region_id: int,
    province_id: int,
) -> dict[str, Any] | None:
    if not resolutions:
        return None
    globs = [parquet_glob(r.object_prefix) for r in resolutions]
    files_sql = ", ".join(f"'{g}'" for g in globs)
    con = connect_lakehouse()
    try:
        row = con.execute(
            f"""
            SELECT id, region_id, province_id, municipality_id, parent_id, level, name,
                   lon, lat, geom_wkb, area_classification, administrative_status, survey_date
            FROM read_parquet([{files_sql}], union_by_name=true)
            WHERE id = {int(area_id)}
              AND region_id = {int(region_id)}
              AND province_id = {int(province_id)}
            LIMIT 1
            """
        ).fetchone()
    finally:
        con.close()
    if not row:
        return None
    return {
        "id": int(row[0]),
        "region_id": int(row[1]),
        "province_id": int(row[2]),
        "municipality_id": int(row[3]),
        "parent_id": int(row[4]) if row[4] is not None else None,
        "level": int(row[5]),
        "name": row[6],
        "lon": float(row[7]) if row[7] is not None else None,
        "lat": float(row[8]) if row[8] is not None else None,
        "geom_wkb": bytes(row[9]) if row[9] is not None else None,
        "area_classification": row[10],
        "administrative_status": row[11],
        "survey_date": row[12],
    }


def list_areas_table(
    resolutions: list[IngestResolution],
    *,
    page: int,
    page_size: int,
    sort_by: str | None = None,
    sort_dir: str = "asc",
    filters: dict[str, Any] | None = None,
    area_id: int | None = None,
    parent_id: int | None = None,
    contained_in_area_id: int | None = None,
    region_id: int | None = None,
    province_id: int | None = None,
    municipality_id: int | None = None,
    id_allowlist: list[int] | None = None,
    default_roots_only: bool = True,
) -> tuple[list[dict[str, Any]], int]:
    """Paginated areas table.

    Territory scope (mirrors legacy PostGIS):
    - ``area_id`` exact row
    - else ``parent_id`` children
    - else ``contained_in_area_id`` / ``id_allowlist`` (precomputed spatial kids / sub-municipal)
    - else roots only (``parent_id IS NULL``) when ``default_roots_only``
    """
    if not resolutions:
        return [], 0
    globs = [parquet_glob(r.object_prefix) for r in resolutions]
    files_sql = ", ".join(f"'{g}'" for g in globs)
    where: list[str] = ["1=1"]
    filters = filters or {}
    if area_id is not None:
        where.append(f"id = {int(area_id)}")
    elif parent_id is not None:
        where.append(f"parent_id = {int(parent_id)}")
    elif contained_in_area_id is not None:
        if region_id is None or province_id is None or municipality_id is None:
            return [], 0
        # Spatial children only (exclude selected), same as legacy table query.
        child_rows = read_areas_contained_or_intersecting(
            resolutions,
            area_id=contained_in_area_id,
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
        )
        child_ids = [int(r[0]) for r in child_rows[1:]]
        clause = _id_in_sql(child_ids)
        if clause is None:
            return [], 0
        where.append(clause)
    elif id_allowlist is not None:
        clause = _id_in_sql(id_allowlist)
        if clause is None:
            return [], 0
        where.append(clause)
    elif default_roots_only:
        where.append("parent_id IS NULL")
    if filters.get("q"):
        safe = str(filters["q"]).replace("'", "''")
        where.append(f"name ILIKE '%{safe}%'")
    where_sql = " AND ".join(where)
    order_col = sort_by if sort_by in {"id", "name", "level", "survey_date"} else "id"
    order_dir = "DESC" if sort_dir.lower() == "desc" else "ASC"
    offset = max(0, (page - 1) * page_size)
    con = connect_lakehouse()
    try:
        total = con.execute(
            f"SELECT count(*) FROM read_parquet([{files_sql}], union_by_name=true) WHERE {where_sql}"
        ).fetchone()[0]
        rows = con.execute(
            f"""
            SELECT id, region_id, province_id, municipality_id, parent_id, level, name,
                   lon, lat, area_classification, administrative_status, survey_date
            FROM read_parquet([{files_sql}], union_by_name=true)
            WHERE {where_sql}
            ORDER BY {order_col} {order_dir}
            LIMIT {int(page_size)} OFFSET {int(offset)}
            """
        ).fetchall()
    finally:
        con.close()
    data = [
        {
            "id": int(r[0]),
            "region_id": int(r[1]),
            "province_id": int(r[2]),
            "municipality_id": int(r[3]),
            "parent_id": int(r[4]) if r[4] is not None else None,
            "level": int(r[5]),
            "name": r[6],
            "longitude": float(r[7]) if r[7] is not None else None,
            "latitude": float(r[8]) if r[8] is not None else None,
            "area_classification": r[9],
            "administrative_status": r[10],
            "survey_date": r[11],
        }
        for r in rows
    ]
    return data, int(total)


# Minimum geodesic overlap (m²) between candidate and selected area; excludes boundary-only adjacency.
_MIN_GREEN_AREA_INTERSECTION_M2 = 1.0
_METERS_PER_DEGREE = 111_320.0
# Hard cap for municipality-wide catalog FeatureCollections (parity with previous PG unbounded loads).
_CATALOG_FEATURE_LIMIT = 50_000


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
    import math

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
    limit: int = _CATALOG_FEATURE_LIMIT,
) -> list[tuple]:
    """Direct children of parent_id → FC row tuples."""
    where = f"parent_id = {int(parent_id)} AND region_id = {int(region_id)}"
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


def read_areas_contained_or_intersecting(
    resolutions: list[IngestResolution],
    *,
    area_id: int,
    region_id: int,
    province_id: int,
    municipality_id: int,
    limit: int = _CATALOG_FEATURE_LIMIT,
) -> list[tuple]:
    """Selected area first, then level+1 areas with real overlap (≥ 1 m²)."""
    from shapely import wkb as shapely_wkb

    where_all = (
        f"municipality_id = {int(municipality_id)}"
        f" AND region_id = {int(region_id)}"
        f" AND province_id = {int(province_id)}"
    )
    raw = _fetch_area_raw_rows(resolutions, where_all, limit)
    selected_raw = next((r for r in raw if int(r[0]) == int(area_id)), None)
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

    children: list[tuple] = []
    for r in raw:
        if int(r[0]) == int(area_id) or r[1] is None:
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
    return [selected_tuple] + children


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


_WEB_MERCATOR_HALF = 20037508.34
_CLIP_AGG_FETCH_CAP = 300_000


def _lonlat_to_mercator(lon: float, lat: float) -> tuple[float, float]:
    import math

    x = lon * _WEB_MERCATOR_HALF / 180.0
    y = math.log(math.tan(math.radians(90.0 + lat) / 2.0)) * _WEB_MERCATOR_HALF / math.pi
    return x, y


def aggregate_assets_in_clip(
    resolutions: list[IngestResolution],
    clip_geom,
    *,
    mode: Literal["grid", "municipality"],
    cell_size_m: float | None = None,
    view_bbox: tuple[float, float, float, float] | None = None,
) -> list:
    """Exact cluster buckets for draw clip (silver ∩ clip). Returns ViewportCluster list."""
    import math

    from shapely.geometry import Point
    from shapely.prepared import prep

    from territory.assets.infrastructure.repository.viewport_cluster import ViewportCluster

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
