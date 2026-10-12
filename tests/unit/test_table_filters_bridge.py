"""Bridge: document / optionally run backend unit tests for table_filters."""

from __future__ import annotations

from pathlib import Path

import pytest

_BACKEND_TESTS = (
    Path(__file__).resolve().parents[2] / "backend" / "tests" / "test_table_filters.py"
)


def test_backend_table_filters_file_exists() -> None:
    assert _BACKEND_TESTS.is_file(), (
        f"Expected {_BACKEND_TESTS}; run: "
        "cd cadastre/backend && PYTHONPATH=src pytest tests/test_table_filters.py"
    )


@pytest.mark.skip(reason="Run explicitly via backend pytest; bridge is a pointer only")
def test_run_backend_table_filters() -> None:
    pass
