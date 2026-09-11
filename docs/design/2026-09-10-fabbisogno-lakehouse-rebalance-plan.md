# Plan: ribilancio fabbisogno hardware (lakehouse)

**Date:** 2026-09-10  
**Design:** [2026-09-10-fabbisogno-lakehouse-rebalance-design.md](./2026-09-10-fabbisogno-lakehouse-rebalance-design.md)  
**Status:** implemented

## Target

Stessa matrice su Corrente e Fine Progetto. PostGIS admin-only; MinIO SoR green; backend RAM per DuckDB. Dataiku / Foglio1 / runtime intatti.

## Affected files

| File | Change |
|------|--------|
| `docs/sizing/generate_siv_sizing_workbooks.py` | `SIV_RESOURCES`; output su `LINFA/docs/` |
| `../docs/Fabbisogno_SIV_Catasto_Arboreo.xlsx` | unico workbook |
| `docs/sizing/metodologia-siv.md` | §4 |

## Execution

- [x] Phase 1 — Generator `SIV_RESOURCES`
- [x] Phase 2 — Workbook + copy LINFA/docs (12 righe, fogli uguali)
- [x] Phase 3 — Metodologia §4

## Rollback

Revert i quattro file; il commit design `c6d0b2a` resta.
