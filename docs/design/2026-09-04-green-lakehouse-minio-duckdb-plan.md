# Plan — Lakehouse green MinIO + DuckDB

> **STORICO / SUPERSEDED (cutover 2026-09-04)**  
> Questo plan (T0–T7) descrive l’introduzione dual-path + flag `GREEN_LAKEHOUSE_ENABLED` + export PG→MinIO + profile compose.  
> **Stato runtime attuale:** lakehouse-only — vedi [2026-09-04-green-lakehouse-only-pg-drop-design.md](./2026-09-04-green-lakehouse-only-pg-drop-design.md) · [plan](./2026-09-04-green-lakehouse-only-pg-drop-plan.md).  
> Restano utili dal design parent: layout Parquet, risoluzione temporale, gold clusters, contratti API path/shape.

**Design (storico):** [2026-09-04-green-lakehouse-minio-duckdb-design.md](./2026-09-04-green-lakehouse-minio-duckdb-design.md)  
**Stato:** accepted — T0–T7 chiusi *(poi sostituiti dal cutover lakehouse-only)*  
**Cutover successivo (lakehouse-only / drop PG green):** [2026-09-04-green-lakehouse-only-pg-drop-design.md](./2026-09-04-green-lakehouse-only-pg-drop-design.md) · [plan](./2026-09-04-green-lakehouse-only-pg-drop-plan.md)  
**Regola (storica):** non aprire T(n+1) se T(n) non è done (spike paralleli solo se marcati). Spuntare e annotare PR/commit a ogni chiusura.

## Tasklist pinnabile

### T0 — Spec, docs, MinIO locale
- [x] Design + plan reviewati e accettati
- [x] Servizio MinIO in compose (profilo `lakehouse`) + bucket `cadastre-lake` (init `mc`)
- [x] Env documentati: `GREEN_LAKEHOUSE_*`, credenziali S3, endpoint (`lakehouse.env.example` + puntatore in `.env.example` + doc infra)
- [x] Doc infra [../infrastructure/minio-lakehouse.md](../infrastructure/minio-lakehouse.md) pubblicata

**Done when:** `mc ls` / AWS CLI vede il bucket; flag default OFF; nessun impatto runtime attuale.  
**Nota T0:** avvio opzionale `docker compose --profile lakehouse up -d minio minio-init` — lo stack base senza profilo resta invariato.

### T1 — Layout Parquet + catalog + export pilota
- [x] Convenzione path hive silver/gold + schema colonne serving ([lakehouse-parquet-layout.md](../infrastructure/lakehouse-parquet-layout.md))
- [x] Script export PostGIS → Parquet (`export_municipality_to_lakehouse.py`) + runner; modalità `--fixture` per smoke senza DB
- [x] Scrittura `_catalog/municipality_ingests.parquet` (upsert per comune/dataset/ingest)
- [x] Smoke DuckDB: resolve `max(ingest_at)` nel range + `read_parquet` su MinIO (`smoke_duckdb_catalog.py`)

**Done when:** path leggibili; catalog coerente; query smoke documentata nel plan o README script.  
**Verifica T1:** `./infrastructure/scripts/database/lakehouse/run_export_municipality_lakehouse.sh --fixture` → OK (2026-09-04).

### T2 — Repository lakehouse + feature flag
- [x] Interfaccia condivisa / adapter `*LakehouseRepository` (assets + areas)
- [x] `GREEN_LAKEHOUSE_ENABLED=false` di default (`core.config.Settings`)
- [x] Wiring FastAPI: factory repository sceglie PostGIS vs lakehouse (`repository/__init__.py`)
- [x] Test dual-path (`tests/test_lakehouse_dual_path.py` — 5 passed)
- [x] Modulo comune DuckDB/catalog (`territory/common/infrastructure/lakehouse/`)
- [x] `duckdb` in `backend/requirements.txt`
- [x] Lazy `territory.router` (test import senza stack web)

**Done when:** suite verde con flag OFF; staging può accendere flag senza deploy FE obbligatorio.  
**Nota T2:** con flag ON le query lakehouse tornano vuote fino a T3 (niente 500).

### T3 — Viewport / table / detail su silver (zoom alto)
- [x] `date_from` / `date_to` sui controller green assets/areas (obbligatori se flag ON)
- [x] Resolve catalog → DuckDB bbox filter (`silver_read.py`)
- [x] Lakehouse `get_raw_in_bbox` / detail / table (assets + areas)
- [x] Empty range → collection/page vuota; enrich FK PostGIS saltato su path lakehouse
- [x] Test dual-path + smoke MinIO fixture (skip se MinIO assente)

**Done when:** checklist parità su comune pilota (export reale) + suite verde.  
**Nota T3:** cluster zoom basso ancora vuoti fino a T4 (gold). `clip_wkt` → solo prefilter bbox.

### T4 — Gold cluster all’ingest + serving zoom basso
- [x] Job genera `*_clusters/.../zoom_band=...` per ingest comune (`gold_clusters.py` + export)
- [x] Serving: zoom basso legge gold del mosaico risolto; alto legge silver (`gold_read.py` + lakehouse repo)
- [x] Allineamento bande zoom alle soglie FE esistenti (`municipality`, `grid_13`…`grid_18`)
- [x] Misura p95 viewport multi-comune → instrumentazione `lakehouse_op` (T7); baseline/alert formali = ops staging

**Done when:** p95 entro soglia concordata su scenario provincia; UX cluster fluida.  
**Nota T4:** export `--fixture` scrive silver+gold; test dual-path gold OK. p95 formale → staging/APM.

### T5 — Frontend territorio → range date
- [x] UI date range (dxc-webkit DatePicker / pattern doc) dopo scelta territorio
- [x] API client: propaga `date_from` / `date_to` a viewport/table/detail
- [x] Refetch su change range; debounce viewport invariato
- [x] Messaggio “nessun dato nel periodo”
- [x] Nessuna regressione Area Italia / draw-on-map con flag OFF (date sempre inviate; BE ignora se OFF)

**Done when:** E2E pilota territorio+range; flag OFF = comportamento legacy.  
**Spec T5:** [2026-09-04-t5-frontend-date-range-design.md](./2026-09-04-t5-frontend-date-range-design.md)  
**Plan T5:** [2026-09-04-t5-frontend-date-range-plan.md](./2026-09-04-t5-frontend-date-range-plan.md)  
**Nota T5:** InfoPanel Layers + context; default ultimi 12 mesi; unit test query builders OK (2026-09-04).

### T6 — Cutover
- [x] Runbook cutover staging→prod + checklist smoke ([lakehouse-cutover-runbook.md](../infrastructure/lakehouse-cutover-runbook.md))
- [x] Override compose locale `docker-compose.lakehouse-on.yml` (`GREEN_LAKEHOUSE_ENABLED=true`)
- [x] Monitor: segnali da osservare documentati (metriche formali → T7)
- [x] Rollback = flag OFF (documentato; nessuna wipe bucket)
- [x] PostGIS fuori dal path **viz** green con flag ON (documentato; admin/territori restano PostGIS)
- [ ] Flag ON effettivo su staging/prod (azione ops su env target)

**Done when:** viz green solo lakehouse in env target; rollback verificato.  
**Nota T6:** procedura e override locali pronti (2026-09-04); accensione staging/prod resta checklist ops.

### T7 — Hardening
- [x] TTL catalog (`LAKEHOUSE_CATALOG_CACHE_TTL_SEC`) + `POST .../lakehouse/catalog/invalidate` + hook export via `LAKEHOUSE_CATALOG_INVALIDATE_URL`
- [x] Metriche: log `lakehouse_op` duration_ms (silver/gold) — alert p95 via log/APM ([lakehouse-hardening.md](../infrastructure/lakehouse-hardening.md))
- [x] Retention ILM MinIO (`apply_lakehouse_lifecycle.sh`, default 90d; `_catalog` escluso)
- [x] H3/grid alternativa: **deferred** (bande gold sufficienti V1)
- [ ] Collegare alert p95 formali su APM staging (ops)

**Done when:** runbook ops completo; retention configurata.  
**Nota T7:** codice/docs pronti (2026-09-04); wiring APM e apply ILM su env target = checklist ops.

## Ordine di merge consigliato

T0 → T1 → T2 → T3 → T4 → T5 → T6 → T7  
(T5 può iniziare in parallelo a T4 dopo T3 se i param API sono stabili.)

## Criteri anti-regressione globali

- [x] Wire format GeoJSON/Geobuf/table/detail invariato (dual-path + FE T5)
- [x] `clip_wkt` ancora supportato sul path lakehouse (prefilter bbox V1)
- [x] Feature incomplete dietro flag (convenzione progetto) — default OFF
- [x] Docs `cadastre/docs` aggiornati a ogni fase chiusa
