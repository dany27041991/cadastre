"""Green assets repository backed by lakehouse Parquet (MinIO + DuckDB)."""

from __future__ import annotations

from collections.abc import Callable
from datetime import date
from typing import Any, Literal

from sqlalchemy.orm import Session

from territory.common.infrastructure.lakehouse import silver_read
from territory.geo.domain.entities import GeoJSONFeatureCollection

# Import module functions
from . import (
    assets_catalog_reader,
    assets_pk_reader,
    assets_scope_helpers,
    assets_table_reader,
    assets_viewport_reader,
)


class GreenAssetsLakehouseRepository:
    """DuckDB/MinIO implementation for green assets serving."""

    def __init__(
        self,
        session_factory: Callable[[], Session],
        *,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> None:
        self._session_factory = session_factory
        self._date_from = date_from
        self._date_to = date_to

    def _resolutions(
        self,
        *,
        region_id: int | None = None,
        province_id: int | None = None,
        municipality_id: int | None = None,
        municipality_ids: list[int] | None = None,
    ):
        return silver_read.resolve_prefixes(
            dataset="assets",
            date_from=self._date_from,
            date_to=self._date_to,
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
            municipality_ids=municipality_ids,
        )

    def _municipality_ids_for_view(
        self,
        *,
        bbox: tuple[float, float, float, float],
        clip_wkt: str | None,
        municipality_id: int | None,
        region_id: int | None = None,
        province_id: int | None = None,
    ) -> list[int] | None:
        return assets_scope_helpers.municipality_ids_for_view(
            self._session_factory,
            self._resolutions,
            bbox=bbox,
            clip_wkt=clip_wkt,
            municipality_id=municipality_id,
            region_id=region_id,
            province_id=province_id,
        )

    def _load_sub_municipal_geom(self, municipality_id: int, sub_municipal_area_id: int):
        return assets_scope_helpers.load_sub_municipal_geom(
            self._session_factory,
            municipality_id,
            sub_municipal_area_id,
        )

    def _resolve_clip_geom(
        self,
        *,
        municipality_id: int | None,
        sub_municipal_area_id: int | None,
        clip_wkt: str | None,
    ):
        return assets_scope_helpers.resolve_clip_geom(
            self._session_factory,
            municipality_id=municipality_id,
            sub_municipal_area_id=sub_municipal_area_id,
            clip_wkt=clip_wkt,
        )

    @staticmethod
    def _filter_clusters_by_clip(clusters, clip_geom):
        return assets_scope_helpers.filter_clusters_by_clip(clusters, clip_geom)

    def get_by_pk(
        self,
        asset_id: int,
        region_id: int,
        province_id: int,
        municipality_id: int | None = None,
    ) -> dict[str, Any] | None:
        return assets_pk_reader.get_by_pk(
            self._resolutions(
                region_id=region_id,
                province_id=province_id,
                municipality_id=municipality_id,
            ),
            asset_id,
            region_id,
            province_id,
            municipality_id=municipality_id,
        )

    def get_detail_by_pk(
        self,
        asset_id: int,
        region_id: int,
        province_id: int,
        municipality_id: int | None = None,
    ) -> dict[str, Any] | None:
        return self.get_by_pk(
            asset_id, region_id, province_id, municipality_id=municipality_id
        )

    def get_bbox_by_pk(
        self,
        asset_id: int,
        region_id: int,
        province_id: int,
    ) -> list[float] | None:
        return assets_pk_reader.get_bbox_by_pk(
            self._resolutions(region_id=region_id, province_id=province_id),
            asset_id,
            region_id,
            province_id,
        )

    def get_geometry_by_pk(
        self,
        asset_id: int,
        region_id: int,
        province_id: int,
    ) -> dict[str, Any] | None:
        return assets_pk_reader.get_geometry_by_pk(
            self._resolutions(region_id=region_id, province_id=province_id),
            asset_id,
            region_id,
            province_id,
        )

    def get_within_area(
        self,
        region_id: int,
        province_id: int,
        municipality_id: int,
        green_area_id: int,
    ) -> GeoJSONFeatureCollection:
        return assets_catalog_reader.get_within_area(
            self._resolutions(
                region_id=region_id,
                province_id=province_id,
                municipality_id=municipality_id,
            ),
            region_id,
            province_id,
            municipality_id,
            green_area_id,
        )

    def get_within_municipality(
        self,
        region_id: int,
        province_id: int,
        municipality_id: int,
    ) -> GeoJSONFeatureCollection:
        return assets_catalog_reader.get_within_municipality(
            self._resolutions(
                region_id=region_id,
                province_id=province_id,
                municipality_id=municipality_id,
            ),
            region_id,
            province_id,
            municipality_id,
        )

    def get_within_municipality_intersecting_sub_municipal_area(
        self,
        region_id: int,
        province_id: int,
        municipality_id: int,
        sub_municipal_area_id: int,
    ) -> GeoJSONFeatureCollection:
        return assets_catalog_reader.get_within_municipality_intersecting_sub_municipal_area(
            self._session_factory,
            self._resolutions(
                region_id=region_id,
                province_id=province_id,
                municipality_id=municipality_id,
            ),
            region_id,
            province_id,
            municipality_id,
            sub_municipal_area_id,
        )

    def _exact_clusters_for_clip(
        self,
        *,
        clip_wkt: str,
        mode: str,
        bbox: tuple[float, float, float, float],
        cell_size_m: float | None = None,
        region_id: int | None = None,
        province_id: int | None = None,
        municipality_id: int | None = None,
    ):
        return assets_viewport_reader.exact_clusters_for_clip(
            self._session_factory,
            self._date_from,
            self._date_to,
            clip_wkt=clip_wkt,
            mode=mode,
            bbox=bbox,
            cell_size_m=cell_size_m,
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
        )

    def get_admin_clusters_in_bbox(
        self,
        level: str,
        bbox: tuple[float, float, float, float],
        region_id: int | None = None,
        province_id: int | None = None,
        municipality_id: int | None = None,
        sub_municipal_area_id: int | None = None,
        clip_wkt: str | None = None,
        municipality_ids: list[int] | None = None,
    ):
        return assets_viewport_reader.get_admin_clusters_in_bbox(
            self._session_factory,
            self._resolutions,
            self._date_from,
            self._date_to,
            level,
            bbox,
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
            sub_municipal_area_id=sub_municipal_area_id,
            clip_wkt=clip_wkt,
            municipality_ids=municipality_ids,
        )

    def get_raw_in_bbox(
        self,
        bbox: tuple[float, float, float, float],
        limit: int,
        region_id: int | None = None,
        province_id: int | None = None,
        municipality_id: int | None = None,
        sub_municipal_area_id: int | None = None,
        green_area_id: int | None = None,
        green_area_ids: list[int] | None = None,
        municipality_ids: list[int] | None = None,
        clip_wkt: str | None = None,
        filters: dict[str, Any] | None = None,
        clip_geom=None,
    ) -> GeoJSONFeatureCollection:
        return assets_viewport_reader.get_raw_in_bbox(
            self._session_factory,
            self._resolutions,
            bbox,
            limit,
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
            sub_municipal_area_id=sub_municipal_area_id,
            green_area_id=green_area_id,
            green_area_ids=green_area_ids,
            municipality_ids=municipality_ids,
            clip_wkt=clip_wkt,
            filters=filters,
            clip_geom=clip_geom,
        )

    def get_grid_clusters_from_gold(
        self,
        zoom_level: int,
        bbox: tuple[float, float, float, float],
        region_id: int | None = None,
        province_id: int | None = None,
        municipality_id: int | None = None,
        clip_wkt: str | None = None,
        municipality_ids: list[int] | None = None,
    ):
        return assets_viewport_reader.get_grid_clusters_from_gold(
            self._session_factory,
            self._resolutions,
            self._date_from,
            self._date_to,
            zoom_level,
            bbox,
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
            clip_wkt=clip_wkt,
            municipality_ids=municipality_ids,
        )

    def get_clusters_in_bbox(
        self,
        bbox: tuple[float, float, float, float],
        cell_size_m: float,
        region_id: int | None = None,
        province_id: int | None = None,
        municipality_id: int | None = None,
        sub_municipal_area_id: int | None = None,
        green_area_id: int | None = None,
        clip_wkt: str | None = None,
    ):
        return assets_viewport_reader.get_clusters_in_bbox(
            self._session_factory,
            self._resolutions,
            self._date_from,
            self._date_to,
            bbox,
            cell_size_m,
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
            sub_municipal_area_id=sub_municipal_area_id,
            green_area_id=green_area_id,
            clip_wkt=clip_wkt,
        )

    def get_clusters_for_green_area_ids(
        self,
        bbox: tuple[float, float, float, float],
        cell_size_m: float,
        green_area_ids: list[int],
        *,
        region_id: int | None = None,
        province_id: int | None = None,
        municipality_id: int | None = None,
        municipality_ids: list[int] | None = None,
        clip_wkt: str | None = None,
        clip_geom=None,
        filters: dict[str, Any] | None = None,
    ):
        return assets_viewport_reader.get_clusters_for_green_area_ids(
            self._session_factory,
            self._resolutions,
            bbox,
            cell_size_m,
            green_area_ids,
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
            municipality_ids=municipality_ids,
            clip_wkt=clip_wkt,
            clip_geom=clip_geom,
            filters=filters,
        )

    def list_table_rows_paged(
        self,
        region_id: int | None,
        province_id: int | None,
        municipality_id: int | None,
        *,
        green_area_id: int | None = None,
        sub_municipal_area_id: int | None = None,
        clip_wkt: str | None = None,
        page: int = 1,
        page_size: int = 50,
        sort_by: str | None = None,
        sort_dir: Literal["asc", "desc"] = "asc",
        filters: dict[str, Any] | None = None,
    ) -> tuple[list[dict], int, bool]:
        return assets_table_reader.list_table_rows_paged(
            self._session_factory,
            self._resolutions(
                region_id=region_id,
                province_id=province_id,
                municipality_id=municipality_id,
            ),
            region_id,
            province_id,
            municipality_id,
            green_area_id=green_area_id,
            sub_municipal_area_id=sub_municipal_area_id,
            clip_wkt=clip_wkt,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_dir=sort_dir,
            filters=filters,
        )
