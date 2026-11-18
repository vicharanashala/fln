# ONBOARDING — Anirban Halder

## 1. What is FLN?

Foundational Literacy and Numeracy (FLN) is an open-source platform for teachers and students. It helps teachers create questions and worksheets at a student's current level, assess results, identify concept-level learning gaps, and provide constructive feedback and improvement areas instead of focusing only on marks.

## 2. What do you understand by FLN (as a system)?

FLN is a coordinated educational system with several connected roles and workflows:

1. Students are identified and enrolled by the platform, take assessments at their academic level, and receive constructive analysis and suggested improvement areas.
2. Teachers register students and schools, access interactive or printable worksheets, upload answer scripts, and review personalised feedback.
3. The superadmin dashboard provides operational and administrative information about students, schools, districts, states, coordinators, and registrations.
4. The curriculum is organised by academic levels, from preschool through higher curriculum levels, with questions of increasing difficulty.
5. Certification evaluates skills such as verbal, pictorial, decomposition, numerical-operation, and pattern-recognition work. A satisfactory review activates the certificate; otherwise, the student must improve and retry.

## 3. Current State of the Repository — What Has Been Done So Far

**Technology stack**

- **Frontend:** React 19, TypeScript, Vite, and Tailwind, with role-specific platform workspaces.
- **Backend:** A main Node.js/Express API and a separate Express/Puppeteer service for batch worksheet rendering.
- **Data and sign-in:** MongoDB through the native driver, with a local JSON fallback. Passwords use bcrypt, and requests use signed JWTs with server-side role and scope checks.
- **Assessment support:** The repository includes PDF and worksheet generation, scan/evaluation routes, Gemini/Ollama integrations, and Python rasterization tools.

**Implemented features**

- Student and class management, bulk import, role dashboards, question-template authoring, worksheets, evaluation and review, observations, certifications, analytics, tickets, and logbooks.

**Current limits**

- The project is primarily mathematics-focused.
- Some curriculum levels do not yet have a complete verified assessment flow.
- Adaptive testing is not implemented.
- Some dashboard figures and suggestions are static.
- The main API does not run the separate Python evaluation pipeline end-to-end.

**Testing**

- Frontend tests use Vitest.
- Backend tests include focused unit, API, and browser checks.
- `npm run check:pr` runs type checks, tests, builds, and route smoke checks.
- `npm run lint` runs type checks only.

## 4. Gaps Observed in the Code

### 1. D1.3 — Question-to-Skill Mapping

**Where:** The normalized question data is in `backend/src/data/question_template.csv`; authoring and CSV import are in `backend/src/routes/questionTemplates.ts`, lines 60-99 and 624-664. Skill-level validation is supported by `backend/src/config/skillLevelMap.ts`.

**What is wrong or missing:** The question bank needs a clear, consistent mapping between each question and the skill or subskill it assesses. Without reliable metadata, the platform cannot accurately identify demonstrated skills or areas that need improvement.

**Why it matters:** A dependable question-to-skill map enables meaningful feedback for pattern recognition, word-problem solving, reasoning, and numerical operations.

**What's done:** [PR #907](https://github.com/vicharanashala/fln/pull/907) adds question-template coverage for verbal, pictorial, decomposition, numerical-operation, and pattern-recognition skills, along with difficulty levels and a normalized join-table CSV format.

### 2. Accessibility Issues in Issue #750

**Where:** `frontend/src/components/panels/SchoolsPanel.tsx`, lines 29-31; `frontend/src/components/SuperAdminExecutiveDashboard.tsx`, lines 291-450; `frontend/src/components/dashboards/SuperadminDashboard.tsx`, line 387 and lines 693-727; and `frontend/src/components/Layout.tsx`, lines 383-387.

**What is wrong or missing:** The accessibility audit found filters with labels not associated with their controls, an "Urgent Email" checkbox without an accessible name, a notification button without an accessible name, and small grey text with insufficient contrast.

**Why it matters:** People using screen readers need controls to have accessible names, and users with low vision need sufficient text contrast.

**What's done:** [PR #851](https://github.com/vicharanashala/fln/pull/851) adds `aria-label` attributes to the affected selectors and notification button, gives the urgent-email checkbox an accessible name, and updates the relevant labels. The final implementation should be confirmed after merge.

### 3. Certification Queue Scope and Concurrent Updates in Issue #739

**Where:** `backend/src/db.ts`, lines 1787-1803, and `backend/src/routes/certification.ts`, lines 45-168.

**What is wrong or missing:** The certification queue could expose certifications outside an administrator's permitted area. Two administrators could also make decisions on the same certification concurrently, because stale decisions could both succeed.

**Why it matters:** Administrators must only see and act on certifications within their authorization scope. Simultaneous decisions must not silently overwrite one another.

**What's done:** [PR #853](https://github.com/vicharanashala/fln/pull/853) uses an expected certification version to reject stale updates and increments the version after successful MongoDB or in-memory updates. The queue filters certifications with `canAccessStudent` and state-area checks, while superadmins retain access to all certifications. The review route also keeps its access check.

## 5. Ideas for the Project

### A. Paired “near-miss” questions

**What:** Present two almost-identical problems that differ in one important feature, such as addition with and without regrouping.

**Why:** Comparing responses can reveal whether a student understands the concept or relies on a memorized procedure.

**How:** Link question templates as pairs and compare the student's responses to identify the feature that caused difficulty.

### B. Capture the student's working, not only the answer

**What:** Allow selected questions to include intermediate steps, such as tens and ones shown before addition.

**Why:** The same incorrect answer can come from different misunderstandings; step-level work helps distinguish them.

**How:** Add structured working areas to printable templates and let teachers or scanning tools record intermediate results alongside the final answer.

### C. Question wording and language variants

**What:** Provide approved versions of a question using simpler wording or a familiar local context while testing the same skill.

**Why:** A student may understand the mathematics but struggle with unfamiliar language or context.

**How:** Link wording variants to one skill and difficulty level, allowing teachers to select an appropriate version without changing the assessed concept.

## 6. Your Contribution

### Question Bank — PR #907

- Added 40 question entries with multiple representations and difficulty levels.
- Used a normalized join-table CSV format for skills and subskills.
- Added support for categories and representation types such as symbolic, verbal, equation-completion, fraction, and pictorial questions.
- Direct PR: https://github.com/vicharanashala/fln/pull/907

### Accessibility Improvements — PR #851

- Added accessible names to the State, District, and Block selectors in `SchoolsPanel.tsx`.
- Added accessible names to Time Horizon, State Jurisdiction, School Type, Education Board, Grade Band, and Operational Status in `SuperAdminExecutiveDashboard.tsx`.
- Added an accessible name to the Urgent Email checkbox in `SuperadminDashboard.tsx`.
- Added an accessible name to the Notifications button in `Layout.tsx`.
- Direct PR: https://github.com/vicharanashala/fln/pull/851

### Certification Security and Concurrency — PR #853

- Updated `updateCertificationIfVersion` in `backend/src/db.ts` to increment the certification version after successful MongoDB or in-memory updates.
- Added optimistic concurrency in `backend/src/routes/certification.ts`, returning `409 Conflict` when a stale version is submitted.
- Filtered the certification queue using `canAccessStudent` and state/area scoping.
- Preserved all-certification access for superadmins.
- Direct PR: https://github.com/vicharanashala/fln/pull/853
