"""Enum for cadastre.protection_status. Matches 02-init-schema-cadastre.sql."""

from enum import Enum


class ProtectionStatus(str, Enum):
    """Protection status of a green asset."""

    NONE = "NONE"
    PROTECTED = "PROTECTED"
    MONUMENTAL = "MONUMENTAL"
    HISTORICAL = "HISTORICAL"
