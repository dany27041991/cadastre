"""Green assets HTTP routes."""

from __future__ import annotations

from typing import Literal

import geobuf

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from core.api.dependencies import get_green_assets_uc
from territory.assets.infrastructure.dto.output import GreenAssetsOutput
from territory.common.infrastructure.dto.green_detail_out import GreenDetailOut
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


@router.get("/green-assets/viewport", response_model=None)
def get_green_assets_viewport(
    bbox: str = Query(..., description="minLon,minLat,maxLon,maxLat (EPSG:4326)"),
    zoom: float = Query(..., ge=0, le=22),
    region_id: int | None = None,
    province_id: int | None = None,
    municipality_id: int | None = None,
    sub_municipal_area_id: int | None = None,
    green_area_id: int | None = None,
    output_format: str | None = Query(None, alias="format"),
) -> GreenAssetsOutput | Response:
    """Viewport-sized green assets for map rendering at national scale.

    Returns raw assets at the vendor's last zoom level, PostGIS clusters otherwise.
    Cluster features carry cluster_count / cluster_key / cluster_bbox properties.
    Territory filters are optional: omit them for a nationwide view."""
    try:
        parts = [float(p) for p in bbox.split(",")]
    except ValueError:
        parts = []
    if len(parts) != 4:
        raise HTTPException(status_code=422, detail="bbox must be minLon,minLat,maxLon,maxLat")
    result = get_green_assets_uc().viewport_green_assets(
        (parts[0], parts[1], parts[2], parts[3]),
        zoom,
        region_id=region_id,
        province_id=province_id,
        municipality_id=municipality_id,
        sub_municipal_area_id=sub_municipal_area_id,
        green_area_id=green_area_id,
    )
    if not result.get("features"):
        return _empty_response(output_format)
    if output_format == "geobuf":
        return Response(content=geobuf.encode(result), media_type=GEOBUF_MEDIA_TYPE)
    return GreenAssetsOutput.model_validate(result)


@router.get("/green-assets/table", response_model=GreenTablePageOut)
def get_green_assets_table(
    region_id: int | None = None,
    province_id: int | None = None,
    municipality_id: int | None = None,
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


# After static paths (viewport/table): otherwise {asset_id} steals those segments → 422.
@router.get("/green-assets/{asset_id}", response_model=GreenDetailOut)
def get_green_asset_detail(
    asset_id: int,
    region_id: int = Query(..., description="Partition key region_id"),
    province_id: int = Query(..., description="Partition key province_id"),
) -> GreenDetailOut:
    """Curated detail for map popover (summary + metadata subset)."""
    return get_green_assets_uc().get_green_asset_detail(
        asset_id,
        region_id=region_id,
        province_id=province_id,
    )
