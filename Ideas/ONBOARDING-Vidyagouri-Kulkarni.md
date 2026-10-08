# Onboarding Document — Vidyagouri Kulkarni

---

## 1. What is FLN?

FLN stands for Foundational Literacy and Numeracy: the basic reading and mathematical skills children need for further learning. This project helps teachers understand each student's learning level and plan suitable assessments instead of treating every child in a class the same way.

The current project focuses on mathematics, not literacy assessment. The README describes a stage-by-stage plan beginning with Balvatika, the year before Class 1, followed by Classes 1–3. Some assessment workflows are still being connected.

---

## 2. What do you understand by FLN (as a system)?

**Users:** Teachers and volunteers manage classroom activity. School, block, district, state and superadmin users oversee progressively broader areas.

**Main entities:** Students, schools, class groups, curriculum levels, question templates, worksheets and evaluation records.

**Intended flow:** Register a student → prepare and print an assessment → collect and evaluate answers → update progress → plan the next intervention.

The frontend communicates with the real backend API. Authentication, scoring and assessment decisions belong on the server. A curriculum entry does not mean its complete worksheet workflow is ready; the README identifies unfinished authoring-to-worksheet work under issue #486.

---

## 3. Current State of the Repository — What Has Been Done So Far

**Tech stack:**

- **Frontend:** React 19, TypeScript, Vite and Tailwind CSS.
- **Backend:** Node.js, Express and TypeScript. A separate worksheet backend also exists under `backend/fln-backend/`.
- **Database and authentication:** MongoDB, a local JSON fallback for development, signed JWTs and bcrypt password verification.
- **Assessment tools:** Python evaluation/OCR code, Gemini integration and Puppeteer for printable output.

**Existing implementation:** Student registration and bulk import, role-based dashboards, worksheet/PDF generation, evaluation routes, question authoring, tickets and logbooks. These components do not establish that every workflow is complete end-to-end.

**Loading states:** `DashboardSkeleton`, `RosterSkeleton` and `EmptyStateCard` already serve all four dashboards through merged [PR #534](https://github.com/vicharanashala/fln/pull/534). They are not a pending contribution of mine.

**Testing:** Frontend Vitest tests cover utilities and a simulated roster/pagination helper. Backend suites include focused browser checks. `npm run check:pr` runs type-checks, tests, builds and route smoke checks; `npm run lint` checks types only.

---

## 4. Gaps Observed in the Code

### Gap 1 — Approximate dashboard data

**Where:** `frontend/src/components/dashboards/AdminDashboard.tsx`.

**What:** Exam and sheet counts use `scopedSchools.length * 3` and `studentsCount * 2`. Volunteer assignments depend on a hardcoded `preseededVolunteers` list.

**Why it matters:** These values may not represent actual activity or all volunteer assignments.

### Gap 2 — Fixed learning suggestions

**Where:** `frontend/src/components/dashboards/SchoolDashboard.tsx`.

**What:** The “AI Concept-Focus Suggestions” panel displays fixed Class 2 and Class 3 messages while describing them as evaluation-based.

**Why it matters:** School users could mistake example messages for findings about their students.

### Gap 3 — Limited dashboard interaction tests

**Where:** `frontend/src/components/TeacherRosterPagination.test.ts` and `frontend/src/utils/*.test.ts`.

**What:** These tests cover helpers, not the four dashboards' rendering and navigation. Browser tests exist for other features.

**Why it matters:** Passing helper tests does not confirm that dashboard states and user actions work correctly.

---

## 5. Ideas for the Project

### Idea 1 — Show actual administrative data

**What:** Replace approximate counts and the hardcoded volunteer list.

**Why:** Give administrators reliable information.

**How:** Return actual, role-scoped counts and assignments from the backend and display them in the dashboard.

### Idea 2 — Make suggestions evidence-based

**What:** Use school-specific evaluation data for learning suggestions.

**Why:** Avoid presenting fixed messages as personalized advice.

**How:** Agree on the required evidence, retrieve it through the backend, and show an unavailable state when data is insufficient.

### Idea 3 — Test dashboard interactions

**What:** Add rendering and navigation tests.

**Why:** Catch problems that helper tests miss.

**How:** Extend the existing tooling to test loading, empty and populated states, plus relevant navigation actions.

These are proposals, not completed contributions. Each needs a listed issue and maintainer agreement before implementation.

---

## 6. Your Contribution

### Issue #592 — Template download with references

**PR:** [#652](https://github.com/vicharanashala/fln/pull/652), merged on 7 October 2026.

**Change:** The original CSV provided headings without the reference values needed to fill it in. I added a superadmin-only ZIP containing the blank CSV, level/subskill references, SVG theme references and instructions. It uses existing curriculum/catalog data without changing the importer or writing to the database.

**Key files:** `backend/src/services/questionTemplateDownload.ts`, `backend/src/routes/questionTemplates.ts` and `frontend/src/components/panels/QuestionTemplatePanel.tsx`.

**Verification:** Six focused tests passed, covering authorization, ZIP contents, import compatibility, CSV safety, failure handling and browser download behavior. Type-checks and builds passed.

### Issue #589 — Reusable SVG object library

**PR:** [#653](https://github.com/vicharanashala/fln/pull/653), merged on 7 October 2026.

**Change:** I added 28 monochrome SVG drawings under `frontend/public/assets/svg/questions/` and registered them in `manifest.json`. The catalog increased from 22 to 50 variants across 11 themes, preserving existing artwork and IDs. The selection algorithm was unchanged.

**Verification:** Three focused tests passed: catalog/file validation, repeatable selection with the same catalog, and browser rendering/printing. Type-checks and builds passed. Identical selections across catalog versions and classroom suitability are not guaranteed by these tests.

### Issue #687 — Stage-specific template ZIP

**PR:** [#709](https://github.com/vicharanashala/fln/pull/709), open and not merged as of 8 October 2026.

**Change:** Following reviewer feedback on #652, I added stage selection, filtered level/subskill references, allowed-value guidance and a separate example CSV. The blank import CSV and importer remain unchanged; SVG references are not filtered by stage.

**Key files:** The template download service, route and panel above, curriculum snapshot files, and `docs/testing-687-stage-template-download.md`.

**Verification:** All 11 focused tests and the full local `npm run check:pr` passed. I also completed manual acceptance testing. Examples validate the CSV format; they are not pedagogically reviewed content for every concept.

These checks were completed during the respective implementations. My contributions improve authoring support and reusable assets; they do not change scoring, certification or complete the production worksheet pipeline.
