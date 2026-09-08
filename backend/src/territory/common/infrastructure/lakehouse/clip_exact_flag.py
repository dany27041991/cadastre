"""Context flag: draw-clip cluster soft-cap exceeded (for HTTP header)."""

from __future__ import annotations

from contextvars import ContextVar

cluster_over_cap_flag: ContextVar[bool] = ContextVar("cluster_over_cap_flag", default=False)


def reset_cluster_over_cap() -> None:
    cluster_over_cap_flag.set(False)


def mark_cluster_over_cap() -> None:
    cluster_over_cap_flag.set(True)


def is_cluster_over_cap() -> bool:
    return bool(cluster_over_cap_flag.get())
