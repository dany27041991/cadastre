"""Enum for cadastre.monitoring_required. Matches 02-init-schema-cadastre.sql."""

from enum import Enum


class MonitoringRequired(str, Enum):
    """Monitoring requirement for a green asset."""

    NONE = "NONE"
    PERIODIC = "PERIODIC"
    URGENT = "URGENT"
