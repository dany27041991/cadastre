"""Bind X-Filter-Test-* headers into contextvars for emit_filter_test_log."""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp


class FilterTestHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next) -> Response:
        try:
            from territory.common.infrastructure.lakehouse.filter_test_log import (
                bind_request_headers,
                clear_request_headers,
                filter_test_log_enabled,
            )
        except Exception:
            return await call_next(request)

        if not filter_test_log_enabled():
            return await call_next(request)

        bind_request_headers(
            case_id=request.headers.get("x-filter-test-case"),
            scope_id=request.headers.get("x-filter-test-scope"),
            run_id=request.headers.get("x-filter-test-run"),
        )
        try:
            return await call_next(request)
        finally:
            clear_request_headers()


def add_filter_test_headers_middleware(app) -> None:
    app.add_middleware(FilterTestHeadersMiddleware)
