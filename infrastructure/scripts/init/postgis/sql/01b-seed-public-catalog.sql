-- =============================================================================
-- Tree Cadastre - Seed public catalog (runner)
-- =============================================================================
-- Runs seed scripts in dependency order. Run after 01-init-schema-public.sql.
-- Execute from this directory (postgis/sql) so \i paths resolve, or run the
-- four files manually in order: 01b-1, 01b-2, 01b-3, 01b-4.
-- =============================================================================

\i 01b-1-seed-area-level.sql
\i 01b-2-seed-primary-types.sql
\i 01b-3-seed-secondary-types.sql
\i 01b-4-seed-attribute-types.sql
