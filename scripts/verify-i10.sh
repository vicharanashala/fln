#!/usr/bin/env bash
set -e
cd 'C:/Users/sahil/Documents/FLN-12/fln'

SUPERTOKEN=$(curl -sS -m 5 http://127.0.0.1:3000/api/auth/login \
  -X POST -H 'Content-Type: application/json' \
  --data '{"email":"superadmin@fln.org","password":"Fln@2026"}' \
  | python -c 'import sys,json;print(json.load(sys.stdin)["token"])')

# Setup: school A gps-i10-A in PB/LDH/LDH-01 and school B gps-i10-B in HR/AMB/AMB-01.
echo '--- Setup ---'
curl -sS -m 5 http://127.0.0.1:3000/api/schools \
  -X POST -H "Authorization: Bearer $SUPERTOKEN" -H 'Content-Type: application/json' \
  --data '{"id":"gps-i10-A","name":"GPS Issue10 A","stateCode":"PB","districtCode":"LDH","blockCode":"LDH-01","strength":"low"}' >/dev/null
curl -sS -m 5 http://127.0.0.1:3000/api/schools \
  -X POST -H "Authorization: Bearer $SUPERTOKEN" -H 'Content-Type: application/json' \
  --data '{"id":"gps-i10-B","name":"GPS Issue10 B","stateCode":"HR","districtCode":"AMB","blockCode":"AMB-01","strength":"low"}' >/dev/null
echo 'schools ready.'

# 1) Happy path: omit geo, derive from school.
echo '--- 1) Teacher at own school (no geo submitted) ---'
curl -sS -m 5 http://127.0.0.1:3000/api/admin/create \
  -X POST -H "Authorization: Bearer $SUPERTOKEN" -H 'Content-Type: application/json' \
  --data '{"name":"Teacher A","email":"t.i10.a@fln.org","password":"Pass@1234","role":"teacher","schoolId":"gps-i10-A"}' \
  -w '\nHTTP=%{http_code}\n' \
  | python -c "
import sys,json
raw=sys.stdin.read()
try:
    d=json.loads(raw.split('\nHTTP')[0])
    print(json.dumps({k:d.get(k) for k in ('email','role','schoolId','stateCode','districtCode','blockCode')},indent=2))
except Exception as e:
    print('PARSE_FAIL:',e); print(raw[:300])
"

# 2) Happy path: matching geo.
echo '--- 2) Teacher at own school with matching geo PB/LDH/LDH-01 ---'
curl -sS -m 5 http://127.0.0.1:3000/api/admin/create \
  -X POST -H "Authorization: Bearer $SUPERTOKEN" -H 'Content-Type: application/json' \
  --data '{"name":"Teacher B","email":"t.i10.b@fln.org","password":"Pass@1234","role":"teacher","schoolId":"gps-i10-A","stateCode":"PB","districtCode":"LDH","blockCode":"LDH-01"}' \
  -w '\nHTTP=%{http_code}\n'

# 3) Bad: missing schoolId.
echo
echo '--- 3) Teacher missing schoolId ---'
curl -sS -m 5 http://127.0.0.1:3000/api/admin/create \
  -X POST -H "Authorization: Bearer $SUPERTOKEN" -H 'Content-Type: application/json' \
  --data '{"name":"Teacher C","email":"t.i10.c@fln.org","password":"Pass@1234","role":"teacher"}' \
  -w '\nHTTP=%{http_code}\n'

# 4) Bad: unknown school.
echo
echo '--- 4) Teacher with unknown schoolId ---'
curl -sS -m 5 http://127.0.0.1:3000/api/admin/create \
  -X POST -H "Authorization: Bearer $SUPERTOKEN" -H 'Content-Type: application/json' \
  --data '{"name":"Teacher D","email":"t.i10.d@fln.org","password":"Pass@1234","role":"teacher","schoolId":"gps-does-not-exist"}' \
  -w '\nHTTP=%{http_code}\n'

# 5) Bad: cross-school attempt (school A but with school's B geo).
echo
echo '--- 5) Cross-school geo (school A + HR/AMB/AMB-01) ---'
curl -sS -m 5 http://127.0.0.1:3000/api/admin/create \
  -X POST -H "Authorization: Bearer $SUPERTOKEN" -H 'Content-Type: application/json' \
  --data '{"name":"Teacher E","email":"t.i10.e@fln.org","password":"Pass@1234","role":"teacher","schoolId":"gps-i10-A","stateCode":"HR","districtCode":"AMB","blockCode":"AMB-01"}' \
  -w '\nHTTP=%{http_code}\n'

# 6) Verify the two teachers can log in and inherit the school's geo.
echo
echo '--- 6) Teacher A login + scope ---'
TAUTH=$(curl -sS -m 5 http://127.0.0.1:3000/api/auth/login \
  -X POST -H 'Content-Type: application/json' \
  --data '{"email":"t.i10.a@fln.org","password":"Pass@1234"}' \
  | python -c 'import sys,json;print(json.load(sys.stdin)["token"])')
curl -sS -m 5 http://127.0.0.1:3000/api/auth/me \
  -H "Authorization: Bearer $TAUTH" \
  | python -c 'import sys,json;d=json.load(sys.stdin);u=d.get("user",{});print(json.dumps({k:u.get(k) for k in ("email","role","schoolId","stateCode","districtCode","blockCode")},indent=2))'

# 7) Verify /api/admin/coordinators shows both teachers with full scope.
echo
echo '--- 7) /api/admin/coordinators filter ---'
curl -sS -m 5 http://127.0.0.1:3000/api/admin/coordinators \
  -H "Authorization: Bearer $SUPERTOKEN" \
  -o C:/Users/sahil/AppData/Local/Temp/i10-coords.json
python -c "
import json
rows = json.load(open('C:/Users/sahil/AppData/Local/Temp/i10-coords.json', encoding='utf-8'))
mine = [r for r in rows if 'i10' in r.get('email', '')]
print(json.dumps([{'email':r['email'],'role':r['role'],'schoolId':r.get('schoolId'),'stateCode':r.get('stateCode'),'districtCode':r.get('districtCode'),'blockCode':r.get('blockCode')} for r in mine],indent=2))
"
