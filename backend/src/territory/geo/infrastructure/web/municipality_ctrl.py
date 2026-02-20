"""HTTP controller: municipalities by province (GeoJSON catalog)."""

from fastapi import APIRouter, HTTPException

from core.api.dependencies import get_municipalities_uc
from territory.geo.infrastructure.dto.output import GeoFeatureCollectionOutput

router = APIRouter(tags=["territory-geo-municipalities"])


@router.get("/provinces/{province_id}/municipalities", response_model=GeoFeatureCollectionOutput)
def get_municipalities_by_province(province_id: int) -> GeoFeatureCollectionOutput:
    """Return municipalities of a province with geometries."""
    result = get_municipalities_uc().catalog_municipalities_by_province(province_id)
    if not result.get("features"):
        raise HTTPException(status_code=404, detail="No municipalities found")
    return GeoFeatureCollectionOutput.model_validate(result)
