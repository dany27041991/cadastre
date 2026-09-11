# Design: multi-snapshot national lakehouse seed (real GeoJSON + mock)

**Date:** 2026-09-10  
**Status:** accepted  
**Context:** Extends [2026-09-09-national-mock-lakehouse-seed-design.md](./2026-09-09-national-mock-lakehouse-seed-design.md). Today the national seeder writes a **single** `ingest_date` of synthetic data for every municipality. Local testing of the FE date range needs **multiple snapshots** (e.g. 2021 / 2023 / 2024). Municipalities with curated GeoJSON under `infrastructure/data/municipality/` must use those files when a matching snapshot folder exists; otherwise generate mock data. Applies to **all** municipalities.

## Goals

- Seed **multiple** lakehouse `ingest_date` snapshots in one national run so date-range UX can be tested.
- For each `(municipality, ingest_date)`:
  - if `data/municipality/<slug>/<YYYY-MM-DD>/` exists with real GeoJSON → ingest **real** data;
  - otherwise → ingest **mock** (existing `boost_one_municipality`).
- Keep job **resumable**, **parallel**, ending with **admin gold rollup**.
- Single layout for municipality data folders (ISO date only).
- Migrate existing flat Lecce GeoJSON into an ISO snapshot folder.

## Non-goals

- Changing serving API / catalog resolution semantics (`max(ingest_at)` in range stays as today).
- Production ETL or automatic download of municipal datasets.
- Inventing year-only folders (`lecce/2024/`) — only full ISO dates.
- Seeding every calendar day; only CLI dates ∪ per-municipality folder dates.
- Keeping dual support for flat `municipality/<slug>/*.geojson` after migration.

## Decisions (agreed)

| Topic | Choice |
|-------|--------|
| Folder layout | Always `municipality/<slug>/<YYYY-MM-DD>/` |
| Date set | CLI list (default `2021-01-01,2023-01-01,2024-01-01`) **∪** ISO subfolders for that municipality only |
| Flat Lecce | Migrate → `lecce/2024-01-01/` as part of this work |
| Architecture | Shared snapshot seeder module reused by national (and Lecce entrypoints) |

## Architecture

```text
run_populate_national_data.sh
  │
  ├─ (optional) wipe_green_lakehouse.py
  │
  ├─ seed_populate_national_data.py
  │     ├─ parse --ingest-dates (default 2021-01-01,2023-01-01,2024-01-01)
  │     ├─ discover municipality slug dirs under DATA_DIR/municipality/
  │     ├─ for each muni: dates = CLI ∪ folder ISO dates
  │     ├─ ThreadPoolExecutor
  │     │     └─ seed_municipality_snapshot(meta, ingest_date, …)
  │     │           ├─ real path? → load GeoJSON tables → ingest_municipality_tables
  │     │           └─ else → boost_one_municipality (mock)
  │     └─ checkpoint municipality_id:ingest_date
  │
  └─ rollup_admin_gold.py
```

### Shared module

New (name indicative):  
`infrastructure/scripts/database/seed/common/seed_municipality_snapshot.py`

Responsibilities:

1. **`municipality_slug(name) -> str`** — lowercased, spaces → `_` (same as today’s `get_data_dir`).
2. **`list_snapshot_dirs(data_root, slug) -> list[date]`** — child dirs matching `^\d{4}-\d{2}-\d{2}$`.
3. **`resolve_dates(cli_dates, slug) -> list[date]`** — sorted unique `cli ∪ folders`.
4. **`snapshot_data_dir(data_root, slug, ingest_date) -> Path | None`** — returns path if directory exists and contains at least `areas.geojson`; else `None`.
5. **`seed_municipality_snapshot(...)`** — real vs mock branch; writes silver/gold/catalog via existing `ingest_municipality_tables`.

Refactor: extract table-building from `load_lecce_green_data.py` so real ingest does not depend on CLI `main()` of the Lecce script. `run_populate_lecce.sh` becomes a thin wrapper that seeds one municipality for `--ingest-dates` (or all ISO folders ∪ CLI).

### Mock determinism

RNG seed: `hash(base_seed, municipality_id, ingest_date)` so two dates for the same comune produce **different** geometries/ids, while remaining reproducible across runs.

### Checkpoint

Unchanged key shape: `"{municipality_id}:{ingest_date}"` in `.national_seed_checkpoint.jsonl`.  
`--resume` skips completed pairs. Multi-date runs naturally create more checkpoint lines (~3× with default three dates).

### CLI / shell

```bash
# Default three snapshots (mock everywhere; Lecce uses folder for 2024-01-01 if present)
./infrastructure/scripts/database/seed/run_populate_national_data.sh \
  --wipe --workers 4 --trees 1200 --hedges 80 --areas 8

# Explicit dates (any year, including 1800-…)
./infrastructure/scripts/database/seed/run_populate_national_data.sh \
  --ingest-dates 1800-06-15,2021-01-01,2024-03-15 --region "Puglia" --limit 5

# Resume
./infrastructure/scripts/database/seed/run_populate_national_data.sh --resume --workers 4
```

| Flag | Behaviour |
|------|-----------|
| `--ingest-dates` | Comma-separated ISO dates; **default** `2021-01-01,2023-01-01,2024-01-01` |
| `--ingest-date` | Deprecated alias: single date → treated as one-element list (compat) |
| `INGEST_DATES` env | Same as CLI if flag omitted |
| Existing `--region`, `--limit`, `--workers`, `--resume`, wipe/rollup | Unchanged |

Volume note: default three dates ≈ **3×** asset count vs previous single-date national seed (~30M assets at full Italy × current density). Operators may lower `--trees` for smoke runs.

## Data layout migration

**Before**

```text
infrastructure/data/municipality/lecce/
  areas.geojson, trees.geojson, hedges.geojson, shrubs.geojson, *.qmd
```

**After**

```text
infrastructure/data/municipality/lecce/2024-01-01/
  areas.geojson, trees.geojson, hedges.geojson, shrubs.geojson, *.qmd
```

With default CLI dates, Lecce gets:

| Date | Source |
|------|--------|
| 2021-01-01 | mock |
| 2023-01-01 | mock |
| 2024-01-01 | **real** GeoJSON |

Extra folders under `lecce/` (e.g. `2022-06-01/`) add snapshots **only for Lecce**, without expanding mock dates nationally.

Update: `seed/README.md`, `run_populate_lecce.sh` docs, and any design notes that point at the flat path.

## Failure / edge cases

| Case | Behaviour |
|------|-----------|
| Folder exists but missing `areas.geojson` | Treat as absent → mock; log warning |
| Folder has areas but empty assets | Allowed (same as current Lecce loader rules) |
| Unknown municipality name vs folder slug | Folder unused; mock only |
| Partial real ingest failure | Fail that task; checkpoint not appended; `--resume` retries |
| Dry-run | Print per-muni date list + real/mock source; no writes |

## Success criteria

- After wipe + national seed with defaults, catalog shows **three** `ingest_at` values for a random mock comune and **real** prefix for Lecce on `2024-01-01`.
- FE date range selecting only 2021 / only 2023 / only 2024 returns non-empty viewport for Area Italia (and Lecce real for 2024).
- `--resume` after interrupt does not re-ingest completed pairs.
- Flat `lecce/*.geojson` no longer present; path is `lecce/2024-01-01/`.

## Relation to prior design

Supersedes the V1 non-goal “Multiple historical ingest dates” in the 2026-09-09 national seed design. Wipe scope, parallelism, catalog lock, and rollup remain as in that document.

## Open points resolved in plan

- Shared module path: `seed/common/seed_municipality_snapshot.py`
- Region seed aligned with the same multi-date + real/mock behaviour in the same change set.
