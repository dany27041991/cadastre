"""Read areas by bounding box and primary key."""

from __future__ import annotations

import json
from typing import Any

from territory.common.infrastructure.lakehouse.catalog import IngestResolution
from territory.common.infrastructure.lakehouse.duckdb_client import (
    connect_lakehouse,
    parquet_glob,
)
from territory.common.infrastructure.lakehouse.filter_test_log import emit_filter_test_log
from territory.common.infrastructure.lakehouse.table_filters import area_filter_where

from .geom import _wkb_to_geojson


def read_areas_in_bbox(
    resolutions: list[IngestResolution],
    bbox: tuple[float, float, float, float],
    limit: int,
    *,
    clip_geom=None,
    simplify_tolerance_deg: float = 0.0,
    filters: dict[str, Any] | None = None,
) -> list[tuple]:
    """Rows (id, geometry_dict, name, region_id, province_id, municipality_id, level).

    Candidate rows are selected by a *padded* lon/lat window, then kept only if
    the polygon (or point) intersects the real viewport. Centroid-only filters
    drop large parks when the map shows an edge but the centroid is outside
    (e.g. Villa comunale Giardino Garibaldi at high zoom).
    """
    if not resolutions or limit <= 0:
        return []
    minx, miny, maxx, maxy = bbox
    if clip_geom is not None:
        cx0, cy0, cx1, cy1 = clip_geom.bounds
        # Reject only when map bbox and clip envelopes are disjoint.
        # Do NOT shrink the lon/lat candidate window to clip.bounds: parks that
        # graze a sub-municipal clip often have centroids outside that envelope
        # (Santa Rosa + Area boost 5: table hit, viewport miss).
        if maxx < cx0 or minx > cx1 or maxy < cy0 or miny > cy1:
            return []
    # ~2 km floor + half *map* viewport: catch centroids of parks that still
    # intersect the visible envelope (and any clip applied below).
    pad_x = max(0.02, (maxx - minx) * 0.5)
    pad_y = max(0.02, (maxy - miny) * 0.5)
    qminx, qminy = minx - pad_x, miny - pad_y
    qmaxx, qmaxy = maxx + pad_x, maxy + pad_y
    # Over-fetch candidates; geom.intersects prunes to `limit`.
    cand_limit = max(int(limit) * 8, 2000)
    globs = [parquet_glob(r.object_prefix) for r in resolutions]
    files_sql = ", ".join(f"'{g}'" for g in globs)
    # Attribute filters + few municipality files: skip lon/lat centroid window.
    # At z16–19 a tight bbox dropped Area boost (debug: areas n_features=0 while
    # mid-zoom had 1) even with a 2 km pad when the map centered on assets.
    filter_clauses = area_filter_where(filters)
    skip_centroid_window = bool(filter_clauses) and len(resolutions) <= 80
    where_parts: list[str] = []
    if not skip_centroid_window:
        where_parts.extend(
            [
                f"lon BETWEEN {qminx} AND {qmaxx}",
                f"lat BETWEEN {qminy} AND {qmaxy}",
            ]
        )
    where_parts.append("parent_id IS NULL")
    where_parts.extend(filter_clauses)
    where_sql = " AND ".join(where_parts)
    con = connect_lakehouse()
    try:
        rows = con.execute(
            f"""
            SELECT id, geom_wkb, lon, lat, name, level, parent_id, region_id, province_id, municipality_id
            FROM read_parquet([{files_sql}], union_by_name=true)
            WHERE {where_sql}
            LIMIT {cand_limit}
            """
        ).fetchall()
    finally:
        con.close()
    from shapely import to_geojson, wkb as shapely_wkb
    from shapely.geometry import box as shapely_box
    from shapely.geometry import Point

    # Filtered + few munis (Cerca): do not require geom ∩ current camera —
    # matches may lie outside the prior viewport (debug 4fe799: villa while
    # still framed on Area boost). Still honor an explicit draw clip.
    # Filtered high-zoom without that skip: keep matches in the padded envelope
    # so a tiny Area boost is not dropped when the map centers on its assets.
    if skip_centroid_window:
        view = None if clip_geom is None else clip_geom
    else:
        view = shapely_box(minx, miny, maxx, maxy)
        if clip_geom is not None:
            try:
                view = view.intersection(clip_geom)
            except Exception:
                pass
            if view.is_empty:
                return []
    tol = float(simplify_tolerance_deg or 0.0)
    scored: list[tuple[float, tuple, object]] = []
    for r in rows:
        if r[1] is None and (r[2] is None or r[3] is None):
            continue
        try:
            geom = shapely_wkb.loads(bytes(r[1])) if r[1] is not None else None
        except Exception:
            geom = None
        if geom is None and r[2] is not None and r[3] is not None:
            geom = Point(float(r[2]), float(r[3]))
        try:
            if geom is None:
                continue
            if view is not None and not geom.intersects(view):
                continue
        except Exception:
            continue
        try:
            score = float(geom.area) if geom is not None else 0.0
        except Exception:
            score = 0.0
        scored.append((score, r, geom))

    # Prefer larger polygons so parks beat tiny mock "Area boost" under the cap.
    scored.sort(key=lambda item: item[0], reverse=True)

    out: list[tuple] = []
    for _score, r, geom in scored:
        if tol > 0 and geom is not None and geom.geom_type != "Point":
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
    emit_filter_test_log(
        kind="area",
        surface="viewport",
        filters=filters,
        n_features=len(out),
        where_sql=where_sql,
    )
    # #region agent log
    try:
        import time as _time
        import urllib.request as _urlreq

        _payload = json.dumps(
            {
                "sessionId": "4fe799",
                "runId": "areas-map",
                "hypothesisId": "H-centroid",
                "location": "silver.areas_bbox.read_areas_in_bbox",
                "message": "areas_bbox_scan",
                "data": {
                    "n_sql": len(rows),
                    "n_scored": len(scored),
                    "n_out": len(out),
                    "n_resolutions": len(resolutions),
                    "skip_centroid_window": skip_centroid_window,
                    "has_filters": bool(filter_clauses),
                    "bbox": [minx, miny, maxx, maxy],
                },
                "timestamp": int(_time.time() * 1000),
            }
        ).encode("utf-8")
        _urlreq.urlopen(
            _urlreq.Request(
                "http://host.docker.internal:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c",
                data=_payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Debug-Session-Id": "4fe799",
                },
                method="POST",
            ),
            timeout=1.5,
        )
    except Exception:
        pass
    # #endregion
    return out


def read_area_by_pk(
    resolutions: list[IngestResolution],
    area_id: int,
    region_id: int,
    province_id: int,
    municipality_id: int | None = None,
) -> dict[str, Any] | None:
    """Resolve one area. ``id`` is unique only within a municipality.

    When ``municipality_id`` is omitted and several municipalities share the
    same local id, ``LIMIT 1`` is non-deterministic — callers must pass it
    for national / multi-muni scopes.
    """
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
            SELECT id, region_id, province_id, municipality_id, parent_id, level, name,
                   lon, lat, geom_wkb, area_classification, administrative_status, survey_date,
                   zril_identifier, istat_classification, intensity_of_fruition,
                   perimeter_type, surface_area_m2
            FROM read_parquet([{files_sql}], union_by_name=true)
            WHERE id = {int(area_id)}
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
        "zril_identifier": row[13],
        "istat_classification": row[14],
        "intensity_of_fruition": row[15],
        "perimeter_type": row[16],
        "surface_area_m2": float(row[17]) if row[17] is not None else None,
    }
