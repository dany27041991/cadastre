"""Application container: aggregates module repository wiring for the API layer."""

from territory.geo.infrastructure.repository import (
    get_regions_use_case,
    get_provinces_by_region_use_case,
    get_municipalities_by_province_use_case,
    get_sub_municipal_areas_by_municipality_use_case,
)
from territory.areas.infrastructure.repository import get_green_areas_use_case
from territory.assets.infrastructure.repository import get_green_assets_use_case

__all__ = [
    "get_regions_use_case",
    "get_provinces_by_region_use_case",
    "get_municipalities_by_province_use_case",
    "get_sub_municipal_areas_by_municipality_use_case",
    "get_green_areas_use_case",
    "get_green_assets_use_case",
]
