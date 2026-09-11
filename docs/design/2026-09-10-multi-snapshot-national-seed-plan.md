# Plan: multi-snapshot national lakehouse seed

**Date:** 2026-09-10  
**Design:** [2026-09-10-multi-snapshot-national-seed-design.md](./2026-09-10-multi-snapshot-national-seed-design.md)  
**Status:** approved → implemented

## Current state

- National seed: single `--ingest-date` → mock only via `boost_one_municipality`.
- Lecce real loader: `load_lecce_green_data.py` + flat `data/municipality/lecce/*.geojson`.
- Checkpoint already keyed by `municipality_id:ingest_date`.

## Target state

- `--ingest-dates` (default `2021-01-01,2023-01-01,2024-01-01`).
- Per muni: `CLI ∪ ISO folders` → real GeoJSON if `…/<slug>/<YYYY-MM-DD>/areas.geojson`, else mock.
- Lecce data under `lecce/2024-01-01/`.
- Shared `seed_municipality_snapshot` used by national (+ Lecce/region wrappers).

## Affected files

| File | Change |
|------|--------|
| `infrastructure/data/municipality/lecce/` → `…/lecce/2024-01-01/` | migrate GeoJSON + qmd |
| `seed/common/seed_municipality_snapshot.py` | **create** shared resolve + seed |
| `seed/populate_lecce_data/load_lecce_green_data.py` | extract table loaders; path = slug/ISO |
| `seed/populate_national_data/seed_populate_national_data.py` | multi-date + real/mock branch |
| `seed/populate_region_data/seed_populate_region_data.py` | same multi-date behaviour |
| `seed/boost_municipality/boost_municipality_to_lakehouse.py` | RNG include `ingest_date` |
| `seed/run_populate_national_data.sh` | `INGEST_DATES` / `--ingest-dates` |
| `seed/run_populate_lecce.sh` | ISO path + multi-date |
| `seed/run_populate_region_data.sh` | pass ingest-dates |
| `seed/README.md` | document layout + flags |
| `docs/design/2026-09-10-multi-snapshot-national-seed-design.md` | status → accepted |
| `docs/design/2026-09-09-national-mock-lakehouse-seed-design.md` | note superseded multi-date non-goal |

## Execution plan

### Phase 0 — Migrate Lecce data
- [x] Move `infrastructure/data/municipality/lecce/*.{geojson,qmd}` → `lecce/2024-01-01/`
- Verify: directory listing shows only ISO child under `lecce/`

### Phase 1 — Shared snapshot module
- [x] Add `seed/common/seed_municipality_snapshot.py`
- [x] Refactor `load_lecce_green_data.py`
- Verify: resolve_dates for Lecce → 2021/2023 mock + 2024 real

### Phase 2 — Mock RNG + national orchestrator
- [x] Multi-date national orchestrator + dry-run source labels
- Verify: Puglia dry-run shows 3 dates per muni

### Phase 3 — Region + Lecce shells
- [x] Align region/Lecce scripts and shells
- Verify: helpers resolve Lecce 2024 as real

### Phase 4 — Docs
- [x] Update `seed/README.md`
- [x] Mark design accepted

## Rollback

- Restore Lecce flat files from git if migration committed and needs revert.
- `--wipe` + old single-date seeder (git checkout) restores previous single-snapshot behaviour.
- Checkpoint delete + re-run for partial failures.

## Done when

- Default national/region seed produces three snapshots; Lecce `2024-01-01` from GeoJSON; mock elsewhere.
- Checkpoint/resume works per `(muni, date)`.
- Docs updated; design status `accepted`.
