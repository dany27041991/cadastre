"""
Load public.sub_municipal_area from submunicipal/area_submunicipal_lv1/2/3.geojson.
Depends on public.municipalities. Geometry: EPSG:32632 → 4326.
Upsert on (municipality_id, level, code): no duplicates on re-run.
Hierarchy: after loading all levels, parent_id is set for level 2 → level 1 and level 3 → level 2
using spatial containment: prefer full area containment (ST_Covers(parent, child)), then centroid, then largest intersection.
"""
import json

import config


def _fill_parent_id(conn):
    """Set parent_id for level 2 (parent = level 1) and level 3 (parent = level 2).
    Prefer: parent that fully contains the child area (ST_Covers). If multiple, pick smallest parent.
    Fallback 1: parent that contains the child centroid. Fallback 2: parent with largest intersection.
    """
    with conn.cursor() as cur:
        # Level 2: parent = level-1 area that fully contains this area (if several, smallest such parent)
        cur.execute(
            """
            UPDATE public.sub_municipal_area c
            SET parent_id = (
                SELECT p.id
                FROM public.sub_municipal_area p
                WHERE p.municipality_id = c.municipality_id AND p.level = 1
                  AND ST_Covers(p.geometry, c.geometry)
                ORDER BY ST_Area(p.geometry) ASC
                LIMIT 1
            )
            WHERE c.level = 2 AND c.parent_id IS NULL
            """
        )
        n2_contains = cur.rowcount
        # Level 2 fallback: centroid within parent
        cur.execute(
            """
            UPDATE public.sub_municipal_area c
            SET parent_id = (
                SELECT p.id
                FROM public.sub_municipal_area p
                WHERE p.municipality_id = c.municipality_id AND p.level = 1
                  AND ST_Covers(p.geometry, ST_Centroid(c.geometry))
                LIMIT 1
            )
            WHERE c.level = 2 AND c.parent_id IS NULL
            """
        )
        n2_centroid = cur.rowcount
        # Level 2 fallback 2: largest intersection
        cur.execute(
            """
            UPDATE public.sub_municipal_area c
            SET parent_id = (
                SELECT p.id
                FROM public.sub_municipal_area p
                WHERE p.municipality_id = c.municipality_id AND p.level = 1
                ORDER BY ST_Area(ST_Intersection(c.geometry, p.geometry)) DESC NULLS LAST
                LIMIT 1
            )
            WHERE c.level = 2 AND c.parent_id IS NULL
            """
        )
        n2_intersection = cur.rowcount

        # Level 3: same logic (parent = level 2)
        cur.execute(
            """
            UPDATE public.sub_municipal_area c
            SET parent_id = (
                SELECT p.id
                FROM public.sub_municipal_area p
                WHERE p.municipality_id = c.municipality_id AND p.level = 2
                  AND ST_Covers(p.geometry, c.geometry)
                ORDER BY ST_Area(p.geometry) ASC
                LIMIT 1
            )
            WHERE c.level = 3 AND c.parent_id IS NULL
            """
        )
        n3_contains = cur.rowcount
        cur.execute(
            """
            UPDATE public.sub_municipal_area c
            SET parent_id = (
                SELECT p.id
                FROM public.sub_municipal_area p
                WHERE p.municipality_id = c.municipality_id AND p.level = 2
                  AND ST_Covers(p.geometry, ST_Centroid(c.geometry))
                LIMIT 1
            )
            WHERE c.level = 3 AND c.parent_id IS NULL
            """
        )
        n3_centroid = cur.rowcount
        cur.execute(
            """
            UPDATE public.sub_municipal_area c
            SET parent_id = (
                SELECT p.id
                FROM public.sub_municipal_area p
                WHERE p.municipality_id = c.municipality_id AND p.level = 2
                ORDER BY ST_Area(ST_Intersection(c.geometry, p.geometry)) DESC NULLS LAST
                LIMIT 1
            )
            WHERE c.level = 3 AND c.parent_id IS NULL
            """
        )
        n3_intersection = cur.rowcount

    print(
        f"  parent_id: level 2 → by containment {n2_contains}, centroid {n2_centroid}, intersection {n2_intersection}; "
        f"level 3 → by containment {n3_contains}, centroid {n3_centroid}, intersection {n3_intersection}"
    )


def _municipality_lookup(conn, cod_reg, cod_uts, pro_com):
    """Resolve municipality_id from COD_REG + COD_UTS + PRO_COM.
    Municipalities are loaded with istat_code = PRO_COM_T (6 digits). We match by finding the
    province from (COD_REG, COD_UTS), then the municipality in that province whose istat_code
    has the same last 3 digits as PRO_COM % 1000. Use the province's istat prefix (first 3 digits
    of any municipality in that province) to build the full istat = prefix + (PRO_COM % 1000)."""
    reg_code = str(int(cod_reg)).zfill(2) if isinstance(cod_reg, (int, float)) else str(cod_reg)
    prov_code = str(int(cod_uts))
    pro_com_int = int(pro_com)
    suffix = f"{pro_com_int % 1000:03d}"
    with conn.cursor() as cur:
        # Get province_id and the 3-digit istat prefix from any municipality in that province
        cur.execute(
            """
            SELECT p.id,
                   (SELECT SUBSTRING(m.istat_code, 1, 3)
                    FROM public.municipalities m
                    WHERE m.province_id = p.id
                    LIMIT 1) AS istat_prefix
            FROM public.provinces p
            JOIN public.regions r ON r.id = p.region_id
            WHERE r.code = %s AND p.code = %s
            """,
            (reg_code, prov_code),
        )
        row = cur.fetchone()
        if not row:
            return None
        _province_id, istat_prefix = row
        if not istat_prefix:
            return None
        istat = istat_prefix + suffix
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
    if n1 + n2 + n3 > 0:
        print("  Filling parent_id (level 2 → 1, level 3 → 2)...")
        _fill_parent_id(conn)
    return n1 + n2 + n3
