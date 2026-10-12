"""Silver read tuning constants (table chunking, cache TTL)."""

# One DuckDB read_parquet() with thousands of national globs + COUNT(*) hangs
# (measured: /green-areas/table Italy >60s curl timeout). Below this size keep
# the exact single-shot path; above it, walk municipality chunks for rows.
# Exact totals: cache/gold when ready; otherwise has_more + background COUNT
# (sync national COUNT caused NetworkError / empty table in the browser).
_TABLE_SINGLE_SHOT_MAX = 40
_TABLE_WIDE_CHUNK = 40
_TABLE_COUNT_CHUNK = 80
# Longer warm so pager exact-total refetches hit cache after Cerca (debug 4fe799
# Fase 2: 120s was short vs multi-zoom sessions).
_TABLE_COUNT_TTL_SEC = 300.0
# Attribute search allowlist: munis with gold presence > floor (path B — no
# density sort). Floor 0 = every nonempty muni so national filters (e.g. Area
# boost) are complete; stubs with mode≈8 must not be dropped.
_FILTER_DENSE_FLOOR = 0
_ALLOWLIST_TTL_SEC = 120.0
