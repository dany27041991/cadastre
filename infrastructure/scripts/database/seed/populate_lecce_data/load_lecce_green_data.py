#!/usr/bin/env python3
"""
Tree Cadastre - Seed: load green areas and green assets from municipality GeoJSON.

Loads in order:
  1. areas.geojson → cadastre.green_areas (level 1 = MANAGEMENT_UNIT)
  2. hedges.geojson, shrubs.geojson, trees.geojson → cadastre.green_assets,
     with green_area_id set by spatial containment in the loaded areas.

Source CRS: EPSG:32633 (WGS 84 / UTM 33N). Storage: EPSG:4326.
Aligned with docs/database (green_areas, green_assets, area_level, asset_type)
and DBT catalog: docs/database/obt/types (primary_types, secondary_types, attribute_types).

Usage:
  From host (requires DATABASE_URL, DATA_DIR):
    python load_lecce_green_data.py [--municipality Lecce] [--data-dir PATH]
  In Docker (init image):
    python3 /scripts/database/seed/populate_lecce_data/load_lecce_green_data.py --municipality Lecce
    (DATA_DIR=/data, DATABASE_URL from env)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import warnings
from pathlib import Path

# Pyogrio warns when GeoJSON features have duplicate/missing id; it fixes them. We do not use that id.
warnings.filterwarnings("ignore", message="Several features with id = 0 have been found")

try:
    import pandas as pd
    import geopandas as gpd
    import psycopg
except ImportError as e:
    print(f"Error: missing dependency - {e}", file=sys.stderr)
    sys.exit(1)

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------
# Catalog and level references must match the init SQL that populates the DB:
#   01-init-schema-public.sql     (area_level, primary_types, secondary_types, attribute_types)
#   01-init-seed-01-area-level.sql   → level_id 1 = MANAGEMENT_UNIT
#   01-init-seed-02-primary-types.sql → TP 1–4
#   01-init-seed-03-secondary-types.sql → TS: id 3 = Pianta (ts_code 03), id 25 = Area convenzionata (ts_code 25)
#   01-init-seed-04-attribute-types.sql → (secondary_type_id, ts_code, geom_type) UNIQUE lookup
#   02-init-schema-cadastre.sql   (green_areas.attribute_type_id, level_id; green_assets.attribute_type_id)
#   02b-1-seed-cadastre-enum-translations.sql (asset_type, geometry_type enums)
SRID_SOURCE = 32633  # GeoJSON Lecce
SRID_TARGET = 4326
LEVEL_MANAGEMENT_UNIT = 1
LEVEL_ID_MANAGEMENT = 1  # area_level.level_id 1 = MANAGEMENT_UNIT (01-init-seed-01-area-level.sql)
AREA_GEOMETRY_TYPE = "S"  # Surface (MultiPolygon); cadastre.geometry_type
DEFAULT_AREA_NAME = "Area verde"
ASSET_FILES = (
    ("hedges.geojson", "hedge", "L"),   # asset_type, geometry_type (cadastre enums)
    ("shrubs.geojson", "other", "P"),   # shrub → asset_type other; DBT ATT 109 Cespuglio
    ("trees.geojson", "tree", "P"),
)

# DBT catalog: resolve attribute_type_id from public.attribute_types (same keys as 01-init-seed-04).
# (secondary_type_id, ts_code, geom_type) → id. Areas: TS 25 ATT 500 S. Assets: TS 03 ATT 107 L, 108 P, 109 P.
AREA_ATTRIBUTE_TYPE = (25, "500", "S")   # Limite area di gestione (id 45 in seed)
ASSET_ATTRIBUTE_TYPES = {
    ("hedge", "L"): (3, "107", "L"),   # Siepe (id 32)
    ("tree", "P"): (3, "108", "P"),    # Albero (id 33)
    ("other", "P"): (3, "109", "P"),   # Cespuglio singolo/arbusto (id 34)
}


def get_database_url() -> str | None:
    return os.environ.get(
        "DATABASE_DIRECT_URL",
        os.environ.get("DATABASE_URL"),
    )


def get_data_dir(municipality_name: str) -> Path:
    if "DATA_DIR" in os.environ:
        base = Path(os.environ["DATA_DIR"])
    else:
        # Script is in infrastructure/scripts/database/seed/populate_lecce_data/
        base = Path(__file__).resolve().parent.parent.parent.parent.parent.parent / "infrastructure" / "data"
    return base / "municipality" / municipality_name.lower().replace(" ", "_")


# -----------------------------------------------------------------------------
# DB helpers
# -----------------------------------------------------------------------------
def get_municipality_ids(conn, municipality_name: str) -> tuple[int, int, int] | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT m.id AS municipality_id, m.province_id, p.region_id
            FROM public.municipalities m
            JOIN public.provinces p ON p.id = m.province_id
            WHERE m.name = %s
            LIMIT 1
            """,
            (municipality_name.strip(),),
        )
        row = cur.fetchone()
    return (row[0], row[1], row[2]) if row else None


def get_attribute_type_id(
    conn, secondary_type_id: int, ts_code: str, geom_type: str
) -> int | None:
    """Resolve public.attribute_types.id from DBT catalog.
    Keys match 01-init-schema-public.sql UNIQUE(secondary_type_id, ts_code, geom_type)
    and 01-init-seed-04-attribute-types.sql INSERTs.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id FROM public.attribute_types
            WHERE secondary_type_id = %s AND ts_code = %s AND geom_type = %s
            LIMIT 1
            """,
            (secondary_type_id, ts_code, geom_type),
        )
        row = cur.fetchone()
    return row[0] if row else None


def delete_municipality_cadastre(conn, municipality_id: int) -> None:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM cadastre.green_assets WHERE municipality_id = %s", (municipality_id,))
        n_assets = cur.rowcount
        cur.execute("DELETE FROM cadastre.green_areas WHERE municipality_id = %s", (municipality_id,))
        n_areas = cur.rowcount
    print(f"  Cleared: {n_assets} green_assets, {n_areas} green_areas for municipality_id={municipality_id}")


def load_areas(
    conn,
    data_dir: Path,
    municipality_id: int,
    province_id: int,
    region_id: int,
    attribute_type_id: int | None,
) -> gpd.GeoDataFrame:
    areas_path = data_dir / "areas.geojson"
    if not areas_path.exists():
        raise FileNotFoundError(f"areas.geojson not found: {areas_path}")

    gdf = gpd.read_file(areas_path)
    if gdf.crs is None:
        gdf.set_crs(epsg=SRID_SOURCE, inplace=True)
    gdf = gdf.to_crs(epsg=SRID_TARGET)
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty]

    gdf["_db_id"] = None
    with conn.cursor() as cur:
        for _, row in gdf.iterrows():
            name = (row.get("denominaz") or row.get("denominazione") or DEFAULT_AREA_NAME)
            if name is None or (isinstance(name, float) and str(name) == "nan"):
                name = DEFAULT_AREA_NAME
            name = str(name).strip() or DEFAULT_AREA_NAME
            attrs = {
                k: v for k, v in row.items()
                if k not in ("geometry", "_db_id") and v is not None and not (isinstance(v, float) and str(v) == "nan")
            }
            attrs = {k: v for k, v in attrs.items() if not (isinstance(k, str) and k.startswith("_"))}
            wkt_geom = row.geometry.wkt if hasattr(row.geometry, "wkt") else row.geometry
            # Schema: 02-init-schema-cadastre.sql green_areas (146-179). NOT NULL: region_id, province_id,
            # municipality_id, name, level (default 1); we set level_id (FK area_level), geometry_type (cadastre.geometry_type),
            # geometry (4326), attributes, attribute_type_id. Other columns use DEFAULT or NULL.
            cur.execute(
                """
                INSERT INTO cadastre.green_areas (
                    region_id, province_id, municipality_id, name, level, level_id,
                    geometry_type, geometry, attributes, attribute_type_id
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, ST_SetSRID(ST_GeomFromText(%s), %s), %s, %s)
                RETURNING id
                """,
                (
                    region_id,
                    province_id,
                    municipality_id,
                    name[:255],
                    LEVEL_MANAGEMENT_UNIT,
                    LEVEL_ID_MANAGEMENT,
                    AREA_GEOMETRY_TYPE,
                    wkt_geom,
                    SRID_TARGET,
                    json.dumps(attrs, default=str),
                    attribute_type_id,
                ),
            )
            rid = cur.fetchone()[0]
            gdf.at[row.name, "_db_id"] = rid

    if "_db_id" not in gdf.columns:
        gdf["_db_id"] = None
    print(f"  Inserted {len(gdf)} green_areas")
    return gdf


def load_assets(
    conn,
    data_dir: Path,
    areas_gdf: gpd.GeoDataFrame,
    municipality_id: int,
    province_id: int,
    region_id: int,
    asset_attribute_type_ids: dict[tuple[str, str], int | None],
) -> None:
    if areas_gdf.empty or "_db_id" not in areas_gdf.columns:
        raise ValueError("No green_areas loaded; cannot assign green_area_id to assets")

    areas_for_join = areas_gdf[["_db_id", "geometry"]].copy()
    areas_for_join = areas_for_join.rename(columns={"_db_id": "green_area_id"})

    total = 0
    for filename, asset_type, geometry_type in ASSET_FILES:
        path = data_dir / filename
        if not path.exists():
            print(f"  Skip {filename}: not found")
            continue

        gdf = gpd.read_file(path)
        if gdf.crs is None:
            gdf.set_crs(epsg=SRID_SOURCE, inplace=True)
        gdf = gdf.to_crs(epsg=SRID_TARGET)
        gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty]
        if gdf.empty:
            print(f"  Skip {filename}: no valid geometries")
            continue

        # Spatial join: assign each asset to an area that contains it (one area per asset)
        gdf["_aid"] = range(len(gdf))
        gdf = gpd.sjoin(gdf, areas_for_join, how="left", predicate="within")
        gdf = gdf.drop_duplicates(subset=["_aid"], keep="first")
        gdf = gdf.drop(columns=["_aid"], errors="ignore")
        if "green_area_id" not in gdf.columns or gdf["green_area_id"].isna().all():
            gdf["green_area_id"] = None
        else:
            gdf["green_area_id"] = gdf["green_area_id"].astype("Int64")

        attr_type_id = asset_attribute_type_ids.get((asset_type, geometry_type))
        with conn.cursor() as cur:
            for _, row in gdf.iterrows():
                _gid = row.get("green_area_id")
                green_area_id = None if pd.isna(_gid) or _gid is None else int(_gid)
                genus = _str_prop(row, "Genere")
                species = _str_prop(row, "Specie")
                family = _str_prop(row, "Famiglia")
                skip = {"geometry", "green_area_id", "index_right", "_aid"}
                attrs = {
                    k: v for k, v in row.items()
                    if k not in skip and not (isinstance(k, str) and k.startswith("_"))
                    and v is not None and not pd.isna(v)
                }
                wkt_geom = row.geometry.wkt if hasattr(row.geometry, "wkt") else row.geometry
                # Schema: 02-init-schema-cadastre.sql green_assets (204-247). NOT NULL: region_id, province_id,
                # municipality_id, asset_type (cadastre.asset_type), geometry_type, geometry; we set attribute_type_id,
                # family, genus, species, attributes. Other columns use DEFAULT or NULL.
                cur.execute(
                    """
                    INSERT INTO cadastre.green_assets (
                        green_area_id, region_id, province_id, municipality_id,
                        asset_type, geometry_type, geometry, family, genus, species, attributes, attribute_type_id
                    ) VALUES (%s, %s, %s, %s, %s, %s, ST_SetSRID(ST_GeomFromText(%s), %s), %s, %s, %s, %s, %s)
                    """,
                    (
                        green_area_id,
                        region_id,
                        province_id,
                        municipality_id,
                        asset_type,
                        geometry_type,
                        wkt_geom,
                        SRID_TARGET,
                        family[:80] if family else None,
                        genus[:50] if genus else None,
                        species[:50] if species else None,
                        json.dumps(attrs, default=str),
                        attr_type_id,
                    ),
                )
                total += 1
        print(f"  Inserted {len(gdf)} green_assets from {filename} (asset_type={asset_type})")
    print(f"  Total green_assets inserted: {total}")


def _str_prop(row, key: str) -> str | None:
    v = row.get(key)
    if v is None or pd.isna(v):
        return None
    s = str(v).strip()
    return s if s else None


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(description="Load municipality green areas and assets from GeoJSON")
    parser.add_argument("--municipality", default="Lecce", help="Municipality name (default: Lecce)")
    parser.add_argument("--data-dir", type=Path, default=None, help="Directory containing areas.geojson, hedges.geojson, etc. Default: DATA_DIR/municipality/<name>")
    parser.add_argument("--no-clean", action="store_true", help="Do not delete existing green_areas/green_assets for the municipality")
    args = parser.parse_args()

    data_dir = args.data_dir or get_data_dir(args.municipality)
    if not data_dir.is_dir():
        print(f"Error: data directory not found: {data_dir}", file=sys.stderr)
        return 1

    url = get_database_url()
    if not url:
        print("Error: set DATABASE_URL or DATABASE_DIRECT_URL", file=sys.stderr)
        return 1

    print(f"Data dir: {data_dir}")
    print(f"Municipality: {args.municipality}")

    try:
        with psycopg.connect(url) as conn:
            conn.autocommit = True
            ids = get_municipality_ids(conn, args.municipality)
            if not ids:
                print(f"Error: municipality '{args.municipality}' not found in public.municipalities", file=sys.stderr)
                return 1
            municipality_id, province_id, region_id = ids
            print(f"  municipality_id={municipality_id}, province_id={province_id}, region_id={region_id}")

            # Resolve DBT attribute_type_id (catalog: primary_types, secondary_types, attribute_types)
            area_att_id = get_attribute_type_id(conn, *AREA_ATTRIBUTE_TYPE)
            if not area_att_id:
                print("Warning: attribute_type for areas (TS 25, ATT 500, S) not found in public.attribute_types", file=sys.stderr)
            asset_att_ids = {
                (k1, k2): get_attribute_type_id(conn, *v) for (k1, k2), v in ASSET_ATTRIBUTE_TYPES.items()
            }

            if not args.no_clean:
                print("Cleaning existing cadastre data for municipality...")
                delete_municipality_cadastre(conn, municipality_id)

            print("Loading green areas from areas.geojson...")
            areas_gdf = load_areas(conn, data_dir, municipality_id, province_id, region_id, area_att_id)
            if areas_gdf.empty:
                print("Error: no areas loaded", file=sys.stderr)
                return 1

            print("Loading green assets (hedges, shrubs, trees)...")
            load_assets(conn, data_dir, areas_gdf, municipality_id, province_id, region_id, asset_att_ids)

        print("Done.")
        return 0
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
