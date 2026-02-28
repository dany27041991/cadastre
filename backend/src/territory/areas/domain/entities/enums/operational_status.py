"""Enum for cadastre.operational_status. Matches 02-init-schema-cadastre.sql."""

from enum import Enum


class OperationalStatus(str, Enum):
    """Operational status of a green area."""

    IN_MANAGEMENT = "IN_MANAGEMENT"
    UNDER_MAINTENANCE = "UNDER_MAINTENANCE"
    TEMPORARILY_CLOSED = "TEMPORARILY_CLOSED"
    EMERGENCY = "EMERGENCY"
    NOT_ACCESSIBLE = "NOT_ACCESSIBLE"
