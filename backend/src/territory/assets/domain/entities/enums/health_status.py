"""Enum for cadastre.health_status. Matches 02-init-schema-cadastre.sql."""

from enum import Enum


class HealthStatus(str, Enum):
    """Health status of a green asset."""

    UNKNOWN = "UNKNOWN"
    HEALTHY = "HEALTHY"
    DEGRADED = "DEGRADED"
    DECLINING = "DECLINING"
    SICK = "SICK"
    DECEASED = "DECEASED"
