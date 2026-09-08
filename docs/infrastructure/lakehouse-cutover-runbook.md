# Runbook — Lakehouse-only green (wipe & recreate)

**Design:** [../design/2026-09-04-green-lakehouse-only-pg-drop-design.md](../design/2026-09-04-green-lakehouse-only-pg-drop-design.md)  
**Plan:** [../design/2026-09-04-green-lakehouse-only-pg-drop-plan.md](../design/2026-09-04-green-lakehouse-only-pg-drop-plan.md)  
**Infra MinIO:** [minio-lakehouse.md](./minio-lakehouse.md)  
**Layout Parquet:** [lakehouse-parquet-layout.md](./lakehouse-parquet-layout.md)

## Obiettivo

Servire la **visualizzazione** green (viewport / table / detail) **solo** da MinIO+DuckDB. PostGIS non ha più tabelle `green_*` / history / matview. Ambiente di sviluppo: **wipe & recreate**, niente migration ALTER.

## Cosa cambia / cosa no

| Path | Comportamento |
|------|----------------|
| Green assets/areas **viewport, table, detail** | Lakehouse (catalog → silver/gold) |
| Territori admin (regioni, province, comuni, …) | **PostGIS** (invariato) |
| Auth / Geoinsight / draw clip WKT | Invariati; `clip_wkt` = prefilter bbox (V1) |
| Date `date_from` / `date_to` | **Sempre obbligatorie** sulle API green |

## Prerequisiti locale

1. Compose always-on (MinIO + PostGIS + backend) — `docker compose up -d` dalla cartella compose.
2. Vars `LAKEHOUSE_S3_*` in `.env` (vedi `.env.example`).
3. Bucket popolato via **seed** lakehouse (Lecce / boost), non export-from-PG.
4. Catalog `_catalog/municipality_ingests.parquet` aggiornato.
5. FE con range date InfoPanel (T5).

## Procedura locale (dev)

```bash
cd cadastre/infrastructure/compose
docker compose down -v
docker compose up -d

# Attendi init PostGIS (admin boundaries) + minio-init
# Poi seed green → MinIO (vedi seed/README.md), es.:
../../scripts/database/seed/run_populate_lecce.sh
```

Verifica: Accendi Assets Verdi / Aree gestite, range date default 12 mesi → cluster/raw/tabella sul comune seedato.

## Checklist smoke

- [ ] `GET .../green-assets/viewport?...&date_from=&date_to=` → 200, feature/cluster attesi
- [ ] Zoom basso → gold clusters; zoom alto → silver raw
- [ ] Table areas/assets con stesso territorio + date → righe coerenti
- [ ] Detail asset/area → 200 o 404 solo se assente nel mosaico
- [ ] Draw-on-map + clip: niente nationwide leak
- [ ] Area Italia + navigazione admin (PostGIS) invariata
- [ ] Assenza date → 400 esplicito
- [ ] Nessuna tabella `cadastre.green_*` in PostGIS

## Monitoraggio

| Segnale | Dove |
|---------|------|
| 5xx su `/api/territory/green-*` | access/error log API |
| 400 `date_from`/`date_to` | log API |
| Latenza p95 viewport | APM / log `lakehouse_op` |
| Errori DuckDB / S3 | log `silver_read` / `gold_read` |
| MinIO health | console `:9001` / probe |

Dettaglio hardening: [lakehouse-hardening.md](./lakehouse-hardening.md).

## Rollback

1. `git revert` del cutover (o checkout branch precedente).
2. `docker compose down -v && up -d` (wipe volumi).
3. **Niente** feature flag OFF — il path PostGIS green non esiste più.

## Dopo cutover stabile

- Seed/job ingest scrive sempre MinIO (silver + gold + catalog).
- Invalidare cache catalog post-seed (`POST .../lakehouse/catalog/invalidate` o TTL).
