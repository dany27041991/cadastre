"""Use case: catalog provinces of a region."""

from functools import lru_cache

from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.geo.infrastructure.repository.province_repository import ProvinceRepository


@lru_cache(maxsize=64)
def _cached_provinces(region_id: int) -> GeoJSONFeatureCollection:
    from territory.geo.infrastructure.repository import _province_repository
    return _province_repository().get_provinces_by_region(region_id)


class CatalogProvinceByRegion:
    def __init__(self, repository: ProvinceRepository) -> None:
        self._repository = repository

    def catalog_provinces_by_region(self, region_id: int) -> GeoJSONFeatureCollection:
        return _cached_provinces(region_id)
