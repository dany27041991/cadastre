-- =============================================================================
-- Tree Cadastre - Seed cadastre catalog (runner)
-- =============================================================================
-- Runs seed scripts for cadastre schema (ENUM translations).
-- Run after 02-init-schema-cadastre.sql.
-- \ir = include relative to this script's directory (works in initdb.d and run-init.sh).
-- =============================================================================

\ir 02b-1-seed-cadastre-enum-translations.sql
