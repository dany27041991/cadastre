"""Green assets HTTP routes."""

from __future__ import annotations

from datetime import date
from typing import Literal

import geobuf

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response

from core.api.dependencies import get_green_assets_uc
from territory.assets.infrastructure.dto.output import GreenAssetsOutput
from territory.common.infrastructure.clip_wkt import ClipWktError, normalize_clip_wkt
from territory.common.infrastructure.dto.green_detail_out import GreenDetailOut
from territory.common.infrastructure.green_table_page_out import GreenTablePageOut
from territory.common.infrastructure.lakehouse.http_dates import parse_lakehouse_date_range
from territory.common.infrastructure.lakehouse.table_filters import (
    AREA_FILTER_KEYS,
    ASSET_FILTER_KEYS,
    collect_filters,
    collect_prefixed_filters,
)

router = APIRouter(tags=["territory-assets"])

GEOBUF_MEDIA_TYPE = "application/x-geobuf"

_EMPTY_GEOBUF = geobuf.encode({"type": "FeatureCollection", "features": []})

def _clip_wkt_or_400(clip_wkt: str | None) -> str | None:
    try:
        return normalize_clip_wkt(clip_wkt)
    except ClipWktError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

def _empty_response(
    output_format: str | None,
    *,
    headers: dict[str, str] | None = None,
) -> GreenAssetsOutput | Response:
    if output_format == "geobuf":
        return Response(content=_EMPTY_GEOBUF, media_type=GEOBUF_MEDIA_TYPE, headers=headers)
    # JSON path: encode flag via empty collection only (header still set on Response if needed)
    if headers:
        return Response(
            content='{"type":"FeatureCollection","features":[]}',
            media_type="application/json",
            headers=headers,
        )
    return GreenAssetsOutput(features=[])

_DATE_FROM = Query(..., description="Ingest range start inclusive (ISO date, required)")
_DATE_TO = Query(..., description="Ingest range end inclusive (ISO date, required)")

def _uc(date_from: date, date_to: date):
    df, dt = parse_lakehouse_date_range(date_from, date_to)
    return get_green_assets_uc(date_from=df, date_to=dt)

@router.get("/green-assets", response_model=None)
def get_green_assets(
    region_id: int,
    province_id: int,
    municipality_id: int,
    green_area_id: int | None = None,
    sub_municipal_area_id: int | None = None,
    date_from: date = _DATE_FROM,
    date_to: date = _DATE_TO,
    # Renamed from `format` to avoid shadowing the Python built-in.
    output_format: str | None = Query(None, alias="format"),
) -> GreenAssetsOutput | Response:
    """Return green assets (trees, rows, lawns, etc.) for the given area.
    When sub_municipal_area_id is set, only assets intersecting that sub-municipal area are returned.
    region_id and province_id required. Use ?format=geobuf for compact binary response."""
    result = _uc(date_from, date_to).catalog_green_assets(
        region_id,
        municipality_id,
        province_id=province_id,
        green_area_id=green_area_id,
        sub_municipal_area_id=sub_municipal_area_id,
    )
    if not result.get("features"):
        return _empty_response(output_format)
    if output_format == "geobuf":
        return Response(content=geobuf.encode(result), media_type=GEOBUF_MEDIA_TYPE)
    return GreenAssetsOutput.model_validate(result)

@router.get("/green-assets/viewport", response_model=None)
def get_green_assets_viewport(
    request: Request,
    bbox: str = Query(..., description="minLon,minLat,maxLon,maxLat (EPSG:4326)"),
    zoom: float = Query(..., ge=0, le=22),
    region_id: int | None = None,
    province_id: int | None = None,
    municipality_id: int | None = None,
    sub_municipal_area_id: int | None = None,
    green_area_id: int | None = None,
    clip_wkt: str | None = Query(None, description="EPSG:4326 POLYGON/MULTIPOLYGON WKT clip"),
    date_from: date = _DATE_FROM,
    date_to: date = _DATE_TO,
    output_format: str | None = Query(None, alias="format"),
) -> GreenAssetsOutput | Response:
    """Viewport-sized green assets for map rendering at national scale.

    Returns raw assets at the vendor's last zoom level, gold lakehouse clusters otherwise.
    With clip_wkt, cluster counts are exact (silver∩clip) under soft cap; over-cap sets
    header X-Cadastre-Cluster-Over-Cap: 1.
    Attribute filters (same keys as /table) skip gold/admin and AND-overlay on silver raw.
    """
    from territory.common.infrastructure.lakehouse.clip_exact_flag import (
        is_cluster_over_cap,
        reset_cluster_over_cap,
    )

    try:
        parts = [float(p) for p in bbox.split(",")]
    except ValueError:
        parts = []
    if len(parts) != 4:
        raise HTTPException(status_code=422, detail="bbox must be minLon,minLat,maxLon,maxLat")
    reset_cluster_over_cap()
    filters = collect_filters(request.query_params, ASSET_FILTER_KEYS)
    area_filters = collect_prefixed_filters(request.query_params, AREA_FILTER_KEYS)
    import time as _time_wall

    _t_wall = _time_wall.monotonic()
    result = _uc(date_from, date_to).viewport_green_assets(
        (parts[0], parts[1], parts[2], parts[3]),
        zoom,
        region_id=region_id,
        province_id=province_id,
        municipality_id=municipality_id,
        sub_municipal_area_id=sub_municipal_area_id,
        green_area_id=green_area_id,
        clip_wkt=_clip_wkt_or_400(clip_wkt),
        filters=filters or None,
        area_filters=area_filters or None,
    )
    _ms_wall = int((_time_wall.monotonic() - _t_wall) * 1000)
    # #region agent log
    try:
        import json as _json
        import time as _time
        import urllib.request as _urlreq

        _feats = result.get("features") or []
        _n_cluster = 0
        _sum_cc = 0
        _n_raw = 0
        _sample_cc: list[dict] = []
        for _f in _feats:
            _p = (_f or {}).get("properties") or {}
            if _p.get("cluster") is True:
                _n_cluster += 1
                _c = int(_p.get("cluster_count") or 0)
                _sum_cc += _c
                if len(_sample_cc) < 5:
                    _sample_cc.append(
                        {
                            "key": _p.get("cluster_key"),
                            "count": _c,
                        }
                    )
            else:
                _n_raw += 1
        _payload = _json.dumps(
            {
                "sessionId": "4fe799",
                "runId": "perf-opt",
                "hypothesisId": "H-opt-viewport-wall",
                "location": "green_asset_ctrl.get_green_assets_viewport",
                "message": "assets_viewport_out",
                "data": {
                    "zoom": zoom,
                    "bbox": parts,
                    "filter_keys": sorted(filters.keys()),
                    "filters": {k: str(v)[:80] for k, v in filters.items()},
                    "area_filter_keys": sorted(area_filters.keys()),
                    "area_filters": {
                        k: str(v)[:80] for k, v in area_filters.items()
                    },
                    "n_features": len(_feats),
                    "n_cluster": _n_cluster,
                    "n_raw": _n_raw,
                    "sum_cluster_count": _sum_cc,
                    "sample_clusters": _sample_cc,
                    "ms_wall": _ms_wall,
                    "baseline_cold_filtered_ms": 14259,
                    "kind": (
                        "clusters"
                        if _n_cluster and not _n_raw
                        else (
                            "raw"
                            if _n_raw and not _n_cluster
                            else (
                                "mixed"
                                if _n_cluster or _n_raw
                                else "empty"
                            )
                        )
                    ),
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
    over_headers = (
        {"X-Cadastre-Cluster-Over-Cap": "1"} if is_cluster_over_cap() else None
    )
    if not result.get("features"):
        return _empty_response(output_format, headers=over_headers)
    if output_format == "geobuf":
        _payload = geobuf.encode(result)
        return Response(
            content=_payload,
            media_type=GEOBUF_MEDIA_TYPE,
            headers=over_headers,
        )
    if over_headers:
        return Response(
            content=GreenAssetsOutput.model_validate(result).model_dump_json(),
            media_type="application/json",
            headers=over_headers,
        )
    return GreenAssetsOutput.model_validate(result)

@router.get("/green-assets/table", response_model=GreenTablePageOut)
def get_green_assets_table(
    request: Request,
    region_id: int | None = None,
    province_id: int | None = None,
    municipality_id: int | None = None,
    green_area_id: int | None = None,
    sub_municipal_area_id: int | None = None,
    clip_wkt: str | None = Query(None, description="EPSG:4326 POLYGON/MULTIPOLYGON WKT clip"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    sort_by: str | None = None,
    sort_dir: Literal["asc", "desc"] = "asc",
    date_from: date = _DATE_FROM,
    date_to: date = _DATE_TO,
) -> GreenTablePageOut:
    """Paginated, filtered and sorted green-assets table (no geometry).

    Uses ``ASSET_FILTER_KEYS`` via ``collect_filters`` (same as viewport) so range
    ends like ``survey_date_from``/``to`` and ``*_min``/``*_max`` are not dropped.
    """
    filters = collect_filters(request.query_params, ASSET_FILTER_KEYS)
    # National (unscoped) table is allowed: lakehouse resolves all ingest prefixes
    # in the date window and DuckDB paginates. Concurrent viewport+table can be
    # heavy at full Italy scale — callers use small page_size from the FE.
    # #region agent log
    try:
        import json as _json
        import time as _time
        import urllib.request as _urlreq

        _payload = _json.dumps(
            {
                "sessionId": "4fe799",
                "runId": "asset-cluster-count",
                "hypothesisId": "H-table",
                "location": "green_asset_ctrl.get_green_assets_table",
                "message": "assets_table_in",
                "data": {
                    "filter_keys": sorted(filters.keys()),
                    "filters": {k: str(v)[:80] for k, v in filters.items()},
                    "page": page,
                    "page_size": page_size,
                    "region_id": region_id,
                    "province_id": province_id,
                    "municipality_id": municipality_id,
                    "has_clip": bool(clip_wkt),
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
    import time as _time_tbl

    _t_tbl = _time_tbl.monotonic()
    _page = _uc(date_from, date_to).list_green_assets_table_paged(
        region_id,
        municipality_id,
        province_id=province_id,
        green_area_id=green_area_id,
        sub_municipal_area_id=sub_municipal_area_id,
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

        _payload = _json.dumps(
            {
                "sessionId": "4fe799",
                "runId": "perf",
                "hypothesisId": "H-perf-table",
                "location": "green_asset_ctrl.get_green_assets_table",
                "message": "assets_table_out",
                "data": {
                    "filter_keys": sorted(filters.keys()),
                    "filters": {k: str(v)[:80] for k, v in filters.items()},
                    "total": getattr(_page, "total", None),
                    "nrows": len(getattr(_page, "data", None) or []),
                    "page": page,
                    "page_size": page_size,
                    "ms_wall": _ms_tbl,
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
    return _page

# After static paths (viewport/table): otherwise {asset_id} steals those segments → 422.
@router.get("/green-assets/{asset_id}", response_model=GreenDetailOut)
def get_green_asset_detail(
    asset_id: int,
    region_id: int = Query(..., description="Partition key region_id"),
    province_id: int = Query(..., description="Partition key province_id"),
    municipality_id: int | None = Query(
        None, description="Optional municipality prune for lakehouse read"
    ),
    date_from: date = _DATE_FROM,
    date_to: date = _DATE_TO,
) -> GreenDetailOut:
    """Curated detail for map popover (summary + metadata subset)."""
    return _uc(date_from, date_to).get_green_asset_detail(
        asset_id,
        region_id=region_id,
        province_id=province_id,
        municipality_id=municipality_id,
    )
