-- =============================================================================
-- Tree Cadastre - Cadastre schema (placeholder)
-- =============================================================================
-- Green assets/areas/history live in the MinIO lakehouse (Parquet), not PostGIS.
-- Design: docs/design/2026-09-04-green-lakehouse-only-pg-drop-design.md
-- Public admin boundaries + DBT catalogs remain in public schema (01-*).
-- Schema kept empty for future non-green cadastre objects if needed.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS cadastre;

GRANT USAGE ON SCHEMA cadastre TO cadastre;
ALTER DEFAULT PRIVILEGES IN SCHEMA cadastre GRANT ALL ON TABLES TO cadastre;
