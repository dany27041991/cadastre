"""Green assets repository (SQLAlchemy ORM). Exposes one query per filter type."""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Literal

from sqlalchemy import ColumnElement, String, cast, or_, select, func, exists, text as sql_text
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
_ASSET_SORT_MAP["plant_code"] = GreenAssetModel.id
_ASSET_SORT_MAP["area_code"] = GreenAssetModel.green_area_id

# String enum columns filtered with exact equality (non-catalog API filters).
_ASSET_EXACT_FILTER_COLS: tuple[str, ...] = (
    "asset_type",
    "geometry_type",
    "stability_status",
    "structural_defect",
    "risk_level",
    "maintenance_priority",
    "intervention_type",
    "origin",
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

# Catalog status fields: free-text partial match.
_ASSET_ILIKE_CAST_COLS: tuple[str, ...] = (
    "growth_stage",
    "protection_status",
    "health_status",
)

_ASSET_ATTR_ILIKE_KEYS: tuple[str, ...] = (
    "trunk_diameter_cm",
    "plant_height_m",
    "crown_diameter_m",
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

    for col_name in _ASSET_ILIKE_CAST_COLS:
        val = filters.get(col_name)
        if val:
            conditions.append(cast(getattr(av, col_name), String).ilike(f"%{val}%"))

    plant_code = filters.get("plant_code")
    if plant_code not in (None, ""):
        try:
            conditions.append(av.id == int(plant_code))
        except (TypeError, ValueError):
            conditions.append(av.id == -1)

    area_code = filters.get("area_code")
    if area_code not in (None, ""):
        try:
            conditions.append(av.green_area_id == int(area_code))
        except (TypeError, ValueError):
            conditions.append(av.green_area_id == -1)

    species_code = filters.get("species_code")
    if species_code:
        conditions.append(
            av.attributes.op("->>")("species_code").ilike(f"%{species_code}%")
        )

    survey_date = filters.get("survey_date")
    if survey_date:
        conditions.append(cast(av.survey_date, String).ilike(f"%{survey_date}%"))

    centroid = func.ST_Centroid(av.geometry)
    latitude = filters.get("latitude")
    if latitude:
        conditions.append(cast(func.ST_Y(centroid), String).ilike(f"%{latitude}%"))
    longitude = filters.get("longitude")
    if longitude:
        conditions.append(cast(func.ST_X(centroid), String).ilike(f"%{longitude}%"))

    for attr_key in _ASSET_ATTR_ILIKE_KEYS:
        val = filters.get(attr_key)
        if val:
            conditions.append(av.attributes.op("->>")(attr_key).ilike(f"%{val}%"))

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


@dataclass(frozen=True)
class ViewportCluster:
    """One aggregate for the viewport endpoint (grid cell or admin unit).

    Grid clusters carry the centroid in Web Mercator (merc_x/merc_y); admin
    clusters carry it as lon/lat and a stable admin_key (e.g. "R12", "P12_58").
    """

    cell_x: int
    cell_y: int
    count: int
    merc_x: float
    merc_y: float
    bbox: tuple[float, float, float, float]
    sample_id: int
    admin_key: str | None = None
    lon: float | None = None
    lat: float | None = None


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
            GreenAssetModel.region_id,
            GreenAssetModel.province_id,
        ).where(GreenAssetModel.geometry.isnot(None))

    def _rows_from_session(self, session: Session, stmt) -> list[tuple]:
        result = session.execute(stmt)
        return [tuple(row) for row in result.all()]

    def get_by_pk(
        self,
        asset_id: int,
        region_id: int,
        province_id: int,
    ) -> dict[str, Any] | None:
        """Load one asset by composite PK; excludes soft-deleted rows."""
        av = GreenAssetModel
        stmt = (
            select(av)
            .options(load_only(*_TABLE_LOAD_COLS, raiseload=True))
            .where(av.region_id == region_id)
            .where(av.province_id == province_id)
            .where(av.id == asset_id)
            .where(av.deleted_at.is_(None))
            .limit(1)
        )
        with self._session_factory() as session:
            row = session.scalars(stmt).first()
            if row is None:
                return None
            return orm_to_row_dict(av, row, exclude=_TABLE_EXCLUDE_COLS)

    def get_detail_by_pk(
        self,
        asset_id: int,
        region_id: int,
        province_id: int,
    ) -> dict[str, Any] | None:
        """Load detail fields + attributes + WGS84 centroid for the map panel."""
        av = GreenAssetModel
        centroid = func.ST_Centroid(av.geometry)
        stmt = (
            select(
                av.id,
                av.region_id,
                av.province_id,
                av.municipality_id,
                av.green_area_id,
                av.attribute_type_id,
                av.asset_type,
                av.genus,
                av.species,
                av.variety,
                av.health_status,
                av.growth_stage,
                av.protection_status,
                av.survey_date,
                av.attributes,
                func.ST_Y(centroid).label("latitude"),
                func.ST_X(centroid).label("longitude"),
            )
            .where(av.region_id == region_id)
            .where(av.province_id == province_id)
            .where(av.id == asset_id)
            .where(av.deleted_at.is_(None))
            .limit(1)
        )
        with self._session_factory() as session:
            row = session.execute(stmt).mappings().first()
            if row is None:
                return None
            return dict(row)

    def get_bbox_by_pk(
        self,
        asset_id: int,
        region_id: int,
        province_id: int,
    ) -> list[float] | None:
        """WGS84 envelope [minLon, minLat, maxLon, maxLat] for map framing."""
        av = GreenAssetModel
        env = func.ST_Envelope(av.geometry)
        stmt = (
            select(
                func.ST_XMin(env),
                func.ST_YMin(env),
                func.ST_XMax(env),
                func.ST_YMax(env),
            )
            .where(av.region_id == region_id)
            .where(av.province_id == province_id)
            .where(av.id == asset_id)
            .where(av.deleted_at.is_(None))
            .where(av.geometry.isnot(None))
            .limit(1)
        )
        with self._session_factory() as session:
            row = session.execute(stmt).first()
            if row is None or any(v is None for v in row):
                return None
            return [float(row[0]), float(row[1]), float(row[2]), float(row[3])]

    def get_geometry_by_pk(
        self,
        asset_id: int,
        region_id: int,
        province_id: int,
    ) -> dict[str, Any] | None:
        """WGS84 GeoJSON geometry for true-shape map highlight."""
        av = GreenAssetModel
        stmt = (
            select(func.ST_AsGeoJSON(av.geometry).cast(JSON))
            .where(av.region_id == region_id)
            .where(av.province_id == province_id)
            .where(av.id == asset_id)
            .where(av.deleted_at.is_(None))
            .where(av.geometry.isnot(None))
            .limit(1)
        )
        with self._session_factory() as session:
            raw = session.execute(stmt).scalar_one_or_none()
            if raw is None:
                return None
            if isinstance(raw, dict):
                return raw
            if isinstance(raw, str):
                parsed = json.loads(raw)
                return parsed if isinstance(parsed, dict) else None
            return None

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
    # Viewport queries (bbox in EPSG:4326) — national-scale map rendering
    # ------------------------------------------------------------------

    def get_admin_clusters_in_bbox(
        self,
        level: str,
        bbox: tuple[float, float, float, float],
        region_id: int | None = None,
        province_id: int | None = None,
        municipality_id: int | None = None,
        sub_municipal_area_id: int | None = None,
    ) -> list[ViewportCluster]:
        """Pre-aggregated clusters per admin unit (materialized view, low zooms).

        Levels: region, province, municipality, sub_municipal. Response cost is
        O(#admin units in bbox) regardless of asset volume, which keeps national
        views fast at any dataset size.
        """
        stmt = sql_text(
            """
            SELECT level, region_id, province_id, municipality_id, sub_municipal_area_id,
                   asset_count, sample_id,
                   ST_X(centroid), ST_Y(centroid),
                   ST_XMin(extent), ST_YMin(extent), ST_XMax(extent), ST_YMax(extent)
            FROM cadastre.green_asset_admin_clusters
            WHERE level = :level
              AND centroid && ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326)
              AND (:region_id IS NULL OR region_id = :region_id)
              AND (:province_id IS NULL OR province_id = :province_id)
              AND (:municipality_id IS NULL OR municipality_id = :municipality_id)
              AND (:sub_municipal_area_id IS NULL OR sub_municipal_area_id = :sub_municipal_area_id)
            """
        )
        params = {
            "level": level,
            "minx": bbox[0],
            "miny": bbox[1],
            "maxx": bbox[2],
            "maxy": bbox[3],
            "region_id": region_id,
            "province_id": province_id,
            "municipality_id": municipality_id,
            "sub_municipal_area_id": sub_municipal_area_id,
        }
        with self._session_factory() as session:
            rows = session.execute(stmt, params).all()
        clusters: list[ViewportCluster] = []
        for r in rows:
            key_parts = [str(part) for part in (r[1], r[2], r[3], r[4]) if part is not None]
            clusters.append(
                ViewportCluster(
                    cell_x=0,
                    cell_y=0,
                    count=int(r[5]),
                    merc_x=0.0,
                    merc_y=0.0,
                    bbox=(float(r[9]), float(r[10]), float(r[11]), float(r[12])),
                    sample_id=int(r[6]),
                    admin_key=f"{r[0][0].upper()}{'_'.join(key_parts)}",
                    lon=float(r[7]),
                    lat=float(r[8]),
                )
            )
        return clusters

    def _bbox_conditions(
        self,
        bbox: tuple[float, float, float, float],
        region_id: int | None = None,
        province_id: int | None = None,
        municipality_id: int | None = None,
        sub_municipal_area_id: int | None = None,
        green_area_id: int | None = None,
    ) -> list[ColumnElement[bool]]:
        """WHERE clauses for a viewport query: partition pruning + GIST bbox intersect.

        sub_municipal_area_id / green_area_id add an ST_Intersects with the scope
        geometry so the response never leaks assets outside the selected admin area.
        """
        av = GreenAssetModel
        envelope = func.ST_MakeEnvelope(bbox[0], bbox[1], bbox[2], bbox[3], 4326)
        conditions: list[ColumnElement[bool]] = [
            av.geometry.isnot(None),
            av.geometry.intersects(envelope),
        ]
        if region_id is not None:
            conditions.append(av.region_id == region_id)
        if province_id is not None:
            conditions.append(av.province_id == province_id)
        if municipality_id is not None:
            conditions.append(av.municipality_id == municipality_id)
        if sub_municipal_area_id is not None:
            sub_geom = (
                select(SubMunicipalAreaModel.geometry)
                .where(SubMunicipalAreaModel.id == sub_municipal_area_id)
                .where(SubMunicipalAreaModel.geometry.isnot(None))
                .limit(1)
                .scalar_subquery()
            )
            conditions.append(func.ST_Intersects(av.geometry, sub_geom))
        if green_area_id is not None:
            area_geom = (
                select(GreenAreaModel.geometry)
                .where(GreenAreaModel.id == green_area_id)
                .where(GreenAreaModel.geometry.isnot(None))
                .limit(1)
                .scalar_subquery()
            )
            conditions.append(func.ST_Intersects(av.geometry, area_geom))
        return conditions

    def get_raw_in_bbox(
        self,
        bbox: tuple[float, float, float, float],
        limit: int,
        region_id: int | None = None,
        province_id: int | None = None,
        municipality_id: int | None = None,
        sub_municipal_area_id: int | None = None,
        green_area_id: int | None = None,
    ) -> GeoJSONFeatureCollection:
        """Individual assets inside the bbox (raw mode below the cluster threshold)."""
        stmt = (
            self._select_geojson()
            .where(*self._bbox_conditions(
                bbox, region_id, province_id, municipality_id,
                sub_municipal_area_id, green_area_id,
            ))
            .limit(limit)
        )
        with self._session_factory() as session:
            rows = self._rows_from_session(session, stmt)
        return build_green_asset_feature_collection(rows)

    def get_grid_clusters_from_matview(
        self,
        zoom_level: int,
        bbox: tuple[float, float, float, float],
        region_id: int | None = None,
        province_id: int | None = None,
        municipality_id: int | None = None,
    ) -> list[ViewportCluster]:
        """Pre-aggregated grid cells for one zoom level (materialized view).

        Same grid as get_clusters_in_bbox (see 08-matview SQL: cell math mirrors
        viewport_grid.grid_cell_size_m) but served from an indexed matview: a
        live aggregation measured 200-414ms on dense bboxes, this is ~18ms.
        Cells split per admin unit in the view are re-aggregated here (SUM /
        count-weighted centroid), so unscoped and scoped responses share keys.
        """
        stmt = sql_text(
            """
            SELECT cell_x, cell_y,
                   SUM(asset_count)::bigint AS cnt,
                   SUM(merc_x * asset_count) / SUM(asset_count) AS mx,
                   SUM(merc_y * asset_count) / SUM(asset_count) AS my,
                   ST_XMin(ST_Extent(extent)), ST_YMin(ST_Extent(extent)),
                   ST_XMax(ST_Extent(extent)), ST_YMax(ST_Extent(extent)),
                   MIN(sample_id)
            FROM cadastre.green_asset_grid_clusters
            WHERE zoom_level = :zoom_level
              AND extent && ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326)
              AND (CAST(:region_id AS integer) IS NULL OR region_id = :region_id)
              AND (CAST(:province_id AS integer) IS NULL OR province_id = :province_id)
              AND (CAST(:municipality_id AS integer) IS NULL OR municipality_id = :municipality_id)
            GROUP BY cell_x, cell_y
            """
        )
        params = {
            "zoom_level": zoom_level,
            "minx": bbox[0],
            "miny": bbox[1],
            "maxx": bbox[2],
            "maxy": bbox[3],
            "region_id": region_id,
            "province_id": province_id,
            "municipality_id": municipality_id,
        }
        with self._session_factory() as session:
            rows = session.execute(stmt, params).all()
        return [
            ViewportCluster(
                cell_x=int(r[0]),
                cell_y=int(r[1]),
                count=int(r[2]),
                merc_x=float(r[3]),
                merc_y=float(r[4]),
                bbox=(float(r[5]), float(r[6]), float(r[7]), float(r[8])),
                sample_id=int(r[9]),
            )
            for r in rows
        ]

    def get_clusters_in_bbox(
        self,
        bbox: tuple[float, float, float, float],
        cell_size_m: float,
        region_id: int | None = None,
        province_id: int | None = None,
        municipality_id: int | None = None,
        sub_municipal_area_id: int | None = None,
        green_area_id: int | None = None,
    ) -> list[ViewportCluster]:
        """Grid-cell aggregates inside the bbox (cluster mode).

        The grid uses Web Mercator cells of cell_size_m, mirroring the frontend
        grid so cluster geom_ids stay stable across pans (diff mount).
        Aggregation runs entirely in PostGIS: only one row per cell is returned.
        """
        av = GreenAssetModel
        centroid_3857 = func.ST_Transform(func.ST_Centroid(av.geometry), 3857)
        cell_x = func.floor(func.ST_X(centroid_3857) / cell_size_m).label("cell_x")
        cell_y = func.floor(func.ST_Y(centroid_3857) / cell_size_m).label("cell_y")
        extent = func.ST_Extent(av.geometry)
        stmt = (
            select(
                cell_x,
                cell_y,
                func.count(av.id).label("count"),
                func.avg(func.ST_X(centroid_3857)).label("merc_x"),
                func.avg(func.ST_Y(centroid_3857)).label("merc_y"),
                func.ST_XMin(extent),
                func.ST_YMin(extent),
                func.ST_XMax(extent),
                func.ST_YMax(extent),
                func.min(av.id).label("sample_id"),
            )
            .where(*self._bbox_conditions(
                bbox, region_id, province_id, municipality_id,
                sub_municipal_area_id, green_area_id,
            ))
            .group_by(cell_x, cell_y)
        )
        with self._session_factory() as session:
            rows = session.execute(stmt).all()
        return [
            ViewportCluster(
                cell_x=int(r[0]),
                cell_y=int(r[1]),
                count=int(r[2]),
                merc_x=float(r[3]),
                merc_y=float(r[4]),
                bbox=(float(r[5]), float(r[6]), float(r[7]), float(r[8])),
                sample_id=int(r[9]),
            )
            for r in rows
        ]

    # ------------------------------------------------------------------
    # Paginated + filtered + sorted table query (server-side)
    # ------------------------------------------------------------------

    def list_table_rows_paged(
        self,
        region_id: int | None,
        province_id: int | None,
        municipality_id: int | None,
        *,
        green_area_id: int | None = None,
        sub_municipal_area_id: int | None = None,
        page: int = 1,
        page_size: int = 50,
        sort_by: str | None = None,
        sort_dir: Literal["asc", "desc"] = "asc",
        filters: dict[str, Any] | None = None,
    ) -> tuple[list[dict], int]:
        """Return one page of rows and the total count matching all filters.

        Territory filters are optional: omit them for a nationwide table.
        """
        av = GreenAssetModel

        conditions: list[ColumnElement[bool]] = []
        if region_id is not None:
            conditions.append(av.region_id == region_id)
        if province_id is not None:
            conditions.append(av.province_id == province_id)
        if municipality_id is not None:
            conditions.append(av.municipality_id == municipality_id)
        if green_area_id is not None:
            area_geom_stmt = (
                select(GreenAreaModel.geometry)
                .where(GreenAreaModel.id == green_area_id)
                .where(GreenAreaModel.geometry.isnot(None))
            )
            if region_id is not None:
                area_geom_stmt = area_geom_stmt.where(GreenAreaModel.region_id == region_id)
            if province_id is not None:
                area_geom_stmt = area_geom_stmt.where(GreenAreaModel.province_id == province_id)
            area_geom = area_geom_stmt.limit(1).scalar_subquery()
            conditions.append(func.ST_Intersects(av.geometry, area_geom))
        elif sub_municipal_area_id is not None:
            sub_geom_stmt = (
                select(SubMunicipalAreaModel.geometry)
                .where(SubMunicipalAreaModel.id == sub_municipal_area_id)
                .where(SubMunicipalAreaModel.geometry.isnot(None))
            )
            if municipality_id is not None:
                sub_geom_stmt = sub_geom_stmt.where(
                    SubMunicipalAreaModel.municipality_id == municipality_id
                )
            sub_geom = sub_geom_stmt.limit(1).scalar_subquery()
            conditions.append(func.ST_Intersects(av.geometry, sub_geom))
        else:
            conditions.append(av.green_area_id.isnot(None))

        conditions.extend(_build_asset_filter_conditions(av, filters or {}))

        sort_col = _ASSET_SORT_MAP.get(sort_by or "")
        order = sort_col.desc() if sort_dir == "desc" else sort_col.asc() if sort_col is not None else av.id.asc()

        count_stmt = select(func.count(av.id)).where(*conditions)
        centroid = func.ST_Centroid(av.geometry)
        data_stmt = (
            select(
                av.id,
                av.region_id,
                av.province_id,
                av.municipality_id,
                av.green_area_id,
                av.attribute_type_id,
                av.asset_type,
                av.geometry_type,
                av.family,
                av.genus,
                av.species,
                av.variety,
                av.health_status,
                av.growth_stage,
                av.protection_status,
                av.survey_date,
                av.attributes,
                func.ST_Y(centroid).label("latitude"),
                func.ST_X(centroid).label("longitude"),
            )
            .where(*conditions)
            .order_by(order)
            .limit(page_size)
            .offset((page - 1) * page_size)
        )

        with self._session_factory() as session:
            total: int = session.execute(count_stmt).scalar_one()
            rows = [dict(m) for m in session.execute(data_stmt).mappings()]
        return rows, total
