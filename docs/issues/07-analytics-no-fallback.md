# Issue 7 — Principal Analytics can show a 14-school demo fallback instead of live school data

## Status

**Resolved** in branch `fix/school-dashboard-priority-1-10`, commit `<this commit>`.

## What was wrong

`frontend/src/components/panels/usePanelData.ts:98` substituted a 14-school hardcoded `SCHOOLS_FALLBACK` whenever the live `/api/schools` response was empty:

```tsx
const schools = apiSchools.length > 0 ? apiSchools : SCHOOLS_FALLBACK;
```

A principal opening the Analytics panel before `/api/schools` finished loading (or whenever the request returned an empty array) would see 14 demo schools — including 13 they have no association with — on their dashboard. The fallback was unconditional, so every principal hit this on first paint.

`AnalyticsPanel.tsx` (the panel) had no loading state, no error state, no defensive filter, and just rendered whatever `schools` it received. The principal could see "GPS Model Town", "GPS Village Lohara", "GPS Ambala Cantt" — 13 schools they have no business seeing — on what was supposed to be their own dashboard.

## What I did

### `frontend/src/components/panels/usePanelData.ts`

1. Added `schoolsLoaded` (boolean) and `schoolsError` (boolean) state, both default false. `schoolsLoaded` flips to `true` after the `/api/schools` request resolves (success or failure).
2. The `/api/schools` fetch's `.catch()` now sets `schoolsError = true` instead of silently swallowing the failure.
3. **Changed the fallback substitution** to skip `SCHOOLS_FALLBACK` for principals:

   ```tsx
   const isPrincipal = currentUser.role === UserRole.SCHOOL;
   const schools = (isPrincipal || apiSchools.length > 0)
     ? apiSchools
     : SCHOOLS_FALLBACK;
   ```

   For principals: always `apiSchools`, even if empty (which means "still loading" or "no schools yet" — both correctly visible states). For other roles: existing behaviour preserved for now. Issue 9 will remove `SCHOOLS_FALLBACK` for everyone.
4. Added `schoolsLoaded` and `schoolsError` to the hook's return so consumers can render loading/error states.

### `frontend/src/components/PanelViews.tsx`

1. Destructures `schoolsLoaded` and `schoolsError` from `usePanelData()`.
2. Threads them into `AnalyticsPanel` as new props.

### `frontend/src/components/panels/AnalyticsPanel.tsx`

1. New props: `schoolsLoaded`, `schoolsError`.
2. **Loading state**: while `!schoolsLoaded`, render a centered `RefreshCw` spinner and a "Loading analytics…" message. No school count, no fallback data.
3. **Error state**: when `schoolsError`, render a red banner with a "Retry" button that reloads the page. No school count, no fallback data.
4. **Defensive filter**: regardless of what `schools` contains, if `currentUser.role === SCHOOL` then the rendered list is `schools.filter(s => s.id === currentUser.schoolId)`. This is a belt-and-suspenders guard on top of the backend role-scoping in `backend/src/routes/schools.ts:20-21`.
5. Total Schools metric card now reads `safeSchools.length` (filtered) instead of `schools.length`.

## Files changed

- `frontend/src/components/panels/usePanelData.ts` — add `schoolsLoaded`/`schoolsError`, gate `SCHOOLS_FALLBACK` by role.
- `frontend/src/components/panels/AnalyticsPanel.tsx` — loading + error + retry, defensive filter, total uses filtered count.
- `frontend/src/components/PanelViews.tsx` — pass `schoolsLoaded`/`schoolsError` to `AnalyticsPanel`.
- `scripts/verify-i7.sh` — static + live cross-check.
- `docs/issues/07-analytics-no-fallback.md` — this file.

## How I verified

`scripts/verify-i7.sh` exercises:

1. Static check: `usePanelData.ts` still has the `SCHOOLS_FALLBACK` reference but it is gated by the principal role.
2. Live cross-check: as `school.ap_gnt_gnt_01_01@fln.org` (principal of `AP_GNT_GNT_01_01` "GPS Central Guntur"), `/api/schools` returns exactly 1 school, not 14.
3. Static check: `AnalyticsPanel.tsx` has all of `schoolsLoaded`, `schoolsError`, the loading `data-testid`, the error `data-testid`, and the Retry button.
4. Static check: `AnalyticsPanel.tsx` filters against `currentUser.schoolId`.

All checks pass.

`tsc --noEmit` clean in `frontend/`. No Atlas data was touched (frontend-only change).

## Acceptance criteria — status

- [x] No demo schools render in the production analytics panel. (For principals; other roles still use fallback — Issue 9 will address.)
- [x] Loading state is visible while the request is pending. (`RefreshCw` spinner.)
- [x] API failure shows a retryable error state. (Retry button reloads the page.)
- [x] An empty live response does not activate fallback data. (For principals.)
- [x] `AnalyticsPanel` defensively filters against `currentUser.schoolId`.
- [x] The principal sees exactly one real school. (Cross-check confirmed.)
