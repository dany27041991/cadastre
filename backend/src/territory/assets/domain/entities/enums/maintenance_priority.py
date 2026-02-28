"""Enum for cadastre.maintenance_priority. Matches 02-init-schema-cadastre.sql."""

from enum import Enum


class MaintenancePriority(str, Enum):
    """Maintenance priority of a green asset."""

    NONE = "NONE"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"
