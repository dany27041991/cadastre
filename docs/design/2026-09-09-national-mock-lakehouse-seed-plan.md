# Plan: national mock lakehouse seed (~10M+ assets)

**Date:** 2026-09-09  
**Design:** [2026-09-09-national-mock-lakehouse-seed-design.md](./2026-09-09-national-mock-lakehouse-seed-design.md)  
**Status:** approved → implementing

## Current state

- Per-region seed: `run_populate_region_data.sh` → `seed_populate_region_data.py` → `boost_one_municipality` → `ingest_municipality_tables` + gold.
- Admin rollup: `rollup_admin_gold.py` (wired after region seed).
- No national wipe / parallel / checkpoint.

## Target state

- Wipe green MinIO prefixes → parallel seed all (or filtered) municipalities → checkpoint/resume → admin rollup.
- Defaults: trees=1200, hedges=80, areas=8, workers=4 → ~10M assets.

## Affected files

| File | Change |
|------|--------|
| `seed/wipe_green_lakehouse.py` | create |
| `seed/populate_national_data/seed_populate_national_data.py` | create |
| `seed/run_populate_national_data.sh` | create |
| `lakehouse/lakehouse_writer.py` | catalog RMW lock |
| `seed/.gitignore` or root `.gitignore` | ignore checkpoint |
| `docs/infrastructure/lakehouse-parquet-layout.md` | pointer to national seed + admin path |
| design status | mark accepted |

## Execution plan

### Phase 1 — Catalog lock
- [ ] Add threading lock around catalog read-modify-write in `lakehouse_writer.py`
- Verify: two sequential ingests still update catalog

### Phase 2 — Wipe
- [ ] `wipe_green_lakehouse.py` deletes listed prefixes (paginated list+delete)
- Verify: dry-run lists keys; real wipe empties prefixes

### Phase 3 — National orchestrator
- [ ] List all regions/munis from PG (reuse boost helpers; add `list_all_regions`)
- [ ] ThreadPoolExecutor + checkpoint JSONL
- [ ] Flags: wipe/resume/region/limit/workers/density/dry-run/skip-rollup
- Verify: `--region "Valle d'Aosta" --limit 2 --trees 50 --dry-run`

### Phase 4 — Shell wrapper
- [ ] `run_populate_national_data.sh` (same env pattern as region script)
- Verify: smoke VdA small density + rollup

### Phase 5 — Docs + full run
- [ ] Update parquet layout doc
- [ ] User/CI: full `--wipe` national run overnight if desired

## Rollback

- Keep previous MinIO backup only if user exported; otherwise re-seed.
- Checkpoint file delete = full reseed of remaining with `--wipe` again.

## Done when

- Smoke VdA OK; script ready for full Italy; design status `accepted`.
