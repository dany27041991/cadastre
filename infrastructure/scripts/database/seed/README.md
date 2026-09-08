# Seed — popolamento green → MinIO lakehouse

Gli script in questa cartella popolano **aree verdi e asset** su **MinIO** (Parquet silver + gold + catalog).  
PostGIS resta solo per **confini admin** e cataloghi DBT (`attribute_types`, …) in lettura.

**Design:** [docs/design/2026-09-04-green-lakehouse-only-pg-drop-design.md](../../../docs/design/2026-09-04-green-lakehouse-only-pg-drop-design.md)  
**Layout:** [docs/infrastructure/lakehouse-parquet-layout.md](../../../docs/infrastructure/lakehouse-parquet-layout.md)

**Requisiti:** stack Compose avviato (`postgis` + `minio`); eseguire **dalla root del progetto** `cadastre/`.

---

## 1. Lecce da GeoJSON — `run_populate_lecce.sh`

Carica aree/hedges/shrubs/trees da `infrastructure/data/municipality/lecce/` → lakehouse.

```bash
./infrastructure/scripts/database/seed/run_populate_lecce.sh
INGEST_DATE=2025-06-01 ./infrastructure/scripts/database/seed/run_populate_lecce.sh
```

Script: `populate_lecce_data/load_lecce_green_data.py`

---

## 2. Boost singolo comune — `run_boost_municipality.sh`

Genera dati sintetici per un comune (geometria da `public.municipalities`) e scrive MinIO.

```bash
./infrastructure/scripts/database/seed/run_boost_municipality.sh Roma
AREAS=80 TREES=20000 HEDGES=2000 ./infrastructure/scripts/database/seed/run_boost_municipality.sh Milano
```

Script: `boost_municipality/boost_municipality_to_lakehouse.py`  
(SQL legacy `municipality_*.sql` non usati — green non esiste più in PostGIS.)

---

## 3. Popolamento per regione — `run_populate_region_data.sh`

Seed sintetico: per ogni comune della regione riusa la stessa generazione del boost
(griglia aree + alberi/siepi → MinIO). Non è il vecchio Voronoi SQL.

```bash
./infrastructure/scripts/database/seed/run_populate_region_data.sh --region "Valle d'Aosta"
./infrastructure/scripts/database/seed/run_populate_region_data.sh --region 2 --limit 3 --areas 10 --trees 200
./infrastructure/scripts/database/seed/run_populate_region_data.sh --region Puglia --dry-run
# Multi-batch (MM-YYYY o YYYY-MM-DD):
./infrastructure/scripts/database/seed/run_populate_region_data.sh \
  --region Lazio \
  --ingest-date 01-2024 --ingest-date 01-2025 --ingest-date 01-2026 \
  --areas 8 --trees 150 --hedges 15
```

Default ridotti rispetto al boost singolo (`areas=10`, `trees=500`, `hedges=50`) perché × N comuni × N date.  
Script: `populate_region_data/seed_populate_region_data.py`

---

## 4. Fixture smoke (senza GeoJSON)

```bash
./infrastructure/scripts/database/lakehouse/run_seed_fixture_lakehouse.sh
```

Writer condiviso: `lakehouse/lakehouse_writer.py` (`--fixture` o API `ingest_municipality_tables`).

---

## Env utili

| Var | Note |
|-----|------|
| `LAKEHOUSE_S3_*` | Da compose `.env` (endpoint host tipicamente `http://localhost:9000`) |
| `DATABASE_URL` | Lookup admin/DBT |
| `LAKEHOUSE_CATALOG_INVALIDATE_URL` | Opzionale POST invalidate post-seed |
| `INGEST_DATE` | Batch date `YYYY-MM-DD` |
