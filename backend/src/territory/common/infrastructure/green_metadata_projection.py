"""Shared projection of curated green area/asset metadata fields.

Used by detail DTO and table list rows so rules (NaN, π, ST_Area fallback)
stay in one place. Spec: 2026-08-12 green-detail-metadata-subset.
"""

from __future__ import annotations

import math
from datetime import date, datetime
from typing import Any

MISSING = "NaN"

AREA_METADATA_KEYS: tuple[str, ...] = (
    "name",
    "area_code",
    "area_classification",
    "istat_classification",
    "intensity_of_fruition",
    "perimeter_type",
    "survey_date",
    "surface_area_m2",
)

ASSET_METADATA_KEYS: tuple[str, ...] = (
    "plant_code",
    "species_code",
    "area_code",
    "latitude",
    "longitude",
    "survey_date",
    "species",
    "genus",
    "variety",
    "trunk_diameter_cm",
    "plant_height_m",
    "crown_diameter_m",
    "growth_stage",
    "protection_status",
    "health_status",
)

_AREA_FORMATS = {
    "survey_date": "survey_date",
    "surface_area_m2": "surface",
}

_ASSET_FORMATS = {
    "survey_date": "survey_date",
    "latitude": "coord",
    "longitude": "coord",
    "trunk_diameter_cm": "diameter",
    "plant_height_m": "height",
    "crown_diameter_m": "diameter",
}


def _attrs(row: dict[str, Any]) -> dict[str, Any]:
    raw = row.get("attributes")
    return raw if isinstance(raw, dict) else {}


def _attr(row: dict[str, Any], key: str) -> Any:
    return _attrs(row).get(key)


def _to_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(n) or math.isinf(n):
        return None
    return n


def _fmt(value: Any) -> str | None:
    if value is None or value == "":
        return None
    text = str(value)
    return text if text.strip() else None


def _fmt_survey_date(value: Any) -> str | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = str(value).strip()
    if not text:
        return None
    if "T" in text:
        return text.split("T", 1)[0]
    if " " in text and len(text) >= 10:
        return text[:10]
    return text


def fmt_or_nan(value: Any, *, kind: str = "plain") -> str:
    if kind == "survey_date":
        formatted = _fmt_survey_date(value)
    elif kind == "coord":
        n = _to_float(value)
        formatted = f"{n:.6f}" if n is not None else None
    elif kind == "surface":
        n = _to_float(value)
        formatted = str(int(round(n))) if n is not None else None
    elif kind == "diameter":
        n = _to_float(value)
        formatted = f"{n:.1f}" if n is not None else None
    elif kind == "height":
        n = _to_float(value)
        if n is None:
            formatted = None
        else:
            formatted = str(int(n)) if n == int(n) else f"{n:.1f}"
    else:
        formatted = _fmt(value)
    return formatted if formatted is not None else MISSING


def _trunk_diameter_cm(attrs: dict[str, Any]) -> float | None:
    direct = _to_float(attrs.get("trunk_diameter_cm"))
    if direct is not None:
        return direct
    circumference = _to_float(attrs.get("trunk_circumference_cm"))
    if circumference is None or circumference <= 0:
        return None
    return circumference / math.pi


def _plant_height_m(attrs: dict[str, Any]) -> float | None:
    for key in ("plant_height_m", "height_m"):
        n = _to_float(attrs.get(key))
        if n is not None:
            return n
    return None


def _surface_area_m2(row: dict[str, Any]) -> float | None:
    from_attr = _to_float(_attr(row, "surface_area_m2"))
    if from_attr is not None:
        return from_attr
    return _to_float(row.get("surface_area_m2_computed"))


def prepare_area_raw_values(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": row.get("name"),
        "area_code": row.get("zril_identifier"),
        "area_classification": row.get("area_classification"),
        "istat_classification": row.get("istat_classification"),
        "intensity_of_fruition": row.get("intensity_of_fruition"),
        "perimeter_type": row.get("perimeter_type"),
        "survey_date": row.get("survey_date"),
        "surface_area_m2": _surface_area_m2(row),
    }


def prepare_asset_raw_values(row: dict[str, Any]) -> dict[str, Any]:
    attrs = _attrs(row)
    return {
        "plant_code": row.get("id"),
        "species_code": attrs.get("species_code"),
        "area_code": row.get("green_area_id"),
        "latitude": row.get("latitude"),
        "longitude": row.get("longitude"),
        "survey_date": row.get("survey_date"),
        "species": row.get("species"),
        "genus": row.get("genus"),
        "variety": row.get("variety"),
        "trunk_diameter_cm": _trunk_diameter_cm(attrs),
        "plant_height_m": _plant_height_m(attrs),
        "crown_diameter_m": _to_float(attrs.get("crown_diameter_m")),
        "growth_stage": row.get("growth_stage"),
        "protection_status": row.get("protection_status"),
        "health_status": row.get("health_status"),
    }


def project_area_metadata(row: dict[str, Any]) -> dict[str, str]:
    raw = prepare_area_raw_values(row)
    return {
        key: fmt_or_nan(raw.get(key), kind=_AREA_FORMATS.get(key, "plain"))
        for key in AREA_METADATA_KEYS
    }


def project_asset_metadata(row: dict[str, Any]) -> dict[str, str]:
    raw = prepare_asset_raw_values(row)
    return {
        key: fmt_or_nan(raw.get(key), kind=_ASSET_FORMATS.get(key, "plain"))
        for key in ASSET_METADATA_KEYS
    }


def merge_area_table_row(row: dict[str, Any]) -> dict[str, Any]:
    """Keep technical ids + labels; overlay curated product keys as strings."""
    return {**row, **project_area_metadata(row)}


def merge_asset_table_row(row: dict[str, Any]) -> dict[str, Any]:
    return {**row, **project_asset_metadata(row)}
