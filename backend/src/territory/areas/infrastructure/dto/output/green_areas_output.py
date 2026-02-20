"""Output DTO for GET /green-areas (GeoJSON FeatureCollection)."""

from pydantic import BaseModel

from .green_area_feature_output import GreenAreaFeatureOutput


class GreenAreasOutput(BaseModel):
    type: str = "FeatureCollection"
    features: list[GreenAreaFeatureOutput] = []
