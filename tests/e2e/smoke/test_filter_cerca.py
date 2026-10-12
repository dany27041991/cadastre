"""E2E smoke: Area Italia → layers → draft filter → Cerca → Pulisci.

Requires FE (BASE_URL, default http://localhost:5173) + API live.
Run: python3 -m pytest e2e/smoke -m e2e -v
"""

from __future__ import annotations

import os
from urllib.parse import parse_qs, urlparse

import pytest

pytest.importorskip("playwright")
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("BASE_URL", "http://localhost:5173").rstrip("/")


def _api_table_or_viewport(url: str) -> bool:
    if "localhost:8000" not in url and ":8000/" not in url:
        return False
    return "/table" in url or "/viewport" in url


def _query(url: str) -> dict[str, list[str]]:
    return parse_qs(urlparse(url).query)


@pytest.mark.e2e
@pytest.mark.live
def test_filter_draft_cerca_pulisci_smoke() -> None:
    """Draft must not fetch filtered /table; Cerca applies; Pulisci clears."""
    captured: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        page.on(
            "request",
            lambda req: captured.append(req.url) if _api_table_or_viewport(req.url) else None,
        )

        page.goto(f"{BASE_URL}/", wait_until="networkidle", timeout=90_000)
        page.wait_for_timeout(1500)
        page.get_by_role("button", name="Area Italia").click()
        page.wait_for_timeout(2000)

        page.locator('input[name="ingestDateFrom"]').fill("01/01/2020")
        page.locator('input[name="ingestDateTo"]').fill("31/12/2025")
        page.wait_for_timeout(800)

        page.locator('label:has(input[name="green-areas-layer"]) .lever').click(force=True)
        page.wait_for_timeout(800)
        assert page.locator('input[name="green-areas-layer"]').is_checked()

        page.locator('button:has(.infopanel-button-text:text("Avanti"))').click()
        page.wait_for_timeout(1200)
        assert page.locator('.infopanel-button-text', has_text="Cerca").count() == 1
        assert page.locator('.infopanel-button-text', has_text="Pulisci").count() == 1

        name_inp = page.locator('input[name="green-filter-area-name"]')
        assert name_inp.count() == 1
        # Range controls (surface min/max + survey from/to) must be present.
        assert page.locator('input[name="green-filter-area-surface_area_m2_min"]').count() == 1
        assert page.locator('input[name="green-filter-area-surface_area_m2_max"]').count() == 1
        n_before_draft = len(captured)
        name_inp.fill("Parco")
        page.locator('input[name="green-filter-area-surface_area_m2_min"]').fill("1")
        page.locator('input[name="green-filter-area-surface_area_m2_max"]').fill("9999999")
        page.wait_for_timeout(600)

        draft_slice = captured[n_before_draft:]
        draft_filtered = [u for u in draft_slice if "name=" in u]
        assert draft_filtered == [], f"draft must not hit filtered API: {draft_filtered}"

        n_before_cerca = len(captured)
        page.locator('button:has(.infopanel-button-text:text("Cerca"))').click()
        page.wait_for_timeout(3500)
        after_cerca = captured[n_before_cerca:]
        table_hits = [u for u in after_cerca if "/green-areas/table" in u]
        viewport_hits = [u for u in after_cerca if "/viewport" in u]
        assert table_hits, "Cerca must request /green-areas/table"
        assert any("name=Parco" in u for u in table_hits), table_hits
        assert any("surface_area_m2_min=1" in u for u in table_hits), table_hits
        assert any("surface_area_m2_max=9999999" in u for u in table_hits), table_hits
        for u in viewport_hits:
            qs = _query(u)
            if "name" in qs:
                assert qs["name"] == ["Parco"], u

        page.locator('button:has(.infopanel-button-text:text("Pulisci"))').click()
        page.wait_for_timeout(500)
        assert name_inp.input_value() == ""

        n_before_recerca = len(captured)
        page.locator('button:has(.infopanel-button-text:text("Cerca"))').click()
        page.wait_for_timeout(3000)
        recerca = [u for u in captured[n_before_recerca:] if "/green-areas/table" in u]
        assert recerca, "second Cerca must hit /table"
        assert all("name=" not in u for u in recerca), recerca

        browser.close()
