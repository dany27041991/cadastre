-- =============================================================================
-- UPDATE MUNICIPALITY - CLEAN: delete assets and areas for target municipality
-- =============================================================================
-- Run before municipality_populate.sql.
-- Target municipality: pass from terminal (run_boost_municipality.sh <comune>).
-- =============================================================================

\timing on
SET work_mem = '256MB';
SET maintenance_work_mem = '512MB';
SET synchronous_commit = OFF;
SET client_min_messages = WARNING;

-- =============================================================================
-- CONFIG: __TARGET_MUNICIPALITY__ sostituito da run_boost_municipality.sh con il nome comune
-- =============================================================================
DO $$
DECLARE
    v_target_municipality TEXT := TRIM('__TARGET_MUNICIPALITY__');
BEGIN
    DROP TABLE IF EXISTS _seed_config;
    CREATE UNLOGGED TABLE _seed_config (
        target_municipality TEXT,
        areas_min INT, areas_max INT,
        asset_min INT, asset_max INT,
        trees_min INT, trees_max INT
    );
    INSERT INTO _seed_config VALUES (
        v_target_municipality, 50000, 100000,
        1000000, 2000000, 300000, 500000
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

RESET work_mem; RESET maintenance_work_mem; RESET synchronous_commit; RESET client_min_messages;

\echo ''
\echo 'CLEAN COMPLETED.'
\timing off
