# Issue 5 — Principal is excluded from student registration and CSV import controls

## Status

**Resolved** in branch `fix/school-dashboard-priority-1-10`, commit `<this commit>`.

## What was wrong

`frontend/src/components/panels/StudentListPanel.tsx:27` gated the entire Register New Student and Bulk Import CSV UI behind:

```tsx
const isTeacherOrVolunteer = currentUser.role === UserRole.TEACHER || currentUser.role === UserRole.VOLUNTEER;
```

A principal hitting this panel saw the student roster but had no way to add anyone to their own school from the UI. The backend `POST /api/students` and `POST /api/students/bulk-import` already accepted the `SCHOOL` role (the role check at line 402 listed `'SCHOOL'` correctly), but the principal could never reach it because the buttons weren't rendered.

There was also a secondary maintenance smell — the role check at line 402 was a redundant double-check (uppercased `'SCHOOL'` array AND `user.role !== UserRole.SCHOOL` enum equality), and the `schoolId || user.schoolId` fallback silently overrode any submitted school without surfacing misconfigurations.

## What I did

### Frontend (`frontend/src/components/panels/StudentListPanel.tsx`)

Added a new derived flag `canRegisterStudents = isTeacherOrVolunteer || currentUser.role === UserRole.SCHOOL` and replaced the lone gate at line 237 (`{isTeacherOrVolunteer && (...)}`) with `{canRegisterStudents && (...)}`. The existing `isTeacherOrVolunteer` is preserved because it is referenced by other logic inside the file.

### Backend (`backend/src/routes/students.ts`)

1. **`POST /api/students`** — replaced the messy double role check with a single `STUDENT_REGISTRATION_ROLES` array. Added a cross-school guard for principals: if `user.role === SCHOOL` and the submitted `schoolId` disagrees with `user.schoolId`, return HTTP 400 with the named message (matches Issue 4's behavior). If `schoolId` is omitted, the existing `req.body.schoolId || user.schoolId` fallback uses the principal's school. Switched audit `activityType` from `'verify'` to `'register'` (Issue 16).

2. **`POST /api/students/bulk-import`** — added a per-row cross-school check. If a principal submits rows and any row has a `schoolId` that disagrees with `user.schoolId`, the entire request is rejected with HTTP 400 naming the offending row index (`Row 2: a principal can only bulk-import students at their own school (gps-i5-A). Got 'gps-i5-B'.`). Rows that omit `schoolId` continue to use the principal's school via the existing fallback. Switched audit `activityType` from `'verify'` to `'register'`.

## Files changed

- `frontend/src/components/panels/StudentListPanel.tsx` — `canRegisterStudents` gate.
- `backend/src/routes/students.ts` — role-check cleanup, cross-school guard for both POST /api/students and /api/students/bulk-import, audit activity type.
- `scripts/verify-i5.sh`, `scripts/verify-i5-cleanup.js` — 6-case verification + cleanup.
- `docs/issues/05-principal-can-register-students.md` — this file.

## How I verified

`scripts/verify-i5.sh` exercises:

1. Principal adds a single student at own school → HTTP 200, `schoolId: gps-i5-a`.
2. Principal omits `schoolId` → HTTP 200, defaults to own school.
3. Principal submits `schoolId: gps-i5-B` (different school) → HTTP 400 with named message.
4. CSV bulk import (2 rows) at own school → HTTP 200, both created.
5. CSV bulk import where row 2 has wrong `schoolId` → HTTP 400 naming row 2.
6. `GET /api/students` as the principal → HTTP 200 in 80ms, returns all 4 students at `gps-i5-a`.

`tsc --noEmit` clean in both `backend/` and `frontend/`. Test records cleaned up from Atlas after the run.

## Acceptance criteria — status

- [x] Principal sees Register New Student.
- [x] Principal sees Bulk Import CSV.
- [x] The form uses `/api/students`.
- [x] The principal cannot assign another school. (HTTP 400 with named message.)
- [x] Student creation uses `user.schoolId`.
- [x] CSV import uses the same school scope.
- [x] New students appear in the principal roster.
- [x] Route note: `/api/students` and `/api/students/bulk-import` (plural). There is no valid `/api/student` endpoint.
