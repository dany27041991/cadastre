# Backend – Folder structure and Clean Architecture

The backend uses a **src layout**: all application source code lives under **backend/src/** (main entrypoint, **core**, **territory**, **shared**). Three **main modules**: **territory**, **shared**, **core**. Under **territory**, each submodule (**geo**, **areas**, **assets**) has the **three Clean Architecture layers**: **domain**, **application**, **infrastructure**. **core** is separate from shared and contains **api** (HTTP wiring). **GeoJSONFeatureCollection** and the GeoJSON mapper live in **territory/geo** (domain/entities, infrastructure/mapper); **shared** is reserved for future cross-cutting types. Each submodule owns its own domain, application and infrastructure (including repository and routes).

---

## Main modules

| Module     | Role |
|------------|------|
| **territory/** | Territory context: submodules **geo**, **areas**, **assets**, each with **domain**, **application**, **infrastructure**. |
| **shared/**    | Reserved for future cross-cutting types. GeoJSONFeatureCollection and GeoJSON mapper live in **territory/geo** (domain/entities, infrastructure/mapper). |
| **core/**      | Configuration, DI container, and **api** (dependencies for routes, optional router composition). |

Dependencies: **territory** submodules (areas, assets) → **territory.geo.domain.entities** for GeoJSON type; territory repositories → **territory.geo.infrastructure.mapper**. **core** depends on **shared** (config, container) and **territory** (routers, use cases). **shared** does not depend on core or territory.

---

## Recommended structure

Each of **geo**, **areas** and **assets** has the three Clean Architecture layers: **domain**, **application**, **infrastructure**. Under **domain** each submodule has **entities/**. Under **application**: **usecases** (with **query** and **command**); no ports (Clean Architecture “soft”: use cases use concrete repositories). Under **infrastructure**: **dto** (with **input/** and **output/**), **repository** (persistence adapters), and **web** (HTTP routes).

```
backend/
│
├── src/                                   # Application source (src layout)
│   ├── main.py                            # FastAPI app, include_router(territory.router)
│   │
│   ├── shared/                            # Reserved for future cross-cutting types (empty for now)
│   │   └── __init__.py
│   │
│   ├── core/                              # Main module: config, DI, api
│   │   ├── __init__.py
│   │   ├── config.py                     # Settings (DB, CORS, etc.)
│   │   ├── database/                     # Session factory, Base (SQLAlchemy)
│   │   │   └── __init__.py
│   │   ├── builders/                     # Feature collection builder (GeoJSON)
│   │   │   ├── __init__.py
│   │   │   └── feature_collection_builder.py
│   │   ├── middleware/
│   │   │   └── __init__.py
│   │   └── api/
│   │       ├── __init__.py
│   │       ├── container.py              # DI: creates repositories and use cases
│   │       └── dependencies.py           # Use case factories for routes (uses container)
│   │
│   └── territory/                        # Main module: each submodule has domain, application, infrastructure
│   ├── __init__.py                        # Barrel: exposes composed router (geo + areas + assets)
│   ├── geo/                               # Submodule: administrative hierarchy
│   │   ├── __init__.py
│   │   ├── domain/                        # Layer: entities, value objects
│   │   │   ├── __init__.py
│   │   │   └── entities/                  # Geo entities + GeoJSONFeatureCollection (in __init__.py)
│   │   │       ├── __init__.py            # GeoJSONFeatureCollection type + re-exports models
│   │   │       ├── region_model.py
│   │   │       ├── province_model.py
│   │   │       ├── municipality_model.py
│   │   │       └── sub_municipal_area_model.py
│   │   ├── application/                  # Layer: usecases (query / command), no ports (soft CA)
│   │   │   ├── __init__.py
│   │   │   └── usecases/
│   │   │       ├── __init__.py
│   │   │       ├── query/                  # Read use cases (e.g. CatalogRegion, CatalogProvincesByRegion)
│   │   │       │   ├── __init__.py
│   │   │       │   ├── cache/              # Cache layer: catalog_*_cache.py + __init__.py
│   │   │       │   │   ├── __init__.py
│   │   │       │   │   ├── catalog_regions_cache.py
│   │   │       │   │   ├── catalog_provinces_by_region_cache.py
│   │   │       │   │   ├── catalog_municipalities_by_province_cache.py
│   │   │       │   │   └── catalog_sub_municipal_areas_by_municipality_cache.py
│   │   │       │   ├── catalog_regions.py
│   │   │       │   ├── catalog_provinces_by_region.py
│   │   │       │   ├── catalog_municipalities_by_province.py
│   │   │       │   └── catalog_sub_municipal_areas_by_municipality.py
│   │   │       └── command/                # Write use cases (if any)
│   │   │           └── __init__.py
│   │   └── infrastructure/               # Layer: dto (input/output), repository, web, mapper
│   │       ├── __init__.py
│   │       ├── dto/                        # Data transfer objects (request/response shapes)
│   │       │   ├── __init__.py
│   │       │   ├── input/                  # Request DTOs
│   │       │   │   └── __init__.py
│   │       │   └── output/                 # Response DTOs
│   │       │       └── __init__.py
│   │       ├── mapper/                    # GeoJSON: build_*_feature_collection (used by geo, areas, assets repos)
│   │       │   ├── __init__.py
│   │       │   └── feature_collection_mapper.py
│   │       ├── repository/                # Persistence adapters
│   │       │   ├── __init__.py
│   │       │   ├── region_repository.py
│   │       │   ├── province_repository.py
│   │       │   ├── municipality_repository.py
│   │       │   └── sub_municipal_area_repository.py
│   │       └── web/                        # HTTP adapters (one router per resource)
│   │           ├── __init__.py
│   │           ├── region_ctrl.py
│   │           ├── province_ctrl.py
│   │           ├── municipality_ctrl.py
│   │           └── sub_municipal_area_ctrl.py
│   ├── areas/                             # Submodule: green areas
│   │   ├── __init__.py
│   │   ├── domain/
│   │   │   ├── __init__.py
│   │   │   └── entities/
│   │   │       └── __init__.py             # no PostGIS ORM (lakehouse-only)
│   │   ├── application/
│   │   │   ├── __init__.py
│   │   │   └── usecases/
│   │   │       ├── __init__.py
│   │   │       ├── query/                  # e.g. CatalogGreenArea
│   │   │       │   ├── __init__.py
│   │   │       │   ├── cache/              # Cache layer: catalog_green_area_cache.py + __init__.py
│   │   │       │   │   ├── __init__.py
│   │   │       │   │   └── catalog_green_area_cache.py
│   │   │       │   └── catalog_green_area.py
│   │   │       └── command/
│   │   │           └── __init__.py
│   │   └── infrastructure/
│   │       ├── __init__.py
│   │       ├── dto/
│   │       │   ├── __init__.py
│   │       │   ├── input/
│   │       │   │   └── __init__.py
│   │       │   └── output/
│   │       │       └── __init__.py
│   │       ├── mapper/
│   │       │   ├── __init__.py
│   │       │   └── green_area_feature_collection_mapper.py
│   │       ├── repository/
│   │       │   ├── __init__.py
│   │       │   └── green_areas_lakehouse_repository.py
│   │       └── web/
│   │           ├── __init__.py
│   │           └── green_area_ctrl.py      # GET /green-areas
│   └── assets/                            # Submodule: green assets
│       ├── __init__.py
│       ├── domain/
│       │   ├── __init__.py
│       │   └── entities/
│       │       └── __init__.py             # no PostGIS ORM (lakehouse-only)
│       ├── application/
│       │   ├── __init__.py
│       │   └── usecases/
│       │       ├── __init__.py
│       │       ├── query/                  # e.g. CatalogGreenAsset
│       │       │   ├── __init__.py
│       │       │   ├── cache/              # Cache layer: catalog_green_asset_cache.py + __init__.py
│       │       │   │   ├── __init__.py
│       │       │   │   └── catalog_green_asset_cache.py
│       │       │   └── catalog_green_asset.py
│       │       └── command/
│       │           └── __init__.py
│       └── infrastructure/
│           ├── __init__.py
│           ├── dto/
│           │   ├── __init__.py
│           │   ├── input/
│           │   │   └── __init__.py
│           │   └── output/
│           │       └── __init__.py
│           ├── mapper/
│           │   ├── __init__.py
│           │   └── green_asset_feature_collection_mapper.py
│           ├── repository/
│           │   ├── __init__.py
│           │   └── green_assets_lakehouse_repository.py
│           └── web/
│               ├── __init__.py
│               └── green_asset_ctrl.py     # GET /green-assets
│
├── common/infrastructure/lakehouse/       # DuckDB + MinIO catalog/silver/gold
├── requirements.txt
├── Dockerfile
└── README.md
```

---

## Clean Architecture – Where things live

Inside each submodule (**geo**, **areas**, **assets**) the three layers are:

| Layer          | Location (per submodule) | Contents |
|----------------|---------------------------|----------|
| **Domain**     | **territory/{geo,areas,assets}/domain/**   | **entities/** (entities, value objects); **geo** defines **GeoJSONFeatureCollection**; areas/assets re-export from **territory.geo.domain.entities**. |
| **Application**| **territory/{geo,areas,assets}/application/** | **usecases/query/** (read use cases; **query/cache/** holds cache logic for catalog use cases: regions, provinces, municipalities, sub-municipal areas, green areas, green assets), **usecases/command/** (write use cases). Use cases depend on domain and concrete repositories (infrastructure); catalog query use cases delegate to **query/cache/** for cached reads. |
| **Infrastructure** | **territory/{geo,areas,assets}/infrastructure/** | **dto/** (with **input/** and **output/** for request/response shapes), **repository/** (PostGIS), **web/** (HTTP routes). Geo/areas/assets repos use **territory.geo.infrastructure.mapper** (rows_to_geojson). |

| Cross-cutting   | Location |
|-----------------|----------|
| GeoJSON type   | **territory.geo.domain.entities** (GeoJSONFeatureCollection; areas/assets import from here). |
| GeoJSON mapper  | **territory.geo.infrastructure.mapper** (rows_to_geojson; used by all territory repositories). |
| Config and DI   | **core** (config.py, api/container.py, database/). Container wires territory.*.application.usecases with territory.*.infrastructure.repositories. |
| API (deps)      | **core.api.dependencies**: use case factories for route handlers. |

Dependencies: **territory** submodules → **territory.geo.domain.entities** (GeoJSON type); territory repositories → **territory.geo.infrastructure.mapper**. **core** → **shared** and **territory** (routers, use cases, repositories). **shared** does not depend on core or territory.

---

## Conventions

### 1. **shared/** (no core)

- **shared/** is reserved for future cross-cutting types. **GeoJSONFeatureCollection** and the GeoJSON mapper live in **territory/geo** (domain/entities, infrastructure/mapper).

### 2. **core/** (main module: config, DI, api)

- **config.py**: environment variables (DB, CORS, etc.).
- **database/**: session factory and SQLAlchemy Base; used by territory repositories.
- **builders/**: `build_feature_collection` for GeoJSON; used by territory.geo (and areas, assets) mappers.
- **api/container.py**: creates repositories (from **territory.*.infrastructure**) and use cases (from **territory.*.application.usecases**); used by **core.api.dependencies**.
- **api/dependencies.py**: use case factories for route handlers (e.g. `get_regions_use_case()`), imported by territory infrastructure routes (e.g. `from core.api.dependencies import get_regions_uc`).

### 3. **territory/** (main module: each submodule has 3 layers)

- **__init__.py**: exposes a single `router` with prefix `/api/territory` that includes geo, areas and assets routers (from each submodule’s **infrastructure/web/**).
- **geo/**, **areas/**, **assets/**: three submodules. In each:
  - **domain/entities/**: geo entities (e.g. **region_model.py**); green areas/assets **non** hanno ORM PostGIS (SoR = lakehouse MinIO). **geo** defines **GeoJSONFeatureCollection** in **entities/__init__.py**.
  - **application/**: **usecases/query/** (read use cases, e.g. CatalogRegion, CatalogGreenArea); **usecases/query/cache/** (cache layer: per-catalog modules with get_cached_*, invalidate_cache; use cases delegate to cache for cached catalog data); **usecases/command/** (write use cases, if any). Use cases receive the concrete repository in the constructor (injected by container).
  - **infrastructure/**: **dto/** with **input/** and **output/**; **repository/** (geo = PostGIS; areas/assets = `*LakehouseRepository` via DuckDB/MinIO); **mapper/** (geo: feature_collection_mapper; areas/assets: green_area/asset_feature_collection_mapper); **web/** (FastAPI controllers: geo uses **region_ctrl.py**, **province_ctrl.py**, etc.; areas **green_area_ctrl.py**; assets **green_asset_ctrl.py**; all use **core.api.dependencies** for use cases). Shared lakehouse: **territory/common/infrastructure/lakehouse/**.

### 4. **main.py** (under **src/**)

- Creates the FastAPI app, mounts the router from **territory** (e.g. `from territory.router import router as territory_router`; `app.include_router(territory_router)`).
- **Local run:** from **backend/** run `uvicorn main:app --reload` with `PYTHONPATH=src` (e.g. `PYTHONPATH=src uvicorn main:app --reload`), or `cd src && uvicorn main:app --reload`. The Dockerfile sets `WORKDIR /app/src` so the container runs from the equivalent of **src/**.

### 5. **Language**

- Code and comments in **English** (routes, parameters, HTTP messages).

---

## Summary

| Module / Submodule | Role |
|--------------------|------|
| **shared**         | Reserved for future cross-cutting types. GeoJSON type and mapper are in **territory/geo**. Core is outside shared. |
| **core**           | Main module: config, DI container, **api** (dependencies for route handlers). |
| **core/api**       | Use case factories (dependencies.py) used by territory infrastructure routes. |
| **territory**      | Main territory module: composed router and three submodules, each with **domain**, **application**, **infrastructure**. |
| **territory/geo**  | Administrative hierarchy: **domain/entities**, **application** (usecases), **infrastructure** (dto/input, dto/output, repository, web). |
| **territory/areas**| Green areas: **domain/entities**, **application** (usecases), **infrastructure** (dto/input, dto/output, repository, web). |
| **territory/assets** | Green assets: **domain/entities**, **application** (usecases), **infrastructure** (dto/input, dto/output, repository, web). |

Three main modules (**territory**, **shared**, **core**). Each of **geo**, **areas** and **assets** has the three Clean Architecture layers in version “soft” (no ports): **domain** (with **entities/**), **application** (usecases/query, usecases/command; use cases use concrete repositories), **infrastructure** (**dto/input/**, **dto/output/**, **repository/** for persistence, **web/** for HTTP; **geo** also has **mapper/**). **shared** is reserved for future use.
