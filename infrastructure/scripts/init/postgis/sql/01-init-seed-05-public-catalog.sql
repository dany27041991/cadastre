-- =============================================================================
-- Tree Cadastre - Seed public catalog (runner)
-- =============================================================================
-- Runs seed scripts in dependency order. Run after 01-init-schema-public.sql.
-- When run from docker-entrypoint-initdb.d, use absolute path so \i resolves.
-- When run manually (run-init.sh), execute from sql dir or use same absolute path in container.
-- Naming 01-init-seed-NN-* ensures order in initdb.d: 01 area_level, 02 primary, 03 secondary, 04 attribute_types.
-- =============================================================================

\i /docker-entrypoint-initdb.d/01-init-seed-01-area-level.sql
\i /docker-entrypoint-initdb.d/01-init-seed-02-primary-types.sql
\i /docker-entrypoint-initdb.d/01-init-seed-03-secondary-types.sql
\i /docker-entrypoint-initdb.d/01-init-seed-04-attribute-types.sql
