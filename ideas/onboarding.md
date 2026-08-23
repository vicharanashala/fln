# Onboarding Document — Ayush Sharma

## 1. What is FLN?

FLN stands for **Foundational Literacy and Numeracy** — the basic ability of a young child to read with comprehension and perform simple arithmetic. It is the skill foundation every later stage of schooling depends on: a child who cannot yet decode a sentence or add two numbers reliably will struggle with every subject built on top of those skills.

The FLN project is a large-scale, personalized assessment platform meant to help **teachers, school principals, block/district/state administrators, and field volunteers** measure, track, and improve every student's FLN outcomes — from automatically generating question papers, to scanning and evaluating completed worksheets, to certifying a student once they clear a benchmark. It is explicitly aligned with national policy priorities (NIPUN Bharat, NEP 2020), which treat FLN as the single most urgent gap in Indian primary education, since a large share of upper-primary students still cannot read grade-level text or solve basic arithmetic. The platform's purpose is to make large-scale FLN assessment and remediation *operationally possible* in a system where teachers do not have time to manually assess every child.

## 2. What do you understand by FLN as a system?

At a data-model level, the platform is built around a small set of core entities that map directly onto the real-world hierarchy of the Indian school system:

- **Geography/administration**: State → District → Block → School, with a matching admin role at each tier (`State Admin`, `District Admin`, `Block Admin`), plus a `Superadmin` at the top with national visibility and a `Principal`/School-level role and `Teacher` role underneath each school.
- **School → Class → Student**: a `School` contains `Class` groups, and each `Class` contains `Student` records. Each `Student` carries a `currentLevel`/`currentSubLevel` (their position in a 59-level numeracy progression) and a `levelHistory`.
- **Content**: `Question` objects (with a `topic`, `subtopic`, `difficulty`, and correct `answer`) are grouped into `Worksheet`/`LevelWorksheet` objects that get generated either as a **standard diagnostic** (same paper for a whole class with no prior data) or as a **personalized worksheet** (built per-student from their own `currentLevel`).
- **Assessment cycle**: a `Worksheet` is printed, filled out, and scanned back in as an `AnswerSubmission` (a map of `questionId → given answer`). This is scored into an `EvaluationReport`, which stores a `score`, a `conceptMastery` breakdown (per-topic "Strong" / "Needs Practice" / "Satisfactory"), and a `recommendedLevel` for the student's next attempt.
- **Follow-up**: an `Intervention` record tracks a student who needs remediation after a weak evaluation; `Ticket`, `LogEntry`, `Announcement`, and `BestPractice` support the operational/communication side (teacher support requests, audit trail, broadcasts).
- **Volunteers** are scoped to an explicit list of `assignedSchools` rather than a geography, which is a different access model from the admin hierarchy above them.

The important interaction to understand is that **`conceptMastery` and `AnswerSubmission` answers are the two richest signals in the system**, but (before my contribution) nothing cross-referenced them across more than one evaluation at a time — each report was read in isolation.

## 3. Current State of the Repository — What Has Been Done So Far

- **Stack**: MERN — MongoDB (native driver, not Mongoose, in the active backend), Express, React + TypeScript on the frontend (Vite-based), served from a single Express process (`backend/src/index.ts`) that also mounts the Vite dev middleware, so `localhost:5000` serves both API and UI in development.
- **Auth**: real, non-trivial auth exists — `POST /api/auth/login` with bcrypt-hashed seeded demo passwords, and a Bearer-token (`fln_token`) scheme read by `getAuthUser()` in `index.ts`, gating every route.
- **Frontend architecture**: a single `App.tsx` with an `activePanel` state switch, a shared `Layout.tsx` sidebar, and role-specific dashboards (`RoleDashboards.tsx`, `PanelViews.tsx`). Notable existing panels: Dashboard/national oversight, Users, Schools, Worksheet Templates, Content, Reports, Analytics, Audit Logs.
- **Implemented workflows**: standard diagnostic paper generation (`POST /api/paper/generate`, class-scoped, not personalized), personalized per-student worksheet generation (`POST /api/worksheets/generate`, uses `student.currentLevel`/`currentSubLevel` via `levelGenerator.ts`), PDF rendering (`worksheetRenderer.ts`, `pdfMerge.ts`, Puppeteer-based batch generation in `backend/fln-backend`), scanned-worksheet ingestion and scoring (`IcrScanner.tsx` + `/api/evaluation/submit`), bulk diagnostics for a whole class, and `Intervention` tracking with a promotion endpoint.
- **Governance/production-readiness details already in place**: teacher-ban and school-lockout checks, per-class/cycle generation locks to prevent duplicate paper generation, and role-scoped data redaction (e.g. guardian PII and Aadhaar are masked for roles without a direct relationship to the child, in `/api/students`).
- **Database**: seeded via `backend/src/seed.ts` — 36 states, 1,440 schools, 86,400 students, ~6,449 users across the full role hierarchy, and a fixed numeracy question bank.
- **Migration in progress / technical debt**: `MIGRATION_PLAN.md` documents a partial move from the original monolithic `index.ts` toward a layered `controllers/services/repositories` architecture (`server.ts` + Mongoose models) that only covers a handful of CRUD entities (students, schools, classes) — the real business logic (diagnostics, worksheets, evaluation) still lives entirely in the old file. This is a live, unfinished refactor, not a design choice.

## 4. Gaps Observed in the Code

**Gap 1 — README-promised features that don't exist in the codebase**
- *Where*: `README.md` (root) describes the assessment cycle as "pass → certificate issued" and "fail → scheduled re-assessment."
- *What*: I searched the entire backend for `certificate` and any re-assessment scheduling logic. No certificate-generation endpoint, PDF template, or `Certificate` model exists anywhere. The `Intervention` model tracks that a student needs remediation, but nothing calculates or stores a concrete next-attempt date.
- *Why it matters*: These are two of the platform's headline claims to the people it's built for (teachers, parents, policy stakeholders). Without them, "pass"/"fail" outcomes are dead ends with no automated follow-through, which is exactly the manual-tracking burden the system is supposed to remove from teachers.

**Gap 2 — "Adaptive Test" is a UI mockup with no backend behind it**
- *Where*: `frontend/src/components/PanelViews.tsx` (the `adaptive_test` panel) and `frontend/src/components/Layout.tsx` (nav entry), plus the marketing copy on the landing page ("state-of-the-art adaptive evaluation").
- *What*: The panel renders a static "72% Avg Adaptive Score" and a "Start New Adaptive Test" button with no `onClick` handler wired to any API call. I confirmed there is no `/api/adaptive*` route anywhere in `index.ts`, and no adaptive-difficulty logic anywhere in `levelGenerator.ts`.
- *Why it matters*: The product's own landing page advertises a capability that does not exist yet. Anyone evaluating the platform against its stated claims (including future contributors or reviewers) will be misled, and it's a correctness/trust issue, not just a missing nice-to-have.

**Gap 3 — The platform's own name promises Literacy; only Numeracy is implemented**
- *Where*: `backend/src/levelGenerator.ts` (all 59 levels) and `SEED_QUESTIONS`/`question_bank_seed.json` in `seed.ts`.
- *What*: Every topic across all 59 levels is numeracy (Number Sense, Number Operations, Shapes, Calendar & Time, Fractions, Money, Measurement, Data Handling). There is no reading, word-recognition, or comprehension question type, and — before my contribution — no reading-fluency assessment mechanism of any kind.
- *Why it matters*: "Foundational **Literacy** and Numeracy" is half-built. This isn't a stylistic gap — NIPUN Bharat and the project's own README treat reading fluency as a distinct, non-negotiable milestone that can't be inferred from numeracy scores.

**Gap 4 — `/api/students` has no server-side search, only opt-in pagination**
- *Where*: `backend/src/index.ts`, the `app.get('/api/students', ...)` handler (~line 434–495).
- *What*: The route supports `?page`/`?limit`, but omitting them (the default behaviour any naive frontend consumer would hit) returns the **entire scoped student list** — up to all 86,400 records for a Superadmin — with no `search` filter available at all. I hit this directly while building a student-search-as-you-type UI: the request consistently exceeded a 15-second client timeout because the endpoint had to serialize and transfer tens of thousands of records for a query that only needed a handful of name matches.
- *Why it matters*: This is a real, reproducible performance bug, not a theoretical one — it will break any feature (search boxes, autocomplete, filtered dashboards) that needs to look up students by name/ID without already knowing to pass pagination params, and it forces every consumer to over-fetch by default instead of under-fetch.

**Gap 5 — Rich per-topic assessment data was never aggregated across a student's history**
- *Where*: `backend/src/db.ts`, the `EvaluationReport` interface (`conceptMastery: { [topic]: 'Strong' | 'Needs Practice' | 'Satisfactory' }`).
- *What*: Every evaluation report already stores detailed topic-level mastery, and `AnswerSubmission` already stores the student's literal given answers, cross-referenceable against `Question.answer`. But no endpoint anywhere read more than one report at a time, so a teacher had no way to see whether a student was *persistently* weak in a topic (vs. one bad day), and no way to see the *specific* wrong answers behind a "Needs Practice" tag.
- *Why it matters*: This is the highest-value, lowest-cost gap in the repo — the data already exists, but the insight a teacher actually needs (which topics does this child keep struggling with, and what exactly is going wrong) was never surfaced.

**Gap 6 — Minor pre-existing TypeScript error left uncorrected**
- *Where*: `backend/src/db.ts`, line 21 (a top-level `catch` block).
- *What*: `'err' is of type 'unknown'` (ts18046) — the caught error is used without a type guard or `instanceof` check.
- *Why it matters*: Low severity on its own, but it's evidence that `tsc --noEmit` (the `lint` script in `package.json`) isn't part of a CI gate, since an error this trivial has persisted through the migration work.

## 5. Ideas for the Project

**Idea 1 — Weak-Topic Detector (implemented — see Section 6)**
Aggregate a student's `conceptMastery` across *all* their evaluation reports (not just the latest one) into a sorted, per-topic weakness rate, so a teacher can see at a glance which topics a child is consistently struggling with rather than re-reading each report by hand. This directly addresses Gap 5 and uses data that already exists — no new data collection is required, only a new read path.

**Idea 2 — Specific-mistake surfacing + targeted practice generation**
Extending Idea 1: cross-reference each `AnswerSubmission`'s given answers against the correct `Question.answer` to show a teacher the *exact* question a child got wrong and what they answered (not just "Fractions: Needs Practice"), and auto-generate a short practice set pulled from the `questions` collection for the student's weakest 1–2 topics. This turns a diagnostic signal into an actionable next step for the teacher, closing the loop that Gap 5 identifies as missing.

**Idea 3 — Real certificate generation on benchmark pass**
Reuse the existing PDF-generation pattern already proven in `paperGenerator.ts` (which already builds PDFs with `pdf-lib`) to generate a simple certificate (student name, level, date) the moment an `EvaluationReport` clears the recommended-level threshold. This is a small, contained addition that closes the gap between what the README promises (Gap 1) and what actually happens on a pass.

**Idea 4 — Automatic re-assessment scheduling on fail**
When an `EvaluationReport` falls short of the benchmark, automatically compute a next-attempt date (e.g. +7 days) and attach it to the corresponding `Intervention` record, then surface a "Due for re-test" list on the teacher dashboard. This closes the other half of Gap 1 and reuses the `Intervention` model that already exists but currently has no scheduling behaviour.

**Idea 5 — Server-side search as a standard pattern for list endpoints**
Generalize the `search` query-param fix I made for `/api/students` (Gap 4) into a documented convention for any endpoint that can return a large collection (schools, worksheets, evaluation reports), so future features don't rediscover the same timeout the hard way.

## 6. Your Contribution

During onboarding, I designed and implemented a **Weak-Topic Detector** feature on the `feat/weak-topic-detector` branch, addressing Gap 5 directly:

- **`backend/src/db.ts`** — added three methods: `getWeakTopicsForStudent()` (aggregates `conceptMastery` across all of a student's evaluation reports into a sorted weakness-rate list), `getMistakesForStudent()` (cross-references `AnswerSubmission` answers against `Question.answer` to surface exactly what a student got wrong), and `getPracticeQuestions()` (pulls a random set of questions for a given topic).
- **`backend/src/index.ts`** — added three corresponding endpoints: `GET /api/evaluation/:studentId/weak-topics`, `GET /api/evaluation/:studentId/mistakes`, and `GET /api/practice-questions?topic=&count=`.
- **`backend/src/seed.ts`** — since no realistic evaluation/answer data existed to test against, I extended the seed script to generate ~259,000 realistic `EvaluationReport` records tied to real `Question` documents, along with matching `AnswerSubmission` records containing a mix of correct and plausibly incorrect answers, so the new endpoints have real data to operate on.
- **`frontend/src/components/WeakTopicsPanel.tsx`** — a new panel with a debounced student search box, color-coded per-topic weakness bars, a specific-mistakes list, and "Generate practice" buttons for the two weakest topics.
- **`frontend/src/components/Layout.tsx`** and **`App.tsx`** — wired the new panel into the app's navigation as a first-class sidebar item ("Weak Topics"), rather than a standalone/disconnected screen.
- Along the way, I also identified and fixed the `/api/students` timeout issue (Gap 4) by adding server-side `search` filtering, which the new panel's student search depends on.

All backend endpoints were manually verified against real seeded data (via authenticated requests) before wiring up the frontend, and the full flow — search → select student → analyze → view weak topics, mistakes, and generated practice questions — has been tested end-to-end in the running app.
