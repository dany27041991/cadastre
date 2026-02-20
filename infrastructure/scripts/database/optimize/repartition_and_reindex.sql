-- =============================================================================
-- OPTIMIZATION: Partizioni gerarchiche (region→province) e ricostruzione indici
-- =============================================================================
-- Da eseguire quando le performance si degradano nel tempo.
-- Allineato a: 03-init-indexes-public.sql, 04-init-indexes-cadastre.sql,
--              05-autovacuum-tuning.sql, 06-create-partitions.sql.
--
-- 1. Crea partizioni mancanti (region → province) per green_assets, green_areas,
--    asset_area_history, asset_green_history e indici sulle nuove foglie (come 06).
-- 2. REINDEX su tabelle public e cadastre (ricostruisce indici esistenti).
-- 3. ANALYZE per aggiornare le statistiche.
-- 4. (Opzionale) Applica autovacuum tuning alle foglie come 05.
--
-- Usage: psql -U cadastre -d arboreal_green_cadastre -f scripts/database/optimize/repartition_and_reindex.sql
-- =============================================================================

\timing on
SET work_mem = '256MB';
SET maintenance_work_mem = '512MB';
SET client_min_messages = WARNING;

\echo ''
\echo '========== STEP 1: Partizioni gerarchiche (region → province) + indici =========='

DO $$
DECLARE
  rec_region RECORD;
  rec_province RECORD;
  p_av_region TEXT;
  p_ar_region TEXT;
  p_ah_region TEXT;
  p_gh_region TEXT;
  p_av_leaf TEXT;
  p_ar_leaf TEXT;
  p_ah_leaf TEXT;
  p_gh_leaf TEXT;
  n_av INT := 0;
  n_ar INT := 0;
  n_ah INT := 0;
  n_gh INT := 0;
BEGIN
  -- Stessa logica di 06-create-partitions.sql: per ogni regione e ogni sua provincia
  FOR rec_region IN SELECT id FROM public.regions ORDER BY id
  LOOP
    p_av_region := 'cadastre.green_assets_' || rec_region.id;
    p_ar_region := 'cadastre.green_areas_' || rec_region.id;
    p_ah_region := 'cadastre.asset_area_history_' || rec_region.id;
    p_gh_region := 'cadastre.asset_green_history_' || rec_region.id;

    -- Partizione di livello regione (se non esiste)
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %s PARTITION OF cadastre.green_assets FOR VALUES IN (%s) PARTITION BY LIST (province_id)',
      p_av_region, rec_region.id
    );
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %s PARTITION OF cadastre.green_areas FOR VALUES IN (%s) PARTITION BY LIST (province_id)',
      p_ar_region, rec_region.id
    );
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %s PARTITION OF cadastre.asset_area_history FOR VALUES IN (%s) PARTITION BY LIST (province_id)',
      p_ah_region, rec_region.id
    );
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %s PARTITION OF cadastre.asset_green_history FOR VALUES IN (%s) PARTITION BY LIST (province_id)',
      p_gh_region, rec_region.id
    );

    FOR rec_province IN SELECT id FROM public.provinces WHERE region_id = rec_region.id ORDER BY id
    LOOP
      p_av_leaf := p_av_region || '_' || rec_province.id;
      p_ar_leaf := p_ar_region || '_' || rec_province.id;
      p_ah_leaf := p_ah_region || '_' || rec_province.id;
      p_gh_leaf := p_gh_region || '_' || rec_province.id;

      -- Foglie provincia + indici come 06-create-partitions.sql
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %s PARTITION OF %s FOR VALUES IN (%s)',
        p_av_leaf, p_av_region, rec_province.id
      );
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_ga_%s_%s_geom ON %s USING GIST(geometry)', rec_region.id, rec_province.id, p_av_leaf);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_ga_%s_%s_asset_type ON %s(asset_type)', rec_region.id, rec_province.id, p_av_leaf);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_ga_%s_%s_point_munic ON %s(geometry_type, region_id, municipality_id) WHERE geometry_type = ''point''', rec_region.id, rec_province.id, p_av_leaf);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_ga_%s_%s_point_prov ON %s(geometry_type, region_id, province_id) WHERE geometry_type = ''point''', rec_region.id, rec_province.id, p_av_leaf);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_ga_%s_%s_point_sub ON %s(geometry_type, region_id, municipality_id, sub_municipal_area_id) WHERE geometry_type = ''point'' AND sub_municipal_area_id IS NOT NULL', rec_region.id, rec_province.id, p_av_leaf);
      n_av := n_av + 1;

      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %s PARTITION OF %s FOR VALUES IN (%s)',
        p_ar_leaf, p_ar_region, rec_province.id
      );
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_ar_%s_%s_geom ON %s USING GIST(geometry)', rec_region.id, rec_province.id, p_ar_leaf);
      n_ar := n_ar + 1;

      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %s PARTITION OF %s FOR VALUES IN (%s)',
        p_ah_leaf, p_ah_region, rec_province.id
      );
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_ah_%s_%s_asset_area_id ON %s(asset_area_id)', rec_region.id, rec_province.id, p_ah_leaf);
      n_ah := n_ah + 1;

      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %s PARTITION OF %s FOR VALUES IN (%s)',
        p_gh_leaf, p_gh_region, rec_province.id
      );
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_gh_%s_%s_asset_green_id ON %s(asset_green_id)', rec_region.id, rec_province.id, p_gh_leaf);
      n_gh := n_gh + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Partizioni verificate/creates: green_assets % leaves, green_areas % leaves, asset_area_history % leaves, asset_green_history % leaves', n_av, n_ar, n_ah, n_gh;
END $$;

\echo ''
\echo '========== STEP 2: REINDEX (ricostruzione indici esistenti) =========='

\echo 'REINDEX public...'
REINDEX TABLE public.regions;
REINDEX TABLE public.provinces;
REINDEX TABLE public.municipalities;
REINDEX TABLE public.sub_municipal_area;
REINDEX TABLE public.census_section;

\echo 'REINDEX cadastre (partitioned + tutte le partizioni)...'
REINDEX TABLE cadastre.green_areas;
REINDEX TABLE cadastre.green_assets;
REINDEX TABLE cadastre.asset_area_history;
REINDEX TABLE cadastre.asset_green_history;

\echo ''
\echo '========== STEP 3: ANALYZE =========='

ANALYZE public.regions;
ANALYZE public.provinces;
ANALYZE public.municipalities;
ANALYZE public.sub_municipal_area;
ANALYZE public.census_section;
ANALYZE cadastre.green_areas;
ANALYZE cadastre.green_assets;
ANALYZE cadastre.asset_area_history;
ANALYZE cadastre.asset_green_history;

\echo ''
\echo '========== STEP 4: Autovacuum tuning su foglie (come 05-autovacuum-tuning.sql) =========='

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    WITH RECURSIVE part_tree AS (
      SELECT i.inhrelid AS part_oid
      FROM pg_inherits i
      JOIN pg_class p ON p.oid = i.inhparent
      JOIN pg_namespace n ON p.relnamespace = n.oid
      WHERE p.relname = 'green_assets' AND n.nspname = 'cadastre'
      UNION ALL
      SELECT i.inhrelid FROM pg_inherits i
      JOIN part_tree pt ON pt.part_oid = i.inhparent
    )
    SELECT c.relname FROM part_tree pt
    JOIN pg_class c ON c.oid = pt.part_oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'cadastre'
    AND NOT EXISTS (SELECT 1 FROM pg_inherits i2 WHERE i2.inhparent = pt.part_oid)
  LOOP
    EXECUTE format(
      'ALTER TABLE cadastre.%I SET (autovacuum_vacuum_cost_delay = 1, autovacuum_vacuum_cost_limit = 1000)',
      r.relname
    );
  END LOOP;

  FOR r IN
    WITH RECURSIVE part_tree AS (
      SELECT i.inhrelid AS part_oid
      FROM pg_inherits i
      JOIN pg_class p ON p.oid = i.inhparent
      JOIN pg_namespace n ON p.relnamespace = n.oid
      WHERE p.relname = 'green_areas' AND n.nspname = 'cadastre'
      UNION ALL
      SELECT i.inhrelid FROM pg_inherits i
      JOIN part_tree pt ON pt.part_oid = i.inhparent
    )
    SELECT c.relname FROM part_tree pt
    JOIN pg_class c ON c.oid = pt.part_oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'cadastre'
    AND NOT EXISTS (SELECT 1 FROM pg_inherits i2 WHERE i2.inhparent = pt.part_oid)
  LOOP
    EXECUTE format(
      'ALTER TABLE cadastre.%I SET (autovacuum_vacuum_cost_delay = 1, autovacuum_vacuum_cost_limit = 1000)',
      r.relname
    );
  END LOOP;

  FOR r IN
    WITH RECURSIVE part_tree AS (
      SELECT i.inhrelid AS part_oid
      FROM pg_inherits i
      JOIN pg_class p ON p.oid = i.inhparent
      JOIN pg_namespace n ON p.relnamespace = n.oid
      WHERE p.relname = 'asset_area_history' AND n.nspname = 'cadastre'
      UNION ALL
      SELECT i.inhrelid FROM pg_inherits i
      JOIN part_tree pt ON pt.part_oid = i.inhparent
    )
    SELECT c.relname FROM part_tree pt
    JOIN pg_class c ON c.oid = pt.part_oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'cadastre'
    AND NOT EXISTS (SELECT 1 FROM pg_inherits i2 WHERE i2.inhparent = pt.part_oid)
  LOOP
    EXECUTE format(
      'ALTER TABLE cadastre.%I SET (autovacuum_vacuum_cost_delay = 1, autovacuum_vacuum_cost_limit = 1000)',
      r.relname
    );
  END LOOP;

  FOR r IN
    WITH RECURSIVE part_tree AS (
      SELECT i.inhrelid AS part_oid
      FROM pg_inherits i
      JOIN pg_class p ON p.oid = i.inhparent
      JOIN pg_namespace n ON p.relnamespace = n.oid
      WHERE p.relname = 'asset_green_history' AND n.nspname = 'cadastre'
      UNION ALL
      SELECT i.inhrelid FROM pg_inherits i
      JOIN part_tree pt ON pt.part_oid = i.inhparent
    )
    SELECT c.relname FROM part_tree pt
    JOIN pg_class c ON c.oid = pt.part_oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'cadastre'
    AND NOT EXISTS (SELECT 1 FROM pg_inherits i2 WHERE i2.inhparent = pt.part_oid)
  LOOP
    EXECUTE format(
      'ALTER TABLE cadastre.%I SET (autovacuum_vacuum_cost_delay = 1, autovacuum_vacuum_cost_limit = 1000)',
      r.relname
    );
  END LOOP;
END $$;

RESET work_mem;
RESET maintenance_work_mem;
RESET client_min_messages;

\echo ''
\echo '========== OPTIMIZATION COMPLETE =========='
\timing off
