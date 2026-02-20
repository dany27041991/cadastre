"""Output DTO for GET /green-assets (GeoJSON FeatureCollection)."""

from pydantic import BaseModel

from .green_asset_feature_output import GreenAssetFeatureOutput


class GreenAssetsOutput(BaseModel):
    type: str = "FeatureCollection"
    features: list[GreenAssetFeatureOutput] = []
