-- =============================================================================
-- AGGREGAZIONI LIVELLO: PROVINCIA (solo ID - mappare nomi con query separate)
-- =============================================================================
-- Benchmark puro: nessuna JOIN con lookup. Restituisce province_id per mapping.
-- 
-- ⚡ OTTIMIZZATO: Partition pruning (region_id IS NOT NULL)
-- ⚡ OTTIMIZZATO: Indici compositi su query GEO (ga.province_id = p.id, ga.region_id = p.region_id)
-- ⚡ OTTIMIZZATO: Indici compositi parziali per query POINT (geometry_type = 'point')
-- =============================================================================

\timing on
SET work_mem = '256MB';

\echo ''
\echo '=== LIVELLO PROVINCIA ==='

-- Q_PROVINCIA_asset_totale
\echo 'Q_PROVINCIA_asset_totale: asset totali per province_id'
SELECT province_id, COUNT(id) AS asset_totale
FROM cadastre.green_assets
WHERE province_id IS NOT NULL
  AND region_id IS NOT NULL  -- ⚡ PARTITION PRUNING
GROUP BY province_id
ORDER BY asset_totale DESC;

-- Q_PROVINCIA_asset_per_tipo
\echo 'Q_PROVINCIA_asset_per_tipo: asset per province_id e asset_type'
SELECT province_id, asset_type, COUNT(*) AS n
FROM cadastre.green_assets
WHERE province_id IS NOT NULL
  AND region_id IS NOT NULL  -- ⚡ PARTITION PRUNING
GROUP BY province_id, asset_type
ORDER BY province_id, n DESC;

-- Q_PROVINCIA_specie_distinte
\echo 'Q_PROVINCIA_specie_distinte: specie distinte per province_id'
SELECT province_id, COUNT(DISTINCT species) AS specie_distinte
FROM cadastre.green_assets
WHERE province_id IS NOT NULL
  AND region_id IS NOT NULL  -- ⚡ PARTITION PRUNING
  AND species IS NOT NULL AND species != ''
GROUP BY province_id
ORDER BY specie_distinte DESC;

-- Q_PROVINCIA_aree_per_level
\echo 'Q_PROVINCIA_aree_per_level: aree_verdi per province_id e level'
SELECT province_id, level, COUNT(*) AS n
FROM cadastre.green_areas
WHERE province_id IS NOT NULL
GROUP BY province_id, level
ORDER BY province_id, level;

-- =============================================================================
-- EQUIVALENTI CON ST_Intersects (geometry) - per confronto performance
-- =============================================================================

\echo ''
\echo '=== LIVELLO PROVINCIA (ST_Intersects) ==='

-- Q_PROVINCIA_GEO_asset_totale
\echo 'Q_PROVINCIA_GEO_asset_totale: asset totali per provincia (via ST_Intersects)'
SELECT p.id AS province_id, COUNT(ga.id) AS asset_totale
FROM public.provinces p
JOIN cadastre.green_assets ga ON ST_Intersects(ga.geometry, p.geometry)
  AND ga.province_id = p.id  -- ⚡ INDICE COMPOSITO
  AND ga.region_id = p.region_id  -- ⚡ PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND p.geometry IS NOT NULL
GROUP BY p.id
ORDER BY asset_totale DESC;

-- Q_PROVINCIA_GEO_asset_per_tipo
\echo 'Q_PROVINCIA_GEO_asset_per_tipo: asset per provincia e tipo (via ST_Intersects)'
SELECT p.id AS province_id, ga.asset_type, COUNT(*) AS n
FROM public.provinces p
JOIN cadastre.green_assets ga ON ST_Intersects(ga.geometry, p.geometry)
  AND ga.province_id = p.id  -- ⚡ INDICE COMPOSITO
  AND ga.region_id = p.region_id  -- ⚡ PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND p.geometry IS NOT NULL
GROUP BY p.id, ga.asset_type
ORDER BY p.id, n DESC;

-- Q_PROVINCIA_GEO_specie_distinte
\echo 'Q_PROVINCIA_GEO_specie_distinte: specie distinte per provincia (via ST_Intersects)'
SELECT p.id AS province_id, COUNT(DISTINCT ga.species) AS specie_distinte
FROM public.provinces p
JOIN cadastre.green_assets ga ON ST_Intersects(ga.geometry, p.geometry)
  AND ga.province_id = p.id  -- ⚡ INDICE COMPOSITO
  AND ga.region_id = p.region_id  -- ⚡ PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND p.geometry IS NOT NULL
  AND ga.species IS NOT NULL AND ga.species != ''
GROUP BY p.id
ORDER BY specie_distinte DESC;

-- =============================================================================
-- ST_Within (solo POINT) - ottimizzato per geometrie puntuali
-- =============================================================================

\echo ''
\echo '=== LIVELLO PROVINCIA (ST_Within - solo POINT) ==='

-- Q_PROVINCIA_WITHIN_asset_totale
\echo 'Q_PROVINCIA_WITHIN_asset_totale: asset POINT per provincia (via ST_Within)'
SELECT p.id AS province_id, COUNT(ga.id) AS asset_totale
FROM public.provinces p
JOIN cadastre.green_assets ga ON ST_Within(ga.geometry, p.geometry)
  AND ga.province_id = p.id  -- ⚡ INDICE COMPOSITO
  AND ga.region_id = p.region_id  -- ⚡ PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND p.geometry IS NOT NULL
  AND ga.geometry_type = 'point'  -- ⚡ INDICE COMPOSITO PARZIALE
GROUP BY p.id
ORDER BY asset_totale DESC;

-- Q_PROVINCIA_WITHIN_asset_per_tipo
\echo 'Q_PROVINCIA_WITHIN_asset_per_tipo: asset POINT per provincia e tipo (via ST_Within)'
SELECT p.id AS province_id, ga.asset_type, COUNT(*) AS n
FROM public.provinces p
JOIN cadastre.green_assets ga ON ST_Within(ga.geometry, p.geometry)
  AND ga.province_id = p.id  -- ⚡ INDICE COMPOSITO
  AND ga.region_id = p.region_id  -- ⚡ PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND p.geometry IS NOT NULL
  AND ga.geometry_type = 'point'  -- ⚡ INDICE COMPOSITO PARZIALE
GROUP BY p.id, ga.asset_type
ORDER BY p.id, n DESC;

-- =============================================================================
-- ST_Contains - poligono contiene geometria (qualsiasi tipo)
-- =============================================================================

\echo ''
\echo '=== LIVELLO PROVINCIA (ST_Contains) ==='

-- Q_PROVINCIA_CONTAINS_asset_totale
\echo 'Q_PROVINCIA_CONTAINS_asset_totale: asset per provincia (via ST_Contains)'
SELECT p.id AS province_id, COUNT(ga.id) AS asset_totale
FROM public.provinces p
JOIN cadastre.green_assets ga ON ST_Contains(p.geometry, ga.geometry)
  AND ga.province_id = p.id  -- ⚡ INDICE COMPOSITO
  AND ga.region_id = p.region_id  -- ⚡ PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND p.geometry IS NOT NULL
GROUP BY p.id
ORDER BY asset_totale DESC;

-- Q_PROVINCIA_CONTAINS_asset_per_tipo
\echo 'Q_PROVINCIA_CONTAINS_asset_per_tipo: asset per provincia e tipo (via ST_Contains)'
SELECT p.id AS province_id, ga.asset_type, COUNT(*) AS n
FROM public.provinces p
JOIN cadastre.green_assets ga ON ST_Contains(p.geometry, ga.geometry)
  AND ga.province_id = p.id  -- ⚡ INDICE COMPOSITO
  AND ga.region_id = p.region_id  -- ⚡ PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND p.geometry IS NOT NULL
GROUP BY p.id, ga.asset_type
ORDER BY p.id, n DESC;

RESET work_mem;
\timing off
