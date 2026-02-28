"""Green areas repository (SQLAlchemy ORM)."""

from collections.abc import Callable

from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Session

from territory.geo.domain.entities import GeoJSONFeatureCollection, MunicipalityModel
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
        """Children of a given parent area (identified by id + region_id for composite PK)."""
        province_subq = (
            select(GreenAreaModel.province_id)
            .where(GreenAreaModel.id == parent_id)
            .where(GreenAreaModel.region_id == region_id)
            .limit(1)
            .scalar_subquery()
        )
        stmt = (
            self._select_geojson()
            .where(GreenAreaModel.parent_id == parent_id)
            .where(GreenAreaModel.region_id == region_id)
            .where(GreenAreaModel.province_id == province_subq)
        )
        with self._session_factory() as session:
            rows = self._rows_from_session(session, stmt)
        return build_green_area_feature_collection(rows)

    def get_roots_by_municipality(
        self, municipality_id: int, region_id: int
    ) -> GeoJSONFeatureCollection:
        """Root areas for a municipality (no sub-municipal area filter)."""
        province_subq = (
            select(MunicipalityModel.province_id)
            .where(MunicipalityModel.id == municipality_id)
            .limit(1)
            .scalar_subquery()
        )
        stmt = (
            self._select_geojson()
            .where(GreenAreaModel.municipality_id == municipality_id)
            .where(GreenAreaModel.parent_id.is_(None))
            .where(GreenAreaModel.region_id == region_id)
            .where(GreenAreaModel.province_id == province_subq)
        )
        with self._session_factory() as session:
            rows = self._rows_from_session(session, stmt)
        return build_green_area_feature_collection(rows)

    def get_roots_by_municipality_and_sub_municipal_area(
        self,
        municipality_id: int,
        sub_municipal_area_id: int,
        region_id: int,
    ) -> GeoJSONFeatureCollection:
        """Root areas for a municipality and sub-municipal area."""
        province_subq = (
            select(MunicipalityModel.province_id)
            .where(MunicipalityModel.id == municipality_id)
            .limit(1)
            .scalar_subquery()
        )
        stmt = (
            self._select_geojson()
            .where(GreenAreaModel.municipality_id == municipality_id)
            .where(GreenAreaModel.sub_municipal_area_id == sub_municipal_area_id)
            .where(GreenAreaModel.parent_id.is_(None))
            .where(GreenAreaModel.region_id == region_id)
            .where(GreenAreaModel.province_id == province_subq)
        )
        with self._session_factory() as session:
            rows = self._rows_from_session(session, stmt)
        return build_green_area_feature_collection(rows)
