"""Green assets repository (SQLAlchemy ORM). Exposes one query per filter type."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Literal

from sqlalchemy import ColumnElement, or_, select, func, exists
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Session, load_only

from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.geo.domain.entities.sub_municipal_area_model import SubMunicipalAreaModel
from territory.assets.infrastructure.mapper import build_green_asset_feature_collection
from territory.assets.domain.entities.green_asset_model import GreenAssetModel
from territory.areas.domain.entities.green_area_model import GreenAreaModel
from territory.common.infrastructure.table_serialization import orm_to_row_dict

# Columns excluded from table-view queries: heavy JSONB blobs not needed in list APIs.
_TABLE_EXCLUDE_COLS: frozenset[str] = frozenset({"attributes", "media"})

# Explicit column list for load_only — every scalar column except attributes and media.
_TABLE_LOAD_COLS = (
    GreenAssetModel.id,
    GreenAssetModel.region_id,
    GreenAssetModel.province_id,
    GreenAssetModel.municipality_id,
    GreenAssetModel.green_area_id,
    GreenAssetModel.attribute_type_id,
    GreenAssetModel.asset_type,
    GreenAssetModel.geometry_type,
    GreenAssetModel.family,
    GreenAssetModel.genus,
    GreenAssetModel.species,
    GreenAssetModel.variety,
    GreenAssetModel.start_date_of_management,
    GreenAssetModel.end_date_of_management,
    GreenAssetModel.planting_date,
    GreenAssetModel.last_update_at,
    GreenAssetModel.deleted_at,
    GreenAssetModel.health_status,
    GreenAssetModel.stability_status,
    GreenAssetModel.structural_defect,
    GreenAssetModel.risk_level,
    GreenAssetModel.maintenance_priority,
    GreenAssetModel.intervention_type,
    GreenAssetModel.growth_stage,
    GreenAssetModel.origin,
    GreenAssetModel.protection_status,
    GreenAssetModel.asset_status,
    GreenAssetModel.monitoring_required,
    GreenAssetModel.next_inspection_date,
    GreenAssetModel.priority_level_evaluation,
    GreenAssetModel.managing_entity,
    GreenAssetModel.last_modified_by,
    GreenAssetModel.survey_date,
    GreenAssetModel.survey_method,
    GreenAssetModel.note,
    GreenAssetModel.created_at,
    GreenAssetModel.updated_at,
)

# Map column-name → ORM attribute for ORDER BY whitelisting.
_ASSET_SORT_MAP: dict[str, Any] = {col.key: col for col in _TABLE_LOAD_COLS}

# String enum columns filtered with exact equality.
_ASSET_EXACT_FILTER_COLS: tuple[str, ...] = (
    "asset_type",
    "geometry_type",
    "health_status",
    "stability_status",
    "structural_defect",
    "risk_level",
    "maintenance_priority",
    "intervention_type",
    "growth_stage",
    "origin",
    "protection_status",
    "asset_status",
    "monitoring_required",
    "priority_level_evaluation",
)

# Free-text columns filtered with case-insensitive ILIKE.
# managing_entity is free text, NOT an enum — must be ILIKE, not exact match.
_ASSET_ILIKE_FILTER_COLS: tuple[str, ...] = (
    "species",
    "family",
    "genus",
    "variety",
    "managing_entity",
)


def _build_asset_filter_conditions(
    av: type[GreenAssetModel],
    filters: dict[str, Any],
) -> list[ColumnElement[bool]]:
    """Build SQLAlchemy WHERE conditions from the caller-supplied filter dict.

    Only non-empty values generate a condition; None and empty strings are skipped.
    """
    conditions: list[ColumnElement[bool]] = []

    for col_name in _ASSET_EXACT_FILTER_COLS:
        val = filters.get(col_name)
        if val is not None and val != "":
            conditions.append(getattr(av, col_name) == val)

    for col_name in _ASSET_ILIKE_FILTER_COLS:
        val = filters.get(col_name)
        if val:  # empty string is not a useful ILIKE pattern
            conditions.append(getattr(av, col_name).ilike(f"%{val}%"))

    q: str | None = filters.get("q")
    if q:
        conditions.append(
            or_(
                av.species.ilike(f"%{q}%"),
                av.family.ilike(f"%{q}%"),
                av.genus.ilike(f"%{q}%"),
                av.variety.ilike(f"%{q}%"),
            )
        )

    return conditions


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
        province_id: int,
        municipality_id: int,
        green_area_id: int,
    ) -> GeoJSONFeatureCollection:
        """Assets that intersect or are contained in a single green area.
        WHERE region_id AND province_id first for partition pruning."""
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
        self, region_id: int, province_id: int, municipality_id: int
    ) -> GeoJSONFeatureCollection:
        """Assets that intersect at least one root green area in the municipality.
        Uses EXISTS + ST_Intersects so GIST indexes on both tables are used."""
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
        WHERE region_id and province_id first for partition pruning."""
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

    # ------------------------------------------------------------------
    # Paginated + filtered + sorted table query (server-side)
    # ------------------------------------------------------------------

    def list_table_rows_paged(
        self,
        region_id: int,
        province_id: int,
        municipality_id: int,
        *,
        green_area_id: int | None = None,
        sub_municipal_area_id: int | None = None,
        page: int = 1,
        page_size: int = 50,
        sort_by: str | None = None,
        sort_dir: Literal["asc", "desc"] = "asc",
        filters: dict[str, Any] | None = None,
    ) -> tuple[list[dict], int]:
        """Return one page of rows and the total count matching all filters."""
        av = GreenAssetModel

        # Territory scope — same logic as list_table_rows.
        conditions: list[ColumnElement[bool]] = [
            av.region_id == region_id,
            av.province_id == province_id,
            av.municipality_id == municipality_id,
        ]
        if green_area_id is not None:
            area_geom = (
                select(GreenAreaModel.geometry)
                .where(GreenAreaModel.region_id == region_id)
                .where(GreenAreaModel.province_id == province_id)
                .where(GreenAreaModel.id == green_area_id)
                .where(GreenAreaModel.geometry.isnot(None))
                .limit(1)
                .scalar_subquery()
            )
            conditions.append(func.ST_Intersects(av.geometry, area_geom))
        elif sub_municipal_area_id is not None:
            sub_geom = (
                select(SubMunicipalAreaModel.geometry)
                .where(SubMunicipalAreaModel.id == sub_municipal_area_id)
                .where(SubMunicipalAreaModel.municipality_id == municipality_id)
                .where(SubMunicipalAreaModel.geometry.isnot(None))
                .limit(1)
                .scalar_subquery()
            )
            conditions.append(func.ST_Intersects(av.geometry, sub_geom))
        else:
            conditions.append(av.green_area_id.isnot(None))

        conditions.extend(_build_asset_filter_conditions(av, filters or {}))

        sort_col = _ASSET_SORT_MAP.get(sort_by or "")
        order = sort_col.desc() if sort_dir == "desc" else sort_col.asc() if sort_col is not None else av.id.asc()

        count_stmt = select(func.count(av.id)).where(*conditions)
        data_stmt = (
            select(av)
            .options(load_only(*_TABLE_LOAD_COLS, raiseload=True))
            .where(*conditions)
            .order_by(order)
            .limit(page_size)
            .offset((page - 1) * page_size)
        )

        with self._session_factory() as session:
            total: int = session.execute(count_stmt).scalar_one()
            rows = [orm_to_row_dict(av, m, exclude=_TABLE_EXCLUDE_COLS) for m in session.scalars(data_stmt)]
        return rows, total
