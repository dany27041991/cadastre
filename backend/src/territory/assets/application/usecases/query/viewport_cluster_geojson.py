"""GeoJSON builders for admin/grid cluster features."""

from __future__ import annotations

from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.assets.infrastructure.repository.viewport_cluster import ViewportCluster
from territory.assets.application.usecases.query.viewport_grid import mercator_to_lon_lat


def admin_features_collection(clusters: list[ViewportCluster]) -> GeoJSONFeatureCollection:
    """Build GeoJSON FeatureCollection from admin clusters."""
    features = []
    for cluster in clusters:
        features.append(
            {
                "type": "Feature",
                "id": cluster.sample_id,
                "properties": {
                    "id": cluster.sample_id,
                    "cluster": True,
                    "cluster_count": cluster.count,
                    "cluster_key": cluster.admin_key,
                    "cluster_bbox": list(cluster.bbox),
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [cluster.lon, cluster.lat],
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}


def grid_clusters_features_collection(clusters: list[ViewportCluster]) -> GeoJSONFeatureCollection:
    """Build GeoJSON FeatureCollection from grid clusters."""
    features = []
    for cluster in clusters:
        lon, lat = mercator_to_lon_lat(cluster.merc_x, cluster.merc_y)
        features.append(
            {
                "type": "Feature",
                "id": cluster.sample_id,
                "properties": {
                    "id": cluster.sample_id,
                    "cluster": True,
                    "cluster_count": cluster.count,
                    "cluster_key": f"{cluster.cell_x},{cluster.cell_y}",
                    "cluster_bbox": list(cluster.bbox),
                },
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
            }
        )
    return {"type": "FeatureCollection", "features": features}
