"""
Load public.sub_municipal_area from submunicipal/area_submunicipal_lv1/2/3.geojson.
Depends on public.municipalities. Geometry: EPSG:32632 → 4326.
"""
import json

import config


def _municipality_lookup(conn, cod_reg, cod_uts, pro_com):
    """Resolve municipality_id from COD_REG + COD_UTS + PRO_COM.
    istat_code in DB = first 3 digits (province ordinal in region) + last 3 (PRO_COM % 1000)."""
    reg_code = str(int(cod_reg)).zfill(2) if isinstance(cod_reg, (int, float)) else str(cod_reg)
    prov_code = str(int(cod_uts))
    pro_com_int = int(pro_com)
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT row_number() OVER (ORDER BY p.id) AS rn
            FROM public.provinces p
            JOIN public.regions r ON r.id = p.region_id
            WHERE r.code = %s AND p.code = %s
            """,
            (reg_code, prov_code),
        )
        row = cur.fetchone()
        if not row:
            return None
        ordinal = row[0]
        istat = f"{ordinal:03d}{pro_com_int % 1000:03d}"
        cur.execute("SELECT id FROM public.municipalities WHERE istat_code = %s", (istat,))
        mrow = cur.fetchone()
        return mrow[0] if mrow else None


def _load_level(conn, level, filename, code_key, code_t_key, name_key, type_key):
    path = config.get_data_dir() / "submunicipal" / filename
    if not path.exists():
        print(f"  Skip sub_municipal_area level {level}: {path} not found")
        return 0
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    count = 0
    with conn.cursor() as cur:
        for feat in data.get("features", []):
            props = feat.get("properties", {})
            cod_reg = props.get("COD_REG")
            cod_uts = props.get("COD_UTS")
            pro_com = props.get("PRO_COM")
            if cod_reg is None or cod_uts is None or pro_com is None:
                continue
            municipality_id = _municipality_lookup(conn, cod_reg, cod_uts, pro_com)
            if municipality_id is None:
                continue
            code = props.get(code_t_key) or props.get(code_key)
            if code is not None:
                code = str(int(code)) if isinstance(code, (int, float)) else str(code).strip()
            else:
                code = ""
            name = (props.get(name_key) or "").strip() or code or "?"
            area_type = (props.get(type_key) or "").strip() or None
            geom = config.geom_to_geojson(feat)
            cur.execute(
                """
                INSERT INTO public.sub_municipal_area (municipality_id, parent_id, level, code, name, area_type, geometry)
                VALUES (%s, NULL, %s, %s, %s, %s, ST_Multi(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(%s), %s), %s)))
                ON CONFLICT (municipality_id, level, code) DO UPDATE SET
                  name = EXCLUDED.name,
                  area_type = EXCLUDED.area_type,
                  geometry = EXCLUDED.geometry
                """,
                (municipality_id, level, code, name, area_type, geom, config.SRID_SUBMUNICIPAL, config.SRID_WGS84),
            )
            count += 1
    print(f"  Sub-municipal area level {level}: {count}")
    return count


def load(conn):
    n1 = _load_level(conn, 1, "area_submunicipal_lv1.geojson", "COM_ASC1", "COD_ASC1_T", "DEN_ASC1", "TIPO_ASC1")
    n2 = _load_level(conn, 2, "area_submunicipal_lv2.geojson", "COM_ASC2", "COD_ASC2_T", "DEN_ASC2", "TIPO_ASC2")
    n3 = _load_level(conn, 3, "area_submunicipal_lv3.geojson", "COM_ASC3", "COD_ASC3_T", "DEN_ASC3", "TIPO_ASC3")
    return n1 + n2 + n3
