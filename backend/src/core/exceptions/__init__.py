"""Global exception handling with i18n message translation."""

from core.exceptions.base import (
    AppException,
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
    ValidationError,
)
from core.exceptions.handler import register_exception_handlers

__all__ = [
    "AppException",
    "BadRequestError",
    "ConflictError",
    "ForbiddenError",
    "NotFoundError",
    "register_exception_handlers",
    "UnauthorizedError",
    "ValidationError",
]
