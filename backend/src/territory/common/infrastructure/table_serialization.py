"""Serialize ORM entities to JSON-serializable dicts for table APIs (no geometry)."""

from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.inspection import inspect


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


def orm_to_row_dict(model: type, instance: Any) -> dict[str, Any]:
    """Scalar columns only; skips geometry."""
    out: dict[str, Any] = {}
    mapper = inspect(model)
    for col in mapper.columns:
        if col.key == "geometry":
            continue
        out[col.key] = _json_val(getattr(instance, col.key, None))
    return out
