"""Application exceptions with i18n message keys."""


class AppException(Exception):
    """
    Base exception for the API. Use a message_key for translation;
    the global handler will translate it using the request locale.
    """

    def __init__(
        self,
        message_key: str,
        status_code: int = 500,
        details: dict | list | None = None,
        **translation_params: str,
    ):
        super().__init__(message_key)
        self.message_key = message_key
        self.status_code = status_code
        self.details = details
        self.translation_params = translation_params


class NotFoundError(AppException):
    """Resource not found (404)."""

    def __init__(self, message_key: str = "errors.not_found", **kwargs: str):
        super().__init__(message_key, status_code=404, **kwargs)


class ValidationError(AppException):
    """Validation error (422)."""

    def __init__(
        self,
        message_key: str = "errors.validation_error",
        details: dict | list | None = None,
        **kwargs: str,
    ):
        super().__init__(message_key, status_code=422, details=details, **kwargs)


class UnauthorizedError(AppException):
    """Authentication required (401)."""

    def __init__(self, message_key: str = "errors.unauthorized", **kwargs: str):
        super().__init__(message_key, status_code=401, **kwargs)


class ForbiddenError(AppException):
    """Forbidden (403)."""

    def __init__(self, message_key: str = "errors.forbidden", **kwargs: str):
        super().__init__(message_key, status_code=403, **kwargs)


class BadRequestError(AppException):
    """Bad request (400)."""

    def __init__(self, message_key: str = "errors.bad_request", **kwargs: str):
        super().__init__(message_key, status_code=400, **kwargs)


class ConflictError(AppException):
    """Conflict (409)."""

    def __init__(self, message_key: str = "errors.conflict", **kwargs: str):
        super().__init__(message_key, status_code=409, **kwargs)
