"""
Load public.census_section from section/sections.geojson.
Depends on public.municipalities. Properties: istat_code → municipality_id, name, layer_type (sezione→census_section, località→locality).
Upsert by (municipality_id, COALESCE(code,''), name, layer_type): no duplicates on re-run.
"""
import json

import config

LAYER_MAP = {"sezione": "census_section", "località": "locality", "localita": "locality"}


def load(conn):
    path = config.get_data_dir() / "section" / "sections.geojson"
    if not path.exists():
        print(f"  Skip census_section: {path} not found")
        return 0
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    count = 0
    with conn.cursor() as cur:
        for feat in data.get("features", []):
            props = feat.get("properties", {})
            istat_code = (props.get("istat_code") or "").strip()
            if not istat_code:
                continue
            istat_code = str(istat_code).zfill(6) if istat_code.isdigit() else istat_code
            name = (props.get("name") or "").strip() or "?"
            layer_raw = (props.get("layer_type") or "").strip().lower()
            layer_type = LAYER_MAP.get(layer_raw, "census_section")
            code = (props.get("name") or "").strip() if layer_raw == "sezione" else None
            geom = config.geom_to_geojson(feat)
            cur.execute(
                """
                INSERT INTO public.census_section (municipality_id, code, name, layer_type, geometry)
                SELECT m.id, %s, %s, %s::public.census_layer_type, ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)
                FROM public.municipalities m WHERE m.istat_code = %s
                ON CONFLICT (municipality_id, COALESCE(code, ''), name, layer_type) DO UPDATE SET
                  geometry = EXCLUDED.geometry
                """,
                (code, name, layer_type, geom, istat_code),
            )
            count += 1
    print(f"  Census sections: {count}")
    return count
