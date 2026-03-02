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
    parent_id: int | None = None,
    province_id: int | None = None,
    municipality_id: int | None = None,
    sub_municipal_area_id: int | None = None,
    format: str | None = None,
) -> GreenAreasOutput | Response:
    """
    Return green areas (N-level hierarchy).
    - With parent_id: children of that area.
    - Without parent_id: root areas for municipality_id (opt. sub_municipal_area_id).
    region_id required (partitioning). province_id recommended for hierarchical cache.
    Use ?format=geobuf for compact binary response (6-8x smaller, faster transfer).
    """
    if parent_id is None and municipality_id is None:
        if format == "geobuf":
            return Response(
                content=geobuf.encode({"type": "FeatureCollection", "features": []}),
                media_type=GEOBUF_MEDIA_TYPE,
            )
        return GreenAreasOutput(features=[])
    result = get_green_areas_uc().catalog_green_areas(
        region_id,
        parent_id=parent_id,
        province_id=province_id,
        municipality_id=municipality_id,
        sub_municipal_area_id=sub_municipal_area_id,
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
