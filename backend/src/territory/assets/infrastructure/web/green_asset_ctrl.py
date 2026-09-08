"""Green assets HTTP routes."""

from __future__ import annotations

from datetime import date
from typing import Literal

import geobuf

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from core.api.dependencies import get_green_assets_uc
from territory.assets.infrastructure.dto.output import GreenAssetsOutput
from territory.common.infrastructure.clip_wkt import ClipWktError, normalize_clip_wkt
from territory.common.infrastructure.dto.green_detail_out import GreenDetailOut
from territory.common.infrastructure.green_table_page_out import GreenTablePageOut
from territory.common.infrastructure.lakehouse.http_dates import parse_lakehouse_date_range

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
    result = _uc(date_from, date_to).viewport_green_assets(
        (parts[0], parts[1], parts[2], parts[3]),
        zoom,
        region_id=region_id,
        province_id=province_id,
        municipality_id=municipality_id,
        sub_municipal_area_id=sub_municipal_area_id,
        green_area_id=green_area_id,
        clip_wkt=_clip_wkt_or_400(clip_wkt),
    )
    over_headers = (
        {"X-Cadastre-Cluster-Over-Cap": "1"} if is_cluster_over_cap() else None
    )
    if not result.get("features"):
        return _empty_response(output_format, headers=over_headers)
    if output_format == "geobuf":
        return Response(
            content=geobuf.encode(result),
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
    region_id: int | None = None,
    province_id: int | None = None,
    municipality_id: int | None = None,
    green_area_id: int | None = None,
    sub_municipal_area_id: int | None = None,
    clip_wkt: str | None = Query(None, description="EPSG:4326 POLYGON/MULTIPOLYGON WKT clip"),
    # Pagination
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    # Sorting
    sort_by: str | None = None,
    sort_dir: Literal["asc", "desc"] = "asc",
    # Generic free-text search (species / family / genus / variety)
    q: str | None = None,
    # Exact-match column filters (non-catalog)
    asset_type: str | None = None,
    geometry_type: str | None = None,
    stability_status: str | None = None,
    structural_defect: str | None = None,
    risk_level: str | None = None,
    maintenance_priority: str | None = None,
    intervention_type: str | None = None,
    origin: str | None = None,
    asset_status: str | None = None,
    monitoring_required: str | None = None,
    priority_level_evaluation: str | None = None,
    managing_entity: str | None = None,
    # Catalog / ILIKE column filters
    species: str | None = None,
    family: str | None = None,
    genus: str | None = None,
    variety: str | None = None,
    plant_code: str | None = None,
    species_code: str | None = None,
    area_code: str | None = None,
    latitude: str | None = None,
    longitude: str | None = None,
    survey_date: str | None = None,
    trunk_diameter_cm: str | None = None,
    plant_height_m: str | None = None,
    crown_diameter_m: str | None = None,
    growth_stage: str | None = None,
    protection_status: str | None = None,
    health_status: str | None = None,
    date_from: date = _DATE_FROM,
    date_to: date = _DATE_TO,
) -> GreenTablePageOut:
    """Paginated, filtered and sorted green-assets table (no geometry)."""
    # Only pass non-None values so the repository iterates a compact dict.
    filters = {
        k: v
        for k, v in {
            "q": q,
            "asset_type": asset_type,
            "geometry_type": geometry_type,
            "health_status": health_status,
            "stability_status": stability_status,
            "structural_defect": structural_defect,
            "risk_level": risk_level,
            "maintenance_priority": maintenance_priority,
            "intervention_type": intervention_type,
            "growth_stage": growth_stage,
            "origin": origin,
            "protection_status": protection_status,
            "asset_status": asset_status,
            "monitoring_required": monitoring_required,
            "priority_level_evaluation": priority_level_evaluation,
            "managing_entity": managing_entity,
            "species": species,
            "family": family,
            "genus": genus,
            "variety": variety,
            "plant_code": plant_code,
            "species_code": species_code,
            "area_code": area_code,
            "latitude": latitude,
            "longitude": longitude,
            "survey_date": survey_date,
            "trunk_diameter_cm": trunk_diameter_cm,
            "plant_height_m": plant_height_m,
            "crown_diameter_m": crown_diameter_m,
        }.items()
        if v is not None
    }
    return _uc(date_from, date_to).list_green_assets_table_paged(
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
        filters=filters,
    )


# After static paths (viewport/table): otherwise {asset_id} steals those segments → 422.
@router.get("/green-assets/{asset_id}", response_model=GreenDetailOut)
def get_green_asset_detail(
    asset_id: int,
    region_id: int = Query(..., description="Partition key region_id"),
    province_id: int = Query(..., description="Partition key province_id"),
    date_from: date = _DATE_FROM,
    date_to: date = _DATE_TO,
) -> GreenDetailOut:
    """Curated detail for map popover (summary + metadata subset)."""
    return _uc(date_from, date_to).get_green_asset_detail(
        asset_id,
        region_id=region_id,
        province_id=province_id,
    )
