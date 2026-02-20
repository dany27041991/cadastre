"""Repository for Municipality entity (cadastre.municipalities)."""

from collections.abc import Callable

from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Session

from territory.geo.domain.entities import GeoJSONFeatureCollection, MunicipalityModel
from territory.geo.infrastructure.mapper import build_municipality_feature_collection


class MunicipalityRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def get_municipalities_by_province(
        self, province_id: int
    ) -> GeoJSONFeatureCollection:
        stmt = (
            select(
                MunicipalityModel.id,
                func.ST_AsGeoJSON(MunicipalityModel.geometry).cast(JSON).label("geometry"),
                MunicipalityModel.istat_code,
                MunicipalityModel.name,
            )
            .where(MunicipalityModel.geometry.isnot(None))
            .where(MunicipalityModel.province_id == province_id)
        )
        with self._session_factory() as session:
            rows = [tuple(row) for row in session.execute(stmt).all()]
        return build_municipality_feature_collection(rows)
