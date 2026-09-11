#!/usr/bin/env bash
set -e
cd 'C:/Users/sahil/Documents/FLN-12/fln'

login() {
  curl -sS -m 5 http://127.0.0.1:3000/api/auth/login \
    -X POST -H 'Content-Type: application/json' \
    --data "{\"email\":\"$1\",\"password\":\"$2\"}" \
    | python -c 'import sys,json;print(json.load(sys.stdin).get("token",""))'
}

# 1) Superadmin: no scope (full numbers). Note baseline.
SUPERTOKEN=$(login 'superadmin@fln.org' 'Fln@2026')
echo '--- Superadmin baseline (full national numbers) ---'
curl -sS -m 30 http://127.0.0.1:3000/api/analytics -H "Authorization: Bearer $SUPERTOKEN" \
  -o C:/Users/sahil/AppData/Local/Temp/i8-super.json -w 'HTTP=%{http_code} time=%{time_total}s\n'
python -c "
import json
d = json.load(open('C:/Users/sahil/AppData/Local/Temp/i8-super.json', encoding='utf-8'))
print('totalStudents=' + str(d.get('totalStudents')) + ' totalSchools=' + str(d.get('totalSchools')) + ' roleScope=' + str(d.get('roleScope')))
"

# 2) Superadmin with bogus query params: should still get the same baseline
#    (query params are narrowed-against for superadmin, not widened).
echo
echo '--- Superadmin with bogus query params (must NOT widen) ---'
curl -sS -m 30 "http://127.0.0.1:3000/api/analytics?stateCode=ZZ&districtCode=ZZ&blockCode=ZZ" \
  -H "Authorization: Bearer $SUPERTOKEN" \
  -o C:/Users/sahil/AppData/Local/Temp/i8-super-bogus.json \
  -w 'HTTP=%{http_code} time=%{time_total}s\n'
python -c "
import json
d = json.load(open('C:/Users/sahil/AppData/Local/Temp/i8-super-bogus.json', encoding='utf-8'))
print('totalStudents=' + str(d.get('totalStudents')) + ' totalSchools=' + str(d.get('totalSchools')))
# The narrowing happens, so it should match national total or be smaller.
# It must NOT crash.
"

# 3) Principal of AP_GNT_GNT_01_01 — should see only their own school's numbers.
PTOKEN=$(login 'school.ap_gnt_gnt_01_01@fln.org' 'Fln@2026')
echo
echo '--- Principal of AP_GNT_GNT_01_01 ---'
curl -sS -m 30 http://127.0.0.1:3000/api/analytics -H "Authorization: Bearer $PTOKEN" \
  -o C:/Users/sahil/AppData/Local/Temp/i8-principal.json -w 'HTTP=%{http_code} time=%{time_total}s\n'
python -c "
import json
d = json.load(open('C:/Users/sahil/AppData/Local/Temp/i8-principal.json', encoding='utf-8'))
print('totalStudents=' + str(d.get('totalStudents')) + ' totalSchools=' + str(d.get('totalSchools')) + ' roleScope=' + str(d.get('roleScope')))
"

# 4) Same principal with bogus query params: must still see ONLY own school.
echo
echo '--- Principal with bogus query params (must be ignored) ---'
curl -sS -m 30 "http://127.0.0.1:3000/api/analytics?stateCode=ZZ&districtCode=ZZ&blockCode=ZZ" \
  -H "Authorization: Bearer $PTOKEN" \
  -o C:/Users/sahil/AppData/Local/Temp/i8-principal-bogus.json -w 'HTTP=%{http_code} time=%{time_total}s\n'
python -c "
import json
main = json.load(open('C:/Users/sahil/AppData/Local/Temp/i8-principal.json', encoding='utf-8'))
bogus = json.load(open('C:/Users/sahil/AppData/Local/Temp/i8-principal-bogus.json', encoding='utf-8'))
ok = (main.get('totalStudents') == bogus.get('totalStudents')
      and main.get('totalSchools') == bogus.get('totalSchools'))
print('principal baseline=' + str(main.get('totalStudents')) + '/' + str(main.get('totalSchools')))
print('principal bogus   =' + str(bogus.get('totalStudents')) + '/' + str(bogus.get('totalSchools')))
print('MATCH' if ok else 'MISMATCH')
"

# 5) Same principal trying to specify a DIFFERENT school in the URL.
#    Query params cannot widen; even if they could, our scope is fixed
#    by role.
echo
echo '--- Principal with schoolId-style query param attempt ---'
curl -sS -m 30 "http://127.0.0.1:3000/api/analytics?schoolId=some-other-school" \
  -H "Authorization: Bearer $PTOKEN" \
  -o C:/Users/sahil/AppData/Local/Temp/i8-principal-widen.json -w 'HTTP=%{http_code} time=%{time_total}s\n'
python -c "
import json
main = json.load(open('C:/Users/sahil/AppData/Local/Temp/i8-principal.json', encoding='utf-8'))
widen = json.load(open('C:/Users/sahil/AppData/Local/Temp/i8-principal-widen.json', encoding='utf-8'))
ok = (main.get('totalStudents') == widen.get('totalStudents'))
print('baseline=' + str(main.get('totalStudents')))
print('widen   =' + str(widen.get('totalStudents')))
print('PASS' if ok else 'FAIL')
"

# 6) Cross-check: a DIFFERENT principal should see DIFFERENT scoped numbers.
#    Use a teacher-style account: the seeded principal school AP_GNT_GNT_01_01
#    has 3 teachers. Pick one and verify the numbers.
TTOKEN=$(login 'teacher.ap_gnt_gnt_01_01.c1@fln.org' 'Fln@2026')
echo
echo '--- Teacher of AP_GNT_GNT_01_01 ---'
curl -sS -m 30 http://127.0.0.1:3000/api/analytics -H "Authorization: Bearer $TTOKEN" \
  -o C:/Users/sahil/AppData/Local/Temp/i8-teacher.json -w 'HTTP=%{http_code} time=%{time_total}s\n'
python -c "
import json
d = json.load(open('C:/Users/sahil/AppData/Local/Temp/i8-teacher.json', encoding='utf-8'))
print('totalStudents=' + str(d.get('totalStudents')) + ' totalSchools=' + str(d.get('totalSchools')) + ' roleScope=' + str(d.get('roleScope')))
"
