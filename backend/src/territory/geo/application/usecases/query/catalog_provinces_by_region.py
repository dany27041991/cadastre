"""Use case: catalog provinces of a region."""

from core.logger import log_invocation
from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.geo.infrastructure.repository.province_repository import (
    ProvinceRepository,
)
from territory.geo.application.usecases.query.cache.catalog_provinces_by_region_cache import (
    get_cached_provinces,
    invalidate_cache,
)

__all__ = ["CatalogProvinceByRegion", "invalidate_cache"]


class CatalogProvinceByRegion:
    def __init__(self, repository: ProvinceRepository) -> None:
        self._repository = repository

    @log_invocation(log_args=True, log_result=False)
    def catalog_provinces_by_region(
        self, region_id: int
    ) -> GeoJSONFeatureCollection:
        return get_cached_provinces(region_id)
