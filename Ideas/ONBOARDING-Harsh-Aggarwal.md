# ONBOARDING — Harsh Aggarwal

---

## 1. What is FLN?

FLN stands for Foundational Literacy and Numeracy. In the context of this project, it refers to the basic skills — counting, number recognition, pattern reasoning, shape identification, and early reading — that every child needs to have in place before formal schooling can build on them effectively.

The project targets children in the pre-primary and primary band: roughly ages 3 to 10, mapped to a seven-stage curriculum that runs from Stage 1 (Preschool 1, age 3–4) through Stage 7 (Class 4, age 9–10). The problem it is trying to solve is structural: classrooms have no standardized, low-cost, scalable way to assess where each individual child actually is in this progression, plan work at that level, and track whether the child is moving. Teachers deal with large, mixed-ability classes, paper-based worksheets that are not linked to any common taxonomy, and no tooling to roll progress up to a principal, district officer, or national administrator in a consistent format.

This system replaces that informal process with a software-driven loop: assess, diagnose, generate a targeted worksheet at the child's current level, scan and evaluate the completed sheet with AI assistance, update the child's level record, and surface the aggregate picture across the whole school-district-state-national hierarchy to the relevant administrator at each level.

---

## 2. What do you understand by FLN (as a system)?

FLN is a multi-role operational platform where the same underlying student learning data is read by six different audiences at six different levels of granularity.

**Users and roles:** The role model is defined in `backend/src/db.ts` under `UserRole` (lines 75–83): `superadmin`, `admin`, `district_admin`, `block_admin`, `school`, `teacher`, and `volunteer`. Each role controls which data and which actions that user can reach, enforced by `getAuthUser` and `canAccessStudent` in `backend/src/auth.ts`. The frontend mirrors this with per-role dashboard components in `frontend/src/components/dashboards/`.

**Main entities:**
- **Student** — carries `currentLevel`, `targetLevel`, `levelHistory`, `aadharMasked`, and extended profile fields. Defined in `backend/src/db.ts` lines 120–158.
- **School / ClassGroup** — the organizational containers for students and teachers.
- **Worksheet** — a generated set of questions with a timing window, cycle name (Baseline / Mid-year / End-of-year), and lock state.
- **EvaluationReport** — the output of the AI evaluation pipeline: score, concept mastery by topic, recommended next level, and root cause breakdown per wrong answer.
- **Certification** — a formal record of whether a student has met the competency threshold for their class, governed by `CompetencyRequirement` entries loaded from `data/competencyRequirements.seed.json`.
- **QuestionTemplate / QuestionLogic** — superadmin-authored building blocks that drive question generation.

**High-level data flow:**
1. A teacher or volunteer logs in, selects a class, and generates a worksheet for the current cycle via `POST /api/worksheets` (`backend/src/routes/worksheets.ts`).
2. The backend locks that class for the cycle and writes a `Worksheet` record. Timing windows control when printing is allowed, when the exam can be run, and when answers can be submitted.
3. After the exam, the teacher scans each sheet through the ICR workflow (`frontend/src/components/IcrScanner.tsx`) which calls the Python pipeline in `ai-services/`.
4. The pipeline produces an `EvaluationReport` stored against the student. The backend advances the student's `currentLevel` and logs the event in `levelHistory`.
5. If the report puts the student at or above the certification threshold, a `Certification` row is created in `review_needed` state and an email is fired to admin/superadmin (`backend/src/services/certificationNotifications.ts`).
6. Administrators at each level access their scoped dashboards to review aggregate metrics: certified count, level distribution, school-by-school comparison.

The Balvatika stage (Stage 3, levels 19–46) adds a separate concern: some assessments at this age cannot be delivered on paper (e.g. "counts in any order") and must be observed. The `assessmentMode` field on `QuestionTemplate` records whether an item is `'written'`, `'observed'`, or `'both'`.

---

## 3. Current State of the Repository — What Has Been Done So Far

**Tech stack:**
- Frontend: React 19 + Vite + TypeScript + Tailwind CSS, served by Vite dev server on port 5173 which proxies `/api/*` to the backend.
- Backend: Express + TypeScript, running under `tsx` in development and bundled with `esbuild` for production. Listens on port 3000.
- Database: MongoDB when `MONGODB_URI` is set (`backend/src/db.ts`, `connectDB()`); falls back to a JSON flat-file store at `backend/data/db.json`. Writes are full-collection delete-and-reinsert (Mongo) or full-file-rewrite (JSON) — not concurrency-safe.
- Auth: Real JWT signed and verified with `jsonwebtoken` (`backend/src/auth.ts:6`). Passwords stored as bcrypt hashes. The demo hash uses bcrypt rounds 10 and is never stored in plaintext.
- AI: Google Gemini API for question generation and evaluation narrative; Python pipeline in `ai-services/` for OCR, scan quality assessment, and root cause tagging.
- PDF generation: Puppeteer (`backend/src/paperGenerator.ts`).

**Implemented features:**
- Seven-role access control hierarchy enforced at every route.
- 109-level curriculum map in `backend/src/config/curriculumMap.ts` covering Stages 1–7.
- Worksheet generation with timing windows and cycle locking.
- ICR scan workflow for OMR-style answer sheet recognition.
- Per-student evaluation reports with concept mastery and root cause breakdown.
- Certification engine with review workflow (`backend/src/routes/certification.ts`, `backend/src/services/certificationEligibility.ts`).
- Misconception fingerprinting and clustering (`backend/src/routes/misconceptions.ts`, `frontend/src/components/MisconceptionFingerprint.tsx`).
- Best practices library derived from successful interventions.
- Question bank, question logics, and question templates for superadmin authoring.
- Aadhaar tokenization and vault with MFA step-up (`backend/src/routes/aadhaarDetokenize.ts`, `backend/src/modules/vault/`).
- Analytics and logbook for administrators.
- Intervention tracking.

---

## 4. Gaps Observed in the Code

### Gap 1 — `getSeedCompetencyRequirements` used `require()` under ESM
**Where:** `backend/src/db.ts`, lines 20–28 (before fix).  
**What:** The function loaded the seed JSON using `require('fs').readFileSync(...)`. Because `backend/package.json` sets `"type": "module"`, `require` is not defined at runtime under `tsx`. The call throws inside the function's own `try`, and the `catch` returns `[]` silently. This meant that every `reset()` and fresh file-store start seeded zero competency requirements, so no student could ever transition to an `'active'` certification.  
**Why it matters:** Certification is a core feature (SRS R-7). A silent seed failure meant that in any development or test environment using the file-store, the certification engine was permanently broken with no log output to diagnose it.  
**Fixed in:** Issue [#675](https://github.com/vicharanashala/fln/issues/675). Changed to a top-level `import { readFileSync } from 'fs'` and added `console.error` in the catch block.

---

### Gap 2 — No shared, validated taxonomy for Balvatika error tags
**Where:** There was no `backend/src/errorTags.ts` file. Error tag strings were expected to be free-text anywhere a question template or observation record referenced them.  
**What:** Without a central constants file, any author could type an arbitrary string as an error tag, two contributors could spell the same error type differently, and the backend had no way to reject an unknown tag at write time.  
**Why it matters:** The Balvatika error-tag feature is the downstream input for the diagnostic classification and teacher reporting pipeline. Inconsistent tag values corrupt the aggregated picture that teachers and administrators read.  
**Fixed in:** Issue [#626](https://github.com/vicharanashala/fln/issues/626). Created `backend/src/errorTags.ts` (constants + `isValidErrorTag` + `getTagsForTopic`) and `GET /api/error-tags` endpoint.

---

### Gap 3 — `isBalvatikaStage(level)` was inlined repeatedly
**Where:** Any file that needed to check whether a curriculum level belongs to Stage 3 had to write `CURRICULUM_MAPPING[level]?.stage === 3` inline. There was no exported utility function for this.  
**What:** The inline form is easy to get wrong (wrong stage number, wrong field name, missing optional chaining) and produces N copies of the same logic that must all be updated if the stage numbering ever changes.  
**Why it matters:** Stage 3 gating controls assessment mode enforcement, NIPUN readiness band computation, and concept mastery rules — all safety-critical paths. A single typo in any inline copy would silently mis-classify levels.  
**Fixed in:** Issue [#612](https://github.com/vicharanashala/fln/issues/612). Exported `isBalvatikaStage(level: number): boolean` from `backend/src/config/curriculumMap.ts`.

---

### Gap 4 — Silent catch blocks throughout `db.ts`
**Where:** `backend/src/db.ts`, multiple `try/catch` blocks (the `getSeedCompetencyRequirements` pattern is one instance; similar bare `catch { return ... }` blocks exist for other load paths).  
**What:** Errors that indicate a misconfigured environment (wrong working directory, missing seed files, malformed JSON) are swallowed without any log. The server starts and appears healthy but serves incorrect or empty data.  
**Why it matters:** This makes the system very hard to diagnose in staging or production. An empty competency list, empty school list, or empty question bank all look the same from the outside — the server is up and the API returns 200 with an empty array.

---

### Gap 5 — Certification write uses full collection delete-and-reinsert
**Where:** `backend/src/db.ts`, `persistCollection()` and any collection write path.  
**What:** Every mutation to a MongoDB-backed collection deletes all documents and reinserts the entire in-memory array. Under the JSON file store, every mutation rewrites the entire file.  
**Why it matters:** Under any concurrent load, two simultaneous writes will race and one will silently lose the other's changes. For Aadhaar token records and certification status changes, this is a data integrity risk, not just a performance problem.

---

## 5. Ideas for the Project

### Idea 1 — Centralize all magic constants into a `shared/` package
**What:** Move the score thresholds (80/60), certification level (`>= 5`), stage numbers, and `CYCLE_NAMES` into a `shared/` npm workspace package imported by both `frontend/` and `backend/`.  
**Why:** The `AUDIT.md` and `AGENTS.md` both note that these constants appear in multiple files without a single source of truth. A missed update in one place produces silently wrong behavior (e.g. frontend shows a student as certified while backend rejects).  
**How:** Create a `shared/` workspace with `constants.ts` exporting these values. Update `package.json` workspaces to include it. Replace all inline magic numbers with imports from `@fln/shared`.

---

### Idea 2 — Add write-level validation for error tags at the question template save endpoint
**What:** When a `QuestionTemplate` is saved with an `errorTags` field, call `isValidErrorTag(topic, tag)` for each tag and return HTTP 400 with a clear message for any unknown tag.  
**Why:** Without backend validation, the authoring UI's dropdown and the backend's constants file can drift silently. A superadmin who bypasses the dropdown (via curl or a future API client) can write arbitrary strings that break downstream classification.  
**How:** Import `isValidErrorTag` from `backend/src/errorTags.ts` inside `backend/src/routes/questionTemplates.ts` and add a validation loop before the insert.

---

### Idea 3 — Replace the delete-and-reinsert collection write with upsert-by-id
**What:** For each collection that has a stable `id` field (students, certifications, worksheets), replace the current `deleteMany + insertMany` with individual `replaceOne({ id }, doc, { upsert: true })` calls.  
**Why:** Removes the data-loss race condition on concurrent writes. Does not require a schema migration or a new abstraction layer.  
**How:** Update `persistCollection()` in `backend/src/db.ts` to accept a key field parameter and switch to upsert semantics when a MongoDB client is active.

---

### Idea 4 — Add a health endpoint that reports seed data load status
**What:** Extend `GET /api/health` (or create it if it does not exist) to report whether the competency requirements seed, the question bank, and the level HTML templates are loaded and non-empty.  
**Why:** Silent empty-data states (Gap 4 above) are very hard to diagnose remotely. A health endpoint that explicitly reports `{ competencyRequirements: 16, questionBank: 1202, levelTemplates: 93 }` makes the diagnosis immediate.  
**How:** In `backend/src/index.ts`, add a route that calls `dbStore.getSeedData()` and counts each collection; return the counts and a `healthy: boolean` flag.

---

## 6. Your Contribution

Three pull requests were raised during this onboarding:

### PR 1 — Shared error tag taxonomy + endpoint (Issue #626)
**Branch:** `fix/626-shared-error-tags`  
**Files changed:**
- Created `backend/src/errorTags.ts`: exports `TOPIC_ERROR_TAGS`, `isValidErrorTag(topic, tag)`, and `getTagsForTopic(topic?)`.
- Created `backend/src/routes/errorTags.ts`: registers `GET /api/error-tags` and `GET /api/error-tags?topic=<topic>`, protected behind `getAuthUser`.
- Updated `backend/src/index.ts` to register the new route module.
- Created `backend/src/__checks__/errorTags.check.ts`: runnable assertion script verifying all tag lookups, the topic filter, and invalid-topic handling.

This prevents any layer of the stack from hardcoding error tag strings by providing a single endpoint and import point that both the frontend authoring dropdown and the backend validation route read from.

---

### PR 2 — `isBalvatikaStage(level)` helper (Issue #612)
**Branch:** `fix/612-is-balvatika-stage`  
**Files changed:**
- Edited `backend/src/config/curriculumMap.ts`: exported `isBalvatikaStage(level: number): boolean` that returns `true` iff `CURRICULUM_MAPPING[level]?.stage === 3`.
- Created `backend/src/__checks__/curriculumMap.check.ts`: 5 assertions covering all Stage 3 levels (19–46), all non-Stage-3 levels, and out-of-bound inputs.

This removes the need for any caller to inline the stage check and gives the existing `CURRICULUM_MAPPING` a well-typed, easily grep-able access point.

---

### PR 3 — Fix `getSeedCompetencyRequirements` under ESM (Issue #675)
**Branch:** `fix/675-seed-competency-requirements-esm`  
**Files changed:**
- Edited `backend/src/db.ts` lines 1–28: replaced `require('fs').readFileSync(...)` with a top-level `import { readFileSync } from 'fs'`, and replaced the bare `catch {}` with `catch (err) { console.error(...) }`.
- Created `backend/src/__checks__/seedCompetencyRequirements.check.ts`: 2 assertions confirming that `dbStore.getSeedData().competencyRequirements` returns exactly 16 entries under ESM/tsx, and that each entry has the expected shape.

Without this fix, every development-environment `reset()` call silently seeded zero competency requirements, making the certification engine inoperative for any contributor running without MongoDB.
