"""Enums for cadastre ASSET_GREEN (green_assets). Matches 02-init-schema-cadastre.sql (58-147)."""

from .asset_type import AssetType
from .geometry_type import GeometryType
from .health_status import HealthStatus
from .stability_status import StabilityStatus
from .structural_defect import StructuralDefect
from .risk_level import RiskLevel
from .maintenance_priority import MaintenancePriority
from .intervention_type import InterventionType
from .growth_stage import GrowthStage
from .origin import Origin
from .protection_status import ProtectionStatus
from .asset_status import AssetStatus
from .monitoring_required import MonitoringRequired
from .priority_level_evaluation import PriorityLevelEvaluation

__all__ = [
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
