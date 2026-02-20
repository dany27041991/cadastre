"""Repository for Province entity (cadastre.provinces)."""

from collections.abc import Callable

from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Session

from territory.geo.domain.entities import GeoJSONFeatureCollection, ProvinceModel
from territory.geo.infrastructure.mapper import build_province_feature_collection


class ProvinceRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def get_provinces_by_region(self, region_id: int) -> GeoJSONFeatureCollection:
        stmt = (
            select(
                ProvinceModel.id,
                func.ST_AsGeoJSON(ProvinceModel.geometry).cast(JSON).label("geometry"),
                ProvinceModel.code,
                ProvinceModel.name,
                ProvinceModel.vehicle_registration_code,
            )
            .where(ProvinceModel.geometry.isnot(None))
            .where(ProvinceModel.region_id == region_id)
        )
        with self._session_factory() as session:
            rows = [tuple(row) for row in session.execute(stmt).all()]
        return build_province_feature_collection(rows)
