"""Enum for cadastre.stability_status. Matches 02-init-schema-cadastre.sql."""

from enum import Enum


class StabilityStatus(str, Enum):
    """Stability status of a green asset."""

    STABLE = "STABLE"
    PARTIALLY_UNSTABLE = "PARTIALLY_UNSTABLE"
    UNSTABLE = "UNSTABLE"
    FALLEN = "FALLEN"
