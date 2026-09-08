"""Territory module.

Import `router` lazily so unit tests can import repositories without loading FastAPI web stack.
"""

from __future__ import annotations

from typing import Any

__all__ = ["router"]


def __getattr__(name: str) -> Any:
    if name == "router":
        from territory.router import router as territory_router

        return territory_router
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
