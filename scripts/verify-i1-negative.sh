#!/usr/bin/env bash
set -e
cd 'C:/Users/sahil/Documents/FLN-12/fln'

LOGIN=$(curl -sS -m 5 http://127.0.0.1:3000/api/auth/login \
  -X POST -H 'Content-Type: application/json' \
  --data '{"email":"superadmin@fln.org","password":"Fln@2026"}')
TOKEN=$(printf '%s' "$LOGIN" | python -c 'import sys,json;print(json.load(sys.stdin)["token"])')

echo '--- bad pincode (5 digits) ---'
curl -sS -m 8 http://127.0.0.1:3000/api/schools -X POST \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"id":"gps-i1-bad-001","name":"Bad Pincode","stateCode":"PB","districtCode":"LDH","blockCode":"LDH-01","pincode":"12345"}'
echo

echo '--- bad udiseCode (9 digits) ---'
curl -sS -m 8 http://127.0.0.1:3000/api/schools -X POST \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"id":"gps-i1-bad-002","name":"Bad Udise","stateCode":"PB","districtCode":"LDH","blockCode":"LDH-01","udiseCode":"123456789"}'
echo

echo '--- bad schoolType ---'
curl -sS -m 8 http://127.0.0.1:3000/api/schools -X POST \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"id":"gps-i1-bad-003","name":"Bad Type","stateCode":"PB","districtCode":"LDH","blockCode":"LDH-01","schoolType":"nursery"}'
echo

echo '--- bad contactEmail ---'
curl -sS -m 8 http://127.0.0.1:3000/api/schools -X POST \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"id":"gps-i1-bad-004","name":"Bad Email","stateCode":"PB","districtCode":"LDH","blockCode":"LDH-01","contactEmail":"not-an-email"}'
echo

echo '--- establishedYear in the future ---'
curl -sS -m 8 http://127.0.0.1:3000/api/schools -X POST \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"id":"gps-i1-bad-005","name":"Future Year","stateCode":"PB","districtCode":"LDH","blockCode":"LDH-01","establishedYear":3000}'
echo

echo '--- legacy fields only (backward compatibility) ---'
curl -sS -m 8 http://127.0.0.1:3000/api/schools -X POST \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"id":"gps-i1-legacy-001","name":"Legacy School","stateCode":"PB","districtCode":"LDH","blockCode":"LDH-01"}'
echo
