-- =============================================================================
-- UPDATE MUNICIPALITY - CLEAN: delete assets and areas for target municipality
-- =============================================================================
-- Run before municipality_populate.sql.
-- Target municipality: pass from terminal (run_boost_municipality.sh <comune>).
--
-- Data model (aligned with seed_populate_region_data.sql and municipality_populate.sql):
-- Green areas contain assets of type point (P), line (L), surface (S). No overlap: S in disjoint grid;
-- gap = area minus S; L and P only in the gap; P in gap minus buffer(L) so L and P never overlap.
--
-- Session: work_mem, maintenance_work_mem, jit. Target orders: aree ~1.600, alberi ~320k, filari ~119k.
-- =============================================================================

\timing on
SET work_mem = '512MB';
SET maintenance_work_mem = '1GB';
SET synchronous_commit = OFF;
SET client_min_messages = WARNING;
SET jit = OFF;

-- =============================================================================
-- CONFIG: __TARGET_MUNICIPALITY__ sostituito da run_boost_municipality.sh con il nome comune
-- Ordini di grandezza: aree verdi ~1.600, alberi ~320k, filari ~119k (prati 4–5k ha in populate).
-- =============================================================================
DO $$
DECLARE
    v_target_municipality TEXT := TRIM('__TARGET_MUNICIPALITY__');
BEGIN
    DROP TABLE IF EXISTS _seed_config;
    CREATE UNLOGGED TABLE _seed_config (
        target_municipality TEXT,
        areas_min INT, areas_max INT,
        trees_min INT, trees_max INT,
        rows_min INT, rows_max INT
    );
    INSERT INTO _seed_config VALUES (
        v_target_municipality, 1500, 1700,
        300000, 340000, 115000, 123000
    );
    RAISE NOTICE 'Clean for municipality: %', v_target_municipality;
END $$;

-- -----------------------------------------------------------------------------
-- STEP 1: Load target municipality
-- -----------------------------------------------------------------------------
\echo ''
\echo '[STEP 1] Loading target municipality...'

DROP TABLE IF EXISTS _seed_municipality;
CREATE UNLOGGED TABLE _seed_municipality AS
SELECT c.id AS municipality_id, c.istat_code, c.name AS municipality_name, c.geometry,
       ST_Area(c.geometry::geography) / 1000000.0 AS area_km2
FROM public.municipalities c
JOIN _seed_config cfg ON LOWER(TRIM(c.name)) = LOWER(TRIM(cfg.target_municipality))
WHERE c.geometry IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM _seed_municipality) THEN
        RAISE EXCEPTION 'Municipality not found: %', (SELECT target_municipality FROM _seed_config LIMIT 1);
    END IF;
END $$;

CREATE INDEX idx_seed_municipality_geom ON _seed_municipality USING GIST(geometry);

SELECT municipality_name, istat_code, ROUND(area_km2::numeric, 2) AS area_km2 FROM _seed_municipality;

-- -----------------------------------------------------------------------------
-- STEP 2: Delete assets and areas (no parallel workers)
-- Re-created by municipality_populate with geometry_type P/L/S per OBT
-- (docs/database/obt/types/attribute_types.md, 01-init-seed-04-attribute-types.sql).
-- -----------------------------------------------------------------------------
\echo ''
\echo '[STEP 2] Deleting existing assets and areas...'

SET max_parallel_workers_per_gather = 0;

CREATE INDEX IF NOT EXISTS idx_green_assets_green_area_id ON cadastre.green_assets(green_area_id);

DO $$
DECLARE
  n_assets BIGINT;
  n_areas_l2 BIGINT;
  n_areas_l1 BIGINT;
  mid INT;
BEGIN
  SELECT municipality_id INTO mid FROM _seed_municipality LIMIT 1;
  IF mid IS NULL THEN
    RAISE EXCEPTION 'Nessun comune trovato in _seed_municipality';
  END IF;

  DELETE FROM cadastre.green_assets WHERE municipality_id IN (SELECT municipality_id FROM _seed_municipality);
  GET DIAGNOSTICS n_assets = ROW_COUNT;
  RAISE NOTICE 'Eliminati % green_assets per municipality_id %', n_assets, mid;

  DELETE FROM cadastre.green_areas WHERE municipality_id IN (SELECT municipality_id FROM _seed_municipality) AND level = 2;
  GET DIAGNOSTICS n_areas_l2 = ROW_COUNT;
  RAISE NOTICE 'Eliminate % green_areas (level 2) per municipality_id %', n_areas_l2, mid;

  DELETE FROM cadastre.green_areas WHERE municipality_id IN (SELECT municipality_id FROM _seed_municipality) AND level = 1;
  GET DIAGNOSTICS n_areas_l1 = ROW_COUNT;
  RAISE NOTICE 'Eliminate % green_areas (level 1) per municipality_id %', n_areas_l1, mid;
END $$;

-- -----------------------------------------------------------------------------
-- Drop temp tables
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS _seed_config, _seed_municipality;

RESET work_mem; RESET maintenance_work_mem; RESET synchronous_commit; RESET client_min_messages; RESET jit;

\echo ''
\echo 'CLEAN COMPLETED.'
\timing off
