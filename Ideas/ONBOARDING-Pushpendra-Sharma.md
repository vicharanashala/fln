# Contributor Onboarding Document

**Contributor:** Pushpendra Sharma  
**Target Milestone:** Version 1.0 Curriculum Quality Assurance & Governance  
**Planned Contribution:** Automated Pedagogical Level-Flagging Engine ([SRS.md §6.7 & §13.2 Rule R-15](../SRS.md#L772))  
**Document Format:** Mandatory Onboarding Specification per [README.md Rules](../README.md#rules)

---

## 1. What is FLN?

**Foundational Literacy and Numeracy (FLN)** refers to the essential cognitive abilities a child must acquire in early primary school (preschool through Grade 3/4, ages 3–9) to read simple text with comprehension and execute basic arithmetic operations (number sense, counting, addition, subtraction, simple multiplication and division).

In India's educational landscape, policy reports (such as ASER and NAS) consistently demonstrate that millions of students in upper primary grades are unable to read a Grade 2 level paragraph or solve simple two-digit subtractions. This foundational deficit compounds year after year, causing students to fall behind their grade-level curriculum, lose confidence, and eventually drop out. The National Education Policy (**NEP 2020**) and the **NIPUN Bharat** Mission established universal FLN attainment by Grade 3 as India's highest near-term education priority.

The FLN platform addresses this crisis by decoupling a student's grade from their actual mastery level. Instead of administering one-size-fits-all grade-level exams, the platform diagnostically assesses every student's genuine foundational milestone (across a structured 93-level numeracy progression), generates AI-personalized practice worksheets targeting each child's weak competencies, auto-evaluates scanned answer sheets via ICR, and advances children toward grade-level certification through continuous feedback loops.

---

## 2. What do you understand by FLN (as a system)?

The FLN platform operates as a multi-tier, hierarchical socio-technical system linking classrooms to national policy oversight:

### 2.1 User Roles & Hierarchy
1. **Students (Beneficiaries):** Assigned persistent unique identifiers (`Student ID`) with masked identity data. Each student has a dynamic profile tracking their current level (1–93), target level, progression history, and concept mastery breakdown.
2. **Teachers (Classroom Operators):** Manage school classes, conduct three annual assessment cycles (Baseline, Mid-Year, End-Year), trigger batch AI-personalized worksheet generation, scan student answer sheets, and submit feedback tickets.
3. **Volunteers (Field Operators):** Deployed to low-strength, rural, or low-connectivity schools under Block Admin supervision to print papers, conduct assessments, and scan answer sheets.
4. **School Principals:** Oversee institution-wide student roster, review class mastery gaps, manage teachers, and generate papers for high-strength schools.
5. **Block Admins:** Supervise volunteers, track block school performance, and manage assessments for low-connectivity schools.
6. **District Admins:** Supervise Block Admins, monitor district pipeline health (Conducted $\rightarrow$ Scanned $\rightarrow$ Evaluated $\rightarrow$ Certified), and resolve bottlenecks.
7. **Admins (State/UT):** Track statewide district rankings, identify lagging regions ($<40\%$ proficiency), and allocate educational resources.
8. **Superadmins (National / IIT Ropar / Vicharanashala Lab):** Hold national oversight, own the 93-level curriculum framework, manage administrator provisioning, broadcast emergency announcements, and act as the sole authority for reviewing and approving pedagogical adjustments and curriculum flag resolutions in the Global Review Queue.

### 2.2 System Entities & Data Flow
* **Assessments:** 3 fixed cycles per year (Baseline at year start, Mid-Year, End-Year) that test students and dynamically update their FLN placement.
* **Worksheets:** Level-personalized practice papers rendered from validated JSON into print-ready A4 PDFs with SVG visual manipulatives.
* **Generation Locks (R-11):** Pairwise locks ({Teacher $\leftrightarrow$ School} and {Volunteer $\leftrightarrow$ Block Admin}) preventing duplicate paper generation for the same exam session.
* **ICR Answer Ingestion & Evaluation Engine:** Scans are digitized, blue-ink isolated, OCR-extracted, and evaluated against the answer key through a multi-stage grading pipeline that produces detailed diagnostic scorecards and narrative mastery reports.
* **Continuous Feedback Loop & Governance:** Pedagogical feedback flows from two channels into the Superadmin Review Queue: manual teacher feedback tickets and automated level flags.

---

## 3. Current State of the Repository — What Has Been Done So Far

### 3.1 Architecture & Stack
* **Monorepo Structure:** Divided into `frontend/` (React 19 + Vite + Tailwind CSS), `backend/` (Node.js + Express + TypeScript + MongoDB Atlas with JSON-file local fallback, with modular routes in `backend/src/routes/`), and `ai-services/` (Python evaluation pipeline + OpenCV blue-ink filtering + PyMuPDF rasterizer + OCR engines).
* **Curriculum Framework:** 93 distinct mathematical levels spanning Preschool 1 through Class 4, with concept mapping (S1.1 through S7.18) and structured question banks.

### 3.2 Implemented Capabilities
* **Authentication & RBAC:** JWT authentication, bcrypt password hashing, rate limiting on login, and server-side role-scoped authorization matrix.
* **ICR Scanning Pipeline:** Two-stage scan workflow (HSV blue-ink filter + multi-provider OCR support: EasyOCR, PaddleOCR, Google Cloud Vision, Ollama-Gemma4, OCR.space), multi-page scanning, and an interactive Teacher Review screen ([PR #272](https://github.com/vicharanashala/fln/pull/272)).
* **Assessment & Student Roster:** CSV student bulk upload with inline error correction ([PR #302](https://github.com/vicharanashala/fln/pull/302)), bulk diagnostic generation ([PR #303](https://github.com/vicharanashala/fln/pull/303)), and per-question student exam histories ([PR #275](https://github.com/vicharanashala/fln/pull/275)).
* **Reporting & Governance:** Role-scoped analytics, immutable logbook audit trail, in-app ticketing system, Superadmin announcements, and intervention tracking.

---

## 4. Gaps Observed in the Code

| # | Where (File / Component) | What is Missing / Flawed | Why it Matters (Impact) |
|---|---|---|---|
| 1 | **[SRS.md §6.7 & §13.2 Rule R-15](../SRS.md#L772)** / **[AUDIT.md §3.3](../AUDIT.md#L125)** | **Missing Automated Pedagogical Level-Flagging Service**: The SRS explicitly mandates that when $\ge 50\%$ of students fail an "easy"-tagged question, the system must auto-flag the item for Superadmin review. In the codebase, this rule was completely unbuilt—flagged questions went unnoticed unless a teacher filed a manual ticket. | Flawed questions, ambiguous wording, or wrong answer keys silently distorted student levels and certification metrics across thousands of children without detection. |
| 2 | `backend/src/routes/evaluation.ts` (Issue #234) | **Gemma 4 Vision Answer Segmentation on Large Sheets**: On multi-question scans with 40+ items, Gemma 4 vision model concatenated multiple answers into single string tokens. | Causes misalignment between extracted answers and answer-key fields during cloud OCR scans. |
| 3 | `frontend/src/components/TicketSubmission.tsx` | **Review Queue lacked Automated Audit integration**: The Superadmin Review Queue only displayed manually submitted tickets, with no automated triage or failure rate diagnostic breakdown. | Superadmins had no centralized dashboard view to audit curriculum quality or inspect question failure statistics. |
| 4 | `backend/src/paperGenerator.ts` / `db.ts` | **Certification distance logic was previously flat (`>= 5`)**: Earlier drafts checked a flat level threshold rather than grade-appropriate ceiling. | Class 4 students at Level 6 were incorrectly marked as certified. |

---

## 5. Ideas for the Project

1. **Idea 1 — Automated Pedagogical Level-Flagging Engine (Planned Contribution):**
   * *What:* Implement a backend service that continuously analyzes student evaluation submissions, detects questions categorized as "Easy" where cohort failure rate $\ge 50\%$, and auto-routes structured diagnostic tickets to the Superadmin Review Queue.
   * *Why:* Directly fulfills SRS Rule R-15 and closes a major governance gap highlighted in AUDIT.md §3.3.
   * *How:* Aggregate question-level accuracy across answer submissions, compute failure ratios, and generate idempotent `LevelFlag` tickets with comprehensive diagnostic statistics.

2. **Idea 2 — Pre-Flight Answer Key Mathematical Verifier:**
   * *What:* Add an automated symbolic math validation step before printing question papers that solves every generated math equation and confirms that the printed answer matches the symbolic computation.
   * *Why:* Prevents human authoring typos or regex errors from ever reaching printed exam sheets.

3. **Idea 3 — Offline Field-Sync Buffer for Volunteers:**
   * *What:* Implement a Progressive Web App (PWA) IndexedDB queue that allows volunteers in zero-connectivity villages to score answer sheets locally and auto-sync evaluation batches once internet connectivity is restored.
   * *Why:* Expands operational reach to remote rural schools without requiring live server roundtrips.

---

## 6. Your Contribution (Planned Scope & Implementation Design)

### 6.1 Planned Implementation Plan
For my onboarding contribution, I plan to design and build the **Automated Pedagogical Level-Flagging Engine** ([SRS.md §6.7 & §13.2 Rule R-15](../SRS.md#L772)), wiring curriculum quality audit from backend data aggregation to the Superadmin Global Review Queue.

#### Key Architectural Components:
1. **Core Service (`backend/src/services/autoFlagService.ts`):**
   * Aggregate all student answer submissions against question definitions.
   * Filter for questions with `difficulty === 'easy'`.
   * Evaluate if $\text{Attempts} \ge 2$ and $\frac{\text{Failures}}{\text{Attempts}} \ge 0.50$ ($50\%$ threshold).
   * Generate structured `LevelFlag` tickets containing question prompt, expected answer, attempt counts, failure counts, exact failure percentage, and affected schools.
   * **Idempotent by Design:** If an open auto-flag ticket already exists for a question, the engine should update its statistics rather than creating duplicates.
   * Record an audit entry in the `logbook` collection for compliance.
   * Compute cohort summary KPIs (Total Flagged Questions, Critical Flags $\ge 70\%$, Average Failure Rate).

2. **Backend API Endpoints (`backend/src/routes/governance.ts`, `backend/src/routes/tickets.ts`, `backend/src/index.ts`):**
   * `POST /api/governance/auto-flag/scan`: Allow Superadmins to trigger an on-demand cohort quality audit scan.
   * `GET /api/governance/auto-flag/summary`: Return summary metrics and active auto-flag items.
   * `POST /api/governance/auto-flag/reset`: Reset auto-flag state and test telemetry for repeatable validation.
   * `PUT /api/tickets/:id` & `POST /api/tickets/:id/resolve`: Support pedagogical reclassification actions (Keep as Easy, Reclassify to Hard, Reclassify to Medium) with audit logbook traceability.
   * **Post-Evaluation Trigger:** Wire into `/api/evaluation/submit` so the audit scan runs asynchronously upon grading completed answer sheets.

3. **Database Schema Extension (`backend/src/db.ts` & `frontend/src/types.ts`):**
   * Define `AutoFlagDetails` interface capturing question text, failure rates, attempt counts, level, and expected answer.
   * Extend `Ticket` interface with `isAutoFlag?: boolean`, `flagDetails?: AutoFlagDetails`, `actionTaken`, `reclassifiedBand`, and `resolutionNote`.
   * Add `resetAutoFlagState` to `DBStore` with defensive null-checks for MongoDB Atlas and local JSON fallback.

4. **Superadmin Global Review Queue Enhancement (`frontend/src/components/TicketSubmission.tsx`):**
   * Add an **Automated Pedagogical Quality Audit (SRS Rule R-15)** banner with live KPI counters (Total Flags, Critical Flags, Average Failure Rate).
   * Add a **"Run Quality Audit Scan (R-15)"** button for one-click cohort analysis.
   * Add filter tabs (`All Tickets`, `⚠️ Auto-Flags (SRS R-15)`, `Curriculum`, `General`).
   * Provide a specialized diagnostic card for Auto-Flags displaying question prompts, expected keys, failure rates, and quick resolution buttons (`Mark Reviewed`, `Take Action: Keep as Easy`, `Take Action: Reclassify to Hard`, `Take Action: Keep as Medium`).

5. **Live Walkthrough Controls (`TeacherDashboard.tsx` & `VolunteerDashboard.tsx`):**
   * Provide one-click live demonstration helpers (`⚡ Live Demo: Set Pending Diagnostic`, `▶ Run Diagnostic`, `⚡ Diagnostic Demo`, `↺ Reset`) allowing mentors and reviewers to verify the complete diagnostic-to-autoflag pipeline live without manual database scripting.

### 6.2 Target Files
* `backend/src/db.ts`: Add `AutoFlagDetails` interface, extend `Ticket` definition, add `resetAutoFlagState`.
* `backend/src/services/autoFlagService.ts`: Core pedagogical anomaly detection service.
* `backend/src/routes/governance.ts`: Governance scan, summary, and reset endpoints.
* `backend/src/routes/tickets.ts`: Enhanced ticket resolution and audit logbook integration.
* `backend/src/routes/evaluation.ts`: Post-evaluation asynchronous auto-flag trigger.
* `backend/src/routes/students.ts`: Diagnostic questions indexing and reset-diagnostic helper.
* `backend/src/index.ts`: Register governance routes.
* `frontend/src/types.ts`: Add `AutoFlagDetails` interface and update `Ticket` definition in frontend.
* `frontend/src/components/TicketSubmission.tsx`: Quality Audit banner, KPI metrics, auto-flag filtering tabs, and diagnostic question card rendering.
* `frontend/src/components/Layout.tsx`: Mount Review Queue & Tickets navigation item.
* `frontend/src/components/dashboards/TeacherDashboard.tsx`: Live demo diagnostic and reset controls.
* `frontend/src/components/dashboards/VolunteerDashboard.tsx`: Live demo diagnostic and reset controls.
* `Ideas/ONBOARDING-Pushpendra-Sharma.md`: Contributor onboarding document per repository guidelines.

### 6.3 Scope Boundaries (What Will NOT Be Changed)
* Will not alter existing ICR OCR algorithms or blue-pen filters.
* Will not change student level progression algorithms or pass/fail thresholds.
* Will not break any existing database models or REST API contracts.

### 6.4 Verification Strategy
* **Automated Verification:** Test suite confirming that when students fail an "easy" question above the threshold, the engine automatically creates a Level Flag ticket with exact metrics, updates existing flags idempotently on subsequent runs, and logs compliance entries to the logbook.
* **Type-Check & Build:** Verified with `npm run lint` across all npm workspaces—**0 errors**.
