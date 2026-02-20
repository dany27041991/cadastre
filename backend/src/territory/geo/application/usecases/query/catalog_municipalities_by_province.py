"""Use case: catalog municipalities of a province."""

from functools import lru_cache

from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.geo.infrastructure.repository.municipality_repository import MunicipalityRepository


@lru_cache(maxsize=128)
def _cached_municipalities(province_id: int) -> GeoJSONFeatureCollection:
    from territory.geo.infrastructure.repository import _municipality_repository
    return _municipality_repository().get_municipalities_by_province(province_id)


class CatalogMunicipalityByProvince:
    def __init__(self, repository: MunicipalityRepository) -> None:
        self._repository = repository

    def catalog_municipalities_by_province(self, province_id: int) -> GeoJSONFeatureCollection:
        return _cached_municipalities(province_id)
