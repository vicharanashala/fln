# Re-Scoped Dashboard Intern Tasks Specification (Issue #342)

Following the audit of legacy issues/PRs #36–#44 (documented in [#341](https://github.com/vicharanashala/fln/issues/341)), the underlying data layer and MongoDB role endpoints are now standardized.

This document outlines **four modular, intern-ready frontend tasks** that improve dashboard UX, maintainability, and review workflows without risking core pedagogical or certification logic.

---

## Task 1: Teacher OCR Correction & Manual Verification Drawer (Ref: #367)

### Objective
Provide a human-in-the-loop side-over drawer allowing teachers and volunteers to manually verify or correct OCR-evaluated student responses.

### Background & Context
When assessment sheets are scanned and processed via TrOCR / Vision pipelines, borderline confidence scores or messy handwriting need teacher review before final marks are saved. The backend already supports evaluation overrides via `PATCH /api/evaluation/:reportId/override` (request body uses a `corrections` array keyed by `questionId`).

### Implementation Scope
- **File to Create**: `frontend/src/components/evaluation/OcrCorrectionDrawer.tsx`
- **UI Elements**:
  1. Cropped student handwriting image.
  2. Recognized OCR text vs Expected Answer from the question bank.
  3. Confidence indicator badge (High: Green, Medium: Amber, Low: Red).
  4. Quick action buttons: **Mark Correct** (`isCorrect: true`), **Mark Incorrect** (`isCorrect: false`).
  5. Corrected answer input field (optional `correctedAnswer` string to fix OCR transcription errors).
- **API Call**: `PATCH /api/evaluation/:reportId/override`
  ```json
  {
    "corrections": [
      {
        "questionId": "q_101",
        "isCorrect": true,
        "correctedAnswer": "42"
      }
    ]
  }
  ```

### Acceptance Criteria
- [ ] Drawer slides open when clicking "Review" on any low-confidence item in evaluation reports.
- [ ] Submitting an override updates the local report view immediately and calls the backend API.
- [ ] Accessible close button and backdrop click dismissal.

---

## Task 2: Standardize Role Dashboard Empty-States and Skeleton Loaders

### Objective
Eliminate visual layout shifts and provide clear calls-to-action (CTAs) across Teacher, Volunteer, School, and Admin dashboards during initial data loading.

### Background & Context
Currently, several dashboard metrics and tables flicker or render blank cards while waiting for MongoDB network responses.

### Implementation Scope
- **Files to Create**:
  - `frontend/src/components/ui/DashboardSkeleton.tsx` (Metric card & chart shimmer placeholders).
  - `frontend/src/components/ui/RosterSkeleton.tsx` (Table row shimmer placeholders).
  - `frontend/src/components/ui/EmptyStateCard.tsx` (Reusable illustration + title + description + CTA button).
- **Target Views**:
  - `TeacherDashboard.tsx`
  - `VolunteerDashboard.tsx`
  - `SchoolDashboard.tsx`
  - `AdminDashboard.tsx`

### Acceptance Criteria
- [ ] Shimmer animations pulse smoothly using Tailwind `animate-pulse` without shifting card dimensions.
- [ ] Friendly empty-state illustrations displayed when a teacher has 0 classes, 0 students, or 0 generated assessments.
- [ ] Direct CTA button on empty states (e.g., *"Generate Your First Paper"* or *"Register Students"*).

---

## Task 3: Session-Persisted Filters for Class and School Rosters

### Objective
Maintain selected School, Class, and Section filter state in browser memory so teachers do not lose their place when navigating into a student profile and returning.

### Background & Context
When managing rosters in `StudentListPanel`, drilling into a student's assessment report and pressing the browser or app "Back" button resets all dropdowns to default values.

### Implementation Scope
- **Files to Update**:
  - `frontend/src/components/panels/StudentListPanel.tsx`
  - `frontend/src/components/dashboards/TeacherDashboard.tsx`
- **Mechanism**:
  - Save active filter state (`selectedSchool`, `selectedClass`, `selectedSection`) to `sessionStorage` on change:
    ```typescript
    sessionStorage.setItem('fln_roster_filter', JSON.stringify({ schoolId, classId, section }));
    ```
  - On component mount, initialize `useState` from `sessionStorage` if present, falling back to user defaults.

### Acceptance Criteria
- [ ] Filter choices persist across navigation within the same browser session.
- [ ] "Reset Filters" button allows clearing persisted state back to defaults.
- [ ] Switching user roles clears or updates stored filters accordingly.

---

## Task 4: Connect Logbook & Support Ticketing Modals in Navigation (Ref: #72, #148)

### Objective
Wire the Support Ticket and Activity Logbook buttons in the sidebar header to open functional modal dialogs backed by the backend ticketing API.

### Background & Context
The dashboard navigation headers feature "Tickets" and "Logbook" action buttons that are currently unlinked or placeholder stubs. The backend supports `/api/tickets`.

### Implementation Scope
- **Target Views**:
  - `frontend/src/components/Layout.tsx`
  - `frontend/src/components/tickets/TicketModal.tsx`
- **Features**:
  1. View list of support/feedback tickets filed by the user (`GET /api/tickets`).
  2. Create a new support or curriculum feedback ticket (`type`: `'general'` | `'curriculum'`, `subject`, `description`).
  3. Submit to `POST /api/tickets/create`.

### Acceptance Criteria
- [ ] Clicking the Ticket icon in the navbar opens the `TicketModal`.
- [ ] Users can submit new tickets with validation and receive instant feedback.
- [ ] Existing tickets render with appropriate status badges (`Open` / `Resolved`) and feedback type.

---

## Guidance for Interns & First-Time Contributors
1. **Stick to One Task per PR**: Do not bundle multiple dashboard tasks into one pull request.
2. **Follow Component Conventions**: Use existing UI primitives from `frontend/src/components/` and Tailwind CSS utility classes.
3. **No Business Logic on Frontend**: All scoring, level calculation, and certification state must stay on the backend API.
4. **Test Before Submitting**: Run `npm run lint` and manually test by clicking through the flows in both light and dark mode.
