-- =============================================================================
-- Autovacuum tuning for green_assets, green_areas, asset_area_history, asset_green_history
-- (leaf partitions only). With hierarchical partitioning (region→province), leaves are province-level.
-- PG16: parameters must be set on leaf partitions. Uses recursive CTE for leaves.
-- Run after 06-create-partitions.sql so all province-level leaves exist (run-init.sh runs 05 after 06).
-- =============================================================================

DO $$
DECLARE
  r RECORD;
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
