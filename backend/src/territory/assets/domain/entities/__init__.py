"""Assets domain entities."""

from territory.geo.domain.entities import GeoJSONFeatureCollection

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
