"""Green areas HTTP routes."""

import geobuf

from fastapi import APIRouter
from fastapi.responses import Response

from core.api.dependencies import get_green_areas_uc
from territory.areas.infrastructure.dto.output import GreenAreasOutput

router = APIRouter(tags=["territory-areas"])

GEOBUF_MEDIA_TYPE = "application/x-geobuf"


@router.get("/green-areas", response_model=None)
def get_green_areas(
    region_id: int,
    province_id: int,
    parent_id: int | None = None,
    municipality_id: int | None = None,
    sub_municipal_area_id: int | None = None,
    contained_in_area_id: int | None = None,
    format: str | None = None,
) -> GreenAreasOutput | Response:
    """
    Return green areas (N-level hierarchy).
    - With contained_in_area_id: areas contained in or intersecting that area's geometry (spatial expansion).
    - With parent_id: children of that area (by parent_id).
    - Without: root areas for municipality_id (optionally filtered by sub_municipal_area_id).
    region_id and province_id required. Use ?format=geobuf for compact binary response.
    """
    if parent_id is None and municipality_id is None and contained_in_area_id is None:
        if format == "geobuf":
            return Response(
                content=geobuf.encode({"type": "FeatureCollection", "features": []}),
                media_type=GEOBUF_MEDIA_TYPE,
            )
        return GreenAreasOutput(features=[])
    result = get_green_areas_uc().catalog_green_areas(
        region_id,
        province_id=province_id,
        parent_id=parent_id,
        municipality_id=municipality_id,
        sub_municipal_area_id=sub_municipal_area_id,
        contained_in_area_id=contained_in_area_id,
    )
    if not result.get("features"):
        if format == "geobuf":
            return Response(
                content=geobuf.encode({"type": "FeatureCollection", "features": []}),
                media_type=GEOBUF_MEDIA_TYPE,
            )
        return GreenAreasOutput(features=[])
    if format == "geobuf":
        return Response(
            content=geobuf.encode(result),
            media_type=GEOBUF_MEDIA_TYPE,
        )
    return GreenAreasOutput.model_validate(result)
