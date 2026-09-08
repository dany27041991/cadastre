"""Structured timing logs for lakehouse serving (T7 — alertable via log pipeline)."""

from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from typing import Iterator

logger = logging.getLogger("territory.lakehouse.metrics")


@contextmanager
def timed_op(operation: str, **fields: object) -> Iterator[None]:
    """Log duration_ms for a lakehouse op (INFO). Use for p95 aggregation in APM/log stack."""
    start = time.perf_counter()
    ok = True
    try:
        yield
    except Exception:
        ok = False
        raise
    finally:
        duration_ms = round((time.perf_counter() - start) * 1000, 1)
        extra = " ".join(f"{k}={v}" for k, v in fields.items() if v is not None)
        logger.info(
            "lakehouse_op op=%s ok=%s duration_ms=%s %s",
            operation,
            ok,
            duration_ms,
            extra.strip(),
        )
