"""Cache logic for catalog provinces by region."""

from cachetools import cached

from core.cache import CompressedTTLCache
from core.config import settings
from territory.geo.domain.entities import GeoJSONFeatureCollection

_province_cache = CompressedTTLCache(
    maxsize=64, ttl=settings.admin_areas_cache_ttl_seconds
)


@cached(cache=_province_cache)
def get_cached_provinces(region_id: int) -> GeoJSONFeatureCollection:
    """Return provinces for region (from cache when applicable)."""
    from territory.geo.infrastructure.repository import _province_repository

    return _province_repository().get_provinces_by_region(region_id)


def invalidate_cache() -> None:
    """Clear the provinces cache (e.g. after data changes)."""
    _province_cache.clear()
