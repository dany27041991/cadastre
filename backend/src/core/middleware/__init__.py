"""Core middleware: compression, etc."""

from fastapi import FastAPI
from starlette.middleware.gzip import GZipMiddleware

from core.logger import log_invocation
from core.middleware.filter_test_headers import add_filter_test_headers_middleware

# Responses smaller than this (bytes) are not compressed
DEFAULT_GZIP_MINIMUM_SIZE = 500

__all__ = ["add_gzip_middleware", "add_filter_test_headers_middleware"]


@log_invocation(log_args=True, log_result=False)
def add_gzip_middleware(
    app: FastAPI,
    minimum_size: int = DEFAULT_GZIP_MINIMUM_SIZE,
) -> None:
    """Register GZip middleware to compress responses and reduce payload."""
    app.add_middleware(GZipMiddleware, minimum_size=minimum_size)
