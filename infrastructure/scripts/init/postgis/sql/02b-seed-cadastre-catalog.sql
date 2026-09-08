-- =============================================================================
-- Tree Cadastre - Seed cadastre catalog (runner)
-- =============================================================================
-- ENUM label translations for green domain values (used by UI / lakehouse attrs).
-- Types themselves are not created in PostGIS (lakehouse-only storage).
-- Run after 02-init-schema-cadastre.sql.
-- =============================================================================

\ir 02b-1-seed-cadastre-enum-translations.sql
