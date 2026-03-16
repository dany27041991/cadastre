"""Cache logic for catalog sub-municipal areas by municipality."""

from cachetools import cached

from core.cache import CompressedTTLCache
from core.config import settings
from territory.geo.domain.entities import GeoJSONFeatureCollection

_sub_municipal_area_cache = CompressedTTLCache(
    maxsize=256, ttl=settings.admin_areas_cache_ttl_seconds
)


@cached(cache=_sub_municipal_area_cache)
def get_cached_sub_municipal_areas(
    municipality_id: int,
) -> GeoJSONFeatureCollection:
    """Return sub-municipal areas for municipality (from cache when applicable)."""
    from territory.geo.infrastructure.repository import (
        _sub_municipal_area_repository,
    )

    return _sub_municipal_area_repository().get_sub_municipal_areas_by_municipality(
        municipality_id
    )


def invalidate_cache() -> None:
    """Clear the sub-municipal areas cache (e.g. after data changes)."""
    _sub_municipal_area_cache.clear()
