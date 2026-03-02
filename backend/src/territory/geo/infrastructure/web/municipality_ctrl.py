"""HTTP controller: municipalities by province (GeoJSON catalog)."""

import geobuf

from fastapi import APIRouter
from fastapi.responses import Response

from core.api.dependencies import get_municipalities_uc
from core.exceptions import NotFoundError
from territory.geo.infrastructure.dto.output import GeoFeatureCollectionOutput

router = APIRouter(tags=["territory-geo-municipalities"])
GEOBUF_MEDIA_TYPE = "application/x-geobuf"


@router.get("/provinces/{province_id}/municipalities", response_model=None)
def get_municipalities_by_province(
    province_id: int, format: str | None = None
) -> GeoFeatureCollectionOutput | Response:
    """Return municipalities of a province with geometries. Use ?format=geobuf for compact binary."""
    result = get_municipalities_uc().catalog_municipalities_by_province(province_id)
    if not result.get("features"):
        if format == "geobuf":
            return Response(
                content=geobuf.encode({"type": "FeatureCollection", "features": []}),
                media_type=GEOBUF_MEDIA_TYPE,
            )
        raise NotFoundError("errors.no_municipalities_found")
    if format == "geobuf":
        return Response(
            content=geobuf.encode(result),
            media_type=GEOBUF_MEDIA_TYPE,
        )
    return GeoFeatureCollectionOutput.model_validate(result)
