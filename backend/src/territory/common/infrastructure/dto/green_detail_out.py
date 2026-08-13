"""Curated detail DTO for green area / green asset map panel."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

from territory.common.infrastructure.green_metadata_projection import (
    AREA_METADATA_KEYS,
    ASSET_METADATA_KEYS,
    fmt_or_nan,
    prepare_area_raw_values,
    prepare_asset_raw_values,
)


class GreenDetailSummaryOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    primaryLabel: str
    # Asset summary field label from public.attribute_types (e.g. Albero / Siepe).
    attributeTypeLabel: str | None = None
    regionLabel: str | None = None
    municipalityLabel: str | None = None
    provinceLabel: str | None = None
    regionId: int | None = None
    provinceId: int | None = None
    municipalityId: int | None = None


class GreenDetailMetadataItemOut(BaseModel):
    key: str
    value: str


class GreenDetailOut(BaseModel):
    kind: Literal["asset", "area"]
    id: int
    summary: GreenDetailSummaryOut
    metadata: list[GreenDetailMetadataItemOut]
    # WGS84 [minLon, minLat, maxLon, maxLat] for map framing from table/detail.
    bbox: list[float] | None = None
    # True GeoJSON geometry (Point/Line/Polygon/…) for red selection shape.
    geometry: dict[str, Any] | None = None


_AREA_FORMATS = {
    "survey_date": "survey_date",
    "surface_area_m2": "surface",
}

_ASSET_FORMATS = {
    "survey_date": "survey_date",
    "latitude": "coord",
    "longitude": "coord",
    "trunk_diameter_cm": "diameter",
    "plant_height_m": "height",
    "crown_diameter_m": "diameter",
}


def _fmt(value: Any) -> str | None:
    if value is None or value == "":
        return None
    return str(value)


def _to_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        n = int(value)
    except (TypeError, ValueError):
        return None
    return n if n > 0 else None


def _metadata_fixed(
    values: dict[str, Any],
    keys: tuple[str, ...],
    *,
    formats: dict[str, str] | None = None,
) -> list[GreenDetailMetadataItemOut]:
    fmt_map = formats or {}
    return [
        GreenDetailMetadataItemOut(
            key=key,
            value=fmt_or_nan(values.get(key), kind=fmt_map.get(key, "plain")),
        )
        for key in keys
    ]


def build_asset_detail(
    row: dict[str, Any],
    *,
    bbox: list[float] | None = None,
    geometry: dict[str, Any] | None = None,
) -> GreenDetailOut:
    primary = (
        _fmt(row.get("species"))
        or _fmt(row.get("genus"))
        or _fmt(row.get("asset_type"))
        or str(row["id"])
    )
    return GreenDetailOut(
        kind="asset",
        id=int(row["id"]),
        summary=GreenDetailSummaryOut(
            primaryLabel=primary,
            attributeTypeLabel=_fmt(row.get("attribute_type_label")),
            regionLabel=_fmt(row.get("region_label")),
            municipalityLabel=_fmt(row.get("municipality_label")),
            provinceLabel=_fmt(row.get("province_label")),
            regionId=_to_int(row.get("region_id")),
            provinceId=_to_int(row.get("province_id")),
            municipalityId=_to_int(row.get("municipality_id")),
        ),
        metadata=_metadata_fixed(
            prepare_asset_raw_values(row),
            ASSET_METADATA_KEYS,
            formats=_ASSET_FORMATS,
        ),
        bbox=bbox,
        geometry=geometry,
    )


def build_area_detail(
    row: dict[str, Any],
    *,
    bbox: list[float] | None = None,
    geometry: dict[str, Any] | None = None,
) -> GreenDetailOut:
    primary = _fmt(row.get("name")) or str(row["id"])
    return GreenDetailOut(
        kind="area",
        id=int(row["id"]),
        summary=GreenDetailSummaryOut(
            primaryLabel=primary,
            regionLabel=_fmt(row.get("region_label")),
            municipalityLabel=_fmt(row.get("municipality_label")),
            provinceLabel=_fmt(row.get("province_label")),
            regionId=_to_int(row.get("region_id")),
            provinceId=_to_int(row.get("province_id")),
            municipalityId=_to_int(row.get("municipality_id")),
        ),
        metadata=_metadata_fixed(
            prepare_area_raw_values(row),
            AREA_METADATA_KEYS,
            formats=_AREA_FORMATS,
        ),
        bbox=bbox,
        geometry=geometry,
    )


GreenDetailSummaryOut.model_rebuild()
GreenDetailOut.model_rebuild()
