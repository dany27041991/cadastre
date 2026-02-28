"""Enum for cadastre.intervention_type. Matches 02-init-schema-cadastre.sql."""

from enum import Enum


class InterventionType(str, Enum):
    """Type of intervention on a green asset."""

    NONE = "NONE"
    PRUNING = "PRUNING"
    CONSOLIDATION = "CONSOLIDATION"
    TREATMENT = "TREATMENT"
    REMOVAL = "REMOVAL"
    REPLACEMENT = "REPLACEMENT"
