# Plan — Lakehouse-only green / drop PostGIS green

**Design:** [2026-09-04-green-lakehouse-only-pg-drop-design.md](./2026-09-04-green-lakehouse-only-pg-drop-design.md)  
**Stato:** ready  
**Ambiente:** sviluppo — wipe & recreate (`down -v`), niente migration ALTER  
**Regola:** non aprire P(n+1) se P(n) non è done. Docs complete a ogni fase. Spuntare a chiusura.

## Tasklist pinnabile

### P0 — Spec & banner docs
- [x] Design reviewato e accettato
- [x] Banner superseded su design/plan T0–T7 e nota T5
- [x] Questo plan pubblicato

**Done when:** design `accepted`; plan linkato dallo spec.

---

### P1 — Compose / env consolidation
- [x] Rimuovere `profiles: ["lakehouse"]` da `minio` e `minio-init` in `docker-compose.yml`
- [x] `backend.depends_on` include MinIO healthy; env lakehouse già presenti / allineati
- [x] Eliminare `docker-compose.lakehouse-on.yml`
- [x] Eliminare `lakehouse.env.example`
- [x] Mergiare tutte le vars lakehouse in `.env.example` (e documentare in `.env` locale se presente solo come guida — **non** commitare secret)
- [x] Rimuovere `GREEN_LAKEHOUSE_ENABLED` da compose/env example
- [x] Aggiornare `docs/infrastructure/minio-lakehouse.md` (always-on, no profile)

**Done when:** `docker compose up -d` avvia MinIO senza `--profile`; override files assenti; doc infra allineata.

---

### P2 — Schema init senza green + ORM cleanup
- [x] `02-init-schema-cadastre.sql`: rimuovere tabelle green/history (+ default partitions); ENUM solo-green se non usati altrove; schema `cadastre` vuoto o rimosso
- [x] `04-init-indexes-cadastre.sql`: rimuovere indici green
- [x] `06-create-partitions.sql`: rimuovere partizioni green/history
- [x] Eliminare `07-matview-green-asset-admin-clusters.sql`, `08-matview-green-asset-grid-clusters.sql` (e riferimenti nei runner/init)
- [x] Rimuovere modelli ORM green/history e export da `__init__`
- [x] Aggiornare commenti init + nota in `database-mapping-diagram.md` (storage green = lakehouse)

**Done when:** init fresco senza `cadastre.green_*` / matview; backend importa senza model green PG.
**Nota P2:** `05-autovacuum` noop; traduzioni ENUM in `02b-1` restano in `public.translations` (label UI). Search territorio = solo admin; FK green_area_label = None (no PG).

---

### P3 — Backend lakehouse-only
- [x] Factory: solo `*LakehouseRepository`; eliminare repo PostGIS green
- [x] Rimuovere `green_lakehouse_enabled` da `Settings` e validator
- [x] `http_dates` / controller: `date_from`/`date_to` sempre required
- [x] DuckDB: non più gated dal flag (deps hard)
- [x] Riscrivere `tests/test_lakehouse_dual_path.py` → lakehouse-only (o rename)
- [x] Grep anti-regressione: zero riferimenti runtime a `GREEN_LAKEHOUSE_ENABLED` / PostGIS green repo

**Done when:** test suite BE green path verde; API richiede date; nessun dual-path.
**Nota P3:** ORM green/history rimossi; search admin-only; FK labels senza PostGIS green.

---

### P4 — Seeders → MinIO; delete export-from-PG
- [x] Estrarre/riusare writer S3 + catalog upsert + `gold_clusters` in modulo condiviso seed/lakehouse
- [x] Riscrivere `load_lecce_green_data.py` (e `run_populate_lecce.sh`): GeoJSON → silver + gold + catalog; PG solo lookup admin/DBT
- [x] Riscrivere boost municipality (via SQL PG green) → writer lakehouse; aggiornare `run_boost_municipality.sh`
- [x] Sostituire `seed_populate_region_data.sql` con pipeline Python → MinIO; aggiornare runner region
- [x] Eliminare `export_municipality_to_lakehouse.py`, `run_export_municipality_lakehouse.sh` (o deprecare solo se ancora utile come alias seed — **preferenza design: remove**)
- [x] Aggiornare `infrastructure/scripts/database/seed/README.md` + header script
- [x] Nota in `lakehouse-parquet-layout.md`: scrittura da seeders

**Done when:** dopo wipe+seed Lecce, `mc ls` vede silver/gold/catalog; nessun INSERT su tabelle green (assenti).  
**Nota P4:** region seed = loop boost per comune (`seed_populate_region_data.py`, multi `--ingest-date` YYYY-MM-DD|MM-YYYY; default densità ridotta; `--limit` / `--dry-run`). Seed runner: host MinIO URL solo sul processo Python (non export shell). Boost singolo = `boost_municipality_to_lakehouse.py`. Fixture: `run_seed_fixture_lakehouse.sh`. Writer: `lakehouse_writer.py`.

---

### P5 — Frontend cleanup
- [x] Rimuovere commenti/copy legati a flag lakehouse OFF / PostGIS clusters (src + docs feature)
- [x] Verificare che date siano sempre inviate (già T5); allineare i18n se parla di “opzionale/legacy”
- [x] Aggiornare nota in design T5 se restano riferimenti al flag

**Done when:** nessun riferimento FE a dual-path/flag; Layers date range invariato funzionalmente.

---

### P6 — Docs sweep + runbook
- [x] Design stato → `accepted`
- [x] `lakehouse-cutover-runbook.md`: wipe & recreate; no flag rollback; no profile
- [x] `lakehouse-hardening.md`: env sempre on
- [x] Sweep grep docs su `GREEN_LAKEHOUSE_ENABLED`, `lakehouse-on`, `lakehouse.env.example`, `export_municipality` (storici T0–T7 ok; ops aggiornati)
- [x] `database-mapping-diagram.md` completo (ASSET_* → lakehouse / rimossi da PG)
- [x] Cross-link design/plan storici aggiornati
- [x] Nota scrittura seeders in `lakehouse-parquet-layout.md`

**Done when:** grep docs senza istruzioni obsolete (flag OFF / profile / export-from-PG come path primario).

---

### P7 — Smoke anti-regressione
- [x] `docker compose down -v && up -d`
- [x] Seed Lecce → MinIO (1749 areas, 36254 assets + gold)
- [x] Viewport zoom basso (gold: 43 cluster) / alto (silver: 5713)
- [x] Table (total 36254) + detail asset + clip WKT
- [x] Assenza `cadastre.green_*` (`\dt cadastre.*` → none)
- [x] Annotare esito in questo plan

**Done when:** checklist smoke OK; plan spuntato.
**Nota P7:** fix `main.py` import `territory.router` (submodule shadow). DuckDB: layer dedicato in `Dockerfile.standalone` + bootstrap in `entrypoint.sh` se manca (rebuild Nexus può fallire; container locale resta servibile).

---

### P8 — Catalog hierarchy + table/viewport territory scopes (post-cutover gap)
- [x] Implementare silver catalog: `read_area_roots` / `by_parent` / `contained_or_intersecting` / sub-municipal intersect; asset `read_assets_catalog` / intersecting
- [x] Wire `GreenAreasLakehouseRepository` + `GreenAssetsLakehouseRepository` (niente più stub `_EMPTY_FC` sul path catalog)
- [x] Table areas: scope `area_id` / `parent_id` / `contained_in` / sub-municipal / `clip_wkt` (+ default roots `parent_id IS NULL`)
- [x] Table assets: `id_allowlist` da sub-municipal / `clip_wkt` (+ `green_area_id` già presente)
- [x] Viewport areas: `sub_municipal_area_id` + `clip_wkt` via shapely post-filter
- [x] Viewport assets (raw + gold admin/grid): stesso clip/sub-municipal geometrico (non più solo bbox)
- [x] Smoke Lecce: catalog areas **1749**, assets **36254**; table municipality total **1749**; contained flat seed → 0 children

**Done when:** drill/catalog FE e filtri territorio tabella/viewport non tornano vuoti per dati flat (Lecce) o gerarchici.

## Note operative

- Commit atomici per fase (`feat:` / `refactor:` / `docs:`).
- Non commitare `.env` con secret.
- Rollback = git revert + wipe volumi.
