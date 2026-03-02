"""Use case: catalog provinces of a region."""

from cachetools import cached

from core.cache import CompressedTTLCache
from core.config import settings
from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.geo.infrastructure.repository.province_repository import ProvinceRepository

_province_cache = CompressedTTLCache(maxsize=64, ttl=settings.admin_areas_cache_ttl_seconds)


@cached(cache=_province_cache)
def _cached_provinces(region_id: int) -> GeoJSONFeatureCollection:
    from territory.geo.infrastructure.repository import _province_repository
    return _province_repository().get_provinces_by_region(region_id)


def invalidate_cache() -> None:
    """Clear the provinces cache (e.g. after data changes)."""
    _province_cache.clear()


class CatalogProvinceByRegion:
    def __init__(self, repository: ProvinceRepository) -> None:
        self._repository = repository

    def catalog_provinces_by_region(self, region_id: int) -> GeoJSONFeatureCollection:
        return _cached_provinces(region_id)
