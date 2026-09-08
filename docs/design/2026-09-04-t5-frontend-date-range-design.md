# Design — T5 Frontend date range (lakehouse green)

**Date:** 2026-09-04  
**Status:** accepted (brainstorming); **note cutover:** [2026-09-04-green-lakehouse-only-pg-drop-design.md](./2026-09-04-green-lakehouse-only-pg-drop-design.md) — `date_from`/`date_to` sempre obbligatori lato BE; BE non ignora più i param (flag rimosso).  
**Parent:** [2026-09-04-green-lakehouse-minio-duckdb-design.md](./2026-09-04-green-lakehouse-minio-duckdb-design.md)  
**Plan:** [2026-09-04-green-lakehouse-minio-duckdb-plan.md](./2026-09-04-green-lakehouse-minio-duckdb-plan.md) § T5

## Goal

After territory entry (Area Italia or draw clip), let the user set an ingest date range in the InfoPanel. Propagate `date_from` / `date_to` to green viewport, table, and detail API calls so lakehouse serving can resolve per-municipality `max(ingest_at)` in range.

## Decisions

| Topic | Choice |
|-------|--------|
| Placement | InfoPanel, **Layers** step (`LayersPanel`) |
| Visibility | Always visible (not gated by FE lakehouse flag) |
| API params | Always sent when dates are set; **post-cutover:** BE li richiede sempre (niente path PostGIS / flag OFF) |
| Default range | Last **12 months**: `date_to = today`, `date_from = today − 1 year` |
| State | `GreenTablePanelContext` (single source of truth) |
| UI kit | dxc-webkit `DatePicker` only ([23-date-picker.md](../../frontend/docs/components/dxc-webkit/23-date-picker.md)) |

## Architecture

```text
InfoPanel LayersPanel
  └─ IngestDateRangeFields (2× DatePicker)
        │ setDateFrom / setDateTo
        ▼
GreenTablePanelContext { dateFrom, dateTo }
        │
        ├─ useGreenAssetsLayer → greenAssetMap / greenAreaMap viewport
        ├─ GreenDataTable → greenTable.api
        └─ useGreenFeatureDetail → greenDetail.api
```

- ISO query params: `date_from`, `date_to` as `YYYY-MM-DD`.
- Viewport debounce / pan-settled behaviour unchanged; date changes are extra fetch deps.
- `resetPanelState` / `resetToLanding` restore the default 12-month window.
- Clearing a DatePicker restores the default for that bound (no “missing dates” state).

## UI behaviour

- Section label i18n (e.g. periodo / data da / data a).
- `locale="it"`, `customDateFormat="dd/MM/yyyy"`.
- Constraints: `date_from.max = date_to`, `date_to.min = date_from` (enforce `from ≤ to`).
- Empty lakehouse result: i18n message “Nessun dato nel periodo selezionato” (helper under pickers and/or existing empty table / toast pattern already used in territory).
- Draw-on-map and Area Italia flows unchanged aside from always attaching dates.

## API client changes

Extend query builders / fetch params in:

- `features/territory/api/greenAssetMap.api.ts`
- `features/territory/api/greenAreaMap.api.ts`
- `features/territory/api/greenTable.api.ts`
- `features/territory/api/greenDetail.api.ts`

Wire callers to read `dateFrom` / `dateTo` from context (or props derived from it).

## Anti-regression

- Response wire shapes (GeoJSON / Geobuf / table / detail) unchanged.
- **Post-cutover:** BE richiede sempre le date; niente path PostGIS green / flag OFF.
- No raw `<input type="date">`; no undocumented UI libraries.

## Out of scope (T5)

- Cutover lakehouse-only (completato in [pg-drop design](./2026-09-04-green-lakehouse-only-pg-drop-design.md))
- p95 metrics, catalog TTL, retention (T7 / hardening)
- Changing temporal resolve rule (already fixed in parent design)

## Test plan

- Unit: query builders append `date_from` / `date_to`.
- Manual: Layers step shows defaults; changing range refetches viewport/table; empty period shows message when no matching ingest.
- Smoke: Area Italia + draw-on-map con date + lakehouse popolato.

## Implementation notes

Prefer a small `IngestDateRangeFields` under `widgets/layout/info-panel/` composed into `LayersPanel`, keeping DatePicker usage aligned with the documented props.
