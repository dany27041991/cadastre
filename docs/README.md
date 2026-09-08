# Cadastre — documentazione

## SoR green (post cutover 2026-09-04)

Visualizzazione aree/asset verdi: **MinIO Parquet + DuckDB** (lakehouse-only).  
PostGIS = confini admin + cataloghi OBT. Schema `cadastre` vuoto.

| Doc | Contenuto |
|-----|-----------|
| [design/2026-09-04-green-lakehouse-only-pg-drop-design.md](./design/2026-09-04-green-lakehouse-only-pg-drop-design.md) | Design cutover (source of truth) |
| [design/2026-09-04-green-lakehouse-only-pg-drop-plan.md](./design/2026-09-04-green-lakehouse-only-pg-drop-plan.md) | Plan P0–P7 |
| [infrastructure/minio-lakehouse.md](./infrastructure/minio-lakehouse.md) | Compose MinIO always-on |
| [infrastructure/lakehouse-parquet-layout.md](./infrastructure/lakehouse-parquet-layout.md) | Layout silver/gold/catalog |
| [infrastructure/lakehouse-cutover-runbook.md](./infrastructure/lakehouse-cutover-runbook.md) | Wipe & recreate |
| [database/design/database-mapping-diagram.md](./database/design/database-mapping-diagram.md) | ER logico + storage fisico |
| [database/green/README.md](./database/green/README.md) | Indice dominio green |

## Altre cartelle

| Cartella | Note |
|----------|------|
| `design/` | Design/plan feature (banner superseded dove legacy dual-path) |
| `database/` | Modello dati, OBT, area levels |
| `infrastructure/` | Ops lakehouse |
| `guidelines/` | TBD / clean code |
| `sizing/` | Dimensionamento (addendum MinIO) |

Frontend mappa: `frontend/docs/geoinsight/`. Backend struttura: `backend/docs/design/`.
