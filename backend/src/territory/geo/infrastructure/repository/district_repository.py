"""Repository for District entity (cadastre.districts)."""

from collections.abc import Callable

from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Session

from territory.geo.domain.entities import GeoJSONFeatureCollection, DistrictModel
from territory.geo.infrastructure.mapper import build_district_feature_collection


class DistrictRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def get_districts_by_municipality(
        self, municipality_id: int
    ) -> GeoJSONFeatureCollection:
        stmt = (
            select(
                DistrictModel.id,
                func.ST_AsGeoJSON(DistrictModel.geometry).cast(JSON).label("geometry"),
                DistrictModel.code,
                DistrictModel.name,
            )
            .where(DistrictModel.geometry.isnot(None))
            .where(DistrictModel.municipality_id == municipality_id)
        )
        with self._session_factory() as session:
            rows = [tuple(row) for row in session.execute(stmt).all()]
        return build_district_feature_collection(rows)
