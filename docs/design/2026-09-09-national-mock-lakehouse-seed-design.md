# Design: national mock lakehouse seed (~10M+ assets)

**Date:** 2026-09-09  
**Status:** accepted  
**Note (2026-09-10):** the V1 non-goal “Multiple historical ingest dates” is superseded by [2026-09-10-multi-snapshot-national-seed-design.md](./2026-09-10-multi-snapshot-national-seed-design.md).  
**Context:** Local/MinIO performance testing at Italy scale after admin gold rollup and viewport optimizations. Current catalog covers ~2 regions (~379 munis); need full territory with millions of synthetic assets.

- Wipe existing **green** lakehouse objects and reseed **all Italian municipalities** from PostGIS admin geometries.
- Target **≥ ~10M green assets** (trees + hedges) in silver + gold + catalog.
- Job must be **resumable**, **parallel**, and end with **admin gold rollup**.
- Keep areas lean (not millions of polygons) so viewport z≥12 stays usable.

## Non-goals

- Changing serving API or FE.
- Populating PostGIS green tables (lakehouse-only SoR).
- Production ETL / real GeoJSON sources.
- Multiple historical ingest dates in V1 (single batch date).

## Decision

**Approach 2 — parallel national seed + checkpoint**, reusing `boost_municipality_to_lakehouse` / region populate building blocks.

### Density defaults (calibrated to ~10–12M assets)

| Param | Default | Notes |
|-------|---------|--------|
| `--trees` | 1200 / municipality | Primary volume |
| `--hedges` | 80 / municipality | Lines; modest |
| `--areas` | 8 / municipality | Polygons; keep light |
| `--workers` | 4 | Tunable; MinIO/CPU bound |
| `--ingest-date` | today (or explicit) | Single batch |
| `--seed` | 42 | Deterministic per muni via `hash(seed, municipality_id)` |

Estimate: ~7900 munis × ~(1200+80) ≈ **~10.1M assets** (+ ~63k areas).

### Wipe scope (green only)

Delete object prefixes under bucket (default `cadastre-lake`):

- `green_assets/`
- `green_areas/`
- `green_assets_clusters/`
- `green_assets_admin_clusters/`
- `_catalog/`

Do **not** delete unrelated MinIO content. PostGIS untouched.

Optional flag: `--skip-wipe` for resume-only runs after a partial wipe already done.

## Architecture

```text
run_populate_national_data.sh
  │
  ├─ (optional) wipe_green_lakehouse.py
  │
  ├─ seed_populate_national_data.py
  │     ├─ list all regions + municipalities (PostGIS)
  │     ├─ load checkpoint set (done municipality_ids × ingest_date)
  │     ├─ ThreadPoolExecutor(workers)
  │     │     └─ boost_one_municipality(...)  # existing
  │     └─ append checkpoint after each success
  │
  └─ rollup_admin_gold.py   # existing; O(#regions) admin parts
```

### Checkpoint

File (host-local, not MinIO):  
`infrastructure/scripts/database/seed/.national_seed_checkpoint.jsonl`

Each line: `{"municipality_id": N, "ingest_date": "YYYY-MM-DD", "ok": true, "ts": "..."}`.

`--resume` skips ids already marked ok for that ingest date.  
`--reset-checkpoint` clears file before run.

### Parallelism & safety

- Workers share one process; each task: read muni geom (or prefetch list), build tables, `ingest_municipality_tables` (S3 put).
- Catalog updates: today `ingest_municipality_tables` rewrites catalog — **must serialize catalog writes** (lock) or batch catalog flush at end. Prefer **process-wide lock around catalog merge** in writer path used by national seed, or a national-seed-only “defer catalog” mode that writes a final catalog from checkpoint + part listing.
- **Recommended V1:** add optional `defer_catalog=True` on ingest used by national job; after all munis, rebuild catalog once from successful parts (or append under lock per muni — simpler if lock is enough given ~7900 sequential catalog rewrites under lock).

**V1 catalog strategy (chosen):** mutex around catalog read-modify-write in `lakehouse_writer` when env `LAKEHOUSE_CATALOG_LOCK=1` or always (low contention cost vs correctness). National seed enables lock; existing single-thread region seed unchanged behaviorally.

### CLI / shell

```bash
# Smoke (Valle d'Aosta only)
./infrastructure/scripts/database/seed/run_populate_national_data.sh \
  --region "Valle d'Aosta" --workers 2 --trees 100 --dry-run

# Full Italy wipe + seed
./infrastructure/scripts/database/seed/run_populate_national_data.sh \
  --wipe --workers 4 --trees 1200 --hedges 80 --areas 8

# Resume after interrupt
./infrastructure/scripts/database/seed/run_populate_national_data.sh \
  --resume --workers 4 --trees 1200 --hedges 80 --areas 8
```

Flags:

| Flag | Meaning |
|------|---------|
| `--wipe` | Delete green prefixes before seed |
| `--resume` | Skip checkpointed municipalities |
| `--reset-checkpoint` | Clear checkpoint file |
| `--region` | Optional: only one region (smoke / partial) |
| `--limit` | First N munis globally (smoke) |
| `--workers` | Parallelism |
| `--trees/--hedges/--areas/--ingest-date/--seed` | As region seed |
| `--skip-rollup` | Skip final admin rollup |
| `--dry-run` | List counts only |

## Success metrics

| Check | Target |
|-------|--------|
| Catalog assets rows (latest) | ~7900 munis |
| Sum asset `row_count` | ≥ 10M |
| Admin rollup | 20 region parts (or whatever regions exist in PG) |
| National viewport z5 | Returns clusters for many `R*` keys; cold ≪ multi-second without rollup regression |
| Resume | Kill mid-run → `--resume` completes without duplicating work |

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Disk / MinIO full | Document rough size (~tens of GB); monitor; smoke first |
| Catalog race | Lock or deferred catalog |
| Overnight duration | Workers 4–8; checkpoint; progress logs every N munis |
| Raw z19 FE still capped at 800 | Expected; test admin/grid paths for “big data” |
| ID collisions across munis | Keep existing boost id scheme (per-muni local ids OK if serving scopes by hive path) |

## Out of scope (follow-ups)

- Province-level gold pre-aggregation
- Multi-date national history
- Kubernetes Job chart for the seed

## Implementation sketch (files)

| File | Action |
|------|--------|
| `seed/wipe_green_lakehouse.py` | New — prefix delete |
| `seed/populate_national_data/seed_populate_national_data.py` | New — orchestrator |
| `seed/run_populate_national_data.sh` | New — env + wipe + seed + rollup |
| `lakehouse/lakehouse_writer.py` | Small — catalog write lock |
| `docs/infrastructure/lakehouse-parquet-layout.md` | Note admin + national seed pointer |
| `docs/design/2026-09-09-…-plan.md` | Implementation plan (after spec OK) |

## Open points (defaults if no feedback)

1. Catalog: **mutex** on every catalog update (simplest).  
2. Workers default **4**.  
3. Checkpoint path under `seed/.national_seed_checkpoint.jsonl` (gitignored).
