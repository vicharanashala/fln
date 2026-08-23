# Onboarding Document — FLN Project

**Contributor Name:** Sampurna Chakrabarty  
**File Name:** `ONBOARDING-Sampurna-Chakrabarty.md`  
**Location:** `Ideas/`  
**Date:** August 23, 2026  

---

## 1. What is FLN?

**Foundational Literacy and Numeracy (FLN)** refers to a child’s fundamental ability to read with understanding (literacy) and perform basic arithmetic operations (numeracy)—specifically addition, subtraction, multiplication, and number recognition. These skills represent the essential cognitive foundation every child must acquire during early schooling to successfully access the broader educational curriculum.

### Target Audience
FLN focuses on primary school children from **Pre-School through Grade 3** (roughly ages 3–9 years old).

### Educational Problem Addressed
* **The Learning Crisis**: Annual status reports (e.g., ASER) have consistently highlighted that millions of children in upper primary grades are unable to read Grade 2-level text or perform simple subtraction. High school enrollment rates across India have not automatically translated into actual learning outcomes.
* **Compounding Gaps**: When a child fails to master foundational literacy and numeracy early on, every subsequent grade becomes increasingly difficult. The learning deficit compounds over time, leading to disengagement, academic failure, grade repetition, and eventual school dropout.
* **Policy Mandates**: The **National Education Policy (NEP) 2020** established universal FLN as the highest urgent priority for the Indian school education system. Following this, the Ministry of Education launched **NIPUN Bharat** (National Initiative for Proficiency in Reading with Understanding and Numeracy) under Samagra Shiksha with the mandate that every child must achieve grade-level FLN competencies by Grade 3 (target 2026–27).

### Overall Purpose of the Software
The FLN software platform is designed to provide teachers, schools, and educational administrators with an automated, data-driven, and highly personalized assessment ecosystem. Instead of applying one-size-fits-all standardized testing, the system:
1. Automatically generates personalized question papers tailored to each student's current proficiency level (spanning Levels 1–59).
2. Facilitates physical paper-based assessments with rapid ICR/OCR answer sheet scanning via smartphone cameras or scanners.
3. Automatically evaluates student responses, updates individual learning profiles, issues FLN certificates (`Level >= 5`), or prescribes targeted remedial worksheets for re-assessment.
4. Aggregates real-time performance analytics from school to national levels for policy planning and governance.

---

## 2. What do you understand by FLN as a system?

FLN operates as a multi-tiered, multi-actor system linking students, educators, administrative governance, personalized curriculum mapping, and automated evaluation pipelines.

### Users and Entities Involved

1. **Students**: The primary beneficiaries. Each student is assigned a unique profile tracking their current FLN level (Levels 1–59 across literacy and numeracy competencies), assessment history, Aadhaar-masked demographic data, and remediation records.
2. **Teachers**: The frontline operators in schools. Teachers manage class rosters, generate and print standard or personalized assessment papers, administer physical exams, scan completed answer sheets, review evaluation diagnostics, and deliver targeted remediation.
3. **Volunteers**: Field support personnel who assist teachers in school-level worksheet generation, exam proctoring, answer sheet scanning, and small-group remedial instruction.
4. **School Admins / Principals**: Manage school-level teacher accounts, oversee overall school compliance, monitor generation locks, and track school performance metrics.
5. **Block / District / State Admins (Coordinators)**: Governance tiers responsible for administrative oversight across blocks, districts, and states. They monitor coordinator registrations, manage school/teacher onboarding, address defaulter escalations, and review regional analytics.
6. **Superadmin**: The national administrative tier with platform-wide authority. Superadmins manage curriculum standards, FLN level definitions, global announcements, platform settings, and executive state-level comparison dashboards.
7. **Schools & Classes**: Structural organizational entities. Schools host classes (Grades 1–3), and each class maintains student rosters mapped to specific teachers and volunteers.
8. **Assessments & Worksheets**: Assessment cycles operate across Baseline, Mid-year, and End-of-year milestones. Worksheets are generated dynamically as standard papers (for new classes/benchmark testing) or personalized papers tailored to each student's specific sub-level.
9. **Certifications**: Students who clear the grade-appropriate FLN benchmark (e.g., clearing Level 5 and above with $\ge 80\%$ score) receive an official FLN Certificate. Students who do not clear the benchmark are assigned remedial sub-levels and scheduled for re-assessment.

### System Interactions & Data Workflows

```
  [Baseline / Diagnostic Exam]
               │
               ▼
 [Personalized Worksheet Generator] ──► [Puppeteer HTML-to-PDF Engine]
               │
               ▼
       [Physical Exam]
               │
               ▼
   [ICR / OCR Mobile Scan]
               │
               ▼
  [Python AI Evaluation Engine] ──► [Level Update & Concept Mastery]
               │
               ▼
 ┌───────────────────────────┐
 │ Pass (Level ≥ 5)          │ ──► Issue FLN Certificate
 ├───────────────────────────┤
 │ Remedial (Level < 5)      │ ──► Assign Sub-Level & Re-assessment Date
 └───────────────────────────┘
               │
               ▼
 [Data Rollup: School ──► Block ──► District ──► State ──► National]
```

---

## 3. Current State of the Repository — What Has Been Done So Far

### Technology Stack
* **Frontend**: Built with **React 19**, **TypeScript**, **Vite**, **Tailwind CSS**, **TanStack React Query**, **Recharts** for analytics, and **Lucide React** icons.
* **Backend**: **Node.js** with **Express.js** (TypeScript). Refactored from a 1580-line monolithic `index.ts` file into modular domain-driven routes:
  * [`auth.ts`](file:///c:/Users/LOQ/OneDrive/Documents/fln/backend/src/routes/auth.ts) — Login, session verification, and token handling.
  * [`students.ts`](file:///c:/Users/LOQ/OneDrive/Documents/fln/backend/src/routes/students.ts) — Roster management, student search, and profile updates.
  * [`worksheets.ts`](file:///c:/Users/LOQ/OneDrive/Documents/fln/backend/src/routes/worksheets.ts) — Paper generation, template rendering, and history.
  * [`evaluation.ts`](file:///c:/Users/LOQ/OneDrive/Documents/fln/backend/src/routes/evaluation.ts) — Evaluation execution and scoring.
  * [`analytics.ts`](file:///c:/Users/LOQ/OneDrive/Documents/fln/backend/src/routes/analytics.ts) — Executive and regional analytical rollups.
  * [`geo.ts`](file:///c:/Users/LOQ/OneDrive/Documents/fln/backend/src/routes/geo.ts) — Geo-administrative auto-resolution APIs.
  * Additional routes: `admin.ts`, `schools.ts`, `teachers.ts`, `logbook.ts`, `tickets.ts`, `announcements.ts`, `classes.ts`, `diagnosticBulk.ts`, `interventions.ts`, `bestPractices.ts`, `stats.ts`.
* **AI & Evaluation Pipeline**:
  * Python pipeline located in `ai-services/` utilizing multi-stage evaluation (`0_classify`, `1_compare`, `2_evaluate`, `3_report`).
  * Integration with **Google Gemini API** (`@google/genai`) for intelligent question paper generation with fallback capabilities.
* **Database & Persistence**:
  * **MongoDB** database integration via Mongoose / custom `dbStore` abstraction supporting Mongo queries with fallback seed data.
* **PDF & Document Engine**:
  * **Puppeteer** and `pdf-lib` for HTML to A4 PDF compilation (`paperGenerator.ts`, `worksheetRenderer.ts`, `pdfMerge.ts`).

### Implemented Features & Architecture
* **Authentication**: JWT-based token authentication with bcrypt password hashing (`backend/src/auth.ts`, `backend/src/routes/auth.ts`).
* **Geo-Administrative Engine**: Complete national coverage across all 36 Indian States and Union Territories with $O(1)$ Map indexing, Levenshtein fuzzy block matching, and multi-state block code auto-resolution (`backend/src/geoData.ts`).
* **Role-Based Dashboards**: Custom interactive dashboards for Superadmin, Admin, District Admin, Block Admin, School, Teacher, and Volunteer roles (`frontend/src/components/RoleDashboards.tsx`, `SuperAdminExecutiveDashboard.tsx`).
* **Worksheet & ICR Workflows**: Dynamic worksheet generation, two-stage ICR answer sheet scanner (`IcrScanner.tsx`, `IcrTwoStageScan.tsx`), and automatic level placement calculation.
* **Governance Mechanics**: Pairwise generation locking (R-11 compliance), timing windows (60m print / 105m exam / 165m submission), and automated defaulter escalation handling.

---

## 4. Gaps Observed in the Code

| # | Where (File Path & Line Range) | What (Issue Identified) | Why it Matters (Impact) |
|---|---|---|---|
| 1 | [`backend/src/routes/evaluation.ts:L85-L120`](file:///c:/Users/LOQ/OneDrive/Documents/fln/backend/src/routes/evaluation.ts#L85-L120) | **Synchronous `execSync` Call for Python Pipeline**: The Python AI evaluation script is invoked synchronously via `execSync('python run_pipeline.py ...')`. | `execSync` blocks the main Node.js event loop during multi-second AI evaluations. Under concurrent teacher sheet uploads, the entire API server becomes unresponsive. Furthermore, un-sanitized parameter interpolation introduces command-injection vulnerabilities. |
| 2 | [`backend/src/routes/auth.ts:L10-L45`](file:///c:/Users/LOQ/OneDrive/Documents/fln/backend/src/routes/auth.ts#L10-L45) & [`frontend/src/components/ForgotPasswordView.tsx:L1-L60`](file:///c:/Users/LOQ/OneDrive/Documents/fln/frontend/src/components/ForgotPasswordView.tsx#L1-L60) | **Unauthenticated / Weak Password Reset**: Password reset endpoints and views lack time-limited cryptographic token verification or OTP validation. | Allows arbitrary password modification if an email address is known, presenting a severe risk of account takeover and privilege escalation. |
| 3 | [`frontend/src/components/RoleDashboards.tsx:L1-L3500`](file:///c:/Users/LOQ/OneDrive/Documents/fln/frontend/src/components/RoleDashboards.tsx#L1-L3500) (175 KB) | **Monolithic Frontend "God" Component**: `RoleDashboards.tsx` contains state, rendering logic, modal managers, and filters for 5+ distinct roles in a single component file. | Impairs code maintainability, hinders unit testing, increases risk of regressions when modifying a single role view, and prevents route-based code splitting. |
| 4 | [`frontend/src/components/RoleDashboards.tsx`](file:///c:/Users/LOQ/OneDrive/Documents/fln/frontend/src/components/RoleDashboards.tsx) & [`backend/src/routes/worksheets.ts`](file:///c:/Users/LOQ/OneDrive/Documents/fln/backend/src/routes/worksheets.ts) | **Scattered Business Rules & Magic Numbers**: Domain constants such as certification threshold (`Level >= 5`), maximum FLN level (`59`), and passing scores (`80%`) are hardcoded across JSX code and backend routes. | Leads to logic drift between frontend displays and backend evaluation engines. Any policy change requires searching and modifying dozens of disparate code locations. |
| 5 | [`frontend/src/services/apiClient.ts:L20-L33`](file:///c:/Users/LOQ/OneDrive/Documents/fln/frontend/src/services/apiClient.ts#L20-L33) | **Unmanaged Auth Token Expiry**: `apiFetch` reads `fln_token` from `localStorage` without client-side expiration checks or token refresh logic. | When tokens expire after 7 days, user requests fail abruptly with 401 errors without attempting refresh or preserving draft form states. |

---

## 5. Ideas for the Project

### Idea 1: Asynchronous Worker Queue for Evaluation & ICR (Connected to Gap 1)
* **What**: Replace synchronous `execSync` execution with an asynchronous job queue (e.g., BullMQ with Redis or an async worker thread pool). The evaluation endpoint will immediately return an HTTP `202 Accepted` status with a `jobId`.
* **Why**: Ensures the Express server remains responsive under heavy concurrent uploads while background workers execute Python ML pipelines.
* **Implementation Plan**:
  1. Create `backend/src/services/queue.ts` using BullMQ / worker threads.
  2. Modify `backend/src/routes/evaluation.ts` to enqueue evaluation tasks and expose `GET /api/evaluation/status/:jobId`.
  3. Update `frontend/src/components/IcrScanner.tsx` to poll for evaluation job status with visual progress indicators.

### Idea 2: Cryptographic Password Reset & Token Verification (Connected to Gap 2)
* **What**: Implement a secure password reset mechanism utilizing signed 15-minute expiration tokens delivered via email or SMS.
* **Why**: Guarantees account security and prevents unauthorized password changes across teacher and administrator accounts.
* **Implementation Plan**:
  1. Add `resetPasswordToken` and `resetPasswordExpires` fields to the User database model.
  2. Implement `POST /api/auth/forgot-password` (generates crypto token) and `POST /api/auth/reset-password` (verifies token and updates password hash).
  3. Update `frontend/src/components/ForgotPasswordView.tsx` and `ResetPasswordView.tsx` to interface with the secure backend endpoints.

### Idea 3: Decompose Monolithic Role Dashboards (Connected to Gap 3)
* **What**: Refactor `RoleDashboards.tsx` into modular role-specific components (`TeacherDashboard.tsx`, `SchoolDashboard.tsx`, `BlockAdminDashboard.tsx`) located within `frontend/src/components/dashboards/`.
* **Why**: Enhances codebase maintainability, improves developer velocity, and enables lazy-loading of role dashboards to optimize initial load times.
* **Implementation Plan**:
  1. Extract shared UI elements (Roster Table, Metric Cards) into reusable presentation components.
  2. Create modular sub-directories for each role dashboard.
  3. Update `App.tsx` or a layout router to render specific dashboard components based on user role.

### Idea 4: Centralized Domain Rules Configuration (Connected to Gap 4)
* **What**: Establish a single source of truth for all FLN business rules and thresholds in a centralized configuration module (`backend/src/config/flnRules.ts` and `frontend/src/constants/flnRules.ts`).
* **Why**: Eliminates hardcoded magic numbers and ensures complete consistency across calculation, rendering, and evaluation modules.
* **Implementation Plan**:
  1. Define export constants: `FLN_CERTIFICATION_LEVEL = 5`, `MAX_FLN_LEVEL = 59`, `PASSING_THRESHOLD = 80`, `TIMING_WINDOWS = { PRINT: 60, EXAM: 105, SUBMIT: 165 }`.
  2. Replace literal numbers throughout backend routes and frontend components with the centralized constants.

---

## 6. Your Contribution

**Branch Name**: `feat/Fixed_Register_coordinator/Added_Forgot_Password-clean`

During the onboarding process, I completed the following technical contributions:

1. **National Geo-Administrative Data System & Unit Tests**:
   * Designed and implemented Map-based $O(1)$ indexing, historical alias resolution, and Levenshtein fuzzy matching in [`backend/src/geoData.ts`](file:///c:/Users/LOQ/OneDrive/Documents/fln/backend/src/geoData.ts).
   * Populated 100% complete official district and block mappings across all 36 Indian States and Union Territories.
   * Created permanent unit test suites to guarantee accuracy for geo-lookup and auto-resolution routines.

2. **Backend Route Decomposition & TypeScript Health Checks**:
   * Contributed to refactoring the 1580-line `backend/src/index.ts` monolith into clean, modular Express router modules (`routes/auth.ts`, `routes/students.ts`, `routes/admin.ts`, etc.).
   * Resolved TypeScript compilation errors in [`backend/src/index.ts`](file:///c:/Users/LOQ/OneDrive/Documents/fln/backend/src/index.ts) and [`backend/src/db.ts`](file:///c:/Users/LOQ/OneDrive/Documents/fln/backend/src/db.ts) to pass automated continuous integration checks (`.github/workflows/repo-health-check.yml`).

3. **Coordinator Registration & Password Reset Flow**:
   * Implemented cascading auto-fill logic for state/district/block selections during block coordinator registration.
   * Developed UI views for password reset flows ([`ForgotPasswordView.tsx`](file:///c:/Users/LOQ/OneDrive/Documents/fln/frontend/src/components/ForgotPasswordView.tsx), [`ResetPasswordView.tsx`](file:///c:/Users/LOQ/OneDrive/Documents/fln/frontend/src/components/ResetPasswordView.tsx)).

---
