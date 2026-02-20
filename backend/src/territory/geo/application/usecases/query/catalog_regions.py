"""Use case: catalog regions with geometries."""

from functools import lru_cache

from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.geo.infrastructure.repository.region_repository import RegionRepository


@lru_cache(maxsize=1)
def _cached_regions() -> GeoJSONFeatureCollection:
    from territory.geo.infrastructure.repository import _region_repository
    return _region_repository().get_regions()


class CatalogRegion:
    def __init__(self, repository: RegionRepository) -> None:
        self._repository = repository

    def catalog_regions(self) -> GeoJSONFeatureCollection:
        return _cached_regions()
