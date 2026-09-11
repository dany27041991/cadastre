# Seed — popolamento green → MinIO lakehouse

Gli script in questa cartella popolano **aree verdi e asset** su **MinIO** (Parquet silver + gold + catalog).  
PostGIS resta solo per **confini admin** e cataloghi DBT (`attribute_types`, …) in lettura.

**Design:** [docs/design/2026-09-10-multi-snapshot-national-seed-design.md](../../../docs/design/2026-09-10-multi-snapshot-national-seed-design.md)  
**Layout:** [docs/infrastructure/lakehouse-parquet-layout.md](../../../docs/infrastructure/lakehouse-parquet-layout.md)

**Requisiti:** stack Compose avviato (`postgis` + `minio`); eseguire **dalla root del progetto** `cadastre/`.

### Layout GeoJSON reali

```text
infrastructure/data/municipality/<slug>/<YYYY-MM-DD>/
  areas.geojson, trees.geojson, hedges.geojson, shrubs.geojson, …
```

Esempio Lecce: `municipality/lecce/2024-01-01/`.  
Per ogni `(comune, ingest_date)`: se la cartella ISO esiste → dati reali; altrimenti → mock.

**Date di default:** `2021-01-01,2023-01-01,2024-01-01` (override con `--ingest-dates` / `INGEST_DATES`).  
Cartelle ISO aggiuntive sotto un comune aggiungono snapshot **solo** per quel comune.

---

## 1. Lecce da GeoJSON — `run_populate_lecce.sh`

```bash
./infrastructure/scripts/database/seed/run_populate_lecce.sh
INGEST_DATES=2021-01-01,2024-01-01 ./infrastructure/scripts/database/seed/run_populate_lecce.sh
```

Script: `populate_lecce_data/load_lecce_green_data.py`  
Helper condiviso: `common/seed_municipality_snapshot.py`

---

## 2. Boost singolo comune — `run_boost_municipality.sh`

Genera dati sintetici per un comune (geometria da `public.municipalities`) e scrive MinIO.

```bash
./infrastructure/scripts/database/seed/run_boost_municipality.sh Roma
AREAS=80 TREES=20000 HEDGES=2000 ./infrastructure/scripts/database/seed/run_boost_municipality.sh Milano
```

Script: `boost_municipality/boost_municipality_to_lakehouse.py`

---

## 3. Popolamento per regione — `run_populate_region_data.sh`

```bash
./infrastructure/scripts/database/seed/run_populate_region_data.sh --region "Valle d'Aosta"
./infrastructure/scripts/database/seed/run_populate_region_data.sh --region Puglia --dry-run
./infrastructure/scripts/database/seed/run_populate_region_data.sh \
  --region Lazio \
  --ingest-dates 2021-01-01,2023-01-01,2024-01-01 \
  --areas 8 --trees 150 --hedges 15
```

Default densità: `areas=10`, `trees=500`, `hedges=50`.  
Script: `populate_region_data/seed_populate_region_data.py`

---

## 4. Seed nazionale — `run_populate_national_data.sh`

```bash
./infrastructure/scripts/database/seed/run_populate_national_data.sh --dry-run
./infrastructure/scripts/database/seed/run_populate_national_data.sh \
  --wipe --workers 4 --trees 1200 --hedges 80 --areas 8
./infrastructure/scripts/database/seed/run_populate_national_data.sh \
  --region "Puglia" --limit 5 --ingest-dates 2021-01-01,2024-01-01 --dry-run
```

Tre snapshot di default ≈ **3×** volume rispetto al seed single-date.  
Script: `populate_national_data/seed_populate_national_data.py`

---

## 5. Fixture smoke (senza GeoJSON)

```bash
./infrastructure/scripts/database/lakehouse/run_seed_fixture_lakehouse.sh
```

Writer: `lakehouse/lakehouse_writer.py`.

---

## Env utili

| Var | Note |
|-----|------|
| `LAKEHOUSE_S3_*` | Da compose `.env` (endpoint host tipicamente `http://localhost:9000`) |
| `DATABASE_URL` | Lookup admin/DBT |
| `DATA_DIR` | Root dati (`…/infrastructure/data`) |
| `INGEST_DATES` | Lista `YYYY-MM-DD` separate da virgola |
| `INGEST_DATE` | Legacy: singola data |
| `LAKEHOUSE_CATALOG_INVALIDATE_URL` | Opzionale POST invalidate post-seed |
