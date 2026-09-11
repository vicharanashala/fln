#!/usr/bin/env bash
set -e
cd 'C:/Users/sahil/Documents/FLN-12/fln'

# Use the seeded principal that exists in Atlas (school.ap_gnt_gnt_01_01@fln.org
# -> AP_GNT_GNT_01_01 "GPS Central Guntur"). All seeded accounts share the
# demo password Fln@2026.
EXISTING='school.ap_gnt_gnt_01_01@fln.org'

echo "--- Existing Atlas principal: $EXISTING ---"
TOKEN=$(curl -sS -m 5 http://127.0.0.1:3000/api/auth/login \
  -X POST -H 'Content-Type: application/json' \
  --data "{\"email\":\"$EXISTING\",\"password\":\"Fln@2026\"}" \
  | python -c 'import sys,json;print(json.load(sys.stdin).get("token",""))')
if [ -z "$TOKEN" ]; then
  echo 'Login failed for seeded principal.'
  exit 1
fi

echo '--- /api/schools as principal ---'
curl -sS -m 5 http://127.0.0.1:3000/api/schools \
  -H "Authorization: Bearer $TOKEN"
echo

echo '--- /api/auth/me as principal ---'
curl -sS -m 5 http://127.0.0.1:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
echo

# Now create a fresh principal for a brand-new school (different geo) and
# verify /api/schools still returns only their own school — not any other.
echo '--- Setup: new school gps-i3-test-001 + new principal ---'
SUPERTOKEN=$(curl -sS -m 5 http://127.0.0.1:3000/api/auth/login \
  -X POST -H 'Content-Type: application/json' \
  --data '{"email":"superadmin@fln.org","password":"Fln@2026"}' \
  | python -c 'import sys,json;print(json.load(sys.stdin)["token"])')
curl -sS -m 5 http://127.0.0.1:3000/api/schools \
  -X POST -H "Authorization: Bearer $SUPERTOKEN" -H 'Content-Type: application/json' \
  --data '{"id":"gps-i3-test-001","name":"GPS Issue3 Verification","stateCode":"PB","districtCode":"JAI","blockCode":"JAI-01","strength":"low","address":"42 Model Avenue","pincode":"144001"}' \
  >/dev/null
curl -sS -m 5 http://127.0.0.1:3000/api/admin/create \
  -X POST -H "Authorization: Bearer $SUPERTOKEN" -H 'Content-Type: application/json' \
  --data '{"name":"Principal Issue3","email":"p.i3@fln.org","password":"Pass@1234","role":"school","schoolId":"gps-i3-test-001"}' \
  >/dev/null
echo 'school and principal created.'

PTOKEN=$(curl -sS -m 5 http://127.0.0.1:3000/api/auth/login \
  -X POST -H 'Content-Type: application/json' \
  --data '{"email":"p.i3@fln.org","password":"Pass@1234"}' \
  | python -c 'import sys,json;print(json.load(sys.stdin)["token"])')

echo '--- /api/schools as new principal (should be ONLY gps-i3-test-001) ---'
curl -sS -m 5 http://127.0.0.1:3000/api/schools \
  -H "Authorization: Bearer $PTOKEN"
echo
