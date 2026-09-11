#!/usr/bin/env bash
set -e
cd 'C:/Users/sahil/Documents/FLN-12/fln'

TOKEN=$(curl -sS -m 5 http://127.0.0.1:3000/api/auth/login \
  -X POST -H 'Content-Type: application/json' \
  --data '{"email":"superadmin@fln.org","password":"Fln@2026"}' \
  | python -c 'import sys,json;print(json.load(sys.stdin)["token"])')

# Create a school for this run.
echo '--- Setup: onboard test school gps-i2-test-001 ---'
curl -sS -m 5 http://127.0.0.1:3000/api/schools \
  -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"id":"gps-i2-test-001","name":"GPS Issue2 Test","stateCode":"PB","districtCode":"LDH","blockCode":"LDH-01","strength":"low"}' \
  | python -c 'import sys,json;print(json.dumps(json.load(sys.stdin),indent=2))'
echo

# 1) Happy path: omit geo, derive from school.
echo '--- 1) Happy path: schoolId only, geo derived from school ---'
curl -sS -m 5 http://127.0.0.1:3000/api/admin/create \
  -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"name":"Principal A","email":"p.a.i2@fln.org","password":"Pass@1234","role":"school","schoolId":"gps-i2-test-001"}' \
  | python -c 'import sys,json;d=json.load(sys.stdin);u={k:d.get(k) for k in ("email","role","schoolId","stateCode","districtCode","blockCode")};print(json.dumps(u,indent=2))'
echo

# 2) Happy path: matching geo submitted.
echo '--- 2) Matching geo: PB/LDH/LDH-01 (matches school) ---'
curl -sS -m 5 http://127.0.0.1:3000/api/admin/create \
  -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"name":"Principal B","email":"p.b.i2@fln.org","password":"Pass@1234","role":"school","schoolId":"gps-i2-test-001","stateCode":"PB","districtCode":"LDH","blockCode":"LDH-01"}' \
  | python -c 'import sys,json;d=json.load(sys.stdin);u={k:d.get(k) for k in ("email","role","schoolId","stateCode","districtCode","blockCode")};print(json.dumps(u,indent=2))'
echo

# 3) Bad: schoolId not provided.
echo '--- 3) Missing schoolId ---'
curl -sS -m 5 http://127.0.0.1:3000/api/admin/create \
  -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"name":"Principal C","email":"p.c.i2@fln.org","password":"Pass@1234","role":"school"}' \
  -w '\nHTTP=%{http_code}\n'
echo

# 4) Bad: unknown school.
echo '--- 4) Unknown school ---'
curl -sS -m 5 http://127.0.0.1:3000/api/admin/create \
  -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"name":"Principal D","email":"p.d.i2@fln.org","password":"Pass@1234","role":"school","schoolId":"gps-does-not-exist"}' \
  -w '\nHTTP=%{http_code}\n'
echo

# 5) Bad: conflicting stateCode.
echo '--- 5) Conflicting stateCode (HR vs school PB) ---'
curl -sS -m 5 http://127.0.0.1:3000/api/admin/create \
  -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"name":"Principal E","email":"p.e.i2@fln.org","password":"Pass@1234","role":"school","schoolId":"gps-i2-test-001","stateCode":"HR"}' \
  -w '\nHTTP=%{http_code}\n'
echo

# 6) Bad: conflicting districtCode.
echo '--- 6) Conflicting districtCode (JAI vs school LDH) ---'
curl -sS -m 5 http://127.0.0.1:3000/api/admin/create \
  -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"name":"Principal F","email":"p.f.i2@fln.org","password":"Pass@1234","role":"school","schoolId":"gps-i2-test-001","districtCode":"JAI"}' \
  -w '\nHTTP=%{http_code}\n'
echo

# 7) Bad: conflicting blockCode.
echo '--- 7) Conflicting blockCode (LDH-99 vs school LDH-01) ---'
curl -sS -m 5 http://127.0.0.1:3000/api/admin/create \
  -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"name":"Principal G","email":"p.g.i2@fln.org","password":"Pass@1234","role":"school","schoolId":"gps-i2-test-001","blockCode":"LDH-99"}' \
  -w '\nHTTP=%{http_code}\n'
echo

# 8) Verify the principals show up in /api/admin/coordinators with the right scope.
echo '--- 8) Verify created principals appear in /api/admin/coordinators with derived scope ---'
curl -sS -m 5 http://127.0.0.1:3000/api/admin/coordinators \
  -H "Authorization: Bearer $TOKEN" \
  | python -c 'import sys,json;rows=json.load(sys.stdin);mine=[r for r in rows if r.get("email","").endswith(".i2@fln.org")];print(json.dumps(mine,indent=2))'
echo
