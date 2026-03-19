"""Use case: catalog green assets (trees, rows, lawns, etc.) for an area."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Literal

from sqlalchemy.orm import Session

from core.logger import log_invocation
from territory.common.infrastructure.green_table_fk_labels import enrich_green_asset_table_rows
from territory.common.infrastructure.green_table_page_out import GreenTablePageOut
from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.assets.infrastructure.repository.green_assets_repository import GreenAssetsRepository
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
    def __init__(
        self,
        repository: GreenAssetsRepository,
        session_factory: Callable[[], Session],
    ) -> None:
        self._repository = repository
        self._session_factory = session_factory

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

    def list_green_assets_table_paged(
        self,
        region_id: int,
        municipality_id: int,
        *,
        province_id: int,
        green_area_id: int | None = None,
        sub_municipal_area_id: int | None = None,
        page: int = 1,
        page_size: int = 50,
        sort_by: str | None = None,
        sort_dir: Literal["asc", "desc"] = "asc",
        filters: dict[str, Any] | None = None,
    ) -> GreenTablePageOut:
        raw, total = self._repository.list_table_rows_paged(
            region_id,
            province_id,
            municipality_id,
            green_area_id=green_area_id,
            sub_municipal_area_id=sub_municipal_area_id,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_dir=sort_dir,
            filters=filters,
        )
        enriched = raw
        if raw:
            with self._session_factory() as session:
                enriched = enrich_green_asset_table_rows(session, raw)
        return GreenTablePageOut.build(data=enriched, total=total, page=page, page_size=page_size)
