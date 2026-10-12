#!/usr/bin/env bash
# Run filter-propagation suite (api + unit; optional e2e / slow).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

WITH_E2E=0
WITH_SLOW=0
WITH_ALL=0
for arg in "$@"; do
  case "$arg" in
    --e2e) WITH_E2E=1 ;;
    --slow) WITH_SLOW=1 ;;
    --all) WITH_ALL=1; WITH_E2E=1; WITH_SLOW=1 ;;
    -h|--help)
      echo "Usage: $0 [--e2e] [--slow] [--all]"
      exit 0
      ;;
  esac
done

export API_BASE="${API_BASE:-http://localhost:8000}"
export BASE_URL="${BASE_URL:-http://localhost:5173}"
export FILTER_TEST_LOG="${FILTER_TEST_LOG:-1}"
mkdir -p reports

if [[ "$WITH_ALL" -eq 1 ]] || [[ "$WITH_SLOW" -eq 1 ]]; then
  MARK='live'
else
  MARK='live and not slow'
fi

echo "==> api ($MARK)"
python3 -m pytest api/ -m "$MARK" -v --tb=short --junitxml=reports/junit-api.xml

echo "==> unit"
python3 -m pytest unit -v --tb=short --junitxml=reports/junit-unit.xml

if [[ "$WITH_E2E" -eq 1 ]]; then
  echo "==> e2e smoke (BASE_URL=$BASE_URL)"
  python3 -m pytest e2e/smoke -m e2e -v --tb=short --junitxml=reports/junit-e2e.xml
fi

echo "OK — see reports/junit-*.xml and backend/.filter-test-runtime.ndjson"
