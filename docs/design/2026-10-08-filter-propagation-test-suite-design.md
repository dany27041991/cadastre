# Suite test propagazione filtri → tabella, cluster, mappa

**Data:** 2026-10-08  
**Stato:** accepted (brainstorm)  
**Correlati:**
- [2026-10-07-green-filters-cerca-map-table-design.md](./2026-10-07-green-filters-cerca-map-table-design.md) — contratto filtri Cerca → table/viewport
- [2026-10-07-green-filters-cerca-map-table-plan.md](./2026-10-07-green-filters-cerca-map-table-plan.md)
- Unit BE esistenti: `backend/tests/test_table_filters.py`

## Obiettivo

Verificare in modo **completo e ripetibile** che ogni campo filtro prodotto (aree + asset) si propaghi correttamente su:

1. **Tabella** (`GET …/green-areas|assets/table`)
2. **Viewport / layer mappa** (`GET …/viewport` e path raw correlati)
3. **Cluster** (gold/admin o silver filtrato, a seconda dello zoom)

ai livelli geografici **nazionale, regionale, provinciale, comunale, subcomunale**, con **evidenza runtime su log NDJSON** oltre agli assert HTTP.

## Decisioni (brainstorm)

| Tema | Scelta |
|------|--------|
| Approccio | **C — ibrido**: unit BE esistenti + suite API+log + pochi smoke Playwright |
| Profondità | **2 — catalogo completo**: tutte le key di `AREA_FILTER_LAYOUT` / `ASSET_FILTER_LAYOUT`; AND campione; Pulisci; date range |
| Ambiente | **A — stack standalone live** (API + MinIO già seedato); skip se down |
| Layout cartelle | **Per superficie** (`api/table`, `api/viewport`, `api/clusters`, …); i livelli geo sono **parametri**, non cartelle duplicate |

## Architettura

```text
cadastre/tests/
  README.md
  conftest.py                 # API_BASE, date_from/to, skip live, markers
  fixtures/
    geo_scopes.json           # national / regional / provincial / municipal / submunicipal
    filter_catalog.json       # keys + sample values (discovery + fallback enum)
  harness/
    http_client.py            # GET table/viewport con territory + dates + filters
    log_assert.py             # clear + require NDJSON entry
    coherence.py              # table.total ↔ viewport counts
  unit/                       # thin path verso backend/tests/test_table_filters.py
  api/
    table/                    # parametrize: scope × kind × filter key
    viewport/                 # stesso matrix su /viewport
    clusters/                 # zoom bands + filtri
    coherence/                # stesso applied → table + viewport
  e2e/
    smoke/                    # Playwright: draft→Cerca→accordion; Pulisci; no-fetch pre-Cerca
  reports/                    # junit/html + runtime-ndjson.log (gitignored)
```

### Flusso caso API (obbligatorio)

1. `log_assert.clear()`
2. GET unfiltered → `total_0` (baseline)
3. GET filtered (una key, o AND campione) → `total_f`
4. Assert HTTP: `200`, `total_f ≤ total_0`; se value da discovery Lecce → `total_f ≥ 1`
5. Assert log: entry NDJSON con `caseId`, `scope`, `kind`, `surface`, `filters`, `total`
6. Coherence (suite dedicata): stessi param su `/table` e `/viewport`

## Matrice geografica

| Scope id | Query territory | Fixture |
|----------|-----------------|---------|
| `national` | nessuno scope id | Area Italia |
| `regional` | `region_id=16` | Puglia |
| `provincial` | `region_id=16&province_id=75` | Provincia Lecce |
| `municipal` | `…&municipality_id=5998` | Comune Lecce |
| `submunicipal` | `…&green_area_id=<id>` | Id scoperto via `/table` Lecce unfiltered |

`date_from` / `date_to` sempre presenti (cutover T5). Nessun `clip_wkt` sui casi Area Italia.

## Catalogo filtri

Fonte FE: `frontend/src/features/territory/lib/greenTableFilterFields.ts`.

### Aree

`name`, `area_code`, `surface_area_m2`, `area_classification`, `istat_classification`, `intensity_of_fruition`, `perimeter_type`, `survey_date`

### Asset

`plant_code`, `area_code`, `species_code`, `latitude`, `longitude`, `species`, `genus`, `variety`, `trunk_diameter_cm`, `plant_height_m`, `crown_diameter_m`, `survey_date`, `growth_stage`, `protection_status`, `health_status`

**Sample values:** discovery su `/table` municipal unfiltered (primo valore non `NaN` / non null); fallback enum post-backfill (`HEALTHY`, `LOW`, `URBAN_PARKS`, …).

**Copertura minima:**

| Scope | Copertura |
|-------|-----------|
| `municipal` | **tutte** le key area + asset su `api/table` **e** `api/viewport` |
| `national`, `regional`, `provincial`, `submunicipal` | smoke: ≥1 area + ≥1 asset + ≥1 AND bi-campo |
| Tutti | ≥1 caso `api/coherence`; cluster smoke su municipal + national |

## Superfici e assert

| Suite | Assert |
|-------|--------|
| `api/table` | HTTP 200; totali; log entry |
| `api/viewport` | 200; #feature o somma cluster ≤ baseline; log |
| `api/clusters` | zoom band; count filtrato ≤ baseline unfiltered; documentare soft-cap approx |
| `api/coherence` | stesso applied → table vs viewport (tolleranza solo national approx, documentata) |
| `e2e/smoke` | draft non refetcha; Cerca applica + accordion `green-data`; Pulisci azzera draft/applied |
| Cross | denylist scope/clip/dates; AND 2 campi |

## Evidenza log (runtime)

I log debug sessione Cursor (`debug-4fe799.log`) **non** sono il contratto della suite.

| Canale | Ruolo |
|--------|--------|
| Response HTTP | Assert primario |
| NDJSON stabile | Assert secondario **obbligatorio** |

- Path default: `cadastre/tests/reports/runtime-ndjson.log` (override env `FILTER_TEST_LOG_PATH`)
- Abilitazione BE: `FILTER_TEST_LOG=1` (o path settato)
- Payload minimo:
  ```json
  {
    "runId": "string",
    "caseId": "string",
    "scope": "national|regional|…",
    "kind": "area|asset",
    "surface": "table|viewport|cluster",
    "filters": {},
    "total": 0,
    "n_features": 0,
    "where_sql_hash": "string",
    "timestamp": 0
  }
  ```
- Helper BE: `emit_filter_test_log(...)` chiamato da `list_*_table` e path viewport filtrati (estensione degli hook già presenti in `silver_read` / catalog).

Un caso **fallisce** se manca l’entry NDJSON attesa dopo la GET.

## Runner

```bash
# Prereq: compose up, MinIO seedato (nazionale + Lecce)
cd cadastre/tests
FILTER_TEST_LOG=1 API_BASE=http://localhost:8000 \
  pytest api/ -v -m live --junitxml=reports/junit.xml

# Unit builder (no MinIO)
pytest unit/ -v

# Smoke UI
npx playwright test e2e/smoke/
```

**Markers:** `live` (skip se API down), `slow` (national), `e2e`.

## Anti-regressione

1. Area Italia: nessun `clip_wkt` su table/viewport dei casi national.
2. `date_from` / `date_to` sempre presenti.
3. Filtri non sovrascrivono denylist (`region_id`, `clip_wkt`, `bbox`, …).
4. Dual-kind: filtri area solo su path area; asset su path asset.
5. Landing / Pulisci: applied azzerati (E2E).

## Criteri di accettazione

1. Catalogo completo municipal su table + viewport (aree e asset).
2. Smoke geo N/R/P/sub come sopra.
3. Ogni caso API richiede entry NDJSON.
4. Coherence table↔viewport (tolleranza national documentata).
5. Cluster filtrati ≤ baseline.
6. E2E smoke Cerca / Pulisci / no-fetch pre-Cerca.
7. `pytest -m live` → skip pulito se stack down.

## Fuori scope (v1)

- Combinatoria enum × enum × tutti gli scope
- Persistenza `localStorage`
- CI obbligatoria senza MinIO
- Stub `green-*-explorer`
- SLA performance (solo no hang / timeout documentato su national)
- Rimozione log debug sessione `4fe799` (chiusura debug mode separata)

## Ordine implementazione

1. Scaffold `cadastre/tests/` + fixtures + harness
2. BE `emit_filter_test_log` + wiring table/viewport
3. `api/table` + `api/viewport` catalogo municipal
4. Smoke altri scope + `coherence` + `clusters`
5. E2E smoke Playwright
6. README runner + report junit

## Piano implementativo

Da produrre dopo review di questo spec:  
`docs/design/2026-10-08-filter-propagation-test-suite-plan.md` (o via skill writing-plans).
