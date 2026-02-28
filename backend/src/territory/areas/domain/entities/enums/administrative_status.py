"""Enum for cadastre.administrative_status. Matches 02-init-schema-cadastre.sql."""

from enum import Enum


class AdministrativeStatus(str, Enum):
    """Administrative status of a green area."""

    IN_DESIGN = "IN_DESIGN"
    PLANNED = "PLANNED"
    APPROVED = "APPROVED"
    ACTIVE = "ACTIVE"
    DISMISSED = "DISMISSED"
    MERGED = "MERGED"
    RECLASSIFIED = "RECLASSIFIED"
