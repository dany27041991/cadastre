"""Core middleware: compression, etc."""

from fastapi import FastAPI
from starlette.middleware.gzip import GZipMiddleware

# Responses smaller than this (bytes) are not compressed
DEFAULT_GZIP_MINIMUM_SIZE = 500


def add_gzip_middleware(
    app: FastAPI,
    minimum_size: int = DEFAULT_GZIP_MINIMUM_SIZE,
) -> None:
    """Register GZip middleware to compress responses and reduce payload."""
    app.add_middleware(GZipMiddleware, minimum_size=minimum_size)
