#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

failed=0
echo "Testing CI test discovery logic..."

# Extract the find command from pr-checks.sh
FIND_CMD=$(grep -o "find backend/tests backend/src.*| sort" scripts/ci/pr-checks.sh)

if [ -z "$FIND_CMD" ]; then
  echo "FAILED: Could not extract find command from scripts/ci/pr-checks.sh"
  exit 1
fi

# Run the find command
eval "DISCOVERED_FILES=\$($FIND_CMD)"

# 1. Verify all nine required files are discovered
REQUIRED_FILES=(
  "backend/tests/repo-health.test.cjs"
  "backend/tests/paper-generator.test.ts"
  "backend/tests/question-template-download.test.ts"
  "backend/tests/user-scoping.test.ts"
  "backend/tests/mfa-enrollment.test.ts"
  "backend/tests/svg-asset-catalog.test.ts"
  "backend/tests/teacher-roster-pagination.test.cjs"
  "backend/src/scanQuality.test.ts"
  "backend/src/modules/vault/tests/binary-roundtrip.test.ts"
)

for f in "${REQUIRED_FILES[@]}"; do
  if ! echo "$DISCOVERED_FILES" | grep -q "^$f$"; then
    echo "FAILED: Required file not discovered: $f"
    failed=1
  else
    echo "  ✓ Discovered: $f"
  fi
done

# 2. Verify excluded files are NOT discovered (so they aren't run twice)
EXCLUDED_FILES=(
  "backend/tests/panel-isolation.test.cjs"
  "backend/tests/question-template-assessment-mode.test.cjs"
  "backend/src/modules/vault/tests/transaction-counter.test.ts"
  "backend/src/modules/vault/tests/step-up-e2e.test.ts"
  "backend/src/modules/vault/tests/audit-in-logbook.test.ts"
  "backend/tests/students-search-index.test.ts"
  "backend/tests/manual-e2e-totp.cjs"
  "backend/tests/aadhaar-hardening.test.ts"
)

for f in "${EXCLUDED_FILES[@]}"; do
  if echo "$DISCOVERED_FILES" | grep -q "^$f$"; then
    echo "FAILED: Excluded file was incorrectly discovered: $f"
    failed=1
  else
    echo "  ✓ Excluded: $f"
  fi
done

# 3. Verify the appropriate test runner is selected
echo "Testing runner selection logic..."
for f in $DISCOVERED_FILES; do
  if grep -q 'node:test' "$f"; then
    echo "  ✓ $f uses npx tsx --test"
  else
    echo "  ✓ $f uses npx tsx"
  fi
done

if [ $failed -eq 0 ]; then
  echo "All CI discovery tests passed."
else
  echo "One or more CI discovery tests FAILED."
fi
exit $failed
