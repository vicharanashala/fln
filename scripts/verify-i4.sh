#!/usr/bin/env bash
set -e
cd 'C:/Users/sahil/Documents/FLN-12/fln'

SUPERTOKEN=$(curl -sS -m 5 http://127.0.0.1:3000/api/auth/login \
  -X POST -H 'Content-Type: application/json' \
  --data '{"email":"superadmin@fln.org","password":"Fln@2026"}' \
  | python -c 'import sys,json;print(json.load(sys.stdin)["token"])')

# Setup: create a brand-new school gps-i4-test-001 + principal for it.
echo '--- Setup: school gps-i4-test-001 ---'
curl -sS -m 5 http://127.0.0.1:3000/api/schools \
  -X POST -H "Authorization: Bearer $SUPERTOKEN" -H 'Content-Type: application/json' \
  --data '{"id":"gps-i4-test-001","name":"GPS Issue4 Test","stateCode":"PB","districtCode":"LDH","blockCode":"LDH-01","strength":"low"}' \
  | python -c 'import sys,json;d=json.load(sys.stdin);print(json.dumps({k:d.get(k) for k in ("id","name","stateCode","districtCode","blockCode")},indent=2))'

# Need a second school so we can test the cross-school rejection.
echo '--- Setup: school gps-i4-test-002 (different school) ---'
curl -sS -m 5 http://127.0.0.1:3000/api/schools \
  -X POST -H "Authorization: Bearer $SUPERTOKEN" -H 'Content-Type: application/json' \
  --data '{"id":"gps-i4-test-002","name":"GPS Issue4 Other","stateCode":"PB","districtCode":"JAI","blockCode":"JAI-01","strength":"low"}' \
  >/dev/null
echo 'second school created.'

echo '--- Create principal for gps-i4-test-001 ---'
curl -sS -m 5 http://127.0.0.1:3000/api/admin/create \
  -X POST -H "Authorization: Bearer $SUPERTOKEN" -H 'Content-Type: application/json' \
  --data '{"name":"Issue4 Principal","email":"p.i4@fln.org","password":"Pass@1234","role":"school","schoolId":"gps-i4-test-001"}' \
  | python -c 'import sys,json;d=json.load(sys.stdin);print(json.dumps({k:d.get(k) for k in ("email","role","schoolId","stateCode")},indent=2))'

PTOKEN=$(curl -sS -m 5 http://127.0.0.1:3000/api/auth/login \
  -X POST -H 'Content-Type: application/json' \
  --data '{"email":"p.i4@fln.org","password":"Pass@1234"}' \
  | python -c 'import sys,json;print(json.load(sys.stdin)["token"])')

# 1) Happy path: principal adds a teacher at their own school.
echo '--- 1) Happy path: principal adds teacher at own school ---'
curl -sS -m 5 http://127.0.0.1:3000/api/teachers \
  -X POST -H "Authorization: Bearer $PTOKEN" -H 'Content-Type: application/json' \
  --data '{"firstName":"Anita","lastName":"Kaur","email":"t.i4.a@fln.org","password":"Pass@1234","school":"gps-i4-test-001"}' \
  -w '\nHTTP=%{http_code}\n'
echo

# 2) Happy path 2: omit school (principal doesn't need to specify it).
echo '--- 2) Omit school: principal adds teacher at own school ---'
curl -sS -m 5 http://127.0.0.1:3000/api/teachers \
  -X POST -H "Authorization: Bearer $PTOKEN" -H 'Content-Type: application/json' \
  --data '{"firstName":"Bobby","lastName":"Singh","email":"t.i4.b@fln.org","password":"Pass@1234"}' \
  -w '\nHTTP=%{http_code}\n'
echo

# 3) Bad: cross-school attempt.
echo '--- 3) Cross-school rejection (principal tries gps-i4-test-002) ---'
curl -sS -m 5 http://127.0.0.1:3000/api/teachers \
  -X POST -H "Authorization: Bearer $PTOKEN" -H 'Content-Type: application/json' \
  --data '{"firstName":"Charlie","lastName":"Verma","email":"t.i4.c@fln.org","password":"Pass@1234","school":"gps-i4-test-002"}' \
  -w '\nHTTP=%{http_code}\n'
echo

# 4) Verify teacher list for principal shows only own-school teachers.
# NB: GET /api/teachers is intentionally slow on large student collections
# because it pulls all students into memory to compute per-teacher counts
# (pre-existing perf bug, not introduced by Issue 4). 60s timeout.
echo '--- 4) GET /api/teachers as principal ---'
curl -sS -m 60 http://127.0.0.1:3000/api/teachers \
  -H "Authorization: Bearer $PTOKEN" \
  -o C:/Users/sahil/AppData/Local/Temp/i4-teachers.json \
  -w 'HTTP=%{http_code} time=%{time_total}s\n'
python -c "import json;rows=json.load(open('C:/Users/sahil/AppData/Local/Temp/i4-teachers.json',encoding='utf-8'));print(json.dumps([{'name':r['name'],'email':r['email'],'schoolId':r['schoolId']} for r in rows],indent=2))"
echo

# 5) Verify teacher can log in.
echo '--- 5) New teacher logs in ---'
curl -sS -m 5 http://127.0.0.1:3000/api/auth/login \
  -X POST -H 'Content-Type: application/json' \
  --data '{"email":"t.i4.a@fln.org","password":"Pass@1234"}' \
  | python -c 'import sys,json;d=json.load(sys.stdin);u=d.get("user",{});print(json.dumps({k:u.get(k) for k in ("email","role","schoolId","stateCode","districtCode","blockCode")},indent=2))'
echo

# 6) Bad: duplicate email.
echo '--- 6) Duplicate email ---'
curl -sS -m 5 http://127.0.0.1:3000/api/teachers \
  -X POST -H "Authorization: Bearer $PTOKEN" -H 'Content-Type: application/json' \
  --data '{"firstName":"Anita","lastName":"Kaur","email":"t.i4.a@fln.org","password":"Pass@1234"}' \
  -w '\nHTTP=%{http_code}\n'
echo

# 7) Bad: weak password.
echo '--- 7) Weak password ---'
curl -sS -m 5 http://127.0.0.1:3000/api/teachers \
  -X POST -H "Authorization: Bearer $PTOKEN" -H 'Content-Type: application/json' \
  --data '{"firstName":"D","lastName":"E","email":"t.i4.d@fln.org","password":"weak","school":"gps-i4-test-001"}' \
  -w '\nHTTP=%{http_code}\n'
echo
