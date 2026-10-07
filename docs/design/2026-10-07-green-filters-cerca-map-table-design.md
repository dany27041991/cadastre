# Filtri green: Cerca → tabella e mappa (lakehouse)

**Data:** 2026-10-07  
**Stato:** accepted  
**Piano:** [2026-10-07-green-filters-cerca-map-table-plan.md](./2026-10-07-green-filters-cerca-map-table-plan.md)  
**Approccio:** predicati condivisi BE + applied filters FE (approccio 1)  
**Correlati:**
- [2026-08-13-green-table-multifield-filters-design.md](./2026-08-13-green-table-multifield-filters-design.md) — **supersede** su scope mappa e UX Cerca/debounce
- [2026-08-18-draw-on-map-spatial-clip-design.md](./2026-08-18-draw-on-map-spatial-clip-design.md)
- [2026-09-04-t5-frontend-date-range-design.md](./2026-09-04-t5-frontend-date-range-design.md)

**Vincolo UI:** solo componenti in `frontend/docs/components` (dxc-webkit, react-select, react-toastify, shared-ui).

## Obiettivo

Rendere **funzionali tutti i campi** dei form filtri InfoPanel (Aree gestite e Assets verdi): al **Cerca** i vincoli non vuoti si applicano in **AND** sia alla **tabella** (`/table`) sia ai **layer mappa** (`/viewport` e path raw/cluster correlati), tramite API lakehouse.

Nessuna regressione su **Area Italia** (no `clip_wkt`) e **Disegna su mappa** (`clip_wkt` obbligatorio e conservato).

## Problema as-is (evidenza codebase)

1. FE serializza già i filtri colonna su `/table` (debounce ~350 ms); i controller li accettano in `filters`.
2. `silver_read.list_areas_table` / `list_assets_table` applicano quasi nulla (aree: solo `q`→name; asset: pochi exact + `q`). Il catalogo FE è quindi un no-op.
3. **Cerca** imposta `mapTableAccordionVisible(true)` ma `MainContent` non apre `accordionOpen === 'green-data'`.
4. Viewport aree/asset non accettano i query param del catalogo filtri.
5. Design 2026-08-13 dichiarava filtri **solo tabella** e footer senza Cerca — superato da questo documento.

## Decisioni

| Tema | Scelta |
|------|--------|
| Trigger applicazione | Solo **Cerca** (commit); nessun refetch live su keystroke |
| Superfici | Tabella **e** layer mappa (stesso AND per kind) |
| Catalogo | Tutti i campi in `AREA_FILTER_LAYOUT` / `ASSET_FILTER_LAYOUT` (`greenTableFilterFields.ts`) |
| Combinazione | AND, solo valori non vuoti |
| Persistenza | Solo in-memory nel context |
| `q` globale | Non esposto in UI (BE può restare) |
| Architettura | Builder predicati condiviso lakehouse; FE draft vs applied |
| Ortogonalità | scope breadcrumb ⊥ `clip_wkt` ⊥ `date_from`/`date_to` ⊥ filtri colonna |

## Flusso

```text
Form (draft columnFiltersByKind)
        │ Cerca → applyFiltersAndShowResults()
        ▼
appliedFiltersByKind
        ├─► green-areas|assets /table  (+ territoryQuery, dates, clip)
        └─► green-areas|assets /viewport (+ bbox, zoom, dates, clip)
```

Wizard invariato: `monitoraggio` → `layers` → `filters`. Indietro filters→layers conserva draft e applied. Landing / `resetPanelState` azzera draft **e** applied.

## Stato FE

Estendere `GreenTablePanelContext`:

| Campo / API | Ruolo |
|-------------|--------|
| `columnFiltersByKind` | Bozza editabile nel form |
| `appliedFiltersByKind` | Committed; unica fonte per fetch tabella e mappa |
| `setColumnFilter` / `clearColumnFilters` | Solo bozza |
| `applyFiltersAndShowResults()` | `applied = deepCopy(draft)`; apri accordion `green-data`; incrementa revisione filtri per invalidare refetch layer |

Regole fetch:

- `useGreenTablePagedData` e i fetcher viewport leggono **solo** `appliedFiltersByKind[kind]`.
- Rimuovere (o disabilitare) il debounce che refetcha la tabella a ogni keystroke sulla bozza.
- `MainContent`: su transizione `mapTableAccordionVisible` false→true (da Cerca), `setAccordionOpen('green-data')` senza loop con l’effetto local→context.

### Dual-toggle

| Stato | Comportamento |
|-------|----------------|
| Form | Sezioni per ogni kind con toggle ON |
| Cerca | Commit di entrambi i kind; refetch layer area con filtri area; layer asset con filtri asset; apri accordion |
| Tabella | Filtri del `tableKind` attivo (aree finché non drill; asset dopo drill / nav leaf) |
| Kind OFF | Draft resta in memoria; non va in wire |

## Contratto API

Stessi query param product-key su:

- `GET /api/territory/green-areas/table`
- `GET /api/territory/green-assets/table`
- `GET /api/territory/green-areas/viewport`
- `GET /api/territory/green-assets/viewport` (e path raw/cluster che costruiscono il layer)

Merge FE URL: base = territory + dates + clip; poi overlay filtri applied. **Denylist** (mai da filtri):  
`clip_wkt`, `date_from`, `date_to`, `region_id`, `province_id`, `municipality_id`, `area_id`, `green_area_id`, `sub_municipal_area_id`, `contained_in_area_id`, `parent_id`, `bbox`, `zoom`, `format`, `page`, `page_size`, `sort_by`, `sort_dir`.

Chiavi sconosciute: ignorate (no 400).

## Mapping SQL lakehouse (builder condiviso)

Implementare un unico builder (es. `table_filters.py` o helper in `silver_read`) usato da `list_*_table` e dai path viewport/raw che leggono silver.

### Aree (`AREA_FILTER_LAYOUT`)

| FE key | SQL |
|--------|-----|
| `name` | `name ILIKE '%v%'` |
| `area_code` | `zril_identifier ILIKE '%v%'` |
| `area_classification`, `istat_classification`, `intensity_of_fruition`, `perimeter_type` | exact se valore ∈ enum FE; altrimenti `CAST(... AS VARCHAR) ILIKE` |
| `survey_date` | `CAST(survey_date AS VARCHAR) ILIKE '%YYYY-MM-DD%'` |
| `surface_area_m2` | colonna o `attributes->>'surface_area_m2'`: match numerico se parseable, altrimenti ILIKE |

### Asset (`ASSET_FILTER_LAYOUT`)

| FE key | SQL |
|--------|-----|
| `plant_code` | `id = int(v)` (non-int → zero row) |
| `area_code` | `green_area_id = int(v)` |
| `species_code`, `trunk_diameter_cm`, `plant_height_m`, `crown_diameter_m` | path `attributes` (o colonna silver se presente) |
| `species`, `genus`, `variety` | colonna `ILIKE` |
| `latitude` / `longitude` | `CAST(lat AS VARCHAR) ILIKE` / `CAST(lon AS VARCHAR) ILIKE` |
| `survey_date` | come aree |
| `growth_stage`, `protection_status`, `health_status` | exact su enum FE |

**Requisito hard:** nessun campo del form FE resta no-op. Se manca colonna/attr nello SELECT silver, estendere lettura parquet / `attributes` prima di dichiarare done.

Escaping: `'` → `''`; documentare che `%`/`_` restano wildcard LIKE (v1).

## Cluster / performance

- Filtri attributi su aggregati cluster: sotto soft-cap → count esatti ∩ filtri; oltre → approximate / skip exact (stesso spirito clip-exact). Dettaglio nel piano implementativo.
- Tabella nazionale: mantenere approx total + `page_size` piccolo; i filtri restringono, non rimuovono il guardrail.
- Area Italia + filtri pesanti: accettabile lentezza moderata; non hang / NetworkError (timeout e COUNT chunked esistenti).

## Errori / edge

| Caso | Comportamento |
|------|----------------|
| Cerca senza date ingest valide | Non commit; disable Cerca o toast (allineato LayersPanel) |
| Draw senza clip | `clipRequired` resta; Cerca non bypassa |
| `plant_code` / asset `area_code` non interi | zero row, non 400 |
| Nessun match | `total: 0`, mappa senza feature (o cluster 0) |
| Clip WKT invalido | 400 come oggi |
| Fetch post-Cerca fallito | toast; applied restano per retry |

## Anti-regressione (obbligatoria)

1. Area Italia: nessun `clip_wkt` su table/viewport.
2. Disegna: ogni fetch post-Cerca conserva lo stesso `clip_wkt` di viewport.
3. `date_from` / `date_to` sempre presenti post-cutover.
4. Filtri non sovrascrivono scope keys (denylist).
5. Landing azzera draft e applied; non azzerare clip solo cambiando un campo filtro.
6. Dual drill asset: partition keys + `green_area_id` restano; filtri asset in AND.
7. Smoke: `name` + enum area; `species` + `health_status` asset; dual + drill; Area Italia e Disegna.

## Criteri di accettazione

1. Ogni key in `AREA_FILTER_LAYOUT` e `ASSET_FILTER_LAYOUT` cambia risultati tabella **e** layer del kind dopo Cerca.
2. Edit form senza Cerca → nessun nuovo fetch table/viewport dovuto ai filtri.
3. Cerca apre l’accordion `green-data`.
4. Mappa e tabella coerenti sullo stesso `applied` set.
5. Area Italia e Disegna invariati su clip/scope.
6. Test o smoke documentati per remap `area_code` / `plant_code`.

## Fuori scope

- Persistenza `localStorage`.
- Range min/max dedicati (oltre match numerico dove già previsto).
- Filtro testo globale `q` in UI.
- Reimplementazione stub `green-*-explorer`.
- Cambi al design system oltre ai componenti già ammessi.

## Addendum rispetto a 2026-08-13

| 2026-08-13 | Questo design |
|------------|----------------|
| Scope solo tabella | Tabella + mappa |
| Debounce live ~300 ms | Commit solo su Cerca |
| Footer Indietro only | Cerca = apply + show |
| Lakehouse “cutover” generico | Builder esplicito + viewport params |
