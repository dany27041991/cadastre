-- =============================================================================
-- AGGREGAZIONI LIVELLO: AREA VERDE (solo ID - senza JOIN)
-- =============================================================================
-- Benchmark puro: nessuna JOIN. Usa ID denormalizzati o raggruppa per green_area_id.
-- 
-- ⚡ OTTIMIZZATO: Partition pruning (region_id IS NOT NULL)
-- ⚡ OTTIMIZZATO: Query GEO riscritte con CTE per filtrare region_id PRIMA della join spaziale
-- ⚡ OTTIMIZZATO: Indici compositi parziali per query POINT (geometry_type = 'point')
-- =============================================================================

\timing on
SET work_mem = '256MB';

\echo ''
\echo '=== LIVELLO AREA VERDE (ID) ==='

-- Q_AREA_aree_per_level_territorio (da aree_verdi direttamente)
\echo 'Q_AREA_aree_per_level_territorio: aree_verdi per region_id e level'
SELECT region_id, level, COUNT(*) AS n
FROM cadastre.green_areas
WHERE region_id IS NOT NULL
GROUP BY region_id, level
ORDER BY region_id, level;

-- Q_AREA_asset_per_area (senza JOIN - raggruppa per green_area_id)
\echo 'Q_AREA_asset_per_area: asset per green_area_id - top 50'
SELECT green_area_id, municipality_id, COUNT(id) AS asset_totale
FROM cadastre.green_assets
WHERE green_area_id IS NOT NULL
  AND region_id IS NOT NULL  -- ⚡ PARTITION PRUNING
GROUP BY green_area_id, municipality_id
ORDER BY asset_totale DESC
LIMIT 50;

-- Q_AREA_asset_per_tipo_per_area (senza JOIN)
\echo 'Q_AREA_asset_per_tipo_per_area: asset per asset_type per green_area_id'
SELECT green_area_id, municipality_id, asset_type, COUNT(*) AS n
FROM cadastre.green_assets
WHERE green_area_id IS NOT NULL
  AND region_id IS NOT NULL  -- ⚡ PARTITION PRUNING
GROUP BY green_area_id, municipality_id, asset_type
ORDER BY green_area_id, n DESC
LIMIT 500;

-- Q_AREA_specie_distinte_per_area (senza JOIN)
\echo 'Q_AREA_specie_distinte_per_area: specie distinte per green_area_id'
SELECT green_area_id, municipality_id, COUNT(DISTINCT species) AS specie_distinte
FROM cadastre.green_assets
WHERE green_area_id IS NOT NULL
  AND region_id IS NOT NULL  -- ⚡ PARTITION PRUNING
  AND species IS NOT NULL AND species != ''
GROUP BY green_area_id, municipality_id
ORDER BY specie_distinte DESC
LIMIT 50;

-- Q_AREA_level_da_aree_verdi (query separata per level)
\echo 'Q_AREA_level_da_aree_verdi: distribuzione aree per level'
SELECT level, COUNT(*) AS n_aree, SUM(CASE WHEN geometry IS NOT NULL THEN 1 ELSE 0 END) AS con_geometry
FROM cadastre.green_areas
GROUP BY level
ORDER BY level;

-- =============================================================================
-- EQUIVALENTI CON ST_Intersects (geometry) - asset dentro aree_verdi
-- =============================================================================

\echo ''
\echo '=== LIVELLO AREA VERDE (ST_Intersects) ==='

-- Q_AREA_GEO_asset_per_area_L1
\echo 'Q_AREA_GEO_asset_per_area_L1: asset per area L1 (via ST_Intersects)'
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
\echo 'Q_AREA_GEO_asset_per_area_L2: asset per area L2 (via ST_Intersects)'
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
\echo 'Q_AREA_GEO_asset_per_tipo_per_level: asset per tipo e level (via ST_Intersects)'
SELECT a.level, ga.asset_type, COUNT(*) AS n
FROM cadastre.green_areas a
JOIN cadastre.green_assets ga ON ST_Intersects(ga.geometry, a.geometry)
  AND ga.region_id = a.region_id  -- ⚡ PARTITION PRUNING (nella JOIN ON)
WHERE a.geometry IS NOT NULL 
  AND a.region_id IS NOT NULL
  AND ga.geometry IS NOT NULL
GROUP BY a.level, ga.asset_type
ORDER BY a.level, n DESC;

-- =============================================================================
-- ST_Within (solo POINT) - asset puntuali dentro aree_verdi
-- =============================================================================

\echo ''
\echo '=== LIVELLO AREA VERDE (ST_Within - solo POINT) ==='

-- Q_AREA_WITHIN_asset_per_area_L1
\echo 'Q_AREA_WITHIN_asset_per_area_L1: asset POINT per area L1 (via ST_Within)'
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
\echo 'Q_AREA_WITHIN_asset_per_area_L2: asset POINT per area L2 (via ST_Within)'
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

-- =============================================================================
-- ST_Contains - area contiene geometria asset
-- =============================================================================

\echo ''
\echo '=== LIVELLO AREA VERDE (ST_Contains) ==='

-- Q_AREA_CONTAINS_asset_per_area_L1
\echo 'Q_AREA_CONTAINS_asset_per_area_L1: asset per area L1 (via ST_Contains)'
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
\echo 'Q_AREA_CONTAINS_asset_per_area_L2: asset per area L2 (via ST_Contains)'
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
\echo 'Q_AREA_CONTAINS_asset_per_tipo_per_level: asset per tipo e level (via ST_Contains)'
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

RESET work_mem;
\timing off
