# Plan — Filtri Cerca → tabella e mappa (lakehouse)

**Spec:** [2026-10-07-green-filters-cerca-map-table-design.md](./2026-10-07-green-filters-cerca-map-table-design.md)  
**Stato:** ready  
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

## P0 — Spike schema silver (gate)

Obiettivo: ogni key FE ha una colonna/path parquet reale, altrimenti piano SELECT/attrs.

- [ ] Ispezionare 1 prefix aree + 1 asset (`DESCRIBE` / `SELECT * LIMIT 1` DuckDB) per:  
  `zril_identifier`, `attributes`, `area_classification`, `istat_classification`, `intensity_of_fruition`, `perimeter_type`, `surface_area_m2`, `growth_stage`, `protection_status`, `species_code`, misure.
- [ ] Documentare tabella spike nello spec o in questo plan (colonne presenti / solo in `attributes` / assenti).
- [ ] Se assenti: task esplicito in P1 per estendere ingest SELECT o fall-back documentato (non lasciare no-op silenziosi).

**Verify:** tabella spike completa per `AREA_FILTER_LAYOUT` + `ASSET_FILTER_LAYOUT`.

---

## P1 — BE builder predicati (table only)

- [ ] Creare `table_filters.py` con:
  - `area_filter_where(filters: dict) -> list[str]`
  - `asset_filter_where(filters: dict) -> list[str]`
  - Remap: `area_code`→`zril_identifier` (aree) / `green_area_id` (asset); `plant_code`→`id`
  - Enum FE → exact; testo → ILIKE; int non parseable → clausola impossibile (`1=0`)
  - Escape `'`; ignore unknown keys
- [ ] Integrare in `list_areas_table` / `list_assets_table` (oltre a `q` esistente se ancora utile).
- [ ] Estendere SELECT parquet dove serve (es. `zril_identifier`, `attributes`, enum area) **senza** cambiare shape response tabella se non necessario (filtro in WHERE basta).
- [ ] Unit test mapping per ogni key del layout FE (almeno 1 assert SQL/fragment per key).

**Verify:**  
`GET .../green-areas/table?...&name=...` e `.../green-assets/table?...&health_status=HEALTHY&species=...` riducono `total` vs unfiltered (stesso scope/date/clip).  
Area Italia senza clip + Disegna con clip invariati su scope params.

**Rollback:** feature flag o revert del builder; table torna al subset attuale.

---

## P2 — BE viewport + repository

- [ ] Ctrl viewport aree/asset: accettare gli stessi Query param del catalogo → `filters` dict.
- [ ] Usecase `viewport_green_*` propaga `filters`.
- [ ] Repository: passare `filters` a `read_areas_in_bbox` / `read_assets_in_bbox` (e path raw usati dal layer).
- [ ] Applicare lo **stesso** builder WHERE (non duplicare logica).
- [ ] Cluster admin/grid con filtri: soft-cap — exact ∩ filtri sotto soglia; over-cap → approximate/empty+header (allineare clip-exact; documentare scelta in commento breve).
- [ ] Test: viewport con filtro enum restituisce subset; senza filtro comportamento precedente.

**Verify:** stesso filtro su `/table` e `/viewport` (stesso bbox/scope) → id set tabella ⊆ id in viewport (o count coerente a zoom raw).

**Anti-regressione:** request senza filter keys = byte-compatibile (stessi risultati di oggi a parità di bbox/date/clip).

---

## P3 — FE draft / applied + Cerca

- [ ] Context: `appliedFiltersByKind`, `filtersRevision` (number), `applyFiltersAndShowResults()`.
- [ ] `resetPanelState` / landing: clear draft **e** applied + bump revision.
- [ ] `InfoPanelContent.handleSearch` → `applyFiltersAndShowResults()` (+ date gate se manca range).
- [ ] `MainContent`: su `mapTableAccordionVisible` false→true → `setAccordionOpen('green-data')` (no loop).
- [ ] `useGreenTablePagedData`: params da **applied** del kind; rimuovere debounce che refetcha dalla bozza (opzionale debounce solo se si riusa per altro).
- [ ] Helper merge URL: append applied filters + denylist scope keys (test unit).

**Verify:** edit form senza Cerca → Network senza nuovi `/table` per filtri; Cerca → 1 fetch table + accordion aperto.

---

## P4 — FE mappa propaga applied

- [ ] `buildGreenAreasViewportQuery` / `buildGreenAssetViewportQuery`: append applied filters kind.
- [ ] Thread `appliedFilters` + `filtersRevision` da context → `useTerritoryMapGreenLayers` / `useGreenAssetsLayer` (dependency key include revision).
- [ ] Dual: aree ON → filtri area sul viewport aree; asset ON → filtri asset sul viewport asset.
- [ ] Tabella continua a usare solo `tableKind` applied.

**Verify:** Cerca con `name` (aree) riduce feature mappa e righe tabella; Disegna conserva `clip_wkt` in entrambe le URL; Area Italia senza `clip_wkt`.

---

## P5 — Dual-toggle UX polish + i18n

- [ ] Opzionale: hint form “I filtri si applicano con Cerca” (i18n it/en).
- [ ] Disable Cerca se date ingest incomplete (coerente LayersPanel).
- [ ] Documentare in UI che in dual la tabella mostra il kind attivo (già as-is).

**Verify:** smoke manuale dual + drill asset con filtri asset applied.

---

## P6 — Close-out

- [ ] Spec stato → `accepted`; link piano.
- [ ] Addendum breve su `2026-08-13-green-table-multifield-filters-design.md` (superseded points).
- [ ] Checklist anti-regressione dallo spec eseguita e annotata (commento PR o sezione Verify sotto).

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
