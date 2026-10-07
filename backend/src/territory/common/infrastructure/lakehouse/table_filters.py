"""Shared DuckDB WHERE fragments for green areas/assets table + viewport filters.

Product query keys match FE ``greenTableFilterFields`` / design
``2026-10-07-green-filters-cerca-map-table-design.md``. Unknown keys ignored.
"""

from __future__ import annotations

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
        "survey_date",
        "surface_area_m2",
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
        "trunk_diameter_cm",
        "plant_height_m",
        "crown_diameter_m",
        "survey_date",
        "growth_stage",
        "protection_status",
        "health_status",
        "asset_type",
        "geometry_type",
        "asset_status",
    }
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


def _exact_or_ilike(column: str, value: str, enum_values: frozenset[str] | None) -> str:
    if enum_values is not None and value in enum_values:
        return f"{column} = {_sql_str(value)}"
    return _ilike(column, value)


def _numeric_or_ilike(column: str, value: str) -> str:
    try:
        num = float(value.strip().replace(",", "."))
    except (TypeError, ValueError, AttributeError):
        return _ilike(column, value)
    # Exact float compare is fragile; use rounded text match on cast.
    return (
        f"(TRY_CAST({column} AS DOUBLE) IS NOT NULL "
        f"AND ABS(TRY_CAST({column} AS DOUBLE) - {num}) < 1e-6)"
    )


def _int_eq(column: str, value: str) -> str:
    try:
        n = int(str(value).strip())
    except (TypeError, ValueError):
        return "1=0"
    return f"{column} = {n}"


def area_filter_where(filters: dict[str, Any] | None) -> list[str]:
    """WHERE fragments for green areas (AND). Remaps product keys to silver columns."""
    if not filters:
        return []
    out: list[str] = []
    for key, raw in filters.items():
        if not _truthy(raw):
            continue
        val = str(raw).strip()
        if key == "q":
            out.append(_ilike("name", val))
        elif key == "name":
            out.append(_ilike("name", val))
        elif key == "area_code":
            out.append(_ilike("zril_identifier", val))
        elif key == "zril_identifier":
            out.append(_ilike("zril_identifier", val))
        elif key in _AREA_ENUMS:
            out.append(_exact_or_ilike(key, val, _AREA_ENUMS[key]))
        elif key == "survey_date":
            out.append(_ilike("survey_date", val))
        elif key == "surface_area_m2":
            out.append(_numeric_or_ilike("surface_area_m2", val))
        # unknown keys ignored
    return out


def asset_filter_where(filters: dict[str, Any] | None) -> list[str]:
    """WHERE fragments for green assets (AND). Remaps product keys to silver columns."""
    if not filters:
        return []
    out: list[str] = []
    for key, raw in filters.items():
        if not _truthy(raw):
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
        elif key in ("trunk_diameter_cm", "plant_height_m", "crown_diameter_m"):
            out.append(_numeric_or_ilike(key, val))
        elif key == "survey_date":
            out.append(_ilike("survey_date", val))
        elif key in _ASSET_ENUMS:
            out.append(_exact_or_ilike(key, val, _ASSET_ENUMS[key]))
        elif key in ("asset_type", "geometry_type", "asset_status", "health_status"):
            # legacy exact keys still accepted
            enum = _ASSET_ENUMS.get(key)
            out.append(_exact_or_ilike(key, val, enum))
        # unknown keys ignored
    return out
