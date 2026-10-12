"""Helper functions for scoping viewport and clip operations."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import func, select

from territory.assets.infrastructure.repository.viewport_cluster import ViewportCluster
from territory.common.infrastructure.lakehouse import silver_read
from territory.geo.domain.entities.sub_municipal_area_model import SubMunicipalAreaModel

if TYPE_CHECKING:
    from collections.abc import Callable

    from sqlalchemy.orm import Session


def municipality_ids_for_view(
    session_factory: Callable[[], Session],
    resolutions_callback,
    *,
    bbox: tuple[float, float, float, float],
    clip_wkt: str | None,
    municipality_id: int | None,
    region_id: int | None = None,
    province_id: int | None = None,
) -> list[int] | None:
    """Prune lakehouse files to municipalities intersecting clip or viewport.

    Intersects PostGIS against **catalog** municipality ids (not a LIMIT on
    all Italian comuni). A nationwide LIMIT 500 previously dropped whole
    regions outside the first N rows.
    """
    if municipality_id is not None:
        return None  # resolve_prefixes already scopes to the single id
    from territory.common.infrastructure.lakehouse import clip_exact

    # Catalog candidates in the date window (scoped by region/province if set).
    catalog = resolutions_callback(
        region_id=region_id,
        province_id=province_id,
        municipality_id=None,
        municipality_ids=None,
    )
    candidates = [int(r.municipality_id) for r in catalog]
    if not candidates:
        return []
    with session_factory() as session:
        if clip_wkt:
            return clip_exact.municipalities_intersecting_clip(
                session,
                clip_wkt,
                limit=max(len(candidates), 1),
                candidate_ids=candidates,
            )
        return clip_exact.municipalities_intersecting_bbox(
            session,
            bbox,
            limit=max(len(candidates), 1),
            candidate_ids=candidates,
        )


def load_sub_municipal_geom(
    session_factory: Callable[[], Session],
    municipality_id: int,
    sub_municipal_area_id: int,
):
    from shapely import wkb as shapely_wkb

    stmt = (
        select(func.ST_AsBinary(SubMunicipalAreaModel.geometry))
        .where(SubMunicipalAreaModel.id == sub_municipal_area_id)
        .where(SubMunicipalAreaModel.municipality_id == municipality_id)
        .where(SubMunicipalAreaModel.geometry.isnot(None))
        .limit(1)
    )
    with session_factory() as session:
        raw = session.execute(stmt).scalar()
    if raw is None:
        return None
    try:
        return shapely_wkb.loads(bytes(raw))
    except Exception:
        return None


def resolve_clip_geom(
    session_factory: Callable[[], Session],
    *,
    municipality_id: int | None,
    sub_municipal_area_id: int | None,
    clip_wkt: str | None,
):
    """Combine draw clip + sub-municipal geometry; empty → sentinel None (caller returns empty)."""
    clip_geom = silver_read._parse_clip_geom(clip_wkt)
    if sub_municipal_area_id is not None:
        if municipality_id is None:
            return None
        sub = load_sub_municipal_geom(session_factory, municipality_id, sub_municipal_area_id)
        if sub is None:
            return None
        clip_geom = sub if clip_geom is None else clip_geom.intersection(sub)
        if clip_geom is None or clip_geom.is_empty:
            return None
    return clip_geom


def filter_clusters_by_clip(
    clusters: list[ViewportCluster],
    clip_geom,
) -> list[ViewportCluster]:
    if clip_geom is None:
        return clusters
    from shapely.geometry import Point, box

    out: list[ViewportCluster] = []
    for c in clusters:
        if c.lon is not None and c.lat is not None:
            if clip_geom.intersects(Point(float(c.lon), float(c.lat))):
                out.append(c)
            continue
        # Grid clusters: keep if cell envelope intersects clip.
        try:
            if box(c.bbox[0], c.bbox[1], c.bbox[2], c.bbox[3]).intersects(clip_geom):
                out.append(c)
        except Exception:
            continue
    return out
