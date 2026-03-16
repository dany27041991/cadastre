"""Core API routes: health, root (no prefix)."""

from fastapi import APIRouter

from core.logger import log_invocation

router = APIRouter(tags=["core"])


@router.get("/health")
@log_invocation(log_args=False, log_result=False)
async def health_check():
    """Healthcheck for Docker/Kubernetes."""
    return {"status": "healthy", "service": "tree-cadastre-backend"}


@router.get("/")
@log_invocation(log_args=False, log_result=False)
async def root():
    """Root endpoint."""
    return {
        "service": "Tree Cadastre API",
        "docs": "/docs",
        "health": "/health",
    }
