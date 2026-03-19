"""Batch-resolve FK ids to human-readable labels for green area / asset table APIs.

Region, province and municipality names are considered immutable at runtime and
are held in process-level dicts after the first DB lookup.  Attribute-type and
green-area names can change via user actions and are always resolved from the DB.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select, tuple_
from sqlalchemy.orm import Session

from territory.areas.domain.entities.green_area_model import GreenAreaModel
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


def _attribute_type_label(row: AttributeTypeModel) -> str | None:
    return row.description_code or row.ts_code


def enrich_green_area_table_rows(session: Session, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Add *_label fields for FK columns (keeps original ids).

    Region / province / municipality labels are resolved from the process-level
    cache; level, attribute-type and parent-area labels always hit the DB.
    """
    if not rows:
        return rows

    region_ids = {r["region_id"] for r in rows if r.get("region_id") is not None}
    province_ids = {r["province_id"] for r in rows if r.get("province_id") is not None}
    municipality_ids = {r["municipality_id"] for r in rows if r.get("municipality_id") is not None}
    level_ids = {r["level_id"] for r in rows if r.get("level_id") is not None}
    attr_ids = {r["attribute_type_id"] for r in rows if r.get("attribute_type_id") is not None}

    parent_keys: set[tuple[int, int, int]] = set()
    for r in rows:
        pid = r.get("parent_id")
        if pid is not None and r.get("region_id") is not None and r.get("province_id") is not None:
            parent_keys.add((int(pid), int(r["region_id"]), int(r["province_id"])))

    regions = _resolve_regions(session, region_ids)
    provinces = _resolve_provinces(session, province_ids)
    municipalities = _resolve_municipalities(session, municipality_ids)

    levels: dict[int, str | None] = {}
    if level_ids:
        stmt = select(AreaLevelModel.level_id, AreaLevelModel.level_name).where(
            AreaLevelModel.level_id.in_(level_ids)
        )
        levels = {i: n for i, n in session.execute(stmt).all()}

    attr_labels: dict[int, str | None] = {}
    if attr_ids:
        stmt = select(AttributeTypeModel).where(AttributeTypeModel.id.in_(attr_ids))
        for at in session.scalars(stmt):
            attr_labels[at.id] = _attribute_type_label(at)

    parent_labels: dict[tuple[int, int, int], str | None] = {}
    if parent_keys:
        stmt = select(
            GreenAreaModel.id,
            GreenAreaModel.region_id,
            GreenAreaModel.province_id,
            GreenAreaModel.name,
        ).where(
            tuple_(GreenAreaModel.id, GreenAreaModel.region_id, GreenAreaModel.province_id).in_(
                list(parent_keys)
            )
        )
        for aid, rid, pid, name in session.execute(stmt):
            parent_labels[(int(aid), int(rid), int(pid))] = name

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
                "parent_label": parent_labels.get(parent_key) if parent_key else None,
                "attribute_type_label": attr_labels.get(atid) if atid is not None else None,
            }
        )
    return enriched


def enrich_green_asset_table_rows(session: Session, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Add *_label fields for FK columns on green_assets table rows.

    Region / province / municipality labels are resolved from the process-level
    cache; attribute-type and green-area labels always hit the DB.
    """
    if not rows:
        return rows

    region_ids = {r["region_id"] for r in rows if r.get("region_id") is not None}
    province_ids = {r["province_id"] for r in rows if r.get("province_id") is not None}
    municipality_ids = {r["municipality_id"] for r in rows if r.get("municipality_id") is not None}
    attr_ids = {r["attribute_type_id"] for r in rows if r.get("attribute_type_id") is not None}

    green_area_keys: set[tuple[int, int, int]] = set()
    for r in rows:
        gaid = r.get("green_area_id")
        if gaid is not None and r.get("region_id") is not None and r.get("province_id") is not None:
            green_area_keys.add((int(gaid), int(r["region_id"]), int(r["province_id"])))

    regions = _resolve_regions(session, region_ids)
    provinces = _resolve_provinces(session, province_ids)
    municipalities = _resolve_municipalities(session, municipality_ids)

    attr_labels: dict[int, str | None] = {}
    if attr_ids:
        stmt = select(AttributeTypeModel).where(AttributeTypeModel.id.in_(attr_ids))
        for at in session.scalars(stmt):
            attr_labels[at.id] = _attribute_type_label(at)

    green_area_labels: dict[tuple[int, int, int], str | None] = {}
    if green_area_keys:
        stmt = select(
            GreenAreaModel.id,
            GreenAreaModel.region_id,
            GreenAreaModel.province_id,
            GreenAreaModel.name,
        ).where(
            tuple_(GreenAreaModel.id, GreenAreaModel.region_id, GreenAreaModel.province_id).in_(
                list(green_area_keys)
            )
        )
        for aid, rid, pid, name in session.execute(stmt):
            green_area_labels[(int(aid), int(rid), int(pid))] = name

    enriched: list[dict[str, Any]] = []
    for r in rows:
        rid = r.get("region_id")
        pid = r.get("province_id")
        mid = r.get("municipality_id")
        atid = r.get("attribute_type_id")
        gaid = r.get("green_area_id")
        ga_key = (
            (int(gaid), int(rid), int(pid))
            if gaid is not None and rid is not None and pid is not None
            else None
        )
        enriched.append(
            {
                **r,
                "region_label": regions.get(rid) if rid is not None else None,
                "province_label": provinces.get(pid) if pid is not None else None,
                "municipality_label": municipalities.get(mid) if mid is not None else None,
                "attribute_type_label": attr_labels.get(atid) if atid is not None else None,
                "green_area_label": green_area_labels.get(ga_key) if ga_key else None,
            }
        )
    return enriched
