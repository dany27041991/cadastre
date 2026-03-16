"""Use case: catalog regions with geometries."""

from core.logger import log_invocation
from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.geo.infrastructure.repository.region_repository import RegionRepository
from territory.geo.application.usecases.query.cache.catalog_regions_cache import (
    get_cached_regions,
    invalidate_cache,
)

__all__ = ["CatalogRegion", "invalidate_cache"]


class CatalogRegion:
    def __init__(self, repository: RegionRepository) -> None:
        self._repository = repository

    @log_invocation(log_args=False, log_result=False)
    def catalog_regions(self) -> GeoJSONFeatureCollection:
        return get_cached_regions()
