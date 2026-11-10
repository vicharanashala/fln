# dashboards

## Overview
One dashboard per role (superadmin, state/district/block admin, school principal, teacher, volunteer) plus shared pieces. `../RoleDashboards.tsx` re-exports these so `../../App.tsx` imports them from one place.

## Interface
- `SuperadminDashboard.tsx`: `SuperadminDashboard`, type `DashboardProps`.
- `AdminDashboard.tsx`: `AdminDashboard`.
- `SchoolDashboard.tsx`: `SchoolDashboard`.
- `TeacherDashboard.tsx`: `TeacherDashboard({ user, token, onNavigate })`.
- `VolunteerDashboard.tsx`: `VolunteerDashboard`.
- `RegionalAnalyticsView.tsx`: `RegionalAnalyticsView({ token, user })`.
- `ClassSummaryBar.tsx`: `ClassSummaryBar({ students, token?, teacherId? })` (both optional; without them it skips its fetch).
- `FLNLevelReference.tsx`: `FLN_LEVELS_LIST`, `FLNLevelReferenceModal` (built from `../../data/skillProgressionMap`). `SuperadminDashboard.tsx` also embeds `QuestionTemplatePanel`, `CurriculumLevelsPanel`, `QuestionReviewPanel` (`:833-845`, not reachable through `PanelViews`), `SuperAdminExecutiveDashboard` and `LogbookView`.
- Tests: `FLNLevelReference.test.ts`, which hard-codes an expected 109 levels.

## Invariants
- Dashboards take `{ user, token }` (`ClassSummaryBar` takes optional `token`/`teacherId`) and fetch only through `apiFetch`; the backend decides which rows each role may see, so the UI must not widen scope client-side.
- Level and skill reference data comes from `../../data`, not from local copies. Exception: `AdminDashboard.tsx` takes `STATE_NAMES` / `DISTRICT_NAMES` from the hard-coded 4-state / 5-district maps in `../RoleDashboards.tsx`.

## Side Effects
- Network calls to `/api/schools`, `/api/students`, `/api/classes`, `/api/stats`, `/api/admin/*`, `/api/announcements/create`, `/api/worksheets/generate-level-pdf`, `/api/teachers/:id/test-history`, `/api/analytics` and `/api/analytics/superadmin` (`RegionalAnalyticsView`), and `/api/students?all=1` (`TeacherDashboard`).
- Mutating admin actions (create coordinator, restore school, revive teacher, announcements) write to backend data.

## Verification
- Run: `npm test --workspace @fln/frontend` (vitest run, from repo root)
