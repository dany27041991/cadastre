"""Geometry WKB → GeoJSON conversion and bbox helpers."""

from __future__ import annotations

import json
from typing import Any


def _wkb_to_geojson(
    geom_wkb: bytes | memoryview | None, lon: float | None, lat: float | None
) -> dict | None:
    if geom_wkb is not None:
        try:
            from shapely import to_geojson, wkb

            geom = wkb.loads(bytes(geom_wkb))
            return json.loads(to_geojson(geom))
        except Exception:
            pass
    if lon is not None and lat is not None:
        return {"type": "Point", "coordinates": [float(lon), float(lat)]}
    return None


def read_asset_geometry(row: dict[str, Any]) -> dict[str, Any] | None:
    return _wkb_to_geojson(row.get("geom_wkb"), row.get("lon"), row.get("lat"))


def read_asset_bbox(row: dict[str, Any]) -> list[float] | None:
    geom = read_asset_geometry(row)
    if geom is None:
        return None
    try:
        from shapely.geometry import shape

        b = shape(geom).bounds  # minx, miny, maxx, maxy
        return [float(b[0]), float(b[1]), float(b[2]), float(b[3])]
    except Exception:
        lon, lat = row.get("lon"), row.get("lat")
        if lon is None or lat is None:
            return None
        return [float(lon), float(lat), float(lon), float(lat)]


def _parse_clip_geom(clip_wkt: str | None):
    """Parse validated POLYGON/MULTIPOLYGON WKT to shapely geometry, or None."""
    if not clip_wkt:
        return None
    from shapely import wkt as shapely_wkt

    from territory.common.infrastructure.clip_wkt import normalize_clip_wkt

    text = normalize_clip_wkt(clip_wkt)
    if text is None:
        return None
    return shapely_wkt.loads(text)
