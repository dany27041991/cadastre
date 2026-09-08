"""Green areas repository backed by lakehouse Parquet (MinIO + DuckDB)."""

from __future__ import annotations

from collections.abc import Callable
from datetime import date
from typing import Any, Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from territory.areas.infrastructure.mapper import build_green_area_feature_collection
from territory.common.infrastructure.lakehouse import silver_read
from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.geo.domain.entities.sub_municipal_area_model import SubMunicipalAreaModel

_EMPTY_FC: GeoJSONFeatureCollection = {"type": "FeatureCollection", "features": []}


class GreenAreasLakehouseRepository:
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
            dataset="areas",
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
        if municipality_id is not None:
            return None
        from territory.common.infrastructure.lakehouse import clip_exact

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
        """Load sub-municipal shapely geometry from PostGIS admin reference data."""
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

    def get_by_pk(
        self,
        area_id: int,
        region_id: int,
        province_id: int,
    ) -> dict[str, Any] | None:
        return silver_read.read_area_by_pk(
            self._resolutions(region_id=region_id, province_id=province_id),
            area_id,
            region_id,
            province_id,
        )

    def get_detail_by_pk(
        self,
        area_id: int,
        region_id: int,
        province_id: int,
    ) -> dict[str, Any] | None:
        return self.get_by_pk(area_id, region_id, province_id)

    def get_bbox_by_pk(
        self,
        area_id: int,
        region_id: int,
        province_id: int,
    ) -> list[float] | None:
        row = self.get_by_pk(area_id, region_id, province_id)
        if row is None:
            return None
        return silver_read.read_asset_bbox(row)

    def get_geometry_by_pk(
        self,
        area_id: int,
        region_id: int,
        province_id: int,
    ) -> dict[str, Any] | None:
        row = self.get_by_pk(area_id, region_id, province_id)
        if row is None:
            return None
        return silver_read.read_asset_geometry(row)

    def get_roots_in_bbox(
        self,
        bbox: tuple[float, float, float, float],
        simplify_tolerance_deg: float,
        limit: int,
        region_id: int | None = None,
        province_id: int | None = None,
        municipality_id: int | None = None,
        sub_municipal_area_id: int | None = None,
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
        clip_geom = silver_read._parse_clip_geom(clip_wkt)
        if sub_municipal_area_id is not None and municipality_id is not None:
            sub = self._load_sub_municipal_geom(municipality_id, sub_municipal_area_id)
            if sub is None:
                return _EMPTY_FC
            clip_geom = sub if clip_geom is None else clip_geom.intersection(sub)
            if clip_geom.is_empty:
                return _EMPTY_FC
        rows = silver_read.read_areas_in_bbox(
            resolutions,
            bbox,
            limit,
            clip_geom=clip_geom,
            simplify_tolerance_deg=simplify_tolerance_deg,
        )
        return build_green_area_feature_collection(rows)

    def get_by_parent(self, parent_id: int, region_id: int) -> GeoJSONFeatureCollection:
        resolutions = self._resolutions(region_id=region_id)
        if not resolutions:
            return _EMPTY_FC
        rows = silver_read.read_areas_by_parent(
            resolutions, parent_id=parent_id, region_id=region_id
        )
        return build_green_area_feature_collection(rows)

    def get_roots_by_municipality(
        self,
        municipality_id: int,
        region_id: int,
        province_id: int,
    ) -> GeoJSONFeatureCollection:
        resolutions = self._resolutions(
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
        )
        if not resolutions:
            return _EMPTY_FC
        rows = silver_read.read_area_roots(
            resolutions,
            municipality_id=municipality_id,
            region_id=region_id,
            province_id=province_id,
        )
        return build_green_area_feature_collection(rows)

    def get_roots_by_municipality_intersecting_sub_municipal_area(
        self,
        municipality_id: int,
        region_id: int,
        province_id: int,
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
        rows = silver_read.read_area_roots_intersecting_geom(
            resolutions,
            municipality_id=municipality_id,
            region_id=region_id,
            province_id=province_id,
            clip_geom=clip,
        )
        return build_green_area_feature_collection(rows)

    def get_contained_or_intersecting_area(
        self,
        area_id: int,
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
        rows = silver_read.read_areas_contained_or_intersecting(
            resolutions,
            area_id=area_id,
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
        )
        return build_green_area_feature_collection(rows)

    def list_table_rows_paged(
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
    ) -> tuple[list[dict], int]:
        resolutions = self._resolutions(
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
        )
        id_allowlist: list[int] | None = None
        # Prefer exact / parent / contained scopes; then sub-municipal / clip as id allow-lists.
        if (
            area_id is None
            and parent_id is None
            and contained_in_area_id is None
            and municipality_id is not None
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
                rows = silver_read.read_area_roots_intersecting_geom(
                    resolutions,
                    municipality_id=municipality_id,
                    region_id=region_id,
                    province_id=province_id,
                    clip_geom=clip_geom,
                )
                id_allowlist = [int(r[0]) for r in rows]
        return silver_read.list_areas_table(
            resolutions,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_dir=sort_dir,
            filters=filters,
            area_id=area_id,
            parent_id=parent_id,
            contained_in_area_id=contained_in_area_id,
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
            id_allowlist=id_allowlist,
        )
