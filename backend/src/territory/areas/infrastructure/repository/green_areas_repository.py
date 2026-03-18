"""Green areas repository (SQLAlchemy ORM)."""

from collections.abc import Callable

from geoalchemy2 import Geography
from sqlalchemy import cast, select, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Session

from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.geo.domain.entities.sub_municipal_area_model import SubMunicipalAreaModel
from territory.areas.infrastructure.mapper import build_green_area_feature_collection
from territory.areas.domain.entities.green_area_model import GreenAreaModel
from territory.common.infrastructure.table_serialization import orm_to_row_dict

# Minimum geodesic overlap (m²) between candidate and selected area; excludes boundary-only adjacency.
_MIN_GREEN_AREA_INTERSECTION_M2 = 1.0


class GreenAreasRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def _select_geojson(self):
        return select(
            GreenAreaModel.id,
            func.ST_AsGeoJSON(GreenAreaModel.geometry).cast(JSON).label("geometry"),
            GreenAreaModel.name,
            GreenAreaModel.level,
            GreenAreaModel.parent_id,
            GreenAreaModel.region_id,
        ).where(GreenAreaModel.geometry.isnot(None))

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

    def list_table_rows(
        self,
        region_id: int,
        province_id: int,
        *,
        parent_id: int | None = None,
        municipality_id: int | None = None,
        sub_municipal_area_id: int | None = None,
        contained_in_area_id: int | None = None,
    ) -> list[dict]:
        """Same filters as catalog_green_areas; scalar columns for data tables."""
        if contained_in_area_id is not None and municipality_id is not None:
            return self._list_rows_contained_or_intersecting(
                contained_in_area_id, region_id, province_id, municipality_id
            )
        if parent_id is not None:
            return self._list_rows_by_parent(parent_id, region_id)
        if municipality_id is None:
            return []
        if sub_municipal_area_id is not None:
            return self._list_rows_roots_intersecting_sub_municipal(
                municipality_id, region_id, province_id, sub_municipal_area_id
            )
        return self._list_rows_roots_municipality(municipality_id, region_id, province_id)

    def _list_rows_by_parent(self, parent_id: int, region_id: int) -> list[dict]:
        province_subq = (
            select(GreenAreaModel.province_id)
            .where(GreenAreaModel.id == parent_id)
            .where(GreenAreaModel.region_id == region_id)
            .limit(1)
            .scalar_subquery()
        )
        stmt = (
            select(GreenAreaModel)
            .where(GreenAreaModel.region_id == region_id)
            .where(GreenAreaModel.province_id == province_subq)
            .where(GreenAreaModel.parent_id == parent_id)
        )
        with self._session_factory() as session:
            return [orm_to_row_dict(GreenAreaModel, m) for m in session.scalars(stmt)]

    def _list_rows_roots_municipality(
        self, municipality_id: int, region_id: int, province_id: int
    ) -> list[dict]:
        stmt = (
            select(GreenAreaModel)
            .where(GreenAreaModel.region_id == region_id)
            .where(GreenAreaModel.province_id == province_id)
            .where(GreenAreaModel.municipality_id == municipality_id)
            .where(GreenAreaModel.parent_id.is_(None))
        )
        with self._session_factory() as session:
            return [orm_to_row_dict(GreenAreaModel, m) for m in session.scalars(stmt)]

    def _list_rows_roots_intersecting_sub_municipal(
        self,
        municipality_id: int,
        region_id: int,
        province_id: int,
        sub_municipal_area_id: int,
    ) -> list[dict]:
        sub_geom = (
            select(SubMunicipalAreaModel.geometry)
            .where(SubMunicipalAreaModel.id == sub_municipal_area_id)
            .where(SubMunicipalAreaModel.municipality_id == municipality_id)
            .where(SubMunicipalAreaModel.geometry.isnot(None))
            .limit(1)
            .scalar_subquery()
        )
        stmt = (
            select(GreenAreaModel)
            .where(GreenAreaModel.region_id == region_id)
            .where(GreenAreaModel.province_id == province_id)
            .where(GreenAreaModel.municipality_id == municipality_id)
            .where(GreenAreaModel.parent_id.is_(None))
            .where(func.ST_Intersects(GreenAreaModel.geometry, sub_geom))
        )
        with self._session_factory() as session:
            return [orm_to_row_dict(GreenAreaModel, m) for m in session.scalars(stmt)]

    def _list_rows_contained_or_intersecting(
        self,
        area_id: int,
        region_id: int,
        province_id: int,
        municipality_id: int,
    ) -> list[dict]:
        area_subq = (
            select(GreenAreaModel.geometry, GreenAreaModel.level)
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
            select(GreenAreaModel)
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
            select(GreenAreaModel)
            .where(GreenAreaModel.id == area_id)
            .where(GreenAreaModel.region_id == region_id)
            .where(GreenAreaModel.province_id == province_id)
            .where(GreenAreaModel.municipality_id == municipality_id)
        )
        with self._session_factory() as session:
            selected = session.scalars(stmt_selected).first()
            children = list(session.scalars(stmt_children))
        out: list[dict] = []
        if selected is not None:
            out.append(orm_to_row_dict(GreenAreaModel, selected))
        out.extend(orm_to_row_dict(GreenAreaModel, m) for m in children)
        return out

