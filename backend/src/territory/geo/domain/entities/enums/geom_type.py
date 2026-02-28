"""Enum for public.geom_type. Matches 01-init-schema-public.sql."""

from enum import Enum


class GeomType(str, Enum):
    """DBT geometry type: P=Point, L=Line, S=Surface."""

    P = "P"
    L = "L"
    S = "S"
