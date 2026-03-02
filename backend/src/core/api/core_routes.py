"""Core API routes: health, root (no prefix)."""

from fastapi import APIRouter

router = APIRouter(tags=["core"])


@router.get("/health")
async def health_check():
    """Healthcheck for Docker/Kubernetes."""
    return {"status": "healthy", "service": "tree-cadastre-backend"}


@router.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Tree Cadastre API",
        "docs": "/docs",
        "health": "/health",
    }
