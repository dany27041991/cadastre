"""
Centralized logging: configuration from settings and AOP-style decorator for method entry/exit/duration.
Usage:
  - Call setup_logging(log_level=...) once at app startup (e.g. in main.py).
  - Use get_logger(__name__) in modules for ad-hoc logs.
  - Use @log_invocation on functions/methods to log entry, exit and duration automatically.
"""
from __future__ import annotations

import functools
import inspect
import logging
import time
from collections.abc import Callable
from typing import Any, TypeVar

F = TypeVar("F", bound=Callable[..., Any])

# Default format: timestamp, level, logger name, message
_DEFAULT_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

_initialized = False


def setup_logging(
    log_level: str = "INFO",
    log_format: str | None = None,
    date_format: str = _DATE_FORMAT,
) -> None:
    """
    Configure the root logger and the 'uvicorn' / 'uvicorn.access' loggers
    so that application and server logs share level and format.
    """
    global _initialized
    level = getattr(logging, log_level.upper(), logging.INFO)
    fmt = log_format or _DEFAULT_FORMAT
    handler = logging.StreamHandler()
    handler.setLevel(level)
    handler.setFormatter(logging.Formatter(fmt, datefmt=date_format))

    root = logging.getLogger()
    root.setLevel(level)
    if not root.handlers:
        root.addHandler(handler)

    for name in ("uvicorn", "uvicorn.access", "uvicorn.error"):
        uvicorn_log = logging.getLogger(name)
        uvicorn_log.setLevel(level)
        if not uvicorn_log.handlers:
            uvicorn_log.addHandler(handler)

    _initialized = True


def get_logger(name: str) -> logging.Logger:
    """Return a logger for the given module/name. Prefer __name__ in call sites."""
    return logging.getLogger(name)


def _format_args(args: tuple[Any, ...], kwargs: dict[str, Any], max_len: int = 200) -> str:
    """Format args/kwargs for log, truncating if too long."""
    parts = [repr(a) for a in args]
    parts.extend(f"{k}={v!r}" for k, v in kwargs.items())
    s = ", ".join(parts)
    if len(s) > max_len:
        return s[: max_len - 3] + "..."
    return s


def log_invocation(
    level: int = logging.DEBUG,
    log_args: bool = True,
    log_result: bool = False,
    max_result_len: int = 120,
) -> Callable[[F], F]:
    """
    AOP-style decorator: logs each invocation (entry, exit, duration).
    Use on functions or methods to get automatic entry/exit/duration logs.
    Works with both sync and async callables.
    """

    def decorator(func: F) -> F:
        logger = get_logger(func.__module__)
        qualname = f"{func.__module__}.{func.__qualname__}"

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            args_repr = _format_args(args, kwargs) if log_args else ""
            if args_repr:
                logger.log(level, "Entering %s(%s)", qualname, args_repr)
            else:
                logger.log(level, "Entering %s", qualname)
            start = time.perf_counter()
            try:
                result = func(*args, **kwargs)
                elapsed = time.perf_counter() - start
                if log_result and result is not None:
                    res_repr = repr(result)
                    if len(res_repr) > max_result_len:
                        res_repr = res_repr[: max_result_len - 3] + "..."
                    logger.log(level, "Exited %s in %.3fs -> %s", qualname, elapsed, res_repr)
                else:
                    logger.log(level, "Exited %s in %.3fs", qualname, elapsed)
                return result
            except Exception:
                elapsed = time.perf_counter() - start
                logger.exception("Exited %s in %.3fs with error", qualname, elapsed)
                raise

        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            args_repr = _format_args(args, kwargs) if log_args else ""
            if args_repr:
                logger.log(level, "Entering %s(%s)", qualname, args_repr)
            else:
                logger.log(level, "Entering %s", qualname)
            start = time.perf_counter()
            try:
                result = await func(*args, **kwargs)
                elapsed = time.perf_counter() - start
                if log_result and result is not None:
                    res_repr = repr(result)
                    if len(res_repr) > max_result_len:
                        res_repr = res_repr[: max_result_len - 3] + "..."
                    logger.log(level, "Exited %s in %.3fs -> %s", qualname, elapsed, res_repr)
                else:
                    logger.log(level, "Exited %s in %.3fs", qualname, elapsed)
                return result
            except Exception:
                elapsed = time.perf_counter() - start
                logger.exception("Exited %s in %.3fs with error", qualname, elapsed)
                raise

        if inspect.iscoroutinefunction(func):
            return async_wrapper  # type: ignore[return-value]
        return sync_wrapper  # type: ignore[return-value]

    return decorator


__all__ = ["setup_logging", "get_logger", "log_invocation"]
