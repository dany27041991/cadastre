"""Enum for cadastre.survey_status. Matches 02-init-schema-cadastre.sql."""

from enum import Enum


class SurveyStatus(str, Enum):
    """Survey status of a green area."""

    NOT_SURVEYED = "NOT_SURVEYED"
    SURVEY_PENDING = "SURVEY_PENDING"
    PARTIALLY_SURVEYED = "PARTIALLY_SURVEYED"
    SURVEYED = "SURVEYED"
    IMPORTED_DBT = "IMPORTED_DBT"
    TO_BE_VERIFIED = "TO_BE_VERIFIED"
