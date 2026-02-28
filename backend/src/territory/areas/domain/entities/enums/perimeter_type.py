"""Enum for cadastre.perimeter_type. Matches 02-init-schema-cadastre.sql."""

from enum import Enum


class PerimeterType(str, Enum):
    """Perimeter type: real or fictitious."""

    REAL = "REAL"
    FICTITIOUS = "FICTITIOUS"
