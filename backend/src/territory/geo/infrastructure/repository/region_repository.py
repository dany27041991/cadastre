"""Repository for Region entity (cadastre.regions)."""

from collections.abc import Callable

from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Session

from territory.geo.domain.entities import GeoJSONFeatureCollection, RegionModel
from territory.geo.infrastructure.mapper import build_region_feature_collection


class RegionRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def get_regions(self) -> GeoJSONFeatureCollection:
        # Simplify and reduce precision to speed up serialization and shrink payload (regions have large coastlines).
        geom_out = func.ST_AsGeoJSON(
            func.ST_SimplifyPreserveTopology(RegionModel.geometry, 0.002), 6
        ).cast(JSON)
        stmt = select(
            RegionModel.id,
            geom_out.label("geometry"),
            RegionModel.code,
            RegionModel.name,
        ).where(RegionModel.geometry.isnot(None))
        with self._session_factory() as session:
            rows = [tuple(row) for row in session.execute(stmt).all()]
        return build_region_feature_collection(rows)
