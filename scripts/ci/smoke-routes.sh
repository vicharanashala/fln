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
# Always start from a FRESH file-store seed, so a local run behaves exactly like
# CI. A db.json left over from earlier local runs is moved aside and restored.
DB="$ROOT/backend/data/db.json"
STASH=""
if [ -f "$DB" ]; then STASH="$DB.smoke-backup"; mv "$DB" "$STASH"; fi

cleanup() {
  [ -n "${SERVER_PID:-}" ] && { kill "$SERVER_PID" 2>/dev/null; wait "$SERVER_PID" 2>/dev/null; }
  pkill -f "tsx src/index.ts" 2>/dev/null || true
  rm -f "$DB"
  [ -n "$STASH" ] && mv "$STASH" "$DB"
}
trap cleanup EXIT

(cd backend && env -u MONGODB_URI PORT="$PORT" NODE_ENV=development npx tsx src/index.ts >"$LOG" 2>&1) &
SERVER_PID=$!

# "Port open" is not "ready": the server listens before its seed has finished,
# so wait for its own "Server running" line, then retry the login until the
# seeded accounts exist.
for i in $(seq 1 90); do
  grep -q "Server running on" "$LOG" && break
  sleep 1
  if [ "$i" = 90 ]; then echo "Server did not start within 90s. Log:"; tail -30 "$LOG"; exit 1; fi
done
echo "server up on $BASE"

login() {
  curl -s --max-time 10 -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"${SEED_DEMO_PASSWORD:-Fln@2026}\"}" \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).token||"")}catch{console.log("")}})'
}
login_retry() { # login_retry <email> — up to ~60s for the seed to finish
  local t="" n
  for n in $(seq 1 30); do t=$(login "$1"); [ -n "$t" ] && break; sleep 2; done
  echo "$t"
}
SUPER=$(login_retry superadmin@fln.org)
# A teacher account from the fresh file-store seed (the Mongo seed uses other
# addresses, so the second is a fallback for a database that was seeded that way).
TEACHER=$(login_retry gps-mt-001.t01@fln.org)
[ -z "$TEACHER" ] && TEACHER=$(login_retry teacher.ap_gnt_gnt_01_01.c2@fln.org)
if [ -z "$SUPER" ] || [ -z "$TEACHER" ]; then
  echo "Login failed after 60s (superadmin: ${SUPER:+ok}${SUPER:-FAILED}, teacher: ${TEACHER:+ok}${TEACHER:-FAILED}) — the seed or auth is broken."
  echo "Raw response from the server:"
  curl -s -i --max-time 10 -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"superadmin@fln.org\",\"password\":\"${SEED_DEMO_PASSWORD:-Fln@2026}\"}" | head -20
  tail -20 "$LOG"; exit 1
fi

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
