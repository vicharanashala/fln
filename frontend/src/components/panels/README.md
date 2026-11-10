# panels

## Overview
Role-specific page bodies, mostly selected by `../PanelViews.tsx` from the `activePanel` id. `QuestionReviewPanel`, `QuestionTemplatePanel` and `CurriculumLevelsPanel` are rendered only inside `../dashboards/SuperadminDashboard.tsx` (`:833-845`), `CertificatesPanel` only inside `StudentProfilePanel` / `StudentListPanel`, and `QuestionInterventionPanel` is imported nowhere. `usePanelData` loads the shared lists once; each panel receives only what it renders.

## Interface
- Data hook: `usePanelData.ts` (`usePanelData(token, currentUser, activePanel)`: students, `studentsLoading`, schools, `schoolsLoading`, `schoolsError`, `refreshSchools`, users, reports, worksheets, teachers, district/block stats, `updateStudentLocally`, `refreshStudents`).
- Shared: `PanelShared.tsx` (`PageHeader`, `EmptyStudents`), `pdfReportGenerator.ts` (`handleDownloadPDF`).
- Teacher: `StudentListPanel` (also `extractInvalidStudentRows`), `StudentProfilePanel`, `DiagnosticTestPanel`, `AdaptiveTestPanel` (a placeholder that renders a "not available yet" message), `TestHistoryPanel`, `WorksheetsPanel`, `PerformancePanel`, `CertificatesPanel`.
- Volunteer: `AssignedSchoolsPanel`, `StudentProgressPanel`, `AttendancePanel`.
- Principal and regional admin: `TeachersPanel`, `SchoolsPanel`, `DistrictsPanel`, `BlocksPanel`, `AnalyticsPanel` (`getTotalSchoolsCount`).
- Superadmin and content: `UsersPanel`, `ContentPanel`, `SecurityPanel`, `SystemSettingsPanel` (static empty-state text only), `AadhaarRevealPanel`, `AadhaarRevealDialog`, `CurriculumLevelsPanel`, `QuestionBankPanel`, `QuestionReviewPanel`, `QuestionTemplatePanel`, `QuestionInterventionPanel`, `WorksheetTemplatesPanel`.
- Tests: `AnalyticsPanel.test.tsx`.

## Invariants
- Panels never decide access; `PanelViews` gates by `UserRole` and the backend enforces scope.
- Aadhaar values are shown only through the reveal dialog/panel flow, which requires explicit confirmation.
- No fake data: empty or failed loads must show an empty/error state, not placeholder rows. Not fully met today: `usePanelData.ts:60-70` swallows fetch errors for coordinators, reports, worksheets and teachers with empty `.catch` handlers (no error state), and `AttendancePanel.tsx:21` and `PerformancePanel.tsx:15` divide by the roster length, giving `NaN` for an empty roster.

## Side Effects
- `usePanelData` fetches `/api/students`, `/api/schools`, `/api/teachers`, `/api/worksheets`, `/api/evaluation/reports`, `/api/admin/coordinators` depending on panel and role. Only `/api/students` is skipped per panel (`STUDENTS_NOT_NEEDED_PANELS`, `usePanelData.ts:17-23`) and only `/api/teachers` is role-gated (school and block admins); `/api/schools`, `/api/admin/coordinators`, `/api/evaluation/reports` and `/api/worksheets` are fetched for every role and panel. Students are fetched with `?all=1`.
- Panels also call question-bank, question-template, question-logic, curriculum, certification, security and student-mutation endpoints under `/api`; several write to the backend (imports, retire/restore, bulk student import).
- `handleDownloadPDF` triggers a browser file download.
- Also called: `/api/paper-types/config` (`WorksheetTemplatesPanel`) and `/api/error-tags` (`QuestionTemplatePanel`).
- The "certified" threshold `currentLevel >= 5` is hard-coded in `usePanelData.ts` and `PerformancePanel.tsx`, although the platform has 109 levels.

## Verification
- Run: `npm test --workspace @fln/frontend` (vitest run, from repo root)
