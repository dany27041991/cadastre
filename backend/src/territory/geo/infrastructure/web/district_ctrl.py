"""HTTP controller: districts by municipality (GeoJSON catalog)."""

from fastapi import APIRouter

from core.api.dependencies import get_districts_uc
from territory.geo.infrastructure.dto.output import GeoFeatureCollectionOutput

router = APIRouter(tags=["territory-geo-districts"])


@router.get("/municipalities/{municipality_id}/districts", response_model=GeoFeatureCollectionOutput)
def get_districts_by_municipality(municipality_id: int) -> GeoFeatureCollectionOutput:
    """Return districts of a municipality. 200 with empty features if none."""
    result = get_districts_uc().catalog_districts_by_municipality(municipality_id)
    if not result.get("features"):
        return GeoFeatureCollectionOutput(features=[])
    return GeoFeatureCollectionOutput.model_validate(result)
