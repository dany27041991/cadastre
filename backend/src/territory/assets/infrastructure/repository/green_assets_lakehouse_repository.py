"""Green assets repository backed by lakehouse Parquet (MinIO + DuckDB)."""

from __future__ import annotations

import logging
import math
from collections.abc import Callable
from datetime import date
from typing import Any, Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from territory.assets.infrastructure.mapper import build_green_asset_feature_collection
from territory.assets.infrastructure.repository.viewport_cluster import ViewportCluster
from territory.common.infrastructure.lakehouse import gold_read, silver_read
from territory.common.infrastructure.lakehouse.gold_read import (
    CLUSTER_GRID_MAX_REFINE_ZOOM,
    CLUSTER_MAX_ZOOM_THRESHOLD,
)
from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.geo.domain.entities.sub_municipal_area_model import SubMunicipalAreaModel

logger = logging.getLogger(__name__)

_EMPTY_FC: GeoJSONFeatureCollection = {"type": "FeatureCollection", "features": []}

# Mirror viewport_grid.grid_cell_size_m for live-grid → gold band mapping (no app-layer import).
_WEB_MERCATOR_BASE = 156543.03392804097
_GRID_REF_LAT = 41.9
_CLUSTER_DISTANCE_AT_16 = 80.0


def _grid_cell_size_m(zoom: float) -> float:
    z = min(max(int(zoom), CLUSTER_MAX_ZOOM_THRESHOLD), CLUSTER_GRID_MAX_REFINE_ZOOM)
    scale = _WEB_MERCATOR_BASE * math.cos(math.radians(_GRID_REF_LAT))
    return (scale / 2**z) * _CLUSTER_DISTANCE_AT_16


def _zoom_level_for_cell_size(cell_size_m: float) -> int:
    """Best-effort map of live-grid cell size back to a gold zoom band."""
    best_z = CLUSTER_MAX_ZOOM_THRESHOLD
    best_delta = float("inf")
    for z in range(CLUSTER_MAX_ZOOM_THRESHOLD, CLUSTER_GRID_MAX_REFINE_ZOOM + 1):
        delta = abs(_grid_cell_size_m(float(z)) - cell_size_m)
        if delta < best_delta:
            best_delta = delta
            best_z = z
    return best_z


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
        """Prune lakehouse files to municipalities intersecting clip or viewport.

        Intersects PostGIS against **catalog** municipality ids (not a LIMIT on
        all Italian comuni). A nationwide LIMIT 500 previously dropped whole
        regions outside the first N rows.
        """
        if municipality_id is not None:
            return None  # resolve_prefixes already scopes to the single id
        from territory.common.infrastructure.lakehouse import clip_exact

        # Catalog candidates in the date window (scoped by region/province if set).
        catalog = self._resolutions(
            region_id=region_id,
            province_id=province_id,
            municipality_id=None,
            municipality_ids=None,
        )
        candidates = [int(r.municipality_id) for r in catalog]
        if not candidates:
            return []
        with self._session_factory() as session:
            if clip_wkt:
                return clip_exact.municipalities_intersecting_clip(
                    session,
                    clip_wkt,
                    limit=max(len(candidates), 1),
                    candidate_ids=candidates,
                )
            return clip_exact.municipalities_intersecting_bbox(
                session,
                bbox,
                limit=max(len(candidates), 1),
                candidate_ids=candidates,
            )

    def _load_sub_municipal_geom(self, municipality_id: int, sub_municipal_area_id: int):
        from shapely import wkb as shapely_wkb

        stmt = (
            select(func.ST_AsBinary(SubMunicipalAreaModel.geometry))
            .where(SubMunicipalAreaModel.id == sub_municipal_area_id)
            .where(SubMunicipalAreaModel.municipality_id == municipality_id)
            .where(SubMunicipalAreaModel.geometry.isnot(None))
            .limit(1)
        )
        with self._session_factory() as session:
            raw = session.execute(stmt).scalar()
        if raw is None:
            return None
        try:
            return shapely_wkb.loads(bytes(raw))
        except Exception:
            return None

    def _resolve_clip_geom(
        self,
        *,
        municipality_id: int | None,
        sub_municipal_area_id: int | None,
        clip_wkt: str | None,
    ):
        """Combine draw clip + sub-municipal geometry; empty → sentinel None (caller returns empty)."""
        clip_geom = silver_read._parse_clip_geom(clip_wkt)
        if sub_municipal_area_id is not None:
            if municipality_id is None:
                return None
            sub = self._load_sub_municipal_geom(municipality_id, sub_municipal_area_id)
            if sub is None:
                return None
            clip_geom = sub if clip_geom is None else clip_geom.intersection(sub)
            if clip_geom is None or clip_geom.is_empty:
                return None
        return clip_geom

    @staticmethod
    def _filter_clusters_by_clip(
        clusters: list[ViewportCluster],
        clip_geom,
    ) -> list[ViewportCluster]:
        if clip_geom is None:
            return clusters
        from shapely.geometry import Point, box

        out: list[ViewportCluster] = []
        for c in clusters:
            if c.lon is not None and c.lat is not None:
                if clip_geom.intersects(Point(float(c.lon), float(c.lat))):
                    out.append(c)
                continue
            # Grid clusters: keep if cell envelope intersects clip.
            try:
                if box(c.bbox[0], c.bbox[1], c.bbox[2], c.bbox[3]).intersects(clip_geom):
                    out.append(c)
            except Exception:
                continue
        return out

    def get_by_pk(
        self,
        asset_id: int,
        region_id: int,
        province_id: int,
    ) -> dict[str, Any] | None:
        return silver_read.read_asset_by_pk(
            self._resolutions(region_id=region_id, province_id=province_id),
            asset_id,
            region_id,
            province_id,
        )

    def get_detail_by_pk(
        self,
        asset_id: int,
        region_id: int,
        province_id: int,
    ) -> dict[str, Any] | None:
        return self.get_by_pk(asset_id, region_id, province_id)

    def get_bbox_by_pk(
        self,
        asset_id: int,
        region_id: int,
        province_id: int,
    ) -> list[float] | None:
        row = self.get_by_pk(asset_id, region_id, province_id)
        if row is None:
            return None
        return silver_read.read_asset_bbox(row)

    def get_geometry_by_pk(
        self,
        asset_id: int,
        region_id: int,
        province_id: int,
    ) -> dict[str, Any] | None:
        row = self.get_by_pk(asset_id, region_id, province_id)
        if row is None:
            return None
        return silver_read.read_asset_geometry(row)

    def get_within_area(
        self,
        region_id: int,
        province_id: int,
        municipality_id: int,
        green_area_id: int,
    ) -> GeoJSONFeatureCollection:
        resolutions = self._resolutions(
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
        )
        if not resolutions:
            return _EMPTY_FC
        rows = silver_read.read_assets_catalog(
            resolutions,
            municipality_id=municipality_id,
            region_id=region_id,
            province_id=province_id,
            green_area_id=green_area_id,
        )
        return build_green_asset_feature_collection(rows)

    def get_within_municipality(
        self,
        region_id: int,
        province_id: int,
        municipality_id: int,
    ) -> GeoJSONFeatureCollection:
        resolutions = self._resolutions(
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
        )
        if not resolutions:
            return _EMPTY_FC
        rows = silver_read.read_assets_catalog(
            resolutions,
            municipality_id=municipality_id,
            region_id=region_id,
            province_id=province_id,
        )
        return build_green_asset_feature_collection(rows)

    def get_within_municipality_intersecting_sub_municipal_area(
        self,
        region_id: int,
        province_id: int,
        municipality_id: int,
        sub_municipal_area_id: int,
    ) -> GeoJSONFeatureCollection:
        resolutions = self._resolutions(
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
        )
        if not resolutions:
            return _EMPTY_FC
        clip = self._load_sub_municipal_geom(municipality_id, sub_municipal_area_id)
        if clip is None:
            return _EMPTY_FC
        rows = silver_read.read_assets_intersecting_geom(
            resolutions,
            municipality_id=municipality_id,
            region_id=region_id,
            province_id=province_id,
            clip_geom=clip,
        )
        return build_green_asset_feature_collection(rows)

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
    ) -> list[ViewportCluster] | None:
        """Return exact clusters, empty list if over-cap, or None to fall back to gold."""
        from core.config import settings
        from territory.common.infrastructure.lakehouse import clip_exact, clip_exact_flag

        clip_geom = silver_read._parse_clip_geom(clip_wkt)
        if clip_geom is None:
            return None
        with self._session_factory() as session:
            decision = clip_exact.evaluate_clip_exact_cap(
                session,
                clip_geom,
                clip_wkt,
                max_municipalities=settings.clip_exact_max_municipalities,
                max_km2=settings.clip_exact_max_km2,
                enabled=settings.clip_exact_clusters_enabled,
            )
        if not decision.eligible:
            clip_exact_flag.mark_cluster_over_cap()
            logger.info(
                "clip_exact over_cap reason=%s km2=%.1f",
                decision.reason,
                decision.km2,
            )
            return []
        if not decision.municipality_ids:
            return []
        from territory.common.infrastructure.lakehouse.catalog import resolve_latest_ingests

        if self._date_from is None or self._date_to is None:
            return []
        resolutions = resolve_latest_ingests(
            dataset="assets",
            date_from=self._date_from,
            date_to=self._date_to,
            municipality_ids=list(decision.municipality_ids),
        )
        if region_id is not None:
            resolutions = [r for r in resolutions if r.region_id == region_id]
        if province_id is not None:
            resolutions = [r for r in resolutions if r.province_id == province_id]
        if municipality_id is not None:
            resolutions = [r for r in resolutions if r.municipality_id == municipality_id]
        if not resolutions:
            return []
        return silver_read.aggregate_assets_in_clip(
            resolutions,
            clip_geom,
            mode=mode,  # type: ignore[arg-type]
            cell_size_m=cell_size_m,
            view_bbox=bbox,
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
    ) -> list[ViewportCluster]:
        # V1 gold has municipality bands only; sub_municipal falls through to grid.
        if level == "sub_municipal":
            return []
        if clip_wkt:
            # Draw clip: exact municipality counts inside polygon (soft-capped).
            exact = self._exact_clusters_for_clip(
                clip_wkt=clip_wkt,
                mode="municipality",
                bbox=bbox,
                region_id=region_id,
                province_id=province_id,
                municipality_id=municipality_id,
            )
            if exact is not None:
                return exact
        view_muni_ids = self._municipality_ids_for_view(
            bbox=bbox,
            clip_wkt=None,
            municipality_id=municipality_id,
            region_id=region_id,
            province_id=province_id,
        )
        if municipality_id is None and view_muni_ids is not None and not view_muni_ids:
            return []
        resolutions = self._resolutions(
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
            municipality_ids=view_muni_ids,
        )
        if not resolutions:
            return []
        clusters = gold_read.read_admin_clusters(resolutions, level, bbox)  # type: ignore[arg-type]
        clip_geom = self._resolve_clip_geom(
            municipality_id=municipality_id,
            sub_municipal_area_id=sub_municipal_area_id,
            clip_wkt=clip_wkt,
        )
        # Missing sub-municipal geom → empty; plain None clip → no filter.
        if sub_municipal_area_id is not None and clip_geom is None:
            return []
        return self._filter_clusters_by_clip(clusters, clip_geom)

    def get_raw_in_bbox(
        self,
        bbox: tuple[float, float, float, float],
        limit: int,
        region_id: int | None = None,
        province_id: int | None = None,
        municipality_id: int | None = None,
        sub_municipal_area_id: int | None = None,
        green_area_id: int | None = None,
        clip_wkt: str | None = None,
    ) -> GeoJSONFeatureCollection:
        view_muni_ids = self._municipality_ids_for_view(
            bbox=bbox,
            clip_wkt=clip_wkt,
            municipality_id=municipality_id,
            region_id=region_id,
            province_id=province_id,
        )
        if municipality_id is None and view_muni_ids is not None and not view_muni_ids:
            return _EMPTY_FC
        resolutions = self._resolutions(
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
            municipality_ids=view_muni_ids,
        )
        if not resolutions:
            return _EMPTY_FC
        clip_geom = self._resolve_clip_geom(
            municipality_id=municipality_id,
            sub_municipal_area_id=sub_municipal_area_id,
            clip_wkt=clip_wkt,
        )
        if sub_municipal_area_id is not None and clip_geom is None:
            return _EMPTY_FC
        rows = silver_read.read_assets_in_bbox(
            resolutions,
            bbox,
            limit,
            green_area_id=green_area_id,
            clip_geom=clip_geom,
        )
        return build_green_asset_feature_collection(rows)

    def get_grid_clusters_from_gold(
        self,
        zoom_level: int,
        bbox: tuple[float, float, float, float],
        region_id: int | None = None,
        province_id: int | None = None,
        municipality_id: int | None = None,
        clip_wkt: str | None = None,
    ) -> list[ViewportCluster]:
        """Pre-aggregated grid clusters from gold Parquet (`grid_{zoom_level}`)."""
        if clip_wkt:
            exact = self._exact_clusters_for_clip(
                clip_wkt=clip_wkt,
                mode="grid",
                bbox=bbox,
                cell_size_m=_grid_cell_size_m(float(zoom_level)),
                region_id=region_id,
                province_id=province_id,
                municipality_id=municipality_id,
            )
            if exact is not None:
                return exact
        view_muni_ids = self._municipality_ids_for_view(
            bbox=bbox,
            clip_wkt=None,
            municipality_id=municipality_id,
            region_id=region_id,
            province_id=province_id,
        )
        if municipality_id is None and view_muni_ids is not None and not view_muni_ids:
            return []
        resolutions = self._resolutions(
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
            municipality_ids=view_muni_ids,
        )
        if not resolutions:
            return []
        clusters = gold_read.read_grid_clusters(resolutions, zoom_level, bbox)
        clip_geom = silver_read._parse_clip_geom(clip_wkt)
        return self._filter_clusters_by_clip(clusters, clip_geom)

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
    ) -> list[ViewportCluster]:
        # Live-grid scopes: gold band + geometric clip/sub-municipal filter.
        if clip_wkt and sub_municipal_area_id is None and green_area_id is None:
            exact = self._exact_clusters_for_clip(
                clip_wkt=clip_wkt,
                mode="grid",
                bbox=bbox,
                cell_size_m=cell_size_m,
                region_id=region_id,
                province_id=province_id,
                municipality_id=municipality_id,
            )
            if exact is not None:
                return exact
        resolutions = self._resolutions(
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
        )
        if not resolutions:
            return []
        clusters = gold_read.read_grid_clusters(
            resolutions,
            _zoom_level_for_cell_size(cell_size_m),
            bbox,
        )
        clip_geom = self._resolve_clip_geom(
            municipality_id=municipality_id,
            sub_municipal_area_id=sub_municipal_area_id,
            clip_wkt=clip_wkt,
        )
        if sub_municipal_area_id is not None and clip_geom is None:
            return []
        # green_area_id not applied on gold aggregates (no per-asset join in V1).
        _ = green_area_id
        return self._filter_clusters_by_clip(clusters, clip_geom)
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
    ) -> tuple[list[dict], int]:
        resolutions = self._resolutions(
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
        )
        id_allowlist: list[int] | None = None
        if (
            municipality_id is not None
            and region_id is not None
            and province_id is not None
            and (sub_municipal_area_id is not None or clip_wkt)
        ):
            clip_geom = silver_read._parse_clip_geom(clip_wkt)
            if sub_municipal_area_id is not None:
                sub = self._load_sub_municipal_geom(municipality_id, sub_municipal_area_id)
                if sub is None:
                    return [], 0
                clip_geom = sub if clip_geom is None else clip_geom.intersection(sub)
                if clip_geom is None or clip_geom.is_empty:
                    return [], 0
            if clip_geom is not None:
                rows = silver_read.read_assets_intersecting_geom(
                    resolutions,
                    municipality_id=municipality_id,
                    region_id=region_id,
                    province_id=province_id,
                    clip_geom=clip_geom,
                )
                id_allowlist = [int(r[0]) for r in rows]
        return silver_read.list_assets_table(
            resolutions,
            page=page,
            page_size=page_size,
            green_area_id=green_area_id,
            id_allowlist=id_allowlist,
            sort_by=sort_by,
            sort_dir=sort_dir,
            filters=filters,
        )
