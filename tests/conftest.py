"""Pytest root for cadastre/tests (filter propagation suite)."""

from __future__ import annotations

import json
import os
import uuid
from pathlib import Path

import pytest

from harness import http_client, log_assert

ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "fixtures"


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line("markers", "live: requires API+MinIO stack")
    config.addinivalue_line("markers", "slow: national / heavy queries")
    config.addinivalue_line("markers", "e2e: Playwright browser smoke")
    # Host harness reads the file the API writes via Docker /app mount
    os.environ.setdefault("FILTER_TEST_LOG", "1")
    os.environ.setdefault(
        "FILTER_TEST_LOG_PATH",
        str(ROOT.parent / "backend" / ".filter-test-runtime.ndjson"),
    )


@pytest.fixture(scope="session")
def run_id() -> str:
    return os.environ.get("FILTER_TEST_RUN_ID") or f"run-{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="session")
def geo_scopes() -> dict:
    return json.loads((FIXTURES / "geo_scopes.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def filter_catalog() -> dict:
    return json.loads((FIXTURES / "filter_catalog.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def api_live() -> bool:
    return http_client.api_reachable()


@pytest.fixture(autouse=True)
def _skip_live_if_down(request: pytest.FixtureRequest, api_live: bool) -> None:
    mark = request.node.get_closest_marker("live")
    if mark is not None and not api_live:
        pytest.skip("API/MinIO stack not reachable (marker live)")


@pytest.fixture
def clear_filter_log() -> None:
    log_assert.clear()
