"""Output DTO for a single GeoJSON Feature (region, province, municipality, district)."""

from typing import Any

from pydantic import BaseModel


class GeoFeatureOutput(BaseModel):
    type: str = "Feature"
    id: int
    properties: dict[str, Any]
    geometry: dict[str, Any]
