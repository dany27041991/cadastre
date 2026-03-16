"""Cache logic for catalog municipalities by province."""

from cachetools import cached

from core.cache import CompressedTTLCache
from core.config import settings
from territory.geo.domain.entities import GeoJSONFeatureCollection

_municipality_cache = CompressedTTLCache(
    maxsize=128, ttl=settings.admin_areas_cache_ttl_seconds
)


@cached(cache=_municipality_cache)
def get_cached_municipalities(province_id: int) -> GeoJSONFeatureCollection:
    """Return municipalities for province (from cache when applicable)."""
    from territory.geo.infrastructure.repository import _municipality_repository

    return _municipality_repository().get_municipalities_by_province(province_id)


def invalidate_cache() -> None:
    """Clear the municipalities cache (e.g. after data changes)."""
    _municipality_cache.clear()
