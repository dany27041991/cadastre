"""Enum for cadastre.origin. Matches 02-init-schema-cadastre.sql."""

from enum import Enum


class Origin(str, Enum):
    """Origin of a green asset."""

    NATIVE = "NATIVE"
    EXOTIC = "EXOTIC"
    INVASIVE = "INVASIVE"
    CULTIVAR = "CULTIVAR"
