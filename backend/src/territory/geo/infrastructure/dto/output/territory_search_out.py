"""Output DTO for territory hierarchy search hits."""

from pydantic import BaseModel, Field


class TerritorySearchHitOut(BaseModel):
    value: str
    label: str
    level: str
    id: int | None = None
    region_id: int | None = None
    province_id: int | None = None
    municipality_id: int | None = None
    sub_municipal_area_id: int | None = None
    green_area_id: int | None = None


class TerritorySearchResponseOut(BaseModel):
    items: list[TerritorySearchHitOut] = Field(default_factory=list)
