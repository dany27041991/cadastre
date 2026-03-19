"""Serialize ORM entities to JSON-serializable dicts for table APIs (no geometry)."""

from datetime import datetime
from decimal import Decimal
from functools import lru_cache
from typing import Any

from sqlalchemy.inspection import inspect

_ALWAYS_SKIP = frozenset({"geometry"})


@lru_cache(maxsize=16)
def _get_mapper_columns(model: type) -> tuple:
    """Cache the column list for each ORM model class (called once per model type)."""
    return tuple(inspect(model).columns)


def _json_val(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (dict, list)):
        return v
    return v


def orm_to_row_dict(
    model: type,
    instance: Any,
    *,
    exclude: frozenset[str] | None = None,
) -> dict[str, Any]:
    """Scalar columns only; skips geometry and any additional columns in *exclude*."""
    skip = _ALWAYS_SKIP | (exclude or frozenset())
    out: dict[str, Any] = {}
    for col in _get_mapper_columns(model):
        if col.key in skip:
            continue
        out[col.key] = _json_val(getattr(instance, col.key, None))
    return out
