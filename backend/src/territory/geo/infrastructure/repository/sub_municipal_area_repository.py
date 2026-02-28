"""Repository for sub-municipal areas (public.sub_municipal_area)."""

from collections.abc import Callable

from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Session

from territory.geo.domain.entities import (
    GeoJSONFeatureCollection,
    SubMunicipalAreaModel,
)
from territory.geo.infrastructure.mapper import build_sub_municipal_area_feature_collection


class SubMunicipalAreaRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def get_sub_municipal_areas_by_municipality(
        self, municipality_id: int
    ) -> GeoJSONFeatureCollection:
        """Return all sub-municipal areas (levels 1, 2, 3) for the municipality. Ordered by level then id."""
        stmt = (
            select(
                SubMunicipalAreaModel.id,
                func.ST_AsGeoJSON(SubMunicipalAreaModel.geometry).cast(JSON).label("geometry"),
                SubMunicipalAreaModel.code,
                SubMunicipalAreaModel.name,
                SubMunicipalAreaModel.level,
                SubMunicipalAreaModel.area_type,
                SubMunicipalAreaModel.parent_id,
            )
            .where(SubMunicipalAreaModel.geometry.isnot(None))
            .where(SubMunicipalAreaModel.municipality_id == municipality_id)
            .order_by(SubMunicipalAreaModel.level.asc(), SubMunicipalAreaModel.id.asc())
        )
        with self._session_factory() as session:
            rows = [tuple(row) for row in session.execute(stmt).all()]
        return build_sub_municipal_area_feature_collection(rows)
