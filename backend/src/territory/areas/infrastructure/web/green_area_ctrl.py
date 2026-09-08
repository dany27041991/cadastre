"""Green areas HTTP routes."""

from __future__ import annotations

from datetime import date
from typing import Literal

import geobuf

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from core.api.dependencies import get_green_areas_uc
from territory.areas.infrastructure.dto.output import GreenAreasOutput
from territory.common.infrastructure.clip_wkt import ClipWktError, normalize_clip_wkt
from territory.common.infrastructure.dto.green_detail_out import GreenDetailOut
from territory.common.infrastructure.green_table_page_out import GreenTablePageOut
from territory.common.infrastructure.lakehouse.http_dates import parse_lakehouse_date_range

router = APIRouter(tags=["territory-areas"])

GEOBUF_MEDIA_TYPE = "application/x-geobuf"

_EMPTY_GEOBUF = geobuf.encode({"type": "FeatureCollection", "features": []})


def _clip_wkt_or_400(clip_wkt: str | None) -> str | None:
    try:
        return normalize_clip_wkt(clip_wkt)
    except ClipWktError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _empty_response(output_format: str | None) -> GreenAreasOutput | Response:
    if output_format == "geobuf":
        return Response(content=_EMPTY_GEOBUF, media_type=GEOBUF_MEDIA_TYPE)
    return GreenAreasOutput(features=[])


_DATE_FROM = Query(..., description="Ingest range start inclusive (ISO date, required)")
_DATE_TO = Query(..., description="Ingest range end inclusive (ISO date, required)")


def _uc(date_from: date, date_to: date):
    df, dt = parse_lakehouse_date_range(date_from, date_to)
    return get_green_areas_uc(date_from=df, date_to=dt)


@router.get("/green-areas", response_model=None)
def get_green_areas(
    region_id: int,
    province_id: int,
    parent_id: int | None = None,
    municipality_id: int | None = None,
    sub_municipal_area_id: int | None = None,
    contained_in_area_id: int | None = None,
    date_from: date = _DATE_FROM,
    date_to: date = _DATE_TO,
    # Renamed from `format` to avoid shadowing the Python built-in.
    output_format: str | None = Query(None, alias="format"),
) -> GreenAreasOutput | Response:
    """
    Return green areas (N-level hierarchy).
    - With contained_in_area_id: the chosen area first, then level+1 areas with real geodesic overlap
      (≥ 1 m²), not boundary-only adjacency.
    - With parent_id: children of that area (by parent_id).
    - Without: root areas for municipality_id (optionally filtered by sub_municipal_area_id).
    region_id and province_id required. Use ?format=geobuf for compact binary response.
    """
    if parent_id is None and municipality_id is None and contained_in_area_id is None:
        return _empty_response(output_format)

    result = _uc(date_from, date_to).catalog_green_areas(
        region_id,
        province_id=province_id,
        parent_id=parent_id,
        municipality_id=municipality_id,
        sub_municipal_area_id=sub_municipal_area_id,
        contained_in_area_id=contained_in_area_id,
    )

    if not result.get("features"):
        return _empty_response(output_format)

    if output_format == "geobuf":
        return Response(content=geobuf.encode(result), media_type=GEOBUF_MEDIA_TYPE)
    return GreenAreasOutput.model_validate(result)


@router.get("/green-areas/viewport", response_model=None)
def get_green_areas_viewport(
    bbox: str = Query(..., description="minLon,minLat,maxLon,maxLat (EPSG:4326)"),
    zoom: float = Query(..., ge=0, le=22),
    region_id: int | None = None,
    province_id: int | None = None,
    municipality_id: int | None = None,
    sub_municipal_area_id: int | None = None,
    clip_wkt: str | None = Query(None, description="EPSG:4326 POLYGON/MULTIPOLYGON WKT clip"),
    date_from: date = _DATE_FROM,
    date_to: date = _DATE_TO,
    output_format: str | None = Query(None, alias="format"),
) -> GreenAreasOutput | Response:
    """Viewport-sized root green areas for map rendering.

    Empty below the areas min zoom; otherwise polygons intersecting the bbox,
    simplified to display resolution and capped (largest areas first).
    Territory filters are optional: omit them for a nationwide view."""
    try:
        parts = [float(p) for p in bbox.split(",")]
    except ValueError:
        parts = []
    if len(parts) != 4:
        raise HTTPException(status_code=422, detail="bbox must be minLon,minLat,maxLon,maxLat")
    result = _uc(date_from, date_to).viewport_green_areas(
        (parts[0], parts[1], parts[2], parts[3]),
        zoom,
        region_id=region_id,
        province_id=province_id,
        municipality_id=municipality_id,
        sub_municipal_area_id=sub_municipal_area_id,
        clip_wkt=_clip_wkt_or_400(clip_wkt),
    )
    if not result.get("features"):
        return _empty_response(output_format)
    if output_format == "geobuf":
        return Response(content=geobuf.encode(result), media_type=GEOBUF_MEDIA_TYPE)
    return GreenAreasOutput.model_validate(result)


@router.get("/green-areas/table", response_model=GreenTablePageOut)
def get_green_areas_table(
    region_id: int | None = None,
    province_id: int | None = None,
    municipality_id: int | None = None,
    sub_municipal_area_id: int | None = None,
    contained_in_area_id: int | None = None,
    parent_id: int | None = None,
    area_id: int | None = None,
    clip_wkt: str | None = Query(None, description="EPSG:4326 POLYGON/MULTIPOLYGON WKT clip"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    sort_by: str | None = None,
    sort_dir: Literal["asc", "desc"] = "asc",
    q: str | None = None,
    geometry_type: str | None = None,
    administrative_status: str | None = None,
    operational_status: str | None = None,
    survey_status: str | None = None,
    level: int | None = None,
    name: str | None = None,
    zril_identifier: str | None = None,
    area_code: str | None = None,
    perimeter_type: str | None = None,
    intensity_of_fruition: str | None = None,
    area_classification: str | None = None,
    istat_classification: str | None = None,
    survey_date: str | None = None,
    surface_area_m2: str | None = None,
    date_from: date = _DATE_FROM,
    date_to: date = _DATE_TO,
) -> GreenTablePageOut:
    """Paginated, filtered and sorted green-areas table (no geometry)."""
    filters = {
        k: v
        for k, v in {
            "q": q,
            "geometry_type": geometry_type,
            "perimeter_type": perimeter_type,
            "administrative_status": administrative_status,
            "operational_status": operational_status,
            "survey_status": survey_status,
            "intensity_of_fruition": intensity_of_fruition,
            "area_classification": area_classification,
            "istat_classification": istat_classification,
            "level": level,
            "name": name,
            "zril_identifier": zril_identifier,
            "area_code": area_code,
            "survey_date": survey_date,
            "surface_area_m2": surface_area_m2,
        }.items()
        if v is not None
    }
    return _uc(date_from, date_to).list_green_areas_table_paged(
        region_id,
        province_id,
        municipality_id,
        sub_municipal_area_id=sub_municipal_area_id,
        contained_in_area_id=contained_in_area_id,
        parent_id=parent_id,
        area_id=area_id,
        clip_wkt=_clip_wkt_or_400(clip_wkt),
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_dir=sort_dir,
        filters=filters,
    )


# After static paths (viewport/table): otherwise {area_id} steals those segments → 422.
@router.get("/green-areas/{area_id}", response_model=GreenDetailOut)
def get_green_area_detail(
    area_id: int,
    region_id: int = Query(..., description="Partition key region_id"),
    province_id: int = Query(..., description="Partition key province_id"),
    date_from: date = _DATE_FROM,
    date_to: date = _DATE_TO,
) -> GreenDetailOut:
    """Curated detail for map popover (summary + metadata subset)."""
    return _uc(date_from, date_to).get_green_area_detail(
        area_id,
        region_id=region_id,
        province_id=province_id,
    )
