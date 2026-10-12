"""Paginated table response shared by green-assets and green-areas /table endpoints."""

from __future__ import annotations

import math
from typing import Any

from pydantic import BaseModel


class GreenTablePageOut(BaseModel):
    """Server-side paginated table response (no geometry)."""

    data: list[dict[str, Any]]
    total: int
    page: int
    page_size: int
    total_pages: int
    # When false, total is a has_more lower bound (FE shows "di …").
    total_exact: bool = True

    @classmethod
    def build(
        cls,
        data: list[dict[str, Any]],
        total: int,
        page: int,
        page_size: int,
        *,
        total_exact: bool = True,
    ) -> "GreenTablePageOut":
        total_pages = max(1, math.ceil(total / page_size))
        return cls(
            data=data,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            total_exact=total_exact,
        )
