"""Shared FastAPI helpers for lakehouse temporal query params."""

from __future__ import annotations

from datetime import date

from fastapi import HTTPException


def parse_lakehouse_date_range(
    date_from: date | None,
    date_to: date | None,
) -> tuple[date, date]:
    """Require both ISO dates; validate range order."""
    if date_from is None or date_to is None:
        raise HTTPException(
            status_code=400,
            detail="date_from and date_to are required",
        )
    if date_from > date_to:
        raise HTTPException(status_code=400, detail="date_from must be <= date_to")
    return date_from, date_to
