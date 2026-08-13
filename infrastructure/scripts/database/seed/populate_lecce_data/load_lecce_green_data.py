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
from datetime import datetime, timezone
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

# Keys promoted from GeoJSON properties to typed columns (excluded from attributes JSONB).
_AREA_ATTRS_PROMOTED = frozenset({"tipologia2", "data_rilie", "denominaz", "denominazione"})

# GeoJSON property → English attributes key (areas). Only listed keys are kept.
_AREA_ATTR_KEY_MAP: dict[str, str] = {
    "ubicazione": "location",
    "superficie": "surface_area_m2",
    "numero_ril": "survey_number",
    "gestione": "management_code",
    "neces_manu": "maintenance_need",
    "Note_dubbi": "notes",
    "% area col": "canopy_cover_class",
    "% area pra": "lawn_cover_class",
    "% area arb": "shrub_cover_class",
}

# Taxonomy already stored in family/genus/species columns — exclude from JSONB.
_ASSET_ATTRS_PROMOTED = frozenset({
    "Famiglia", "Genere", "Specie",
    "geometry", "green_area_id", "index_right", "_aid", "id",
})

# GeoJSON property → English attributes key (assets). Multiple source aliases share one target.
# Only listed keys are kept; unknown GeoJSON fields are dropped.
_ASSET_ATTR_KEY_MAP: dict[str, str] = {
    "ubicazione": "location",
    "Divisione": "division",
    "tipologia": "plant_type_code",
    "Tipologia": "plant_type_code",
    "tipo aiuol": "bed_type",
    "Toponomast": "place_name",
    "Sigla_spec": "species_code",
    "sigla_spec": "species_code",
    "data_ri_po": "point_survey_date",
    "data ri_po": "point_survey_date",
    "data_ri_qu": "quality_survey_date",
    "altezza_cl": "height_class",
    "altezza_1p": "first_branch_height_m",
    "cop_su_chi": "soil_cover_under_crown",
    "cop_su_col": "soil_cover_at_collar",
    "imp_irrig": "irrigation",
    "num_fusti": "stem_count",
    "forma_chio": "crown_shape",
    "dia_med_cl": "crown_diameter_m",
    "dia_min_cl": "crown_diameter_min_m",
    "dia_max_cl": "crown_diameter_max_m",
    "id_visibil": "visibility_id",
    "circonf_tr": "trunk_circumference_cm",
    "circonf_mr": "trunk_circumference_method",
    "valutaz_pr": "priority_assessment",
    "metodo ril": "survey_method",
    "Note liber": "free_notes",
    "note_gen": "general_notes",
    "stato_lavo": "work_status",
    "note_fito": "phytosanitary_notes",
    "note fito": "phytosanitary_notes",
    "%_sec_chio": "crown_dry_percent",
    "tipo_buca": "planting_pit_type",
    "h ril circ": "circumference_measure_height_cm",
    "Lunghezza": "length_m",
    "N_ind.": "specimen_count",
}


def _is_empty_attr_value(value: object) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and (pd.isna(value) or str(value) == "nan"):
        return True
    try:
        if pd.isna(value):
            return True
    except (TypeError, ValueError):
        pass
    if isinstance(value, str):
        s = value.strip()
        return not s or s.lower() in ("nat", "none", "null", "nan")
    return False


def _normalize_attr_value(value: object) -> object:
    """Coerce GeoJSON values to JSON-friendly scalars (dates → ISO date string)."""
    if hasattr(value, "item") and not isinstance(value, (bytes, str)):
        try:
            value = value.item()
        except (ValueError, AttributeError):
            pass
    if isinstance(value, datetime):
        return value.date().isoformat()
    # pandas Timestamp
    if hasattr(value, "to_pydatetime"):
        try:
            dt = value.to_pydatetime()
            if isinstance(dt, datetime):
                return dt.date().isoformat()
        except (TypeError, ValueError):
            pass
    if isinstance(value, str):
        text = value.strip()
        # Prefer ISO date when the field looks like a calendar date (YYYY-MM-DD / DD/MM/YYYY).
        if len(text) >= 8 and ("-" in text or "/" in text) and any(ch.isdigit() for ch in text):
            ts = pd.to_datetime(text, errors="coerce", utc=True)
            if ts is not None and not pd.isna(ts):
                return ts.date().isoformat()
        return text
    if isinstance(value, (int, float, bool)):
        if isinstance(value, float) and value.is_integer():
            return int(value)
        return value
    return str(value)


def build_english_attributes(
    row: object,
    key_map: dict[str, str],
    *,
    exclude: frozenset[str] | None = None,
) -> dict[str, object]:
    """Map GeoJSON properties to English keys; keep only mapped non-empty values."""
    exclude = exclude or frozenset()
    out: dict[str, object] = {}
    items = row.items() if hasattr(row, "items") else []
    for src_key, value in items:
        if src_key in exclude or src_key not in key_map:
            continue
        if isinstance(src_key, str) and src_key.startswith("_"):
            continue
        if _is_empty_attr_value(value):
            continue
        eng = key_map[src_key]
        # First non-empty wins when aliases map to the same English key.
        if eng in out:
            continue
        out[eng] = _normalize_attr_value(value)
    return out


# Lecce tipologia2 → cadastre.istat_green_area_classification (ISTAT Ambiente urbano).
_TIPOLOGIA2_TO_ISTAT: dict[str, str] = {
    "aree di arredo urbano": "URBAN_FURNISHING",
    "piazzali alberati": "URBAN_FURNISHING",
    "verde attrezzato di quartiere": "EQUIPPED_GREEN",
    "verde attrezzato di vicinato": "EQUIPPED_GREEN",
    "parchi urbani": "URBAN_PARKS",
    "verde storico pubblico": "HISTORICAL_GREEN",
    "verde storico privato": "HISTORICAL_GREEN",
    "giardini scolastici comunali": "SCHOOL_GARDENS",
    "aree sportive a prevalente superficie a verde": "OUTDOOR_SPORTS",
    "verde incolto": "UNCULTIVATED_GREEN",
    "forestazione urbana": "URBAN_FORESTRY",
    "orti urbani": "URBAN_ALLOTMENTS",
    "orti botanici": "BOTANICAL_GARDENS",
    "aree cimiteriali a prevalente superficie a verde": "CEMETERIES",
}


def map_tipologia2_to_istat(tipologia2: object) -> str | None:
    """Map municipal tipologia2 label to ISTAT enum; unknown → OTHER; empty → None."""
    if tipologia2 is None or (isinstance(tipologia2, float) and str(tipologia2) == "nan"):
        return None
    key = str(tipologia2).strip().lower()
    if not key or key in ("nat", "none"):
        return None
    return _TIPOLOGIA2_TO_ISTAT.get(key, "OTHER")


def _is_plausible_survey_year(year: object) -> bool:
    try:
        y = int(year)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return False
    return 1900 <= y <= 2100


def parse_survey_date(value: object) -> datetime | None:
    """Parse GeoJSON data_rilie into timestamptz; NaT / invalid → None.

    GeoPandas promotes mixed null/ISO date columns to datetime64, so missing
    values arrive as ``pd.NaT``. ``isinstance(NaT, datetime)`` is True; returning
    NaT to psycopg can persist a non-Python-representable timestamptz and break
    SQLAlchemy loads (``ValueError: year … is out of range``).
    """
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(value, datetime):
        if not _is_plausible_survey_year(getattr(value, "year", None)):
            return None
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    text = str(value).strip()
    if not text or text.lower() in ("nat", "none", "null", "nan"):
        return None
    try:
        ts = pd.to_datetime(text, errors="coerce", utc=True)
    except (TypeError, ValueError):
        return None
    if ts is None or pd.isna(ts) or not _is_plausible_survey_year(getattr(ts, "year", None)):
        return None
    py = ts.to_pydatetime()
    return py if py.tzinfo else py.replace(tzinfo=timezone.utc)


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
            classification = map_tipologia2_to_istat(row.get("tipologia2"))
            survey_date = parse_survey_date(row.get("data_rilie"))
            attrs = build_english_attributes(
                row, _AREA_ATTR_KEY_MAP, exclude=_AREA_ATTRS_PROMOTED
            )
            wkt_geom = row.geometry.wkt if hasattr(row.geometry, "wkt") else row.geometry
            # Schema: 02-init-schema-cadastre.sql green_areas. NOT NULL: region_id, province_id,
            # municipality_id, name, level (default 1); we set level_id (FK area_level), geometry_type,
            # geometry (4326), area_classification, istat_classification, survey_date, attributes,
            # attribute_type_id. Other columns use DEFAULT or NULL.
            cur.execute(
                """
                INSERT INTO cadastre.green_areas (
                    region_id, province_id, municipality_id, name, level, level_id,
                    geometry_type, geometry, area_classification, istat_classification,
                    survey_date, attributes, attribute_type_id
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s,
                    -- Source polygons can self-intersect; invalid geometries make the map
                    -- vendor's JSTS click hit-test throw TopologyException on every click.
                    ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromText(%s), %s)), 3)),
                    %s, %s, %s, %s, %s
                )
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
                    classification,
                    classification,
                    survey_date,
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
                attrs = build_english_attributes(
                    row, _ASSET_ATTR_KEY_MAP, exclude=_ASSET_ATTRS_PROMOTED
                )
                wkt_geom = row.geometry.wkt if hasattr(row.geometry, "wkt") else row.geometry
                # Schema: 02-init-schema-cadastre.sql green_assets. NOT NULL: region_id, province_id,
                # municipality_id, asset_type, geometry_type, geometry; we set attribute_type_id,
                # family, genus, species, attributes (English keys only). Other columns DEFAULT/NULL.
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

            # Viewport cluster matviews aggregate green_assets; without a refresh
            # the map would keep serving pre-load (or empty) clusters.
            print("Refreshing viewport cluster materialized views...")
            with conn.cursor() as cur:
                cur.execute("REFRESH MATERIALIZED VIEW cadastre.green_asset_admin_clusters")
                cur.execute("REFRESH MATERIALIZED VIEW cadastre.green_asset_grid_clusters")

        print("Done.")
        return 0
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
