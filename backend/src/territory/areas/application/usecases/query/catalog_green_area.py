"""Use case: catalog green areas (N-level hierarchy)."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Literal

from sqlalchemy.orm import Session

from core.exceptions.base import NotFoundError
from core.logger import log_invocation
from territory.common.infrastructure.dto.green_detail_out import GreenDetailOut, build_area_detail
from territory.common.infrastructure.green_table_fk_labels import enrich_green_area_table_rows
from territory.common.infrastructure.green_metadata_projection import merge_area_table_row
from territory.common.infrastructure.green_table_page_out import GreenTablePageOut
from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.areas.infrastructure.repository.green_areas_repository import GreenAreasRepository
from territory.areas.application.usecases.query.cache import (
    get_cached_green_areas,
    invalidate_cache,
    invalidate_cache_for_municipality,
)

__all__ = ["CatalogGreenArea", "invalidate_cache", "invalidate_cache_for_municipality"]

# Viewport rendering: areas are polygons, only meaningful from this zoom up.
VIEWPORT_AREAS_MIN_ZOOM = 12.0
# Cap per viewport response; largest areas win when exceeded.
VIEWPORT_AREAS_MAX_FEATURES = 500

_EMPTY_COLLECTION: GeoJSONFeatureCollection = {"type": "FeatureCollection", "features": []}


# Web Mercator ground resolution at equator (m/px) for zoom 0, 256px tiles.
_MERCATOR_RESOLUTION_Z0_M_PER_PX = 156543.03392804097
_METERS_PER_DEGREE = 111_320.0


def viewport_simplify_tolerance_deg(zoom: float) -> float:
    """Simplification tolerance ≈ 1 screen pixel at the given zoom, in degrees."""
    meters_per_px = _MERCATOR_RESOLUTION_Z0_M_PER_PX / (2.0**zoom)
    return meters_per_px / _METERS_PER_DEGREE


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

    @log_invocation(log_args=True, log_result=False)
    def viewport_green_areas(
        self,
        bbox: tuple[float, float, float, float],
        zoom: float,
        *,
        region_id: int | None = None,
        province_id: int | None = None,
        municipality_id: int | None = None,
        sub_municipal_area_id: int | None = None,
        clip_wkt: str | None = None,
    ) -> GeoJSONFeatureCollection:
        """Root green areas intersecting the viewport bbox, simplified for the zoom.

        Below VIEWPORT_AREAS_MIN_ZOOM areas are not rendered (admin/grid
        clusters cover those bands), so return an empty collection cheaply.
        """
        if zoom < VIEWPORT_AREAS_MIN_ZOOM:
            return _EMPTY_COLLECTION
        result = self._repository.get_roots_in_bbox(
            bbox,
            simplify_tolerance_deg=viewport_simplify_tolerance_deg(zoom),
            limit=VIEWPORT_AREAS_MAX_FEATURES,
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
            sub_municipal_area_id=sub_municipal_area_id,
            clip_wkt=clip_wkt,
        )
        return result

    @log_invocation(log_args=True, log_result=False)
    def get_green_area_detail(
        self,
        area_id: int,
        *,
        region_id: int,
        province_id: int,
    ) -> GreenDetailOut:
        row = self._repository.get_detail_by_pk(area_id, region_id, province_id)
        if row is None:
            raise NotFoundError()
        bbox = self._repository.get_bbox_by_pk(area_id, region_id, province_id)
        geometry = self._repository.get_geometry_by_pk(area_id, region_id, province_id)
        with self._session_factory() as session:
            enriched = enrich_green_area_table_rows(session, [row])[0]
        return build_area_detail(enriched, bbox=bbox, geometry=geometry)

    def list_green_areas_table_paged(
        self,
        region_id: int | None,
        province_id: int | None,
        municipality_id: int | None,
        *,
        sub_municipal_area_id: int | None = None,
        contained_in_area_id: int | None = None,
        parent_id: int | None = None,
        area_id: int | None = None,
        clip_wkt: str | None = None,
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
            area_id=area_id,
            clip_wkt=clip_wkt,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_dir=sort_dir,
            filters=filters,
        )
        if rows:
            with self._session_factory() as session:
                rows = enrich_green_area_table_rows(session, rows)
            rows = [merge_area_table_row(r) for r in rows]
        return GreenTablePageOut.build(
            data=rows,
            total=total,
            page=page,
            page_size=page_size,
        )
