"""Builds a GeoJSON FeatureCollection from database query rows."""

import json
from typing import Any

from core.logger import log_invocation


@log_invocation(log_args=True, log_result=False)
def build_feature_collection(
    rows: list[tuple],
    property_names: list[str],
) -> dict[str, Any]:
    """
    Build a GeoJSON FeatureCollection from rows.
    Each row must be (id, geometry_json, *values) with values matching property_names.
    """
    features = []
    for row in rows:
        feature_id = row[0]
        geometry = row[1]
        values = row[2:]
        if geometry is None:
            continue
        geometry_dict = geometry if isinstance(geometry, dict) else json.loads(geometry)
        properties: dict[str, Any] = {"id": feature_id}
        for i, name in enumerate(property_names):
            if i < len(values):
                properties[name] = values[i]
        features.append({
            "type": "Feature",
            "id": feature_id,
            "properties": properties,
            "geometry": geometry_dict,
        })
    return {"type": "FeatureCollection", "features": features}
