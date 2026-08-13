"""Repository: typeahead search across admin + green hierarchy."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from sqlalchemy import BigInteger, Integer, String, case, cast, func, literal, select, union_all
from sqlalchemy.orm import Session, aliased

from territory.areas.domain.entities.green_area_model import GreenAreaModel
from territory.geo.domain.entities import (
    MunicipalityModel,
    ProvinceModel,
    RegionModel,
    SubMunicipalAreaModel,
)

ITALY_LABEL = "Italia"
PROVINCE_SUFFIX = " Provincia"
DEFAULT_LIMIT = 20
MAX_LIMIT = 50

_NULL_INT = cast(literal(None), Integer)
_NULL_BIGINT = cast(literal(None), BigInteger)


def _italy_hit() -> dict[str, Any]:
    return {
        "value": "italy",
        "label": ITALY_LABEL,
        "level": "italy",
        "id": None,
        "region_id": None,
        "province_id": None,
        "municipality_id": None,
        "sub_municipal_area_id": None,
        "green_area_id": None,
    }


class TerritorySearchRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def search(self, q: str, limit: int = DEFAULT_LIMIT) -> list[dict[str, Any]]:
        text = (q or "").strip()
        capped = max(1, min(limit or DEFAULT_LIMIT, MAX_LIMIT))
        if not text:
            return [_italy_hit()]

        pattern = f"%{text}%"
        with self._session_factory() as session:
            rows = session.execute(self._union_stmt(pattern).limit(capped)).mappings().all()
        return [dict(row) for row in rows]

    def _union_stmt(self, pattern: str):
        r = RegionModel
        p = ProvinceModel
        m = MunicipalityModel
        s = SubMunicipalAreaModel
        ga = GreenAreaModel
        parent_ga = aliased(GreenAreaModel)

        region_path = literal(ITALY_LABEL) + literal(" - ") + r.name
        province_path = (
            literal(ITALY_LABEL)
            + literal(" - ")
            + r.name
            + literal(" - ")
            + p.name
            + literal(PROVINCE_SUFFIX)
        )
        municipality_path = province_path + literal(" - ") + m.name
        sub_municipal_path = municipality_path + literal(" - ") + s.name
        green_path = case(
            (
                ga.parent_id.is_(None),
                municipality_path + literal(" - ") + ga.name,
            ),
            else_=municipality_path
            + literal(" - ")
            + parent_ga.name
            + literal(" - ")
            + ga.name,
        )

        regions = (
            select(
                (literal("regions:") + func.cast(r.id, String)).label("value"),
                region_path.label("label"),
                literal("regions").label("level"),
                cast(r.id, BigInteger).label("id"),
                r.id.label("region_id"),
                _NULL_INT.label("province_id"),
                _NULL_INT.label("municipality_id"),
                _NULL_BIGINT.label("sub_municipal_area_id"),
                _NULL_BIGINT.label("green_area_id"),
                literal(1).label("sort_level"),
                r.name.label("sort_name"),
            ).where(r.name.ilike(pattern))
        )

        provinces = (
            select(
                (literal("provinces:") + func.cast(p.id, String)).label("value"),
                province_path.label("label"),
                literal("provinces").label("level"),
                cast(p.id, BigInteger).label("id"),
                p.region_id.label("region_id"),
                p.id.label("province_id"),
                _NULL_INT.label("municipality_id"),
                _NULL_BIGINT.label("sub_municipal_area_id"),
                _NULL_BIGINT.label("green_area_id"),
                literal(2).label("sort_level"),
                p.name.label("sort_name"),
            )
            .select_from(p)
            .join(r, r.id == p.region_id)
            .where(p.name.ilike(pattern) | (p.name + literal(PROVINCE_SUFFIX)).ilike(pattern))
        )

        municipalities = (
            select(
                (literal("municipalities:") + func.cast(m.id, String)).label("value"),
                municipality_path.label("label"),
                literal("municipalities").label("level"),
                cast(m.id, BigInteger).label("id"),
                p.region_id.label("region_id"),
                m.province_id.label("province_id"),
                m.id.label("municipality_id"),
                _NULL_BIGINT.label("sub_municipal_area_id"),
                _NULL_BIGINT.label("green_area_id"),
                literal(3).label("sort_level"),
                m.name.label("sort_name"),
            )
            .select_from(m)
            .join(p, p.id == m.province_id)
            .join(r, r.id == p.region_id)
            .where(m.name.ilike(pattern))
        )

        sub_municipals = (
            select(
                (literal("sub_municipal_areas:") + func.cast(s.id, String)).label("value"),
                sub_municipal_path.label("label"),
                literal("sub_municipal_areas").label("level"),
                cast(s.id, BigInteger).label("id"),
                p.region_id.label("region_id"),
                m.province_id.label("province_id"),
                s.municipality_id.label("municipality_id"),
                cast(s.id, BigInteger).label("sub_municipal_area_id"),
                _NULL_BIGINT.label("green_area_id"),
                literal(4).label("sort_level"),
                s.name.label("sort_name"),
            )
            .select_from(s)
            .join(m, m.id == s.municipality_id)
            .join(p, p.id == m.province_id)
            .join(r, r.id == p.region_id)
            .where(s.name.ilike(pattern))
        )

        # Root green areas (parent_id IS NULL) → green_areas; children → sub_areas.
        green_level = case(
            (ga.parent_id.is_(None), literal("green_areas")),
            else_=literal("sub_areas"),
        )
        green_value_prefix = case(
            (ga.parent_id.is_(None), literal("green_areas:")),
            else_=literal("sub_areas:"),
        )
        green_sort = case(
            (ga.parent_id.is_(None), literal(5)),
            else_=literal(6),
        )

        green_areas = (
            select(
                (green_value_prefix + func.cast(ga.id, String)).label("value"),
                green_path.label("label"),
                green_level.label("level"),
                ga.id.label("id"),
                ga.region_id.label("region_id"),
                ga.province_id.label("province_id"),
                ga.municipality_id.label("municipality_id"),
                _NULL_BIGINT.label("sub_municipal_area_id"),
                ga.id.label("green_area_id"),
                green_sort.label("sort_level"),
                ga.name.label("sort_name"),
            )
            .select_from(ga)
            .join(m, m.id == ga.municipality_id)
            .join(p, p.id == ga.province_id)
            .join(r, r.id == ga.region_id)
            .outerjoin(
                parent_ga,
                (parent_ga.id == ga.parent_id)
                & (parent_ga.region_id == ga.region_id)
                & (parent_ga.province_id == ga.province_id),
            )
            .where(ga.deleted_at.is_(None), ga.name.ilike(pattern))
        )

        combined = union_all(
            regions, provinces, municipalities, sub_municipals, green_areas
        ).subquery()
        return (
            select(
                combined.c.value,
                combined.c.label,
                combined.c.level,
                combined.c.id,
                combined.c.region_id,
                combined.c.province_id,
                combined.c.municipality_id,
                combined.c.sub_municipal_area_id,
                combined.c.green_area_id,
            )
            .order_by(combined.c.sort_level, combined.c.sort_name)
        )
