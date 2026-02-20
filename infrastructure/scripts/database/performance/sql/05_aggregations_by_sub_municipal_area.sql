-- =============================================================================
-- AGGREGATIONS LEVEL: SUB-MUNICIPAL AREA (IDs only - map names with separate queries)
-- =============================================================================
-- Pure benchmark: no JOIN with lookup. Returns sub_municipal_area_id, municipality_id.
-- Uses public.sub_municipal_area (replaces former districts).
--
-- OPTIMIZED: Partition pruning (region_id IS NOT NULL)
-- OPTIMIZED: Composite indexes (municipality_id IS NOT NULL, geometry_type = 'point')
-- OPTIMIZED: Partial composite indexes for POINT with sub_municipal_area_id (04-init-indexes-cadastre.sql)
-- =============================================================================

\timing on
SET work_mem = '256MB';

\echo ''
\echo '=== SUB-MUNICIPAL AREA LEVEL ==='

-- Q_SUBMUNICIPAL_municipalities_with_areas (from green_assets: municipalities with assets in sub_municipal areas)
\echo 'Q_SUBMUNICIPAL_municipalities_with_areas: municipalities with sub_municipal areas (from assets)'
SELECT municipality_id, COUNT(DISTINCT sub_municipal_area_id) AS num_sub_areas_with_assets
FROM cadastre.green_assets
WHERE sub_municipal_area_id IS NOT NULL
  AND region_id IS NOT NULL  -- PARTITION PRUNING
  AND municipality_id IS NOT NULL  -- COMPOSITE INDEX
  AND geometry_type = 'point'  -- PARTIAL COMPOSITE INDEX
GROUP BY municipality_id
ORDER BY num_sub_areas_with_assets DESC;

-- Q_SUBMUNICIPAL_assets_per_area
\echo 'Q_SUBMUNICIPAL_assets_per_area: assets per sub_municipal_area_id'
SELECT sub_municipal_area_id, COUNT(id) AS total_assets
FROM cadastre.green_assets
WHERE sub_municipal_area_id IS NOT NULL
  AND region_id IS NOT NULL  -- PARTITION PRUNING
  AND municipality_id IS NOT NULL  -- COMPOSITE INDEX
  AND geometry_type = 'point'  -- PARTIAL COMPOSITE INDEX
GROUP BY sub_municipal_area_id
ORDER BY total_assets DESC;

-- Q_SUBMUNICIPAL_assets_per_type
\echo 'Q_SUBMUNICIPAL_assets_per_type: assets per sub_municipal_area_id and type'
SELECT sub_municipal_area_id, asset_type, COUNT(*) AS n
FROM cadastre.green_assets
WHERE sub_municipal_area_id IS NOT NULL
  AND region_id IS NOT NULL  -- PARTITION PRUNING
  AND municipality_id IS NOT NULL  -- COMPOSITE INDEX
  AND geometry_type = 'point'  -- PARTIAL COMPOSITE INDEX
GROUP BY sub_municipal_area_id, asset_type
ORDER BY sub_municipal_area_id, n DESC;

-- =============================================================================
-- EQUIVALENTS WITH ST_Intersects (geometry) - for performance comparison
-- =============================================================================

\echo ''
\echo '=== SUB-MUNICIPAL AREA LEVEL (ST_Intersects) ==='

-- Q_SUBMUNICIPAL_GEO_assets_per_area
\echo 'Q_SUBMUNICIPAL_GEO_assets_per_area: assets per sub_municipal area (via ST_Intersects)'
SELECT s.id AS sub_municipal_area_id, s.municipality_id, COUNT(ga.id) AS total_assets
FROM public.sub_municipal_area s
JOIN cadastre.green_assets ga ON ST_Intersects(ga.geometry, s.geometry)
  AND ga.sub_municipal_area_id = s.id  -- COMPOSITE INDEX
  AND ga.municipality_id = s.municipality_id  -- COMPOSITE INDEX
  AND ga.region_id = (SELECT p.region_id FROM public.municipalities c JOIN public.provinces p ON c.province_id = p.id WHERE c.id = s.municipality_id)  -- PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND s.geometry IS NOT NULL
GROUP BY s.id, s.municipality_id
ORDER BY total_assets DESC;

-- Q_SUBMUNICIPAL_GEO_assets_per_type
\echo 'Q_SUBMUNICIPAL_GEO_assets_per_type: assets per sub_municipal area and type (via ST_Intersects)'
SELECT s.id AS sub_municipal_area_id, ga.asset_type, COUNT(*) AS n
FROM public.sub_municipal_area s
JOIN cadastre.green_assets ga ON ST_Intersects(ga.geometry, s.geometry)
  AND ga.sub_municipal_area_id = s.id  -- COMPOSITE INDEX
  AND ga.municipality_id = s.municipality_id  -- COMPOSITE INDEX
  AND ga.region_id = (SELECT p.region_id FROM public.municipalities c JOIN public.provinces p ON c.province_id = p.id WHERE c.id = s.municipality_id)  -- PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND s.geometry IS NOT NULL
GROUP BY s.id, ga.asset_type
ORDER BY s.id, n DESC;

-- Q_SUBMUNICIPAL_GEO_municipalities_with_areas
\echo 'Q_SUBMUNICIPAL_GEO_municipalities_with_areas: municipalities with assets in sub_municipal areas (via ST_Intersects)'
SELECT s.municipality_id, COUNT(DISTINCT s.id) AS num_sub_areas_with_assets
FROM public.sub_municipal_area s
JOIN cadastre.green_assets ga ON ST_Intersects(ga.geometry, s.geometry)
  AND ga.sub_municipal_area_id = s.id  -- COMPOSITE INDEX
  AND ga.municipality_id = s.municipality_id  -- COMPOSITE INDEX
  AND ga.region_id = (SELECT p.region_id FROM public.municipalities c JOIN public.provinces p ON c.province_id = p.id WHERE c.id = s.municipality_id)  -- PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND s.geometry IS NOT NULL
GROUP BY s.municipality_id
ORDER BY num_sub_areas_with_assets DESC;

-- =============================================================================
-- ST_Within (POINT only) - optimized for point geometries
-- =============================================================================

\echo ''
\echo '=== SUB-MUNICIPAL AREA LEVEL (ST_Within - POINT only) ==='

-- Q_SUBMUNICIPAL_WITHIN_assets_per_area
\echo 'Q_SUBMUNICIPAL_WITHIN_assets_per_area: POINT assets per sub_municipal area (via ST_Within)'
SELECT s.id AS sub_municipal_area_id, s.municipality_id, COUNT(ga.id) AS total_assets
FROM public.sub_municipal_area s
JOIN cadastre.green_assets ga ON ST_Within(ga.geometry, s.geometry)
  AND ga.sub_municipal_area_id = s.id  -- COMPOSITE INDEX
  AND ga.municipality_id = s.municipality_id  -- COMPOSITE INDEX
  AND ga.region_id = (SELECT p.region_id FROM public.municipalities c JOIN public.provinces p ON c.province_id = p.id WHERE c.id = s.municipality_id)  -- PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND s.geometry IS NOT NULL
  AND ga.geometry_type = 'point'  -- PARTIAL COMPOSITE INDEX
GROUP BY s.id, s.municipality_id
ORDER BY total_assets DESC;

-- Q_SUBMUNICIPAL_WITHIN_assets_per_type
\echo 'Q_SUBMUNICIPAL_WITHIN_assets_per_type: POINT assets per sub_municipal area and type (via ST_Within)'
SELECT s.id AS sub_municipal_area_id, ga.asset_type, COUNT(*) AS n
FROM public.sub_municipal_area s
JOIN cadastre.green_assets ga ON ST_Within(ga.geometry, s.geometry)
  AND ga.sub_municipal_area_id = s.id  -- COMPOSITE INDEX
  AND ga.municipality_id = s.municipality_id  -- COMPOSITE INDEX
  AND ga.region_id = (SELECT p.region_id FROM public.municipalities c JOIN public.provinces p ON c.province_id = p.id WHERE c.id = s.municipality_id)  -- PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND s.geometry IS NOT NULL
  AND ga.geometry_type = 'point'  -- PARTIAL COMPOSITE INDEX
GROUP BY s.id, ga.asset_type
ORDER BY s.id, n DESC;

-- =============================================================================
-- ST_Contains - polygon contains geometry (any type)
-- =============================================================================

\echo ''
\echo '=== SUB-MUNICIPAL AREA LEVEL (ST_Contains) ==='

-- Q_SUBMUNICIPAL_CONTAINS_assets_per_area
\echo 'Q_SUBMUNICIPAL_CONTAINS_assets_per_area: assets per sub_municipal area (via ST_Contains)'
SELECT s.id AS sub_municipal_area_id, s.municipality_id, COUNT(ga.id) AS total_assets
FROM public.sub_municipal_area s
JOIN cadastre.green_assets ga ON ST_Contains(s.geometry, ga.geometry)
  AND ga.sub_municipal_area_id = s.id  -- COMPOSITE INDEX
  AND ga.municipality_id = s.municipality_id  -- COMPOSITE INDEX
  AND ga.region_id = (SELECT p.region_id FROM public.municipalities c JOIN public.provinces p ON c.province_id = p.id WHERE c.id = s.municipality_id)  -- PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND s.geometry IS NOT NULL
GROUP BY s.id, s.municipality_id
ORDER BY total_assets DESC;

-- Q_SUBMUNICIPAL_CONTAINS_assets_per_type
\echo 'Q_SUBMUNICIPAL_CONTAINS_assets_per_type: assets per sub_municipal area and type (via ST_Contains)'
SELECT s.id AS sub_municipal_area_id, ga.asset_type, COUNT(*) AS n
FROM public.sub_municipal_area s
JOIN cadastre.green_assets ga ON ST_Contains(s.geometry, ga.geometry)
  AND ga.sub_municipal_area_id = s.id  -- COMPOSITE INDEX
  AND ga.municipality_id = s.municipality_id  -- COMPOSITE INDEX
  AND ga.region_id = (SELECT p.region_id FROM public.municipalities c JOIN public.provinces p ON c.province_id = p.id WHERE c.id = s.municipality_id)  -- PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND s.geometry IS NOT NULL
GROUP BY s.id, ga.asset_type
ORDER BY s.id, n DESC;

RESET work_mem;
\timing off
