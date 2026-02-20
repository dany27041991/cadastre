"""Use case: catalog districts of a municipality."""

from functools import lru_cache

from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.geo.infrastructure.repository.district_repository import DistrictRepository


@lru_cache(maxsize=256)
def _cached_districts(municipality_id: int) -> GeoJSONFeatureCollection:
    from territory.geo.infrastructure.repository import _district_repository
    return _district_repository().get_districts_by_municipality(municipality_id)


class CatalogDistrictByMunicipality:
    def __init__(self, repository: DistrictRepository) -> None:
        self._repository = repository

    def catalog_districts_by_municipality(self, municipality_id: int) -> GeoJSONFeatureCollection:
        return _cached_districts(municipality_id)
