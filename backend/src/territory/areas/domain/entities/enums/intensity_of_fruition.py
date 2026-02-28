"""Enum for cadastre.intensity_of_fruition. Matches 02-init-schema-cadastre.sql."""

from enum import Enum


class IntensityOfFruition(str, Enum):
    """Intensity of fruition for green areas."""

    NONE = "NONE"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
