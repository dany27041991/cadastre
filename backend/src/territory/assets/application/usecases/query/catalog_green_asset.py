"""Use case: catalog green assets (trees, rows, lawns, etc.) for an area."""

from __future__ import annotations

from typing import Any, Literal

from core.logger import log_invocation
from territory.common.infrastructure.dto.green_detail_out import GreenDetailOut
from territory.common.infrastructure.green_table_page_out import GreenTablePageOut
from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.assets.infrastructure.repository.green_assets_lakehouse_repository import (
    GreenAssetsLakehouseRepository,
)
from territory.assets.application.usecases.query.cache import (
    get_cached_green_assets,
    invalidate_cache,
    invalidate_cache_for_municipality,
)
from territory.assets.application.usecases.query.viewport_green_assets import (
    viewport_green_assets as _viewport_green_assets,
)
from territory.assets.application.usecases.query.get_green_asset_detail import (
    get_green_asset_detail as _get_green_asset_detail,
)
from territory.assets.application.usecases.query.list_green_assets_table import (
    list_green_assets_table_paged as _list_green_assets_table_paged,
)
from territory.assets.application.usecases.query.viewport_grid import (
    LAST_ZOOM_RAW_HARD_CAP,
)


GreenAssetsRepositoryPort = GreenAssetsLakehouseRepository

__all__ = [
    "CatalogGreenAsset",
    "invalidate_cache",
    "invalidate_cache_for_municipality",
    "LAST_ZOOM_RAW_HARD_CAP",
]


class CatalogGreenAsset:
    """Façade for green asset cataloging use cases."""

    def __init__(
        self,
        repository: GreenAssetsRepositoryPort,
    ) -> None:
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
        """Catalog green assets for an area (cached)."""
        return get_cached_green_assets(
            self._repository,
            region_id,
            province_id,
            municipality_id,
            green_area_id,
            sub_municipal_area_id,
        )

    def viewport_green_assets(
        self,
        bbox: tuple[float, float, float, float],
        zoom: float,
        *,
        region_id: int | None = None,
        province_id: int | None = None,
        municipality_id: int | None = None,
        sub_municipal_area_id: int | None = None,
        green_area_id: int | None = None,
        clip_wkt: str | None = None,
        filters: dict[str, Any] | None = None,
        area_filters: dict[str, Any] | None = None,
    ) -> GeoJSONFeatureCollection:
        """Viewport-sized green assets response (national-scale map rendering)."""
        return _viewport_green_assets(
            self._repository,
            bbox,
            zoom,
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
            sub_municipal_area_id=sub_municipal_area_id,
            green_area_id=green_area_id,
            clip_wkt=clip_wkt,
            filters=filters,
            area_filters=area_filters,
        )

    def get_green_asset_detail(
        self,
        asset_id: int,
        *,
        region_id: int,
        province_id: int,
        municipality_id: int | None = None,
    ) -> GreenDetailOut:
        """Get green asset detail by ID."""
        return _get_green_asset_detail(
            self._repository,
            asset_id,
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
        )

    def list_green_assets_table_paged(
        self,
        region_id: int | None,
        municipality_id: int | None,
        *,
        province_id: int | None = None,
        green_area_id: int | None = None,
        sub_municipal_area_id: int | None = None,
        clip_wkt: str | None = None,
        page: int = 1,
        page_size: int = 50,
        sort_by: str | None = None,
        sort_dir: Literal["asc", "desc"] = "asc",
        filters: dict[str, Any] | None = None,
    ) -> GreenTablePageOut:
        """List green assets table with pagination and filters."""
        return _list_green_assets_table_paged(
            self._repository,
            region_id,
            municipality_id,
            province_id=province_id,
            green_area_id=green_area_id,
            sub_municipal_area_id=sub_municipal_area_id,
            clip_wkt=clip_wkt,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_dir=sort_dir,
            filters=filters,
        )
