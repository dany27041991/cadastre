"""Core API: use case factories for route handlers."""

from core.api.dependencies import (
    get_regions_use_case,
    get_provinces_by_region_use_case,
    get_municipalities_by_province_use_case,
    get_districts_by_municipality_use_case,
    get_green_areas_use_case,
    get_green_assets_use_case,
    get_regions_uc,
    get_provinces_uc,
    get_municipalities_uc,
    get_districts_uc,
    get_green_areas_uc,
    get_green_assets_uc,
)

__all__ = [
    "get_regions_use_case",
    "get_provinces_by_region_use_case",
    "get_municipalities_by_province_use_case",
    "get_districts_by_municipality_use_case",
    "get_green_areas_use_case",
    "get_green_assets_use_case",
    "get_regions_uc",
    "get_provinces_uc",
    "get_municipalities_uc",
    "get_districts_uc",
    "get_green_areas_uc",
    "get_green_assets_uc",
]
