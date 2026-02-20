-- =============================================================================
-- TEST: Solo query lente da 06_aggregations_by_area_level.sql
-- =============================================================================

\timing on
SET work_mem = '256MB';

\echo ''
\echo '=============================================================================='
\echo 'TEST QUERY LENTE - 06_aggregations_by_area_level.sql'
\echo '=============================================================================='
\echo ''

-- Q_AREA_asset_per_area (senza JOIN - raggruppa per green_area_id)
\echo '[1/10] Q_AREA_asset_per_area: asset per green_area_id - top 50'
SELECT green_area_id, municipality_id, COUNT(id) AS asset_totale
FROM cadastre.green_assets
WHERE green_area_id IS NOT NULL
  AND region_id IS NOT NULL  -- ⚡ PARTITION PRUNING
GROUP BY green_area_id, municipality_id
ORDER BY asset_totale DESC
LIMIT 50;

-- Q_AREA_species_distinte_per_area (senza JOIN)
\echo ''
\echo '[2/10] Q_AREA_species_distinte_per_area: species distinte per green_area_id'
SELECT green_area_id, municipality_id, COUNT(DISTINCT species) AS species_distinte
FROM cadastre.green_assets
WHERE green_area_id IS NOT NULL
  AND region_id IS NOT NULL  -- ⚡ PARTITION PRUNING
  AND species IS NOT NULL AND species != ''
GROUP BY green_area_id, municipality_id
ORDER BY species_distinte DESC
LIMIT 50;

-- Q_AREA_GEO_asset_per_area_L1
\echo ''
\echo '[3/10] Q_AREA_GEO_asset_per_area_L1: asset per area L1 (via ST_Intersects)'
SELECT a.id AS green_area_id, a.municipality_id, COUNT(ga.id) AS asset_totale
FROM cadastre.green_areas a
JOIN cadastre.green_assets ga ON ST_Intersects(ga.geometry, a.geometry)
  AND ga.region_id = a.region_id  -- ⚡ PARTITION PRUNING (nella JOIN ON)
WHERE a.geometry IS NOT NULL 
  AND a.region_id IS NOT NULL 
  AND a.level = 1
  AND ga.geometry IS NOT NULL
GROUP BY a.id, a.municipality_id
ORDER BY asset_totale DESC
LIMIT 50;

-- Q_AREA_GEO_asset_per_area_L2
\echo ''
\echo '[4/10] Q_AREA_GEO_asset_per_area_L2: asset per area L2 (via ST_Intersects)'
SELECT a.id AS green_area_id, a.municipality_id, COUNT(ga.id) AS asset_totale
FROM cadastre.green_areas a
JOIN cadastre.green_assets ga ON ST_Intersects(ga.geometry, a.geometry)
  AND ga.region_id = a.region_id  -- ⚡ PARTITION PRUNING (nella JOIN ON)
WHERE a.geometry IS NOT NULL 
  AND a.region_id IS NOT NULL 
  AND a.level = 2
  AND ga.geometry IS NOT NULL
GROUP BY a.id, a.municipality_id
ORDER BY asset_totale DESC
LIMIT 50;

-- Q_AREA_GEO_asset_per_tipo_per_level
\echo ''
\echo '[5/10] Q_AREA_GEO_asset_per_tipo_per_level: asset per tipo e level (via ST_Intersects)'
SELECT a.level, ga.asset_type, COUNT(*) AS n
FROM cadastre.green_areas a
JOIN cadastre.green_assets ga ON ST_Intersects(ga.geometry, a.geometry)
  AND ga.region_id = a.region_id  -- ⚡ PARTITION PRUNING (nella JOIN ON)
WHERE a.geometry IS NOT NULL 
  AND a.region_id IS NOT NULL
  AND ga.geometry IS NOT NULL
GROUP BY a.level, ga.asset_type
ORDER BY a.level, n DESC;

-- Q_AREA_WITHIN_asset_per_area_L1
\echo ''
\echo '[6/10] Q_AREA_WITHIN_asset_per_area_L1: asset POINT per area L1 (via ST_Within)'
WITH aree_filtrate AS (
  SELECT id, municipality_id, geometry, region_id
  FROM cadastre.green_areas
  WHERE geometry IS NOT NULL AND region_id IS NOT NULL AND level = 1
),
asset_filtrati AS (
  SELECT id, geometry, region_id
  FROM cadastre.green_assets
  WHERE geometry IS NOT NULL AND region_id IS NOT NULL AND geometry_type = 'point'
)
SELECT a.id AS green_area_id, a.municipality_id, COUNT(ga.id) AS asset_totale
FROM aree_filtrate a
JOIN asset_filtrati ga ON ga.region_id = a.region_id
  AND ST_Within(ga.geometry, a.geometry)
GROUP BY a.id, a.municipality_id
ORDER BY asset_totale DESC
LIMIT 50;

-- Q_AREA_WITHIN_asset_per_area_L2
\echo ''
\echo '[7/10] Q_AREA_WITHIN_asset_per_area_L2: asset POINT per area L2 (via ST_Within)'
WITH aree_filtrate AS (
  SELECT id, municipality_id, geometry, region_id
  FROM cadastre.green_areas
  WHERE geometry IS NOT NULL AND region_id IS NOT NULL AND level = 2
),
asset_filtrati AS (
  SELECT id, geometry, region_id
  FROM cadastre.green_assets
  WHERE geometry IS NOT NULL AND region_id IS NOT NULL AND geometry_type = 'point'
)
SELECT a.id AS green_area_id, a.municipality_id, COUNT(ga.id) AS asset_totale
FROM aree_filtrate a
JOIN asset_filtrati ga ON ga.region_id = a.region_id
  AND ST_Within(ga.geometry, a.geometry)
GROUP BY a.id, a.municipality_id
ORDER BY asset_totale DESC
LIMIT 50;

-- Q_AREA_CONTAINS_asset_per_area_L1
\echo ''
\echo '[8/10] Q_AREA_CONTAINS_asset_per_area_L1: asset per area L1 (via ST_Contains)'
WITH aree_filtrate AS (
  SELECT id, municipality_id, geometry, region_id
  FROM cadastre.green_areas
  WHERE geometry IS NOT NULL AND region_id IS NOT NULL AND level = 1
),
asset_filtrati AS (
  SELECT id, geometry, region_id
  FROM cadastre.green_assets
  WHERE geometry IS NOT NULL AND region_id IS NOT NULL
)
SELECT a.id AS green_area_id, a.municipality_id, COUNT(ga.id) AS asset_totale
FROM aree_filtrate a
JOIN asset_filtrati ga ON ga.region_id = a.region_id
  AND ST_Contains(a.geometry, ga.geometry)
GROUP BY a.id, a.municipality_id
ORDER BY asset_totale DESC
LIMIT 50;

-- Q_AREA_CONTAINS_asset_per_area_L2
\echo ''
\echo '[9/10] Q_AREA_CONTAINS_asset_per_area_L2: asset per area L2 (via ST_Contains)'
WITH aree_filtrate AS (
  SELECT id, municipality_id, geometry, region_id
  FROM cadastre.green_areas
  WHERE geometry IS NOT NULL AND region_id IS NOT NULL AND level = 2
),
asset_filtrati AS (
  SELECT id, geometry, region_id
  FROM cadastre.green_assets
  WHERE geometry IS NOT NULL AND region_id IS NOT NULL
)
SELECT a.id AS green_area_id, a.municipality_id, COUNT(ga.id) AS asset_totale
FROM aree_filtrate a
JOIN asset_filtrati ga ON ga.region_id = a.region_id
  AND ST_Contains(a.geometry, ga.geometry)
GROUP BY a.id, a.municipality_id
ORDER BY asset_totale DESC
LIMIT 50;

-- Q_AREA_CONTAINS_asset_per_tipo_per_level
\echo ''
\echo '[10/10] Q_AREA_CONTAINS_asset_per_tipo_per_level: asset per tipo e level (via ST_Contains)'
WITH aree_filtrate AS (
  SELECT id, level, geometry, region_id
  FROM cadastre.green_areas
  WHERE geometry IS NOT NULL AND region_id IS NOT NULL
),
asset_filtrati AS (
  SELECT id, asset_type, geometry, region_id
  FROM cadastre.green_assets
  WHERE geometry IS NOT NULL AND region_id IS NOT NULL
)
SELECT a.level, ga.asset_type, COUNT(*) AS n
FROM aree_filtrate a
JOIN asset_filtrati ga ON ga.region_id = a.region_id
  AND ST_Contains(a.geometry, ga.geometry)
GROUP BY a.level, ga.asset_type
ORDER BY a.level, n DESC;

\echo ''
\echo '=============================================================================='
\echo 'TEST COMPLETATO'
\echo '=============================================================================='

RESET work_mem;
\timing off
