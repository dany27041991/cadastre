# E2E smoke (Playwright)

Python Playwright (same toolchain as recon) — draft filter must not hit filtered `/table`; **Cerca** applies; **Pulisci** clears.

```bash
cd cadastre/tests
BASE_URL=http://localhost:5173 python3 -m pytest e2e/smoke -m e2e -v --tb=short
```

Requires: FE (`npm`/vite :5173), API+MinIO, Chromium (`playwright install chromium`).
