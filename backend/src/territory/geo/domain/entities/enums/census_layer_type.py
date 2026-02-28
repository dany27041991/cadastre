"""Enum for public.census_layer_type. Matches 01-init-schema-public.sql."""

from enum import Enum


class CensusLayerType(str, Enum):
    """Census layer: census_section (sezione) or locality (località)."""

    CENSUS_SECTION = "census_section"
    LOCALITY = "locality"
