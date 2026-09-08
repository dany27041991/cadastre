# Clustering Query Optimization Analysis

> **STORICO / SUPERSEDED (2026-09-04 cutover lakehouse-only)**  
> Questo documento analizza query di clustering su **`cadastre.green_assets*`** (PostGIS). Quelle tabelle, le matview cluster e il path runtime PostGIS **non esistono più**.  
> **Serving viz green attuale:** MinIO Parquet + DuckDB; cluster **gold precomputati all’ingest** (`green_asset_clusters/`).  
> Riferimenti vivi:  
> - [../../../../design/2026-09-04-green-lakehouse-only-pg-drop-design.md](../../../../design/2026-09-04-green-lakehouse-only-pg-drop-design.md)  
> - [../../../infrastructure/lakehouse-parquet-layout.md](../../../infrastructure/lakehouse-parquet-layout.md)  
> - [index_partition_strategy.md](./index_partition_strategy.md) (stesso status storico)

Il testo sotto resta come **archivio** di un’analisi di performance pre-cutover (indici GIST, pruning partizioni, matview). Non applicare le raccomandazioni SQL a un DB allineato all’init attuale (`02-init-schema-cadastre.sql` = schema `cadastre` vuoto).

---

## Current State *(historical)*

Queries were optimized with:
- Partition pruning (`region_id`)
- GIST indexes on geometry
- Btree indexes on `geometry_type`, `municipality_id`, `region_id`
- `ST_Intersects` before `ST_Within`
- CTEs to avoid repeated subqueries

**Measured timings (pre-cutover PostGIS):**
- High zoom: 75-176 ms
- Medium zoom: 84-320 ms
- Low zoom: 2.3-2.7 seconds
- Worst case (entire region): 24-28 seconds

## Execution Plan Analysis *(historical)*

From the plan for the slowest query (VERSION 6C - Lazio region):

```
Rows Removed by Filter: 3,026,660
Execution Time: 15,057 ms
```

**Identified issue then:**
- The `geometry_type = 'point'` filter was applied **AFTER** using the GIST index
- This caused 3M+ rows to be scanned and then filtered
- Indexes on `geometry_type`, `municipality_id`, `region_id` were separate and not combined effectively

## Recommended Optimizations *(historical — do not apply to current green stack)*

### HIGH PRIORITY (was: PostGIS path)

#### 1. Partial Composite Indexes for Territorial Filters
**Impact (then):** 30-50% time reduction for municipality/province queries  
**Cost:** Medium (~50-150MB per partition)

```sql
-- HISTORICAL — tables no longer in init
CREATE INDEX idx_ga_12_point_municipality_region
ON cadastre.green_assets_12(geometry_type, region_id, municipality_id)
WHERE geometry_type = 'point';

CREATE INDEX idx_ga_12_point_province_region
ON cadastre.green_assets_12(geometry_type, region_id, province_id)
WHERE geometry_type = 'point';
```

#### 2. Update Database Statistics

```sql
-- HISTORICAL
ANALYZE cadastre.green_assets;
ANALYZE cadastre.green_assets_12;
ANALYZE public.municipalities;
ANALYZE public.regions;
```

(`ANALYZE` su `public.municipalities` / `public.regions` resta sensato per il layer amministrativo PostGIS.)

### MEDIUM / LOW PRIORITY *(historical)*

- Limit points for entire-region queries (`LIMIT 1000000`)
- `max_parallel_workers_per_gather`
- Partial GIST indexes
- Materialized views `cadastre.green_assets_clusters_*` → **sostituiti da gold Parquet**

## Expected Improvement Estimates *(historical)*

| Optimization | High Zoom | Medium Zoom | Low Zoom | Worst Case |
|--------------|-----------|-------------|----------|------------|
| None | 75-176 ms | 84-320 ms | 2.3-2.7s | 24-28s |
| + Composite indexes | 50-120 ms | 60-220 ms | 1.6-1.9s | 17-20s |
| All | 50-120 ms | 60-220 ms | 1.2-1.5s | 10-12s |

## Replacement (current)

| Bisogno | Pre-cutover | Ora |
|---------|-------------|-----|
| Cluster zoom basso | Aggregazione runtime / matview PG | Gold `green_asset_clusters` all’ingest |
| Filtri territorio | Indici + partizioni `green_assets_*` | Hive prune + DuckDB su silver/gold |
| Indici GIST green | Critici | N/A (no tabelle green in PG) |

## Conclusions *(historical)*

L’analisi restava valida per il path PostGIS green. Dopo il cutover, **non** si ottimizzano più indici su `cadastre.green_*`: si ottimizzano layout Parquet, gold precompute e query DuckDB.
