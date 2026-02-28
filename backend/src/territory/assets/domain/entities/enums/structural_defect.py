"""Enum for cadastre.structural_defect. Matches 02-init-schema-cadastre.sql."""

from enum import Enum


class StructuralDefect(str, Enum):
    """Structural defect of a green asset."""

    NONE = "NONE"
    ROOT = "ROOT"
    TRUNK = "TRUNK"
    BRANCH = "BRANCH"
    MULTIPLE = "MULTIPLE"
