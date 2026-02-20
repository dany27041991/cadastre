#!/usr/bin/env python3
"""
Tree Cadastre - Entrypoint: load territorial hierarchy from GeoJSON into PostGIS.
Runs in order: regions → provinces → municipalities → sub_municipal_area (lv1, lv2, lv3) → census_section.

GeoJSON files (under DATA_DIR): region/regions.geojson, province/provinces.geojson,
municipality/municipalities.geojson, section/sections.geojson,
submunicipal/area_submunicipal_lv1|2|3.geojson. See docs/database/design/database-mapping-diagram.md.

Usage:
  python .../py/administrative_boundaries/load_geojson.py
  docker compose run --rm init python3 /scripts/init/postgis/py/administrative_boundaries/load_geojson.py

Environment: DATABASE_URL or DATABASE_DIRECT_URL, optional DATA_DIR.
"""
import sys
from pathlib import Path

# Allow importing config and loaders from subfolders (region, province, ...)
_script_dir = Path(__file__).resolve().parent
if str(_script_dir) not in sys.path:
    sys.path.insert(0, str(_script_dir))

try:
    import psycopg
except ImportError:
    print("Error: install psycopg (pip install psycopg[binary])")
    sys.exit(1)

import config
import municipality.load_municipalities
import province.load_provinces
import region.load_regions
import section.load_census_sections
import submunicipal.load_submunicipal


def main():
    print(f"Data dir: {config.get_data_dir()}")
    url = config.get_database_url()
    if not url:
        print("Error: DATABASE_URL or DATABASE_DIRECT_URL not set")
        sys.exit(1)
    try:
        with psycopg.connect(url) as conn:
            conn.autocommit = True
            print("Loading regions...")
            region.load_regions.load(conn)
            print("Loading provinces...")
            province.load_provinces.load(conn)
            print("Loading municipalities...")
            municipality.load_municipalities.load(conn)
            print("Loading sub-municipal areas (lv1, lv2, lv3)...")
            submunicipal.load_submunicipal.load(conn)
            print("Loading census sections...")
            section.load_census_sections.load(conn)
        print("Load done.")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
