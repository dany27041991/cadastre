"""Enum for cadastre.asset_type. Matches 02-init-schema-cadastre.sql."""

from enum import Enum


class AssetType(str, Enum):
    """Type of green asset (tree, row, lawn, etc.)."""

    TREE = "tree"
    ROW = "row"
    LAWN = "lawn"
    PARK = "park"
    URBAN_FOREST = "urban_forest"
    HEDGE = "hedge"
    FLOWER_BED = "flower_bed"
    STREET_GREENERY = "street_greenery"
    OTHER = "other"
