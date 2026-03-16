"""Cache layer for geo query use cases."""

from territory.geo.application.usecases.query.cache.catalog_municipalities_by_province_cache import (
    get_cached_municipalities,
    invalidate_cache as invalidate_municipalities_cache,
)
from territory.geo.application.usecases.query.cache.catalog_provinces_by_region_cache import (
    get_cached_provinces,
    invalidate_cache as invalidate_provinces_cache,
)
from territory.geo.application.usecases.query.cache.catalog_regions_cache import (
    get_cached_regions,
    invalidate_cache as invalidate_regions_cache,
)
from territory.geo.application.usecases.query.cache.catalog_sub_municipal_areas_by_municipality_cache import (
    get_cached_sub_municipal_areas,
    invalidate_cache as invalidate_sub_municipal_areas_cache,
)

__all__ = [
    "get_cached_regions",
    "invalidate_regions_cache",
    "get_cached_provinces",
    "invalidate_provinces_cache",
    "get_cached_municipalities",
    "invalidate_municipalities_cache",
    "get_cached_sub_municipal_areas",
    "invalidate_sub_municipal_areas_cache",
]
