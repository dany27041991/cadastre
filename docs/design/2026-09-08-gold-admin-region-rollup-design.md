# Design: gold admin region rollup (consolidated municipality bands)

**Date:** 2026-09-08  
**Status:** accepted  
**Context:** Cold national admin clusters open one MinIO gold file per municipality (~2–3.5 s for 379; extrapolated tens of seconds for ~8k Italy). Warm path already fast via in-process cache.

## Decision

**Option A — post-ingest rollup job** that consolidates per-municipality gold `zoom_band=municipality` rows into **one Parquet per region**. Serving reads those files (O(#regions)) and filters by `resolve_latest_ingests` so `date_from`/`date_to` stay correct.

## Object layout

```
green_assets_admin_clusters/region_id={region_id}/part-municipality-bands.parquet
```

Overwrite on each job run. Schema = existing municipality gold columns **plus** `ingest_at` (date) from the catalog resolution used for that row.

## Serving

`gold_read.read_admin_clusters`:

1. Group resolutions by `region_id`.
2. Try DuckDB `read_parquet` on each region consolidated object.
3. Keep rows whose `(municipality_id, ingest_at)` is in the resolution set.
4. Existing Python rollup to region/province/municipality keys.
5. If any required region file is missing → **fallback** to legacy per-municipality globs.

Grid bands unchanged.

## Job

`infrastructure/scripts/database/lakehouse/rollup_admin_gold.py`:

- Load assets catalog; for each municipality keep max `ingest_at` (full catalog snapshot).
- Read each municipality gold band from MinIO.
- Append `ingest_at`; group by `region_id`; write consolidated parts.
- Optional: call after `run_populate_region_data.sh`.

## Success metrics

| Scenario | Before | Target |
|----------|--------|--------|
| Cold national (379 munis, 2 regions) | ~2–3.5 s | ≪ 500 ms |
| Warm | ~50 ms | unchanged |
| Missing admin files | — | fallback OK |

## Out of scope (V1)

- Consolidated `grid_*` bands
- Per-date-window snapshot keys
- Changing municipal seed writers
