"""
Tree Cadastre - Shared config and helpers for GeoJSON loaders (administrative boundaries).
Used by load_regions, load_provinces, load_municipalities, load_submunicipal, load_census_sections.
"""
import json
import os
from pathlib import Path

# Data directory: /data in container, or project infrastructure/data
def get_data_dir():
    if "DATA_DIR" in os.environ:
        return Path(os.environ["DATA_DIR"])
    # py/administrative_boundaries/config.py -> 6 parents to project root
    project_root = Path(__file__).resolve().parent.parent.parent.parent.parent.parent
    container_data = Path("/data")
    return container_data if container_data.exists() else (project_root / "infrastructure" / "data")


def get_database_url():
    return os.environ.get(
        "DATABASE_DIRECT_URL",
        os.environ.get("DATABASE_URL", "postgresql://cadastre:cadastre@postgis:5432/arboreal_green_cadastre"),
    )


# Coordinate reference systems (ISO 19111 / EPSG). Storage CRS = WGS 84 (4326).
# Submunicipal GeoJSON use EPSG:32632 (WGS 84 / UTM zone 32N); we transform to 4326 on load.
SRID_SUBMUNICIPAL = 32632   # EPSG:32632
SRID_WGS84 = 4326          # EPSG:4326 (WGS 84)


def geom_to_geojson(feat):
    """Return geometry of a GeoJSON feature as JSON string, or None."""
    return json.dumps(feat.get("geometry")) if feat.get("geometry") else None
