#!/usr/bin/env bash
set -e
cd 'C:/Users/sahil/Documents/FLN-12/fln'

LOGIN=$(curl -sS -m 5 http://127.0.0.1:3000/api/auth/login \
  -X POST -H 'Content-Type: application/json' \
  --data '{"email":"superadmin@fln.org","password":"Fln@2026"}')
TOKEN=$(printf '%s' "$LOGIN" | python -c 'import sys,json;print(json.load(sys.stdin)["token"])')
echo "TOKEN_LEN=${#TOKEN}"

echo '--- POST /api/schools (with extended fields) ---'
curl -sS -m 8 http://127.0.0.1:3000/api/schools \
  -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"id":"gps-i1-test-001","name":"GPS Issue1 Verification","stateCode":"PB","districtCode":"LDH","blockCode":"LDH-01","strength":"low","address":"123 Test Lane, Model Town","pincode":"141001","udiseCode":"03150100199","schoolType":"primary","establishedYear":1995,"contactEmail":"test@school.org","contactPhone":"+91 98765 43210"}'
echo

echo '--- GET that school back from /api/schools ---'
curl -sS -m 8 http://127.0.0.1:3000/api/schools \
  -H "Authorization: Bearer $TOKEN" \
  | python -c "import sys,json;rows=json.load(sys.stdin);m=[r for r in rows if r['id']=='gps-i1-test-001'];print(json.dumps(m,indent=2,default=str) if m else 'NOT FOUND')"
