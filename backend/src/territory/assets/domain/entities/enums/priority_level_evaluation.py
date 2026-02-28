"""Enum for cadastre.priority_level_evaluation. Matches 02-init-schema-cadastre.sql."""

from enum import Enum


class PriorityLevelEvaluation(str, Enum):
    """Priority level evaluation for a green asset."""

    NONE = "NONE"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
