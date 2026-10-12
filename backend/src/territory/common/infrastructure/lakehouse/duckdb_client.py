"""DuckDB connection configured for MinIO (S3 path-style)."""

from __future__ import annotations

import os
import queue
import threading
import time
from urllib.parse import urlparse

from core.config import settings

# Concurrent viewport + table requests share this pool. size=4 exhausted under
# national seed (30s waits → 500 "pool exhausted"; map never loads).
_POOL_SIZE = max(1, int(os.environ.get("LAKEHOUSE_DUCKDB_POOL_SIZE", "8")))
_POOL_WAIT_SEC = float(os.environ.get("LAKEHOUSE_DUCKDB_POOL_WAIT_SEC", "8"))
_pool: queue.Queue | None = None
_pool_lock = threading.Lock()
_pool_created = 0
_pool_in_use = 0
_pool_stats_lock = threading.Lock()
_checkout_seq = 0
_hold_started: dict[int, float] = {}


def _agent_pool_log(message: str, data: dict) -> None:
    # #region agent log
    try:
        import json as _json
        import urllib.request as _urlreq

        _payload = _json.dumps(
            {
                "sessionId": "4fe799",
                "runId": "pool-storm",
                "hypothesisId": "H-duckdb-pool",
                "location": "duckdb_client",
                "message": message,
                "data": data,
                "timestamp": int(time.time() * 1000),
            }
        ).encode("utf-8")
        _urlreq.urlopen(
            _urlreq.Request(
                "http://host.docker.internal:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c",
                data=_payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Debug-Session-Id": "4fe799",
                },
                method="POST",
            ),
            timeout=1.0,
        )
    except Exception:
        pass
    # #endregion


class _PooledConnection:
    """Exclusive checkout from the process pool; ``close()`` returns the conn."""

    __slots__ = ("_con", "_checked_in", "_checkout_id", "_t0")

    def __init__(self, con, checkout_id: int, t0: float) -> None:
        self._con = con
        self._checked_in = False
        self._checkout_id = checkout_id
        self._t0 = t0

    def execute(self, *args, **kwargs):
        return self._con.execute(*args, **kwargs)

    def close(self) -> None:
        if self._checked_in:
            return
        self._checked_in = True
        hold_ms = int((time.perf_counter() - self._t0) * 1000)
        _checkin(self._con, self._checkout_id, hold_ms)

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


def _checkin(con, checkout_id: int, hold_ms: int) -> None:
    global _pool_in_use
    assert _pool is not None
    with _pool_stats_lock:
        _pool_in_use = max(0, _pool_in_use - 1)
        in_use = _pool_in_use
        _hold_started.pop(checkout_id, None)
    _pool.put(con)
    _agent_pool_log(
        "duckdb_checkin",
        {
            "checkout_id": checkout_id,
            "hold_ms": hold_ms,
            "in_use": in_use,
            "pool_size": _POOL_SIZE,
        },
    )


def connect_lakehouse():
    """Checkout a pooled DuckDB connection with httpfs pointed at MinIO.

    Callers must ``close()`` (typically in ``finally``) to return the connection.
    Connections are exclusive while checked out — safe under concurrent requests.
    """
    global _pool_in_use, _checkout_seq

    pool = _ensure_pool()
    t0 = time.perf_counter()
    try:
        con = pool.get(timeout=_POOL_WAIT_SEC)
    except queue.Empty as exc:
        wait_ms = (time.perf_counter() - t0) * 1000
        with _pool_stats_lock:
            in_use = _pool_in_use
            oldest_hold_ms = 0
            now = time.perf_counter()
            if _hold_started:
                oldest_hold_ms = int((now - min(_hold_started.values())) * 1000)
        _agent_pool_log(
            "duckdb_pool_exhausted",
            {
                "pool_size": _POOL_SIZE,
                "in_use": in_use,
                "wait_ms": int(wait_ms),
                "oldest_hold_ms": oldest_hold_ms,
            },
        )
        raise RuntimeError(
            f"DuckDB lakehouse pool exhausted (size={_POOL_SIZE}, in_use={in_use}, wait={wait_ms:.0f}ms)"
        ) from exc
    wait_ms = (time.perf_counter() - t0) * 1000
    with _pool_stats_lock:
        _pool_in_use += 1
        _checkout_seq += 1
        checkout_id = _checkout_seq
        _hold_started[checkout_id] = time.perf_counter()
        in_use = _pool_in_use
    _agent_pool_log(
        "duckdb_checkout",
        {
            "checkout_id": checkout_id,
            "wait_ms": int(wait_ms),
            "in_use": in_use,
            "pool_size": _POOL_SIZE,
        },
    )
    return _PooledConnection(con, checkout_id, time.perf_counter())


def catalog_uri() -> str:
    return f"s3://{settings.lakehouse_s3_bucket}/_catalog/municipality_ingests.parquet"


def parquet_glob(object_prefix: str) -> str:
    return f"s3://{settings.lakehouse_s3_bucket}/{object_prefix}/part-*.parquet"
