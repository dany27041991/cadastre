"""HTTP controller: regions (GeoJSON catalog)."""

from fastapi import APIRouter

from core.api.dependencies import get_regions_uc
from territory.geo.infrastructure.dto.output import GeoFeatureCollectionOutput

router = APIRouter(tags=["territory-geo-regions"])


@router.get("/regions", response_model=GeoFeatureCollectionOutput)
def get_regions() -> GeoFeatureCollectionOutput:
    """Return all regions with geometries as GeoJSON."""
    result = get_regions_uc().catalog_regions()
    if not result.get("features"):
        return GeoFeatureCollectionOutput(features=[])
    return GeoFeatureCollectionOutput.model_validate(result)
