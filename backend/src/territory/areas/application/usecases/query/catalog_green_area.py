"""Use case: catalog green areas (N-level hierarchy)."""

from core.logger import log_invocation
from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.areas.infrastructure.repository.green_areas_repository import GreenAreasRepository
from territory.areas.application.usecases.query.cache import (
    get_cached_green_areas,
    invalidate_cache,
    invalidate_cache_for_municipality,
)

__all__ = ["CatalogGreenArea", "invalidate_cache", "invalidate_cache_for_municipality"]


class CatalogGreenArea:
    """With parent_id: children of that area. Without: root areas for municipality. Region and province required."""

    def __init__(self, repository: GreenAreasRepository) -> None:
        self._repository = repository

    @log_invocation(log_args=True, log_result=False)
    def catalog_green_areas(
        self,
        region_id: int,
        *,
        province_id: int,
        parent_id: int | None = None,
        municipality_id: int | None = None,
        sub_municipal_area_id: int | None = None,
        contained_in_area_id: int | None = None,
    ) -> GeoJSONFeatureCollection:
        return get_cached_green_areas(
            region_id,
            province_id,
            parent_id,
            municipality_id,
            sub_municipal_area_id,
            contained_in_area_id,
        )

    def list_green_areas_table(
        self,
        region_id: int,
        *,
        province_id: int,
        parent_id: int | None = None,
        municipality_id: int | None = None,
        sub_municipal_area_id: int | None = None,
        contained_in_area_id: int | None = None,
    ) -> list[dict]:
        return self._repository.list_table_rows(
            region_id,
            province_id,
            parent_id=parent_id,
            municipality_id=municipality_id,
            sub_municipal_area_id=sub_municipal_area_id,
            contained_in_area_id=contained_in_area_id,
        )
