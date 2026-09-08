"""Shared viewport cluster DTO for green assets serving (lakehouse / UI)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ViewportCluster:
    """One aggregate for the viewport endpoint (grid cell or admin unit).

    Grid clusters carry the centroid in Web Mercator (merc_x/merc_y); admin
    clusters carry it as lon/lat and a stable admin_key (e.g. "R12", "P12_58").
    """

    cell_x: int
    cell_y: int
    count: int
    merc_x: float
    merc_y: float
    bbox: tuple[float, float, float, float]
    sample_id: int
    admin_key: str | None = None
    lon: float | None = None
    lat: float | None = None
