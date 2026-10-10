# FLN Contributor Onboarding

**Contributor:** Pandraju Sreeja (@sreeja37)

**Date:** September 30, 2026

**Repository:** [vicharanashala/fln](https://github.com/vicharanashala/fln)

**Fork:** [sreeja37/fln](https://github.com/sreeja37/fln)

---

## 1. What is FLN?

FLN means Foundational Literacy and Numeracy. The broader goal is to help children build the basic skills they need to keep learning. In this repository, the software currently focuses on foundational **mathematics and numeracy**; literacy assessment is not implemented yet.

The platform helps teachers assess what students understand, identify concepts that need more practice, and follow progress over time. Its paper-based workflow connects question or worksheet generation with printing, scanning completed work, and evaluation. The project is being built one school stage at a time, beginning with Balvatika and then Class 1 through Class 3.

## 2. What do you understand by FLN as a system?

FLN is a workflow for students, teachers, and education administrators. Students are associated with a class, section, and school. Teachers manage their students and run assessments. School, block, district, state, and superadmin roles have different levels of operational access and reporting scope.

At a high level, the workflow is:

1. A teacher prepares a diagnostic or worksheet for a class or student.
2. Students complete the paper assessment.
3. The completed work is scanned or entered for evaluation.
4. The backend stores the assessment result and updates the student's record.
5. Teachers use the result to understand progress and plan follow-up practice or assessment.
6. Administrators view data within their authorized scope.

Important entities include students, schools, classes, curriculum levels and concepts, question templates, worksheets, answer submissions, evaluation reports, and teacher observation records. A level in the curriculum configuration does not by itself mean that generation, printing, scanning, and evaluation all work for that level end to end.

## 3. Current State of the Repository — What Has Been Done So Far

This is a focused review of the repository and the paths related to my contribution, rather than a claim that I have inspected every file and historical branch.

- **Frontend:** React 19, Vite, and Tailwind CSS in `frontend/`.
- **Primary API:** Node.js, Express, and TypeScript in `backend/`. It uses the native MongoDB driver when configured and supports a local JSON-file fallback for individual development.
- **Other services:** `ai-services/` contains the Python evaluation and OCR pipeline. `backend/fln-backend/` is a separate worksheet-related backend workspace.
- **Authentication:** The primary backend uses signed JWTs and bcrypt-backed password checks. API routes should use the established authentication helpers and enforce the user's data scope.
- **Assessment workflow:** The repository includes role-based dashboards, student and school management, question and worksheet generation, scanning/evaluation paths, and analytics. The degree of end-to-end support varies by curriculum stage and feature; the README calls out unfinished generation work for Balvatika.
- **Observation data:** `TeacherObservationRecord` and database methods already existed on `main`, but the API route wiring was missing. My #617 branch adds that wiring and regression coverage; it is not yet part of upstream `main` until its PR is merged.

## 4. Gaps Observed in the Code

### Gap 1: Observation records were not reachable through the API

- **Where:** `backend/src/db.ts` (`TeacherObservationRecord` and its observation methods); no observation route was registered in `backend/src/index.ts` on `main`.
- **What:** The data model and database operations existed, but the application had no HTTP endpoints to create or retrieve observation records.
- **Why it matters:** A future checklist form or scan-result handler could not save teacher ratings or read them back through the backend.
- **Status:** Addressed in my `fix/issue-617-observation-routes` branch for issue #617. The separate printed observation-sheet workflow is still tracked independently.

### Gap 2: Authored question intent does not yet reach worksheet generation

- **Where:** `backend/src/routes/questionTemplates.ts`, `backend/src/levelGenerator.ts`, and `backend/src/paperGenerator.ts`.
- **What:** The README and issue #486 describe intent-based question templates that do not yet have a complete consumer in the worksheet-generation path.
- **Why it matters:** Content can be authored and approved without necessarily appearing on a generated student worksheet.
- **Status:** Open and outside the scope of issue #617.

### Gap 3: The local JSON fallback is intended for solo development

- **Where:** `backend/src/db.ts`, especially the JSON `save()` and collection persistence paths.
- **What:** The file-backed store rewrites JSON data and does not provide the concurrency guarantees of a production database.
- **Why it matters:** Multiple simultaneous writers can overwrite one another's changes. The repository documentation recommends MongoDB for normal team development and says not to rely on the JSON fallback for concurrent use.

## 5. Ideas for the Project

### Idea 1: Complete the teacher-observation workflow

- **What:** Connect the observation API to the printed class-grid and per-child sheets, then accept their scanned results.
- **Why:** The API makes observation records available, but teachers still need a practical way to collect and submit ratings.
- **How:** Build on `TeacherObservationRecord` and the routes from #617; coordinate PDF generation and scan-back with issue #618 and the existing `ai-services/PIPELINE.md` workflow. Preserve `notYetAssessed` as separate from `rating`.

### Idea 2: Wire intent-based templates into worksheet generation

- **What:** Make approved `questionTemplates` produce rendered questions in the worksheet pipeline.
- **Why:** Authored content should reach student papers without silently falling back to an unrelated legacy source.
- **How:** Follow issue #486: resolve the template's generation intent, question family, and visual theme at generation time, and preserve the distinction between legacy and intent-based rows.

## 6. My Contributions

I have submitted contributions for issues #441, #625, and #617. The changes below describe what the branches implement; they should not be read as a claim that the pull requests have already been merged into `main`.

### Issue #441: Complete superadmin school onboarding

- Added the school onboarding form to Coordinator Management, including school identity, location, postal address, government code, contacts, type/management, establishment year, initial classes, and principal account details.
- Expanded the `School` model and `POST /api/schools` validation/persistence, kept new model fields optional for existing records, and displayed address/identifying details in school views.
- Added principal creation/linking and initial class setup to the onboarding flow.
- Manually created a school using the local JSON fallback. MongoDB Atlas persistence was not runtime-tested in my environment because `MONGODB_URI` was not configured.

### Issue #625: Preserve optional choice error tags

- Added optional `choiceErrorTags` to the question data types and database schema so a choice can carry its associated error tag without requiring tags on legacy questions.
- Added a regression test for `GET /api/worksheets` that checks tagged questions retain their tags and older questions without tags remain readable.

### Issue #617: Expose teacher observation records through the API

- Added `GET /api/observations/student/:studentId?cycle=...` and `GET /api/observations/class/:classId?cycle=...`.
- Added `POST /api/observations` to save or update a record. The backend derives teacher identity and school from the authenticated user and student rather than trusting those identity fields from the request.
- Added cycle/rating validation and access checks for the requested student and class.
- Updated the database methods to support the repository's JSON fallback as well as MongoDB, and added regression tests for save/read/upsert, authentication, and cycle validation in `backend/tests/observations.test.ts`.
- Manually verified a save, student read, class read, and repeat submission that updated the existing record. `npm run test:observations --workspace @fln/backend` passed (2 tests); `npm run build:backend` succeeded.

