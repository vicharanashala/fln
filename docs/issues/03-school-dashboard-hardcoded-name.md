# Issue 3 — School principal dashboard always displays "GPS Model Town Ludhiana"

## Status

**Resolved** in branch `fix/school-dashboard-priority-1-10`, commit `<this commit>`.

## What was wrong

`frontend/src/components/dashboards/SchoolDashboard.tsx:52` rendered a hardcoded string:

```tsx
GPS Model Town Ludhiana (ID: {user.schoolId})
```

The component never called `GET /api/schools`. Every logged-in principal — regardless of which school they actually owned — saw "GPS Model Town Ludhiana" on their dashboard header. This is misleading at best, and a privacy/clarity defect at worst: a principal in Punjab looking at a Jharkhand school would see "Model Town Ludhiana" on their own dashboard.

## What I did

In `frontend/src/components/dashboards/SchoolDashboard.tsx`:

1. **Added `school: School | null` state** and a third fetch in `fetchSchoolData` to `GET /api/schools`.
2. **Defensive lookup**: when the response arrives, prefer the school whose `id` matches the principal's `user.schoolId`. If the live response happens to contain more than one school (e.g. a future role-scoping change), we never accidentally display a different school's name.
3. **Replaced the hardcoded line** with the live school name, falling back to "Loading school…" while the request is in flight (or to a generic "School" if the principal has no `schoolId` at all).
4. **Added a second line** below the title that shows the school's address and location (district, state, pincode) when those fields are populated (the new identity fields from Issue 1 will surface here as superadmins populate them).
5. **Added a `data-testid="school-header"`** to the header line so any future Playwright/Cypress test can assert on the rendered text.

The hardcoded "AI Concept-Focus Suggestions" panel is left as-is — Issue 11 will replace it with live, school-scoped data.

## Files changed

- `frontend/src/components/dashboards/SchoolDashboard.tsx` — fetches `/api/schools`, stores it in state, renders the live name/address instead of the hardcoded Model Town label.
- `scripts/verify-i3.sh` — verifies two principals see their own school.
- `scripts/verify-i3-cleanup.js` — Atlas cleanup of test records.
- `docs/issues/03-school-dashboard-hardcoded-name.md` — this file.

## How I verified

`scripts/verify-i3.sh` exercises:

1. Login as a real Atlas principal (`school.ap_gnt_gnt_01_01@fln.org`). `/api/schools` returns exactly `AP_GNT_GNT_01_01` "GPS Central Guntur" with no Model Town fallback.
2. Onboard a brand-new school `gps-i3-test-001` "GPS Issue3 Verification" with full identity fields (address, pincode) and create a fresh principal for it.
3. Login as the new principal. `/api/schools` returns exactly the new school — never any other school from Atlas.

`tsc --noEmit` clean in `frontend/`. Test records cleaned up from Atlas.

## Acceptance criteria — status

- [x] School name is loaded from `/api/schools`.
- [x] School address and location are displayed.
- [x] Every principal sees their own school. (Verified for both an existing seeded principal and a freshly-created one.)
- [x] No principal sees another school's name. (Defensive filter on `s.id === user.schoolId`.)
- [x] Newly created school IDs work immediately. (Verified in case 3.)
- [x] Regression coverage includes a non-Model-Town school. (The seeded principal `AP_GNT_GNT_01_01` "GPS Central Guntur" is the non-Model-Town case.)
