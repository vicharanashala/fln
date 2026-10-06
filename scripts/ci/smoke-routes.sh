#!/usr/bin/env bash
# Route smoke test.
#
# Type checking cannot see runtime breakage: a route that hangs because a
# database call has no fallback, a handler that throws on first call, a route
# registered twice so one shadows the other. This boots the real server with
# NO database (the local file store, which is what CI has) and calls every
# parameterless GET /api route as a superadmin and as a teacher.
#
# A route fails the check if it returns 5xx or does not answer in time.
# Routes that were already failing when this check was introduced are listed
# in scripts/ci/smoke-baseline.txt (one per line, with the reason) so they do
# not block unrelated PRs; the check fails only on a NEW failure. Fix a route
# and delete its line — the script tells you when a baseline entry now passes.
#
# Routes are discovered from the source (app.get('/api/...')), so a new route
# is covered the day it is added.
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
PORT="${SMOKE_PORT:-3999}"
BASE="http://127.0.0.1:$PORT"
BASELINE="$ROOT/scripts/ci/smoke-baseline.txt"
LOG="$(mktemp)"
CREATED_DB=0
[ -f "$ROOT/backend/data/db.json" ] || CREATED_DB=1

cleanup() {
  [ -n "${SERVER_PID:-}" ] && { kill "$SERVER_PID" 2>/dev/null; wait "$SERVER_PID" 2>/dev/null; }
  pkill -f "tsx src/index.ts" 2>/dev/null || true
  [ $CREATED_DB -eq 1 ] && rm -f "$ROOT/backend/data/db.json"
}
trap cleanup EXIT

(cd backend && env -u MONGODB_URI PORT="$PORT" NODE_ENV=development npx tsx src/index.ts >"$LOG" 2>&1) &
SERVER_PID=$!

for i in $(seq 1 60); do
  curl -s -o /dev/null --max-time 2 "$BASE/" && break
  sleep 1
  if [ "$i" = 60 ]; then echo "Server did not start within 60s. Log:"; tail -30 "$LOG"; exit 1; fi
done
echo "server up on $BASE"

login() {
  curl -s --max-time 10 -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"${SEED_DEMO_PASSWORD:-Fln@2026}\"}" \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).token||"")}catch{console.log("")}})'
}
SUPER=$(login superadmin@fln.org)
TEACHER=$(login teacher.ap_gnt_gnt_01_01.c2@fln.org)
if [ -z "$SUPER" ] || [ -z "$TEACHER" ]; then echo "Login failed for a seeded demo account — the seed or auth is broken."; tail -20 "$LOG"; exit 1; fi

ROUTES=$(grep -rhoE "app\.get\('/api/[^':]*'" backend/src | sed "s/app.get('//; s/'$//" | sort -u)
echo "probing $(echo "$ROUTES" | wc -l | tr -d ' ') routes as superadmin and teacher"

touch "$BASELINE"
fail=0; fixed=0
declare -a NEW_FAILS
while IFS= read -r r; do
  [ -z "$r" ] && continue
  worst=""
  for t in "$SUPER" "$TEACHER"; do
    code=$(curl -s -o /dev/null --max-time 8 -w '%{http_code}' "$BASE$r" -H "Authorization: Bearer $t")
    [ "$code" = "000" ] && code="HANG"
    case "$code" in 5*|HANG) worst="$code";; esac
  done
  in_base=0; grep -qxE "$r([[:space:]].*)?" <(grep -v '^#' "$BASELINE") && in_base=1
  if [ -n "$worst" ] && [ $in_base -eq 0 ]; then NEW_FAILS+=("$r -> $worst"); fail=1; fi
  if [ -z "$worst" ] && [ $in_base -eq 1 ]; then echo "baseline entry now passes (remove it from smoke-baseline.txt): $r"; fixed=$((fixed+1)); fi
done <<< "$ROUTES"

if [ $fail -eq 1 ]; then
  echo; echo "NEW route failures (5xx or no response):"
  printf '  %s\n' "${NEW_FAILS[@]}"
  echo; echo "Server log tail:"; tail -15 "$LOG"
  exit 1
fi
echo "no new route failures"
