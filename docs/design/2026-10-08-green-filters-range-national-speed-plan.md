# Plan — Filtri range + ricerca nazionale allowlist (B)

**Spec:** [2026-10-08-green-filters-range-national-speed-design.md](./2026-10-08-green-filters-range-national-speed-design.md)  
**Stato:** in progress (P0–P4 coded; verify live/e2e)  
**Vincolo UI:** solo `frontend/docs/components`  
**Anti-regressione:** Area Italia (no `clip_wkt`) / Disegna (`clip_wkt`) / denylist scope / date ingest.

## Current → Target

| As-is | Target |
|-------|--------|
| Numeri/date: single-value (`_numeric_or_ilike` / ILIKE date) | `*_min`/`*_max`, `*_from`/`*_to` |
| Wide filtrato: `filter_dense_first` (priorità densità) | Allowlist non-stub → **un** SELECT + ORDER BY utente |
| Suite senza AND “tutti i campi” range | Unit + API live + E2E AND completi + budget latenza |
| Log parziali | `timed_op` + `FILTER_TEST_LOG` + debug 4fe799 su path B |

## Affected files (principali)

| File | Change |
|------|--------|
| `backend/.../lakehouse/table_filters.py` | Keys range; SQL `>=`/`<=` DATE; rimuovere match single numerico/data |
| `backend/tests/test_table_filters.py` | Casi solo min/max/from/to/min>max/AND mix |
| `backend/.../lakehouse/silver_read.py` | Path B: resolve allowlist + single SELECT; rimuovere `filter_dense_first`; log timing |
| `backend/.../lakehouse/filter_test_log.py` (o call site) | Emit range keys + ms breakdown |
| `frontend/.../lib/greenTableFilterFields.ts` | Layout range keys; `filterControlKind` `number-range` / `date-range` |
| `frontend/.../GreenTablePanelSections.tsx` | Due Input / due DatePicker |
| `frontend/.../InfoPanelContent.tsx` (o apply) | Validazione min≤max prima di Cerca + toast |
| `frontend` i18n `it.json` / `en.json` | Label Min/Max / Da/A |
| `cadastre/tests/unit` + `api/table` + `api/viewport` + e2e | AND completi + range + slow nazionale |
| Spec 2026-10-07 (nota addendum) | Opzionale: link a questo doc in “fuori scope range” |

---

## P0 — BE range predicates — ~1.5 h

- [ ] Estendere `AREA_FILTER_KEYS` / `ASSET_FILTER_KEYS` con:
  - `surface_area_m2_min|max`, `survey_date_from|to`
  - `trunk_diameter_cm_min|max`, `plant_height_m_min|max`, `crown_diameter_m_min|max`
- [ ] In `area_filter_where` / `asset_filter_where`:
  - helper `_range_double(col, min_v, max_v)` e `_range_date(col, from_v, to_v)`
  - min>max (o from>to) → append `1=0`
  - **non** emettere più clausole su chiavi single `surface_area_m2` / `survey_date` / diametri (ignore)
- [ ] Unit: `test_table_filters.py` — solo min, solo max, entrambi, invertito, date, AND con `name`+enum

**Verify:** `pytest backend/tests/test_table_filters.py -q` verde.

**Rollback:** revert `table_filters.py` + test.

---

## P1 — FE form range + validazione Cerca — ~2 h

- [ ] `greenTableFilterFields.ts`:
  - layout: `surface_area_m2` → coppia min/max (o row dedicato); `survey_date` → from/to; asset diametri → min/max per campo
  - `filterControlKind`: `'number-range' | 'date-range'` (o chiave già `*_min` e kind number)
  - helper `isRangePairValid(filters, baseKey)` 
- [ ] `GreenTablePanelSections.tsx`: render due `Input` / due `DatePicker` (dxc-webkit); labels i18n Min/Max Da/A
- [ ] Prima di `applyFiltersAndShowResults`: se range invalido → toast, no commit
- [ ] `clearColumnFilters` / Pulisci: azzera anche `*_min|max|from|to`
- [ ] Wire URL: keys flat già supportate da append filters (verificare denylist non le blocca)

**Verify:** smoke UI locale — valorizza surface min/max + date from/to → Cerca → Network mostra i nuovi param.

**Rollback:** revert FE files + i18n.

---

## P2 — National path B (allowlist + single SELECT) — ~3 h

- [ ] Helper `_non_stub_allowlist(resolutions, presence_counts, floor=_FILTER_DENSE_FLOOR) -> list[IngestResolution]`
- [ ] Cache TTL allowlist (chiave scope+kind+date band)
- [ ] In `_wide_select_rows` quando `attribute_filtered`:
  1. resolve allowlist (presence > floor)
  2. se vuota → `[]`
  3. **un** `read_parquet(allowlist files)` + `WHERE` + `ORDER BY {order_col} {order_dir}` (**senza** `municipality_id ASC` obbligatorio) + `LIMIT/OFFSET`
  4. chunking solo se DuckDB/file list troppo grande (fallback chunk allowlist **senza** densità-first; ordine = sort utente)
- [ ] Rimuovere branch `filter_dense_first` / dense.sort / sparse probe
- [ ] Path senza filtri attributo: invariato (gold skip / presence)
- [ ] Log: `skip_mode=allowlist_select`, `allowlist_size`, `ms_resolve`, `ms_select`, `n_files`
- [ ] Aggiornare `test_lakehouse_serving.py` path wide filtrato (mock allowlist)

**Verify:** curl nazionale `name=villa` (o ILIKE noto) warm &lt; 5s; log `skip_mode=allowlist_select`; nessun reorder densità.

**Rollback:** ripristinare branch dense-first (git revert P2 only).

---

## P3 — Logging ovunque sul path ricerca — ~1 h

- [ ] `timed_op` su resolve allowlist + select + viewport filtered
- [ ] `emit_filter_test_log`: includere `range_keys`, `allowlist_size`, `ms_*`
- [ ] Mantenere `#region agent log` 4fe799 (H-range / H-allowlist / H-and) fino a conferma utente
- [ ] FE: log Cerca con keys range committed (fetch debug già presente — estendere payload)

**Verify:** `FILTER_TEST_LOG=1` → NDJSON con breakdown dopo una Cerca nazionale.

---

## P4 — Suite test AND completa + budget — ~2.5 h

- [ ] API: caso area **tutti** i campi (testo+enum+surface min/max+survey from/to) table+viewport
- [ ] API: caso asset **tutti** i campi (incl. diametri/altezza range + date + enum)
- [ ] API livelli: regionale / provinciale / comunale / subcomunale (stesso AND)
- [ ] `--slow`: nazionale filtrato assert latenza warm &lt; 5s (soglia documentata; skip se lake assente)
- [ ] E2E: range form → Cerca → no stuck loading; Pulisci azzera range
- [ ] Aggiornare `cadastre/tests/README.md` + fixture catalog se serve

**Verify:** `./cadastre/tests/run_filter_suite.sh --all` (o `--slow`+e2e) verde.

---

## P5 — Doc cutover + chiusura — ~0.5 h

- [ ] Spec stato `accepted` (già); note in 2026-10-07 “range fuori scope” → link addendum
- [ ] Solo dopo OK utente: rimuovere `#region agent log` ridondanti (tenere `timed_op` / `FILTER_TEST_LOG`)

---

## Execution order

```text
P0 (BE range) → P1 (FE range) → P2 (allowlist B) → P3 (logs) → P4 (tests) → P5 (doc/cleanup)
```

P0 e P1 possono andare in parallelo dopo P0 unit verde. **P2 dipende da P0** (predicati range già nel WHERE nazionale).

## Risks

| Rischio | Mitigazione |
|---------|-------------|
| Allowlist floor taglia comuni “reali” sparsi | Floor configurabile; log `allowlist_size`; se 0 hit e allowlist&gt;0 ok; se floor troppo alto abbassare |
| DuckDB explode su troppi file allowlist | Fallback chunk allowlist senza densità; log `n_files` |
| FE layout zeppo min/max | Row CSS esistente `row`/`row3`; labels corte Min/Max |
| Breaking wire single-value | Documentato; form non emette più; unknown ignore |

## Done when

1. Form usa solo range per superfici/diametri/altezze/date; Cerca valida min≤max.
2. Nazionale filtrato via allowlist + un SELECT; no `filter_dense_first`.
3. Suite AND completa + NDJSON timing; warm nazionale &lt; 5s (budget).
4. Anti-regressione Area Italia / Disegna OK.
