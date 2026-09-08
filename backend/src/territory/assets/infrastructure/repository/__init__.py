"""Assets repository and wiring (use case factory)."""

from __future__ import annotations

from datetime import date

from territory.assets.infrastructure.repository.green_assets_lakehouse_repository import (
    GreenAssetsLakehouseRepository,
)

GreenAssetsRepositoryPort = GreenAssetsLakehouseRepository


def _green_assets_repository(
    *,
    date_from: date | None = None,
    date_to: date | None = None,
) -> GreenAssetsRepositoryPort:
    from core.database import get_session

    return GreenAssetsLakehouseRepository(
        session_factory=get_session,
        date_from=date_from,
        date_to=date_to,
    )


def get_green_assets_use_case(
    *,
    date_from: date | None = None,
    date_to: date | None = None,
):
    from territory.assets.application.usecases.query import CatalogGreenAsset

    return CatalogGreenAsset(
        _green_assets_repository(date_from=date_from, date_to=date_to),
    )


__all__ = [
    "GreenAssetsLakehouseRepository",
    "GreenAssetsRepositoryPort",
    "get_green_assets_use_case",
]
