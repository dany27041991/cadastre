"""Enum for cadastre.istat_green_area_classification. Matches 02-init-schema-cadastre.sql."""

from enum import Enum


class IstatGreenAreaClassification(str, Enum):
    """ISTAT Ambiente urbano / Verde urbano typology (area + istat classification)."""

    HISTORICAL_GREEN = "HISTORICAL_GREEN"
    URBAN_PARKS = "URBAN_PARKS"
    EQUIPPED_GREEN = "EQUIPPED_GREEN"
    URBAN_FURNISHING = "URBAN_FURNISHING"
    SCHOOL_GARDENS = "SCHOOL_GARDENS"
    OUTDOOR_SPORTS = "OUTDOOR_SPORTS"
    URBAN_FORESTRY = "URBAN_FORESTRY"
    WOODLAND = "WOODLAND"
    UNCULTIVATED_GREEN = "UNCULTIVATED_GREEN"
    URBAN_ALLOTMENTS = "URBAN_ALLOTMENTS"
    BOTANICAL_GARDENS = "BOTANICAL_GARDENS"
    ZOOLOGICAL_GARDENS = "ZOOLOGICAL_GARDENS"
    CEMETERIES = "CEMETERIES"
    OTHER = "OTHER"
