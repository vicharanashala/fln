#!/usr/bin/env bash
set -e
cd 'C:/Users/sahil/Documents/FLN-12/fln'

echo '--- Static check: TEACHERS_MOCK, SCHOOLS_FALLBACK, USERS_FALLBACK must be gone from code (comments allowed) ---'
for needle in ': TEACHERS_MOCK' ': SCHOOLS_FALLBACK' ': USERS_FALLBACK' 'TEACHERS_MOCK =' 'SCHOOLS_FALLBACK =' 'USERS_FALLBACK ='; do
  if grep -q "$needle" frontend/src/components/panels/usePanelData.ts; then
    echo "FAIL: $needle still present as code."
    exit 1
  else
    echo "PASS: $needle not present as code."
  fi
done

echo
echo '--- Static check: empty-array fallback ternary removed ---'
if grep -E 'apiSchools.length > 0 \? apiSchools : SCHOOLS_FALLBACK|apiUsers.length > 0 \? apiUsers : USERS_FALLBACK|apiTeachers.length > 0 \? apiTeachers : TEACHERS_MOCK' frontend/src/components/panels/usePanelData.ts; then
  echo 'FAIL: ternary fallback still present.'
  exit 1
else
  echo 'PASS: ternary fallback removed.'
fi

echo
echo '--- Static check: error flags wired ---'
for needle in 'usersError' 'teachersError' 'usersLoaded' 'teachersLoaded' 'setSchoolsError' 'setUsersError' 'setTeachersError'; do
  if grep -q "$needle" frontend/src/components/panels/usePanelData.ts; then
    echo "PASS: $needle"
  else
    echo "FAIL: $needle missing"
    exit 1
  fi
done

echo
echo '--- Static check: PanelViews consumes new flags ---'
for needle in 'usersLoaded' 'usersError' 'teachersLoaded' 'teachersError'; do
  if grep -q "$needle" frontend/src/components/PanelViews.tsx; then
    echo "PASS: $needle"
  else
    echo "FAIL: $needle missing"
    exit 1
  fi
done

echo
echo '--- Live: principal of AP_GNT_GNT_01_01 gets only their own school ---'
TOKEN=$(curl -sS -m 5 http://127.0.0.1:3000/api/auth/login -X POST -H 'Content-Type: application/json' --data '{"email":"school.ap_gnt_gnt_01_01@fln.org","password":"Fln@2026"}' | python -c 'import sys,json;print(json.load(sys.stdin)["token"])')
echo 'GET /api/schools:'
curl -sS -m 5 http://127.0.0.1:3000/api/schools -H "Authorization: Bearer $TOKEN" -o C:/Users/sahil/AppData/Local/Temp/i9-schools.json -w 'HTTP=%{http_code}\n'
python -c "
import json
arr = json.load(open('C:/Users/sahil/AppData/Local/Temp/i9-schools.json', encoding='utf-8'))
print('count=' + str(len(arr)))
print('contains_gps_mt_001 =', any(s['id'] == 'gps-mt-001' for s in arr))
print('contains_amb_003 =', any('GPS Ambala' in s['name'] for s in arr))
"
echo
echo 'GET /api/teachers:'
curl -sS -m 60 http://127.0.0.1:3000/api/teachers -H "Authorization: Bearer $TOKEN" -o C:/Users/sahil/AppData/Local/Temp/i9-teachers.json -w 'HTTP=%{http_code} time=%{time_total}s\n'
python -c "
import json
arr = json.load(open('C:/Users/sahil/AppData/Local/Temp/i9-teachers.json', encoding='utf-8'))
print('count=' + str(len(arr)))
print('contains_Ritu =', any('Ritu' in t.get('name','') for t in arr))
print('contains_Amit =', any('Amit' in t.get('name','') for t in arr))
"
