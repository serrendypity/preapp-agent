#!/bin/sh
# End-to-end smoke test against a real PreApp instance.
# Usage:
#   PREAPP_TOKEN=pa_live_xxx [PREAPP_URL=https://preapp.app] sh scripts/smoke-test.sh
# Builds the CLI from source, publishes both examples, and pulls feedback for one.
# Exits non-zero on the first failure.
set -eu

URL="${PREAPP_URL:-https://preapp.app}"
if [ -z "${PREAPP_TOKEN:-}" ]; then
  echo "PREAPP_TOKEN is required (generate one in $URL/dashboard → Install)" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> build CLI"
pnpm --filter @preapp/cli build
CLI="node $ROOT/packages/cli/dist/preapp.js"

echo "==> version"
$CLI --version

STAMP=$(date +%s)

echo "==> publish directory example (with assets)"
$CLI publish "$ROOT/examples/q3-strategy-deck" \
  --title "Smoke: Q3 Strategy" --deck "smoke-deck-$STAMP" --format json \
  --token "$PREAPP_TOKEN" --base-url "$URL"

echo "==> publish single-file example"
$CLI publish "$ROOT/examples/quarterly-report.html" \
  --title "Smoke: Q2 Ops Report" --deck "smoke-report-$STAMP" --format json \
  --token "$PREAPP_TOKEN" --base-url "$URL"

echo "==> republish directory example → v2, stable links"
$CLI publish "$ROOT/examples/q3-strategy-deck" \
  --deck "smoke-deck-$STAMP" --change-note "smoke v2" --format json \
  --token "$PREAPP_TOKEN" --base-url "$URL"

echo "==> feedback get (markdown brief; empty comments is fine)"
$CLI feedback get "smoke-deck-$STAMP" --format markdown \
  --token "$PREAPP_TOKEN" --base-url "$URL" >/dev/null

echo "smoke test OK"
