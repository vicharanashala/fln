# components

## Overview
UI layer of the FLN app: the authenticated shell (`Layout`), landing and login views, workflow components (diagnostic, worksheet, ICR/OCR scanning, certification, logbook, misconception analysis), generic widgets, and four subfolders.

## Interface
- Shell and routing helpers: `Layout`, `LandingView`, `LoginView`, `DemoLoginPanel` (lazy-loaded only in a build with `VITE_ENABLE_DEMO_LOGINS === 'true'`), `LanguageSwitcher`, `ErrorBoundary`, `PanelViews` (maps `activePanel` to a panel), `RoleDashboards` (re-exports the dashboards, `LevelBadge`, `splitCSVLine`, `parseCSVText`, `FLN_LEVELS_LIST`, `FLNLevelReferenceModal` and `RegionalAnalyticsView`; it also defines its own 4-state `STATE_NAMES` and 5-district `DISTRICT_NAMES` maps, used by `dashboards/AdminDashboard.tsx`, which duplicate the fuller maps in `src/constants.ts`).
- Generic widgets: `Card` (the file `Card.tsx` exports only `MetricCard`; a second, different `MetricCard.tsx` exists but nothing imports it), `Charts` (`StatePerformanceBarChart`, `TrendLineChart`, `DonutPieChart`), `Form` (`Input`, `Select`, `Textarea`), `Table` (`Table`, `extractTableRows`, `Column`), `SvgLibraryResolver`.
- Assessment workflows: `DiagnosticWorkflow`, `BulkDiagnosticWorkflow`, `BaselineUpload`, `WorksheetWorkflow`, `WorksheetIframeModal`, `AssessmentCalendar`.
- Scanning: `IcrScanner`, `IcrTwoStageScan`, `BulkIcrScan`.
- Analysis and records: `MisconceptionFingerprint`, `ChildErrorSignature`, `EducationalReasoning` (`ReasoningSection`), `SkillGraphPanel`, `CertificationReviewPanel`, `CertificationHistoryCard`, `LogbookView`, `LogbookModal`, `SuperAdminExecutiveDashboard`, `TicketSubmission`.
- Tests: `TeacherRosterPagination.test.ts`, which tests a locally redefined `processRosterData` helper rather than the real `Table` / `TeacherDashboard` code, so it does not verify those components.
- Subfolders: [dashboards](./dashboards/README.md), [panels](./panels/README.md), [tickets](./tickets/README.md), [ui](./ui/README.md).

## Invariants
- Components receive `token` and `user` as props and talk to the backend only through `../services/apiClient`, with one exception: `panels/DiagnosticTestPanel.tsx:130` uses raw `fetch` for the PDF URL.
- `WorksheetIframeModal` listens for `FLN_WORKSHEET_DOWNLOADED` `postMessage` events from the worksheet HTML pages but only logs them (`:36-43`), and no worksheet page posts the message yet (see [public/worksheets](../../public/worksheets/README.md)).
- Role-based visibility is a convenience; authorization is enforced by the backend.

## Side Effects
- Network calls to `/api/*` (diagnostic, ICR, worksheet, misconception, certification, logbook, tickets, login, students, `/api/evaluation/*`, `/api/analytics/superadmin`, `/api/stats`, `/api/schools`, `/api/classes`, `/api/db-status`).
- Camera/file uploads for ICR scanning; PDF/CSV downloads; iframe loading of `/worksheets/*.html`.
- `localStorage` access for the token and preferences; `Layout.tsx` owns `fln_font_size` and `fln_sidebar_collapsed`.

## Verification
- Run: `npm test --workspace @fln/frontend` (vitest run, from repo root)
