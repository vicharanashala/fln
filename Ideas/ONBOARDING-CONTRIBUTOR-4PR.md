# Contributor Onboarding Document & PR Specification

**Contributor:** FLN Platform Contributor  
**Target Milestone:** Closes #367 — Re-Scoped Dashboard Intern Tasks & UX Improvements  
**Document Format:** Mandatory Onboarding & PR Specification per [README.md Rules](../README.md#rules)

---

## 1. What is FLN?

**Foundational Literacy and Numeracy (FLN)** refers to the essential cognitive abilities a child must acquire in early primary school (preschool through Grade 3/4, ages 3–9) to read simple text with comprehension and execute basic arithmetic operations (number sense, counting, addition, subtraction, simple multiplication and division).

The FLN Assessment & Personalized Worksheet Platform is an AI-driven socio-technical system that diagnostically assesses each child's foundational milestone level across a structured 93-level numeracy progression, generates level-personalized printable worksheets, ingests scanned answer sheets via ICR/OCR pipelines, evaluates student responses, and rolls data up a 7-role national hierarchy.

---

## 2. What do you understand by FLN as a system?

The FLN platform operates as an end-to-end socio-technical system linking classrooms to national policy oversight across 7 standardized roles:
1. **Students (Beneficiaries):** Assigned unique persistent identifiers (`Student ID`) with masked identity data, dynamic level tracking (1–93), and milestone history.
2. **Teachers (Classroom Operators):** Manage school classes, conduct Baseline/Mid-Year/End-Year assessments, trigger batch AI worksheet generation, and review OCR evaluations.
3. **Volunteers (Field Operators):** Deployed to low-connectivity or rural schools under Block Admin supervision to print papers, conduct tests, and scan answer sheets.
4. **School Principals:** Oversee institution-wide student rosters, review class mastery gaps, and manage teachers.
5. **Block Admins:** Supervise volunteers, track block school performance, and manage assessments for low-connectivity schools.
6. **District Admins:** Supervise Block Admins and monitor district pipeline health (Conducted → Scanned → Evaluated → Certified).
7. **State Admins & Superadmins:** National/State oversight, curriculum management, coordinator provisioning, emergency announcements, and review queue governance.

---

## 3. Summary of 4 Solved PR Tasks (Issue #342)

Below are the 4 modular frontend dashboard tasks implemented to improve dashboard UX, error-recovery workflows, and filter state persistence without altering backend business logic:

### Task 1: Teacher OCR Correction & Manual Verification Drawer (Ref: #367)
- **Implemented File:** `frontend/src/components/evaluation/OcrCorrectionDrawer.tsx`
- **Capabilities:**
  - Slide-over drawer interface for reviewing digitized student responses against expected answer keys.
  - Displays cropped student handwriting image preview, expected answer, recognized OCR text, and confidence badges (**High**: Green, **Medium**: Amber, **Low**: Red).
  - Quick action buttons: **Mark Correct** (`isCorrect: true`) and **Mark Incorrect** (`isCorrect: false`).
  - Editable answer input field (`correctedAnswer`).
  - Connects to backend API: `PATCH /api/evaluation/:reportId/override`.
  - Accessible dismissal with backdrop click, close button, and `Escape` key handling.

### Task 2: Standardize Role Dashboard Empty-States and Skeleton Loaders
- **Target Views:** `TeacherDashboard.tsx`, `VolunteerDashboard.tsx`, `SchoolDashboard.tsx`, `AdminDashboard.tsx`
- **Capabilities:**
  - Integrated `DashboardSkeleton.tsx` and `RosterSkeleton.tsx` shimmer loading animations during asynchronous data fetching (`studentsLoading`, `dashboardLoading`).
  - Added reusable `EmptyStateCard.tsx` illustrations and actionable CTA buttons (*"Register New Student"*, *"Generate Your First Paper"*, *"Smart CSV Upload"*) when 0 students or 0 classrooms are registered.
  - Layout stability ensured with zero dimension shifts across light and dark modes.

### Task 3: Session-Persisted Filters for Class and School Rosters
- **Updated Files:** `StudentListPanel.tsx`, `TeacherDashboard.tsx`
- **Capabilities:**
  - `StudentListPanel.tsx` initializes active tab selection from `sessionStorage` key `fln_roster_filter`.
  - `TeacherDashboard.tsx` restores active class filter from `sessionStorage` key `fln_teacher_class_filter`.
  - Filter state persists across navigation into student profiles and browser reloads within the same session.
  - Added an accessible **"↺ Reset Filter"** action to return roster views to default `'all'` state.

### Task 4: Connect Logbook & Support Ticketing Modals in Navigation (Ref: #72, #148)
- **Updated Files:** `Layout.tsx`, `TicketModal.tsx`, `LogbookModal.tsx`, `TicketSubmission.tsx`
- **Capabilities:**
  - Wired topbar header navigation icons (**Support Tickets** and **Activity Logbook**) to open functional modal dialogs.
  - Enabled support and curriculum ticket filing (`type`: `'general'` | `'curriculum'`, `subject`, `description`) submitting to `POST /api/tickets/create`.
  - Filtered tickets with real-time status badges (**Open** / **Resolved**) and role-scoped access control (`canViewLogbook`).

---

## 4. Verification & Testing

- **TypeScript Compilation:** Type compilation checked cleanly with zero compilation errors (`npx -p typescript tsc --noEmit`).
- **Codebase Integrity:** Preserved all existing API contracts, Tailwind design system tokens, and server-side governance logic.
