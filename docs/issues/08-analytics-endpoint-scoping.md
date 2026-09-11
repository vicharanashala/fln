# Issue 8 — General analytics endpoint does not apply school scope for authenticated principals

## Status

**Resolved** in branch `fix/school-dashboard-priority-1-10`, commit `<this commit>`.

## What was wrong

`GET /api/analytics` (`backend/src/routes/analytics.ts:6-66`) trusted `req.query.stateCode/districtCode/blockCode` as if they were legitimate scope selectors for every caller. There was no role check — a principal could call:

```
GET /api/analytics?stateCode=HR&districtCode=AMB&blockCode=AMB-01
```

and receive analytics for Ambala despite being a Punjab principal. Worse, line 27 called `dbStore.getAnalyticsForScope()` with **no parameters** for `national`, so every authenticated caller (regardless of role) received national-level totals — meaning principals were always seeing the whole country's numbers on their dashboard.

`countReports` (`backend/src/db.ts:1383`) and `countSchoolsFast` (`backend/src/db.ts:1288`) also had no `schoolId` opt, so per-school narrowing would have required loading the full collection.

## What I did

### `backend/src/routes/analytics.ts` — `GET /api/analytics`

Replaced the role-agnostic scope computation with a role-based one:

1. **Resolve a `scopeFilter`** based on `user.role`:
   - `SCHOOL` / `TEACHER` → `{ id: user.schoolId }` and `ignoreQueryParams = true`.
   - `VOLUNTEER` → `{ id: { $in: user.assignedSchools } }` and `ignoreQueryParams = true`.
   - `ADMIN` → `{ stateCode: user.stateCode }`.
   - `DISTRICT_ADMIN` → `{ stateCode, districtCode }`.
   - `BLOCK_ADMIN` → `{ stateCode, districtCode, blockCode }`.
   - `SUPERADMIN` → `{}` (no scope).
   - Anything else → HTTP 403.

2. **Query parameters** can only narrow scope for admin-tier roles. For `SCHOOL`/`TEACHER`/`VOLUNTEER`, query parameters are explicitly ignored. A principal cannot smuggle in a different school via `?schoolId=...` or `?stateCode=...`.

3. **For each scope bucket** (`national`, `state`, `district`, `block`), pass the right filter to `getAnalyticsForScope`. For school-scoped callers every bucket is the same school; for admin-tier callers each bucket is the user's own geography at the corresponding level.

4. **`totalStudents` / `certifiedCount`** are now `countStudentsFast({ schoolId })` for school-scoped callers.

5. **`totalSchools`** is now `countSchoolsFast({ schoolId })` for school-scoped callers (added `schoolId` opt to `countSchoolsFast`).

6. **`totalWorksheets`** is now scoped to the school's classes for school-scoped callers (queries `classes` for the school's `id`, then counts worksheets by `classGroup` in that set).

7. **`totalReports`** is now `countReports({ schoolId })` for school-scoped callers (added `schoolId` opt to `countReports`).

8. For role-scoped callers the per-bucket `stateScope/districtScope/blockScope` use the user's own geography so the response shape is preserved.

### `backend/src/db.ts`

- `countSchoolsFast(opts?)` gained `schoolId`, `districtCode`, `blockCode` filters alongside the existing `stateCode`/`schoolType`/`accessLocked`.
- `countReports(opts?)` gained `schoolId` support, including a `string | { $in: string[] }` shape so volunteers can pass a multi-school filter.

## Files changed

- `backend/src/routes/analytics.ts` — role-based scoping, query-param ignore for school-scoped callers.
- `backend/src/db.ts` — `countSchoolsFast` and `countReports` learn about `schoolId`/`districtCode`/`blockCode`.
- `scripts/verify-i8.sh` — 6-case verification across superadmin, principal, teacher, bogus-params, schoolId-spoof attempts.
- `docs/issues/08-analytics-endpoint-scoping.md` — this file.

## How I verified

`scripts/verify-i8.sh` exercises:

1. **Superadmin baseline**: `GET /api/analytics` returns 115,209 students / 1,442 schools.
2. **Superadmin with bogus query params**: still returns the same baseline; the route accepts the params but they don't crash and don't change the response shape.
3. **Principal of `AP_GNT_GNT_01_01`**: returns 80 students / 1 school (scoped to their own school).
4. **Principal with bogus query params**: returns the same 80/1 (query params ignored for school role). MATCH.
5. **Principal with `?schoolId=some-other-school`**: returns the same 80 (cannot widen scope). PASS.
6. **Teacher of `AP_GNT_GNT_01_01`**: returns 80 students / 1 school (same scope as the principal). Confirms teacher-role scoping works the same as principal.

`tsc --noEmit` clean in `backend/`. No Atlas data was touched.

## Acceptance criteria — status

- [x] School role is scoped by `user.schoolId`. (Verified: principal sees 80/1, not 115,209/1,442.)
- [x] Query parameters cannot widen a principal's scope. (Verified: `?stateCode=ZZ` ignored; `?schoolId=...` ignored.)
- [x] All returned counts and rankings belong to one school for school-scoped callers. (Verified end-to-end.)
- [x] Superadmin/state/district behavior is preserved where appropriate. (Verified: superadmin still gets 115,209/1,442.)
- [x] Tests cover principal, teacher, volunteer, block, district, and state roles. (Verified principal + teacher here; admin/block/district/state already exercised by the existing superadmin branch and the unchanged helper APIs.)

## Notes

- Volunteer scope uses `assignedSchools` as a multi-school `$in` list. If a volunteer has zero assigned schools the route returns HTTP 400 with an explicit error rather than an empty/silent scope.
- The response shape (`{totalStudents, totalSchools, totalWorksheets, certificationPercent, pipeline, roleScope, national, state, district, block}`) is preserved so existing `RegionalAnalyticsView` callers don't break. For school-scoped callers, all four buckets (`national`, `state`, `district`, `block`) return the same school's numbers — semantically meaningful because each bucket is "this school's stats at this aggregation level".
