"""DuckDB connection configured for MinIO (S3 path-style)."""

from __future__ import annotations

import os
import queue
import threading
import time
from urllib.parse import urlparse

from core.config import settings

# Concurrent viewport requests run on different worker threads; a per-thread
# connection still paid INSTALL httpfs per thread (measured cold init 1–10 s).
_POOL_SIZE = max(1, int(os.environ.get("LAKEHOUSE_DUCKDB_POOL_SIZE", "4")))
_pool: queue.Queue | None = None
_pool_lock = threading.Lock()
_pool_created = 0
_pool_in_use = 0
_pool_stats_lock = threading.Lock()


class _PooledConnection:
    """Exclusive checkout from the process pool; ``close()`` returns the conn."""

    __slots__ = ("_con", "_checked_in")

    def __init__(self, con) -> None:
        self._con = con
        self._checked_in = False

    def execute(self, *args, **kwargs):
        return self._con.execute(*args, **kwargs)

    def close(self) -> None:
        if self._checked_in:
            return
        self._checked_in = True
        _checkin(self._con)

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


def _ensure_pool() -> queue.Queue:
    """Lazily create a process-wide pool of httpfs-ready DuckDB connections."""
    global _pool, _pool_created

    if _pool is not None:
        return _pool

    try:
        import duckdb
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(
            "duckdb is required for green lakehouse serving (pip install duckdb)"
        ) from exc

    with _pool_lock:
        if _pool is not None:
            return _pool
        q: queue.Queue = queue.Queue(maxsize=_POOL_SIZE)
        for _ in range(_POOL_SIZE):
            con = duckdb.connect()
            _configure_httpfs(con)
            q.put(con)
        _pool_created = _POOL_SIZE
        _pool = q
        return _pool


def _checkin(con) -> None:
    global _pool_in_use
    assert _pool is not None
    with _pool_stats_lock:
        _pool_in_use = max(0, _pool_in_use - 1)
    _pool.put(con)


def connect_lakehouse():
    """Checkout a pooled DuckDB connection with httpfs pointed at MinIO.

    Callers must ``close()`` (typically in ``finally``) to return the connection.
    Connections are exclusive while checked out — safe under concurrent requests.
    """
    global _pool_in_use

    pool = _ensure_pool()
    t0 = time.perf_counter()
    try:
        con = pool.get(timeout=30.0)
    except queue.Empty as exc:
        wait_ms = (time.perf_counter() - t0) * 1000
        raise RuntimeError(
            f"DuckDB lakehouse pool exhausted (size={_POOL_SIZE}, wait={wait_ms:.0f}ms)"
        ) from exc
    with _pool_stats_lock:
        _pool_in_use += 1
    return _PooledConnection(con)


def catalog_uri() -> str:
    return f"s3://{settings.lakehouse_s3_bucket}/_catalog/municipality_ingests.parquet"


def parquet_glob(object_prefix: str) -> str:
    return f"s3://{settings.lakehouse_s3_bucket}/{object_prefix}/part-*.parquet"
