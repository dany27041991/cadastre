"""Green assets repository (SQLAlchemy ORM). Exposes one query per filter type."""

from collections.abc import Callable

from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Session

from territory.geo.domain.entities import GeoJSONFeatureCollection, MunicipalityModel
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
        self, region_id: int, municipality_id: int, green_area_id: int
    ) -> GeoJSONFeatureCollection:
        """Assets within a single green area."""
        av = GreenAssetModel
        a = GreenAreaModel
        area_geom = (
            select(a.geometry)
            .where(a.id == green_area_id)
            .where(a.region_id == region_id)
            .where(a.geometry.isnot(None))
            .limit(1)
            .scalar_subquery()
        )
        province_subq = (
            select(MunicipalityModel.province_id)
            .where(MunicipalityModel.id == municipality_id)
            .limit(1)
            .scalar_subquery()
        )
        stmt = (
            self._select_geojson()
            .where(av.region_id == region_id)
            .where(av.province_id == province_subq)
            .where(av.municipality_id == municipality_id)
            .where(func.ST_Within(av.geometry, area_geom))
        )
        with self._session_factory() as session:
            rows = self._rows_from_session(session, stmt)
        return build_green_asset_feature_collection(rows)

    def get_within_municipality(
        self, region_id: int, municipality_id: int
    ) -> GeoJSONFeatureCollection:
        """Assets within municipality (ST_Union of root areas, no sub-municipal area filter)."""
        av = GreenAssetModel
        a = GreenAreaModel
        province_subq = (
            select(MunicipalityModel.province_id)
            .where(MunicipalityModel.id == municipality_id)
            .limit(1)
            .scalar_subquery()
        )
        area_union = (
            select(func.ST_Union(a.geometry))
            .where(a.municipality_id == municipality_id)
            .where(a.region_id == region_id)
            .where(a.province_id == province_subq)
            .where(a.parent_id.is_(None))
            .where(a.geometry.isnot(None))
        ).scalar_subquery()
        stmt = (
            self._select_geojson()
            .where(av.region_id == region_id)
            .where(av.province_id == province_subq)
            .where(av.municipality_id == municipality_id)
            .where(func.ST_Within(av.geometry, area_union))
        )
        with self._session_factory() as session:
            rows = self._rows_from_session(session, stmt)
        return build_green_asset_feature_collection(rows)

    def get_within_municipality_and_sub_municipal_area(
        self,
        region_id: int,
        municipality_id: int,
        sub_municipal_area_id: int,
    ) -> GeoJSONFeatureCollection:
        """Assets within municipality and sub-municipal area (ST_Union of root areas)."""
        av = GreenAssetModel
        a = GreenAreaModel
        province_subq = (
            select(MunicipalityModel.province_id)
            .where(MunicipalityModel.id == municipality_id)
            .limit(1)
            .scalar_subquery()
        )
        area_union = (
            select(func.ST_Union(a.geometry))
            .where(a.municipality_id == municipality_id)
            .where(a.region_id == region_id)
            .where(a.province_id == province_subq)
            .where(a.parent_id.is_(None))
            .where(a.sub_municipal_area_id == sub_municipal_area_id)
            .where(a.geometry.isnot(None))
        ).scalar_subquery()
        stmt = (
            self._select_geojson()
            .where(av.region_id == region_id)
            .where(av.province_id == province_subq)
            .where(av.municipality_id == municipality_id)
            .where(av.sub_municipal_area_id == sub_municipal_area_id)
            .where(func.ST_Within(av.geometry, area_union))
        )
        with self._session_factory() as session:
            rows = self._rows_from_session(session, stmt)
        return build_green_asset_feature_collection(rows)
