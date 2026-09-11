# Design: ribilancio fabbisogno hardware (lakehouse retrieval nazionale)

**Date:** 2026-09-10  
**Status:** accepted  
**Context:** Il workbook `Fabbisogno_SIV_Catasto_Arboreo.xlsx` dimensiona ancora PostGIS come SoR green (~36 M asset, 16 vCPU / 64 GB / 500 GB in produzione). Dopo il cutover lakehouse-only il retrieval mappa è viewport + gold Parquet (DuckDB/MinIO); PostGIS resta sui confini ISTAT e cataloghi OBT. Stesso fabbisogno su **Fabbisogno Corrente** e **Fabbisogno Fine Progetto**.

**Approvato in sessione:** approccio 1 (ribilanciare), matrice risorse, note, perimetro file.

## Decision

Riallineare CPU/RAM/disco al retrieval reale, senza right-size aggressivo su MinIO produzione (resta 500 GB di quota).

- **PostGIS:** tagliare al ruolo admin-only.
- **Backend:** alzare la RAM per DuckDB in-process (pool 8) e cache gold.
- **MinIO:** PaaS (CPU/RAM = NA); aumentare disco in sviluppo/collaudo; produzione invariata a 500 GB.
- **Frontend:** invariato (carico GIS sul browser, non sul pod nginx).
- **Niente replica RO PostGIS** per i GET mappa green.

Baseline volumetrica: censimento nazionale **~36–70 M** asset. La mappa non li materializza: cluster admin/grid e cap (`LAST_ZOOM_RAW_HARD_CAP=800`, `GRID_CLUSTER_HARD_CAP=1500`, `RAW_MAX_MUNICIPALITIES=40`).

## Retrieval (vincolo di dimensionamento)

```text
FE viewport (bbox + zoom)
  → FastAPI CatalogGreenAsset.viewport_green_assets
      → zoom basso: gold admin rollup O(#regioni)
      → zoom medio: gold grid_{z} (handoff admin se troppi comuni)
      → zoom ≥ 19: silver raw cap 800
  → DuckDB pool (default 8) → MinIO Parquet
PostGIS: solo breadcrumb / geometrie amministrative
```

Il collo di bottiglia a scala Italia è **concorrenza DuckDB + GET oggetti**, non i GB del PVC PostGIS. La quota MinIO 500 GB in produzione copre dati (decine di GB), snapshot, ~70k oggetti e erasure; non si riduce.

## Matrice risorse

Stessa tabella su entrambi i fogli. Quantità = repliche (container) o istanze PaaS.

| Servizio | Ambiente | Qty | vCPU | RAM (GB) | Disco (GB) |
|----------|----------|----:|-----:|---------:|-----------:|
| Backend FastAPI | Sviluppo | 1 | 2 | 8 | 10 |
| Backend FastAPI | Collaudo | 2 | 2 | 8 | 20 |
| Backend FastAPI | Produzione | 6 | 4 | 12 | 50 |
| Microfrontend React | Sviluppo | 1 | 1 | 2 | 5 |
| Microfrontend React | Collaudo | 2 | 1 | 2 | 10 |
| Microfrontend React | Produzione | 3 | 1 | 2 | 20 |
| PostgreSQL + PostGIS | Sviluppo | 1 | 2 | 4 | 20 |
| PostgreSQL + PostGIS | Collaudo | 1 | 4 | 8 | 50 |
| PostgreSQL + PostGIS | Produzione | 1 | 4 | 16 | 80 |
| Storage MinIO | Sviluppo | 1 | NA | NA | 50 |
| Storage MinIO | Collaudo | 1 | NA | NA | 150 |
| Storage MinIO | Produzione | 1 | NA | NA | 500 |

HPA backend produzione: **min 6 / max 12** (invariato rispetto alle note precedenti). 1 worker uvicorn per pod.

Colonne template invariate: Società DXC, Caso d'uso SIV, Incremento SI, date 2026-06-30 (sviluppo/collaudo) e 2026-09-30 (produzione), Rilasciato No.

## Note (colonna P)

| Servizio | Note |
|----------|------|
| Backend FastAPI | `HPA min 6 max 12 pod, 1 worker/pod. DuckDB in-process (pool 8) su MinIO Parquet. Viewport nazionale: gold admin/grid, non dump del dataset. PVC locale: log/temp.` |
| Microfrontend React | `nginx + bundle statico; PVC locale per log/cache asset.` (invariata) |
| PostgreSQL + PostGIS | `Solo confini ISTAT + cataloghi OBT. Nessun dato green. Disco admin ~20–50 GB utili; quota con margine. Niente replica RO per GET mappa.` |
| Storage MinIO | `SoR green (silver + gold + catalog). Serving via DuckDB. Dati ~decine di GB a 36–70 M asset; quota per snapshot, ~70k oggetti, erasure. CPU/RAM PaaS NA.` |

Descrizione MinIO (colonna E): `SIV - Object storage lakehouse (Parquet silver/gold)`.  
Descrizione PostGIS invariata. Software/ext PostGIS: `estensione postGIS`.

## File da aggiornare

| File | Azione |
|------|--------|
| `cadastre/docs/sizing/generate_siv_sizing_workbooks.py` | Source of truth: `SIV_RESOURCES` |
| `docs/Fabbisogno_SIV_Catasto_Arboreo.xlsx` | Unico workbook (LINFA/docs) |
| `cadastre/docs/sizing/metodologia-siv.md` | §4 tabelle Sviluppo/Collaudo/Produzione + nota PostGIS vs MinIO |

Niente copia in `cadastre/docs/sizing/`. Lo script `main()` può copiare sul Desktop: non è il deliverable. Non rigenerare il workbook Dataiku.

**Non toccare:** `Foglio1` del workbook; `dataiku_rsc_siv_catasto.xlsx`; compose, HPA, codice runtime.

## Verifica

- 12 righe dati per foglio; Corrente ≡ Fine Progetto.
- Produzione: backend 6×4 vCPU / 12 GB; PostGIS 4/16/80; MinIO 500 GB.
- AutoFilter / Tabella1 coprono A6:P20 (o range equivalente post-write).
- Dropdown Rilasciato su colonna M resta valido.

## Out of scope

- Benchmark misurato su seed nazionale 10 M+ (i numeri restano stime di fabbisogno).
- CPU/RAM MinIO self-hosted (resta PaaS).
- Redis / Hazelcast / ClickHouse.
- Layer WebGIS per metropoli.
- Dataiku iTree.
