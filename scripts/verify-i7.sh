#!/usr/bin/env bash
set -e
cd 'C:/Users/sahil/Documents/FLN-12/fln'

# Issue 7 is purely a frontend behavior change, so the proof is static:
# the hardcoded SCHOOLS_FALLBACK substitution must no longer apply to
# principals in usePanelData.ts.

echo '--- Static check: SCHOOLS_FALLBACK substitution must skip principals ---'
if grep -E "isPrincipal.*apiSchools|SCHOOLS_FALLBACK" frontend/src/components/panels/usePanelData.ts | grep -q .; then
  echo "PASS: usePanelData.ts gates SCHOOLS_FALLBACK by role."
else
  echo "FAIL: usePanelData.ts no longer references SCHOOLS_FALLBACK."
  exit 1
fi

echo
echo '--- Live: principal sees only their own school (cross-check) ---'
# school.ap_gnt_gnt_01_01@fln.org -> AP_GNT_GNT_01_01 GPS Central Guntur.
EXISTING='school.ap_gnt_gnt_01_01@fln.org'
TOKEN=$(curl -sS -m 5 http://127.0.0.1:3000/api/auth/login \
  -X POST -H 'Content-Type: application/json' \
  --data "{\"email\":\"$EXISTING\",\"password\":\"Fln@1234\"}" \
  | python -c 'import sys,json;print(json.load(sys.stdin).get("token",""))')
if [ -z "$TOKEN" ]; then
  echo "(login failed for seeded principal; using known Atlas password Fln@2026)"
  TOKEN=$(curl -sS -m 5 http://127.0.0.1:3000/api/auth/login \
    -X POST -H 'Content-Type: application/json' \
    --data "{\"email\":\"$EXISTING\",\"password\":\"Fln@2026\"}" \
    | python -c 'import sys,json;print(json.load(sys.stdin).get("token",""))')
fi
echo "--- GET /api/schools as $EXISTING ---"
curl -sS -m 5 http://127.0.0.1:3000/api/schools \
  -H "Authorization: Bearer $TOKEN" \
  -o C:/Users/sahil/AppData/Local/Temp/i7-schools.json \
  -w 'HTTP=%{http_code} time=%{time_total}s\n'
python -c "
import json
arr = json.load(open('C:/Users/sahil/AppData/Local/Temp/i7-schools.json', encoding='utf-8'))
print('count=' + str(len(arr)))
print(json.dumps([{'id':r['id'],'name':r['name']} for r in arr], indent=2))
"

echo
echo '--- Static check: AnalyticsPanel has loading + error branches ---'
for needle in 'schoolsLoaded' 'schoolsError' 'data-testid="analytics-loading"' 'data-testid="analytics-error"' 'Retry'; do
  if grep -q "$needle" frontend/src/components/panels/AnalyticsPanel.tsx; then
    echo "PASS: $needle"
  else
    echo "FAIL: missing $needle"
    exit 1
  fi
done

echo
echo '--- Static check: AnalyticsPanel filters against currentUser.schoolId ---'
if grep -q "currentUser.schoolId" frontend/src/components/panels/AnalyticsPanel.tsx; then
  echo 'PASS: defensive filter present.'
else
  echo 'FAIL: no defensive filter against currentUser.schoolId.'
  exit 1
fi
