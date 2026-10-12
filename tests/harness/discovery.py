"""Discover sample filter values from municipal Lecce /table rows."""

from __future__ import annotations

from typing import Any

from harness import http_client

# FE projected keys that may appear as NaN strings
_MISSING = {"NaN", "nan", "", "None"}

_AREA_ROW_KEY = {
    "name": "name",
    "area_code": "area_code",  # projected from zril_identifier
    "surface_area_m2": "surface_area_m2",
    "area_classification": "area_classification",
    "istat_classification": "istat_classification",
    "intensity_of_fruition": "intensity_of_fruition",
    "perimeter_type": "perimeter_type",
    "survey_date": "survey_date",
}

_ASSET_ROW_KEY = {
    "plant_code": "plant_code",
    "area_code": "area_code",
    "species_code": "species_code",
    "latitude": "latitude",
    "longitude": "longitude",
    "species": "species",
    "genus": "genus",
    "variety": "variety",
    "trunk_diameter_cm": "trunk_diameter_cm",
    "plant_height_m": "plant_height_m",
    "crown_diameter_m": "crown_diameter_m",
    "survey_date": "survey_date",
    "growth_stage": "growth_stage",
    "protection_status": "protection_status",
    "health_status": "health_status",
}


def _usable(val: Any) -> str | None:
    if val is None:
        return None
    s = str(val).strip()
    if not s or s in _MISSING:
        return None
    # survey_date may be ISO datetime
    if "T" in s and len(s) >= 10:
        return s[:10]
    return s


def discover_value(
    kind: str,
    filter_key: str,
    scope_params: dict[str, Any],
    fallback: str,
    *,
    run_id: str = "discover",
) -> tuple[str, bool]:
    """Return (value, from_discovery)."""
    mapping = _AREA_ROW_KEY if kind == "area" else _ASSET_ROW_KEY
    row_key = mapping.get(filter_key, filter_key)
    res = http_client.table(
        kind,
        scope_params,
        None,
        case_id=f"discover-{kind}-{filter_key}",
        scope="municipal",
        run_id=run_id,
        page=1,
        page_size=20,
    )
    if res["status"] != 200:
        return fallback, False
    for row in res["data"]:
        if not isinstance(row, dict):
            continue
        val = _usable(row.get(row_key))
        if val is None and filter_key == "area_code" and kind == "area":
            val = _usable(row.get("zril_identifier"))
        if val is None and filter_key == "plant_code":
            val = _usable(row.get("id"))
        if val is None and filter_key == "area_code" and kind == "asset":
            val = _usable(row.get("green_area_id"))
        if val is not None:
            # ILIKE-friendly: use prefix for long text
            if filter_key in {"name", "species", "genus", "variety", "species_code"} and len(val) > 12:
                return val[:12], True
            # Numeric / coords: truncate for single-value ILIKE; ranges use same mid.
            if filter_key in {
                "surface_area_m2",
                "trunk_diameter_cm",
                "plant_height_m",
                "crown_diameter_m",
                "latitude",
                "longitude",
            }:
                try:
                    n = float(val)
                    if filter_key in {"latitude", "longitude"}:
                        return f"{n:.2f}", True
                    if n == int(n):
                        return str(int(n)), True
                    return f"{n:.1f}", True
                except ValueError:
                    pass
            return val, True
    return fallback, False


def filter_query_params(filter_key: str, value: str, meta: dict[str, Any]) -> dict[str, str]:
    """Expand catalog base key + discovered mid into wire query params (incl. ranges)."""
    kind = str(meta.get("kind") or "text")
    if kind == "number-range":
        return {f"{filter_key}_min": value, f"{filter_key}_max": value}
    if kind == "date-range":
        return {f"{filter_key}_from": value, f"{filter_key}_to": value}
    return {filter_key: value}


def primary_log_key(filter_key: str, meta: dict[str, Any]) -> str:
    """Key expected in FILTER_TEST_LOG ``filters`` for require(filter_key=…)."""
    kind = str(meta.get("kind") or "text")
    if kind == "number-range":
        return f"{filter_key}_min"
    if kind == "date-range":
        return f"{filter_key}_from"
    return filter_key


def discover_green_area_id(scope_params: dict[str, Any], *, run_id: str = "discover") -> int | None:
    res = http_client.table(
        "area",
        scope_params,
        None,
        case_id="discover-green-area-id",
        scope="municipal",
        run_id=run_id,
        page=1,
        page_size=5,
    )
    if res["status"] != 200:
        return None
    for row in res["data"]:
        if isinstance(row, dict) and row.get("id") is not None:
            return int(row["id"])
    return None
