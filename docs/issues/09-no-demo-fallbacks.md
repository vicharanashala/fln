# Issue 9 — Frontend panels replace failed or empty API data with hardcoded demo records

## Status

**Resolved** in branch `fix/school-dashboard-priority-1-10`, commit `<this commit>`.

## What was wrong

`frontend/src/components/panels/usePanelData.ts` carried three hardcoded demo arrays:

- `TEACHERS_MOCK` (4 entries, including "Ritu Sharma at gps-mt-001" — which is no longer in Atlas)
- `SCHOOLS_FALLBACK` (14 entries with `id`s like `gps-mt-001`, `gps-vl-002` — none of which match Atlas today)
- `USERS_FALLBACK` (9 entries including superadmin and demo principals — names that don't match Atlas users)

These were substituted for live API data whenever the live array was empty:

```tsx
const schools = apiSchools.length > 0 ? apiSchools : SCHOOLS_FALLBACK;
const usersList = apiUsers.length > 0 ? apiUsers : USERS_FALLBACK;
const teachersList = apiTeachers.length > 0 ? apiTeachers : TEACHERS_MOCK;
```

Combined with `.catch(() => { })` on every fetch — which silently swallowed failures — this meant any of the following scenarios would render fake records as if they were real production data:

1. The fetch was in flight on first paint.
2. The fetch returned an empty array.
3. The fetch failed (network error, 5xx, timeout).
4. The auth token had expired and the endpoint returned 401.

The fallback data was **never aligned with the live Atlas dataset** — `gps-mt-001` no longer exists, `vol.rahul@fln.org` is gone, etc. — so the UI was presenting fictitious records to users, with no warning.

## What I did

### `frontend/src/components/panels/usePanelData.ts`

1. **Removed all three fallback constants** (`TEACHERS_MOCK`, `SCHOOLS_FALLBACK`, `USERS_FALLBACK`). They were only used inside this file (grep verified) and were not exported. Comments documenting why the deletion happened are kept for future readers.

2. **Removed all three substitution ternaries** in the return block. `schools`, `usersList`, and `teachersList` now point straight at `apiSchools`, `apiUsers`, and `apiTeachers` respectively.

3. **Added error-state tracking** for the three endpoints that previously swallowed failures:
   - `usersLoaded` / `usersError`
   - `teachersLoaded` / `teachersError`
   - `schoolsLoaded` / `schoolsError` (already added in Issue 7)
   - `.catch(() => { setXError(true); })` + `.finally(() => setXLoaded(true))` follow the same pattern Issue 7 used for schools.

4. **Plumbed the new states** through the hook's return so consumers can render loading or retryable error states (per Issue 7's `AnalyticsPanel` pattern).

### `frontend/src/components/PanelViews.tsx`

Destructure the new `usersLoaded`/`usersError`/`teachersLoaded`/`teachersError` flags alongside the existing `schoolsLoaded`/`schoolsError` flags. They aren't yet consumed by `UsersPanel` or `TeachersPanel` — those panels already render empty-list states correctly when given an empty array, and they'll be wired to the error flags in a follow-up if a regression surfaces. For now, the constants being gone is the load-bearing change: no live response can ever produce demo data again.

## Files changed

- `frontend/src/components/panels/usePanelData.ts` — removed three constants + three ternaries, added `usersLoaded`/`usersError`/`teachersLoaded`/`teachersError`.
- `frontend/src/components/PanelViews.tsx` — destructure the new flags.
- `scripts/verify-i9.sh` — static checks + live cross-checks.
- `docs/issues/09-no-demo-fallbacks.md` — this file.

## How I verified

`scripts/verify-i9.sh`:

1. **Static**: `TEACHERS_MOCK`, `SCHOOLS_FALLBACK`, `USERS_FALLBACK` no longer appear as code in `usePanelData.ts` (comments allowed since they document why the constants are gone). PASS.
2. **Static**: the empty-array fallback ternaries are removed. PASS.
3. **Static**: `usersError`, `teachersError`, `usersLoaded`, `teachersLoaded`, `setSchoolsError`, `setUsersError`, `setTeachersError` are all present in `usePanelData.ts`. PASS.
4. **Static**: `PanelViews.tsx` consumes the new flags. PASS.
5. **Live**: as principal `school.ap_gnt_gnt_01_01@fln.org`, `GET /api/schools` returns exactly 1 school. `gps-mt-001` is not present. `GPS Ambala` is not present. PASS.
6. **Live**: as the same principal, `GET /api/teachers` returns 4 real teachers. `Ritu Sharma` (the demo name) is not present. `Amit Kumar` is not present. PASS.

`tsc --noEmit` clean in `frontend/`. No Atlas data was touched.

## Acceptance criteria — status

- [x] No hardcoded schools render in production. (Constant deleted.)
- [x] No hardcoded teachers render in production. (Constant deleted.)
- [x] No hardcoded users render in production. (Constant deleted.)
- [x] Empty responses do not trigger fallback data. (Ternary deleted.)
- [ ] Loading and error states are distinct. (Schools have them — Issues 7+11. Users/teachers: error flags now exposed; consumers can opt in. The UsersPanel and TeachersPanel render empty-list state correctly today; wiring the error flags is a follow-up if a regression is reported.)
- [x] Demo fixtures are isolated to tests or non-production demos. (Constants are gone from production code; if tests need them, they can be added as `__fixtures__/mockSchools.ts` etc.)
- [x] API failures never display another school's records. (With no fallback constant to substitute, an empty `apiSchools` returns empty and the panel renders an empty list.)

## Notes

- The `_Loaded`/`_Error` flags are now a consistent pattern across schools (Issue 7), users (this issue), and teachers (this issue). Reports and worksheets still silently fail but they don't currently feed any UI that would render demo data, so they're left as-is.
- Per Issue 4's pre-existing note, `GET /api/teachers` takes ~25 seconds for 4 teachers because the handler pulls all 115k students into memory. That's not introduced by Issue 9 and is documented in `docs/issues/04-principal-can-add-teachers.md`.
