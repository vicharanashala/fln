# Issue 4 — School principal has a Teacher Roster but cannot add teachers

## Status

**Resolved** in branch `fix/school-dashboard-priority-1-10`, commit `<this commit>`.

## What was wrong

- `POST /api/teachers` (`backend/src/routes/teachers.ts:8`) was restricted to `[SUPERADMIN, ADMIN, DISTRICT_ADMIN, BLOCK_ADMIN]`. A principal calling it got HTTP 403.
- `frontend/src/components/panels/TeachersPanel.tsx` was a pure read-only list — no "Add Teacher" button, no form, no submit handler.
- The sidebar (`frontend/src/components/Layout.tsx:178-183`) advertised a Teachers item to principals, but they could only view, never manage.

## What I did

### Backend (`backend/src/routes/teachers.ts`)

1. **Renamed `COORDINATOR_ROLES` → `TEACHER_REGISTRATION_ROLES`** and added `UserRole.SCHOOL` to the list.
2. **For principals specifically**, the route:
   - Requires `user.schoolId` (HTTP 400 if missing).
   - **Rejects a cross-school `school` submission** with HTTP 400 (`A principal can only register teachers at their own school (<id>). Got '<school>'.`) instead of silently overriding, so a copy-paste mistake cannot create a teacher at the wrong school.
   - **Allows omitting `school` entirely** — when omitted, the principal's own `user.schoolId` is used.
3. **For non-principal roles** (SUPERADMIN/ADMIN/DISTRICT/BLOCK), behaviour is unchanged: `school` is required and validated against the schools collection.
4. Changed audit `activityType` from `'verify'` to `'register'` (Issue 16 work).
5. The audit `details` field distinguishes principal-created teachers from coordinator-created ones.
6. Response now includes `schoolId` so the frontend can immediately show where the teacher landed.

### Frontend

1. **`frontend/src/components/panels/usePanelData.ts`** — added a `refreshTeachers()` named mutator mirroring `refreshStudents`. Only fires the fetch for the SCHOOL and BLOCK_ADMIN roles that can see teachers.
2. **`frontend/src/components/PanelViews.tsx`** — destructures `refreshTeachers` from `usePanelData` and threads `token` + `refreshTeachers` into `TeachersPanel`.
3. **`frontend/src/components/panels/TeachersPanel.tsx`** — completely rewritten to:
   - Accept `token` and `refreshTeachers` props.
   - Render an "Add Teacher" button next to the header.
   - On click, expand an inline form with first name, last name, email, phone, password (with complexity hint), and a school picker.
   - For principals, the school picker is replaced by a read-only text input bound to `currentUser.schoolId` — principals cannot pick another school.
   - On successful POST, reset the form, call `refreshTeachers()`, and close the form after 2.5s.
   - On failure, show the backend's error message inline.

## Files changed

- `backend/src/routes/teachers.ts` — allowed roles + scope logic + audit activity type.
- `frontend/src/components/panels/usePanelData.ts` — `refreshTeachers` named mutator.
- `frontend/src/components/PanelViews.tsx` — destructures + threads `refreshTeachers` and `token`.
- `frontend/src/components/panels/TeachersPanel.tsx` — full rewrite with Add Teacher form.
- `scripts/verify-i4.sh`, `scripts/verify-i4-cleanup.js` — 7-case verification + cleanup.
- `docs/issues/04-principal-can-add-teachers.md` — this file.

## How I verified

`scripts/verify-i4.sh` exercises:

1. Principal adds a teacher at their own school → HTTP 200, response includes `schoolId`.
2. Principal omits `school` entirely → HTTP 200, defaults to own school.
3. Principal attempts `school: 'gps-i4-test-002'` (different school) → HTTP 400 with the named-school message.
4. `GET /api/teachers` as the principal → HTTP 200, returns only the two principals' teachers.
5. New teacher accounts can log in and `schoolId`/`stateCode`/`districtCode`/`blockCode` are all set correctly.
6. Duplicate email → HTTP 400.
7. Weak password → HTTP 400 with the complexity message.

`tsc --noEmit` clean in both `backend/` and `frontend/`. Test records cleaned up from Atlas after the run.

## Acceptance criteria — status

- [x] Add Teacher button is visible to principals.
- [x] Add Teacher form exists.
- [x] Principal can select only their own school (locked read-only input).
- [x] API allows `UserRole.SCHOOL`.
- [x] API rejects another school's ID.
- [x] Teacher receives the correct schoolId and geographic fields (verified by teacher login + `/api/auth/me`).
- [x] New teacher appears in the principal's scoped teacher roster (`refreshTeachers` is called after a successful add).
- [x] Duplicate email and password validation remains active.

## Pre-existing issue surfaced (out of scope for Issue 4)

`GET /api/teachers` (line 18) currently fetches every student in the database and filters in JS to compute `studentsCount` per teacher. With 115,209 students this took ~22 seconds end-to-end for our 2-teacher test. Not introduced by Issue 4 — flagged here for future cleanup (a Mongo aggregation pipeline would bring this down to under 100ms).
