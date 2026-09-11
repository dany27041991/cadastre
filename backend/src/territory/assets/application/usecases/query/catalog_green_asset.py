"""Use case: catalog green assets (trees, rows, lawns, etc.) for an area."""

from __future__ import annotations

import json
import time
from typing import Any, Literal

from core.exceptions.base import NotFoundError
from core.logger import log_invocation
from territory.common.infrastructure.dto.green_detail_out import GreenDetailOut, build_asset_detail
from territory.common.infrastructure.green_metadata_projection import merge_asset_table_row
from territory.common.infrastructure.green_table_page_out import GreenTablePageOut
from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.assets.infrastructure.repository.green_assets_lakehouse_repository import (
    GreenAssetsLakehouseRepository,
)
from territory.assets.infrastructure.repository.viewport_cluster import ViewportCluster
from territory.assets.application.usecases.query.cache import (
    get_cached_green_assets,
    invalidate_cache,
    invalidate_cache_for_municipality,
)
from territory.assets.application.usecases.query.viewport_grid import (
    ADMIN_LEVEL_PROVINCE_MAX_ZOOM,
    ADMIN_MUNICIPALITY_HARD_CAP,
    CLUSTER_GRID_MAX_REFINE_ZOOM,
    CLUSTER_MAX_ZOOM_THRESHOLD,
    GRID_ADMIN_HANDOFF_MAX_MUNICIPALITIES,
    GRID_CLUSTER_HARD_CAP,
    LAST_ZOOM_RAW_HARD_CAP,
    RAW_MAX_MUNICIPALITIES,
    RAW_MIN_ZOOM,
    admin_level_for_zoom,
    grid_cell_size_m,
    grid_gold_zoom_level,
    mercator_to_lon_lat,
)


GreenAssetsRepositoryPort = GreenAssetsLakehouseRepository

__all__ = [
    "CatalogGreenAsset",
    "invalidate_cache",
    "invalidate_cache_for_municipality",
]


class CatalogGreenAsset:
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
        return get_cached_green_assets(
            self._repository,
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
        clip_wkt: str | None = None,
    ) -> GeoJSONFeatureCollection:
        """Viewport-sized green assets response (national-scale map rendering).

        Returns raw assets at the vendor's last zoom level (>= RAW_MIN_ZOOM),
        otherwise grid-cell cluster points from gold Parquet (or live gold-band
        fallback). Cluster features carry cluster_count, cluster_key (stable
        grid cell) and cluster_bbox so the frontend can drill without a second
        request.

        The raw/clusters decision is zoom-only: count-based hysteresis kept
        clusters on screen at the last level right after a drill, hiding the
        assets the user drilled for.

        At low zooms clusters come from pre-aggregated admin gold instead of a
        live grid scan: a nationwide grid aggregation measured 12s on 5.5M rows
        and grows with the dataset, while admin aggregates are O(#admin units).
        """
        # Admin gold (with optional clip on unit extent) for low zooms.
        # A green-area scope has no pre-aggregated admin rows; grid/raw only.
        if green_area_id is None:
            admin = self._admin_clusters_response(
                bbox, zoom, region_id=region_id, province_id=province_id,
                municipality_id=municipality_id,
                sub_municipal_area_id=sub_municipal_area_id,
                clip_wkt=clip_wkt,
            )
            if admin is not None:
                return admin

        scope = {
            "region_id": region_id,
            "province_id": province_id,
            "municipality_id": municipality_id,
            "sub_municipal_area_id": sub_municipal_area_id,
            "green_area_id": green_area_id,
            "clip_wkt": clip_wkt,
        }
        # Raw only when the silver scan stays cheap (few municipality files).
        # Wide/national raw measured 4–56s opening hundreds–thousands of Parquet.
        force_grid_level: int | None = None
        if zoom >= RAW_MIN_ZOOM:
            if (
                sub_municipal_area_id is None
                and green_area_id is None
                and clip_wkt is None
            ):
                muni_probe = self._repository.get_admin_clusters_in_bbox(
                    "municipality",
                    bbox,
                    region_id=region_id,
                    province_id=province_id,
                    municipality_id=municipality_id,
                )
                if len(muni_probe) > RAW_MAX_MUNICIPALITIES:
                    force_grid_level = CLUSTER_GRID_MAX_REFINE_ZOOM
                else:
                    raw = self._repository.get_raw_in_bbox(
                        bbox, LAST_ZOOM_RAW_HARD_CAP, **scope
                    )
                    return raw
            else:
                raw = self._repository.get_raw_in_bbox(
                    bbox, LAST_ZOOM_RAW_HARD_CAP, **scope
                )
                return raw

        # Pre-aggregated gold covers the grid zoom band. Clip filters cells via
        # extent ∩ polygon. Live grid is reserved for sub-area / green-area
        # scopes that need per-asset intersects.
        gold_level = force_grid_level or grid_gold_zoom_level(zoom)
        use_gold = (
            gold_level is not None
            and sub_municipal_area_id is None
            and green_area_id is None
        )
        if use_gold:
            assert gold_level is not None
            # Wide-viewport guard: municipality admin is O(#munis) and cheap;
            # fine grid_{z} over hundreds of munis hangs the map.
            # Single-municipality scope (e.g. Lecce breadcrumb) never needs the
            # handoff scan — skip the extra admin gold round-trip.
            if municipality_id is not None:
                muni_admin: list = []
            else:
                muni_admin = self._repository.get_admin_clusters_in_bbox(
                    "municipality",
                    bbox,
                    region_id=region_id,
                    province_id=province_id,
                    municipality_id=municipality_id,
                    clip_wkt=clip_wkt,
                )
            if len(muni_admin) > GRID_ADMIN_HANDOFF_MAX_MUNICIPALITIES:
                if (
                    len(muni_admin) > ADMIN_MUNICIPALITY_HARD_CAP
                    and municipality_id is None
                    and province_id is None
                    and not clip_wkt
                ):
                    prov_admin = self._repository.get_admin_clusters_in_bbox(
                        "province",
                        bbox,
                        region_id=region_id,
                    )
                    return self._admin_features_collection(prov_admin)
                return self._admin_features_collection(muni_admin)

            clusters = self._repository.get_grid_clusters_from_gold(
                gold_level,
                bbox,
                region_id=region_id,
                province_id=province_id,
                municipality_id=municipality_id,
                clip_wkt=clip_wkt,
            )
            served_level = gold_level
            # One jump to the coarsest grid band when over cap. Binary search
            # did up to 5 gold reads and exhausted the DuckDB pool (debug:
            # coarsenReads=5 + concurrent zoom → 30s "pool exhausted" 500s).
            if (
                len(clusters) > GRID_CLUSTER_HARD_CAP
                and served_level > CLUSTER_MAX_ZOOM_THRESHOLD
            ):
                served_level = CLUSTER_MAX_ZOOM_THRESHOLD
                clusters = self._repository.get_grid_clusters_from_gold(
                    served_level,
                    bbox,
                    region_id=region_id,
                    province_id=province_id,
                    municipality_id=municipality_id,
                    clip_wkt=clip_wkt,
                )
            if (
                len(clusters) > GRID_CLUSTER_HARD_CAP
                and muni_admin
                and len(muni_admin) < len(clusters)
            ):
                return self._admin_features_collection(muni_admin)
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
        clip_wkt: str | None = None,
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
        # Draw clip: region/province centroids rarely fall inside a sketch;
        # serve municipality units whose extent intersects the polygon.
        if clip_wkt and level in {"region", "province"}:
            level = "municipality"
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
                # cluster (gold rows for coarser levels null out child ids,
                # so the scope filter would otherwise return empty).
                level = scope_floor
            elif _ADMIN_RANK[level] == _ADMIN_RANK[scope_floor]:
                # Zoom matches the selected unit: show children instead of a
                # single "self" cluster — but only when zoomed in enough.
                # Province→municipality used to bump for the whole province band
                # (z8–12), flooding the map with ~50 M* markers (debug: zoom
                # 11.2 province_id=75 → 52 clusters). Keep one P* until the
                # municipality band. Circoscrizioni stay near the grid handoff.
                child = _ADMIN_CHILDREN.get(scope_floor)
                child_min_zoom = {
                    "province": ADMIN_LEVEL_PROVINCE_MAX_ZOOM,
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
            clip_wkt=clip_wkt,
        )
        # National/region municipality payloads (~7.9k markers) flood FE + encode.
        # Roll up to province when unscoped or region-scoped (keep drill into a
        # single province/municipality intact).
        if (
            level == "municipality"
            and len(clusters) > ADMIN_MUNICIPALITY_HARD_CAP
            and (scope_floor is None or scope_floor == "region")
            and not clip_wkt
        ):
            level = "province"
            clusters = self._repository.get_admin_clusters_in_bbox(
                level,
                bbox,
                region_id=region_id,
                province_id=province_id,
                municipality_id=municipality_id,
                sub_municipal_area_id=sub_municipal_area_id,
                clip_wkt=clip_wkt,
            )
        # Empty admin must not short-circuit the viewport: callers treat any
        # FeatureCollection (including empty) as final. Fall through to grid/raw
        # when gold has no rows for the resolved ingest window (multi-snapshot).
        if not clusters:
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

    @staticmethod
    def _admin_features_collection(clusters: list[ViewportCluster]) -> GeoJSONFeatureCollection:
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
        municipality_id: int | None = None,
    ) -> GreenDetailOut:
        row = self._repository.get_detail_by_pk(
            asset_id,
            region_id,
            province_id,
            municipality_id=municipality_id,
        )
        if row is None:
            raise NotFoundError()
        # Single silver read: bbox/geometry derived from the same row (was 3×
        # province-wide Parquet scans ≈1.2s each path).
        from territory.common.infrastructure.lakehouse import silver_read

        bbox = silver_read.read_asset_bbox(row)
        geometry = silver_read.read_asset_geometry(row)
        out = build_asset_detail(row, bbox=bbox, geometry=geometry)
        return out

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
        raw, total = self._repository.list_table_rows_paged(
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
        enriched = [merge_asset_table_row(r) for r in raw] if raw else raw
        return GreenTablePageOut.build(data=enriched, total=total, page=page, page_size=page_size)
