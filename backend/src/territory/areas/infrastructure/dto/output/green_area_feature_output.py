"""Output DTO for a single green area (GeoJSON Feature)."""

from typing import Any

from pydantic import BaseModel


class GreenAreaFeatureOutput(BaseModel):
    type: str = "Feature"
    id: int
    properties: dict[str, Any]
    geometry: dict[str, Any]
