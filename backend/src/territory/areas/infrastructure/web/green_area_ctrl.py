"""Green areas HTTP routes."""

from __future__ import annotations

from datetime import date
from typing import Literal

import geobuf

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response

from core.api.dependencies import get_green_areas_uc
from territory.areas.infrastructure.dto.output import GreenAreasOutput
from territory.common.infrastructure.clip_wkt import ClipWktError, normalize_clip_wkt
from territory.common.infrastructure.dto.green_detail_out import GreenDetailOut
from territory.common.infrastructure.green_table_page_out import GreenTablePageOut
from territory.common.infrastructure.lakehouse.http_dates import parse_lakehouse_date_range
from territory.common.infrastructure.lakehouse.table_filters import (
    AREA_FILTER_KEYS,
    collect_filters,
)

router = APIRouter(tags=["territory-areas"])

GEOBUF_MEDIA_TYPE = "application/x-geobuf"

_EMPTY_GEOBUF = geobuf.encode({"type": "FeatureCollection", "features": []})

def _clip_wkt_or_400(clip_wkt: str | None) -> str | None:
    try:
        return normalize_clip_wkt(clip_wkt)
    except ClipWktError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

def _empty_response(output_format: str | None) -> GreenAreasOutput | Response:
    if output_format == "geobuf":
        return Response(content=_EMPTY_GEOBUF, media_type=GEOBUF_MEDIA_TYPE)
    return GreenAreasOutput(features=[])

_DATE_FROM = Query(..., description="Ingest range start inclusive (ISO date, required)")
_DATE_TO = Query(..., description="Ingest range end inclusive (ISO date, required)")

def _uc(date_from: date, date_to: date):
    df, dt = parse_lakehouse_date_range(date_from, date_to)
    return get_green_areas_uc(date_from=df, date_to=dt)

@router.get("/green-areas", response_model=None)
def get_green_areas(
    request: Request,
    region_id: int,
    province_id: int,
    parent_id: int | None = None,
    municipality_id: int | None = None,
    sub_municipal_area_id: int | None = None,
    contained_in_area_id: int | None = None,
    date_from: date = _DATE_FROM,
    date_to: date = _DATE_TO,
    # Renamed from `format` to avoid shadowing the Python built-in.
    output_format: str | None = Query(None, alias="format"),
) -> GreenAreasOutput | Response:
    """
    Return green areas (N-level hierarchy).
    - With contained_in_area_id: the chosen area first, then level+1 areas with real geodesic overlap
      (≥ 1 m²), not boundary-only adjacency.
    - With parent_id: children of that area (by parent_id).
    - Without: root areas for municipality_id (optionally filtered by sub_municipal_area_id).
    region_id and province_id required. Use ?format=geobuf for compact binary response.
    Attribute filters (same keys as /table|/viewport) AND-overlay on parent/contained paths.
    """
    if parent_id is None and municipality_id is None and contained_in_area_id is None:
        return _empty_response(output_format)

    filters = collect_filters(request.query_params, AREA_FILTER_KEYS)
    result = _uc(date_from, date_to).catalog_green_areas(
        region_id,
        province_id=province_id,
        parent_id=parent_id,
        municipality_id=municipality_id,
        sub_municipal_area_id=sub_municipal_area_id,
        contained_in_area_id=contained_in_area_id,
        filters=filters or None,
    )

    if not result.get("features"):
        return _empty_response(output_format)

    if output_format == "geobuf":
        return Response(content=geobuf.encode(result), media_type=GEOBUF_MEDIA_TYPE)
    return GreenAreasOutput.model_validate(result)

@router.get("/green-areas/viewport", response_model=None)
def get_green_areas_viewport(
    request: Request,
    bbox: str = Query(..., description="minLon,minLat,maxLon,maxLat (EPSG:4326)"),
    zoom: float = Query(..., ge=0, le=22),
    region_id: int | None = None,
    province_id: int | None = None,
    municipality_id: int | None = None,
    sub_municipal_area_id: int | None = None,
    clip_wkt: str | None = Query(None, description="EPSG:4326 POLYGON/MULTIPOLYGON WKT clip"),
    date_from: date = _DATE_FROM,
    date_to: date = _DATE_TO,
    output_format: str | None = Query(None, alias="format"),
) -> GreenAreasOutput | Response:
    """Viewport-sized root green areas for map rendering.

    Empty below the areas min zoom; otherwise polygons intersecting the bbox,
    simplified to display resolution and capped (largest areas first).
    Territory filters are optional: omit them for a nationwide view.
    Attribute filters (same keys as /table) AND-overlay via query params."""
    try:
        parts = [float(p) for p in bbox.split(",")]
    except ValueError:
        parts = []
    if len(parts) != 4:
        raise HTTPException(status_code=422, detail="bbox must be minLon,minLat,maxLon,maxLat")
    filters = collect_filters(request.query_params, AREA_FILTER_KEYS)
    result = _uc(date_from, date_to).viewport_green_areas(
        (parts[0], parts[1], parts[2], parts[3]),
        zoom,
        region_id=region_id,
        province_id=province_id,
        municipality_id=municipality_id,
        sub_municipal_area_id=sub_municipal_area_id,
        clip_wkt=_clip_wkt_or_400(clip_wkt),
        filters=filters or None,
    )
    # #region agent log
    try:
        import json as _json
        import time as _time
        import urllib.request as _urlreq

        _feats = result.get("features") or []
        _samples = []
        for _f in _feats[:5]:
            _p = (_f.get("properties") or {}) if isinstance(_f, dict) else {}
            _g = (_f.get("geometry") or {}) if isinstance(_f, dict) else {}
            _samples.append(
                {
                    "id": _p.get("id") or _f.get("id"),
                    "name": _p.get("name"),
                    "muni": _p.get("municipality_id"),
                    "gtype": _g.get("type"),
                    "has_coords": bool(_g.get("coordinates")),
                }
            )
        _payload = _json.dumps(
            {
                "sessionId": "4fe799",
                "runId": "persist",
                "hypothesisId": "H-viewport-be",
                "location": "green_area_ctrl.get_green_areas_viewport",
                "message": "viewport_ctrl_out",
                "data": {
                    "zoom": zoom,
                    "bbox": parts,
                    "n_features": len(_feats),
                    "filter_keys": sorted(filters.keys()),
                    "filters": {k: str(v)[:80] for k, v in filters.items()},
                    "samples": _samples,
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
    if not result.get("features"):
        return _empty_response(output_format)
    if output_format == "geobuf":
        return Response(content=geobuf.encode(result), media_type=GEOBUF_MEDIA_TYPE)
    return GreenAreasOutput.model_validate(result)

@router.get("/green-areas/table", response_model=GreenTablePageOut)
def get_green_areas_table(
    request: Request,
    region_id: int | None = None,
    province_id: int | None = None,
    municipality_id: int | None = None,
    sub_municipal_area_id: int | None = None,
    contained_in_area_id: int | None = None,
    parent_id: int | None = None,
    area_id: int | None = None,
    clip_wkt: str | None = Query(None, description="EPSG:4326 POLYGON/MULTIPOLYGON WKT clip"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    sort_by: str | None = None,
    sort_dir: Literal["asc", "desc"] = "asc",
    date_from: date = _DATE_FROM,
    date_to: date = _DATE_TO,
) -> GreenTablePageOut:
    """Paginated, filtered and sorted green-areas table (no geometry).

    Attribute filters use the same product keys as /viewport (``AREA_FILTER_KEYS``),
    including range ends ``survey_date_from``/``to`` and ``surface_area_m2_min``/``max``.
    A hand-built Query param list previously dropped those range keys so the table
    could return rows the map correctly filtered out (debug 4fe799).
    """
    filters = collect_filters(request.query_params, AREA_FILTER_KEYS)
    # #region agent log
    try:
        import json as _json
        import time as _time
        import urllib.request as _urlreq

        _payload = _json.dumps(
            {
                "sessionId": "4fe799",
                "runId": "survey-exclude",
                "hypothesisId": "H-survey-exclude",
                "location": "green_area_ctrl.get_green_areas_table",
                "message": "table_filters_collected",
                "data": {
                    "filter_keys": sorted(filters.keys()),
                    "filters": {k: str(v)[:80] for k, v in filters.items()},
                    "raw_query": str(request.url.query)[:400],
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
    # National (unscoped) table is allowed — same rationale as green-assets/table.
    import time as _time_tbl

    _t_tbl = _time_tbl.monotonic()
    out = _uc(date_from, date_to).list_green_areas_table_paged(
        region_id,
        province_id,
        municipality_id,
        sub_municipal_area_id=sub_municipal_area_id,
        contained_in_area_id=contained_in_area_id,
        parent_id=parent_id,
        area_id=area_id,
        clip_wkt=_clip_wkt_or_400(clip_wkt),
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_dir=sort_dir,
        filters=filters or None,
    )
    _ms_tbl = int((_time_tbl.monotonic() - _t_tbl) * 1000)
    # #region agent log
    try:
        import json as _json
        import time as _time
        import urllib.request as _urlreq

        _rows = getattr(out, "data", None) or []
        _payload = _json.dumps(
            {
                "sessionId": "4fe799",
                "runId": "perf",
                "hypothesisId": "H-perf-areas-table",
                "location": "green_area_ctrl.get_green_areas_table",
                "message": "table_response",
                "data": {
                    "total": getattr(out, "total", None),
                    "nrows": len(_rows),
                    "ms_wall": _ms_tbl,
                    "filter_keys": sorted(filters.keys()),
                    "survey_date_from": filters.get("survey_date_from"),
                    "survey_date_to": filters.get("survey_date_to"),
                    "row_survey_dates": [
                        str(r.get("survey_date")) for r in _rows[:5] if isinstance(r, dict)
                    ],
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

# After static paths (viewport/table): otherwise {area_id} steals those segments → 422.
@router.get("/green-areas/{area_id}", response_model=GreenDetailOut)
def get_green_area_detail(
    area_id: int,
    region_id: int = Query(..., description="Partition key region_id"),
    province_id: int = Query(..., description="Partition key province_id"),
    municipality_id: int | None = Query(
        None, description="Optional municipality prune for lakehouse read"
    ),
    date_from: date = _DATE_FROM,
    date_to: date = _DATE_TO,
) -> GreenDetailOut:
    """Curated detail for map popover (summary + metadata subset)."""
    return _uc(date_from, date_to).get_green_area_detail(
        area_id,
        region_id=region_id,
        province_id=province_id,
        municipality_id=municipality_id,
    )
