-- =============================================================================
-- ESEGUITUTORE: tutte le aggregazioni (benchmark performance)
-- =============================================================================
-- Lancia in sequenza 01..06. In output ogni query mostra il tempo; cercare
-- "Time: XXXXX ms" per individuare query lente (es. > 5000 ms).
--
-- Uso con \ir (da directory scripts/database/performance/sql):
--   cd scripts/database/performance/sql && psql ... -f run_all_aggregations.sql
-- Oppure usare run_all_aggregations.sh dalla root progetto.
-- =============================================================================

\timing on

\echo ''
\echo '========== 01 AGGREGAZIONI ITALIA =========='
\ir 01_aggregations_italy.sql

\echo ''
\echo '========== 02 AGGREGAZIONI PER REGIONE =========='
\ir 02_aggregations_by_region.sql

\echo ''
\echo '========== 03 AGGREGAZIONI PER PROVINCIA =========='
\ir 03_aggregations_by_province.sql

\echo ''
\echo '========== 04 AGGREGAZIONI PER COMUNE =========='
\ir 04_aggregations_by_municipality.sql

\echo ''
\echo '========== 06 AGGREGAZIONI PER AREA LIVELLO =========='
\ir 06_aggregations_by_area_level.sql

\echo ''
\echo '========== 07 AGGREGAZIONI AVANZATE =========='
\ir 07_advanced_aggregations.sql

\echo ''
\echo '========== FINE BENCHMARK AGGREGAZIONI =========='
\timing off
