"""Assets repository and wiring (use case factory)."""

from core.database import get_session

from territory.assets.application.usecases.query import CatalogGreenAsset
from territory.assets.infrastructure.repository.green_assets_repository import (
    GreenAssetsRepository,
)


def _green_assets_repository() -> GreenAssetsRepository:
    return GreenAssetsRepository(session_factory=get_session)


def get_green_assets_use_case() -> CatalogGreenAsset:
    return CatalogGreenAsset(_green_assets_repository())


__all__ = ["GreenAssetsRepository", "get_green_assets_use_case"]
