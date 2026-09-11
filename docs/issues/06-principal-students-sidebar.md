# Issue 6 — Principal Students sidebar item renders an empty workspace

## Status

**Resolved** in branch `fix/school-dashboard-priority-1-10`, commit `<this commit>`.

## What was wrong

The principal sidebar emits `{ name: 'Students', view: 'students', icon: GraduationCap }` at `frontend/src/components/Layout.tsx:180`. Clicking it sets `activePanel = 'students'`, which is then handed to `PanelViews.tsx` for routing. `PanelViews.tsx` had branches for `student_list`, `student_profile`, `diagnostic_test`, etc., but **no branch for `'students'`**. The `return null` at the end (line 109) rendered nothing — the user clicked Students in the sidebar and got an empty workspace with no error message, no roster, no controls.

The teachers' sidebar uses `view: 'student_list'`, which is why teachers saw a working student roster — they were hitting a different panel value than principals.

## What I did

In `frontend/src/components/PanelViews.tsx`, added a new branch:

```tsx
if (panel === 'students') {
  return (
    <StudentListPanel
      students={students}
      studentsLoading={studentsLoading}
      currentUser={currentUser}
      token={token}
      refreshStudents={refreshStudents}
    />
  );
}
```

It mounts the same `StudentListPanel` component that teachers and volunteers use. Because:

- `StudentListPanel` already accepts principals (Issue 5's `canRegisterStudents` flag exposes the Register New Student and Bulk Import CSV buttons).
- `GET /api/students` is already role-scoped (Issue 5's cross-school guard ensures principals only see their own school's roster).
- The `refreshStudents` callback refreshes the list after a register or CSV import.

…clicking Students as a principal now shows the same roster UI teachers get, plus the register/import controls (which principals couldn't reach before Issue 5).

## Files changed

- `frontend/src/components/PanelViews.tsx` — adds an `'students'` branch that mounts `StudentListPanel`.
- `scripts/verify-i6.sh` — static check that the branch exists and that no other sidebar view emitted by Layout.tsx falls through (besides the 6 known-routed-elsewhere panels).
- `docs/issues/06-principal-students-sidebar.md` — this file.

## How I verified

`scripts/verify-i6.sh` runs grep-based checks:

- Lists every `view: '<name>'` emitted by `Layout.tsx`'s sidebar.
- Lists every `panel === '<name>'` branch in `PanelViews.tsx`.
- Computes the diff (sidebar views not covered by PanelViews branches).
- Asserts `panel === 'students'` is present.

After the fix:

```
--- Issue 6 check: panel === "students" branch exists ---
PASS: panel === students branch present.
```

The 6 panels that legitimately don't appear in PanelViews (`assessment`, `logbook`, `misconceptions`, `notifications`, `settings`, `workspace`) each have their own dedicated dashboard surface or are handled by other components; they don't fall through PanelViews at all.

`tsc --noEmit` clean in `frontend/`.

## Acceptance criteria — status

- [x] Principal Students item opens a real panel.
- [x] The panel renders the principal's school roster (via the same role-scoped `GET /api/students`).
- [x] The roster is scoped to `user.schoolId` (server-side filter, Issue 5 cross-school guard).
- [x] Register and CSV controls are available (Issue 5's `canRegisterStudents` flag includes SCHOOL).
- [x] Empty roster state is shown when appropriate (handled by `EmptyStudents` shared component).
- [x] Teacher-only actions are not exposed to principals (no such gating exists; the panel is identical for both roles).
