"""Green assets repository (SQLAlchemy ORM). Exposes one query per filter type."""

from collections.abc import Callable

from sqlalchemy import select, func, exists
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Session

from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.geo.domain.entities.sub_municipal_area_model import SubMunicipalAreaModel
from territory.assets.infrastructure.mapper import build_green_asset_feature_collection
from territory.assets.domain.entities.green_asset_model import GreenAssetModel
from territory.areas.domain.entities.green_area_model import GreenAreaModel


class GreenAssetsRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def _select_geojson(self):
        return select(
            GreenAssetModel.id,
            func.ST_AsGeoJSON(GreenAssetModel.geometry).cast(JSON).label("geometry"),
            GreenAssetModel.asset_type,
            GreenAssetModel.geometry_type,
            GreenAssetModel.species,
        ).where(GreenAssetModel.geometry.isnot(None))

    def _rows_from_session(self, session: Session, stmt) -> list[tuple]:
        result = session.execute(stmt)
        return [tuple(row) for row in result.all()]

    def get_within_area(
        self,
        region_id: int,
        municipality_id: int,
        green_area_id: int,
        province_id: int,
    ) -> GeoJSONFeatureCollection:
        """Assets that intersect or are contained in a single green area. WHERE region_id AND province_id first for partition pruning."""
        av = GreenAssetModel
        a = GreenAreaModel
        area_geom = (
            select(a.geometry)
            .where(a.region_id == region_id)
            .where(a.province_id == province_id)
            .where(a.id == green_area_id)
            .where(a.geometry.isnot(None))
            .limit(1)
            .scalar_subquery()
        )
        stmt = (
            self._select_geojson()
            .where(av.region_id == region_id)
            .where(av.province_id == province_id)
            .where(av.municipality_id == municipality_id)
            .where(func.ST_Intersects(av.geometry, area_geom))
        )
        with self._session_factory() as session:
            rows = self._rows_from_session(session, stmt)
        return build_green_asset_feature_collection(rows)

    def get_within_municipality(
        self, region_id: int, municipality_id: int, province_id: int
    ) -> GeoJSONFeatureCollection:
        """Assets that intersect at least one root green area in the municipality.
        Uses EXISTS + ST_Intersects so GIST indexes on both tables are used; avoids slow ST_Collect."""
        av = GreenAssetModel
        a = GreenAreaModel
        intersects_any_root = (
            select(1)
            .select_from(a)
            .where(a.region_id == av.region_id)
            .where(a.province_id == av.province_id)
            .where(a.municipality_id == av.municipality_id)
            .where(a.parent_id.is_(None))
            .where(a.geometry.isnot(None))
            .where(func.ST_Intersects(av.geometry, a.geometry))
        )
        stmt = (
            self._select_geojson()
            .where(av.region_id == region_id)
            .where(av.province_id == province_id)
            .where(av.municipality_id == municipality_id)
            .where(exists(intersects_any_root))
        )
        with self._session_factory() as session:
            rows = self._rows_from_session(session, stmt)
        return build_green_asset_feature_collection(rows)

    def get_within_municipality_intersecting_sub_municipal_area(
        self,
        region_id: int,
        province_id: int,
        municipality_id: int,
        sub_municipal_area_id: int,
    ) -> GeoJSONFeatureCollection:
        """Assets that intersect the given sub-municipal area geometry.
        WHERE region_id and province_id first for partition pruning; ST_Intersects with public.sub_municipal_area.
        """
        av = GreenAssetModel
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
            .where(av.region_id == region_id)
            .where(av.province_id == province_id)
            .where(av.municipality_id == municipality_id)
            .where(func.ST_Intersects(av.geometry, sub_geom))
        )
        with self._session_factory() as session:
            rows = self._rows_from_session(session, stmt)
        return build_green_asset_feature_collection(rows)

