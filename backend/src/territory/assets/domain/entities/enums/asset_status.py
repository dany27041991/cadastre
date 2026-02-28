"""Enum for cadastre.asset_status. Matches 02-init-schema-cadastre.sql."""

from enum import Enum


class AssetStatus(str, Enum):
    """Status of a green asset."""

    PLANNED = "PLANNED"
    INSTALLED = "INSTALLED"
    ACTIVE = "ACTIVE"
    TEMPORARILY_OUT_OF_SERVICE = "TEMPORARILY_OUT_OF_SERVICE"
    REMOVED = "REMOVED"
