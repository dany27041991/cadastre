"""Use case: catalog green areas (N-level hierarchy)."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Literal

from sqlalchemy.orm import Session

from core.logger import log_invocation
from territory.common.infrastructure.green_table_fk_labels import enrich_green_area_table_rows
from territory.common.infrastructure.green_table_page_out import GreenTablePageOut
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

    def __init__(
        self,
        repository: GreenAreasRepository,
        session_factory: Callable[[], Session],
    ) -> None:
        self._repository = repository
        self._session_factory = session_factory

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

    def list_green_areas_table_paged(
        self,
        region_id: int,
        province_id: int,
        municipality_id: int,
        *,
        sub_municipal_area_id: int | None = None,
        contained_in_area_id: int | None = None,
        parent_id: int | None = None,
        page: int = 1,
        page_size: int = 50,
        sort_by: str | None = None,
        sort_dir: Literal["asc", "desc"] = "asc",
        filters: dict[str, Any] | None = None,
    ) -> GreenTablePageOut:
        rows, total = self._repository.list_table_rows_paged(
            region_id,
            province_id,
            municipality_id,
            sub_municipal_area_id=sub_municipal_area_id,
            contained_in_area_id=contained_in_area_id,
            parent_id=parent_id,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_dir=sort_dir,
            filters=filters,
        )
        if rows:
            with self._session_factory() as session:
                rows = enrich_green_area_table_rows(session, rows)
        return GreenTablePageOut.build(
            data=rows,
            total=total,
            page=page,
            page_size=page_size,
        )
