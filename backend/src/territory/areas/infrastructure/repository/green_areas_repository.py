"""Green areas repository (SQLAlchemy ORM)."""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any, Literal

from geoalchemy2 import Geography
from sqlalchemy import ColumnElement, String, cast, or_, select, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Session, load_only

from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.geo.domain.entities.sub_municipal_area_model import SubMunicipalAreaModel
from territory.areas.infrastructure.mapper import build_green_area_feature_collection
from territory.areas.domain.entities.green_area_model import GreenAreaModel
from territory.common.infrastructure.table_serialization import orm_to_row_dict

# Minimum geodesic overlap (m²) between candidate and selected area; excludes boundary-only adjacency.
_MIN_GREEN_AREA_INTERSECTION_M2 = 1.0

# Columns excluded from table-view queries: geometry (fetched but already skipped by orm_to_row_dict),
# attributes and media (heavy JSONB blobs not needed in list APIs).
_TABLE_EXCLUDE_COLS: frozenset[str] = frozenset({"attributes", "media"})

# Explicit column list for load_only — all scalar columns except geometry, attributes and media.
_TABLE_LOAD_COLS = (
    GreenAreaModel.id,
    GreenAreaModel.region_id,
    GreenAreaModel.province_id,
    GreenAreaModel.municipality_id,
    GreenAreaModel.level_id,
    GreenAreaModel.parent_id,
    GreenAreaModel.name,
    GreenAreaModel.attribute_type_id,
    GreenAreaModel.zril_identifier,
    GreenAreaModel.susceptibility_classification_area_id,
    GreenAreaModel.area_classification,
    GreenAreaModel.istat_classification,
    GreenAreaModel.intensity_of_fruition,
    GreenAreaModel.geometry_type,
    GreenAreaModel.perimeter_type,
    GreenAreaModel.administrative_status,
    GreenAreaModel.operational_status,
    GreenAreaModel.survey_status,
    GreenAreaModel.valid_from,
    GreenAreaModel.valid_to,
    GreenAreaModel.start_date_of_management,
    GreenAreaModel.end_date_of_management,
    GreenAreaModel.survey_date,
    GreenAreaModel.last_update_at,
    GreenAreaModel.deleted_at,
    GreenAreaModel.last_modified_by,
    GreenAreaModel.note,
    GreenAreaModel.level,
    GreenAreaModel.created_at,
    GreenAreaModel.updated_at,
)

_AREA_SORT_MAP: dict[str, Any] = {col.key: col for col in _TABLE_LOAD_COLS}
_AREA_SORT_MAP["area_code"] = GreenAreaModel.zril_identifier

# Exact-match (API / non-catalog). Catalog enums use ILIKE cast below.
_AREA_EXACT_FILTER_COLS = (
    "geometry_type",
    "administrative_status",
    "operational_status",
    "survey_status",
    "level",
)

_AREA_ILIKE_FILTER_COLS = ("name", "zril_identifier")

# Catalog enum/status fields: free-text partial match.
_AREA_ILIKE_CAST_COLS = (
    "perimeter_type",
    "intensity_of_fruition",
    "area_classification",
    "istat_classification",
)


def _build_area_filter_conditions(
    ar: type[GreenAreaModel], filters: dict[str, Any]
) -> list[ColumnElement[bool]]:
    conditions: list[ColumnElement[bool]] = []
    for col_name in _AREA_EXACT_FILTER_COLS:
        val = filters.get(col_name)
        if val is not None and val != "":
            conditions.append(getattr(ar, col_name) == val)
    for col_name in _AREA_ILIKE_FILTER_COLS:
        val = filters.get(col_name)
        if val:
            conditions.append(getattr(ar, col_name).ilike(f"%{val}%"))
    for col_name in _AREA_ILIKE_CAST_COLS:
        val = filters.get(col_name)
        if val:
            conditions.append(cast(getattr(ar, col_name), String).ilike(f"%{val}%"))
    area_code = filters.get("area_code")
    if area_code:
        conditions.append(ar.zril_identifier.ilike(f"%{area_code}%"))
    survey_date = filters.get("survey_date")
    if survey_date:
        conditions.append(cast(ar.survey_date, String).ilike(f"%{survey_date}%"))
    surface = filters.get("surface_area_m2")
    if surface:
        attr_surface = ar.attributes.op("->>")("surface_area_m2")
        st_area_txt = cast(func.ST_Area(cast(ar.geometry, Geography)), String)
        conditions.append(
            or_(
                attr_surface.ilike(f"%{surface}%"),
                st_area_txt.ilike(f"%{surface}%"),
            )
        )
    q = filters.get("q")
    if q:
        # Search across all free-text fields; mirrors the or_() pattern used for assets.
        conditions.append(
            or_(
                GreenAreaModel.name.ilike(f"%{q}%"),
                GreenAreaModel.zril_identifier.ilike(f"%{q}%"),
                GreenAreaModel.note.ilike(f"%{q}%"),
            )
        )
    return conditions


class GreenAreasRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def get_by_pk(
        self,
        area_id: int,
        region_id: int,
        province_id: int,
    ) -> dict[str, Any] | None:
        """Load one green area by composite PK; excludes soft-deleted rows."""
        ar = GreenAreaModel
        stmt = (
            select(ar)
            .options(load_only(*_TABLE_LOAD_COLS, raiseload=True))
            .where(ar.region_id == region_id)
            .where(ar.province_id == province_id)
            .where(ar.id == area_id)
            .where(ar.deleted_at.is_(None))
            .limit(1)
        )
        with self._session_factory() as session:
            row = session.scalars(stmt).first()
            if row is None:
                return None
            return orm_to_row_dict(ar, row, exclude=_TABLE_EXCLUDE_COLS)

    def get_detail_by_pk(
        self,
        area_id: int,
        region_id: int,
        province_id: int,
    ) -> dict[str, Any] | None:
        """Load detail fields + attributes + geodesic area (m²) for the map panel."""
        ar = GreenAreaModel
        area_m2 = func.ST_Area(cast(ar.geometry, Geography)).label(
            "surface_area_m2_computed"
        )
        stmt = (
            select(
                ar.id,
                ar.region_id,
                ar.province_id,
                ar.municipality_id,
                ar.name,
                ar.zril_identifier,
                ar.area_classification,
                ar.istat_classification,
                ar.intensity_of_fruition,
                ar.perimeter_type,
                ar.survey_date,
                ar.attributes,
                area_m2,
            )
            .where(ar.region_id == region_id)
            .where(ar.province_id == province_id)
            .where(ar.id == area_id)
            .where(ar.deleted_at.is_(None))
            .limit(1)
        )
        with self._session_factory() as session:
            row = session.execute(stmt).mappings().first()
            if row is None:
                return None
            return dict(row)

    def get_bbox_by_pk(
        self,
        area_id: int,
        region_id: int,
        province_id: int,
    ) -> list[float] | None:
        """WGS84 envelope [minLon, minLat, maxLon, maxLat] for map framing."""
        ar = GreenAreaModel
        env = func.ST_Envelope(ar.geometry)
        stmt = (
            select(
                func.ST_XMin(env),
                func.ST_YMin(env),
                func.ST_XMax(env),
                func.ST_YMax(env),
            )
            .where(ar.region_id == region_id)
            .where(ar.province_id == province_id)
            .where(ar.id == area_id)
            .where(ar.deleted_at.is_(None))
            .where(ar.geometry.isnot(None))
            .limit(1)
        )
        with self._session_factory() as session:
            row = session.execute(stmt).first()
            if row is None or any(v is None for v in row):
                return None
            return [float(row[0]), float(row[1]), float(row[2]), float(row[3])]

    def get_geometry_by_pk(
        self,
        area_id: int,
        region_id: int,
        province_id: int,
    ) -> dict[str, Any] | None:
        """WGS84 GeoJSON geometry for true-shape map highlight."""
        ar = GreenAreaModel
        stmt = (
            select(func.ST_AsGeoJSON(ar.geometry).cast(JSON))
            .where(ar.region_id == region_id)
            .where(ar.province_id == province_id)
            .where(ar.id == area_id)
            .where(ar.deleted_at.is_(None))
            .where(ar.geometry.isnot(None))
            .limit(1)
        )
        with self._session_factory() as session:
            raw = session.execute(stmt).scalar_one_or_none()
            if raw is None:
                return None
            if isinstance(raw, dict):
                return raw
            if isinstance(raw, str):
                parsed = json.loads(raw)
                return parsed if isinstance(parsed, dict) else None
            return None

    def _select_geojson(self):
        return select(
            GreenAreaModel.id,
            func.ST_AsGeoJSON(GreenAreaModel.geometry).cast(JSON).label("geometry"),
            GreenAreaModel.name,
            GreenAreaModel.level,
            GreenAreaModel.parent_id,
            GreenAreaModel.region_id,
            GreenAreaModel.province_id,
            GreenAreaModel.municipality_id,
        ).where(GreenAreaModel.geometry.isnot(None))

    def get_roots_in_bbox(
        self,
        bbox: tuple[float, float, float, float],
        simplify_tolerance_deg: float,
        limit: int,
        region_id: int | None = None,
        province_id: int | None = None,
        municipality_id: int | None = None,
        sub_municipal_area_id: int | None = None,
    ) -> GeoJSONFeatureCollection:
        """Root green areas intersecting the bbox (viewport map rendering).

        Geometries are simplified to the display resolution (tolerance in
        degrees ≈ 1px at the requested zoom) so payload size tracks the screen,
        not the source precision. Largest areas first when the cap is hit.
        sub_municipal_area_id restricts to areas intersecting that sub-area.
        """
        ar = GreenAreaModel
        envelope = func.ST_MakeEnvelope(bbox[0], bbox[1], bbox[2], bbox[3], 4326)
        geometry_out = func.ST_AsGeoJSON(
            func.ST_SimplifyPreserveTopology(ar.geometry, simplify_tolerance_deg)
        ).cast(JSON)
        stmt = (
            select(
                ar.id,
                geometry_out.label("geometry"),
                ar.name,
                ar.level,
                ar.parent_id,
                ar.region_id,
                ar.province_id,
                ar.municipality_id,
            )
            .where(ar.geometry.isnot(None))
            .where(ar.parent_id.is_(None))
            .where(ar.geometry.intersects(envelope))
            .order_by(func.ST_Area(ar.geometry).desc())
            .limit(limit)
        )
        if region_id is not None:
            stmt = stmt.where(ar.region_id == region_id)
        if province_id is not None:
            stmt = stmt.where(ar.province_id == province_id)
        if municipality_id is not None:
            stmt = stmt.where(ar.municipality_id == municipality_id)
        if sub_municipal_area_id is not None:
            sub_geom = (
                select(SubMunicipalAreaModel.geometry)
                .where(SubMunicipalAreaModel.id == sub_municipal_area_id)
                .where(SubMunicipalAreaModel.geometry.isnot(None))
                .limit(1)
                .scalar_subquery()
            )
            stmt = stmt.where(func.ST_Intersects(ar.geometry, sub_geom))
        with self._session_factory() as session:
            rows = self._rows_from_session(session, stmt)
        return build_green_area_feature_collection(rows)

    def _rows_from_session(self, session: Session, stmt) -> list[tuple]:
        result = session.execute(stmt)
        return [tuple(row) for row in result.all()]

    def get_by_parent(self, parent_id: int, region_id: int) -> GeoJSONFeatureCollection:
        """Children of a given parent area. WHERE region_id AND province_id first for partition pruning."""
        province_subq = (
            select(GreenAreaModel.province_id)
            .where(GreenAreaModel.id == parent_id)
            .where(GreenAreaModel.region_id == region_id)
            .limit(1)
            .scalar_subquery()
        )
        stmt = (
            self._select_geojson()
            .where(GreenAreaModel.region_id == region_id)
            .where(GreenAreaModel.province_id == province_subq)
            .where(GreenAreaModel.parent_id == parent_id)
        )
        with self._session_factory() as session:
            rows = self._rows_from_session(session, stmt)
        return build_green_area_feature_collection(rows)

    def get_roots_by_municipality(
        self, municipality_id: int, region_id: int, province_id: int
    ) -> GeoJSONFeatureCollection:
        """Root areas for a municipality. WHERE region_id AND province_id first for partition pruning.
        province_id is required so the planner can prune and use indexes without a subquery."""
        stmt = (
            self._select_geojson()
            .where(GreenAreaModel.region_id == region_id)
            .where(GreenAreaModel.province_id == province_id)
            .where(GreenAreaModel.municipality_id == municipality_id)
            .where(GreenAreaModel.parent_id.is_(None))
        )
        with self._session_factory() as session:
            rows = self._rows_from_session(session, stmt)
        return build_green_area_feature_collection(rows)

    def get_roots_by_municipality_intersecting_sub_municipal_area(
        self,
        municipality_id: int,
        region_id: int,
        province_id: int,
        sub_municipal_area_id: int,
    ) -> GeoJSONFeatureCollection:
        """Root areas for a municipality that intersect the given sub-municipal area geometry.
        WHERE region_id and province_id first for partition pruning; then ST_Intersects with public.sub_municipal_area.
        """
        sub_geom = (
            select(SubMunicipalAreaModel.geometry)
            .where(SubMunicipalAreaModel.id == sub_municipal_area_id)
            .where(SubMunicipalAreaModel.municipality_id == municipality_id)
            .where(SubMunicipalAreaModel.geometry.isnot(None))
            .limit(1)
            .scalar_subquery()
        )
        stmt = (
            self._select_geojson()
            .where(GreenAreaModel.region_id == region_id)
            .where(GreenAreaModel.province_id == province_id)
            .where(GreenAreaModel.municipality_id == municipality_id)
            .where(GreenAreaModel.parent_id.is_(None))
            .where(func.ST_Intersects(GreenAreaModel.geometry, sub_geom))
        )
        with self._session_factory() as session:
            rows = self._rows_from_session(session, stmt)
        return build_green_area_feature_collection(rows)

    def get_contained_or_intersecting_area(
        self,
        area_id: int,
        region_id: int,
        province_id: int,
        municipality_id: int,
    ) -> GeoJSONFeatureCollection:
        """Selected area + next-level areas with real overlap (m²), not boundary-only adjacency.

        Returns the chosen polygon first, then level+1 features whose intersection with
        the selected geometry has geodesic area >= _MIN_GREEN_AREA_INTERSECTION_M2.
        """
        area_subq = (
            select(
                GreenAreaModel.geometry,
                GreenAreaModel.level,
            )
            .where(GreenAreaModel.id == area_id)
            .where(GreenAreaModel.region_id == region_id)
            .where(GreenAreaModel.province_id == province_id)
            .where(GreenAreaModel.municipality_id == municipality_id)
            .where(GreenAreaModel.geometry.isnot(None))
            .limit(1)
        )
        area_cte = area_subq.subquery("area_ref")
        intersection_geom = func.ST_Intersection(
            GreenAreaModel.geometry, area_cte.c.geometry
        )
        overlap_m2 = func.ST_Area(cast(intersection_geom, Geography))
        stmt_children = (
            self._select_geojson()
            .select_from(GreenAreaModel, area_cte)
            .where(GreenAreaModel.region_id == region_id)
            .where(GreenAreaModel.province_id == province_id)
            .where(GreenAreaModel.municipality_id == municipality_id)
            .where(GreenAreaModel.id != area_id)
            .where(GreenAreaModel.level == area_cte.c.level + 1)
            .where(func.ST_Intersects(GreenAreaModel.geometry, area_cte.c.geometry))
            .where(overlap_m2 >= _MIN_GREEN_AREA_INTERSECTION_M2)
        )
        stmt_selected = (
            self._select_geojson()
            .where(GreenAreaModel.id == area_id)
            .where(GreenAreaModel.region_id == region_id)
            .where(GreenAreaModel.province_id == province_id)
            .where(GreenAreaModel.municipality_id == municipality_id)
            .where(GreenAreaModel.geometry.isnot(None))
        )
        with self._session_factory() as session:
            selected_rows = self._rows_from_session(session, stmt_selected)
            child_rows = self._rows_from_session(session, stmt_children)
        ordered = list(selected_rows) + list(child_rows)
        return build_green_area_feature_collection(ordered)

    # ------------------------------------------------------------------
    # Paginated + filtered + sorted table query (server-side)
    # ------------------------------------------------------------------

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
        page: int = 1,
        page_size: int = 50,
        sort_by: str | None = None,
        sort_dir: Literal["asc", "desc"] = "asc",
        filters: dict[str, Any] | None = None,
    ) -> tuple[list[dict], int]:
        """Return one page of rows and the total count matching all filters.

        Territory filters are optional: omit them for a nationwide table.
        """
        ar = GreenAreaModel

        # --- Territory WHERE conditions ---
        conditions: list = []
        if region_id is not None:
            conditions.append(ar.region_id == region_id)
        if province_id is not None:
            conditions.append(ar.province_id == province_id)
        if municipality_id is not None:
            conditions.append(ar.municipality_id == municipality_id)
        if area_id is not None:
            # Exact single-area selection (e.g. search hit / leaf detail).
            conditions.append(ar.id == area_id)
        elif parent_id is not None:
            conditions.append(ar.parent_id == parent_id)
        elif contained_in_area_id is not None:
            area_subq = select(ar.geometry, ar.level).where(ar.id == contained_in_area_id)
            if region_id is not None:
                area_subq = area_subq.where(ar.region_id == region_id)
            if province_id is not None:
                area_subq = area_subq.where(ar.province_id == province_id)
            if municipality_id is not None:
                area_subq = area_subq.where(ar.municipality_id == municipality_id)
            area_subq = area_subq.where(ar.geometry.isnot(None)).limit(1)
            area_cte = area_subq.subquery("area_ref")
            intersection_geom = func.ST_Intersection(ar.geometry, area_cte.c.geometry)
            overlap_m2 = func.ST_Area(cast(intersection_geom, Geography))
            conditions += [
                ar.level == area_cte.c.level + 1,
                func.ST_Intersects(ar.geometry, area_cte.c.geometry),
                overlap_m2 >= _MIN_GREEN_AREA_INTERSECTION_M2,
            ]
        elif sub_municipal_area_id is not None:
            sub_geom_stmt = (
                select(SubMunicipalAreaModel.geometry)
                .where(SubMunicipalAreaModel.id == sub_municipal_area_id)
                .where(SubMunicipalAreaModel.geometry.isnot(None))
            )
            if municipality_id is not None:
                sub_geom_stmt = sub_geom_stmt.where(
                    SubMunicipalAreaModel.municipality_id == municipality_id
                )
            sub_geom = sub_geom_stmt.limit(1).scalar_subquery()
            conditions += [
                ar.parent_id.is_(None),
                func.ST_Intersects(ar.geometry, sub_geom),
            ]
        else:
            conditions.append(ar.parent_id.is_(None))

        # --- Column filter conditions ---
        conditions.extend(_build_area_filter_conditions(ar, filters or {}))

        # --- ORDER BY (whitelisted) ---
        sort_col = _AREA_SORT_MAP.get(sort_by or "")
        if sort_col is not None:
            order = sort_col.desc() if sort_dir == "desc" else sort_col.asc()
        else:
            order = ar.id.asc()

        count_stmt = select(func.count(ar.id)).where(*conditions)
        area_m2 = func.ST_Area(cast(ar.geometry, Geography)).label(
            "surface_area_m2_computed"
        )
        data_stmt = (
            select(
                ar.id,
                ar.region_id,
                ar.province_id,
                ar.municipality_id,
                ar.level_id,
                ar.parent_id,
                ar.name,
                ar.attribute_type_id,
                ar.zril_identifier,
                ar.area_classification,
                ar.istat_classification,
                ar.intensity_of_fruition,
                ar.geometry_type,
                ar.perimeter_type,
                ar.administrative_status,
                ar.operational_status,
                ar.survey_status,
                ar.survey_date,
                ar.level,
                ar.attributes,
                area_m2,
            )
            .where(*conditions)
            .order_by(order)
            .limit(page_size)
            .offset((page - 1) * page_size)
        )

        with self._session_factory() as session:
            total: int = session.execute(count_stmt).scalar_one()
            rows = [dict(m) for m in session.execute(data_stmt).mappings()]
        return rows, total

