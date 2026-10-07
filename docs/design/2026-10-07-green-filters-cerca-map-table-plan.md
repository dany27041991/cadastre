# Plan — Filtri Cerca → tabella e mappa (lakehouse)

**Spec:** [2026-10-07-green-filters-cerca-map-table-design.md](./2026-10-07-green-filters-cerca-map-table-design.md)  
**Stato:** accepted (P0–P6)  
**Branch:** `features/lakehouse`  
**Vincolo:** nessun regressione Area Italia (no `clip_wkt`) / Disegna (`clip_wkt` conservato).

## Current → Target

| As-is | Target |
|-------|--------|
| FE manda filtri su `/table` (debounce); BE li ignora quasi tutti | Builder SQL condiviso applica **tutto** il catalogo FE |
| Viewport senza filtri attributo | Stessi param su `/viewport` (aree + asset) |
| Cerca non apre accordion; refetch live | Cerca = commit draft→applied + apri tabella + refetch mappa |
| Scope solo tabella (design 2026-08-13) | Tabella **e** mappa |

## Affected files (principali)

| File | Change |
|------|--------|
| `backend/.../lakehouse/` **new** `table_filters.py` (o nome equivalente) | Builder WHERE da `filters` dict |
| `backend/.../lakehouse/silver_read.py` | Usa builder in `list_areas_table` / `list_assets_table` + path bbox/raw |
| `backend/.../web/green_area_ctrl.py` | Query param filtri su viewport |
| `backend/.../web/green_asset_ctrl.py` | Idem |
| `backend/.../usecases/.../catalog_green_area.py` (+ asset) | Propaga `filters` a viewport |
| `backend/.../repository/green_areas_lakehouse_repository.py` (+ assets) | Propaga `filters` a read bbox/cluster |
| `frontend/.../GreenTablePanelContext.tsx` | `appliedFiltersByKind` + `applyFiltersAndShowResults` |
| `frontend/.../InfoPanelContent.tsx` | Cerca → apply |
| `frontend/.../MainContent.tsx` | false→true apre `green-data` |
| `frontend/.../useGreenTablePagedData.ts` | Solo applied; no debounce draft |
| `frontend/.../greenAreaMap.api.ts` / `greenAssetMap.api.ts` | Append filter params |
| `frontend/.../useGreenAssetsLayer.ts` (+ areas viewport path) | Dipende da applied + revision |
| Unit tests BE builder + FE context/URL merge | Nuovi / aggiornati |

---

## P0 — Spike schema silver (gate) — DONE 2026-10-07

Ispezione live MinIO (`cadastre-lake`, 7896 comuni, sample 15 prefix aree + DESCRIBE asset muni=1).  
Layout doc: [`lakehouse-parquet-layout.md`](../infrastructure/lakehouse-parquet-layout.md).  
Seeder: `load_lecce_green_data.py` — *“silver V1 schema omits JSONB column”*.

### Colonne silver osservate

**Areas:** `id, region_id, province_id, municipality_id, ingest_date, parent_id, level, name, lon, lat, geom_wkb, area_classification, administrative_status, survey_date`

**Assets:** `id, green_area_id, region_id, province_id, municipality_id, ingest_date, asset_type, geometry_type, lon, lat, geom_wkb, species, family, genus, variety, health_status, asset_status, survey_date`

Nessuna colonna `attributes` / JSON in nessun sample.

### Coverage vs `AREA_FILTER_LAYOUT` / `ASSET_FILTER_LAYOUT`

| FE key | Physical | Status |
|--------|----------|--------|
| **Area** `name` | `name` | OK |
| Area `area_classification` | `area_classification` | OK |
| Area `survey_date` | `survey_date` | OK |
| Area `area_code` | `zril_identifier` | **MISSING** |
| Area `surface_area_m2` | col / attrs / ST_Area | **MISSING** (geom presente → computabile a query) |
| Area `istat_classification` | — | **MISSING** |
| Area `intensity_of_fruition` | — | **MISSING** |
| Area `perimeter_type` | — | **MISSING** |
| **Asset** `plant_code` | `id` | OK |
| Asset `area_code` | `green_area_id` | OK |
| Asset `latitude`/`longitude` | `lat`/`lon` | OK |
| Asset `species`/`genus`/`variety` | colonne | OK |
| Asset `survey_date` | `survey_date` | OK |
| Asset `health_status` | `health_status` | OK |
| Asset `species_code` | attrs | **MISSING** |
| Asset `trunk_diameter_cm` / `plant_height_m` / `crown_diameter_m` | attrs | **MISSING** |
| Asset `growth_stage` / `protection_status` | — | **MISSING** |

**Gate:** catalogo FE completo **non** è filtrabile solo con serving code. Serve **P0b — arricchimento schema silver + re-seed** (o riduzione temporanea del form).

### P0b — Arricchimento silver — DONE 2026-10-07

- [x] `silver_schema.py` + `ensure_areas_table` / `ensure_assets_table` in `ingest_municipality_tables`
- [x] Fixture, Lecce loader, boost municipality popolano le colonne V1.1
- [x] Doc `lakehouse-parquet-layout.md` aggiornato
- [x] Re-seed smoke: fixture `999001@2026-10-07`; Lecce `5998@2024-01-01` (zril/istat/… presenti)
- [ ] **National mock `ingest_date=2026-09-09`**: ancora schema V1 (senza colonne filtro). Per copertura Italia intera rilanciare `run_populate_national_data.sh` (o boost per comune). Finché mixed, DuckDB `union_by_name` tratta le colonne assenti come NULL.

P1 sbloccato sul layout FE completo (su prefix già V1.1; NULL sui prefix non re-seedati).

---

## P1 — BE builder predicati (table only) — DONE 2026-10-07

- [x] `table_filters.py`: `area_filter_where` / `asset_filter_where` (remap, enum exact, ILIKE, int/`1=0`, escape)
- [x] Integrato in `list_areas_table` / `list_assets_table`
- [x] Unit tests `tests/test_table_filters.py` (9 passed)
- [x] Smoke Lecce `5998`: `name=Garibaldi`, `area_code=ZRIL-1`, asset `species`+`plant_code` restringono total

**Rollback:** revert `table_filters.py` + chiamate in `silver_read`.

---

## P2 — BE viewport + repository — DONE 2026-10-07

- [x] Ctrl viewport aree/asset: `Request` + `collect_filters` → `filters` dict (stessi KEYS di `/table`).
- [x] Usecase `viewport_green_*` propaga `filters`.
- [x] Repository: `filters` → `read_areas_in_bbox` / `read_assets_in_bbox`.
- [x] Stesso builder WHERE (`area_filter_where` / `asset_filter_where`).
- [x] Asset + filtri: skip admin/gold → silver raw capped (`LAST_ZOOM_RAW_HARD_CAP`); commento soft-cap in usecase.
- [x] Test: `collect_filters` + mock viewport skip-gold (`test_table_filters.py`).

**Verify:** stesso filtro su `/table` e `/viewport` (stesso bbox/scope) → id set tabella ⊆ id in viewport (o count coerente a zoom raw).

**Anti-regressione:** request senza filter keys = byte-compatibile (stessi risultati di oggi a parità di bbox/date/clip).

---

## P3 — FE draft / applied + Cerca — DONE 2026-10-07

- [x] Context: `appliedFiltersByKind`, `filtersRevision`, `applyFiltersAndShowResults()`.
- [x] `resetPanelState` / landing: clear draft **e** applied + bump revision.
- [x] `InfoPanelContent.handleSearch` → `applyFiltersAndShowResults()` (no-op se date ingest incomplete).
- [x] `MainContent`: false→true `mapTableAccordionVisible` → `setAccordionOpen('green-data')`.
- [x] `useGreenTablePagedData`: solo applied; debounce draft rimosso.
- [x] Helper `appendAppliedFilters` + denylist + unit test.

**Verify:** edit form senza Cerca → Network senza nuovi `/table` per filtri; Cerca → 1 fetch table + accordion aperto.

---

## P4 — FE mappa propaga applied — DONE 2026-10-07

- [x] `buildGreenAreasViewportQuery` / `buildGreenAssetViewportQuery`: `appendAppliedFilters`.
- [x] Thread applied + `filtersRevision` → `useTerritoryMapGreenLayers` / `useGreenAssetsLayer` (contextKey includes revision).
- [x] Dual: area filters → areas viewport; asset filters → assets viewport.
- [x] Tabella usa solo `appliedFiltersByKind[tableKind]` (P3).

**Verify:** Cerca con `name` (aree) riduce feature mappa e righe tabella; Disegna conserva `clip_wkt` in entrambe le URL; Area Italia senza `clip_wkt`.

---

## P5 — Dual-toggle UX polish + i18n — DONE 2026-10-07

- [x] Hint form: `filtersDescription` it/en menziona Cerca → tabella e mappa.
- [x] Cerca disabled se `hasIngestDateRange` false (coerente LayersPanel + apply no-op).
- [x] Dual: tabella resta sul `tableKind` attivo (as-is; nessun cambio UI extra).

**Verify:** smoke manuale dual + drill asset con filtri asset applied.

---

## P6 — Close-out — DONE 2026-10-07

- [x] Spec già `accepted`; piano collegato.
- [x] Addendum su `2026-08-13-green-table-multifield-filters-design.md`.
- [x] Anti-regressione: filtri AND-overlay; clip/date/scope denylist; Area Italia no `clip_wkt`; Disegna conserva clip; Cerca commit-only.

---

## Verify matrix (PR)

| Scenario | Expect |
|----------|--------|
| Area Italia + Cerca `name` | no `clip_wkt`; table+map filtrati |
| Disegna + Cerca enum | `clip_wkt` su table e viewport |
| Asset only + `health_status` + `species` | AND |
| Dual + drill | asset filters on asset table/map; area applied resta per layer aree |
| Form edit no Cerca | no filter-driven refetch |
| Cerca | accordion `green-data` open |
| Empty match | total 0, map empty/0 clusters |

## Rollback

1. Revert commit FE applied/Cerca → torna debounce (o no-op Cerca).  
2. Revert BE builder → table/viewport ignorano di nuovo i param (safe).  
3. Non migrare DB: solo codice + query.

## Risks

| Risk | Mitigation |
|------|------------|
| Colonne assenti in parquet | P0 spike obbligatorio |
| Perf national + ILIKE | approx COUNT esistente; soft-cap cluster |
| Loop accordion open/close | un solo effetto false→true in MainContent |
| Filter key sovrascrive clip/date | denylist + test |
| Dual confusion | applied per kind; table = active kind only |

## Order

`P0 → P1 → P2 → P3 → P4 → P5 → P6`  
P3 può partire in parallelo a P1 dopo P0 (FE compile senza BE pieno), ma E2E map+table richiede P1+P2+P3+P4.
