"""HTTP controller: sub-municipal areas by municipality (GeoJSON catalog)."""

import geobuf

from fastapi import APIRouter
from fastapi.responses import Response

from core.api.dependencies import get_sub_municipal_areas_uc
from territory.geo.infrastructure.dto.output import GeoFeatureCollectionOutput

router = APIRouter(tags=["territory-geo-sub-municipal-areas"])
GEOBUF_MEDIA_TYPE = "application/x-geobuf"


@router.get(
    "/municipalities/{municipality_id}/sub-municipal-areas",
    response_model=None,
)
def get_sub_municipal_areas_by_municipality(
    municipality_id: int, format: str | None = None
) -> GeoFeatureCollectionOutput | Response:
    """Return sub-municipal areas of a municipality. Use ?format=geobuf for compact binary."""
    result = get_sub_municipal_areas_uc().catalog_sub_municipal_areas_by_municipality(
        municipality_id
    )
    if not result.get("features"):
        if format == "geobuf":
            return Response(
                content=geobuf.encode({"type": "FeatureCollection", "features": []}),
                media_type=GEOBUF_MEDIA_TYPE,
            )
        return GeoFeatureCollectionOutput(features=[])
    if format == "geobuf":
        return Response(
            content=geobuf.encode(result),
            media_type=GEOBUF_MEDIA_TYPE,
        )
    return GeoFeatureCollectionOutput.model_validate(result)
