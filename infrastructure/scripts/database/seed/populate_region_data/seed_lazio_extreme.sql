-- =============================================================================
-- EXTREME SEED: Lazio
-- =============================================================================
-- Generates green areas and green assets for all municipalities in Lazio
-- Optimized for maximum speed with set-based operations and bulk insert
-- =============================================================================

\echo '============================================================'
\echo 'EXTREME SEED Lazio - START'
\echo '============================================================'
\timing on

SET work_mem = '256MB';
SET maintenance_work_mem = '512MB';
SET max_parallel_workers_per_gather = 4;
SET synchronous_commit = OFF;
SET client_min_messages = WARNING;

-- STEP 1: Lazio municipalities
\echo ''
\echo '[STEP 1] Identifying Lazio municipalities...'

DROP TABLE IF EXISTS _seed_municipalities_target;
CREATE UNLOGGED TABLE _seed_municipalities_target AS
SELECT c.id AS municipality_id, c.istat_code, c.name AS municipality_name, c.geometry,
       ST_Area(c.geometry::geography) / 1000000.0 AS area_km2,
       p.id AS province_id, p.region_id AS region_id, r.name AS region_name
FROM public.municipalities c
JOIN public.provinces p ON c.province_id = p.id
JOIN public.regions r ON p.region_id = r.id
WHERE r.name = 'Lazio' AND c.geometry IS NOT NULL;

CREATE INDEX idx_seed_municipalities_target_municipality ON _seed_municipalities_target(municipality_id);
CREATE INDEX idx_seed_municipalities_target_geom ON _seed_municipalities_target USING GIST(geometry);

SELECT region_name, COUNT(*) AS num_municipalities, ROUND(SUM(area_km2)::numeric, 2) AS total_area_km2
FROM _seed_municipalities_target GROUP BY region_name;

-- STEP 2: Ensure province-level partitions exist (hierarchical: region→province)
-- 06-create-partitions.sql creates them at init; this is fallback if 06 skipped some.
\echo ''
\echo '[STEP 2] Checking partitions...'

DO $$
DECLARE rec RECORD; p_av TEXT; p_ar TEXT; p_av_r TEXT; p_ar_r TEXT;
BEGIN
    FOR rec IN SELECT DISTINCT region_id, province_id FROM _seed_municipalities_target ORDER BY region_id, province_id
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
    RAISE NOTICE 'Partitions checked for % (region,province) pairs', (SELECT COUNT(*) FROM (SELECT DISTINCT region_id, province_id FROM _seed_municipalities_target) t);
END $$;

-- STEP 3: Scaling
\echo ''
\echo '[STEP 3] Computing scaling parameters...'

DROP TABLE IF EXISTS _seed_scaling;
CREATE UNLOGGED TABLE _seed_scaling AS
SELECT municipality_id, province_id, region_id, municipality_name, area_km2, geometry,
       GREATEST(20, LEAST(FLOOR(area_km2 * 3)::int, 500)) AS num_macro_areas, 10 AS sub_areas_per_macro,
       GREATEST(200, LEAST(FLOOR(area_km2 * 50)::int, 50000)) AS num_trees,
       GREATEST(20, LEAST(FLOOR(area_km2 * 8)::int, 8000)) AS num_rows,
       GREATEST(10, LEAST(FLOOR(area_km2 * 5)::int, 5000)) AS num_lawns,
       GREATEST(10, LEAST(FLOOR(area_km2 * 6)::int, 6000)) AS num_hedges,
       GREATEST(5, LEAST(FLOOR(area_km2 * 3)::int, 3000)) AS num_flower_beds,
       GREATEST(10, LEAST(FLOOR(area_km2 * 4)::int, 4000)) AS num_street_greenery
FROM _seed_municipalities_target;

CREATE INDEX idx_seed_scaling_municipality ON _seed_scaling(municipality_id);

SELECT COUNT(*) AS num_municipalities, SUM(num_macro_areas) AS tot_macro_areas,
       SUM(num_macro_areas * sub_areas_per_macro) AS tot_sub_areas,
       SUM(num_trees + num_rows + num_lawns + num_hedges + num_flower_beds + num_street_greenery) AS tot_assets_estimated
FROM _seed_scaling;

-- STEP 4: Clean existing data and generate macro-areas (Voronoi = disjoint areas, no overlap)
\echo ''
\echo '[STEP 4] Cleanup and macro-areas generation (Voronoi)...'

SET max_parallel_workers_per_gather = 0;
CREATE INDEX IF NOT EXISTS idx_green_assets_green_area_id ON cadastre.green_assets(green_area_id);
SET max_parallel_workers_per_gather = 4;

DELETE FROM cadastre.green_assets WHERE municipality_id IN (SELECT municipality_id FROM _seed_municipalities_target);
DELETE FROM cadastre.green_areas WHERE municipality_id IN (SELECT municipality_id FROM _seed_municipalities_target) AND level = 2;
DELETE FROM cadastre.green_areas WHERE municipality_id IN (SELECT municipality_id FROM _seed_municipalities_target) AND level = 1;

DROP TABLE IF EXISTS _seed_macro_areas;
CREATE UNLOGGED TABLE _seed_macro_areas AS
WITH scaling_with_pts AS (
    SELECT s.municipality_id, s.region_id, s.province_id, s.area_km2, s.municipality_name, s.geometry AS municipality_geom,
           ST_GeneratePoints(s.geometry, GREATEST(2, s.num_macro_areas)) AS pts
    FROM _seed_scaling s
),
voronoi_per_municipality AS (
    SELECT municipality_id, region_id, province_id, area_km2, municipality_name, municipality_geom,
           ST_VoronoiPolygons(pts, 0.0::float8, ST_Expand(municipality_geom::box2d, 0.001)::geometry) AS vor
    FROM scaling_with_pts
    WHERE pts IS NOT NULL AND ST_NumGeometries(pts) >= 2
),
cells AS (
    SELECT v.municipality_id, v.region_id, v.province_id, v.area_km2, v.municipality_name, v.municipality_geom,
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

INSERT INTO cadastre.green_areas (municipality_id, name, parent_id, level, region_id, province_id, geometry, attributes, administrative_status, operational_status, survey_status)
SELECT m.municipality_id, m.name, NULL, m.level, s.region_id, s.province_id, ST_SetSRID(m.geometry, 4326),
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
       'SURVEYED'::cadastre.survey_status
FROM _seed_macro_areas m
JOIN _seed_scaling s ON s.municipality_id = m.municipality_id
WHERE m.geometry IS NOT NULL AND NOT ST_IsEmpty(m.geometry);

-- STEP 5: Sub-areas (Voronoi = disjoint zones, no overlap)
\echo ''
\echo '[STEP 5] Generating sub-areas (Voronoi)...'

DROP TABLE IF EXISTS _seed_macro_ids;
CREATE UNLOGGED TABLE _seed_macro_ids AS
SELECT av.id AS macro_id, av.municipality_id AS municipality_id, av.region_id AS region_id, av.province_id AS province_id, av.name AS macro_name, av.geometry AS macro_geom, s.sub_areas_per_macro
FROM cadastre.green_areas av JOIN _seed_scaling s ON av.municipality_id = s.municipality_id
WHERE av.level = 1 AND av.municipality_id IN (SELECT municipality_id FROM _seed_municipalities_target);
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

INSERT INTO cadastre.green_areas (municipality_id, name, parent_id, level, region_id, province_id, geometry, attributes, administrative_status, operational_status, survey_status)
SELECT so.municipality_id, so.name, so.macro_id, so.level, mi.region_id, mi.province_id, ST_SetSRID(so.geometry, 4326),
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
WHERE so.geometry IS NOT NULL AND NOT ST_IsEmpty(so.geometry);

-- STEP 6: Green assets
\echo ''
\echo '[STEP 6] Generating green assets...'

DROP TABLE IF EXISTS _seed_sotto_ids;
CREATE UNLOGGED TABLE _seed_sotto_ids AS
SELECT av.id AS area_id, av.municipality_id AS municipality_id, av.region_id AS region_id, av.province_id AS province_id, av.geometry AS area_geom,
       s.num_trees, s.num_rows, s.num_lawns, s.num_hedges, s.num_flower_beds, s.num_street_greenery,
       COUNT(*) OVER (PARTITION BY av.municipality_id) AS num_sub_areas_municipality
FROM cadastre.green_areas av JOIN _seed_scaling s ON av.municipality_id = s.municipality_id
WHERE av.level = 2 AND av.municipality_id IN (SELECT municipality_id FROM _seed_municipalities_target)
  AND av.geometry IS NOT NULL AND NOT ST_IsEmpty(av.geometry);
CREATE INDEX idx_seed_sotto_ids ON _seed_sotto_ids(area_id);
CREATE INDEX idx_seed_sotto_ids_municipality ON _seed_sotto_ids(municipality_id);

\echo '[6.1] Trees (distinct points per sub-area)...'
INSERT INTO cadastre.green_assets (municipality_id, asset_type, geometry_type, geometry, green_area_id, region_id, province_id, species, attributes, health_status)
SELECT s.municipality_id, 'tree'::cadastre.asset_type, 'point'::cadastre.geometry_type, ST_SetSRID(d.geom, 4326), s.area_id, s.region_id, s.province_id,
       (ARRAY['Quercus robur','Platanus x acerifolia','Tilia cordata','Acer pseudoplatanus','Fraxinus excelsior'])[1 + (s.area_id % 5)],
       jsonb_build_object(
         'diameter_cm', 20 + ((s.area_id + (d.path[1])::int) % 80),
         'height_m', 4.0 + ((s.area_id + (d.path[1])::int) % 16) * 0.5,
         'health_status', (ARRAY['good','fair','excellent','to_monitor'])[1 + ((s.area_id + (d.path[1])::int) % 4)],
         'planting_year', 1990 + ((s.area_id + (d.path[1])::int) % 35)
       ),
       (ARRAY['HEALTHY'::cadastre.health_status, 'DEGRADED'::cadastre.health_status, 'HEALTHY'::cadastre.health_status, 'DECLINING'::cadastre.health_status])[1 + ((s.area_id + (d.path[1])::int) % 4)]
FROM _seed_sotto_ids s
CROSS JOIN LATERAL ST_Dump(ST_GeneratePoints(s.area_geom, GREATEST(1, (s.num_trees / s.num_sub_areas_municipality)::int))) AS d(path, geom)
WHERE s.area_geom IS NOT NULL;

\echo '[6.2] Rows (distinct point pairs)...'
INSERT INTO cadastre.green_assets (municipality_id, asset_type, geometry_type, geometry, green_area_id, region_id, province_id, species, attributes)
SELECT s.municipality_id, 'row'::cadastre.asset_type, 'linestring'::cadastre.geometry_type, ST_SetSRID(ST_MakeLine(pts.geom, pts.next_geom), 4326), s.area_id, s.region_id, s.province_id,
       (ARRAY['Platanus x acerifolia','Tilia cordata','Acer pseudoplatanus'])[1 + ((s.area_id + pts.ord) % 3)],
       jsonb_build_object(
         'length_m', 10 + ((s.area_id + pts.ord) % 90),
         'specimen_count', 3 + ((s.area_id + pts.ord) % 12),
         'dominant_species', (ARRAY['Platanus x acerifolia','Tilia cordata','Acer pseudoplatanus'])[1 + ((s.area_id + pts.ord) % 3)]
       )
FROM _seed_sotto_ids s
CROSS JOIN LATERAL (
  SELECT (d.path[1])::int AS ord, d.geom,
         lead(d.geom) OVER (ORDER BY (d.path[1])) AS next_geom
  FROM ST_Dump(ST_GeneratePoints(s.area_geom, GREATEST(2, 2 * (s.num_rows / s.num_sub_areas_municipality)::int))) AS d(path, geom)
) pts
WHERE s.area_geom IS NOT NULL AND pts.ord % 2 = 1 AND pts.next_geom IS NOT NULL;

\echo '[6.3] Lawns (distinct points, buffer+intersection)...'
INSERT INTO cadastre.green_assets (municipality_id, asset_type, geometry_type, geometry, green_area_id, region_id, province_id, species, attributes)
SELECT s.municipality_id, 'lawn'::cadastre.asset_type, 'polygon'::cadastre.geometry_type, ST_SetSRID(ST_Intersection(ST_Buffer(d.geom, 0.0002), s.area_geom), 4326), s.area_id, s.region_id, s.province_id,
       (ARRAY['Lolium perenne','Poa pratensis','Festuca arundinacea'])[1 + ((s.area_id + (d.path[1])::int) % 3)],
       jsonb_build_object(
         'area_m2', 50 + ((s.area_id + (d.path[1])::int) % 450),
         'lawn_type', (ARRAY['ornamental','meadow','sports'])[1 + ((s.area_id + (d.path[1])::int) % 3)],
         'irrigation', ((s.area_id + (d.path[1])::int) % 2) = 0
       )
FROM _seed_sotto_ids s
CROSS JOIN LATERAL ST_Dump(ST_GeneratePoints(s.area_geom, GREATEST(1, (s.num_lawns / s.num_sub_areas_municipality)::int))) AS d(path, geom)
WHERE s.area_geom IS NOT NULL;

\echo '[6.4] Hedges (distinct points, buffer+intersection)...'
INSERT INTO cadastre.green_assets (municipality_id, asset_type, geometry_type, geometry, green_area_id, region_id, province_id, species, attributes)
SELECT s.municipality_id, 'hedge'::cadastre.asset_type, 'polygon'::cadastre.geometry_type, ST_SetSRID(ST_Intersection(ST_Buffer(d.geom, 0.00015), s.area_geom), 4326), s.area_id, s.region_id, s.province_id,
       (ARRAY['Buxus sempervirens','Ligustrum vulgare','Laurus nobilis'])[1 + ((s.area_id + (d.path[1])::int) % 3)],
       jsonb_build_object(
         'length_m', 5 + ((s.area_id + (d.path[1])::int) % 45),
         'height_m', 0.8 + ((s.area_id + (d.path[1])::int) % 12) * 0.1,
         'dominant_species', (ARRAY['Buxus sempervirens','Ligustrum vulgare','Laurus nobilis'])[1 + ((s.area_id + (d.path[1])::int) % 3)]
       )
FROM _seed_sotto_ids s
CROSS JOIN LATERAL ST_Dump(ST_GeneratePoints(s.area_geom, GREATEST(1, (s.num_hedges / s.num_sub_areas_municipality)::int))) AS d(path, geom)
WHERE s.area_geom IS NOT NULL;

\echo '[6.5] Flower beds (distinct points, buffer+intersection)...'
INSERT INTO cadastre.green_assets (municipality_id, asset_type, geometry_type, geometry, green_area_id, region_id, province_id, species, attributes)
SELECT s.municipality_id, 'flower_bed'::cadastre.asset_type, 'polygon'::cadastre.geometry_type, ST_SetSRID(ST_Intersection(ST_Buffer(d.geom, 0.0001), s.area_geom), 4326), s.area_id, s.region_id, s.province_id,
       (ARRAY['Rosa canina','Lavandula angustifolia','Salvia officinalis'])[1 + ((s.area_id + (d.path[1])::int) % 3)],
       jsonb_build_object(
         'area_m2', 5 + ((s.area_id + (d.path[1])::int) % 95),
         'main_species', (ARRAY['Rosa','Lavandula','Salvia officinalis'])[1 + ((s.area_id + (d.path[1])::int) % 3)],
         'irrigation', ((s.area_id + (d.path[1])::int) % 3) <> 0
       )
FROM _seed_sotto_ids s
CROSS JOIN LATERAL ST_Dump(ST_GeneratePoints(s.area_geom, GREATEST(1, (s.num_flower_beds / s.num_sub_areas_municipality)::int))) AS d(path, geom)
WHERE s.area_geom IS NOT NULL;

\echo '[6.6] Street greenery (distinct points, buffer+intersection)...'
INSERT INTO cadastre.green_assets (municipality_id, asset_type, geometry_type, geometry, green_area_id, region_id, province_id, species, attributes)
SELECT s.municipality_id, 'street_greenery'::cadastre.asset_type, 'polygon'::cadastre.geometry_type, ST_SetSRID(ST_Intersection(ST_Buffer(d.geom, 0.00012), s.area_geom), 4326), s.area_id, s.region_id, s.province_id,
       'Grass mix',
       jsonb_build_object(
         'width_m', 1.0 + ((s.area_id + (d.path[1])::int) % 4) * 0.5,
         'maintenance', (ARRAY['ordinary','extraordinary','scheduled'])[1 + ((s.area_id + (d.path[1])::int) % 3)],
         'area_m2', 20 + ((s.area_id + (d.path[1])::int) % 180)
       )
FROM _seed_sotto_ids s
CROSS JOIN LATERAL ST_Dump(ST_GeneratePoints(s.area_geom, GREATEST(1, (s.num_street_greenery / s.num_sub_areas_municipality)::int))) AS d(path, geom)
WHERE s.area_geom IS NOT NULL;

-- STEP 6.7: Populate sub_municipal_area_id (green_assets) where geometry falls inside a sub-municipal area
\echo ''
\echo '[STEP 6.7] Populating sub_municipal_area_id (green_assets)...'
DO $$
DECLARE r RECORD; n_updated BIGINT;
BEGIN
  FOR r IN SELECT municipality_id FROM _seed_municipalities_target t WHERE EXISTS (SELECT 1 FROM public.sub_municipal_area s WHERE s.municipality_id = t.municipality_id)
  LOOP
    WITH matched AS (
      SELECT DISTINCT ON (ga.ctid) ga.ctid, s.id AS sub_id
      FROM cadastre.green_assets ga
      INNER JOIN public.sub_municipal_area s ON s.municipality_id = ga.municipality_id AND ST_Intersects(ga.geometry, s.geometry)
      WHERE ga.municipality_id = r.municipality_id
      ORDER BY ga.ctid, ST_Area(ST_Intersection(ga.geometry::geography, s.geometry::geography)) DESC NULLS LAST
    )
    UPDATE cadastre.green_assets ga SET sub_municipal_area_id = m.sub_id FROM matched m WHERE ga.ctid = m.ctid;
    GET DIAGNOSTICS n_updated = ROW_COUNT;
    RAISE NOTICE 'Municipality %: % assets assigned to sub_municipal_area', r.municipality_id, n_updated;
  END LOOP;
END $$;

-- STEP 6.8: Populate sub_municipal_area_id (green_areas) where geometry falls inside a sub-municipal area
\echo ''
\echo '[STEP 6.8] Populating sub_municipal_area_id (green_areas)...'
DO $$
DECLARE r RECORD; n_updated BIGINT;
BEGIN
  FOR r IN SELECT municipality_id FROM _seed_municipalities_target t WHERE EXISTS (SELECT 1 FROM public.sub_municipal_area s WHERE s.municipality_id = t.municipality_id)
  LOOP
    WITH matched AS (
      SELECT DISTINCT ON (ga.id) ga.id, s.id AS sub_id
      FROM cadastre.green_areas ga
      INNER JOIN public.sub_municipal_area s ON s.municipality_id = ga.municipality_id AND ST_Intersects(ga.geometry, s.geometry)
      WHERE ga.municipality_id = r.municipality_id
      ORDER BY ga.id, s.id
    )
    UPDATE cadastre.green_areas ga SET sub_municipal_area_id = m.sub_id FROM matched m WHERE ga.id = m.id;
    GET DIAGNOSTICS n_updated = ROW_COUNT;
    RAISE NOTICE 'Municipality %: % green areas assigned to sub_municipal_area', r.municipality_id, n_updated;
  END LOOP;
END $$;

-- STEP 7: Cleanup
\echo ''
\echo '[STEP 7] Cleanup...'
DROP TABLE IF EXISTS _seed_municipalities_target, _seed_scaling, _seed_macro_areas, _seed_macro_ids, _seed_sub_areas, _seed_sotto_ids;

-- STEP 8: Report
\echo ''
\echo '[STEP 8] Updating statistics...'
ANALYZE cadastre.green_areas;
ANALYZE cadastre.green_assets;

RESET work_mem; RESET maintenance_work_mem; RESET synchronous_commit; RESET client_min_messages;

\echo ''
\echo '--- REPORT LAZIO ---'
SELECT level, COUNT(*) AS num_aree FROM cadastre.green_areas
WHERE municipality_id IN (SELECT c.id FROM public.municipalities c JOIN public.provinces p ON c.province_id = p.id JOIN public.regions r ON p.region_id = r.id WHERE r.name = 'Lazio')
GROUP BY level ORDER BY level;

SELECT asset_type, COUNT(*) AS num_asset FROM cadastre.green_assets
WHERE municipality_id IN (SELECT c.id FROM public.municipalities c JOIN public.provinces p ON c.province_id = p.id JOIN public.regions r ON p.region_id = r.id WHERE r.name = 'Lazio')
GROUP BY asset_type ORDER BY num_asset DESC;

SELECT c.name AS municipality, COUNT(ga.id) AS num_asset, ROUND((ST_Area(c.geometry::geography)/1000000)::numeric, 2) AS area_km2
FROM cadastre.green_assets ga JOIN public.municipalities c ON ga.municipality_id = c.id
WHERE c.id IN (SELECT c2.id FROM public.municipalities c2 JOIN public.provinces p ON c2.province_id = p.id JOIN public.regions r ON p.region_id = r.id WHERE r.name = 'Lazio')
GROUP BY c.id, c.name, c.geometry ORDER BY num_asset DESC LIMIT 10;

\echo ''
\echo 'SEED LAZIO COMPLETATO!'
\timing off
