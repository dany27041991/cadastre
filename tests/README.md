# Filter propagation test suite

Verifies green filters propagate to **table**, **viewport/map**, and **clusters**, with NDJSON runtime evidence. E2E smoke covers draft → **Cerca** → **Pulisci**.

**Spec / plan:**
- [`docs/design/2026-10-08-filter-propagation-test-suite-design.md`](../docs/design/2026-10-08-filter-propagation-test-suite-design.md)
- [`docs/design/2026-10-08-filter-propagation-test-suite-plan.md`](../docs/design/2026-10-08-filter-propagation-test-suite-plan.md)

## Prerequisites

1. Compose up (`catasto-backend`, MinIO seeded, Lecce + national).
2. Backend env: `FILTER_TEST_LOG=1` (default in `infrastructure/compose/docker-compose.yml`).
3. Log file on host: `cadastre/backend/.filter-test-runtime.ndjson` (container `/app/...`).
4. E2E only: FE on `:5173`, Chromium (`playwright install chromium`).

## Env

| Var | Default | Role |
|-----|---------|------|
| `API_BASE` | `http://localhost:8000` | API root for live tests |
| `FILTER_TEST_LOG` | `1` | Enable BE NDJSON emit |
| `FILTER_TEST_LOG_PATH` | `../backend/.filter-test-runtime.ndjson` | Host path harness asserts |
| `BASE_URL` | `http://localhost:5173` | FE origin for e2e |
| `FILTER_TEST_RUN_ID` | auto uuid | Correlate a suite run |

## Run

```bash
cd cadastre/tests
./run_filter_suite.sh          # api live+not slow + unit
./run_filter_suite.sh --e2e    # + Playwright smoke
./run_filter_suite.sh --slow   # include national/slow
./run_filter_suite.sh --all    # live (incl. slow) + unit + e2e
```

Or stepwise:

```bash
python3 -m pytest api/ -m "live and not slow" -v --tb=short
python3 -m pytest unit -v
BASE_URL=http://localhost:5173 python3 -m pytest e2e/smoke -m e2e -v --tb=short
```

Skip cleanly if API down (`marker live`). Backend unit filters (source of truth):

```bash
cd cadastre/backend && PYTHONPATH=src pytest tests/test_table_filters.py -v
```

JUnit:

```bash
API_BASE=http://localhost:8000 \
python3 -m pytest api/ -m "live and not slow" -v --junitxml=reports/junit.xml
```

## Interpreting results

- **HTTP assert fail** — filter not applied or wrong total vs baseline (see `harness/coherence.py`).
- **NDJSON missing** — BE emit off or path mismatch; check `FILTER_TEST_LOG*` and that the GET completed.
- **NDJSON entry** — one JSON line per filtered request: `caseId`, `scope`, `kind`, `surface`, `filters`, `total` (see `harness/log_assert.py`).
- **E2E** — draft must produce **zero** `/table?…&name=…`; Cerca must; Pulisci then Cerca must omit the filter key.

## Layout

| Path | Role |
|------|------|
| `fixtures/` | geo scopes + filter catalog |
| `harness/` | HTTP client, log assert, discovery, coherence |
| `api/table/` | `/table` matrix |
| `api/viewport/` | `/viewport` matrix |
| `api/clusters/` | filtered clusters vs baseline |
| `api/coherence/` | same applied → table + viewport |
| `e2e/smoke/` | Playwright: draft→Cerca→Pulisci |
| `unit/` | bridge pointer to `backend/tests/test_table_filters.py` |
| `reports/` | junit (gitignored) |
| `run_filter_suite.sh` | one-shot runner |
