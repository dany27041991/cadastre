# Green — documentazione database

Cartella riservata a note sul dominio **verde urbano** (ASSET_AREA / ASSET_GREEN).

## Dove leggere cosa (post cutover lakehouse-only)

| Argomento | Documento |
|-----------|-----------|
| Modello logico ER + storage fisico | [../design/database-mapping-diagram.md](../design/database-mapping-diagram.md) |
| Design cutover (drop PG green) | [../../design/2026-09-04-green-lakehouse-only-pg-drop-design.md](../../design/2026-09-04-green-lakehouse-only-pg-drop-design.md) |
| Layout Parquet silver/gold | [../../infrastructure/lakehouse-parquet-layout.md](../../infrastructure/lakehouse-parquet-layout.md) |
| MinIO / compose | [../../infrastructure/minio-lakehouse.md](../../infrastructure/minio-lakehouse.md) |
| Livelli AREA_LEVEL | [../area/area-level-table.md](../area/area-level-table.md) |
| Vincoli di dominio | [../area/logical-constraints.md](../area/logical-constraints.md) |
| Stati/eventi (logico; history **non** in V1) | [../area/asset-area-state-and-events.md](../area/asset-area-state-and-events.md) |
| Ottimizzazione clustering PG *(storico)* | [../design/optimization/optimization_analysis.md](../design/optimization/optimization_analysis.md) |

**SoR viz green:** MinIO + DuckDB. Schema Postgres `cadastre` = vuoto (placeholder). Cataloghi OBT / admin = `public.*`.
