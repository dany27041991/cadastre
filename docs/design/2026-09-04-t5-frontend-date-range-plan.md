# Plan — T5 Frontend date range

**Spec:** [2026-09-04-t5-frontend-date-range-design.md](./2026-09-04-t5-frontend-date-range-design.md)  
**Parent plan (storico T0–T7):** [2026-09-04-green-lakehouse-minio-duckdb-plan.md](./2026-09-04-green-lakehouse-minio-duckdb-plan.md) § T5  
**Cutover:** date sempre obbligatorie lato BE — [2026-09-04-green-lakehouse-only-pg-drop-design.md](./2026-09-04-green-lakehouse-only-pg-drop-design.md)

## Tasklist

### T5.1 — Context state
- [x] `dateFrom` / `dateTo` (`Date`) + setters in `GreenTablePanelContext`
- [x] Default last 12 months; restore on `resetPanelState`
- [x] Helper `toIsoDate` / `defaultIngestDateRange`

### T5.2 — InfoPanel UI
- [x] `IngestDateRangeFields.tsx` (2× dxc-webkit `DatePicker`)
- [x] Compose into `LayersPanel`
- [x] i18n keys (it + en)

### T5.3 — API clients
- [x] Append `date_from` / `date_to` in asset/area viewport builders
- [x] Table + detail fetch params
- [x] Unit tests on query builders (`ingestDateRange.test.ts` — 5 passed)

### T5.4 — Wire consumers
- [x] `useGreenAssetsLayer` (+ `TerritoryMapWidget`)
- [x] Table queries via `greenTableParams`
- [x] `useGreenFeatureDetail` / detail fetch

### T5.5 — Empty period UX
- [x] Empty table → `territory.panel.noDataInPeriod`
- [x] Clear picker → restore default bound

### T5.6 — Close-out
- [x] Spuntare T5 nel plan lakehouse
- [x] Smoke Area Italia / draw + date + lakehouse popolato (QA post-cutover; ex “flag OFF” obsoleto)
