# MinIO — lakehouse green assets / aree

- Design (lakehouse-only): [../design/2026-09-04-green-lakehouse-only-pg-drop-design.md](../design/2026-09-04-green-lakehouse-only-pg-drop-design.md)
- Design (layout / temporale storico): [../design/2026-09-04-green-lakehouse-minio-duckdb-design.md](../design/2026-09-04-green-lakehouse-minio-duckdb-design.md)
- Layout Parquet: [lakehouse-parquet-layout.md](./lakehouse-parquet-layout.md)
- Cutover / wipe: [lakehouse-cutover-runbook.md](./lakehouse-cutover-runbook.md)
- Hardening TTL / metriche / retention: [lakehouse-hardening.md](./lakehouse-hardening.md)

## Ruolo

Object storage S3-compatibile per Parquet **silver** (feature) e **gold** (cluster preaggregati) + file **catalog** degli ingest per comune.

Il backend FastAPI legge via **DuckDB** (`httpfs`). Il serving green viz è **solo lakehouse** (niente path PostGIS green).

## Compose (always-on)

Servizi in `infrastructure/compose/docker-compose.yml` (nessun profile):

| Servizio | Ruolo |
|----------|--------|
| `minio` | API S3 `:9000`, console `:9001` |
| `minio-init` | Crea bucket `cadastre-lake` (idempotente) |

Avvio (dalla cartella compose):

```bash
docker compose up -d
```

Verifica console: http://localhost:9001

Il `backend` dipende da MinIO healthy + `minio-init` completed.

DuckDB è dipendenza obbligatoria del backend (`requirements.txt` + install dedicata in `Dockerfile.standalone`). L’`entrypoint.sh` installa DuckDB al volo se assente (utile se l’immagine non è stata ricostruita dopo il cutover lakehouse-only).

## Env

Valori di esempio in `infrastructure/compose/.env.example` (sezione Lakehouse).

| Variabile | Scopo |
|-----------|--------|
| `LAKEHOUSE_S3_ENDPOINT` | URL MinIO in rete compose (`http://minio:9000`); da host `http://localhost:9000` |
| `LAKEHOUSE_S3_ACCESS_KEY` | Access key (`MINIO_ROOT_USER`) |
| `LAKEHOUSE_S3_SECRET_KEY` | Secret key (`MINIO_ROOT_PASSWORD`) |
| `LAKEHOUSE_S3_BUCKET` | `cadastre-lake` |
| `LAKEHOUSE_S3_REGION` | es. `us-east-1` |
| `LAKEHOUSE_CATALOG_CACHE_TTL_SEC` | TTL cache catalog in API (es. 60) |
| `LAKEHOUSE_MINIO_API_PORT` | Host port API (default 9000) |
| `LAKEHOUSE_MINIO_CONSOLE_PORT` | Host port console (default 9001) |

## Path logici

Vedi design § Layout object storage. Partizioni obbligatorie: `region_id`, `province_id`, `municipality_id`, `ingest_date`.

## Operazioni

- **Seed / ingest comune:** write silver + gold + upsert catalog (idempotente su stessa `ingest_date`).
- **Rollback serving:** revert git + wipe volumi (`docker compose down -v`). Nessun feature flag.
- **Retention:** policy lifecycle su prefissi green_* — [lakehouse-hardening.md](./lakehouse-hardening.md); non cancellare l’ultimo ingest per comune senza decisione esplicita.
