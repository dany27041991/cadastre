#!/usr/bin/env python3
"""Login sim-dev and export VITE_MOCK_FGP + VITE_MOCK_COOKIE for standalone dev."""
from __future__ import annotations

import json
import sys
from pathlib import Path

PORTAL = "https://sim-dev.mase.gov.it/portalediaccesso/"
USERNAME = "utente16@mase"
PASSWORD = "admin"
OUTPUT = Path("/tmp/mase-creds.json")


def cookie_header(cookies: list[dict]) -> str:
    parts: list[str] = []
    for c in cookies:
        domain = c.get("domain", "")
        if "mase.gov.it" not in domain:
            continue
        name = c.get("name", "")
        value = c.get("value", "")
        if value.startswith('"') and value.endswith('"') and len(value) >= 2:
            value = value[1:-1]
        value = value.replace('"', "")
        if name and value is not None:
            parts.append(f"{name}={value}")
    return "; ".join(parts)


def main() -> int:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Install playwright: pip install playwright && playwright install chromium", file=sys.stderr)
        return 1

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(ignore_https_errors=True)
        page = context.new_page()

        page.goto(PORTAL, wait_until="networkidle", timeout=120_000)
        page.get_by_role("button", name="Accedi al portale").first.click(timeout=30_000)

        # Keycloak or IAM login form
        page.wait_for_timeout(2000)
        for selector in ['input[name="username"]', '#username', 'input[type="email"]']:
            if page.locator(selector).count():
                page.locator(selector).first.fill(USERNAME)
                break
        for selector in ['input[name="password"]', '#password', 'input[type="password"]']:
            if page.locator(selector).count():
                page.locator(selector).first.fill(PASSWORD)
                break
        for selector in ['input[type="submit"]', '#kc-login', 'button[type="submit"]']:
            if page.locator(selector).count():
                page.locator(selector).first.click()
                break

        page.wait_for_url("**/portalediaccesso/**", timeout=120_000)
        page.wait_for_timeout(5000)

        fgp = page.evaluate("() => sessionStorage.getItem('fgp') || ''")
        cookies = context.cookies()
        cookie = cookie_header(cookies)

        # Trigger user/logged to ensure session cookies are set
        if fgp:
            status = page.evaluate(
                """async (fgp) => {
                  const r = await fetch('https://sim-dev.mase.gov.it/core/api/authorization/user/logged', {
                    method: 'POST', credentials: 'include',
                    headers: { Accept: 'application/json', 'Content-Type': 'application/json', fgp },
                    body: '{}',
                  });
                  return r.status;
                }""",
                fgp,
            )
            if status != 200:
                print(f"user/logged returned {status}", file=sys.stderr)
            cookies = context.cookies()
            cookie = cookie_header(cookies)
            fgp = page.evaluate("() => sessionStorage.getItem('fgp') || ''") or fgp

        if not fgp:
            print("fgp missing after login", file=sys.stderr)
            return 1
        if "access_token=" not in cookie:
            print("access_token missing in cookies", file=sys.stderr)
            return 1

        payload = {"fgp": fgp, "cookie": cookie}
        OUTPUT.write_text(json.dumps(payload), encoding="utf-8")
        print(f"Wrote {OUTPUT} (cookie len={len(cookie)})")
        browser.close()
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
