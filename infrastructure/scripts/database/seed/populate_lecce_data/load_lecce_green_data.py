#!/usr/bin/env python3
"""
Tree Cadastre - Seed: load green areas and assets from municipality GeoJSON → MinIO lakehouse.

Writes silver Parquet (green_areas / green_assets), gold clusters, and catalog upsert.
PostGIS is used read-only for municipality / attribute_type lookups (admin + DBT catalog).

Source CRS: EPSG:32633 (WGS 84 / UTM 33N). Storage geometries: EPSG:4326 WKB.

Usage:
  From host (DATABASE_URL + LAKEHOUSE_S3_*, DATA_DIR optional):
    python load_lecce_green_data.py [--municipality Lecce] [--data-dir PATH] [--ingest-date YYYY-MM-DD]
  Via runner:
    ./infrastructure/scripts/database/seed/run_populate_lecce.sh
"""
from __future__ import annotations

import argparse
import os
import sys
import warnings
from datetime import date, datetime, timezone
from pathlib import Path

# Pyogrio warns when GeoJSON features have duplicate/missing id; it fixes them. We do not use that id.
warnings.filterwarnings("ignore", message="Several features with id = 0 have been found")

try:
    import geopandas as gpd
    import pandas as pd
    import psycopg
    import pyarrow as pa
    from shapely import make_valid, to_wkb
    from shapely.geometry.base import BaseGeometry
except ImportError as e:
    print(f"Error: missing dependency - {e}", file=sys.stderr)
    sys.exit(1)

_LAKEHOUSE_DIR = Path(__file__).resolve().parents[2] / "lakehouse"
if str(_LAKEHOUSE_DIR) not in sys.path:
    sys.path.insert(0, str(_LAKEHOUSE_DIR))

from lakehouse_writer import (  # noqa: E402
    ingest_municipality_tables,
    s3_client,
)

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------
# Catalog and level references must match the init SQL that populates the DB:
#   01-init-schema-public.sql     (area_level, primary_types, secondary_types, attribute_types)
#   01-init-seed-01-area-level.sql   → level_id 1 = MANAGEMENT_UNIT
# Silver lakehouse schema: docs/infrastructure/lakehouse-parquet-layout.md
SRID_SOURCE = 32633  # GeoJSON Lecce
SRID_TARGET = 4326
LEVEL_MANAGEMENT_UNIT = 1
DEFAULT_AREA_NAME = "Area verde"
ASSET_FILES = (
    ("hedges.geojson", "hedge", "L"),
    ("shrubs.geojson", "other", "P"),
    ("trees.geojson", "tree", "P"),
)

# DBT catalog lookup (informational / future columns); silver V1 does not store attribute_type_id.
AREA_ATTRIBUTE_TYPE = (25, "500", "S")
ASSET_ATTRIBUTE_TYPES = {
    ("hedge", "L"): (3, "107", "L"),
    ("tree", "P"): (3, "108", "P"),
    ("other", "P"): (3, "109", "P"),
}

_AREA_ATTRS_PROMOTED = frozenset({"tipologia2", "data_rilie", "denominaz", "denominazione"})

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

_ASSET_ATTRS_PROMOTED = frozenset({
    "Famiglia", "Genere", "Specie",
    "geometry", "green_area_id", "index_right", "_aid", "id",
})

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
    if hasattr(value, "to_pydatetime"):
        try:
            dt = value.to_pydatetime()
            if isinstance(dt, datetime):
                return dt.date().isoformat()
        except (TypeError, ValueError):
            pass
    if isinstance(value, str):
        text = value.strip()
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
        if eng in out:
            continue
        out[eng] = _normalize_attr_value(value)
    return out


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
    """Parse GeoJSON data_rilie into timestamptz; NaT / invalid → None."""
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
        base = (
            Path(__file__).resolve().parent.parent.parent.parent.parent.parent
            / "infrastructure"
            / "data"
        )
    return base / "municipality" / municipality_name.lower().replace(" ", "_")


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
    """Resolve public.attribute_types.id from DBT catalog (read-only check)."""
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


def _geom_to_wkb_lon_lat(geom: BaseGeometry) -> tuple[bytes | None, float | None, float | None]:
    if geom is None or geom.is_empty:
        return None, None, None
    try:
        fixed = make_valid(geom)
    except Exception:
        fixed = geom
    try:
        centroid = fixed.centroid
        lon = float(centroid.x)
        lat = float(centroid.y)
    except Exception:
        lon, lat = None, None
    try:
        wkb = to_wkb(fixed, hex=False)
    except Exception:
        wkb = None
    return wkb, lon, lat


def _str_prop(row, key: str) -> str | None:
    v = row.get(key)
    if v is None or pd.isna(v):
        return None
    s = str(v).strip()
    return s if s else None


def load_areas_table(
    data_dir: Path,
    municipality_id: int,
    province_id: int,
    region_id: int,
    ingest_date: date,
) -> tuple[gpd.GeoDataFrame, pa.Table]:
    areas_path = data_dir / "areas.geojson"
    if not areas_path.exists():
        raise FileNotFoundError(f"areas.geojson not found: {areas_path}")

    gdf = gpd.read_file(areas_path)
    if gdf.crs is None:
        gdf.set_crs(epsg=SRID_SOURCE, inplace=True)
    gdf = gdf.to_crs(epsg=SRID_TARGET)
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty].copy()
    gdf["_lh_id"] = range(1, len(gdf) + 1)

    ids: list[int] = []
    region_ids: list[int] = []
    province_ids: list[int] = []
    municipality_ids: list[int] = []
    ingest_dates: list[date] = []
    parent_ids: list[int | None] = []
    levels: list[int] = []
    names: list[str] = []
    lons: list[float | None] = []
    lats: list[float | None] = []
    wkbs: list[bytes | None] = []
    classifications: list[str | None] = []
    admin_statuses: list[str | None] = []
    survey_dates: list[datetime | None] = []

    for _, row in gdf.iterrows():
        name = row.get("denominaz") or row.get("denominazione") or DEFAULT_AREA_NAME
        if name is None or (isinstance(name, float) and str(name) == "nan"):
            name = DEFAULT_AREA_NAME
        name = str(name).strip() or DEFAULT_AREA_NAME
        classification = map_tipologia2_to_istat(row.get("tipologia2"))
        survey_date = parse_survey_date(row.get("data_rilie"))
        # attributes mapped for parity with legacy seed; silver V1 schema omits JSONB column
        _ = build_english_attributes(row, _AREA_ATTR_KEY_MAP, exclude=_AREA_ATTRS_PROMOTED)
        wkb, lon, lat = _geom_to_wkb_lon_lat(row.geometry)

        ids.append(int(row["_lh_id"]))
        region_ids.append(region_id)
        province_ids.append(province_id)
        municipality_ids.append(municipality_id)
        ingest_dates.append(ingest_date)
        parent_ids.append(None)
        levels.append(LEVEL_MANAGEMENT_UNIT)
        names.append(name[:255])
        lons.append(lon)
        lats.append(lat)
        wkbs.append(wkb)
        classifications.append(classification)
        admin_statuses.append("ACTIVE")
        survey_dates.append(survey_date)

    table = pa.table(
        {
            "id": pa.array(ids, type=pa.int64()),
            "region_id": pa.array(region_ids, type=pa.int32()),
            "province_id": pa.array(province_ids, type=pa.int32()),
            "municipality_id": pa.array(municipality_ids, type=pa.int32()),
            "ingest_date": pa.array(ingest_dates, type=pa.date32()),
            "parent_id": pa.array(parent_ids, type=pa.int64()),
            "level": pa.array(levels, type=pa.int32()),
            "name": pa.array(names, type=pa.string()),
            "lon": pa.array(lons, type=pa.float64()),
            "lat": pa.array(lats, type=pa.float64()),
            "geom_wkb": pa.array(wkbs, type=pa.binary()),
            "area_classification": pa.array(classifications, type=pa.string()),
            "administrative_status": pa.array(admin_statuses, type=pa.string()),
            "survey_date": pa.array(survey_dates, type=pa.timestamp("us", tz="UTC")),
        }
    )
    print(f"  Built {len(gdf)} green_areas (silver)")
    return gdf, table


def load_assets_table(
    data_dir: Path,
    areas_gdf: gpd.GeoDataFrame,
    municipality_id: int,
    province_id: int,
    region_id: int,
    ingest_date: date,
) -> pa.Table:
    if areas_gdf.empty or "_lh_id" not in areas_gdf.columns:
        raise ValueError("No green_areas loaded; cannot assign green_area_id to assets")

    areas_for_join = areas_gdf[["_lh_id", "geometry"]].copy()
    areas_for_join = areas_for_join.rename(columns={"_lh_id": "green_area_id"})

    ids: list[int] = []
    green_area_ids: list[int | None] = []
    region_ids: list[int] = []
    province_ids: list[int] = []
    municipality_ids: list[int] = []
    ingest_dates: list[date] = []
    asset_types: list[str] = []
    geometry_types: list[str] = []
    lons: list[float | None] = []
    lats: list[float | None] = []
    wkbs: list[bytes | None] = []
    species_l: list[str | None] = []
    family_l: list[str | None] = []
    genus_l: list[str | None] = []
    variety_l: list[str | None] = []
    health_l: list[str | None] = []
    status_l: list[str | None] = []
    survey_l: list[datetime | None] = []

    next_id = 1
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

        gdf = gdf.copy()
        gdf["_aid"] = range(len(gdf))
        gdf = gpd.sjoin(gdf, areas_for_join, how="left", predicate="within")
        gdf = gdf.drop_duplicates(subset=["_aid"], keep="first")
        gdf = gdf.drop(columns=["_aid"], errors="ignore")
        if "green_area_id" not in gdf.columns or gdf["green_area_id"].isna().all():
            gdf["green_area_id"] = None
        else:
            gdf["green_area_id"] = gdf["green_area_id"].astype("Int64")

        n_file = 0
        for _, row in gdf.iterrows():
            _gid = row.get("green_area_id")
            green_area_id = None if pd.isna(_gid) or _gid is None else int(_gid)
            genus = _str_prop(row, "Genere")
            species = _str_prop(row, "Specie")
            family = _str_prop(row, "Famiglia")
            _ = build_english_attributes(row, _ASSET_ATTR_KEY_MAP, exclude=_ASSET_ATTRS_PROMOTED)
            wkb, lon, lat = _geom_to_wkb_lon_lat(row.geometry)

            ids.append(next_id)
            next_id += 1
            green_area_ids.append(green_area_id)
            region_ids.append(region_id)
            province_ids.append(province_id)
            municipality_ids.append(municipality_id)
            ingest_dates.append(ingest_date)
            asset_types.append(asset_type)
            geometry_types.append(geometry_type)
            lons.append(lon)
            lats.append(lat)
            wkbs.append(wkb)
            species_l.append(species[:50] if species else None)
            family_l.append(family[:80] if family else None)
            genus_l.append(genus[:50] if genus else None)
            variety_l.append(None)
            health_l.append(None)
            status_l.append("ACTIVE")
            survey_l.append(None)
            n_file += 1
        print(f"  Built {n_file} green_assets from {filename} (asset_type={asset_type})")

    print(f"  Total green_assets: {len(ids)}")
    return pa.table(
        {
            "id": pa.array(ids, type=pa.int64()),
            "green_area_id": pa.array(green_area_ids, type=pa.int64()),
            "region_id": pa.array(region_ids, type=pa.int32()),
            "province_id": pa.array(province_ids, type=pa.int32()),
            "municipality_id": pa.array(municipality_ids, type=pa.int32()),
            "ingest_date": pa.array(ingest_dates, type=pa.date32()),
            "asset_type": pa.array(asset_types, type=pa.string()),
            "geometry_type": pa.array(geometry_types, type=pa.string()),
            "lon": pa.array(lons, type=pa.float64()),
            "lat": pa.array(lats, type=pa.float64()),
            "geom_wkb": pa.array(wkbs, type=pa.binary()),
            "species": pa.array(species_l, type=pa.string()),
            "family": pa.array(family_l, type=pa.string()),
            "genus": pa.array(genus_l, type=pa.string()),
            "variety": pa.array(variety_l, type=pa.string()),
            "health_status": pa.array(health_l, type=pa.string()),
            "asset_status": pa.array(status_l, type=pa.string()),
            "survey_date": pa.array(survey_l, type=pa.timestamp("us", tz="UTC")),
        }
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Load municipality GeoJSON green data into MinIO lakehouse"
    )
    parser.add_argument("--municipality", default="Lecce", help="Municipality name (default: Lecce)")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=None,
        help="Directory with areas.geojson, hedges.geojson, … Default: DATA_DIR/municipality/<name>",
    )
    parser.add_argument(
        "--ingest-date",
        default=date.today().isoformat(),
        help="Lakehouse batch date YYYY-MM-DD (default: today)",
    )
    args = parser.parse_args()

    data_dir = args.data_dir or get_data_dir(args.municipality)
    if not data_dir.is_dir():
        print(f"Error: data directory not found: {data_dir}", file=sys.stderr)
        return 1

    url = get_database_url()
    if not url:
        print("Error: set DATABASE_URL or DATABASE_DIRECT_URL", file=sys.stderr)
        return 1

    ingest_date = date.fromisoformat(args.ingest_date)
    print(f"Data dir: {data_dir}")
    print(f"Municipality: {args.municipality}")
    print(f"Ingest date: {ingest_date}")
    print("Target: MinIO lakehouse (silver + gold + catalog)")

    try:
        with psycopg.connect(url) as conn:
            ids = get_municipality_ids(conn, args.municipality)
            if not ids:
                print(
                    f"Error: municipality '{args.municipality}' not found in public.municipalities",
                    file=sys.stderr,
                )
                return 1
            municipality_id, province_id, region_id = ids
            print(
                f"  municipality_id={municipality_id}, province_id={province_id}, region_id={region_id}"
            )

            area_att_id = get_attribute_type_id(conn, *AREA_ATTRIBUTE_TYPE)
            if not area_att_id:
                print(
                    "Warning: attribute_type for areas (TS 25, ATT 500, S) not found "
                    "in public.attribute_types",
                    file=sys.stderr,
                )
            for (k1, k2), keys in ASSET_ATTRIBUTE_TYPES.items():
                if not get_attribute_type_id(conn, *keys):
                    print(
                        f"Warning: attribute_type for asset {k1}/{k2} not found",
                        file=sys.stderr,
                    )

        print("Loading green areas from areas.geojson...")
        areas_gdf, areas_table = load_areas_table(
            data_dir, municipality_id, province_id, region_id, ingest_date
        )
        if areas_gdf.empty:
            print("Error: no areas loaded", file=sys.stderr)
            return 1

        print("Loading green assets (hedges, shrubs, trees)...")
        assets_table = load_assets_table(
            data_dir, areas_gdf, municipality_id, province_id, region_id, ingest_date
        )

        meta = {
            "municipality_id": municipality_id,
            "province_id": province_id,
            "region_id": region_id,
            "name": args.municipality,
        }
        ingest_municipality_tables(
            s3_client(),
            meta=meta,
            assets=assets_table,
            areas=areas_table,
            ingest_date=ingest_date,
        )
        print("Done.")
        return 0
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
