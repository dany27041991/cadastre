"""Global exception handlers with i18n: translate message_key using request locale."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from core.exceptions.base import AppException
from core.i18n import get_locale_from_request, translate
from core.logger import log_invocation


@log_invocation(log_args=True, log_result=False)
def _app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    locale = get_locale_from_request(request)
    message = translate(
        exc.message_key,
        locale,
        **getattr(exc, "translation_params", {}),
    )
    body: dict = {"message": message}
    if exc.details is not None:
        body["details"] = exc.details
    return JSONResponse(status_code=exc.status_code, content=body)


@log_invocation(log_args=True, log_result=False)
def _validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    locale = get_locale_from_request(request)
    message = translate("errors.validation_error", locale)
    return JSONResponse(
        status_code=422,
        content={
            "message": message,
            "details": exc.errors(),
        },
    )


@log_invocation(log_args=True, log_result=False)
def _generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    locale = get_locale_from_request(request)
    message = translate("errors.internal", locale)
    return JSONResponse(status_code=500, content={"message": message})


@log_invocation(log_args=False, log_result=False)
def register_exception_handlers(app: FastAPI) -> None:
    """Register global exception handlers (AppException, RequestValidationError, Exception)."""
    app.add_exception_handler(AppException, _app_exception_handler)
    app.add_exception_handler(RequestValidationError, _validation_exception_handler)
    app.add_exception_handler(Exception, _generic_exception_handler)
