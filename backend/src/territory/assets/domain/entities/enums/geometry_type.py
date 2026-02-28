"""Enum for cadastre.geometry_type. Matches 02-init-schema-cadastre.sql and OBT (P/L/S)."""

from enum import Enum


class GeometryType(str, Enum):
    """Geometry type for green assets (OBT: P=point, L=line, S=surface)."""

    P = "P"
    L = "L"
    S = "S"
