"""Cache logic for catalog regions."""

from cachetools import cached

from core.cache import CompressedTTLCache
from core.config import settings
from territory.geo.domain.entities import GeoJSONFeatureCollection

_region_cache = CompressedTTLCache(
    maxsize=1, ttl=settings.admin_areas_cache_ttl_seconds
)


@cached(cache=_region_cache)
def get_cached_regions() -> GeoJSONFeatureCollection:
    """Return regions (from cache when applicable)."""
    from territory.geo.infrastructure.repository import _region_repository

    return _region_repository().get_regions()


def invalidate_cache() -> None:
    """Clear the regions cache (e.g. after data changes)."""
    _region_cache.clear()
