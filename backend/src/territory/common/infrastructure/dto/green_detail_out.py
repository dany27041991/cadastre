"""Curated detail DTO for green area / green asset map panel."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


class GreenDetailSummaryOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    primaryLabel: str
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


_ASSET_METADATA_KEYS: tuple[str, ...] = (
    "asset_type",
    "geometry_type",
    "family",
    "genus",
    "species",
    "variety",
    "health_status",
    "risk_level",
    "asset_status",
    "managing_entity",
    "survey_date",
    "growth_stage",
    "protection_status",
)

_AREA_METADATA_KEYS: tuple[str, ...] = (
    "name",
    "level",
    "zril_identifier",
    "geometry_type",
    "perimeter_type",
    "administrative_status",
    "operational_status",
    "survey_status",
    "intensity_of_fruition",
    "start_date_of_management",
    "end_date_of_management",
)


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


def _metadata_from_row(row: dict[str, Any], keys: tuple[str, ...]) -> list[GreenDetailMetadataItemOut]:
    items: list[GreenDetailMetadataItemOut] = []
    for key in keys:
        formatted = _fmt(row.get(key))
        if formatted is not None:
            items.append(GreenDetailMetadataItemOut(key=key, value=formatted))
    return items


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
            regionLabel=_fmt(row.get("region_label")),
            municipalityLabel=_fmt(row.get("municipality_label")),
            provinceLabel=_fmt(row.get("province_label")),
            regionId=_to_int(row.get("region_id")),
            provinceId=_to_int(row.get("province_id")),
            municipalityId=_to_int(row.get("municipality_id")),
        ),
        metadata=_metadata_from_row(row, _ASSET_METADATA_KEYS),
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
        metadata=_metadata_from_row(row, _AREA_METADATA_KEYS),
        bbox=bbox,
        geometry=geometry,
    )


GreenDetailSummaryOut.model_rebuild()
GreenDetailOut.model_rebuild()
