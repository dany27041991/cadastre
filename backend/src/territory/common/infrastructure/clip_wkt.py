"""Validate optional clip WKT (EPSG:4326 polygon) for viewport/table queries."""

from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.sql.elements import ColumnElement

CLIP_WKT_MAX_LEN = 16_000


class ClipWktError(ValueError):
    """Invalid clip_wkt query parameter."""


def normalize_clip_wkt(clip_wkt: str | None) -> str | None:
    """Return stripped WKT or None. Raises ClipWktError if present but invalid."""
    if clip_wkt is None:
        return None
    text = clip_wkt.strip()
    if not text:
        return None
    if len(text) > CLIP_WKT_MAX_LEN:
        raise ClipWktError("clip_wkt too long")
    head = text.split("(", 1)[0].strip().upper()
    if head not in {"POLYGON", "MULTIPOLYGON"}:
        raise ClipWktError("clip_wkt must be POLYGON or MULTIPOLYGON")
    return text


def st_intersects_clip(geometry_col, clip_wkt: str | None) -> ColumnElement[bool] | None:
    """SQL ST_Intersects(geometry, clip) or None when no clip."""
    wkt = normalize_clip_wkt(clip_wkt)
    if wkt is None:
        return None
    return func.ST_Intersects(geometry_col, func.ST_GeomFromText(wkt, 4326))
