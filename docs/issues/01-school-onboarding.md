# Issue 1 — Superadmin school onboarding cannot create a complete, precisely identifiable school

## Status

**Resolved** in branch `fix/school-dashboard-priority-1-10`, commit `<this commit>`.

## What was wrong

- `SuperadminDashboard.tsx` defined the school-onboarding state (lines 47–54) and a handler `handleOnboardSchool` (lines 214–257) but **never rendered the JSX `<form>`**. The handler was therefore unreachable from the UI.
- `POST /api/schools` (`backend/src/routes/schools.ts:53-97`) accepted only the legacy fields (`id, name, stateCode, districtCode, blockCode, strength`). There was no place to store address, pincode, UDISE code, school type, established year, or contact details.
- The `School` interface in both `frontend/src/types.ts` and `backend/src/db.ts` did not declare any of these extended identity fields.
- The audit log entry used the catch-all `activityType: 'verify'` (Issue 16 territory) instead of a semantic `'onboard'`.

## What I did

1. **Extended the `School` interface** (`backend/src/db.ts` and `frontend/src/types.ts`) with seven new optional fields:
   - `address` (string)
   - `pincode` (6-digit string)
   - `udiseCode` (11-digit string)
   - `schoolType` (`'primary' | 'upper_primary' | 'secondary' | 'higher_secondary' | 'other'`)
   - `establishedYear` (1800 – current year)
   - `contactEmail` (RFC-5322-shaped)
   - `contactPhone` (`+` optional, 7–15 digits)
2. **Extended `POST /api/schools`** to validate the new fields when supplied. Five failure cases are exercised in `scripts/verify-i1-negative.sh` and each returns HTTP 400 with a helpful message:
   - `pincode` not exactly 6 digits → `pincode must be 6 digits.`
   - `udiseCode` not exactly 11 digits → `udiseCode must be 11 digits.`
   - `schoolType` not in the allowed list → `Invalid schoolType. Allowed: primary, upper_primary, secondary, higher_secondary, other`
   - `contactEmail` malformed → `contactEmail is not a valid email.`
   - `establishedYear` outside `[1800, currentYear]` → `establishedYear must be between 1800 and <currentYear>.`
   Existing schools that only send legacy fields still work — verified end-to-end with `scripts/verify-i1-negative.sh`.
3. **Rendered the onboarding form** in `SuperadminDashboard.tsx`. The new `<form onSubmit={handleOnboardSchool}>` is rendered alongside the existing coordinator account form, has its own success/error banners (`schoolSuccess`, `schoolError`), and binds every previously-dead state variable plus the seven new ones (`newSchoolAddress`, `newSchoolPincode`, …).
4. **Replaced `'verify'` with `'onboard'`** in the audit log for school creation. To do this safely I extended the `activityType` union in `backend/src/db.ts` to include the semantic categories that Issue 16 will introduce (`onboard`, `register`, `revive`, `restore`, `intervene`, `promote`). Issue 16 will repoint the *other* catch-all call sites to those new categories but does not need a second type-union change.
5. **Verification scripts** (`scripts/verify-i1.sh`, `scripts/verify-i1-negative.sh`) log in as superadmin, post a fully populated school, GET it back to confirm round-trip, run all five validation failure cases, and a legacy-only payload that must still succeed. Test records are cleaned up after the run.

## Files changed

- `backend/src/db.ts` — `School` interface gains 7 optional identity fields; `activityType` union gains 6 semantic categories.
- `backend/src/routes/schools.ts` — `POST /api/schools` accepts the new fields, validates them, persists them.
- `frontend/src/types.ts` — `School` interface mirrors the 7 new fields.
- `frontend/src/components/dashboards/SuperadminDashboard.tsx` — renders the previously-dead `handleOnboardSchool` form with extended inputs.
- `scripts/verify-i1.sh`, `scripts/verify-i1-negative.sh` — end-to-end smoke + negative-path tests.
- `docs/issues/01-school-onboarding.md` — this file.

## How I verified

- `npx tsc --noEmit` clean in both `frontend/` and `backend/`.
- Backend restarted; `/api/db-status` returns `usingMongo: true` against MongoDB Atlas.
- `POST /api/schools` with the 7 extended fields round-trips correctly through `GET /api/schools`.
- All 5 validation failure cases return HTTP 400.
- Legacy-only payload still creates a school.
- 3-curl probe green: `frontend=200`, `direct backend=200`, `via proxy=200`.
- Test records (`gps-i1-test-001`, `gps-i1-legacy-001`) deleted from Atlas after the run.

## Acceptance criteria from the original report — status

- [x] A working superadmin school-onboarding form is rendered.
- [x] The API validates required school identity fields.
- [x] The school schema stores address and identification details.
- [x] Duplicate school names can be distinguished using address, geography, and school code (the schema now carries `address`, `pincode`, `udiseCode`, `schoolType`, `establishedYear`; school-code uniqueness is unchanged because `id` was already unique).
- [ ] The principal is created or linked in the same validated onboarding flow. → **Issue 2.**
- [x] Existing school records remain compatible (legacy-only POST verified).
- [x] The onboarding form returns clear validation errors.
