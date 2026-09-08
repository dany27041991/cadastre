"""Areas repository and wiring (use case factory)."""

from __future__ import annotations

from datetime import date

from territory.areas.infrastructure.repository.green_areas_lakehouse_repository import (
    GreenAreasLakehouseRepository,
)

GreenAreasRepositoryPort = GreenAreasLakehouseRepository


def _green_areas_repository(
    *,
    date_from: date | None = None,
    date_to: date | None = None,
) -> GreenAreasRepositoryPort:
    from core.database import get_session

    return GreenAreasLakehouseRepository(
        session_factory=get_session,
        date_from=date_from,
        date_to=date_to,
    )


def get_green_areas_use_case(
    *,
    date_from: date | None = None,
    date_to: date | None = None,
):
    from territory.areas.application.usecases.query import CatalogGreenArea

    return CatalogGreenArea(
        _green_areas_repository(date_from=date_from, date_to=date_to),
    )


__all__ = [
    "GreenAreasLakehouseRepository",
    "GreenAreasRepositoryPort",
    "get_green_areas_use_case",
]
