-- =============================================================================
-- AGGREGAZIONI LIVELLO: REGIONE (solo ID - mappare nomi con query separate)
-- =============================================================================
-- Benchmark puro: nessuna JOIN con lookup. Restituisce region_id per mapping.
-- 
-- ⚡ OTTIMIZZATO: Partition pruning su query GEO (ga.region_id = r.id)
-- ⚡ OTTIMIZZATO: Indici compositi parziali per query POINT (geometry_type = 'P' per OBT)
-- =============================================================================

\timing on
SET work_mem = '256MB';

\echo ''
\echo '=== LIVELLO REGIONE ==='

-- Q_REGIONE_asset_totale
\echo 'Q_REGIONE_asset_totale: asset totali per region_id'
SELECT region_id, COUNT(id) AS asset_totale
FROM cadastre.green_assets
WHERE region_id IS NOT NULL
GROUP BY region_id
ORDER BY asset_totale DESC;

-- Q_REGIONE_asset_per_asset_type
\echo 'Q_REGIONE_asset_per_asset_type: asset per region_id e asset_type'
SELECT region_id, asset_type, COUNT(*) AS n
FROM cadastre.green_assets
WHERE region_id IS NOT NULL
GROUP BY region_id, asset_type
ORDER BY region_id, n DESC;

-- Q_REGIONE_species_distinte
\echo 'Q_REGIONE_species_distinte: species distinte per region_id'
SELECT region_id, COUNT(DISTINCT species) AS species_distinte
FROM cadastre.green_assets
WHERE region_id IS NOT NULL AND species IS NOT NULL AND species != ''
GROUP BY region_id
ORDER BY species_distinte DESC;

-- Q_REGIONE_aree_per_level
\echo 'Q_REGIONE_aree_per_level: aree_verdi per region_id e level'
SELECT region_id, level, COUNT(*) AS n
FROM cadastre.green_areas
WHERE region_id IS NOT NULL
GROUP BY region_id, level
ORDER BY region_id, level;

-- =============================================================================
-- EQUIVALENTI CON ST_Intersects (geometry) - per confronto performance
-- =============================================================================

\echo ''
\echo '=== LIVELLO REGIONE (ST_Intersects) ==='

-- Q_REGIONE_GEO_asset_totale
\echo 'Q_REGIONE_GEO_asset_totale: asset totali per regione (via ST_Intersects)'
SELECT r.id AS region_id, COUNT(ga.id) AS asset_totale
FROM public.regions r
JOIN cadastre.green_assets ga ON ST_Intersects(ga.geometry, r.geometry)
  AND ga.region_id = r.id  -- ⚡ PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND r.geometry IS NOT NULL
GROUP BY r.id
ORDER BY asset_totale DESC;

-- Q_REGIONE_GEO_asset_per_asset_type
\echo 'Q_REGIONE_GEO_asset_per_asset_type: asset per regione e asset_type (via ST_Intersects)'
SELECT r.id AS region_id, ga.asset_type, COUNT(*) AS n
FROM public.regions r
JOIN cadastre.green_assets ga ON ST_Intersects(ga.geometry, r.geometry)
  AND ga.region_id = r.id  -- ⚡ PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND r.geometry IS NOT NULL
GROUP BY r.id, ga.asset_type
ORDER BY r.id, n DESC;

-- Q_REGIONE_GEO_species_distinte
\echo 'Q_REGIONE_GEO_species_distinte: species distinte per regione (via ST_Intersects)'
SELECT r.id AS region_id, COUNT(DISTINCT ga.species) AS species_distinte
FROM public.regions r
JOIN cadastre.green_assets ga ON ST_Intersects(ga.geometry, r.geometry)
  AND ga.region_id = r.id  -- ⚡ PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND r.geometry IS NOT NULL
  AND ga.species IS NOT NULL AND ga.species != ''
GROUP BY r.id
ORDER BY species_distinte DESC;

-- =============================================================================
-- ST_Within (solo POINT) - ottimizzato per geometrie puntuali
-- =============================================================================

\echo ''
\echo '=== LIVELLO REGIONE (ST_Within - solo POINT) ==='

-- Q_REGIONE_WITHIN_asset_totale
\echo 'Q_REGIONE_WITHIN_asset_totale: asset POINT per regione (via ST_Within)'
SELECT r.id AS region_id, COUNT(ga.id) AS asset_totale
FROM public.regions r
JOIN cadastre.green_assets ga ON ST_Within(ga.geometry, r.geometry)
  AND ga.region_id = r.id  -- ⚡ PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND r.geometry IS NOT NULL
  AND ga.geometry_type = 'P'  -- ⚡ INDICE COMPOSITO PARZIALE
GROUP BY r.id
ORDER BY asset_totale DESC;

-- Q_REGIONE_WITHIN_asset_per_asset_type
\echo 'Q_REGIONE_WITHIN_asset_per_asset_type: asset POINT per regione e asset_type (via ST_Within)'
SELECT r.id AS region_id, ga.asset_type, COUNT(*) AS n
FROM public.regions r
JOIN cadastre.green_assets ga ON ST_Within(ga.geometry, r.geometry)
  AND ga.region_id = r.id  -- ⚡ PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND r.geometry IS NOT NULL
  AND ga.geometry_type = 'P'  -- ⚡ INDICE COMPOSITO PARZIALE
GROUP BY r.id, ga.asset_type
ORDER BY r.id, n DESC;

-- =============================================================================
-- ST_Contains - poligono contiene geometria (qualsiasi asset_type)
-- =============================================================================

\echo ''
\echo '=== LIVELLO REGIONE (ST_Contains) ==='

-- Q_REGIONE_CONTAINS_asset_totale
\echo 'Q_REGIONE_CONTAINS_asset_totale: asset per regione (via ST_Contains)'
SELECT r.id AS region_id, COUNT(ga.id) AS asset_totale
FROM public.regions r
JOIN cadastre.green_assets ga ON ST_Contains(r.geometry, ga.geometry)
  AND ga.region_id = r.id  -- ⚡ PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND r.geometry IS NOT NULL
GROUP BY r.id
ORDER BY asset_totale DESC;

-- Q_REGIONE_CONTAINS_asset_per_asset_type
\echo 'Q_REGIONE_CONTAINS_asset_per_asset_type: asset per regione e asset_type (via ST_Contains)'
SELECT r.id AS region_id, ga.asset_type, COUNT(*) AS n
FROM public.regions r
JOIN cadastre.green_assets ga ON ST_Contains(r.geometry, ga.geometry)
  AND ga.region_id = r.id  -- ⚡ PARTITION PRUNING
WHERE ga.geometry IS NOT NULL AND r.geometry IS NOT NULL
GROUP BY r.id, ga.asset_type
ORDER BY r.id, n DESC;

RESET work_mem;
\timing off
