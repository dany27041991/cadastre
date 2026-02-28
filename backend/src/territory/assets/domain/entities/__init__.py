"""Assets domain entities."""

from territory.geo.domain.entities import GeoJSONFeatureCollection

from .green_asset_model import GreenAssetModel
from .asset_green_history_model import AssetGreenHistoryModel
from .enums import (
    AssetType,
    GeometryType,
    HealthStatus,
    StabilityStatus,
    StructuralDefect,
    RiskLevel,
    MaintenancePriority,
    InterventionType,
    GrowthStage,
    Origin,
    ProtectionStatus,
    AssetStatus,
    MonitoringRequired,
    PriorityLevelEvaluation,
)

__all__ = [
    "GeoJSONFeatureCollection",
    "GreenAssetModel",
    "AssetGreenHistoryModel",
    "AssetType",
    "GeometryType",
    "HealthStatus",
    "StabilityStatus",
    "StructuralDefect",
    "RiskLevel",
    "MaintenancePriority",
    "InterventionType",
    "GrowthStage",
    "Origin",
    "ProtectionStatus",
    "AssetStatus",
    "MonitoringRequired",
    "PriorityLevelEvaluation",
]
