"""Green areas repository (SQLAlchemy ORM)."""

from collections.abc import Callable

from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Session

from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.geo.domain.entities.sub_municipal_area_model import SubMunicipalAreaModel
from territory.areas.infrastructure.mapper import build_green_area_feature_collection
from territory.areas.domain.entities.green_area_model import GreenAreaModel


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

