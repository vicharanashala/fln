#!/usr/bin/env bash
# PR checks — one command that answers "does this change leave the repo working?"
#
# Run by .github/workflows/pr-checks.yml on every pull request, against the
# MERGE of the PR into main (GitHub's default checkout for `pull_request`),
# so it tests the code that would actually land, not just the author's branch.
# You can run the same thing locally:  npm run check:pr
#
# It runs every section even if an earlier one fails, then prints a summary,
# so one failure doesn't hide another.
#
# Sections:
#   1. conflict markers      — no leftover <<<<<<< / ======= / >>>>>>> in changed files
#   2. type check            — backend and frontend `tsc --noEmit`. This is also the
#                              "did this break some other file?" check: tsc compiles
#                              every importer of every changed export.
#   3. tests                 — every `test:*` script in backend/package.json (auto-
#                              discovered, so a new test script is picked up with no
#                              edit here), `npm test` in backend, and frontend vitest
#   4. builds                — frontend `vite build` and backend bundle
#   5. route smoke test      — boots the server with no database and calls every
#                              parameterless GET route (see smoke-routes.sh)
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

declare -a NAMES RESULTS
record() { NAMES+=("$1"); RESULTS+=("$2"); }
section() { printf '\n\033[1m=== %s ===\033[0m\n' "$1"; }

run() { # run <label> <command...>
  local label="$1"; shift
  section "$label"
  if "$@"; then record "$label" PASS; else record "$label" FAIL; fi
}

# ---------------------------------------------------------------- 1. markers
check_conflict_markers() {
  local base files bad=0
  # In CI the checkout is the merge commit, so HEAD^1 is the base branch tip.
  if git rev-parse --verify -q HEAD^2 >/dev/null; then base=HEAD^1; else base="${PR_BASE:-origin/main}"; fi
  files=$(git diff --name-only --diff-filter=AM "$base" HEAD 2>/dev/null \
    | grep -E '\.(ts|tsx|js|jsx|cjs|mjs|json|html|css|md|yml|yaml|py)$' || true)
  [ -z "$files" ] && { echo "no changed source files"; return 0; }
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    if grep -nE '^(<<<<<<< |>>>>>>> |=======$)' "$f" >/dev/null 2>&1; then
      echo "conflict marker in $f:"; grep -nE '^(<<<<<<< |>>>>>>> |=======$)' "$f" | head -3; bad=1
    fi
  done <<< "$files"
  [ $bad -eq 0 ] && echo "none found"
  return $bad
}
run "conflict markers" check_conflict_markers

# ----------------------------------------------------------- 2. type checks
run "type check: backend"  npm run lint --workspace @fln/backend  --silent
run "type check: frontend" npm run lint --workspace @fln/frontend --silent

# ------------------------------------------------------------------ 3. tests
run_backend_tests() {
  local rc=0 t
  # Every test:* script is run. Add a script to backend/package.json and it is
  # included automatically; a failing new test fails the PR.
  for t in $(node -e 'const s=require("./backend/package.json").scripts;console.log(Object.keys(s).filter(k=>k.startsWith("test:")).join(" "))'); do
    printf -- '--- backend %s\n' "$t"
    npm run "$t" --workspace @fln/backend --silent || { echo "FAILED: $t"; rc=1; }
  done
  printf -- '--- backend npm test\n'
  npm test --workspace @fln/backend --silent || { echo "FAILED: npm test"; rc=1; }
  return $rc
}
run "tests: backend"  run_backend_tests
run "tests: frontend" npm test --workspace @fln/frontend --silent

# ----------------------------------------------------------------- 4. builds
run "build: frontend" npm run build --workspace @fln/frontend --silent
run "build: backend"  npm run build --workspace @fln/backend  --silent

# ------------------------------------------------------------ 5. route smoke
run "route smoke test" bash "$ROOT/scripts/ci/smoke-routes.sh"

# ------------------------------------------------------------------- summary
printf '\n\033[1m=== Summary ===\033[0m\n'
failed=0
for i in "${!NAMES[@]}"; do
  printf '  %-28s %s\n' "${NAMES[$i]}" "${RESULTS[$i]}"
  [ "${RESULTS[$i]}" = FAIL ] && failed=1
done
[ $failed -eq 0 ] && echo "All checks passed." || echo "One or more checks FAILED — see the sections above."
exit $failed
