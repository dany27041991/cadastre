"""Green assets HTTP routes."""

from __future__ import annotations

from typing import Literal

import geobuf

from fastapi import APIRouter, Query
from fastapi.responses import Response

from core.api.dependencies import get_green_assets_uc
from territory.assets.infrastructure.dto.output import GreenAssetsOutput
from territory.common.infrastructure.green_table_page_out import GreenTablePageOut

router = APIRouter(tags=["territory-assets"])

GEOBUF_MEDIA_TYPE = "application/x-geobuf"

_EMPTY_GEOBUF = geobuf.encode({"type": "FeatureCollection", "features": []})


def _empty_response(output_format: str | None) -> GreenAssetsOutput | Response:
    if output_format == "geobuf":
        return Response(content=_EMPTY_GEOBUF, media_type=GEOBUF_MEDIA_TYPE)
    return GreenAssetsOutput(features=[])


@router.get("/green-assets", response_model=None)
def get_green_assets(
    region_id: int,
    province_id: int,
    municipality_id: int,
    green_area_id: int | None = None,
    sub_municipal_area_id: int | None = None,
    # Renamed from `format` to avoid shadowing the Python built-in.
    output_format: str | None = Query(None, alias="format"),
) -> GreenAssetsOutput | Response:
    """Return green assets (trees, rows, lawns, etc.) for the given area.
    When sub_municipal_area_id is set, only assets intersecting that sub-municipal area are returned.
    region_id and province_id required. Use ?format=geobuf for compact binary response."""
    result = get_green_assets_uc().catalog_green_assets(
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



@router.get("/green-assets/table", response_model=GreenTablePageOut)
def get_green_assets_table(
    region_id: int,
    province_id: int,
    municipality_id: int,
    green_area_id: int | None = None,
    sub_municipal_area_id: int | None = None,
    # Pagination
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    # Sorting
    sort_by: str | None = None,
    sort_dir: Literal["asc", "desc"] = "asc",
    # Generic free-text search (species / family / genus / variety)
    q: str | None = None,
    # Exact-match column filters
    asset_type: str | None = None,
    geometry_type: str | None = None,
    health_status: str | None = None,
    stability_status: str | None = None,
    structural_defect: str | None = None,
    risk_level: str | None = None,
    maintenance_priority: str | None = None,
    intervention_type: str | None = None,
    growth_stage: str | None = None,
    origin: str | None = None,
    protection_status: str | None = None,
    asset_status: str | None = None,
    monitoring_required: str | None = None,
    priority_level_evaluation: str | None = None,
    managing_entity: str | None = None,
    # ILIKE column filters
    species: str | None = None,
    family: str | None = None,
    genus: str | None = None,
    variety: str | None = None,
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
        }.items()
        if v is not None
    }
    return get_green_assets_uc().list_green_assets_table_paged(
        region_id,
        municipality_id,
        province_id=province_id,
        green_area_id=green_area_id,
        sub_municipal_area_id=sub_municipal_area_id,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_dir=sort_dir,
        filters=filters,
    )
