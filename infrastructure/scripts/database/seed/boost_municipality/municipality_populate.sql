-- =============================================================================
-- UPDATE MUNICIPALITY - POPULATE: generate areas and assets for target municipality
-- =============================================================================
-- Run after municipality_clean.sql (or on an empty municipality).
-- Target municipality: pass from terminal (run_boost_municipality.sh <comune>).
--
-- CONSTRAINT (no overlap): Where there are no surface (S) assets, lines (L) and points (P) can be placed; L and P must not intersect or overlap.
-- S in disjoint grid; gap = sub-area minus S; L and P only in the gap; P in gap minus buffer(L) so L and P never overlap.
--
-- Target orders of magnitude: aree verdi ~1.600, alberi ~320k, filari ~119k, prati 4–5k ha.
-- Session: work_mem, maintenance_work_mem, jit.
-- =============================================================================

\timing on
SET work_mem = '512MB';
SET maintenance_work_mem = '1GB';
SET max_parallel_workers_per_gather = 4;
SET synchronous_commit = OFF;
SET client_min_messages = WARNING;
SET jit = OFF;

-- =============================================================================
-- CONFIG: __TARGET_MUNICIPALITY__ sostituito da run_boost_municipality.sh
-- Ordini di grandezza: aree verdi ~1.600, alberi ~320k, filari ~119k (prati 4–5k ha da geometria).
-- =============================================================================
DO $$
DECLARE
    v_target_municipality TEXT := TRIM('__TARGET_MUNICIPALITY__');
    v_areas_min INT := 1500;
    v_areas_max INT := 1700;
    v_trees_min INT := 300000;
    v_trees_max INT := 340000;
    v_rows_min INT := 115000;
    v_rows_max INT := 123000;
BEGIN
    DROP TABLE IF EXISTS _seed_config;
    CREATE UNLOGGED TABLE _seed_config (
        target_municipality TEXT,
        areas_min INT, areas_max INT,
        trees_min INT, trees_max INT,
        rows_min INT, rows_max INT
    );
    INSERT INTO _seed_config VALUES (
        v_target_municipality, v_areas_min, v_areas_max,
        v_trees_min, v_trees_max, v_rows_min, v_rows_max
    );
    RAISE NOTICE 'Populate for municipality: %, areas ~1600, trees ~320k, rows ~119k', v_target_municipality;
END $$;

-- -----------------------------------------------------------------------------
-- STEP 1: Load target municipality
-- -----------------------------------------------------------------------------
\echo ''
\echo '[STEP 1] Loading target municipality...'

DROP TABLE IF EXISTS _seed_municipality;
CREATE UNLOGGED TABLE _seed_municipality AS
SELECT c.id AS municipality_id, c.istat_code, c.name AS municipality_name, c.geometry,
       ST_Area(c.geometry::geography) / 1000000.0 AS area_km2,
       c.province_id AS province_id, p.region_id AS region_id
FROM public.municipalities c
JOIN public.provinces p ON p.id = c.province_id
JOIN _seed_config cfg ON LOWER(TRIM(c.name)) = LOWER(TRIM(cfg.target_municipality))
WHERE c.geometry IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM _seed_municipality) THEN
        RAISE EXCEPTION 'Municipality not found: %', (SELECT target_municipality FROM _seed_config LIMIT 1);
    END IF;
END $$;

CREATE INDEX idx_seed_municipality_geom ON _seed_municipality USING GIST(geometry);

DROP TABLE IF EXISTS _seed_target_municipality;
CREATE TEMP TABLE _seed_target_municipality AS SELECT municipality_id FROM _seed_municipality;

SELECT municipality_name, istat_code, ROUND(area_km2::numeric, 2) AS area_km2 FROM _seed_municipality;

-- -----------------------------------------------------------------------------
-- STEP 2: Ensure province-level partitions exist (hierarchical: region→province)
-- 06-create-partitions.sql creates them at init; this is fallback if 06 skipped some.
-- -----------------------------------------------------------------------------
\echo ''
\echo '[STEP 2] Checking partitions...'

DO $$
DECLARE rec RECORD; p_av TEXT; p_ar TEXT; p_av_r TEXT; p_ar_r TEXT;
BEGIN
    FOR rec IN SELECT DISTINCT region_id, province_id FROM _seed_municipality
    LOOP
        p_av_r := 'cadastre.green_assets_' || rec.region_id;
        p_ar_r := 'cadastre.green_areas_' || rec.region_id;
        p_av := p_av_r || '_' || rec.province_id;
        p_ar := p_ar_r || '_' || rec.province_id;
        BEGIN EXECUTE format('CREATE TABLE IF NOT EXISTS %s PARTITION OF %s FOR VALUES IN (%s)', p_av, p_av_r, rec.province_id);
        EXCEPTION WHEN undefined_object THEN RAISE NOTICE 'Region partition % does not exist (run 06-create-partitions.sql)', p_av_r; END;
        BEGIN EXECUTE format('CREATE INDEX IF NOT EXISTS idx_ga_%s_%s_geom ON %s USING GIST(geometry)', rec.region_id, rec.province_id, p_av);
        EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN EXECUTE format('CREATE INDEX IF NOT EXISTS idx_ga_%s_%s_asset_type ON %s(asset_type)', rec.region_id, rec.province_id, p_av);
        EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN EXECUTE format('CREATE TABLE IF NOT EXISTS %s PARTITION OF %s FOR VALUES IN (%s)', p_ar, p_ar_r, rec.province_id);
        EXCEPTION WHEN undefined_object THEN NULL; END;
        BEGIN EXECUTE format('CREATE INDEX IF NOT EXISTS idx_ar_%s_%s_geom ON %s USING GIST(geometry)', rec.region_id, rec.province_id, p_ar);
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- STEP 3: Scaling parameters (for Voronoi). Target ~1.600 sub-aree, ~320k alberi, ~119k filari.
-- -----------------------------------------------------------------------------
\echo ''
\echo '[STEP 3] Computing scaling parameters...'

DROP TABLE IF EXISTS _seed_scaling;
CREATE UNLOGGED TABLE _seed_scaling AS
WITH cfg AS (
    SELECT (areas_min + areas_max) / 2 AS target_areas,
           (trees_min + trees_max) / 2 AS target_trees,
           (rows_min + rows_max) / 2 AS target_rows
    FROM _seed_config LIMIT 1
),
calc AS (
    SELECT target_areas, target_trees, target_rows,
           GREATEST(20, LEAST(80, FLOOR(SQRT(target_areas::numeric))::int)) AS num_macro,
           GREATEST(20, LEAST(80, FLOOR(target_areas::numeric / GREATEST(20, FLOOR(SQRT(target_areas::numeric))::int))::int)) AS sub_areas_per_macro
    FROM cfg
)
SELECT c.municipality_id, c.province_id, c.region_id, c.municipality_name, c.geometry AS municipality_geom,
       calc.target_areas, calc.target_trees, calc.target_rows,
       calc.num_macro, calc.sub_areas_per_macro,
       calc.target_trees AS num_trees, calc.target_rows AS num_rows,
       1 AS num_lawns, 1 AS num_hedges, 1 AS num_flower_beds, 1 AS num_street_greenery
FROM _seed_municipality c CROSS JOIN calc calc;

CREATE INDEX idx_seed_scaling_municipality ON _seed_scaling(municipality_id);
SELECT num_macro, sub_areas_per_macro, num_macro * sub_areas_per_macro AS tot_sub_areas_estimated FROM _seed_scaling;

-- -----------------------------------------------------------------------------
-- STEP 4: Generate MACRO-AREAS (Voronoi = disjoint areas, no overlap)
-- -----------------------------------------------------------------------------
\echo ''
\echo '[STEP 4] Generating macro-areas (Voronoi)...'

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = '_seed_municipality') THEN
    RAISE EXCEPTION 'Seed script must be run from the beginning. Missing: _seed_municipality (STEP 1). Run the full municipality_populate.sql.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = '_seed_scaling') THEN
    RAISE EXCEPTION 'Seed script must be run from the beginning. Missing: _seed_scaling (STEP 3). Run the full municipality_populate.sql.';
  END IF;
END $$;

SET maintenance_work_mem = '2GB';
SET max_parallel_workers_per_gather = 8;

DROP TABLE IF EXISTS _seed_macro_areas;
CREATE UNLOGGED TABLE _seed_macro_areas AS
WITH scaling_with_pts AS (
    SELECT s.municipality_id, s.region_id, s.province_id, s.municipality_name, s.municipality_geom, s.num_macro,
           ST_GeneratePoints(s.municipality_geom, GREATEST(2, s.num_macro)) AS pts
    FROM _seed_scaling s
),
voronoi_per_municipality AS (
    SELECT municipality_id, region_id, province_id, municipality_name, municipality_geom,
           ST_VoronoiPolygons(pts, 0.0::float8, ST_Expand(municipality_geom::box2d, 0.001)::geometry) AS vor
    FROM scaling_with_pts
    WHERE pts IS NOT NULL AND ST_NumGeometries(pts) >= 2
),
cells AS (
    SELECT v.municipality_id, v.region_id, v.province_id, v.municipality_name, v.municipality_geom,
           d.path[1] AS macro_idx,
           ST_Multi(ST_Intersection(d.geom, v.municipality_geom)) AS geometry
    FROM voronoi_per_municipality v
    CROSS JOIN LATERAL ST_Dump(v.vor) AS d(path, geom)
)
SELECT c.municipality_id, c.macro_idx::int, 'Park ' || c.macro_idx AS name, 1 AS level, c.geometry
FROM cells c
WHERE c.geometry IS NOT NULL AND NOT ST_IsEmpty(c.geometry) AND ST_GeometryType(c.geometry) IN ('ST_MultiPolygon','ST_Polygon');

DELETE FROM _seed_macro_areas WHERE geometry IS NULL OR ST_IsEmpty(geometry);
CREATE INDEX idx_seed_macro_geom ON _seed_macro_areas USING GIST(geometry);
SELECT COUNT(*) AS tot_macro_areas FROM _seed_macro_areas;

-- level_id 1 = MANAGEMENT_UNIT; attribute_type_id 44 = ATT_25_000 Area fittizia
INSERT INTO cadastre.green_areas (municipality_id, name, parent_id, level, level_id, attribute_type_id, region_id, province_id, geometry, geometry_type, intensity_of_fruition, perimeter_type, attributes, administrative_status, operational_status, survey_status)
SELECT m.municipality_id, m.name, NULL, m.level, 1, 44, s.region_id, s.province_id, ST_SetSRID(m.geometry, 4326),
       'S'::cadastre.geometry_type,
       (ARRAY['NONE'::cadastre.intensity_of_fruition, 'LOW'::cadastre.intensity_of_fruition, 'MEDIUM'::cadastre.intensity_of_fruition, 'HIGH'::cadastre.intensity_of_fruition])[1 + (m.macro_idx % 4)],
       (ARRAY['REAL'::cadastre.perimeter_type, 'REAL'::cadastre.perimeter_type, 'FICTITIOUS'::cadastre.perimeter_type])[1 + (m.macro_idx % 3)],
       jsonb_build_object(
         'type', 'park',
         'generated', true,
         'area_m2', ROUND((ST_Area(m.geometry::geography))::numeric, 2),
         'status', (ARRAY['active','active','under_maintenance'])[1 + (m.macro_idx % 3)],
         'planting_year', 1985 + (m.macro_idx % 40),
         'accessibility', 'public',
         'amenities', '["benches","paths","lighting"]'::jsonb
       ),
       'ACTIVE'::cadastre.administrative_status,
       (ARRAY['IN_MANAGEMENT'::cadastre.operational_status, 'IN_MANAGEMENT'::cadastre.operational_status, 'UNDER_MAINTENANCE'::cadastre.operational_status])[1 + (m.macro_idx % 3)],
       (ARRAY['SURVEYED'::cadastre.survey_status, 'SURVEY_PENDING'::cadastre.survey_status, 'PARTIALLY_SURVEYED'::cadastre.survey_status])[1 + (m.macro_idx % 3)]
FROM _seed_macro_areas m
JOIN _seed_scaling s ON s.municipality_id = m.municipality_id
WHERE m.geometry IS NOT NULL AND NOT ST_IsEmpty(m.geometry)
  AND (abs(hashtext(m.municipality_id::text || m.macro_idx::text)) % 100) < 85;  /* keep ~85% for realistic spatial distribution */

-- -----------------------------------------------------------------------------
-- STEP 5: Generate SUB-AREAS (Voronoi = disjoint zones, no overlap)
-- -----------------------------------------------------------------------------
\echo ''
\echo '[STEP 5] Generating sub-areas (Voronoi)...'

DROP TABLE IF EXISTS _seed_macro_ids;
CREATE UNLOGGED TABLE _seed_macro_ids AS
SELECT av.id AS macro_id, av.municipality_id AS municipality_id, av.region_id AS region_id, av.province_id AS province_id, av.name AS macro_name, av.geometry AS macro_geom, s.sub_areas_per_macro
FROM cadastre.green_areas av JOIN _seed_scaling s ON av.municipality_id = s.municipality_id
WHERE av.level = 1 AND av.municipality_id IN (SELECT municipality_id FROM _seed_municipality);
CREATE INDEX idx_seed_macro_ids ON _seed_macro_ids(macro_id);
CREATE INDEX idx_seed_macro_ids_municipality ON _seed_macro_ids(municipality_id);

DROP TABLE IF EXISTS _seed_sub_areas;
CREATE UNLOGGED TABLE _seed_sub_areas AS
WITH macro_with_pts AS (
    SELECT m.macro_id, m.municipality_id, m.macro_name, m.region_id, m.province_id, m.macro_geom,
           ST_GeneratePoints(m.macro_geom, GREATEST(2, m.sub_areas_per_macro)) AS pts
    FROM _seed_macro_ids m
    WHERE m.macro_geom IS NOT NULL AND NOT ST_IsEmpty(m.macro_geom)
),
voronoi_per_macro AS (
    SELECT macro_id, municipality_id, macro_name, region_id, province_id, macro_geom,
           ST_VoronoiPolygons(pts, 0.0::float8, ST_Expand(macro_geom::box2d, 0.0001)::geometry) AS vor
    FROM macro_with_pts
    WHERE pts IS NOT NULL AND ST_NumGeometries(pts) >= 2
),
cells AS (
    SELECT v.macro_id, v.municipality_id, v.macro_name, v.region_id, v.province_id, v.macro_geom,
           d.path[1] AS sub_idx,
           ST_Multi(ST_Intersection(d.geom, v.macro_geom)) AS geometry
    FROM voronoi_per_macro v
    CROSS JOIN LATERAL ST_Dump(v.vor) AS d(path, geom)
)
SELECT c.macro_id, c.municipality_id, c.macro_name || ' - Zone ' || c.sub_idx AS name, 2 AS level, c.geometry
FROM cells c
WHERE c.geometry IS NOT NULL AND NOT ST_IsEmpty(c.geometry) AND ST_GeometryType(c.geometry) IN ('ST_MultiPolygon','ST_Polygon');

DELETE FROM _seed_sub_areas WHERE geometry IS NULL OR ST_IsEmpty(geometry);
CREATE INDEX idx_seed_sub_geom ON _seed_sub_areas USING GIST(geometry);
SELECT COUNT(*) AS tot_sub_areas FROM _seed_sub_areas;

-- level_id 2 = SUB_MANAGEMENT_UNIT; attribute_type_id 54 = ATT_27_000 Area funzionale generica
INSERT INTO cadastre.green_areas (municipality_id, name, parent_id, level, level_id, attribute_type_id, region_id, province_id, geometry, geometry_type, intensity_of_fruition, perimeter_type, attributes, administrative_status, operational_status, survey_status)
SELECT so.municipality_id, so.name, so.macro_id, so.level, 2, 54, mi.region_id, mi.province_id, ST_SetSRID(so.geometry, 4326),
       'S'::cadastre.geometry_type,
       (ARRAY['LOW'::cadastre.intensity_of_fruition, 'MEDIUM'::cadastre.intensity_of_fruition, 'HIGH'::cadastre.intensity_of_fruition])[1 + ((so.macro_id + COALESCE(SUBSTRING(so.name FROM '[0-9]+')::int, 0)) % 3)],
       'REAL'::cadastre.perimeter_type,
       jsonb_build_object(
         'type', 'zone',
         'generated', true,
         'area_m2', ROUND((ST_Area(so.geometry::geography))::numeric, 2),
         'status', 'active',
         'planting_year', 1985 + ((so.macro_id + COALESCE(SUBSTRING(so.name FROM '[0-9]+')::int, 0)) % 40),
         'accessibility', 'public',
         'amenities', '["benches"]'::jsonb
       ),
       'ACTIVE'::cadastre.administrative_status,
       'IN_MANAGEMENT'::cadastre.operational_status,
       'SURVEYED'::cadastre.survey_status
FROM _seed_sub_areas so
JOIN _seed_macro_ids mi ON mi.macro_id = so.macro_id
WHERE so.geometry IS NOT NULL AND NOT ST_IsEmpty(so.geometry)
  AND (abs(hashtext(so.macro_id::text || so.name)) % 100) < 82;  /* keep ~82% of sub-areas for realistic distribution */

-- -----------------------------------------------------------------------------
-- STEP 6: Green assets (P, L, S). No S in the gap; in the gap only L and P, with L and P not intersecting/overlapping (aligned with seed_populate_region_data.sql).
-- Invariant: S in disjoint grid; gap = area minus S; L in gap; P in gap minus buffer(L).
-- Grid 6 cells per sub-area (1 per surface type); area_m2 in grid.
-- -----------------------------------------------------------------------------
\echo ''
\echo '[STEP 6] Generating green assets (P/L/S, no overlap)...'
SET maintenance_work_mem = '2GB';
SET max_parallel_workers_per_gather = 8;

DROP TABLE IF EXISTS _seed_sotto_ids;
CREATE UNLOGGED TABLE _seed_sotto_ids AS
SELECT av.id AS area_id, av.municipality_id AS municipality_id, av.region_id AS region_id, av.province_id AS province_id, av.geometry AS area_geom,
       s.num_trees, s.num_rows, s.num_lawns, s.num_hedges, s.num_flower_beds, s.num_street_greenery,
       COUNT(*) OVER (PARTITION BY av.municipality_id) AS num_sub_areas_municipality
FROM cadastre.green_areas av
JOIN _seed_scaling s ON av.municipality_id = s.municipality_id
WHERE av.level = 2 AND av.municipality_id IN (SELECT municipality_id FROM _seed_municipality)
  AND av.geometry IS NOT NULL AND NOT ST_IsEmpty(av.geometry);
CREATE INDEX idx_seed_sotto_ids ON _seed_sotto_ids(area_id);
CREATE INDEX idx_seed_sotto_ids_municipality ON _seed_sotto_ids(municipality_id);

-- Grid of non-overlapping rectangles per sub-area (S). Cap 6 cells, 1 per type; area_m2 from geography.
-- Inset: grid uses only central 60% of bbox so that gap (area minus grid) has room for lines and points (no overlap).
SET work_mem = '1GB';
DROP TABLE IF EXISTS _seed_surface_grid;
CREATE UNLOGGED TABLE _seed_surface_grid AS
SELECT b.area_id, b.municipality_id, b.region_id, b.province_id, b.area_geom,
       b.num_lawns, b.num_hedges, b.num_flower_beds, b.num_street_greenery,
       g.cell_idx, g.cell_geom,
       ROUND((ST_Area(g.cell_geom::geography))::numeric, 2) AS area_m2
FROM (
  SELECT s.area_id, s.municipality_id, s.region_id, s.province_id, s.area_geom,
         s.num_lawns, s.num_hedges, s.num_flower_beds, s.num_street_greenery,
         s.total,
         s.minx, s.miny, s.maxx, s.maxy,
         s.minx + 0.2 * (s.maxx - s.minx) AS gminx,
         s.miny + 0.2 * (s.maxy - s.miny) AS gminy,
         s.maxx - 0.2 * (s.maxx - s.minx) AS gmaxx,
         s.maxy - 0.2 * (s.maxy - s.miny) AS gmaxy,
         GREATEST(2, CEIL(SQRT(s.total::numeric))::int) AS cols,
         GREATEST(1, CEIL(s.total::numeric / GREATEST(2, CEIL(SQRT(s.total::numeric))::int))::int) AS rows
  FROM (
    SELECT ss.area_id, ss.municipality_id, ss.region_id, ss.province_id, ss.area_geom,
           LEAST(ss.num_lawns, 1) AS num_lawns,
           LEAST(ss.num_hedges, 1) AS num_hedges,
           LEAST(ss.num_flower_beds, 1) AS num_flower_beds,
           LEAST(ss.num_street_greenery, 1) AS num_street_greenery,
           LEAST((2 + LEAST(ss.num_lawns, 1) + LEAST(ss.num_hedges, 1) + LEAST(ss.num_flower_beds, 1) + LEAST(ss.num_street_greenery, 1))::int, 6) AS total,
           ST_XMin(ss.area_geom) AS minx, ST_YMin(ss.area_geom) AS miny,
           ST_XMax(ss.area_geom) AS maxx, ST_YMax(ss.area_geom) AS maxy
    FROM _seed_sotto_ids ss
    WHERE ss.area_geom IS NOT NULL AND NOT ST_IsEmpty(ss.area_geom)
  ) s
) b
CROSS JOIN LATERAL (
  SELECT (xi * b.rows + yj) AS cell_idx,
         ST_Intersection(
           ST_SetSRID(ST_MakeEnvelope(
             b.gminx + xi * (b.gmaxx - b.gminx) / NULLIF(b.cols, 0),
             b.gminy + yj * (b.gmaxy - b.gminy) / NULLIF(b.rows, 0),
             b.gminx + (xi + 1) * (b.gmaxx - b.gminx) / NULLIF(b.cols, 0),
             b.gminy + (yj + 1) * (b.gmaxy - b.gminy) / NULLIF(b.rows, 0)
           ), 4326),
           b.area_geom
         ) AS cell_geom
  FROM generate_series(0, b.cols - 1) AS xi,
       generate_series(0, b.rows - 1) AS yj
  WHERE (xi * b.rows + yj) < b.total
) g
WHERE ST_GeometryType(g.cell_geom) IN ('ST_Polygon', 'ST_MultiPolygon')
  AND NOT ST_IsEmpty(g.cell_geom)
  AND ST_Area(g.cell_geom::geography) > 1;
CREATE INDEX idx_seed_surface_grid_area ON _seed_surface_grid(area_id);
CREATE INDEX idx_seed_surface_grid_cell ON _seed_surface_grid(area_id, cell_idx);
ANALYZE _seed_surface_grid;

-- Gap = zone with no surface assets; here we place lines and points (L and P must not overlap each other).
-- gap_geom = sub-area minus (surface cells + tiny buffer) so L and P stay clear of S.
DROP TABLE IF EXISTS _seed_sotto_gap;
CREATE UNLOGGED TABLE _seed_sotto_gap AS
SELECT s.area_id, s.municipality_id, s.region_id, s.province_id, s.area_geom,
       COALESCE(
         ST_Difference(s.area_geom, ST_Buffer(ST_Union(g.cell_geom), 1e-8)),
         s.area_geom
       ) AS gap_geom,
       s.num_trees, s.num_rows, s.num_lawns, s.num_hedges, s.num_flower_beds, s.num_street_greenery,
       s.num_sub_areas_municipality
FROM _seed_sotto_ids s
LEFT JOIN _seed_surface_grid g ON g.area_id = s.area_id
WHERE s.area_geom IS NOT NULL AND NOT ST_IsEmpty(s.area_geom)
GROUP BY s.area_id, s.municipality_id, s.region_id, s.province_id, s.area_geom,
         s.num_trees, s.num_rows, s.num_lawns, s.num_hedges, s.num_flower_beds, s.num_street_greenery, s.num_sub_areas_municipality;
CREATE INDEX idx_seed_sotto_gap_area ON _seed_sotto_gap(area_id);
SELECT COUNT(*) AS tot_gap_areas FROM _seed_sotto_gap;
SELECT COUNT(*) AS gap_areas_with_usable_geom FROM _seed_sotto_gap WHERE gap_geom IS NOT NULL AND NOT ST_IsEmpty(gap_geom) AND ST_Area(gap_geom::geography) > 1;

-- Lines (L): segments in the gap first; then we reserve a narrow buffer so points do not lie on lines (L and P no overlap).
DROP TABLE IF EXISTS _seed_row_geoms;
CREATE UNLOGGED TABLE _seed_row_geoms AS
SELECT s.area_id, s.municipality_id, s.region_id, s.province_id, pts.ord, pts.line_geom,
       (ARRAY['Platanus x acerifolia','Tilia cordata','Acer pseudoplatanus'])[1 + ((s.area_id + pts.ord) % 3)] AS species,
       jsonb_build_object('length_m', 10 + ((s.area_id + pts.ord) % 90), 'specimen_count', 3 + ((s.area_id + pts.ord) % 12), 'dominant_species', (ARRAY['Platanus x acerifolia','Tilia cordata','Acer pseudoplatanus'])[1 + ((s.area_id + pts.ord) % 3)]) AS attributes,
       'ACTIVE'::cadastre.asset_status AS asset_status,
       (ARRAY['NONE'::cadastre.intervention_type, 'PRUNING'::cadastre.intervention_type])[1 + ((s.area_id + pts.ord) % 2)] AS intervention_type
FROM _seed_sotto_gap s
CROSS JOIN LATERAL (
  SELECT (dump.path[1])::int AS ord, dump.geom AS line_geom
  FROM generate_series(1, GREATEST(1, (s.num_rows / s.num_sub_areas_municipality)::int)) AS i
  CROSS JOIN LATERAL ST_Dump(
    ST_CollectionExtract(
      ST_Intersection(
        s.gap_geom,
        ST_SetSRID(ST_MakeLine(
          ST_MakePoint(ST_XMin(s.gap_geom), ST_YMin(s.gap_geom) + (i::float / (GREATEST(1, (s.num_rows / s.num_sub_areas_municipality)::int) + 1)) * (ST_YMax(s.gap_geom) - ST_YMin(s.gap_geom))),
          ST_MakePoint(ST_XMax(s.gap_geom), ST_YMin(s.gap_geom) + (i::float / (GREATEST(1, (s.num_rows / s.num_sub_areas_municipality)::int) + 1)) * (ST_YMax(s.gap_geom) - ST_YMin(s.gap_geom)))
        ), 4326)
      ), 2)
  ) AS dump(path, geom)
  WHERE ST_GeometryType(dump.geom) = 'ST_LineString' AND ST_Length(dump.geom::geography) > 0.1
) pts
WHERE s.gap_geom IS NOT NULL AND NOT ST_IsEmpty(s.gap_geom) AND ST_Area(s.gap_geom::geography) > 1;
CREATE INDEX idx_seed_row_geoms_area ON _seed_row_geoms(area_id);
SELECT COUNT(*) AS tot_row_segments FROM _seed_row_geoms;

-- Zone for points (P): gap minus narrow buffer around lines (~0.000001° ≈ 11 cm), so P and L never intersect/overlap.
DROP TABLE IF EXISTS _seed_sotto_gap_trees;
CREATE UNLOGGED TABLE _seed_sotto_gap_trees AS
SELECT s.area_id, s.municipality_id, s.region_id, s.province_id, s.area_geom,
       s.num_trees, s.num_rows, s.num_lawns, s.num_hedges, s.num_flower_beds, s.num_street_greenery,
       s.num_sub_areas_municipality,
       CASE WHEN r.row_union IS NULL OR ST_IsEmpty(r.row_union) THEN s.gap_geom
            ELSE (
              SELECT CASE WHEN diff IS NULL OR ST_IsEmpty(diff) OR ST_Area(diff::geography) < 1 THEN s.gap_geom ELSE diff END
              FROM (SELECT ST_Difference(s.gap_geom, ST_Buffer(r.row_union, 0.000001)) AS diff) x
            )
       END AS gap_tree_geom
FROM _seed_sotto_gap s
LEFT JOIN (SELECT area_id, ST_Union(line_geom) AS row_union FROM _seed_row_geoms GROUP BY area_id) r ON r.area_id = s.area_id
WHERE s.gap_geom IS NOT NULL AND NOT ST_IsEmpty(s.gap_geom);
CREATE INDEX idx_seed_sotto_gap_trees_area ON _seed_sotto_gap_trees(area_id);
SELECT COUNT(*) AS tot_gap_trees_areas FROM _seed_sotto_gap_trees;
SELECT COUNT(*) AS gap_trees_areas_usable FROM _seed_sotto_gap_trees WHERE gap_tree_geom IS NOT NULL AND NOT ST_IsEmpty(gap_tree_geom) AND ST_Area(gap_tree_geom::geography) > 1;

-- -----------------------------------------------------------------------------
-- STEP 7: Insert ASSETs (trees/rows no overlap; surfaces from grid)
-- geometry_type P (point), L (line), S (surface) per OBT: docs/database/obt/types/attribute_types.md
-- -----------------------------------------------------------------------------
\echo ''
\echo '[7.1] Trees (geometry_type P; in gap, no overlap with surfaces or rows)...'
-- attribute_type_id 33 = ATT_03_108 Albero (P). Points in gap_tree_geom (gap minus buffer(rows)).
INSERT INTO cadastre.green_assets (municipality_id, asset_type, geometry_type, geometry, green_area_id, region_id, province_id, attribute_type_id, species, genus, family, attributes, health_status, asset_status, risk_level, growth_stage, stability_status, origin, monitoring_required, priority_level_evaluation)
SELECT s.municipality_id, 'tree'::cadastre.asset_type, 'P'::cadastre.geometry_type, ST_SetSRID(pt.geom, 4326), s.area_id, s.region_id, s.province_id, 33,
       (ARRAY['Quercus robur','Platanus x acerifolia','Tilia cordata','Acer pseudoplatanus','Fraxinus excelsior'])[1 + (s.area_id % 5)],
       (ARRAY['Quercus','Platanus','Tilia','Acer','Fraxinus'])[1 + (s.area_id % 5)],
       (ARRAY['Fagaceae','Platanaceae','Malvaceae','Sapindaceae','Oleaceae'])[1 + (s.area_id % 5)],
       jsonb_build_object(
         'diameter_cm', 20 + ((s.area_id + pt.ord) % 80),
         'height_m', 4.0 + ((s.area_id + pt.ord) % 16) * 0.5,
         'health_status', (ARRAY['good','fair','excellent','to_monitor'])[1 + ((s.area_id + pt.ord) % 4)],
         'planting_year', 1990 + ((s.area_id + pt.ord) % 35)
       ),
       (ARRAY['HEALTHY'::cadastre.health_status, 'DEGRADED'::cadastre.health_status, 'HEALTHY'::cadastre.health_status, 'DECLINING'::cadastre.health_status])[1 + ((s.area_id + pt.ord) % 4)],
       (ARRAY['ACTIVE'::cadastre.asset_status, 'ACTIVE'::cadastre.asset_status, 'INSTALLED'::cadastre.asset_status, 'TEMPORARILY_OUT_OF_SERVICE'::cadastre.asset_status])[1 + ((s.area_id + pt.ord) % 4)],
       (ARRAY['NONE'::cadastre.risk_level, 'LOW'::cadastre.risk_level, 'MEDIUM'::cadastre.risk_level, 'HIGH'::cadastre.risk_level])[1 + ((s.area_id + pt.ord) % 4)],
       (ARRAY['YOUNG'::cadastre.growth_stage, 'SEMI_MATURE'::cadastre.growth_stage, 'MATURE'::cadastre.growth_stage, 'OVERMATURE'::cadastre.growth_stage])[1 + ((s.area_id + pt.ord) % 4)],
       (ARRAY['STABLE'::cadastre.stability_status, 'STABLE'::cadastre.stability_status, 'PARTIALLY_UNSTABLE'::cadastre.stability_status])[1 + ((s.area_id + pt.ord) % 3)],
       (ARRAY['NATIVE'::cadastre.origin, 'NATIVE'::cadastre.origin, 'EXOTIC'::cadastre.origin, 'CULTIVAR'::cadastre.origin])[1 + ((s.area_id + pt.ord) % 4)],
       (ARRAY['NONE'::cadastre.monitoring_required, 'PERIODIC'::cadastre.monitoring_required, 'URGENT'::cadastre.monitoring_required])[1 + ((s.area_id + pt.ord) % 3)],
       (ARRAY['NONE'::cadastre.priority_level_evaluation, 'LOW'::cadastre.priority_level_evaluation, 'MEDIUM'::cadastre.priority_level_evaluation, 'HIGH'::cadastre.priority_level_evaluation])[1 + ((s.area_id + pt.ord) % 4)]
FROM _seed_sotto_gap_trees s
CROSS JOIN LATERAL (
  SELECT (dp).path[1] AS ord, (dp).geom AS geom
  FROM ST_Dump(
    ST_GeneratePoints(
      ST_Envelope(s.gap_tree_geom),
      LEAST(2500, GREATEST(60, 25 * GREATEST(1, (s.num_trees / NULLIF(s.num_sub_areas_municipality, 0))::int)))
    )
  ) AS dp
  WHERE ST_Within((dp).geom, s.gap_tree_geom)
  LIMIT GREATEST(1, (s.num_trees / NULLIF(s.num_sub_areas_municipality, 0))::int)
) pt
WHERE s.gap_tree_geom IS NOT NULL AND NOT ST_IsEmpty(s.gap_tree_geom) AND ST_Area(s.gap_tree_geom::geography) > 1;

\echo '[7.2] Rows (geometry_type L; no overlap with trees/surfaces)...'
-- attribute_type_id 29 = ATT_03_104 Filare stradale (L). Insert from precomputed _seed_row_geoms.
INSERT INTO cadastre.green_assets (municipality_id, asset_type, geometry_type, geometry, green_area_id, region_id, province_id, attribute_type_id, species, attributes, asset_status, intervention_type)
SELECT r.municipality_id, 'row'::cadastre.asset_type, 'L'::cadastre.geometry_type, ST_SetSRID(r.line_geom, 4326), r.area_id, r.region_id, r.province_id, 29,
       r.species, r.attributes, r.asset_status, r.intervention_type
FROM _seed_row_geoms r;

\echo '[7.3] Park (geometry_type S; grid cell 0, no overlap)...'
-- attribute_type_id 40 = ATT_03_160 Forestazione urbana (S)
INSERT INTO cadastre.green_assets (municipality_id, asset_type, geometry_type, geometry, green_area_id, region_id, province_id, attribute_type_id, attributes, asset_status, protection_status)
SELECT g.municipality_id, 'park'::cadastre.asset_type, 'S'::cadastre.geometry_type, ST_SetSRID(g.cell_geom, 4326), g.area_id, g.region_id, g.province_id, 40,
       jsonb_build_object('area_m2', g.area_m2, 'generated', true),
       'ACTIVE'::cadastre.asset_status,
       (ARRAY['NONE'::cadastre.protection_status, 'PROTECTED'::cadastre.protection_status])[1 + (g.area_id % 2)]
FROM _seed_surface_grid g
WHERE g.cell_idx = 0
  AND (abs(hashtext(g.area_id::text || g.cell_idx::text)) % 100) < 80;  /* skip ~20% of surface assets for realistic spatial distribution */

\echo '[7.3b] Urban forest (geometry_type S; grid cell 1, no overlap)...'
-- attribute_type_id 27 = ATT_03_100_S Bosco (S)
INSERT INTO cadastre.green_assets (municipality_id, asset_type, geometry_type, geometry, green_area_id, region_id, province_id, attribute_type_id, attributes, asset_status)
SELECT g.municipality_id, 'urban_forest'::cadastre.asset_type, 'S'::cadastre.geometry_type, ST_SetSRID(g.cell_geom, 4326), g.area_id, g.region_id, g.province_id, 27,
       jsonb_build_object('area_m2', g.area_m2, 'generated', true),
       'ACTIVE'::cadastre.asset_status
FROM _seed_surface_grid g
WHERE g.cell_idx = 1
  AND (abs(hashtext(g.area_id::text || g.cell_idx::text)) % 100) < 80;

\echo '[7.4] Lawns (geometry_type S; grid cells 2+, no overlap)...'
-- attribute_type_id 1 = ATT_01_000 Prato generico (S)
INSERT INTO cadastre.green_assets (municipality_id, asset_type, geometry_type, geometry, green_area_id, region_id, province_id, attribute_type_id, species, attributes)
SELECT g.municipality_id, 'lawn'::cadastre.asset_type, 'S'::cadastre.geometry_type, ST_SetSRID(g.cell_geom, 4326), g.area_id, g.region_id, g.province_id, 1,
       (ARRAY['Lolium perenne','Poa pratensis','Festuca arundinacea'])[1 + ((g.area_id + g.cell_idx) % 3)],
       jsonb_build_object(
         'area_m2', g.area_m2,
         'lawn_type', (ARRAY['ornamental','meadow','sports'])[1 + ((g.area_id + g.cell_idx) % 3)],
         'irrigation', (g.cell_idx % 2) = 0
       )
FROM _seed_surface_grid g
WHERE g.cell_idx >= 2 AND g.cell_idx < 2 + g.num_lawns
  AND (abs(hashtext(g.area_id::text || g.cell_idx::text)) % 100) < 80;

\echo '[7.5] Hedges (geometry_type S; grid, no overlap)...'
-- attribute_type_id 28 = ATT_03_101 Cespuglio macchia/tappezzante (S). Order aligned with seed_populate_region_data: lawn, hedge, flower_bed, street_greenery.
INSERT INTO cadastre.green_assets (municipality_id, asset_type, geometry_type, geometry, green_area_id, region_id, province_id, attribute_type_id, species, attributes)
SELECT g.municipality_id, 'hedge'::cadastre.asset_type, 'S'::cadastre.geometry_type, ST_SetSRID(g.cell_geom, 4326), g.area_id, g.region_id, g.province_id, 28,
       (ARRAY['Buxus sempervirens','Ligustrum vulgare','Laurus nobilis'])[1 + ((g.area_id + g.cell_idx) % 3)],
       jsonb_build_object(
         'length_m', 5 + ((g.area_id + g.cell_idx) % 45),
         'height_m', 0.8 + ((g.area_id + g.cell_idx) % 12) * 0.1,
         'dominant_species', (ARRAY['Buxus sempervirens','Ligustrum vulgare','Laurus nobilis'])[1 + ((g.area_id + g.cell_idx) % 3)]
       )
FROM _seed_surface_grid g
WHERE g.cell_idx >= 2 + g.num_lawns AND g.cell_idx < 2 + g.num_lawns + g.num_hedges
  AND (abs(hashtext(g.area_id::text || g.cell_idx::text)) % 100) < 80;

\echo '[7.6] Flower beds (geometry_type S; grid, no overlap)...'
-- attribute_type_id 17 = ATT_02_000 Aiuola generica (S)
INSERT INTO cadastre.green_assets (municipality_id, asset_type, geometry_type, geometry, green_area_id, region_id, province_id, attribute_type_id, species, attributes)
SELECT g.municipality_id, 'flower_bed'::cadastre.asset_type, 'S'::cadastre.geometry_type, ST_SetSRID(g.cell_geom, 4326), g.area_id, g.region_id, g.province_id, 17,
       (ARRAY['Rosa canina','Lavandula angustifolia','Salvia officinalis'])[1 + ((g.area_id + g.cell_idx) % 3)],
       jsonb_build_object(
         'area_m2', g.area_m2,
         'main_species', (ARRAY['Rosa','Lavandula','Salvia officinalis'])[1 + ((g.area_id + g.cell_idx) % 3)],
         'irrigation', (g.cell_idx % 3) <> 0
       )
FROM _seed_surface_grid g
WHERE g.cell_idx >= 2 + g.num_lawns + g.num_hedges AND g.cell_idx < 2 + g.num_lawns + g.num_hedges + g.num_flower_beds
  AND (abs(hashtext(g.area_id::text || g.cell_idx::text)) % 100) < 80;

\echo '[7.7] Street greenery (geometry_type S; grid, no overlap)...'
-- attribute_type_id 15 = ATT_01_816 Prato in banchina (S)
INSERT INTO cadastre.green_assets (municipality_id, asset_type, geometry_type, geometry, green_area_id, region_id, province_id, attribute_type_id, species, attributes)
SELECT g.municipality_id, 'street_greenery'::cadastre.asset_type, 'S'::cadastre.geometry_type, ST_SetSRID(g.cell_geom, 4326), g.area_id, g.region_id, g.province_id, 15,
       'Grass mix',
       jsonb_build_object(
         'width_m', 1.0 + ((g.area_id + g.cell_idx) % 4) * 0.5,
         'maintenance', (ARRAY['ordinary','extraordinary','scheduled'])[1 + ((g.area_id + g.cell_idx) % 3)],
         'area_m2', g.area_m2
       )
FROM _seed_surface_grid g
WHERE g.cell_idx >= 2 + g.num_lawns + g.num_hedges + g.num_flower_beds
  AND g.cell_idx < 2 + g.num_lawns + g.num_hedges + g.num_flower_beds + g.num_street_greenery
  AND (abs(hashtext(g.area_id::text || g.cell_idx::text)) % 100) < 80;

-- -----------------------------------------------------------------------------
-- STEP 7.8–7.9: (obsolete)
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- Cleanup and report
-- -----------------------------------------------------------------------------
\echo ''
\echo '[STEP 8] Cleanup and report...'

DROP TABLE IF EXISTS _seed_config, _seed_municipality, _seed_scaling, _seed_macro_areas, _seed_macro_ids, _seed_sub_areas, _seed_sotto_ids, _seed_sotto_gap, _seed_sotto_gap_trees, _seed_row_geoms, _seed_surface_grid;

ANALYZE cadastre.green_areas;
ANALYZE cadastre.green_assets;

RESET work_mem; RESET maintenance_work_mem; RESET max_parallel_workers_per_gather; RESET synchronous_commit; RESET client_min_messages; RESET jit;

\echo ''
\echo '--- REPORT ---'
SELECT level, COUNT(*) AS num_areas FROM cadastre.green_areas
WHERE municipality_id IN (SELECT municipality_id FROM _seed_target_municipality)
GROUP BY level ORDER BY level;

SELECT asset_type, COUNT(*) AS num_asset FROM cadastre.green_assets
WHERE municipality_id IN (SELECT municipality_id FROM _seed_target_municipality)
GROUP BY asset_type ORDER BY num_asset DESC;

DROP TABLE IF EXISTS _seed_target_municipality;

\echo ''
\echo 'POPULATE COMPLETED!'
\timing off
