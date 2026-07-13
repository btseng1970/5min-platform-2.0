#!/usr/bin/env bash
# FND-000 environment smoke test + partition capability test.
# Used locally (after scripts/dev/up.sh) and by .github/workflows/ci.yml.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

export DATABASE_URL="${DATABASE_URL:-postgres://fivemin:fivemin@localhost:55432/fivemin_dev}"

pushd scripts/dev > /dev/null
npm ci
node smoke-test.mjs
node partition-test.mjs
popd > /dev/null

echo "All FND-000 environment checks passed."
