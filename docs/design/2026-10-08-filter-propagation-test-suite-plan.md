# Plan — Suite test propagazione filtri (table / viewport / cluster / E2E)

**Spec:** [2026-10-08-filter-propagation-test-suite-design.md](./2026-10-08-filter-propagation-test-suite-design.md)  
**Stato:** ready  
**Prereq:** stack compose up + MinIO seed (nazionale + Lecce); backfill V1.1 già eseguito in locale.

## Current → Target

| As-is | Target |
|-------|--------|
| Solo unit `backend/tests/test_table_filters.py` (builder SQL) | Suite live in `cadastre/tests/` per table + viewport + cluster + coherence |
| Log debug sessione Cursor (`4fe799`) | NDJSON stabile `FILTER_TEST_LOG` obbligatorio per ogni caso API |
| Nessun E2E Cerca | Smoke Playwright draft→Cerca→Pulisci |
| Nessuna matrice geo | N/R/P/municipal/sub parametrizzati |

## Affected files

| File | Change |
|------|--------|
| `cadastre/tests/**` (**new**) | Scaffold, fixtures, harness, api/*, e2e/smoke |
| `backend/.../lakehouse/filter_test_log.py` (**new**) | `emit_filter_test_log` gated by env |
| `backend/.../lakehouse/silver_read.py` | Emit dopo `list_*_table` ok |
| `backend/.../usecases/.../catalog_green_area.py` (+ asset) o path viewport | Emit su viewport filtrato |
| `cadastre/tests/reports/.gitignore` | Ignora junit + runtime-ndjson |
| `frontend` (solo e2e) | Playwright config sotto `cadastre/tests/e2e` se assente |

---

## T0 — Scaffold + fixtures (½–1 h) — DONE

- [x] Creare albero `cadastre/tests/` come da spec § Architettura
- [x] `fixtures/geo_scopes.json` — national / regional(16) / provincial(16,75) / municipal(5998) / submunicipal placeholder
- [x] `fixtures/filter_catalog.json` — flatten AREA/ASSET keys + fallback enum samples
- [x] `conftest.py` — `API_BASE`, `DATE_FROM`/`DATE_TO`, marker `live`, skip se health/table 503
- [x] `reports/.gitignore` — `*.xml`, `*.log`, `html/`
- [x] `README.md` — comandi runner

**Done when:** `pytest cadastre/tests/unit/ -q` trova path; `pytest -m live` skippa clean senza API.

---

## T1 — Harness (1 h) — DONE

- [x] `harness/http_client.py`
  - `table(kind, scope, filters, page=1, page_size=5) → {total, rows, status}`
  - `viewport(kind, scope, filters, bbox, zoom) → {status, n_features | clusters}`
  - Merge territory query da `geo_scopes` + dates; denylist non sovrascritta da filters
- [x] `harness/log_assert.py`
  - `clear(path)` / `require(case_id, **match)` su NDJSON
- [x] `harness/coherence.py`
  - `assert_table_viewport_coherent(table_total, viewport_count, *, approx_ok=False)`
- [x] `harness/discovery.py`
  - Per key: GET municipal unfiltered → sample value non NaN; cache in session

**Done when:** script smoke manuale 1 GET Lecce + clear/require stub passa con log fittizio.

---

## T2 — BE `emit_filter_test_log` (1 h) — DONE

- [x] Modulo `filter_test_log.py`:
  - No-op se `FILTER_TEST_LOG` unset
  - Append NDJSON a `FILTER_TEST_LOG_PATH` (default `/app/.filter-test-runtime.ndjson`)
  - Campi: `runId`, `caseId` (da header `X-Filter-Test-Case` se presente), `scope` (inferito da query o header), `kind`, `surface`, `filters`, `total`, `n_features`, `where_sql_hash`, `timestamp`
- [x] Wiring:
  - `list_areas_table` / `list_assets_table` → `surface=table`
  - Path viewport aree/asset che applicano `filters` → `surface=viewport` (e cluster se distinto)
- [x] Header opzionale client: `X-Filter-Test-Case`, `X-Filter-Test-Scope` (harness li setta)
- [x] Middleware + compose `FILTER_TEST_LOG=1`

**Done when:** curl `/table` con `FILTER_TEST_LOG=1` scrive 1 riga NDJSON; pytest `log_assert.require` ok.

**Nota debug mode:** tenere gli hook `#region agent log` 4fe799 finché l’utente non chiude il debug; `emit_filter_test_log` è canale separato.

---

## T3 — `api/table` catalogo municipal (2 h) — DONE (2026-10-08)

- [x] `api/table/test_area_filters_municipal.py` — parametrize tutte le key area
- [x] `api/table/test_asset_filters_municipal.py` — tutte le key asset
- [x] Pattern: baseline → filtered → `total_f ≤ total_0` → log require → se discovery hit: `total_f ≥ 1`
- [x] 1 caso AND: due key area; 1 AND due key asset
- [ ] 1 caso denylist: filtro non deve cambiare `municipality_id` nel wire (assert URL built)
- [x] Evidenza runtime: **25 passed** municipal table (+ AND)

**Done when:** `pytest api/table -m live` verde su stack seedato.

---

## T4 — `api/viewport` municipal (1–2 h) — DONE

- [x] Specchio di T3 su `/viewport` (bbox Lecce + zoom appropriato)
- [x] Assert `entity_count` (somma `cluster_count` o raw features) ≤ baseline
- [x] Log `surface=viewport`

**Done when:** `pytest api/viewport -m live` verde.

---

## T5 — Altri scope smoke + coherence + clusters (2 h) — DONE

- [x] `api/table/test_geo_scope_smoke.py` — N/R/P/sub × (1 area + 1 asset)
- [x] Submunicipal: discovery `green_area_id` / `area_id`
- [x] `api/coherence/test_table_viewport.py` — municipal sample (3 area + 3 asset)
- [x] `api/clusters/test_filtered_clusters.py` — municipal + national; entity_count filtrato ≤ baseline

**Done when:** marker `live` verde su `api/`.

---

## T6 — E2E smoke Playwright (1–2 h) — DONE

- [x] `e2e/smoke/test_filter_cerca.py` (Python Playwright; allineato al resto della suite)
- [x] Scenario:
  1. Apri territory / Area Italia → dates → toggle Aree → filters
  2. Compila 1 filtro area (draft) → network: nessun `/table` con quel filter
  3. Cerca → `/table` con filter (`name=Parco`); viewport se emesso deve portare lo stesso filter
  4. Pulisci → draft vuoto; successivo Cerca senza quel filter
- [x] Marker `e2e`; `BASE_URL` FE da env

**Done when:** smoke passa su FE+API locali. (`1 passed` 2026-10-08)

---

## T7 — README + report + unit bridge (½ h) — DONE

- [x] `unit/test_table_filters_bridge.py` — pointer + doc `cd backend && pytest tests/test_table_filters.py`
- [x] README: prereq, env, comandi, interpretazione junit/ndjson
- [x] `run_filter_suite.sh` (`--e2e` / `--slow` / `--all`)

**Done when:** un nuovo dev può far girare la suite leggendo solo il README.

---

## Ordine esecuzione consigliato

```text
T0 → T1 → T2 → T3 → T4 → T5 → T6 → T7
```

Non parallelizzare T2 prima di T1 (harness serve a validare il log).

## Rollback

- Disabilitare emit: unset `FILTER_TEST_LOG`
- Rimuovere `cadastre/tests/` senza impatto runtime prod
- Revert solo `filter_test_log.py` + 2–3 call site

## Criteri di accettazione (copy spec)

Vedi spec § Criteri: catalogo municipal table+viewport, smoke geo, NDJSON obbligatorio, coherence, clusters ≤ baseline, E2E Cerca/Pulisci, skip live pulito.
