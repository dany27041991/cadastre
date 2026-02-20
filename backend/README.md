# Backend

- **Run API (from backend/):** `PYTHONPATH=src uvicorn main:app --reload`  
  Or: `cd src && uvicorn main:app --reload`
- **Docker:** build from `backend/`; the image sets `WORKDIR /app/src` and runs `uvicorn main:app`.

Structure: **src/** contains `main.py`, `core/` (config, container, api), `shared/`, `territory/` (geo, areas, assets). See [docs/folders-structure-be.md](docs/folders-structure-be.md).
