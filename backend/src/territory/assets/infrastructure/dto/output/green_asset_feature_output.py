"""Output DTO for a single green asset (GeoJSON Feature)."""

from typing import Any

from pydantic import BaseModel


class GreenAssetFeatureOutput(BaseModel):
    type: str = "Feature"
    id: int
    properties: dict[str, Any]
    geometry: dict[str, Any]
