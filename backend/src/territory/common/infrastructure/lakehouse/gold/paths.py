"""MinIO object prefixes / URIs for gold and areas-stats bands."""

from __future__ import annotations

from territory.common.infrastructure.lakehouse.catalog import IngestResolution


def gold_prefix(resolution: IngestResolution, zoom_band: str) -> str:
    return (
        f"green_assets_clusters/region_id={resolution.region_id}/"
        f"province_id={resolution.province_id}/"
        f"municipality_id={resolution.municipality_id}/"
        f"ingest_date={resolution.ingest_at.isoformat()}/"
        f"zoom_band={zoom_band}"
    )


def areas_stats_prefix(resolution: IngestResolution, zoom_band: str = "municipality") -> str:
    return (
        f"green_areas_stats/region_id={resolution.region_id}/"
        f"province_id={resolution.province_id}/"
        f"municipality_id={resolution.municipality_id}/"
        f"ingest_date={resolution.ingest_at.isoformat()}/"
        f"zoom_band={zoom_band}"
    )


def _admin_region_uri(region_id: int) -> str:
    from core.config import settings

    return (
        f"s3://{settings.lakehouse_s3_bucket}/"
        f"green_assets_admin_clusters/region_id={region_id}/"
        f"part-municipality-bands.parquet"
    )


def _admin_areas_stats_region_uri(region_id: int) -> str:
    from core.config import settings

    return (
        f"s3://{settings.lakehouse_s3_bucket}/"
        f"green_areas_admin_stats/region_id={region_id}/"
        f"part-municipality-bands.parquet"
    )
