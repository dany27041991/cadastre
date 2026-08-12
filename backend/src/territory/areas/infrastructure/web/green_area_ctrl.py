"""Green areas HTTP routes."""

from __future__ import annotations

from typing import Literal

import geobuf

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from core.api.dependencies import get_green_areas_uc
from territory.areas.infrastructure.dto.output import GreenAreasOutput
from territory.common.infrastructure.dto.green_detail_out import GreenDetailOut
from territory.common.infrastructure.green_table_page_out import GreenTablePageOut

router = APIRouter(tags=["territory-areas"])

GEOBUF_MEDIA_TYPE = "application/x-geobuf"

_EMPTY_GEOBUF = geobuf.encode({"type": "FeatureCollection", "features": []})


def _empty_response(output_format: str | None) -> GreenAreasOutput | Response:
    if output_format == "geobuf":
        return Response(content=_EMPTY_GEOBUF, media_type=GEOBUF_MEDIA_TYPE)
    return GreenAreasOutput(features=[])


@router.get("/green-areas", response_model=None)
def get_green_areas(
    region_id: int,
    province_id: int,
    parent_id: int | None = None,
    municipality_id: int | None = None,
    sub_municipal_area_id: int | None = None,
    contained_in_area_id: int | None = None,
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
    """
    if parent_id is None and municipality_id is None and contained_in_area_id is None:
        return _empty_response(output_format)

    result = get_green_areas_uc().catalog_green_areas(
        region_id,
        province_id=province_id,
        parent_id=parent_id,
        municipality_id=municipality_id,
        sub_municipal_area_id=sub_municipal_area_id,
        contained_in_area_id=contained_in_area_id,
    )

    if not result.get("features"):
        return _empty_response(output_format)

    if output_format == "geobuf":
        return Response(content=geobuf.encode(result), media_type=GEOBUF_MEDIA_TYPE)
    return GreenAreasOutput.model_validate(result)


@router.get("/green-areas/viewport", response_model=None)
def get_green_areas_viewport(
    bbox: str = Query(..., description="minLon,minLat,maxLon,maxLat (EPSG:4326)"),
    zoom: float = Query(..., ge=0, le=22),
    region_id: int | None = None,
    province_id: int | None = None,
    municipality_id: int | None = None,
    sub_municipal_area_id: int | None = None,
    output_format: str | None = Query(None, alias="format"),
) -> GreenAreasOutput | Response:
    """Viewport-sized root green areas for map rendering.

    Empty below the areas min zoom; otherwise polygons intersecting the bbox,
    simplified to display resolution and capped (largest areas first).
    Territory filters are optional: omit them for a nationwide view."""
    try:
        parts = [float(p) for p in bbox.split(",")]
    except ValueError:
        parts = []
    if len(parts) != 4:
        raise HTTPException(status_code=422, detail="bbox must be minLon,minLat,maxLon,maxLat")
    result = get_green_areas_uc().viewport_green_areas(
        (parts[0], parts[1], parts[2], parts[3]),
        zoom,
        region_id=region_id,
        province_id=province_id,
        municipality_id=municipality_id,
        sub_municipal_area_id=sub_municipal_area_id,
    )
    if not result.get("features"):
        return _empty_response(output_format)
    if output_format == "geobuf":
        return Response(content=geobuf.encode(result), media_type=GEOBUF_MEDIA_TYPE)
    return GreenAreasOutput.model_validate(result)


@router.get("/green-areas/table", response_model=GreenTablePageOut)
def get_green_areas_table(
    region_id: int | None = None,
    province_id: int | None = None,
    municipality_id: int | None = None,
    sub_municipal_area_id: int | None = None,
    contained_in_area_id: int | None = None,
    parent_id: int | None = None,
    # Pagination
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    # Sorting
    sort_by: str | None = None,
    sort_dir: Literal["asc", "desc"] = "asc",
    # Generic free-text (name)
    q: str | None = None,
    # Exact-match column filters
    geometry_type: str | None = None,
    perimeter_type: str | None = None,
    administrative_status: str | None = None,
    operational_status: str | None = None,
    survey_status: str | None = None,
    intensity_of_fruition: str | None = None,
    level: int | None = None,
    # ILIKE column filters
    name: str | None = None,
    zril_identifier: str | None = None,
) -> GreenTablePageOut:
    """Paginated, filtered and sorted green-areas table (no geometry)."""
    # Only pass non-None values so the repository iterates a compact dict.
    filters = {
        k: v
        for k, v in {
            "q": q,
            "geometry_type": geometry_type,
            "perimeter_type": perimeter_type,
            "administrative_status": administrative_status,
            "operational_status": operational_status,
            "survey_status": survey_status,
            "intensity_of_fruition": intensity_of_fruition,
            "level": level,
            "name": name,
            "zril_identifier": zril_identifier,
        }.items()
        if v is not None
    }
    return get_green_areas_uc().list_green_areas_table_paged(
        region_id,
        province_id,
        municipality_id,
        sub_municipal_area_id=sub_municipal_area_id,
        contained_in_area_id=contained_in_area_id,
        parent_id=parent_id,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_dir=sort_dir,
        filters=filters,
    )


# After static paths (viewport/table): otherwise {area_id} steals those segments → 422.
@router.get("/green-areas/{area_id}", response_model=GreenDetailOut)
def get_green_area_detail(
    area_id: int,
    region_id: int = Query(..., description="Partition key region_id"),
    province_id: int = Query(..., description="Partition key province_id"),
) -> GreenDetailOut:
    """Curated detail for map popover (summary + metadata subset)."""
    return get_green_areas_uc().get_green_area_detail(
        area_id,
        region_id=region_id,
        province_id=province_id,
    )
