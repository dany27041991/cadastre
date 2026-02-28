"""Output DTO for GeoJSON FeatureCollection (regions, provinces, municipalities, sub-municipal areas)."""

from pydantic import BaseModel

from .geo_feature_output import GeoFeatureOutput


class GeoFeatureCollectionOutput(BaseModel):
    type: str = "FeatureCollection"
    features: list[GeoFeatureOutput] = []
