# Filtri range (min/max, from/to) + ricerca nazionale veloce (allowlist B)

**Data:** 2026-10-08  
**Stato:** accepted  
**Piano:** [2026-10-08-green-filters-range-national-speed-plan.md](./2026-10-08-green-filters-range-national-speed-plan.md)  
**Approccio nazionale:** B (allowlist comuni con dato reale + single DuckDB WHERE+LIMIT)  
**Correlati:**
- [2026-10-07-green-filters-cerca-map-table-design.md](./2026-10-07-green-filters-cerca-map-table-design.md) — **addendum**: supersede mapping numerico/data single-value e nota “range fuori scope”; supersede path `filter_dense_first`
- [2026-10-08-filter-propagation-test-suite-design.md](./2026-10-08-filter-propagation-test-suite-design.md) — estendere suite con AND completi + range + budget latenza
- [2026-08-13-green-table-multifield-filters-design.md](./2026-08-13-green-table-multifield-filters-design.md)

**Vincolo UI:** solo componenti in `frontend/docs/components` (dxc-webkit, react-select, react-toastify, shared-ui).

## Obiettivo

1. Valori numerici (superfici, diametri, altezze) e date gestiti come **range** (min/max o from/to) su FE e BE.
2. Ricerca **veloce** su territorio nazionale → regionale → provinciale → comunale → subcomunale **senza** priorità/ordinamento per densità comunale.
3. Test con **tutte le clausole AND** valorizzate; logging strutturato per ottimizzare latenza.

## Decisioni

| Tema | Scelta |
|------|--------|
| Range numerici / date | Query param `*_min`/`*_max` e `*_from`/`*_to`; niente single-value legacy sul wire |
| Lat/lon | Restano campo singolo (fuori scope range) |
| Path nazionale filtrato | **B**: allowlist gold non-stub → un SELECT DuckDB filtrato + LIMIT/OFFSET |
| Ordinamento | Solo `sort_by`/`sort_dir` FE; **rimuovere** `filter_dense_first` e preferenza densità |
| Combinazione | AND di tutte le chiavi non vuote (invariato) |
| Trigger | Solo **Cerca** (invariato) |
| Totali wide filtrati | Approximate + `has_more`; COUNT async opzionale (no COUNT sync nazionale bloccante) |

---

## §1 — Modello filtri range (FE + BE)

### Campi in scope

| Kind | Campo | Estremi | Query param |
|------|--------|---------|-------------|
| area | `surface_area_m2` | min / max | `surface_area_m2_min`, `surface_area_m2_max` |
| area / asset | `survey_date` | from / to | `survey_date_from`, `survey_date_to` |
| asset | `trunk_diameter_cm`, `plant_height_m`, `crown_diameter_m` | min / max | `*_min`, `*_max` |

Fuori scope §1: `latitude` / `longitude` (singolo); enum e testo come oggi.

### Contratto

- Solo estremi non vuoti → clausola; solo min → `>=`; solo max → `<=`; entrambi → intervallo chiuso.
- FE: se min > max (o from > to) → toast e **Cerca non committa**.
- BE: se riceve min > max → zero row (`1=0`), non 400.
- Chiavi legacy single-value (`surface_area_m2`, `survey_date`, `trunk_diameter_cm`, …) **non** più emesse dal form né accettate come match numerico/data (ignorate se presenti, come unknown keys).

### SQL (`table_filters.py`, table + viewport)

```text
numerico: TRY_CAST(col AS DOUBLE) IS NOT NULL
          AND [TRY_CAST(col AS DOUBLE) >= :min]
          AND [TRY_CAST(col AS DOUBLE) <= :max]

data:     TRY_CAST(survey_date AS DATE) IS NOT NULL
          AND [TRY_CAST(survey_date AS DATE) >= DATE 'YYYY-MM-DD']
          AND [TRY_CAST(survey_date AS DATE) <= DATE 'YYYY-MM-DD']
```

Rimuovere `_numeric_or_ilike` e ILIKE su `survey_date` per questi campi.

### UI (dxc-webkit)

- Numeri: due `Input` (Min / Max) sulla stessa riga del layout.
- Date: due `DatePicker` (Da / A).
- Stato: `Record<string, string>` flat con chiavi `*_min`/`*_max`/`*_from`/`*_to`.
- Aggiornare `greenTableFilterFields` (`filterControlKind`, layout, helper parse).
- Cerca / Pulisci invariati; denylist scope geo/date ingest invariata.

### Collect BE

Estendere `AREA_FILTER_KEYS` / `ASSET_FILTER_KEYS` e `collect_filters` con le chiavi range; builder `area_filter_where` / `asset_filter_where` emettono le clausole sopra.

---

## §2 — Ricerca nazionale veloce (approccio B)

### Problema

`_wide_select_rows` con filtri attributo usa `filter_dense_first` (ordina per densità gold, stop dopo hit). Privilegia comuni densi e contraddice “niente priorità comunale”.

### Comportamento

1. Da gold `areas_stats` / presence: **allowlist** `municipality_id` con count > floor (es. `_FILTER_DENSE_FLOOR = 20`; stub mode ≈ 8 esclusi).
2. Una sola query DuckDB su union parquet allowlist: `WHERE <AND predicati> ORDER BY <sort FE> LIMIT/OFFSET`.
3. Allowlist vuota → risposta vuota immediata.
4. Scope ristretto sotto `_TABLE_SINGLE_SHOT_MAX` file → path single-shot attuale.
5. Senza filtri attributo (solo roots) → path gold/presence attuale (no regressione Area Italia).

| Scope | Path |
|-------|------|
| Nazionale / regionale / provinciale ampio + filtri | allowlist → un SELECT |
| Comunale / pochi file | single-shot |
| Nessun filtro attributo | gold count / presence (as-is) |

### Ordinamento

- Solo `sort_by` / `sort_dir`.
- Rimuovere `filter_dense_first` e ordinamento implicito `municipality_id ASC` sul path filtrato wide.

### Cache allowlist

- Chiave: `(kind, date_band, region_id?, province_id?)` → lista mid non-stub.
- TTL allineato gold / `_TABLE_COUNT_TTL_SEC` (~120s) o invalidazione ingest.
- Metriche: `allowlist_size`, `ms_resolve_allowlist`, `ms_duckdb_select`, `n_files`.

### Fuori scope §2

- Indici secondari / gold materializzato per campo.
- Cambiare layout parquet MinIO.

---

## §3 — Logging + test AND completi

### Logging

| Canale | Dove | Payload |
|--------|------|---------|
| `timed_op` | allowlist resolve, SELECT, COUNT async, viewport | `scope`, `kind`, `n_muni_in`→`n_allowlist`, `n_files`, `ms_*`, `page`, `nrows`, `has_more`, `filter_keys` |
| `emit_filter_test_log` (`FILTER_TEST_LOG=1`) | entry/exit `/table` e `/viewport` | predicati (incl. range), latenza, sample id |
| Debug NDJSON sessione Cursor | FE Cerca + BE path B | finché debug aperto; ipotesi H-range / H-allowlist / H-and |

### Test

1. **Unit** `table_filters`: range solo min / solo max / entrambi / min>max→`1=0`; date from/to; mix testo+enum+range → AND corretto.
2. **API live** (estendere suite `cadastre/tests`):
   - area: tutti i campi (testo + enum + surface min/max + survey from/to) → table + viewport.
   - asset: tutti i campi (codici + specie + diametri/altezza range + date + enum) → table + viewport.
   - livelli: nazionale (`--slow`), regionale, provinciale, comunale, subcomunale — stesso AND; budget es. nazionale filtrato **&lt; 5s** warm allowlist.
3. **E2E smoke**: form range → Cerca → tabella non stuck; Pulisci azzera range.

### Criteri di accettazione

1. Range FE/BE come §1; path B come §2 (no `filter_dense_first` su path filtrato).
2. AND completo area e asset verdi in suite; NDJSON con timing breakdown.
3. Nazionale filtrato rapido senza ordinamento per densità comunale.
4. Anti-regressione 2026-10-07 (Area Italia / Disegna / denylist / date ingest) resta valida.

## Fuori scope (documento)

- Persistenza `localStorage`.
- Range su lat/lon.
- Compatibilità wire con param single-value numerici/data.
- Materializzazione gold filtrata per attributo.
- Rimozione hook debug `#region agent log` (solo dopo conferma utente post-verifica).

## Addendum rispetto a 2026-10-07

| 2026-10-07 | Questo design |
|------------|----------------|
| `survey_date` ILIKE single | `survey_date_from` / `survey_date_to` |
| `surface_*` / diametri match numerico±ILIKE | `*_min` / `*_max` |
| Range “fuori scope” | In scope |
| Wide filtrato con densità-first | Allowlist B + ORDER BY utente |
| Suite filtri senza AND “tutti i campi” range | Suite AND completa + budget latenza |
