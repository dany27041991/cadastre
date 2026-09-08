"""DuckDB connection configured for MinIO (S3 path-style)."""

from __future__ import annotations

import threading
from urllib.parse import urlparse

from core.config import settings

_thread_local = threading.local()
_init_lock = threading.Lock()


class _ReusableConnection:
    """Wraps a DuckDB connection so callers' ``close()`` does not tear it down.

    Lakehouse serving opens many short-lived connections per viewport request;
    reinstalling httpfs on every ``duckdb.connect()`` dominated measured latency.
    """

    __slots__ = ("_con",)

    def __init__(self, con) -> None:
        self._con = con

    def execute(self, *args, **kwargs):
        return self._con.execute(*args, **kwargs)

    def close(self) -> None:
        return None

    def __getattr__(self, name: str):
        return getattr(self._con, name)


def _configure_httpfs(con) -> None:
    endpoint = settings.lakehouse_s3_endpoint
    parsed = urlparse(endpoint)
    host = parsed.netloc or parsed.path
    use_ssl = parsed.scheme == "https"

    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute(f"SET s3_endpoint='{host}';")
    con.execute(f"SET s3_access_key_id='{settings.lakehouse_s3_access_key}';")
    con.execute(f"SET s3_secret_access_key='{settings.lakehouse_s3_secret_key}';")
    con.execute(f"SET s3_region='{settings.lakehouse_s3_region}';")
    con.execute("SET s3_url_style='path';")
    con.execute(f"SET s3_use_ssl={'true' if use_ssl else 'false'};")


def connect_lakehouse():
    """Return a per-thread DuckDB connection with httpfs pointed at MinIO.

    The underlying connection is reused for the lifetime of the worker thread.
    ``close()`` on the returned wrapper is a no-op so existing call sites stay safe.
    """
    try:
        import duckdb
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(
            "duckdb is required for green lakehouse serving (pip install duckdb)"
        ) from exc

    existing = getattr(_thread_local, "con", None)
    if existing is not None:
        return _ReusableConnection(existing)

    with _init_lock:
        existing = getattr(_thread_local, "con", None)
        if existing is not None:
            return _ReusableConnection(existing)
        con = duckdb.connect()
        _configure_httpfs(con)
        _thread_local.con = con
        return _ReusableConnection(con)


def catalog_uri() -> str:
    return f"s3://{settings.lakehouse_s3_bucket}/_catalog/municipality_ingests.parquet"


def parquet_glob(object_prefix: str) -> str:
    return f"s3://{settings.lakehouse_s3_bucket}/{object_prefix}/part-*.parquet"
