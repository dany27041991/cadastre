"""Use case: catalog sub-municipal areas of a municipality."""

from core.logger import log_invocation
from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.geo.infrastructure.repository.sub_municipal_area_repository import (
    SubMunicipalAreaRepository,
)
from territory.geo.application.usecases.query.cache.catalog_sub_municipal_areas_by_municipality_cache import (
    get_cached_sub_municipal_areas,
    invalidate_cache,
)

__all__ = ["CatalogSubMunicipalAreasByMunicipality", "invalidate_cache"]


class CatalogSubMunicipalAreasByMunicipality:
    def __init__(self, repository: SubMunicipalAreaRepository) -> None:
        self._repository = repository

    @log_invocation(log_args=True, log_result=False)
    def catalog_sub_municipal_areas_by_municipality(
        self, municipality_id: int
    ) -> GeoJSONFeatureCollection:
        return get_cached_sub_municipal_areas(municipality_id)
