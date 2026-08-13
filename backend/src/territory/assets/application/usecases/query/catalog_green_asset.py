"""Use case: catalog green assets (trees, rows, lawns, etc.) for an area."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Literal

from sqlalchemy.orm import Session

from core.exceptions.base import NotFoundError
from core.logger import log_invocation
from territory.common.infrastructure.dto.green_detail_out import GreenDetailOut, build_asset_detail
from territory.common.infrastructure.green_table_fk_labels import enrich_green_asset_table_rows
from territory.common.infrastructure.green_metadata_projection import merge_asset_table_row
from territory.common.infrastructure.green_table_page_out import GreenTablePageOut
from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.assets.infrastructure.repository.green_assets_repository import GreenAssetsRepository
from territory.assets.application.usecases.query.cache import (
    get_cached_green_assets,
    invalidate_cache,
    invalidate_cache_for_municipality,
)
from territory.assets.application.usecases.query.viewport_grid import (
    LAST_ZOOM_RAW_HARD_CAP,
    RAW_MIN_ZOOM,
    admin_level_for_zoom,
    grid_cell_size_m,
    grid_matview_zoom_level,
    mercator_to_lon_lat,
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

    @log_invocation(log_args=True, log_result=False)
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
    ) -> GeoJSONFeatureCollection:
        """Viewport-sized green assets response (national-scale map rendering).

        Returns raw assets at the vendor's last zoom level (>= RAW_MIN_ZOOM),
        otherwise grid-cell cluster points aggregated in PostGIS. Cluster features
        carry cluster_count, cluster_key (stable grid cell) and cluster_bbox so the
        frontend can drill without a second request.

        The raw/clusters decision is zoom-only: count-based hysteresis kept
        clusters on screen at the last level right after a drill, hiding the
        assets the user drilled for.

        At low zooms clusters come from the pre-aggregated admin materialized
        view instead of a live grid scan: a nationwide grid aggregation
        measured 12s on 5.5M rows and grows with the dataset, while admin
        aggregates are O(#admin units).
        """
        # A green-area scope has no pre-aggregated admin rows; grid/raw only.
        if green_area_id is None:
            admin = self._admin_clusters_response(
                bbox, zoom, region_id=region_id, province_id=province_id,
                municipality_id=municipality_id,
                sub_municipal_area_id=sub_municipal_area_id,
            )
            if admin is not None:
                return admin

        scope = {
            "region_id": region_id,
            "province_id": province_id,
            "municipality_id": municipality_id,
            "sub_municipal_area_id": sub_municipal_area_id,
            "green_area_id": green_area_id,
        }
        # Raw assets always and only at the vendor's last zoom level; every
        # other zoom serves clusters. No count-based mode flip: hysteresis kept
        # clusters visible at the last level right after a drill.
        if zoom >= RAW_MIN_ZOOM:
            return self._repository.get_raw_in_bbox(bbox, LAST_ZOOM_RAW_HARD_CAP, **scope)

        # Pre-aggregated matview covers the grid zoom band without ad-hoc scope
        # geometries; sub-area / green-area scopes need a live spatial intersect.
        matview_level = grid_matview_zoom_level(zoom)
        use_matview = (
            matview_level is not None
            and sub_municipal_area_id is None
            and green_area_id is None
        )
        if use_matview:
            clusters = self._repository.get_grid_clusters_from_matview(
                matview_level,
                bbox,
                region_id=region_id,
                province_id=province_id,
                municipality_id=municipality_id,
            )
        else:
            clusters = self._repository.get_clusters_in_bbox(
                bbox, grid_cell_size_m(zoom), **scope
            )

        features = []
        for cluster in clusters:
            lon, lat = mercator_to_lon_lat(cluster.merc_x, cluster.merc_y)
            features.append(
                {
                    "type": "Feature",
                    "id": cluster.sample_id,
                    "properties": {
                        "id": cluster.sample_id,
                        "cluster": True,
                        "cluster_count": cluster.count,
                        "cluster_key": f"{cluster.cell_x},{cluster.cell_y}",
                        "cluster_bbox": list(cluster.bbox),
                    },
                    "geometry": {"type": "Point", "coordinates": [lon, lat]},
                }
            )
        return {"type": "FeatureCollection", "features": features}

    def _admin_clusters_response(
        self,
        bbox: tuple[float, float, float, float],
        zoom: float,
        *,
        region_id: int | None,
        province_id: int | None,
        municipality_id: int | None,
        sub_municipal_area_id: int | None = None,
    ) -> GeoJSONFeatureCollection | None:
        """Admin-aggregated clusters for low zooms; None → use the grid/raw path.

        The level follows the zoom band (region < province < municipality) and
        is refined by the request scope, covering the whole drill chain
        Italia > regione > provincia > comune > sottoarea comunale. Inside a
        comune the sub_municipal level applies at the municipality zoom band;
        zooming out past that band collapses to the scoped unit itself (one
        cluster). Municipalities without sub-area rows fall back to grid
        clustering (empty admin response → None).
        """
        level = admin_level_for_zoom(zoom)
        if level is None:
            return None
        # Scope floor + one-step child bump. Cascading `if` bumps previously
        # forced sub_municipal whenever municipality_id was set (region →
        # province → municipality → sub_municipal), so zoom-out never merged
        # circoscrizioni into a single comune cluster.
        _ADMIN_RANK = {
            "region": 0,
            "province": 1,
            "municipality": 2,
            "sub_municipal": 3,
        }
        _ADMIN_CHILDREN = {
            "region": "province",
            "province": "municipality",
            "municipality": "sub_municipal",
        }
        if sub_municipal_area_id is not None:
            scope_floor = "sub_municipal"
        elif municipality_id is not None:
            scope_floor = "municipality"
        elif province_id is not None:
            scope_floor = "province"
        elif region_id is not None:
            scope_floor = "region"
        else:
            scope_floor = None

        if scope_floor is not None:
            if _ADMIN_RANK[level] < _ADMIN_RANK[scope_floor]:
                # Zoom coarser than the selected unit: show that unit as one
                # cluster (matview rows for coarser levels null out child ids,
                # so the scope filter would otherwise return empty).
                level = scope_floor
            elif _ADMIN_RANK[level] == _ADMIN_RANK[scope_floor]:
                # Zoom matches the selected unit: show children instead of a
                # single "self" cluster — but only when zoomed in enough.
                # Circoscrizioni for a comune used to fill the whole
                # municipality band (9–13); keep children near the grid handoff.
                child = _ADMIN_CHILDREN.get(scope_floor)
                child_min_zoom = {
                    "municipality": 12.0,
                }.get(scope_floor)
                if child is not None and (
                    child_min_zoom is None or zoom >= child_min_zoom
                ):
                    level = child

        clusters = self._repository.get_admin_clusters_in_bbox(
            level,
            bbox,
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
            sub_municipal_area_id=sub_municipal_area_id,
        )
        if level == "sub_municipal" and not clusters:
            return None
        features = []
        for cluster in clusters:
            features.append(
                {
                    "type": "Feature",
                    "id": cluster.sample_id,
                    "properties": {
                        "id": cluster.sample_id,
                        "cluster": True,
                        "cluster_count": cluster.count,
                        "cluster_key": cluster.admin_key,
                        "cluster_bbox": list(cluster.bbox),
                    },
                    "geometry": {
                        "type": "Point",
                        "coordinates": [cluster.lon, cluster.lat],
                    },
                }
            )
        return {"type": "FeatureCollection", "features": features}

    @log_invocation(log_args=True, log_result=False)
    def get_green_asset_detail(
        self,
        asset_id: int,
        *,
        region_id: int,
        province_id: int,
    ) -> GreenDetailOut:
        row = self._repository.get_detail_by_pk(asset_id, region_id, province_id)
        if row is None:
            raise NotFoundError()
        bbox = self._repository.get_bbox_by_pk(asset_id, region_id, province_id)
        geometry = self._repository.get_geometry_by_pk(asset_id, region_id, province_id)
        with self._session_factory() as session:
            enriched = enrich_green_asset_table_rows(session, [row])[0]
        return build_asset_detail(enriched, bbox=bbox, geometry=geometry)

    def list_green_assets_table_paged(
        self,
        region_id: int | None,
        municipality_id: int | None,
        *,
        province_id: int | None = None,
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
            enriched = [merge_asset_table_row(r) for r in enriched]
        return GreenTablePageOut.build(data=enriched, total=total, page=page, page_size=page_size)
