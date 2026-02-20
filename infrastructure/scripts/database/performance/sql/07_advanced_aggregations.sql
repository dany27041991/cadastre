-- =============================================================================
-- ADVANCED AGGREGATIONS (IDs only - map with separate queries)
-- =============================================================================
-- Pure benchmark: no JOIN with regions, provinces, municipalities, sub_municipal_area.
-- Returns IDs for later mapping.
--
-- OPTIMIZED: Partition pruning (region_id IS NOT NULL)
-- OPTIMIZED: Composite indexes (province_id IS NOT NULL where applicable)
-- =============================================================================

\timing on
SET work_mem = '128MB';

\echo ''
\echo '=== ADVANCED AGGREGATIONS ==='

-- Q_ADV_density_per_region (region_id, total assets - area_km2 from regions separately)
\echo 'Q_ADV_density_per_region: total assets per region_id'
SELECT region_id, COUNT(*) AS total_assets
FROM cadastre.green_assets
WHERE region_id IS NOT NULL
GROUP BY region_id
ORDER BY total_assets DESC;

-- Q_ADV_density_per_province
\echo 'Q_ADV_density_per_province: total assets per province_id (top 20)'
SELECT province_id, COUNT(*) AS total_assets
FROM cadastre.green_assets
WHERE province_id IS NOT NULL
  AND region_id IS NOT NULL  -- PARTITION PRUNING
GROUP BY province_id
ORDER BY total_assets DESC
LIMIT 20;

-- Q_ADV_density_per_municipality_top30
\echo 'Q_ADV_density_per_municipality_top30: total assets per municipality_id (top 30)'
SELECT municipality_id, COUNT(*) AS total_assets
FROM cadastre.green_assets
WHERE municipality_id IS NOT NULL
  AND region_id IS NOT NULL  -- PARTITION PRUNING
  AND province_id IS NOT NULL  -- COMPOSITE INDEX
GROUP BY municipality_id
ORDER BY total_assets DESC
LIMIT 30;

-- Q_ADV_geometry_type_per_region
\echo 'Q_ADV_geometry_type_per_region: assets per geometry_type per region_id'
SELECT region_id, geometry_type, COUNT(*) AS n
FROM cadastre.green_assets
WHERE region_id IS NOT NULL
GROUP BY region_id, geometry_type
ORDER BY region_id, n DESC;

-- Q_ADV_species_per_type
\echo 'Q_ADV_species_per_type: distinct species per asset type'
SELECT ga.asset_type, COUNT(DISTINCT ga.species) AS distinct_species, COUNT(*) AS total_assets
FROM cadastre.green_assets ga
WHERE ga.species IS NOT NULL AND ga.species != ''
GROUP BY ga.asset_type
ORDER BY distinct_species DESC;

-- Q_ADV_species_per_type_top_species
\echo 'Q_ADV_species_per_type_top_species: top 5 species per asset type'
WITH ranked AS (
  SELECT ga.asset_type, ga.species, COUNT(*) AS n,
    ROW_NUMBER() OVER (PARTITION BY ga.asset_type ORDER BY COUNT(*) DESC) AS rn
  FROM cadastre.green_assets ga
  WHERE ga.species IS NOT NULL AND ga.species != ''
  GROUP BY ga.asset_type, ga.species
)
SELECT asset_type, species, n
FROM ranked
WHERE rn <= 5
ORDER BY asset_type, rn;

-- Q_ADV_orphan_assets_total
\echo 'Q_ADV_orphan_assets_total: assets without green_area_id (orphans)'
WITH totals AS (
  SELECT
    COUNT(*) AS total_assets,
    COUNT(*) FILTER (WHERE green_area_id IS NULL) AS orphan_assets
  FROM cadastre.green_assets
)
SELECT orphan_assets, total_assets,
  ROUND((orphan_assets::numeric / NULLIF(total_assets, 0) * 100), 2) AS orphan_percentage
FROM totals;

-- Q_ADV_orphan_assets_per_region
\echo 'Q_ADV_orphan_assets_per_region: orphan assets per region_id'
SELECT region_id,
  COUNT(*) FILTER (WHERE green_area_id IS NULL) AS orphan_assets,
  COUNT(*) AS total_assets,
  ROUND((COUNT(*) FILTER (WHERE green_area_id IS NULL)::numeric / NULLIF(COUNT(*), 0) * 100), 2) AS orphan_percentage
FROM cadastre.green_assets
WHERE region_id IS NOT NULL
GROUP BY region_id
ORDER BY orphan_percentage DESC NULLS LAST;

-- Q_ADV_assets_per_creation_month
\echo 'Q_ADV_assets_per_creation_month: assets created per month (last 12)'
SELECT date_trunc('month', created_at)::date AS month, COUNT(*) AS assets_created
FROM cadastre.green_assets
WHERE created_at IS NOT NULL
GROUP BY date_trunc('month', created_at)
ORDER BY month DESC
LIMIT 12;

-- Q_ADV_assets_per_year_region
\echo 'Q_ADV_assets_per_year_region: assets created per year per region_id'
SELECT region_id, date_trunc('year', created_at)::date AS year, COUNT(*) AS assets_created
FROM cadastre.green_assets
WHERE region_id IS NOT NULL AND created_at IS NOT NULL
GROUP BY region_id, date_trunc('year', created_at)
ORDER BY region_id, year DESC;

RESET work_mem;
\timing off
