"""Enum for cadastre.risk_level. Matches 02-init-schema-cadastre.sql."""

from enum import Enum


class RiskLevel(str, Enum):
    """Risk level of a green asset."""

    NONE = "NONE"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    EXTREME = "EXTREME"
