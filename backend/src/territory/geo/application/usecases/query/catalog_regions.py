"""Use case: catalog regions with geometries."""

from cachetools import cached

from core.cache import CompressedTTLCache
from core.config import settings
from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.geo.infrastructure.repository.region_repository import RegionRepository

_region_cache = CompressedTTLCache(maxsize=1, ttl=settings.admin_areas_cache_ttl_seconds)


@cached(cache=_region_cache)
def _cached_regions() -> GeoJSONFeatureCollection:
    from territory.geo.infrastructure.repository import _region_repository
    return _region_repository().get_regions()


def invalidate_cache() -> None:
    """Clear the regions cache (e.g. after data changes)."""
    _region_cache.clear()


class CatalogRegion:
    def __init__(self, repository: RegionRepository) -> None:
        self._repository = repository

    def catalog_regions(self) -> GeoJSONFeatureCollection:
        return _cached_regions()
