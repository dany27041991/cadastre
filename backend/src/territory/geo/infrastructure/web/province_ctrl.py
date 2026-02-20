"""HTTP controller: provinces by region (GeoJSON catalog)."""

from fastapi import APIRouter, HTTPException

from core.api.dependencies import get_provinces_uc
from territory.geo.infrastructure.dto.output import GeoFeatureCollectionOutput

router = APIRouter(tags=["territory-geo-provinces"])


@router.get("/regions/{region_id}/provinces", response_model=GeoFeatureCollectionOutput)
def get_provinces_by_region(region_id: int) -> GeoFeatureCollectionOutput:
    """Return provinces of a region with geometries."""
    result = get_provinces_uc().catalog_provinces_by_region(region_id)
    if not result.get("features"):
        raise HTTPException(status_code=404, detail="No provinces found")
    return GeoFeatureCollectionOutput.model_validate(result)
