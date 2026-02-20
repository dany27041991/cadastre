"""Areas repository and wiring (use case factory)."""

from core.database import get_session

from territory.areas.application.usecases.query import CatalogGreenArea
from territory.areas.infrastructure.repository.green_areas_repository import (
    GreenAreasRepository,
)


def _green_areas_repository() -> GreenAreasRepository:
    return GreenAreasRepository(session_factory=get_session)


def get_green_areas_use_case() -> CatalogGreenArea:
    return CatalogGreenArea(_green_areas_repository())


__all__ = ["GreenAreasRepository", "get_green_areas_use_case"]
