# Lakehouse — layout Parquet (silver + catalog)

**Design:** [../design/2026-09-04-green-lakehouse-minio-duckdb-design.md](../design/2026-09-04-green-lakehouse-minio-duckdb-design.md)  
**Cutover lakehouse-only:** [../design/2026-09-04-green-lakehouse-only-pg-drop-design.md](../design/2026-09-04-green-lakehouse-only-pg-drop-design.md)  
**Writers:** seeders under `infrastructure/scripts/database/seed/` via shared module `infrastructure/scripts/database/lakehouse/lakehouse_writer.py` (+ `gold_clusters.py`).  
**Nota:** la scrittura green **non** passa più da export PostGIS → MinIO; i seeders (Lecce GeoJSON, boost, fixture) scrivono direttamente silver/gold/catalog.

## Hive path

```
s3://{bucket}/
  green_assets/region_id={R}/province_id={P}/municipality_id={M}/ingest_date={YYYY-MM-DD}/part-000.parquet
  green_areas/region_id={R}/province_id={P}/municipality_id={M}/ingest_date={YYYY-MM-DD}/part-000.parquet
  _catalog/municipality_ingests.parquet
```

Partition keys are **also stored as columns** inside the file (DuckDB-friendly).

`ingest_date` = data del batch (`--ingest-date`, default oggi). Un comune può avere più date.

## Silver `green_assets` (serving mappa + base table)

| Colonna | Tipo | Note |
|---------|------|------|
| id | int64 | PK logica asset |
| green_area_id | int64 nullable | |
| region_id | int32 | partition |
| province_id | int32 | partition |
| municipality_id | int32 | partition |
| ingest_date | date | partition / batch |
| asset_type | string | |
| geometry_type | string | P/L/A … |
| lon | float64 | centroid / point X (EPSG:4326) |
| lat | float64 | centroid / point Y |
| geom_wkb | binary | WKB EPSG:4326 (opzionale se troppo pesante; V1 incluso) |
| species, family, genus, variety | string nullable | |
| health_status, asset_status, … | string nullable | enum as text |
| survey_date | timestamp nullable | |

## Silver `green_areas`

| Colonna | Tipo | Note |
|---------|------|------|
| id | int64 | |
| region_id, province_id, municipality_id | int32 | |
| ingest_date | date | |
| parent_id | int64 nullable | |
| level | int32 | |
| name | string | |
| lon, lat | float64 | centroid |
| geom_wkb | binary | |
| area_classification, administrative_status, … | string nullable | |
| survey_date | timestamp nullable | |

## Catalog `_catalog/municipality_ingests.parquet`

| Colonna | Tipo |
|---------|------|
| municipality_id | int32 |
| region_id | int32 |
| province_id | int32 |
| dataset | string (`assets` \| `areas`) |
| ingest_at | date |
| object_prefix | string (s3 key prefix senza bucket) |
| row_count | int64 |
| checksum | string (sha256 del part file) |
| written_at | timestamp |

Resolve temporale: per ogni `municipality_id` nel territorio e `dataset`,  
`max(ingest_at) WHERE date_from ≤ ingest_at ≤ date_to`.

## Gold clusters

Generati all’ingest sotto:

```text
green_assets_clusters/
  region_id={R}/province_id={P}/municipality_id={M}/
    ingest_date={YYYY-MM-DD}/
      zoom_band={band}/part-000.parquet
```

**Bande `zoom_band` (allineate a `viewport_grid.py`):**

| band | Uso serving |
|------|-------------|
| `municipality` | Admin clusters (zoom &lt; 13); roll-up a province/region in DuckDB/Python |
| `grid_13` … `grid_18` | Grid clusters gold (`CLUSTER_MAX_ZOOM_THRESHOLD`…`CLUSTER_GRID_MAX_REFINE_ZOOM`; ex-matview equivalent) |

**Schema colonne gold (part file):**

| colonna | tipo |
|---------|------|
| level | string (`municipality` \| `grid_{z}`) |
| region_id / province_id / municipality_id | int32 |
| cell_x / cell_y | int32 (0 per admin) |
| count | int64 |
| sample_id | int64 |
| lon / lat | float64 (centroide) |
| min_lon / min_lat / max_lon / max_lat | float64 (extent) |

Il catalog silver (`_catalog/municipality_ingests.parquet`) resta la fonte di resolve temporale; i path gold si derivano da `(region,province,municipality,ingest_date)` risolti.

## Smoke / seed

```bash
# Fixture + upload MinIO + DuckDB resolve (senza PostGIS)
./infrastructure/scripts/database/lakehouse/run_seed_fixture_lakehouse.sh

# Lecce GeoJSON → lakehouse (PostGIS lookup + MinIO write)
./infrastructure/scripts/database/seed/run_populate_lecce.sh

# Boost sintetico un comune
./infrastructure/scripts/database/seed/run_boost_municipality.sh Roma
```
