"""Use case: catalog sub-municipal areas of a municipality."""

from functools import lru_cache

from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.geo.infrastructure.repository.sub_municipal_area_repository import (
    SubMunicipalAreaRepository,
)


@lru_cache(maxsize=256)
def _cached_sub_municipal_areas(municipality_id: int) -> GeoJSONFeatureCollection:
    from territory.geo.infrastructure.repository import _sub_municipal_area_repository
    return _sub_municipal_area_repository().get_sub_municipal_areas_by_municipality(
        municipality_id
    )


class CatalogSubMunicipalAreasByMunicipality:
    def __init__(self, repository: SubMunicipalAreaRepository) -> None:
        self._repository = repository

    def catalog_sub_municipal_areas_by_municipality(
        self, municipality_id: int
    ) -> GeoJSONFeatureCollection:
        return _cached_sub_municipal_areas(municipality_id)
