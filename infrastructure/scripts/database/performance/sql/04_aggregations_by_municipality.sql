-- =============================================================================
-- AGGREGATIONS LEVEL: MUNICIPALITY (IDs only - map names with separate queries)
-- =============================================================================
-- Pure benchmark: no JOIN with lookup. Returns municipality_id (istat_code from municipalities separately).
--
-- OPTIMIZED: Partition pruning (region_id IS NOT NULL)
-- OPTIMIZED: Composite indexes (province_id IS NOT NULL)
-- OPTIMIZED: Composite indexes on GEO queries (ga.municipality_id = c.id, ga.province_id = c.province_id)
-- OPTIMIZED: Partial composite indexes for POINT queries (geometry_type = 'P' per OBT)
-- =============================================================================

\timing on
SET work_mem = '256MB';

\echo ''
\echo '=== MUNICIPALITY LEVEL ==='

-- Q_MUNICIPALITY_total_assets_top50
\echo 'Q_MUNICIPALITY_total_assets_top50: top 50 municipalities by asset count'
SELECT municipality_id, COUNT(id) AS total_assets
FROM cadastre.green_assets
WHERE municipality_id IS NOT NULL
  AND region_id IS NOT NULL  -- PARTITION PRUNING
  AND province_id IS NOT NULL  -- COMPOSITE INDEX
GROUP BY municipality_id
ORDER BY total_assets DESC
LIMIT 50;

-- Q_MUNICIPALITY_assets_per_type_sample (aggregation by municipality_id and type)
\echo 'Q_MUNICIPALITY_assets_per_type_sample: assets per type per municipality'
SELECT municipality_id, asset_type, COUNT(*) AS n
FROM cadastre.green_assets
WHERE municipality_id IS NOT NULL
  AND region_id IS NOT NULL  -- PARTITION PRUNING
  AND province_id IS NOT NULL  -- COMPOSITE INDEX
GROUP BY municipality_id, asset_type
ORDER BY municipality_id, n DESC
LIMIT 500;

-- Q_MUNICIPALITY_distinct_species_top20
\echo 'Q_MUNICIPALITY_distinct_species_top20: top 20 municipalities by distinct species'
SELECT municipality_id, COUNT(DISTINCT species) AS distinct_species
FROM cadastre.green_assets
WHERE municipality_id IS NOT NULL
  AND region_id IS NOT NULL  -- PARTITION PRUNING
  AND province_id IS NOT NULL  -- COMPOSITE INDEX
  AND species IS NOT NULL AND species != ''
GROUP BY municipality_id
ORDER BY distinct_species DESC
LIMIT 20;

-- Q_MUNICIPALITY_areas_per_level_top30
\echo 'Q_MUNICIPALITY_areas_per_level_top30: green_areas per municipality_id and level'
SELECT municipality_id, level, COUNT(*) AS n
FROM cadastre.green_areas
WHERE municipality_id IS NOT NULL
GROUP BY municipality_id, level
ORDER BY municipality_id, level
LIMIT 500;

-- =============================================================================
-- EQUIVALENTS WITH ST_Intersects (geometry) - for performance comparison
-- =============================================================================

\echo ''
\echo '=== MUNICIPALITY LEVEL (ST_Intersects) ==='

-- Q_MUNICIPALITY_GEO_total_assets_top50
\echo 'Q_MUNICIPALITY_GEO_total_assets_top50: top 50 municipalities by assets (via ST_Intersects)'
SELECT c.id AS municipality_id, COUNT(ga.id) AS total_assets
FROM public.municipalities c
JOIN cadastre.green_assets ga ON ST_Intersects(ga.geometry, c.geometry)
  AND ga.municipality_id = c.id  -- COMPOSITE INDEX
  AND ga.province_id = c.province_id  -- COMPOSITE INDEX
  AND ga.region_id = (SELECT region_id FROM public.provinces WHERE id = c.province_id)  -- PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND c.geometry IS NOT NULL
GROUP BY c.id
ORDER BY total_assets DESC
LIMIT 50;

-- Q_MUNICIPALITY_GEO_assets_per_type_sample
\echo 'Q_MUNICIPALITY_GEO_assets_per_type_sample: assets per type per municipality (via ST_Intersects)'
SELECT c.id AS municipality_id, ga.asset_type, COUNT(*) AS n
FROM public.municipalities c
JOIN cadastre.green_assets ga ON ST_Intersects(ga.geometry, c.geometry)
  AND ga.municipality_id = c.id  -- COMPOSITE INDEX
  AND ga.province_id = c.province_id  -- COMPOSITE INDEX
  AND ga.region_id = (SELECT region_id FROM public.provinces WHERE id = c.province_id)  -- PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND c.geometry IS NOT NULL
GROUP BY c.id, ga.asset_type
ORDER BY c.id, n DESC
LIMIT 500;

-- Q_MUNICIPALITY_GEO_distinct_species_top20
\echo 'Q_MUNICIPALITY_GEO_distinct_species_top20: top 20 municipalities by species (via ST_Intersects)'
SELECT c.id AS municipality_id, COUNT(DISTINCT ga.species) AS distinct_species
FROM public.municipalities c
JOIN cadastre.green_assets ga ON ST_Intersects(ga.geometry, c.geometry)
  AND ga.municipality_id = c.id  -- COMPOSITE INDEX
  AND ga.province_id = c.province_id  -- COMPOSITE INDEX
  AND ga.region_id = (SELECT region_id FROM public.provinces WHERE id = c.province_id)  -- PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND c.geometry IS NOT NULL
  AND ga.species IS NOT NULL AND ga.species != ''
GROUP BY c.id
ORDER BY distinct_species DESC
LIMIT 20;

-- =============================================================================
-- ST_Within (POINT only) - optimized for point geometries
-- =============================================================================

\echo ''
\echo '=== MUNICIPALITY LEVEL (ST_Within - POINT only) ==='

-- Q_MUNICIPALITY_WITHIN_total_assets_top50
\echo 'Q_MUNICIPALITY_WITHIN_total_assets_top50: top 50 municipalities by POINT assets (via ST_Within)'
SELECT c.id AS municipality_id, COUNT(ga.id) AS total_assets
FROM public.municipalities c
JOIN cadastre.green_assets ga ON ST_Within(ga.geometry, c.geometry)
  AND ga.municipality_id = c.id  -- COMPOSITE INDEX
  AND ga.province_id = c.province_id  -- COMPOSITE INDEX
  AND ga.region_id = (SELECT region_id FROM public.provinces WHERE id = c.province_id)  -- PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND c.geometry IS NOT NULL
  AND ga.geometry_type = 'P'  -- PARTIAL COMPOSITE INDEX
GROUP BY c.id
ORDER BY total_assets DESC
LIMIT 50;

-- Q_MUNICIPALITY_WITHIN_assets_per_type
\echo 'Q_MUNICIPALITY_WITHIN_assets_per_type: POINT assets per municipality and type (via ST_Within)'
SELECT c.id AS municipality_id, ga.asset_type, COUNT(*) AS n
FROM public.municipalities c
JOIN cadastre.green_assets ga ON ST_Within(ga.geometry, c.geometry)
  AND ga.municipality_id = c.id  -- COMPOSITE INDEX
  AND ga.province_id = c.province_id  -- COMPOSITE INDEX
  AND ga.region_id = (SELECT region_id FROM public.provinces WHERE id = c.province_id)  -- PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND c.geometry IS NOT NULL
  AND ga.geometry_type = 'P'  -- PARTIAL COMPOSITE INDEX
GROUP BY c.id, ga.asset_type
ORDER BY c.id, n DESC
LIMIT 500;

-- =============================================================================
-- ST_Contains - polygon contains geometry (any type)
-- =============================================================================

\echo ''
\echo '=== MUNICIPALITY LEVEL (ST_Contains) ==='

-- Q_MUNICIPALITY_CONTAINS_total_assets_top50
\echo 'Q_MUNICIPALITY_CONTAINS_total_assets_top50: top 50 municipalities by assets (via ST_Contains)'
SELECT c.id AS municipality_id, COUNT(ga.id) AS total_assets
FROM public.municipalities c
JOIN cadastre.green_assets ga ON ST_Contains(c.geometry, ga.geometry)
  AND ga.municipality_id = c.id  -- COMPOSITE INDEX
  AND ga.province_id = c.province_id  -- COMPOSITE INDEX
  AND ga.region_id = (SELECT region_id FROM public.provinces WHERE id = c.province_id)  -- PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND c.geometry IS NOT NULL
GROUP BY c.id
ORDER BY total_assets DESC
LIMIT 50;

-- Q_MUNICIPALITY_CONTAINS_assets_per_type
\echo 'Q_MUNICIPALITY_CONTAINS_assets_per_type: assets per municipality and type (via ST_Contains)'
SELECT c.id AS municipality_id, ga.asset_type, COUNT(*) AS n
FROM public.municipalities c
JOIN cadastre.green_assets ga ON ST_Contains(c.geometry, ga.geometry)
  AND ga.municipality_id = c.id  -- COMPOSITE INDEX
  AND ga.province_id = c.province_id  -- COMPOSITE INDEX
  AND ga.region_id = (SELECT region_id FROM public.provinces WHERE id = c.province_id)  -- PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND c.geometry IS NOT NULL
GROUP BY c.id, ga.asset_type
ORDER BY c.id, n DESC
LIMIT 500;

RESET work_mem;
\timing off
