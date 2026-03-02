"""HTTP controller: provinces by region (GeoJSON catalog)."""

import geobuf

from fastapi import APIRouter
from fastapi.responses import Response

from core.api.dependencies import get_provinces_uc
from core.exceptions import NotFoundError
from territory.geo.infrastructure.dto.output import GeoFeatureCollectionOutput

router = APIRouter(tags=["territory-geo-provinces"])
GEOBUF_MEDIA_TYPE = "application/x-geobuf"


@router.get("/regions/{region_id}/provinces", response_model=None)
def get_provinces_by_region(
    region_id: int, format: str | None = None
) -> GeoFeatureCollectionOutput | Response:
    """Return provinces of a region with geometries. Use ?format=geobuf for compact binary."""
    result = get_provinces_uc().catalog_provinces_by_region(region_id)
    if not result.get("features"):
        if format == "geobuf":
            return Response(
                content=geobuf.encode({"type": "FeatureCollection", "features": []}),
                media_type=GEOBUF_MEDIA_TYPE,
            )
        raise NotFoundError("errors.no_provinces_found")
    if format == "geobuf":
        return Response(
            content=geobuf.encode(result),
            media_type=GEOBUF_MEDIA_TYPE,
        )
    return GeoFeatureCollectionOutput.model_validate(result)
