"""Batch-resolve FK ids to human-readable labels for green area / asset table APIs.

Region, province and municipality names are considered immutable at runtime and
are held in process-level dicts after the first DB lookup. Attribute-type labels
come from public catalogs. Green-area / parent names are resolved from the same
result page when present (PostGIS green tables removed — lakehouse-only).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from shared.domain.entities.translation_model import TranslationModel
from territory.geo.domain.entities.attribute_type_model import AttributeTypeModel
from territory.geo.domain.entities.area_level_model import AreaLevelModel
from territory.geo.domain.entities.municipality_model import MunicipalityModel
from territory.geo.domain.entities.province_model import ProvinceModel
from territory.geo.domain.entities.region_model import RegionModel

# ---------------------------------------------------------------------------
# Process-level caches for immutable geo reference data
# ---------------------------------------------------------------------------
_region_cache: dict[int, str | None] = {}
_province_cache: dict[int, str | None] = {}
_municipality_cache: dict[int, str | None] = {}

_ATTR_TYPE_ENTITY = "public.attribute_types"
_DEFAULT_LABEL_LANG = "it"


def _resolve_regions(session: Session, ids: set[int]) -> dict[int, str | None]:
    missing = ids - _region_cache.keys()
    if missing:
        stmt = select(RegionModel.id, RegionModel.name).where(RegionModel.id.in_(missing))
        for i, n in session.execute(stmt).all():
            _region_cache[i] = n
    return {i: _region_cache.get(i) for i in ids}


def _resolve_provinces(session: Session, ids: set[int]) -> dict[int, str | None]:
    missing = ids - _province_cache.keys()
    if missing:
        stmt = select(ProvinceModel.id, ProvinceModel.name).where(ProvinceModel.id.in_(missing))
        for i, n in session.execute(stmt).all():
            _province_cache[i] = n
    return {i: _province_cache.get(i) for i in ids}


def _resolve_municipalities(session: Session, ids: set[int]) -> dict[int, str | None]:
    missing = ids - _municipality_cache.keys()
    if missing:
        stmt = select(MunicipalityModel.id, MunicipalityModel.name).where(
            MunicipalityModel.id.in_(missing)
        )
        for i, n in session.execute(stmt).all():
            _municipality_cache[i] = n
    return {i: _municipality_cache.get(i) for i in ids}


def _resolve_attribute_type_labels(
    session: Session,
    attr_ids: set[int],
    *,
    lang: str = _DEFAULT_LABEL_LANG,
) -> dict[int, str | None]:
    """Map attribute_type id → localized description (translations), else code."""
    if not attr_ids:
        return {}
    stmt = select(AttributeTypeModel).where(AttributeTypeModel.id.in_(attr_ids))
    types = list(session.scalars(stmt))
    codes = {at.description_code for at in types if at.description_code}
    translated: dict[str, str] = {}
    if codes:
        t_stmt = select(TranslationModel.key, TranslationModel.translation).where(
            TranslationModel.entity_type == "TABLE",
            TranslationModel.entity_name == _ATTR_TYPE_ENTITY,
            TranslationModel.column_name == "description_code",
            TranslationModel.lang == lang,
            TranslationModel.key.in_(codes),
        )
        for key, text in session.execute(t_stmt).all():
            if text:
                translated[str(key)] = str(text)
    labels: dict[int, str | None] = {}
    for at in types:
        code = at.description_code
        labels[at.id] = (
            (translated.get(code) if code else None)
            or code
            or (str(at.ts_code).strip() if at.ts_code is not None else None)
        )
    return labels


def _names_from_page(
    rows: list[dict[str, Any]],
) -> dict[tuple[int, int, int], str | None]:
    """Build (id, region_id, province_id) → name from rows that carry a name."""
    out: dict[tuple[int, int, int], str | None] = {}
    for r in rows:
        rid = r.get("region_id")
        pid = r.get("province_id")
        aid = r.get("id")
        name = r.get("name")
        if aid is None or rid is None or pid is None:
            continue
        if name is not None:
            out[(int(aid), int(rid), int(pid))] = str(name)
    return out


def enrich_green_area_table_rows(session: Session, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Add *_label fields for FK columns (keeps original ids).

    Region / province / municipality labels are resolved from the process-level
    cache; level and attribute-type from public catalogs; parent from same page.
    """
    if not rows:
        return rows

    region_ids = {r["region_id"] for r in rows if r.get("region_id") is not None}
    province_ids = {r["province_id"] for r in rows if r.get("province_id") is not None}
    municipality_ids = {r["municipality_id"] for r in rows if r.get("municipality_id") is not None}
    level_ids = {r["level_id"] for r in rows if r.get("level_id") is not None}
    attr_ids = {r["attribute_type_id"] for r in rows if r.get("attribute_type_id") is not None}

    regions = _resolve_regions(session, region_ids)
    provinces = _resolve_provinces(session, province_ids)
    municipalities = _resolve_municipalities(session, municipality_ids)

    levels: dict[int, str | None] = {}
    if level_ids:
        stmt = select(AreaLevelModel.level_id, AreaLevelModel.level_name).where(
            AreaLevelModel.level_id.in_(level_ids)
        )
        levels = {i: n for i, n in session.execute(stmt).all()}

    attr_labels = _resolve_attribute_type_labels(session, attr_ids)
    page_names = _names_from_page(rows)

    enriched: list[dict[str, Any]] = []
    for r in rows:
        rid = r.get("region_id")
        pid = r.get("province_id")
        mid = r.get("municipality_id")
        lid = r.get("level_id")
        atid = r.get("attribute_type_id")
        par = r.get("parent_id")
        parent_key = (
            (int(par), int(rid), int(pid))
            if par is not None and rid is not None and pid is not None
            else None
        )
        enriched.append(
            {
                **r,
                "region_label": regions.get(rid) if rid is not None else None,
                "province_label": provinces.get(pid) if pid is not None else None,
                "municipality_label": municipalities.get(mid) if mid is not None else None,
                "level_id_label": levels.get(lid) if lid is not None else None,
                "parent_label": page_names.get(parent_key) if parent_key else None,
                "attribute_type_label": attr_labels.get(atid) if atid is not None else None,
            }
        )
    return enriched


def enrich_green_asset_table_rows(session: Session, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Add *_label fields for FK columns on green_assets table rows.

    Green-area labels are not resolved from PostGIS (lakehouse-only); left None
    unless a future lakehouse label join is added.
    """
    if not rows:
        return rows

    region_ids = {r["region_id"] for r in rows if r.get("region_id") is not None}
    province_ids = {r["province_id"] for r in rows if r.get("province_id") is not None}
    municipality_ids = {r["municipality_id"] for r in rows if r.get("municipality_id") is not None}
    attr_ids = {r["attribute_type_id"] for r in rows if r.get("attribute_type_id") is not None}

    regions = _resolve_regions(session, region_ids)
    provinces = _resolve_provinces(session, province_ids)
    municipalities = _resolve_municipalities(session, municipality_ids)

    attr_labels = _resolve_attribute_type_labels(session, attr_ids)

    enriched: list[dict[str, Any]] = []
    for r in rows:
        rid = r.get("region_id")
        pid = r.get("province_id")
        mid = r.get("municipality_id")
        atid = r.get("attribute_type_id")
        enriched.append(
            {
                **r,
                "region_label": regions.get(rid) if rid is not None else None,
                "province_label": provinces.get(pid) if pid is not None else None,
                "municipality_label": municipalities.get(mid) if mid is not None else None,
                "attribute_type_label": attr_labels.get(atid) if atid is not None else None,
                "green_area_label": None,
            }
        )
    return enriched
