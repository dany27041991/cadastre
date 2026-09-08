"""Soft-cap gate for exact cluster aggregation under draw clip_wkt."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Sequence

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class ClipExactCapDecision:
    """Whether silver∩clip aggregation is allowed, plus municipality prune list."""

    eligible: bool
    municipality_ids: tuple[int, ...]
    km2: float
    reason: str | None = None


def approx_clip_km2(clip_geom) -> float:
    """Rough geodesic-ish area from WGS84 degrees (Italy latitudes)."""
    minx, miny, maxx, maxy = clip_geom.bounds
    lat = (miny + maxy) / 2.0
    return float(clip_geom.area) * (111.32**2) * abs(math.cos(math.radians(lat)))


def municipalities_intersecting_clip(
    session: Session,
    clip_wkt: str,
    *,
    limit: int = 500,
    candidate_ids: Sequence[int] | None = None,
) -> list[int]:
    """Return municipality ids whose geometry intersects clip (capped)."""
    if candidate_ids is not None and not candidate_ids:
        return []
    if candidate_ids is not None:
        rows = session.execute(
            text(
                """
                SELECT m.id
                FROM public.municipalities m
                WHERE m.geometry IS NOT NULL
                  AND m.id = ANY(:ids)
                  AND ST_Intersects(m.geometry, ST_GeomFromText(:wkt, 4326))
                LIMIT :lim
                """
            ),
            {
                "wkt": clip_wkt,
                "lim": int(limit),
                "ids": [int(i) for i in candidate_ids],
            },
        ).fetchall()
    else:
        rows = session.execute(
            text(
                """
                SELECT m.id
                FROM public.municipalities m
                WHERE m.geometry IS NOT NULL
                  AND ST_Intersects(m.geometry, ST_GeomFromText(:wkt, 4326))
                LIMIT :lim
                """
            ),
            {"wkt": clip_wkt, "lim": int(limit)},
        ).fetchall()
    return [int(r[0]) for r in rows]


def municipalities_intersecting_bbox(
    session: Session,
    bbox: tuple[float, float, float, float],
    *,
    limit: int = 10_000,
    candidate_ids: Sequence[int] | None = None,
) -> list[int]:
    """Return municipality ids intersecting a WGS84 viewport bbox (capped).

    Prefer ``candidate_ids`` (lakehouse catalog) so a nationwide bbox does not
    truncate via LIMIT against ~8k Italian municipalities and drop whole regions.
    """
    if candidate_ids is not None and not candidate_ids:
        return []
    minx, miny, maxx, maxy = bbox
    params = {
        "minx": float(minx),
        "miny": float(miny),
        "maxx": float(maxx),
        "maxy": float(maxy),
        "lim": int(limit),
    }
    if candidate_ids is not None:
        params["ids"] = [int(i) for i in candidate_ids]
        rows = session.execute(
            text(
                """
                SELECT m.id
                FROM public.municipalities m
                WHERE m.geometry IS NOT NULL
                  AND m.id = ANY(:ids)
                  AND ST_Intersects(
                        m.geometry,
                        ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326)
                      )
                LIMIT :lim
                """
            ),
            params,
        ).fetchall()
    else:
        rows = session.execute(
            text(
                """
                SELECT m.id
                FROM public.municipalities m
                WHERE m.geometry IS NOT NULL
                  AND ST_Intersects(
                        m.geometry,
                        ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326)
                      )
                LIMIT :lim
                """
            ),
            params,
        ).fetchall()
    return [int(r[0]) for r in rows]


def evaluate_clip_exact_cap(
    session: Session,
    clip_geom,
    clip_wkt: str,
    *,
    max_municipalities: int,
    max_km2: float,
    enabled: bool = True,
) -> ClipExactCapDecision:
    """Fail-fast soft cap before silver scan (design option A)."""
    if not enabled:
        return ClipExactCapDecision(
            eligible=False,
            municipality_ids=(),
            km2=0.0,
            reason="disabled",
        )
    km2 = approx_clip_km2(clip_geom)
    if km2 > max_km2:
        return ClipExactCapDecision(
            eligible=False,
            municipality_ids=(),
            km2=km2,
            reason="km2",
        )
    # Fetch one more than max to detect over-cap without full national scan cost.
    ids = municipalities_intersecting_clip(
        session, clip_wkt, limit=max_municipalities + 1
    )
    if len(ids) > max_municipalities:
        return ClipExactCapDecision(
            eligible=False,
            municipality_ids=tuple(ids[:max_municipalities]),
            km2=km2,
            reason="municipalities",
        )
    if not ids:
        return ClipExactCapDecision(
            eligible=True,
            municipality_ids=(),
            km2=km2,
            reason=None,
        )
    return ClipExactCapDecision(
        eligible=True,
        municipality_ids=tuple(ids),
        km2=km2,
        reason=None,
    )


def filter_resolutions_by_municipality_ids(
    resolutions: Sequence,
    municipality_ids: Sequence[int],
) -> list:
    """Keep lakehouse resolutions whose municipality_id is in the prune set."""
    if not municipality_ids:
        return []
    allow = {int(i) for i in municipality_ids}
    return [r for r in resolutions if int(r.municipality_id) in allow]
