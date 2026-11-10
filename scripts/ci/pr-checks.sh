#!/usr/bin/env bash
# PR checks — one command that answers "does this change leave the repo working?"
#
# Run by .github/workflows/pr-checks.yml on every pull request, against the
# MERGE of the PR into main (GitHub's default checkout for `pull_request`),
# so it tests the code that would actually land, not just the author's branch.
# You can run the same thing locally:  npm run check:pr
#
# With no argument it runs every group. Name one or more groups to run only those
# (the workflow does this, one job per group, so each shows as its own check on the PR):
#   npm run check:pr -- types eslint
#   groups: consistency  types  eslint  tests-backend  tests-frontend  build  routes
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
#   6. all-routes check      — every route, with no login / as teacher / as superadmin:
#                              unprotected or crashing routes fail (see check-routes.ts)
#   Also: ESLint (bug-class rules, existing errors baselined) and the level-count
#   check (109 levels agree everywhere; stale 59/93 numbers fail — check-levels.ts)
set -u
SELECTED=" $* "
for g in "$@"; do
  case "$g" in consistency|types|eslint|tests-backend|tests-frontend|build|routes) ;;
    *) echo "unknown group: $g (groups: consistency types eslint tests-backend tests-frontend build routes)" >&2; exit 2;; esac
done
want() { [ "$SELECTED" = "  " ] || [[ "$SELECTED" == *" $1 "* ]]; }
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

declare -a NAMES RESULTS LOGS
record() { NAMES+=("$1"); RESULTS+=("$2"); }
section() { printf '\n\033[1m=== %s ===\033[0m\n' "$1"; }
LOG_DIR="$(mktemp -d)"

run() { # run <label> <command...>
  # Output is kept per section so the failing part can be quoted in the PR comment.
  local label="$1"; shift
  local log="$LOG_DIR/${#NAMES[@]}.log"
  section "$label"
  if "$@" >"$log" 2>&1; then record "$label" PASS; else record "$label" FAIL; fi
  cat "$log"
  LOGS+=("$log")
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
if want consistency; then
  run "conflict markers" check_conflict_markers
  run "skill/level snapshot drift" npx tsx scripts/generate-skill-level-map.ts --check
  run "level count consistency" npx tsx scripts/ci/check-levels.ts
fi

# ----------------------------------------------------------- 2. type checks
if want types; then
  run "type check: backend"  npm run lint --workspace @fln/backend  --silent
  run "type check: frontend" npm run lint --workspace @fln/frontend --silent
fi
if want eslint; then
  run "eslint" npx eslint .
fi

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
want tests-backend  && run "tests: backend"  run_backend_tests
want tests-frontend && run "tests: frontend" npm test --workspace @fln/frontend --silent

# ----------------------------------------------------------------- 4. builds
if want build; then
  run "build: frontend" npm run build --workspace @fln/frontend --silent
  run "build: backend"  npm run build --workspace @fln/backend  --silent
fi

# ------------------------------------------------------------ 5. route smoke
if want routes; then
  run "route smoke test" bash "$ROOT/scripts/ci/smoke-routes.sh"
  run "all routes: auth + no crash" npx tsx scripts/ci/check-routes.ts
fi

# ------------------------------------------------------------------- summary
printf '\n\033[1m=== Summary ===\033[0m\n'
failed=0
for i in "${!NAMES[@]}"; do
  printf '  %-28s %s\n' "${NAMES[$i]}" "${RESULTS[$i]}"
  [ "${RESULTS[$i]}" = FAIL ] && failed=1
done
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### ${PR_CHECKS_LABEL:-PR checks}"
    echo
    echo "| Check | Result |"
    echo "|---|---|"
    for i in "${!NAMES[@]}"; do
      echo "| ${NAMES[$i]} | $([ "${RESULTS[$i]}" = PASS ] && echo '✅ pass' || echo '❌ FAIL') |"
    done
    [ $failed -ne 0 ] && echo && echo "Open the **Run PR checks** step for the failing section. To run the same checks locally: \`npm run check:pr\`."
  } >> "$GITHUB_STEP_SUMMARY"
fi
# Report for the PR comment bot (.github/workflows/pr-checks-comment.yml). Only written
# when PR_CHECKS_REPORT names a file, so a local run is unchanged.
if [ -n "${PR_CHECKS_REPORT:-}" ]; then
  mkdir -p "$(dirname "$PR_CHECKS_REPORT")"
  {
    # One report per job; the comment bot stitches them together under its own heading.
    if [ $failed -eq 0 ]; then echo "#### ✅ ${PR_CHECKS_LABEL:-PR checks}"; else echo "#### ❌ ${PR_CHECKS_LABEL:-PR checks}"; fi
    echo
    echo "| Check | Result |"
    echo "|---|---|"
    for i in "${!NAMES[@]}"; do
      echo "| ${NAMES[$i]} | $([ "${RESULTS[$i]}" = PASS ] && echo '✅' || echo '❌') |"
    done
    for i in "${!NAMES[@]}"; do
      [ "${RESULTS[$i]}" = FAIL ] || continue
      echo
      echo "**${NAMES[$i]}** — last lines of its output:"
      echo
      echo '```text'
      # strip colour codes, and turn any ``` into ''' so the output cannot break out of the block
      tail -n 25 "${LOGS[$i]}" | sed -e $'s/\x1b\\[[0-9;]*m//g' -e "s/\`\`\`/'''/g" -e "s#$ROOT/##g" | cut -c1-300
      echo '```'
    done
    if [ $failed -ne 0 ]; then
      echo
      echo "To run this on your computer: \`npm install\`, then \`npm run check:pr${*:+ -- $*}\`. Fix what is listed above and push again; this comment updates itself."
    fi
  } > "$PR_CHECKS_REPORT"
fi
[ $failed -eq 0 ] && echo "All checks passed." || echo "One or more checks FAILED — see the sections above."
exit $failed
