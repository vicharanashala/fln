# Issue 10 — Superadmin account creation stores schoolId without deriving school geography for teacher accounts

## Status

**Resolved** in branch `fix/school-dashboard-priority-1-10`, commit `<this commit>`.

## What was wrong

Issue 2 fixed `POST /api/admin/create` so that accounts created with `role: 'school'` validate the submitted `schoolId` against the schools collection and derive `stateCode/districtCode/blockCode` from the school record. The same fix was explicitly deferred for `role: 'teacher'` with a comment: "TEACHER accounts created by superadmin via this route get a separate fix in Issue 10."

Until now, a superadmin could create a teacher via `/api/admin/create` with `schoolId: 'gps-school-A'` and `stateCode: 'HR', districtCode: 'AMB', blockCode: 'AMB-01'` — completely inconsistent with the school record. The account would land in Atlas with mismatched scope, invisible to block/district coordinators who filter `/api/admin/coordinators` by `blockCode`/`districtCode`.

## What I did

In `backend/src/routes/admin.ts`, generalized the Issue 2 scope-validation block:

```diff
-if (role === UserRole.SCHOOL) {
+if (role === UserRole.SCHOOL || role === UserRole.TEACHER) {
+  const roleLabel = role === UserRole.SCHOOL ? 'school' : 'teacher';
   if (!schoolId) {
-    return res.status(400).json({ error: 'schoolId is required when role is school.' });
+    return res.status(400).json({ error: `schoolId is required when role is ${roleLabel}.` });
   }
   ...
```

The block already does exactly what's needed for teachers too:

1. Require `schoolId`. HTTP 400 with role-specific message if missing.
2. Validate that the school exists (case-insensitive lookup).
3. Reject conflicting geography with HTTP 400 and a named message listing every conflicting field.
4. Derive `stateCode/districtCode/blockCode` from the school record.

Other roles (`ADMIN`, `district_admin`, `block_admin`, `volunteer`) keep their existing behaviour: their scope legitimately spans more than one school.

The companion route for principal/teacher creation, `POST /api/teachers` (Issue 4), already does this work via `targetSchool.stateCode/districtCode/blockCode` at `backend/src/routes/teachers.ts:97-99`. Issue 10 closes the same gap on `/api/admin/create` so that both paths produce consistent account data, as the audit acceptance criterion required.

## Files changed

- `backend/src/routes/admin.ts` — generalize the scope-validation block to also cover `UserRole.TEACHER`.
- `scripts/verify-i10.sh` — 7-case verification.
- `scripts/verify-i10-cleanup.js` — Atlas cleanup of test records.
- `docs/issues/10-teacher-creation-geo.md` — this file.

## How I verified

`scripts/verify-i10.sh`:

1. **Happy path 1**: create a teacher at `gps-i10-A` with no geo fields. PASS — `schoolId: gps-i10-a, stateCode: PB, districtCode: LDH, blockCode: LDH-01` (derived from school).
2. **Happy path 2**: same school with matching geo fields submitted. PASS — HTTP 200, no conflict.
3. **Missing schoolId**: HTTP 400 with `schoolId is required when role is teacher.`
4. **Unknown school**: HTTP 400 with `Unknown school: gps-does-not-exist. Onboard the school first via POST /api/schools.`
5. **Cross-school attempt**: HTTP 400 with `Geographic values conflict with school gps-i10-a: stateCode HR != school PB; districtCode AMB != school LDH; blockCode AMB-01 != school LDH-01.`
6. **Teacher login**: `/api/auth/me` shows `t.i10.a@fln.org` is `role: 'teacher'` with `schoolId: gps-i10-a, stateCode: PB, districtCode: LDH, blockCode: LDH-01`.
7. **`/api/admin/coordinators`**: both teachers appear with the derived scope `PB / LDH / LDH-01`.

`tsc --noEmit` clean in `backend/`. Atlas test records cleaned up after the run.

## Acceptance criteria — status

- [x] Principal accounts inherit all three geographic fields. (Issue 2; still passing.)
- [x] Teacher accounts inherit all three geographic fields. (This issue; verified end-to-end.)
- [x] The selected school must exist. (HTTP 400 if it doesn't.)
- [x] `/api/admin/coordinators` shows the correct scope. (Verified in case 7.)
- [x] Analytics and school filtering use the same scope. (Now that teacher accounts have correct geo, every downstream filter that uses `stateCode/districtCode/blockCode` will scope correctly.)
- [x] Admin and teacher creation paths produce consistent account data. (`POST /api/admin/create` for teachers and `POST /api/teachers` both now derive geo from the school record the same way.)
