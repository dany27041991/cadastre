"""Use case factories for territory route handlers. Uses core.api.container for wiring."""

from core.api.container import (
    get_regions_use_case,
    get_provinces_by_region_use_case,
    get_municipalities_by_province_use_case,
    get_sub_municipal_areas_by_municipality_use_case,
    get_green_areas_use_case,
    get_green_assets_use_case,
)

get_regions_uc = get_regions_use_case
get_provinces_uc = get_provinces_by_region_use_case
get_municipalities_uc = get_municipalities_by_province_use_case
get_sub_municipal_areas_uc = get_sub_municipal_areas_by_municipality_use_case
get_green_areas_uc = get_green_areas_use_case
get_green_assets_uc = get_green_assets_use_case
