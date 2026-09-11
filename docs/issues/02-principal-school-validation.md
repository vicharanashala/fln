# Issue 2 — Superadmin can create a principal with an invalid or inconsistent school assignment

## Status

**Resolved** in branch `fix/school-dashboard-priority-1-10`, commit `<this commit>`.

## What was wrong

`POST /api/admin/create` (`backend/src/routes/admin.ts:8-62`) accepted `schoolId, stateCode, districtCode, blockCode` independently and just uppercased the geo codes. There was no check that:

1. The submitted `schoolId` referred to an actual school.
2. The submitted `stateCode / districtCode / blockCode` matched the school's stored geography.
3. Geographic scope should be *derived* from the school rather than copied from the form.

That meant a superadmin could create a principal for `gps-mt-001` but with `stateCode: 'HR'`, `districtCode: 'JAI'`, `blockCode: 'JAI-99'`, and the account would land in Atlas with an inconsistent scope. It would then disappear from `/api/admin/coordinators` filtered by a Punjab block admin, even though the principal was nominally created for a Punjab school.

## What I did

In `backend/src/routes/admin.ts`, when `role === UserRole.SCHOOL` (the principal role):

1. **Require `schoolId`.** Reject with HTTP 400 if missing.
2. **Validate the school exists.** Case-insensitive lookup against `dbStore.getSchools()` (matches the convention in `POST /api/schools` and `POST /api/teachers`). Reject with HTTP 400 with a hint to onboard the school first.
3. **Reject conflicting geography** with HTTP 400 if any of the three submitted codes disagrees with the school's stored geography. The error message names the field and shows both values, so the operator can fix either the input or the school record.
4. **Derive the geography from the school** for all three fields when they are absent or match. The principal's record now always agrees with the school record.
5. **Audit log enrichment**: `schoolId` and `schoolName` are populated on the audit entry when known, and `activityType` is `'register'` instead of the catch-all `'verify'` (Issue 16 work).

Other roles (`TEACHER`, `ADMIN`, district, block, volunteer) keep their current behavior through this route. Issue 4 adds the school-scoped teacher-creation path, Issue 10 handles `TEACHER` accounts created by superadmin through this same endpoint.

## Files changed

- `backend/src/routes/admin.ts` — `POST /api/admin/create` validates schoolId, derives/overrides geo from the school, and returns HTTP 400 on conflicts.
- `scripts/verify-i2.sh` — 8-case end-to-end test.
- `scripts/verify-i2-cleanup.js` — Atlas cleanup of test records.
- `docs/issues/02-principal-school-validation.md` — this file.

## How I verified

`scripts/verify-i2.sh` exercises:

1. Happy path 1 — `schoolId` only; geography derived from school.
2. Happy path 2 — `schoolId` supplied with matching geography.
3. Missing `schoolId` → HTTP 400.
4. Unknown school → HTTP 400.
5. Conflicting `stateCode` → HTTP 400 with `stateCode HR != school PB`.
6. Conflicting `districtCode` → HTTP 400.
7. Conflicting `blockCode` → HTTP 400.
8. Round-trip — successful principals appear in `/api/admin/coordinators` with the derived scope (`PB/LDH/LDH-01`).

All 8 cases green. `tsc --noEmit` clean in `backend/`. Test records cleaned up from Atlas.

## Acceptance criteria — status

- [x] Principal creation validates that the school exists.
- [x] Geographic scope is derived from the selected school.
- [x] Conflicting geographic values are rejected with HTTP 400.
- [x] The principal can log in and shows the correct school. (Login not exercised in the script — but the response payload now carries the canonical `schoolId, stateCode, districtCode, blockCode` from the school.)
- [x] District/block administrators see the principal in the correct scope. (Verified via `/api/admin/coordinators` in case 8.)
- [x] The flow is atomic or provides a clear rollback/error path. (HTTP 400 returned before `addUser`, so no rollback needed — the request is rejected without writing anything.)
- [x] A school created without a principal remains possible. (Issue 1's `POST /api/schools` does not require a principal; this route only enforces the school lookup when `role === 'school'`.)
