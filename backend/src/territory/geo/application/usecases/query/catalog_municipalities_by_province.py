"""Use case: catalog municipalities of a province."""

from core.logger import log_invocation
from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.geo.infrastructure.repository.municipality_repository import (
    MunicipalityRepository,
)
from territory.geo.application.usecases.query.cache.catalog_municipalities_by_province_cache import (
    get_cached_municipalities,
    invalidate_cache,
)

__all__ = ["CatalogMunicipalityByProvince", "invalidate_cache"]


class CatalogMunicipalityByProvince:
    def __init__(self, repository: MunicipalityRepository) -> None:
        self._repository = repository

    @log_invocation(log_args=True, log_result=False)
    def catalog_municipalities_by_province(
        self, province_id: int
    ) -> GeoJSONFeatureCollection:
        return get_cached_municipalities(province_id)
