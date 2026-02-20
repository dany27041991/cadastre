"""
Tree Cadastre - Backend API
FastAPI multi-tenant for geospatial green asset management.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from territory import router as territory_router
from core.config import settings
from core.middleware import add_gzip_middleware

app = FastAPI(
    title="Tree Cadastre API",
    description="Multi-tenant GIS API for green asset cadastre",
    version="0.1.0",
)

add_gzip_middleware(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(territory_router)


@app.get("/health")
async def health_check():
    """Healthcheck for Docker/Kubernetes."""
    return {"status": "healthy", "service": "tree-cadastre-backend"}


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Tree Cadastre API",
        "docs": "/docs",
        "health": "/health",
    }
