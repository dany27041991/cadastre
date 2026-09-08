# Strategy: Index and Partition Creation - Before vs After Population

> **STORICO / SUPERSEDED (2026-09-04 cutover lakehouse-only)**  
> Strategia pensata per tabelle partizionate **`cadastre.green_assets*`** / **`green_areas*`** e script `municipality_populate.sql` / `repartition_and_reindex.sql` sul path PostGIS.  
> **Stato attuale:** schema `cadastre` vuoto; seed green → MinIO; nessun create partition/index su green in PG.  
> Riferimenti vivi:  
> - [../../../../design/2026-09-04-green-lakehouse-only-pg-drop-design.md](../../../../design/2026-09-04-green-lakehouse-only-pg-drop-design.md)  
> - [../../../infrastructure/lakehouse-parquet-layout.md](../../../infrastructure/lakehouse-parquet-layout.md)  
> - [optimization_analysis.md](./optimization_analysis.md)

Il testo sotto è **archivio**. Per `public.*` (regions, municipalities, …) restano utili indici GIST/btree dell’init `01-*`; non applicano checklist green.

---

## Current Situation *(historical)*

- **Existing records**: ~8.7 million in `green_assets`
- **Partitions**: DEFAULT + Lazio (12) + Lombardia (3)
- **Indexes**: Base on DEFAULT + partial composite indexes on specific partitions

---

## ANALYSIS: Indexes *(historical)*

### CREATE INDEXES BEFORE (Empty Table)

**Advantages:** fast creation on empty table; automatic maintenance on DML.  
**Disadvantages:** slower bulk INSERT; population can increase 30–50%.

### CREATE INDEXES AFTER (Populated Table)

**Advantages:** fast bulk load; indexes built with real stats.  
**Disadvantages:** slow GIST build on millions of rows; locks; temp space.

---

## ANALYSIS: Partitions *(historical)*

### CREATE PARTITIONS BEFORE

Immediate pruning; schema clear; no data movement. Requires knowing regions upfront; empty unused partitions.

### CREATE PARTITIONS AFTER (On-Demand)

Flexibility; cost of moving rows from DEFAULT; temporary locks.

---

## RECOMMENDATION *(historical hybrid — was optimal for PG green)*

1. **Initial schema:** partitioned tables + DEFAULT + essential base/GIST indexes  
2. **During population:** on-demand region partitions + base indexes  
3. **After population:** partial composite indexes + REINDEX + ANALYZE  

**Replacement today:** hive partitions in object storage (`region_id` / `province_id` / `municipality_id` / `ingest_date`); gold clusters written at seed/ingest — no `02-init-indexes` green, no `repartition_and_reindex` for green.

---

## CHECKLIST *(historical — scripts may be gone or no-op)*

### Before Population (`01-init-schema.sql` + `02-init-indexes.sql`)

- [x] Partitioned tables with DEFAULT *(removed from init)*
- [x] Indexes on reference tables (`public.regions`, …) — **still relevant**
- [x] GIST / filter indexes on green DEFAULT — **N/A**

### During / After Population

- [x] On-demand region partitions + composite indexes — **N/A** (seed → MinIO)

---

## PERFORMANCE Comparison *(historical scenarios A–D)*

Vedi versione precedente in git history se servono i timing dettagliati (45–65 min population PG). Non confrontabili con write Parquet attuale.

---

## CONCLUSION

**Pre-cutover:** hybrid PG partition/index strategy was best practice for millions of green rows in PostGIS.  
**Post-cutover:** do not reintroduce green partitions/indexes in Postgres; optimize lakehouse layout and DuckDB serving instead.

## References (current)

- `infrastructure/scripts/init/postgis/sql/01-*.sql` — admin / OBT in `public`
- `infrastructure/scripts/init/postgis/sql/02-init-schema-cadastre.sql` — empty `cadastre`
- `infrastructure/scripts/database/lakehouse/lakehouse_writer.py` — silver/gold write
- `infrastructure/scripts/database/seed/` — Lecce / boost → MinIO
