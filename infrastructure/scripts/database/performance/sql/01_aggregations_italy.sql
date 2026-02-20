-- =============================================================================
-- AGGREGATIONS LEVEL: ITALY (total)
-- =============================================================================
-- Each query has a Q_ITALY_* comment to identify slow queries in output.
-- =============================================================================

\timing on
SET work_mem = '256MB';

\echo ''
\echo '=== ITALY LEVEL ==='

-- Q_ITALY_total_assets
\echo 'Q_ITALY_total_assets: total asset count'
SELECT COUNT(*) AS total_assets FROM cadastre.green_assets;

-- Q_ITALY_assets_by_type
\echo 'Q_ITALY_assets_by_type: assets grouped by asset_type'
SELECT asset_type, COUNT(*) AS n
FROM cadastre.green_assets
GROUP BY asset_type
ORDER BY n DESC;

-- Q_ITALY_assets_by_geometry_type
\echo 'Q_ITALY_assets_by_geometry_type: assets per geometry_type'
SELECT geometry_type, COUNT(*) AS n
FROM cadastre.green_assets
GROUP BY geometry_type
ORDER BY n DESC;

-- Q_ITALY_distinct_species
\echo 'Q_ITALY_distinct_species: distinct species count (species NOT NULL)'
SELECT COUNT(DISTINCT species) AS distinct_species
FROM cadastre.green_assets
WHERE species IS NOT NULL AND species != '';

-- Q_ITALY_species_top
\echo 'Q_ITALY_species_top: top 20 species by asset count'
SELECT species, COUNT(*) AS n
FROM cadastre.green_assets
WHERE species IS NOT NULL AND species != ''
GROUP BY species
ORDER BY n DESC
LIMIT 20;

-- Q_ITALY_areas_by_level
\echo 'Q_ITALY_areas_by_level: green_areas per level'
SELECT level, COUNT(*) AS n
FROM cadastre.green_areas
GROUP BY level
ORDER BY level;

-- Q_ITALY_municipalities_with_assets (municipality_id INTEGER faster than VARCHAR for COUNT DISTINCT)
\echo 'Q_ITALY_municipalities_with_assets: number of municipalities with at least one asset'
SELECT COUNT(DISTINCT municipality_id) AS municipalities_with_assets
FROM cadastre.green_assets
WHERE municipality_id IS NOT NULL;

RESET work_mem;
\timing off
