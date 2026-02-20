"""Output DTO for GeoJSON FeatureCollection (regions, provinces, municipalities, districts)."""

from pydantic import BaseModel

from .geo_feature_output import GeoFeatureOutput


class GeoFeatureCollectionOutput(BaseModel):
    type: str = "FeatureCollection"
    features: list[GeoFeatureOutput] = []
