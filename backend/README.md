# Backend

- **Run API (from backend/):** `PYTHONPATH=src uvicorn main:app --reload`  
  Or: `cd src && uvicorn main:app --reload`
- **Docker:** build from `backend/`; the image sets `WORKDIR /app/src` and runs `uvicorn main:app`.
- **Green SoR:** lakehouse MinIO + DuckDB (`*LakehouseRepository`); PostGIS = admin/OBT only.

Structure: **src/** contains `main.py`, `core/` (config, container, api), `shared/`, `territory/` (geo, areas, assets). See [docs/design/folders-structure-be.md](docs/design/folders-structure-be.md).
