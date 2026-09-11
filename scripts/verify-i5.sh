#!/usr/bin/env bash
set -e
cd 'C:/Users/sahil/Documents/FLN-12/fln'

SUPERTOKEN=$(curl -sS -m 5 http://127.0.0.1:3000/api/auth/login \
  -X POST -H 'Content-Type: application/json' \
  --data '{"email":"superadmin@fln.org","password":"Fln@2026"}' \
  | python -c 'import sys,json;print(json.load(sys.stdin)["token"])')

echo '--- Setup: school A gps-i5-A and school B gps-i5-B ---'
curl -sS -m 5 http://127.0.0.1:3000/api/schools \
  -X POST -H "Authorization: Bearer $SUPERTOKEN" -H 'Content-Type: application/json' \
  --data '{"id":"gps-i5-A","name":"GPS Issue5 A","stateCode":"PB","districtCode":"LDH","blockCode":"LDH-01","strength":"low"}' >/dev/null
curl -sS -m 5 http://127.0.0.1:3000/api/schools \
  -X POST -H "Authorization: Bearer $SUPERTOKEN" -H 'Content-Type: application/json' \
  --data '{"id":"gps-i5-B","name":"GPS Issue5 B","stateCode":"PB","districtCode":"JAI","blockCode":"JAI-01","strength":"low"}' >/dev/null
curl -sS -m 5 http://127.0.0.1:3000/api/admin/create \
  -X POST -H "Authorization: Bearer $SUPERTOKEN" -H 'Content-Type: application/json' \
  --data '{"name":"Principal Issue5","email":"p.i5@fln.org","password":"Pass@1234","role":"school","schoolId":"gps-i5-A"}' >/dev/null
echo 'setup done.'

PTOKEN=$(curl -sS -m 5 http://127.0.0.1:3000/api/auth/login \
  -X POST -H 'Content-Type: application/json' \
  --data '{"email":"p.i5@fln.org","password":"Pass@1234"}' \
  | python -c 'import sys,json;print(json.load(sys.stdin)["token"])')

echo '--- 1) Principal registers student at own school ---'
curl -sS -m 5 http://127.0.0.1:3000/api/students \
  -X POST -H "Authorization: Bearer $PTOKEN" -H 'Content-Type: application/json' \
  --data '{"name":"Aarav Singh","age":8,"classGroup":"Class 2","section":"A","aadharNumber":"998800001111","address":"42 Model Town"}' \
  -o C:/Users/sahil/AppData/Local/Temp/i5-r1.json \
  -w '\nHTTP=%{http_code}\n'
python -c "import json;d=json.load(open('C:/Users/sahil/AppData/Local/Temp/i5-r1.json',encoding='utf-8'));print(json.dumps({k:d.get(k) for k in ('name','age','classGroup','section','schoolId','aadharMasked')},indent=2))"
echo

echo '--- 2) Same again, omit schoolId ---'
curl -sS -m 5 http://127.0.0.1:3000/api/students \
  -X POST -H "Authorization: Bearer $PTOKEN" -H 'Content-Type: application/json' \
  --data '{"name":"Diya Kaur","age":7,"classGroup":"Class 2","section":"B","aadharNumber":"998800002222"}' \
  -w '\nHTTP=%{http_code}\n'
echo

echo '--- 3) Cross-school rejection ---'
curl -sS -m 5 http://127.0.0.1:3000/api/students \
  -X POST -H "Authorization: Bearer $PTOKEN" -H 'Content-Type: application/json' \
  --data '{"name":"Bobby","age":8,"classGroup":"Class 2","section":"A","aadharNumber":"998800003333","schoolId":"gps-i5-B"}' \
  -w '\nHTTP=%{http_code}\n'
echo

echo '--- 4) Bulk import at own school ---'
curl -sS -m 10 http://127.0.0.1:3000/api/students/bulk-import \
  -X POST -H "Authorization: Bearer $PTOKEN" -H 'Content-Type: application/json' \
  --data '{"rows":[
    {"name":"Simran","age":7,"classGroup":"Class 2","section":"A","aadharNumber":"998800004444"},
    {"name":"Anita","age":8,"classGroup":"Class 3","section":"A","aadharNumber":"998800005555"}
  ]}' \
  -w '\nHTTP=%{http_code}\n'
echo

echo '--- 5) Bulk import with cross-school row rejected ---'
curl -sS -m 10 http://127.0.0.1:3000/api/students/bulk-import \
  -X POST -H "Authorization: Bearer $PTOKEN" -H 'Content-Type: application/json' \
  --data '{"rows":[
    {"name":"X","age":7,"classGroup":"Class 2","section":"A","aadharNumber":"998800006666"},
    {"name":"Y","age":8,"classGroup":"Class 3","section":"A","aadharNumber":"998800007777","schoolId":"gps-i5-B"}
  ]}' \
  -w '\nHTTP=%{http_code}\n'
echo

echo '--- 6) GET /api/students as principal ---'
curl -sS -m 60 http://127.0.0.1:3000/api/students \
  -H "Authorization: Bearer $PTOKEN" \
  -o C:/Users/sahil/AppData/Local/Temp/i5-students.json \
  -w 'HTTP=%{http_code} time=%{time_total}s\n'
python -c "
import json
rows = json.load(open('C:/Users/sahil/AppData/Local/Temp/i5-students.json', encoding='utf-8'))
names = ['Aarav Singh', 'Diya Kaur', 'Simran', 'Anita']
mine = [r for r in rows if r['name'] in names]
print('total=' + str(len(rows)) + ' matching_test_students=' + str(len(mine)))
print(json.dumps([{'name':r['name'],'schoolId':r['schoolId'],'classGroup':r['classGroup'],'section':r['section'],'aadharMasked':r['aadharMasked']} for r in mine], indent=2))
"
echo
