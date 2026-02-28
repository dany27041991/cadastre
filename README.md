# Municipal Arboreal Cadastre - Platform

National SaaS webapp for census and management of geospatial green assets of Italian municipalities.

## Architecture

- **PostgreSQL + PostGIS**: geospatial database with partitioning by ISTAT code
- **PgBouncer**: connection pooling for thousands of connections
- **Redis**: cache for frequent queries
- **FastAPI**: multi-tenant backend with JWT authentication
- **React + OpenLayers + OSM**: frontend with interactive map
- **ClickHouse**: OLAP analytics
- **PgAdmin**: DB management (optional)

## Quick start

### 1. Configuration

```bash
# Copy the example environment file (in infrastructure/compose)
cp infrastructure/compose/.env.example infrastructure/compose/.env

# Edit infrastructure/compose/.env with secure values (required for production)
# - POSTGRES_PASSWORD
# - JWT_SECRET_KEY
```

To generate secure secrets:

```bash
openssl rand -hex 32
```

### 2. Start with Docker Compose

Compose and environment variables are in `infrastructure/compose/`. Start from there:

```bash
cd infrastructure/compose
docker compose up -d

# With PgAdmin (useful for development/debug)
docker compose --profile tools up -d
```

### 3. Check status

```bash
cd infrastructure/compose && docker compose ps
```

### 4. Service URLs

| Service    | URL                    | Notes                |
|------------|------------------------|---------------------|
| Frontend   | http://localhost:5173  | OpenLayers map      |
| Backend API | http://localhost:8000 | Swagger: /docs      |
| PgAdmin    | http://localhost:5050  | Only with `--profile tools` |
| ClickHouse | localhost:8123         | HTTP interface      |

## Stop and cleanup

```bash
cd infrastructure/compose
# Stop services
docker compose down

# Stop + remove volumes
docker compose down -v
```

## Kubernetes deployment

The architecture is ready for Kubernetes:

- Persistent volumes for PostGIS, Redis, ClickHouse
- Healthchecks on all containers
- Environment variables from Secret/ConfigMap
- Isolated network

Convert services to K8s manifests (Deployment, Service, Ingress) and use Secrets for credentials.

## Territorial tables (ISTAT)

On startup, reference tables are loaded from GeoJSON in `infrastructure/data/`:

- **regions** – from `region/regions.geojson`
- **provinces** – from `province/provinces.geojson`
- **municipalities** – from `municipality/municipalities.geojson`
- **sub_municipal_area** – from `submunicipal/area_submunicipal_lv1.geojson`, `lv2`, `lv3` (ISTAT ASC)
- **census_section** – from `section/sections.geojson` (sezioni di censimento e località)

The **init** service runs **run-init.sh**: schema (01–02), indexes (03–04), then **load_geojson.py** (populates the tables above), then partitions (06), then autovacuum tuning (05, on leaf partitions). Mount `infrastructure/data` at `/data` in the init container so that the GeoJSON files are available. If a file is missing, that entity is skipped (tables remain empty for that source).

**Manual execution** (from project root or compose context):
```bash
# Full init: schema + load GeoJSON + partitions (run init container once)
docker compose run --rm init sh /scripts/init/postgis/run-init.sh
# Or only reload territorial data (after stack is up):
docker compose run --rm init python3 /scripts/init/postgis/py/administrative_boundaries/load_geojson.py
```

## Notes

- **infrastructure/scripts/init/postgis**: `sql/` 01 (public schema), 02 (cadastre schema), 03 (indexes public), 04 (indexes cadastre), then **administrative_boundaries/load_geojson.py**, then 06 (partitions), then 05 (autovacuum on leaf partitions) are run by **run-init.sh**. GRANTs use `POSTGRES_USER` from `.env` (default `cadastre`); if you change it, update `sql/02-init-schema-cadastre.sql`. The cadastre tables use **sub_municipal_area_id**; backend and frontend use **sub_municipal_area** (sub-municipal areas) consistently.
- **Backend**: uses PgBouncer for queries; `DATABASE_DIRECT_URL` for migrations
- **Frontend**: `VITE_API_URL` must point to the backend (localhost in dev, public URL in prod)
