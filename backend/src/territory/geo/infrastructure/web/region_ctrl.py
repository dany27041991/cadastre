"""HTTP controller: regions (GeoJSON catalog)."""

import geobuf

from fastapi import APIRouter
from fastapi.responses import Response

from core.api.dependencies import get_regions_uc
from territory.geo.infrastructure.dto.output import GeoFeatureCollectionOutput

router = APIRouter(tags=["territory-geo-regions"])
GEOBUF_MEDIA_TYPE = "application/x-geobuf"


@router.get("/regions", response_model=None)
def get_regions(format: str | None = None) -> GeoFeatureCollectionOutput | Response:
    """Return all regions with geometries. Use ?format=geobuf for compact binary (6-8x smaller)."""
    result = get_regions_uc().catalog_regions()
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
