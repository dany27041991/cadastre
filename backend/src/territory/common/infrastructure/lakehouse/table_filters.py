"""Shared DuckDB WHERE fragments for green areas/assets table + viewport filters.

Product query keys match FE ``greenTableFilterFields`` / design
``2026-10-08-green-filters-range-national-speed-design.md``.
Numeric and date fields use min/max or from/to range keys. Unknown keys ignored.
"""

from __future__ import annotations

import re
from typing import Any, Mapping

# Product keys accepted on /table and /viewport (same names as FE form).
AREA_FILTER_KEYS: frozenset[str] = frozenset(
    {
        "q",
        "name",
        "area_code",
        "zril_identifier",
        "area_classification",
        "istat_classification",
        "intensity_of_fruition",
        "perimeter_type",
        "survey_date_from",
        "survey_date_to",
        "surface_area_m2_min",
        "surface_area_m2_max",
    }
)

ASSET_FILTER_KEYS: frozenset[str] = frozenset(
    {
        "q",
        "plant_code",
        "area_code",
        "species_code",
        "latitude",
        "longitude",
        "species",
        "genus",
        "variety",
        "trunk_diameter_cm_min",
        "trunk_diameter_cm_max",
        "plant_height_m_min",
        "plant_height_m_max",
        "crown_diameter_m_min",
        "crown_diameter_m_max",
        "survey_date_from",
        "survey_date_to",
        "growth_stage",
        "protection_status",
        "health_status",
        "asset_type",
        "geometry_type",
        "asset_status",
    }
)

_DATE_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")


def area_filters_are_selective(filters: dict[str, Any] | None) -> bool:
    """True when product filters are attribute-selective (codes / classification).

    Used only to choose scan strategy from filter predicates — never from
    municipality ids parsed out of ZRIL codes.

    ``name`` is intentionally excluded: short ILIKE terms (e.g. ``area``) are
    near-national and must keep the widespread probe short-circuit (debug
    4fe799: name=area + selective → 30s+ match scan → NetworkError empty UI).
    """
    if not filters:
        return False
    return any(
        _truthy(filters.get(k))
        for k in ("area_code", "zril_identifier", "area_classification")
    )


def collect_filters(
    params: Mapping[str, str],
    keys: frozenset[str],
) -> dict[str, str]:
    """Pick non-empty product filter params from a query mapping."""
    out: dict[str, str] = {}
    for key in keys:
        val = params.get(key)
        if val is not None and str(val).strip() != "":
            out[key] = str(val).strip()
    return out


# Prefix for area-column filters forwarded on asset /viewport (cross-filter).
AREA_FILTER_QUERY_PREFIX = "area__"


def collect_prefixed_filters(
    params: Mapping[str, str],
    keys: frozenset[str],
    *,
    prefix: str = AREA_FILTER_QUERY_PREFIX,
) -> dict[str, str]:
    """Collect ``prefix+key`` query params into a product-key filter dict."""
    stripped: dict[str, str] = {}
    for raw_key, raw_val in params.items():
        if not raw_key.startswith(prefix):
            continue
        stripped[raw_key[len(prefix) :]] = raw_val
    return collect_filters(stripped, keys)


# Mirrors frontend FILTER_ENUM_VALUES (exact match when value is in set).
_AREA_ENUMS: dict[str, frozenset[str]] = {
    "area_classification": frozenset(
        {
            "HISTORICAL_GREEN",
            "URBAN_PARKS",
            "EQUIPPED_GREEN",
            "URBAN_FURNISHING",
            "SCHOOL_GARDENS",
            "OUTDOOR_SPORTS",
            "URBAN_FORESTRY",
            "WOODLAND",
            "UNCULTIVATED_GREEN",
            "URBAN_ALLOTMENTS",
            "BOTANICAL_GARDENS",
            "ZOOLOGICAL_GARDENS",
            "CEMETERIES",
            "OTHER",
        }
    ),
    "istat_classification": frozenset(
        {
            "HISTORICAL_GREEN",
            "URBAN_PARKS",
            "EQUIPPED_GREEN",
            "URBAN_FURNISHING",
            "SCHOOL_GARDENS",
            "OUTDOOR_SPORTS",
            "URBAN_FORESTRY",
            "WOODLAND",
            "UNCULTIVATED_GREEN",
            "URBAN_ALLOTMENTS",
            "BOTANICAL_GARDENS",
            "ZOOLOGICAL_GARDENS",
            "CEMETERIES",
            "OTHER",
        }
    ),
    "intensity_of_fruition": frozenset({"NONE", "LOW", "MEDIUM", "HIGH"}),
    "perimeter_type": frozenset({"REAL", "FICTITIOUS"}),
}

_ASSET_ENUMS: dict[str, frozenset[str]] = {
    "growth_stage": frozenset(
        {"YOUNG", "SEMI_MATURE", "MATURE", "OVERMATURE", "DEAD"}
    ),
    "protection_status": frozenset(
        {"NONE", "PROTECTED", "MONUMENTAL", "HISTORICAL"}
    ),
    "health_status": frozenset(
        {"UNKNOWN", "HEALTHY", "DEGRADED", "DECLINING", "SICK", "DECEASED"}
    ),
}


def _sql_str(value: str) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def _truthy(val: Any) -> bool:
    if val is None:
        return False
    if isinstance(val, str) and not val.strip():
        return False
    return True


def _ilike(column: str, value: str) -> str:
    return f"CAST({column} AS VARCHAR) ILIKE {_sql_str('%' + value + '%')}"


def _ilike_exact(column: str, value: str) -> str:
    """Case-insensitive equality (no ``%`` wildcards)."""
    return f"lower(CAST({column} AS VARCHAR)) = lower({_sql_str(value)})"


def _exact_or_ilike(column: str, value: str, enum_values: frozenset[str] | None) -> str:
    if enum_values is not None and value in enum_values:
        return f"{column} = {_sql_str(value)}"
    return _ilike(column, value)


def _int_eq(column: str, value: str) -> str:
    try:
        n = int(str(value).strip())
    except (TypeError, ValueError):
        return "1=0"
    return f"{column} = {n}"


def _parse_double(value: str) -> float | None:
    try:
        return float(str(value).strip().replace(",", "."))
    except (TypeError, ValueError, AttributeError):
        return None


def _sql_number(n: float) -> str:
    """Stable SQL literal (avoid ``20.0`` when input was ``20``)."""
    if n == int(n) and abs(n) < 1e15:
        return str(int(n))
    return repr(n)


def _parse_date_iso(value: str) -> str | None:
    """Return YYYY-MM-DD if valid calendar-ish ISO date, else None."""
    m = _DATE_RE.match(str(value).strip())
    if not m:
        return None
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if mo < 1 or mo > 12 or d < 1 or d > 31:
        return None
    return f"{y:04d}-{mo:02d}-{d:02d}"


def _range_double(
    column: str,
    min_raw: Any | None,
    max_raw: Any | None,
) -> str | None:
    """Build numeric range clause; None if both ends empty; ``1=0`` if invalid."""
    has_min = _truthy(min_raw)
    has_max = _truthy(max_raw)
    if not has_min and not has_max:
        return None
    lo = _parse_double(str(min_raw)) if has_min else None
    hi = _parse_double(str(max_raw)) if has_max else None
    if has_min and lo is None:
        return "1=0"
    if has_max and hi is None:
        return "1=0"
    if lo is not None and hi is not None and lo > hi:
        return "1=0"
    parts = [f"TRY_CAST({column} AS DOUBLE) IS NOT NULL"]
    if lo is not None:
        parts.append(f"TRY_CAST({column} AS DOUBLE) >= {_sql_number(lo)}")
    if hi is not None:
        parts.append(f"TRY_CAST({column} AS DOUBLE) <= {_sql_number(hi)}")
    return "(" + " AND ".join(parts) + ")"


def _range_date(
    column: str,
    from_raw: Any | None,
    to_raw: Any | None,
) -> str | None:
    """Build date range clause; None if both ends empty; ``1=0`` if invalid."""
    has_from = _truthy(from_raw)
    has_to = _truthy(to_raw)
    if not has_from and not has_to:
        return None
    lo = _parse_date_iso(str(from_raw)) if has_from else None
    hi = _parse_date_iso(str(to_raw)) if has_to else None
    if has_from and lo is None:
        return "1=0"
    if has_to and hi is None:
        return "1=0"
    if lo is not None and hi is not None and lo > hi:
        return "1=0"
    parts = [f"TRY_CAST({column} AS DATE) IS NOT NULL"]
    if lo is not None:
        parts.append(f"TRY_CAST({column} AS DATE) >= DATE {_sql_str(lo)}")
    if hi is not None:
        parts.append(f"TRY_CAST({column} AS DATE) <= DATE {_sql_str(hi)}")
    return "(" + " AND ".join(parts) + ")"


def _append_range_double(
    out: list[str],
    filters: dict[str, Any],
    column: str,
    min_key: str,
    max_key: str,
) -> None:
    clause = _range_double(column, filters.get(min_key), filters.get(max_key))
    if clause is not None:
        out.append(clause)


def _append_range_date(
    out: list[str],
    filters: dict[str, Any],
    column: str = "survey_date",
) -> None:
    clause = _range_date(column, filters.get("survey_date_from"), filters.get("survey_date_to"))
    if clause is not None:
        out.append(clause)


def area_filter_where(filters: dict[str, Any] | None) -> list[str]:
    """WHERE fragments for green areas (AND). Remaps product keys to silver columns."""
    if not filters:
        return []
    out: list[str] = []
    for key, raw in filters.items():
        if not _truthy(raw):
            continue
        # Range ends handled once below (avoid duplicate when iterating both keys).
        if key in (
            "surface_area_m2_min",
            "surface_area_m2_max",
            "survey_date_from",
            "survey_date_to",
        ):
            continue
        val = str(raw).strip()
        if key == "q":
            out.append(_ilike("name", val))
        elif key == "name":
            out.append(_ilike("name", val))
        elif key == "area_code":
            # Form text search: same ILIKE as name (no ZRIL municipality hints).
            out.append(_ilike("zril_identifier", val))
        elif key == "zril_identifier":
            out.append(_ilike("zril_identifier", val))
        elif key in _AREA_ENUMS:
            out.append(_exact_or_ilike(key, val, _AREA_ENUMS[key]))
        # unknown / legacy single-value numeric-date keys ignored
    _append_range_double(
        out, filters, "surface_area_m2", "surface_area_m2_min", "surface_area_m2_max"
    )
    _append_range_date(out, filters)
    return out


def asset_filter_where(filters: dict[str, Any] | None) -> list[str]:
    """WHERE fragments for green assets (AND). Remaps product keys to silver columns."""
    if not filters:
        return []
    out: list[str] = []
    range_skip = {
        "trunk_diameter_cm_min",
        "trunk_diameter_cm_max",
        "plant_height_m_min",
        "plant_height_m_max",
        "crown_diameter_m_min",
        "crown_diameter_m_max",
        "survey_date_from",
        "survey_date_to",
    }
    for key, raw in filters.items():
        if not _truthy(raw):
            continue
        if key in range_skip:
            continue
        val = str(raw).strip()
        if key == "q":
            safe = val.replace("'", "''")
            out.append(
                "("
                f"species ILIKE '%{safe}%' OR family ILIKE '%{safe}%' "
                f"OR genus ILIKE '%{safe}%' OR variety ILIKE '%{safe}%'"
                ")"
            )
        elif key == "plant_code":
            out.append(_int_eq("id", val))
        elif key == "area_code":
            out.append(_int_eq("green_area_id", val))
        elif key in ("species", "genus", "variety", "species_code"):
            out.append(_ilike(key, val))
        elif key == "latitude":
            out.append(_ilike("lat", val))
        elif key == "longitude":
            out.append(_ilike("lon", val))
        elif key in _ASSET_ENUMS:
            out.append(_exact_or_ilike(key, val, _ASSET_ENUMS[key]))
        elif key in ("asset_type", "geometry_type", "asset_status", "health_status"):
            enum = _ASSET_ENUMS.get(key)
            out.append(_exact_or_ilike(key, val, enum))
        # unknown / legacy single-value measure keys ignored
    _append_range_double(
        out,
        filters,
        "trunk_diameter_cm",
        "trunk_diameter_cm_min",
        "trunk_diameter_cm_max",
    )
    _append_range_double(
        out, filters, "plant_height_m", "plant_height_m_min", "plant_height_m_max"
    )
    _append_range_double(
        out,
        filters,
        "crown_diameter_m",
        "crown_diameter_m_min",
        "crown_diameter_m_max",
    )
    _append_range_date(out, filters)
    return out
