"""Enum for cadastre.growth_stage. Matches 02-init-schema-cadastre.sql."""

from enum import Enum


class GrowthStage(str, Enum):
    """Growth stage of a green asset."""

    YOUNG = "YOUNG"
    SEMI_MATURE = "SEMI_MATURE"
    MATURE = "MATURE"
    OVERMATURE = "OVERMATURE"
    DEAD = "DEAD"
