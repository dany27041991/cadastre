"""Use case: catalog sub-municipal areas of a municipality."""

from cachetools import cached

from core.cache import CompressedTTLCache
from core.config import settings
from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.geo.infrastructure.repository.sub_municipal_area_repository import (
    SubMunicipalAreaRepository,
)

_sub_municipal_area_cache = CompressedTTLCache(maxsize=256, ttl=settings.admin_areas_cache_ttl_seconds)


@cached(cache=_sub_municipal_area_cache)
def _cached_sub_municipal_areas(municipality_id: int) -> GeoJSONFeatureCollection:
    from territory.geo.infrastructure.repository import _sub_municipal_area_repository
    return _sub_municipal_area_repository().get_sub_municipal_areas_by_municipality(
        municipality_id
    )


def invalidate_cache() -> None:
    """Clear the sub-municipal areas cache (e.g. after data changes)."""
    _sub_municipal_area_cache.clear()


class CatalogSubMunicipalAreasByMunicipality:
    def __init__(self, repository: SubMunicipalAreaRepository) -> None:
        self._repository = repository

    def catalog_sub_municipal_areas_by_municipality(
        self, municipality_id: int
    ) -> GeoJSONFeatureCollection:
        return _cached_sub_municipal_areas(municipality_id)
