# FLN Repository Onboarding — Ekjot Singh

## 1. What is FLN?

**Foundational Literacy and Numeracy (FLN)** refers to the basic skills children need to read with understanding and perform elementary mathematical operations. These foundational skills support learning across later school subjects.

The FLN project at Vicharanashala Lab for Education Design, IIT Ropar, aims to help schools assess students' foundational skills, identify learning gaps, and track progress through personalized assessments.

**Important scope clarification:** The current `vicharanashala/fln` repository implements the **Mathematics/Numeracy assessment path**. The README explicitly states that literacy assessment is not currently implemented in this repository. The wider curriculum map contains 109 levels, but the current FLN build is focused on Balvatika through Class 3. Class 4 and Class 5 are deferred to the separate Tenali project.

**Sources**
- Repository README: https://github.com/vicharanashala/fln/blob/main/README.md
- Software requirements: https://github.com/vicharanashala/fln/blob/main/SRS.md
- Project overview: https://vicharanashala.ai/projects/fln/

## 2. FLN as a system

### Users and responsibilities

- **Teachers:** Generate assessment papers, distribute worksheets, scan completed answer sheets, and review student results.
- **School and administrative users:** Manage school-related information, users, and the assessment workflow according to their permissions.
- **Students:** Complete paper-based assessments; their assessment results contribute to their profiles and progress tracking.
- **Superadmins:** Perform privileged administrative operations, including provisioning accounts through the admin API.
- **Maintainers and contributors:** Maintain the curriculum configuration, question-generation pipeline, evaluation process, and supporting application infrastructure.

These roles describe the system's intended workflow and current administrative functionality; they should not be interpreted as proof that every planned feature is complete.

### Main entities and data flow

The repository includes concepts such as curriculum levels, question templates, students, schools, users, worksheets, and evaluation reports.

The intended assessment flow is:

1. A teacher selects an assessment or worksheet workflow.
2. The platform generates questions using the configured curriculum and available question content.
3. The teacher prints and distributes the assessment.
4. Students complete the paper-based assessment.
5. The teacher scans and uploads the answer sheets.
6. The system processes the uploaded material and evaluates the responses.
7. Results can update student assessment records and support progress tracking.

The README describes the intended progression from assessment to diagnosis and certification. However, the repository is under active development, so individual workflow steps should be checked in the code before being described as fully implemented.

### Why this system matters

A reliable assessment platform needs more than question generation. It also needs dependable evaluation, accurate association of results with students, secure handling of account information, and useful feedback for teachers. The gaps documented below relate to these requirements.

**Source:** https://github.com/vicharanashala/fln/blob/main/README.md

## 3. Current state of the repository

### Technology stack

The repository is an npm-workspaces monorepo with multiple application components:

| Component | Technology and responsibility |
|---|---|
| `frontend/` | React, TypeScript, Vite, and Tailwind CSS; provides the user interface |
| `backend/` | Node.js, Express, and TypeScript; provides the main API |
| `backend/fln-backend/` | A separate JavaScript backend workspace for worksheet-specific functionality |
| `ai-services/` | Python-based evaluation and OCR functionality invoked by the backend |
| Database layer | Native MongoDB driver, with a local JSON fallback when `MONGODB_URI` is not configured |

The main backend does not use Mongoose. The README warns that the local JSON fallback is suitable for an individual local run, not concurrent production use.

### Files reviewed

The following files were checked against the repository's current default branch:

- `README.md` — project scope, workflow, curriculum framework, and development setup.
- `backend/src/config/curriculumMap.ts` — curriculum level and concept configuration.
- `backend/src/routes/admin.ts` — account provisioning and role-based ID generation.
- `backend/src/routes/evaluation.ts` — bulk PDF evaluation and page splitting.
- `frontend/src/components/IcrScanner.tsx` — frontend controls for bulk scanning.
- `backend/src/routes/questionTemplates.ts` — allowed question-template assessment modes.
- `backend/src/db.ts` — question-template data structure, including `assessmentMode`.

### Architecture observations

- The project uses curriculum configuration and question templates to support assessment generation.
- The bulk evaluation route splits PDF documents into per-student chunks based on the configured number of pages per student.
- Question templates contain an `assessmentMode` value, but this is currently attached to individual templates.
- Account provisioning generates role-specific IDs and stores password hashes; the response returned to the client needs to avoid exposing those hashes.
- The project is actively evolving. A feature's presence in the curriculum map does not, by itself, prove that the full assessment workflow for that level is complete.

**Sources**
- https://github.com/vicharanashala/fln/blob/main/README.md
- https://github.com/vicharanashala/fln/blob/main/backend/src/config/curriculumMap.ts
- https://github.com/vicharanashala/fln/blob/main/backend/src/routes/admin.ts
- https://github.com/vicharanashala/fln/blob/main/backend/src/routes/evaluation.ts
- https://github.com/vicharanashala/fln/blob/main/frontend/src/components/IcrScanner.tsx
- https://github.com/vicharanashala/fln/blob/main/backend/src/routes/questionTemplates.ts
- https://github.com/vicharanashala/fln/blob/main/backend/src/db.ts

## 4. Gaps observed in the code

The observations below are tied to existing code or explicitly documented repository issues. Issue descriptions provide useful reproduction details and acceptance criteria, but each fix must still be validated locally before a pull request is submitted.

### Gap 1 — Account provisioning may fail without a useful response and exposes a password hash

**Issue:** [#743 — `admin.ts`: make Provision Account finish and stop returning the hash](https://github.com/vicharanashala/fln/issues/743)

**Relevant file:** `backend/src/routes/admin.ts`

**Relevant code locations:**
- Lines 13–32: `generateIdForRole()`
- Lines 35 onward: `POST /api/admin/create` handler
- Around line 90: role-specific ID generation
- Around line 94: password hashing
- Around line 118: `res.json(newUser)`

**What I observed**

The `generateIdForRole()` switch has cases for admin, district admin, block admin, school, and volunteer roles. It throws an error for any unsupported role. The current switch does not include `UserRole.TEACHER`, although the account-provisioning workflow is expected to support teacher creation.

The route calls this function inside an asynchronous handler without a surrounding error-handling block for the operation. An unsupported role can therefore cause a failed request without the intended clear client response.

The route also returns `newUser` directly. That object contains `passwordHash`, created by `bcrypt.hash()`, so the hash can be included in the API response.

**Why it matters**

A teacher-account creation attempt may fail without a useful error response, making the interface appear stuck. Returning a password hash exposes sensitive authentication data to a client that does not need it.

**Scope boundary**

Issue #743 explicitly says that school-assignment checks covered by issue #442 are outside this change. Those checks should not be modified as part of an unrelated fix.

---

### Gap 2 — Bulk PDF evaluation uses a fixed page-count default and does not separately handle page-count errors

**Issue:** [#746 — `evaluation.ts`, `IcrScanner.tsx`: fix the pages-per-child default and unreadable PDFs](https://github.com/vicharanashala/fln/issues/746)

**Relevant files:**
- `backend/src/routes/evaluation.ts`
- `frontend/src/components/IcrScanner.tsx`

**Relevant code locations:**
- `evaluation.ts`, around lines 780–782: default for `pagesPerStudent`
- `evaluation.ts`, around lines 828–833: PDF loading and page-count retrieval
- `IcrScanner.tsx`, around line 267: initial frontend value for `pagesPerStudent`

**What I observed**

The backend currently defaults `pagesPerStudent` to `2` when a valid value is not supplied. Its comments describe Class 2–4 papers as two pages and Class 1 papers as typically one page.

The frontend also initializes `pagesPerStudent` to `2`. This is a default, not a guarantee that every assessment paper has the same number of pages.

The backend catches errors from `PDFDocument.load()`, but the subsequent `sourceDoc.getPageCount()` call is outside that `try/catch`. A failure during page-count retrieval is therefore not handled by the same explicit error response used for PDF-loading failures.

The code also permits a final chunk to contain fewer pages than the configured page count when the source PDF does not divide evenly.

**Why it matters**

An incorrect page-count assumption can split a combined scan incorrectly, potentially associating pages with the wrong student. A failure while reading the page count should also be converted into a controlled response instead of an unexpected server error or prolonged request.

**Scope boundary**

The issue proposes handling uneven page counts, improving unreadable-PDF handling, and revisiting the default. It notes that class-specific page counts should be confirmed from actual sample papers rather than guessed. Any proposed default change should follow that verification.

---

### Gap 3 — Assessment mode is stored on question templates, not mapped independently to every concept

**Issue:** [#850 — add written / observed / both assessment mode for each concept](https://github.com/vicharanashala/fln/issues/850)

**Relevant files:**
- `backend/src/routes/questionTemplates.ts`, around line 30
- `backend/src/db.ts`, around the question-template type definition at line 898
- Proposed new file: `backend/src/config/assessmentMode.ts`

**What I observed**

The question-template route defines the allowed assessment modes as `written`, `observed`, and `both`. The question-template data structure also stores an `assessmentMode` value.

However, a mode stored only on a question template does not provide a direct answer for a curriculum concept that has no authored template. Issue #850 identifies this missing concept-to-mode mapping and proposes a separate configuration file.

**Why it matters**

Some foundational skills are better assessed through teacher observation, some through written work, and some through both. Without a concept-level mapping, downstream assessment and certification logic may not have a consistent source of truth for the evidence expected for each concept.

**Scope boundary**

Issue #850 describes the Balvatika mapping as the intern-ready portion. Its proposed Class 1–3 values are explicitly interim until confirmation by the relevant subject-matter expert. Those values should not be presented as final pedagogical decisions.

---

### Issue-selection verification

The following public issue and pull-request checks were performed while preparing this document:

- **#759:** Associated pull requests [#768](https://github.com/vicharanashala/fln/pull/768) and [#769](https://github.com/vicharanashala/fln/pull/769) reference this issue. It is therefore excluded from my proposed new work.
- **#743:** The issue is open, and the public pull-request search did not return a matching pull request.
- **#746:** The issue is open, and the public pull-request search did not return a matching pull request.
- **#850:** The issue is labelled `intern-ready`, and the public pull-request search did not return a matching pull request.

These results describe the public GitHub activity checked; they do **not** establish that nobody has started local work or been assigned the issue privately. I will confirm availability with the mentor before selecting a coding issue.

## 5. Ideas for the project

The following ideas are directly connected to the observed gaps. They are proposals, not claims that the work has already been implemented.

### Idea 1 — Make account provisioning reliable and remove credential data from responses

**Related issue:** [#743](https://github.com/vicharanashala/fln/issues/743)

Potential work:

- Add teacher ID generation to the role-specific ID generator.
- Validate the requested role against the supported set before attempting account creation.
- Handle unexpected failures with an appropriate error response.
- Return a sanitized user object rather than the raw object containing `passwordHash`.
- Add focused tests for successful teacher creation, unsupported roles, and responses that must not expose password hashes.

**Expected benefit:** Account creation should provide predictable responses, and authentication data should not be unnecessarily exposed.

**Important:** Keep this change scoped to issue #743 and preserve the existing school-assignment validation behavior.

### Idea 2 — Improve bulk PDF page handling and error reporting

**Related issue:** [#746](https://github.com/vicharanashala/fln/issues/746)

Potential work:

- Return a controlled client error if page-count retrieval fails.
- Warn when the total page count is not divisible by the selected pages-per-student value.
- Make the page-count guidance clearer in the scanning interface.
- Verify page counts from real sample papers before changing defaults.
- Add tests for valid PDFs, unreadable PDFs, and uneven page splits.

**Expected benefit:** Teachers receive clearer feedback, and combined scans are less likely to be split incorrectly.

**Important:** Do not assume a single page count works for every class or worksheet. Verify the intended paper format before changing defaults.

### Idea 3 — Introduce a concept-level assessment-mode configuration

**Related issue:** [#850](https://github.com/vicharanashala/fln/issues/850)

Potential work:

- Add a typed configuration mapping concept IDs to `written`, `observed`, or `both`.
- Complete the Balvatika entries using the repository's referenced research material.
- Add tests that validate concept IDs, allowed modes, and required core concepts.
- Keep the proposed Class 1–3 mappings clearly marked as interim until the subject-matter expert confirms them.

**Expected benefit:** The application can use a consistent concept-level configuration instead of relying solely on whether a question template exists.

**Important:** This task includes curriculum data entry. Follow the issue's acceptance criteria and do not treat provisional Class 1–3 values as final.

### Recommended contribution approach

My initial preference is to confirm whether **#743** is available and whether the mentor considers it an appropriate first coding task. It is a concrete backend issue involving validation, error handling, and sensitive response data. If the mentor prefers a specifically intern-ready task, **#850** is another candidate.

The issue must be confirmed as available before work begins. Each coding PR should address one issue, include the relevant issue reference, and provide test results that were actually run.

## 6. My contribution during onboarding

During this onboarding review, I:

- Read the repository README to understand the project scope, assessment workflow, and current architecture.
- Reviewed the current source code for account provisioning, bulk PDF evaluation, frontend page-count configuration, and question-template assessment modes.
- Compared the source-code observations with issues #743, #746, and #850.
- Checked public pull-request activity and removed #759 from my proposed contributions because it already has associated pull requests.
- Documented potential improvements and their scope boundaries so that future work can be discussed with the mentor.

**Status:** This document records repository analysis and issue research. It does not claim that I have implemented any of these fixes, added tests, or opened a coding PR. Those activities will be recorded after they are actually completed and verified.

**Next step:** Confirm the availability and scope of a coding issue with the mentor, then implement one focused change, run the relevant tests, and submit a pull request linked to that issue.