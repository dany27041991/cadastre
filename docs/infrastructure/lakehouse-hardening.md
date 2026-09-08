# Hardening lakehouse green

**Design:** [../design/2026-09-04-green-lakehouse-only-pg-drop-design.md](../design/2026-09-04-green-lakehouse-only-pg-drop-design.md)  
**Cutover / wipe:** [lakehouse-cutover-runbook.md](./lakehouse-cutover-runbook.md)  
**MinIO always-on:** [minio-lakehouse.md](./minio-lakehouse.md)

## Catalog TTL e invalidazione

| Meccanismo | Dettaglio |
|------------|-----------|
| TTL in-process | `LAKEHOUSE_CATALOG_CACHE_TTL_SEC` (default **60**). `0` ≈ sempre reload. |
| Invalidate immediata | `POST /api/territory/lakehouse/catalog/invalidate` (sempre disponibile) |
| Post-seed | Seed setta `LAKEHOUSE_CATALOG_INVALIDATE_URL` → POST dopo upsert catalog |

Esempio locale:

```bash
export LAKEHOUSE_CATALOG_INVALIDATE_URL=http://localhost:8000/api/territory/lakehouse/catalog/invalidate
./infrastructure/scripts/database/seed/run_populate_lecce.sh
```

Su multi-replica: ogni pod ha la propria cache; TTL + invalidate su **tutti** i pod oppure TTL basso.

## Metriche / p95

Log strutturati (logger `territory.lakehouse.metrics`):

```text
lakehouse_op op=silver_assets_bbox ok=True duration_ms=42.3 municipalities=12 limit=800
lakehouse_op op=gold_read ok=True duration_ms=18.1 zoom_band=grid_13 municipalities=12
```

**Alert (indicativi):**

- p95 `duration_ms` viewport silver/gold > soglia concordata per 15 min
- rate `ok=False` o 5xx green endpoints
- errori S3/DuckDB ripetuti

## Retention MinIO

Script: `infrastructure/scripts/database/lakehouse/apply_lakehouse_lifecycle.sh`

- Scade oggetti sotto `green_assets/`, `green_areas/`, `green_assets_clusters/` dopo `RETENTION_DAYS` (default **90**)
- **Non** tocca `_catalog/`
- Attenzione: non lasciare un comune senza alcun ingest leggibile nel range UI tipico (12 mesi FE → retention ≥ 365 se serve storico lungo)

```bash
RETENTION_DAYS=90 ./infrastructure/scripts/database/lakehouse/apply_lakehouse_lifecycle.sh
```

## H3 / griglia alternativa

**Non in V1.** Bande gold `municipality` + `grid_13`…`grid_18`. Rivalutare solo se p95 insufficiente.

## Checklist ops

- [ ] TTL catalog in `.env` / deploy
- [ ] Job seed chiama invalidate (o TTL ≤ 60 s)
- [ ] Log `lakehouse_op` ingeriti; alert p95
- [ ] ILM retention su bucket non-prod poi prod
- [ ] MinIO always-on in compose (no profile)
