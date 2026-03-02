"""Use case: catalog municipalities of a province."""

from cachetools import cached

from core.cache import CompressedTTLCache
from core.config import settings
from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.geo.infrastructure.repository.municipality_repository import MunicipalityRepository

_municipality_cache = CompressedTTLCache(maxsize=128, ttl=settings.admin_areas_cache_ttl_seconds)


@cached(cache=_municipality_cache)
def _cached_municipalities(province_id: int) -> GeoJSONFeatureCollection:
    from territory.geo.infrastructure.repository import _municipality_repository
    return _municipality_repository().get_municipalities_by_province(province_id)


def invalidate_cache() -> None:
    """Clear the municipalities cache (e.g. after data changes)."""
    _municipality_cache.clear()


class CatalogMunicipalityByProvince:
    def __init__(self, repository: MunicipalityRepository) -> None:
        self._repository = repository

    def catalog_municipalities_by_province(self, province_id: int) -> GeoJSONFeatureCollection:
        return _cached_municipalities(province_id)
