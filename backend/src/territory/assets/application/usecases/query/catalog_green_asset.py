"""Use case: catalog green assets (trees, rows, lawns, etc.) for an area."""

from core.logger import log_invocation
from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.assets.infrastructure.repository.green_assets_repository import (
    GreenAssetsRepository,
)
from territory.assets.application.usecases.query.cache import (
    get_cached_green_assets,
    invalidate_cache,
    invalidate_cache_for_municipality,
)

__all__ = [
    "CatalogGreenAsset",
    "invalidate_cache",
    "invalidate_cache_for_municipality",
]


class CatalogGreenAsset:
    def __init__(self, repository: GreenAssetsRepository) -> None:
        self._repository = repository

    @log_invocation(log_args=True, log_result=False)
    def catalog_green_assets(
        self,
        region_id: int,
        municipality_id: int,
        *,
        province_id: int,
        green_area_id: int | None = None,
        sub_municipal_area_id: int | None = None,
    ) -> GeoJSONFeatureCollection:
        return get_cached_green_assets(
            region_id,
            province_id,
            municipality_id,
            green_area_id,
            sub_municipal_area_id,
        )
