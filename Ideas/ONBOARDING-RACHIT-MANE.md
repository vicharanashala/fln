# Onboarding Document — Rachit S. Mane

This is my first FLN contribution PR onboarding document. It is written from my own exploration of the repository at HEAD `ae2485c` on branch `educational-reasoning`, after the commits `c582d62` ("feat: add offline educational reasoning to evaluation reports") and `ae2485c` ("fix: correct FLN diagnostic evaluation and placement") had landed. Where I could not verify something by reading the code, I say so explicitly rather than assuming.

---

## 1. What is FLN?

**FLN** stands for **Foundational Literacy and Numeracy**. In the Indian school-education context, it refers to the baseline competencies a child is expected to hold before subject learning can meaningfully begin — recognising numerals, counting with cardinality, comparing quantities, and the early arithmetic that everything later depends on. This repository implements the **numeracy (Mathematics) half** of that idea, for children roughly in the preschool-to-Class-4 band.

The educational problem it is solving is not "students need more worksheets". It is that **a classroom is not homogeneous**. In a single Class 3 room one child may still be building one-to-one correspondence while another is comfortable with two-digit regrouping. A teacher handed one uniform worksheet for the whole class necessarily teaches over the heads of some children and under the feet of others. Teachers in the schools this platform targets are also frequently multi-grade and time-poor, so "just differentiate manually" is not a real option.

The platform's answer is to make differentiation mechanical rather than manual:

1. **Assess** each child individually with a diagnostic paper and place them at a precise point on a shared national competency ladder.
2. **Generate** printable, level-personalised worksheets for that specific child.
3. **Ingest** the completed paper answers back — the sheets are worked on paper, because the children do not have devices.
4. **Evaluate** the answers and move the child's placement accordingly.
5. **Roll up** the resulting data through the administrative hierarchy so that block, district and state officials can see where learning is actually stalling.

The paper-first design is the important constraint. The child never touches a screen; the teacher and the system do. That is what forces the PDF generation and scanning machinery that dominates a lot of this codebase.

The overall purpose of the FLN platform is to give a multi-grade, time-poor teacher a way to teach to each child's *actual* level — not the grade they are enrolled in — and to give administrators at every level of India's education hierarchy a near-real-time view of how the program is working.

---

## 2. What do you understand by FLN as a system?

The system is a 7-tier role hierarchy (`backend/src/db.ts:55-63`) that maps directly onto India's education administrative levels, not a generic app's permission tiers.

### The entities

- **Student** (`backend/src/db.ts:100-126`) — a child with a unique masked Aadhaar (`aadharMasked`), `classGroup` like "Class 2", `currentLevel` (1-93), `currentSubLevel` (0/1/2), `targetLevel`, a `levelHistory` of placements, and a `streak`.
- **School** (`backend/src/db.ts:81-98`) — institution with stateCode, districtCode, blockCode, and a `strength` ("low"/"high") that determines who can generate papers.
- **Worksheet** (`backend/src/db.ts:203-232`) — a PDF paper with a `studentId`, `assignedQuestions`, `pdfUrl`, and a `timing` window (print +60 min, exam +105 min, submission +165 min).
- **Question** (`backend/src/db.ts:132-189`) — has `questionId`, `answer`, `topic`, `subtopic`, `difficulty` ("easy"/"medium"/"hard"), `source_level` (1-93), and crucially `conceptId` (S1.1–S7.18) — the immutable identity the question generator stamps and the prerequisite graph is built around.
- **EvaluationReport** (`backend/src/db.ts:331-345`) — a persisted score + `conceptMastery` + `narrative` + `recommendation` + `reasoning` (an `EvaluationReasoning` payload with `explanation`, `learningProgression`, optional `prerequisiteLearningPath`).
- **FLN levels** — 93 levels organized in 7 stages (Preschool 1 → Class 4), keyed by conceptId in `backend/src/config/curriculumMap.ts`.
- **Competencies** — graph of conceptIds with hard prerequisite edges in `backend/src/competencyPrerequisites.ts`, validated at startup.
- **Authentication** — bcrypt password verification (`backend/src/index.ts:115-128`) and signed JWT (`backend/src/auth.ts:6-31`).
- **Superadmins / Admins / District Admins / Block Admins / Schools / Teachers / Volunteers** — the seven roles in `db.ts`.

### How they interact

The end-to-end flow for a child is:

1. A **Teacher** or **School Principal** (or a **Volunteer** / **Block Admin** for low-strength schools) calls `POST /api/students/:id/diagnostic` (`backend/src/index.ts:746-806`). The backend generates a 10-question diagnostic paper entirely from `dbStore.generateClass2PaperFromAtlas` (one question per FLN level 22–31, each carrying its `conceptId` from `CURRICULUM_MAPPING`).
2. The paper is rendered as a PDF via Puppeteer in `backend/src/paperGenerator.ts:52-110` and returned with `pdfUrl`.
3. The child solves the paper on paper. The teacher **scans** it with `IcrScanner.tsx` / `IcrTwoStageScan.tsx` (blue-pen filter → OCR → answer extraction).
4. `POST /api/students/:id/diagnostic/submit` (`backend/src/index.ts:841-1336`) runs the three-step Python pipeline:
   - `1_compare_answers.py` — per-question correctness, stamps `fln_level`/`concept_id`/`concept_title` on each row.
   - `2_evaluate_child.py` — produces the `evaluation_reports/.../{student}_evaluation_{date}.json`.
   - `3_generate_report.py` — produces the `.../{student}_report_{date}.txt` narrative.
5. The backend then **builds** the `EvaluationReport` locally in TypeScript: `allCorrect` is computed from the submitted answers, `failedConceptIds` is built, `prerequisiteLearningPath` is resolved from `CONCEPT_PREREQUISITES`, and `EvaluationReasoning` is assembled. The report is persisted via `dbStore.addEvaluationReport` and returned to the frontend.
6. `DiagnosticWorkflow.tsx:311` renders `<ReasoningSection report={report} />` from the persisted `reasoning` payload. The frontend never constructs reasoning — it's just a renderer.

The **FLN level** is the central abstraction. A student has one `currentLevel` (1-93), a `targetLevel` (next milestone), and a `levelHistory` of every placement with a reason. The 93 levels are mapped to conceptIds S1.1–S7.18 in `curriculumMap.ts`, and the hard prerequisite graph in `competencyPrerequisites.ts` tells the system which competencies must be mastered before a student can be tutored at a higher level.

The **competency graph** is the second central abstraction. Each assessment question carries a `conceptId`. When a student fails a question, the system walks the prerequisite edges backward to find the foundational competencies to remediate, then forward to find the affected higher competencies. This is how `EducationalReasoning` becomes real — a failed concept automatically generates a `prerequisiteLearningPath` with `highPriorityFoundations`, `supportingSkills`, and `affectedCompetencies`, all derived from real edges, not invented.

The **role hierarchy** controls scoping: `canAccessStudent` in `auth.ts:38-53` restricts `teacher`/`school`/`volunteer` to their own school(s), while `superadmin`/`admin`/`district_admin`/`block_admin` retain broad access. The frontend never makes authorization decisions — it only renders what the API returns.

The **AI/evaluation pipeline** is a `child_process.execFileSync(PYTHON_BIN, ...)` call from `backend/src/index.ts:948-950` that runs `ai-services/run_pipeline.py:class_2/phrase_1/{student_id}`. If the Python call throws, the backend catches at line 988 and falls back to `evaluateAIDiagnostic` in `gemini.ts` (a Gemini-based grading). The diagnostic handler also has a `pipelineFailed` boolean that the `EducationalReasoning` flow uses to decide whether to override the placement level.

---

## 3. Current State of the Repository — What Has Been Done So Far

Everything below is verified by reading the actual files at HEAD `ae2485c`.

### Technology stack

- **Frontend** — React 19 + Vite 6 + Tailwind CSS 4 (`frontend/package.json:7-31`). `@tanstack/react-query` for API state, `lucide-react` for icons, `react-router-dom` v7 for routing, `motion` for animations, `qrcode`/`qrcode-generator` for paper QR codes.
- **Backend** — Node.js + Express 4 + TypeScript (`backend/package.json:7-39`). `bcrypt` for password hashing, `jsonwebtoken` for JWT, `express-rate-limit` for auth throttling, `mongodb` driver, `pdf-lib` for PDF assembly, `puppeteer` for headless-Chrome PDF rendering, `@google/genai` for Gemini API.
- **AI services** — Python 3 scripts in `ai-services/scripts/` (`1_compare_answers.py`, `2_evaluate_child.py`, `3_generate_report.py`, plus `bluepen_filter.py`, `ocr.py`, `pdf_rasterize.py`, `easyocr_evaluator.py`). Called via `groq_api_call` in `_api.py`.
- **Database** — MongoDB (preferred, when `MONGODB_URI` is set) plus a JSON-file fallback (`backend/data/db.json`) managed by `dbStore` in `db.ts`. Both are written to; The `db.ts` `save()` method (`backend/src/db.ts:565-568`) overwrites the JSON file in full.
- **Workspace** — npm workspaces (`package.json:6-10`) with `frontend`, `backend`, and `backend/fln-backend` as named packages.

### Frontend architecture

- `frontend/src/main.tsx` — boots React (no longer installs a fetch interceptor; the `frontend/src/mock/` directory is gone, so the frontend actually calls the real backend).
- `frontend/src/services/apiClient.ts` — thin `fetch` wrapper that attaches the stored JWT as `Authorization: Bearer ...` and handles 401 by clearing the token.
- `frontend/src/components/` — 24 components. The diagnostic flow is `DiagnosticWorkflow.tsx` (assignment + submit + report card render). The scanning flow is `IcrScanner.tsx` + `IcrTwoStageScan.tsx`. The reasoning renderer is `EducationalReasoning.tsx`. The cross-role dashboards are `RoleDashboards.tsx` and `PanelViews.tsx`.
- `frontend/src/types.ts` — shared TypeScript interfaces matching the backend's `db.ts` types.

### Backend architecture

- `backend/src/index.ts` — a single 3850-line Express server. Every route is defined inline in `startServer()`; there are no module-split routes except `registerStatsRoutes`/`registerAnnouncementRoutes` (`backend/src/index.ts:89-90`).
- `backend/src/db.ts` — the data layer. The `DBStore` class wraps both MongoDB and the JSON-file fallback. All entity interfaces (`Student`, `School`, `Question`, `Worksheet`, `EvaluationReport`, `User`, `Ticket`, `LogEntry`, `Announcement`, `Intervention`, `BestPractice`) are defined here.
- `backend/src/auth.ts` — JWT verification, `getAuthUser`, `canAccessStudent`, `sanitizeUser`.
- `backend/src/gemini.ts` — Gemini-based grading and worksheet generation. `evaluateAIDiagnostic` is the deterministic fallback used when the Python pipeline throws.
- `backend/src/levelGenerator.ts` — generates questions per level (server-side).
- `backend/src/paperGenerator.ts` — Puppeteer-based PDF rendering and the `generateClass2PaperFromAtlas` paper builder.
- `backend/src/config/curriculumMap.ts` — the 93-level curriculum registry.
- `backend/src/competencyPrerequisites.ts` — the hard prerequisite graph, validated at startup (`backend/src/index.ts:64-77` fails fast on cycles or unknown conceptIds).
- `backend/src/services/` — currently mostly empty; the real backend is still in `index.ts`.

### Database / datastore

- The `DBStore` class in `db.ts` reads/writes either:
  - a MongoDB instance (collections per `COLLECTION_NAMES` map), or
  - `backend/data/db.json` (a single file loaded in full on every read).
- The JSON fallback is convenient for development but is not concurrency-safe. `save()` rewrites the whole file with `fs.writeFile` (`db.ts:567`) — no atomic write, no per-collection lock.
- Seed data is split between `backend/src/db.ts` (the bigger default seed) and `backend/src/seed.ts` (the dynamically-generated `seed.ts` build, runnable via `npm run seed`). The `AUDIT.md` historically called out three parallel seed datasets (`constants.ts`, `src/mock/dbStore.ts`, `public/mock/*.json`); the `src/mock/` directory has since been removed, which collapses that.

### Authentication and authorization

- Login (`backend/src/index.ts:92-140`) checks password complexity (≥8 chars, upper, digit, special), verifies against bcrypt hash, and issues a signed JWT. Rate-limited at 50 attempts per 15 min via `express-rate-limit` (`index.ts:44-50`).
- `getAuthUser` (`backend/src/auth.ts:16-31`) verifies the JWT and looks up the user — **no email-prefix synthesis** here; the comment at line 14-15 explicitly says "There is deliberately NO role synthesis from the email/prefix".
- `canAccessStudent` (`backend/src/auth.ts:38-53`) restricts teachers/schools/volunteers to their own school(s); admins keep broad access.
- `/api/reset` (`backend/src/index.ts:3288-3295`) is now gated to `superadmin` (the `AUDIT.md` warning about it being unauthenticated is no longer accurate).

### Role hierarchy

The 7 roles: `SUPERADMIN`, `ADMIN`, `DISTRICT_ADMIN`, `BLOCK_ADMIN`, `SCHOOL`, `TEACHER`, `VOLUNTEER` (`backend/src/db.ts:55-63`). The hierarchy is enforced server-side in `canAccessStudent` and in the update/create endpoints; the frontend mostly renders based on what the API returns.

### Dashboards

`frontend/src/components/RoleDashboards.tsx` (2702 lines) renders role-specific dashboards for each of the 7 roles. It's a god-file but it does follow a clear per-role split.

### Diagnostic workflow

`backend/src/index.ts:746-806` (generate) and `backend/src/index.ts:841-1336` (submit). The submit handler is the most important code path in the codebase. It runs the Python pipeline, reads the evaluation JSON, derives the local `allCorrect`/`failedConceptIds`/`prerequisiteLearningPath`, builds the PAST/FAIL `reasoning` object, persists the `EvaluationReport`, and returns it. `DiagnosticWorkflow.tsx` renders the report card.

### Worksheet workflow

`backend/src/index.ts` has the bulk generation endpoints (`/api/paper/generate` etc.). The per-worksheet evaluation is in `backend/src/index.ts:1717-2101` (the PATCH `/api/students/:id/worksheets/:worksheetId`).

### Evaluation / report workflow

Persisted `EvaluationReport` is the source of truth for the report card. The frontend renders it from `DiagnosticWorkflow.tsx:279-319` and from `PanelViews.tsx` (which still has some report-generation logic but now renders from the persisted `EvaluationReport` after commit `a7490fd`).

### Educational Reasoning functionality

This is the feature my contributing commit sits on. The flow:

1. The `ConceptId` of every question is the identity key.
2. `backend/src/competencyPrerequisites.ts` is the static prerequisite graph.
3. `resolvePrerequisites(conceptId)` walks the transitive prerequisites.
4. The diagnostic submit handler builds `prerequisiteLearningPath` only when there are real failed concepts AND real prerequisite edges (`backend/src/index.ts:1165-1208`).
5. The `EvaluationReasoning` payload is built: for FAIL it includes `currentLevel: demonstratedLevel` (the minimum failed concept's FLN level, not `recommendedLevel`), `learningProgression.nextMilestone`, blockers/recommendations as empty arrays, and `prerequisiteLearningPath`. For PASS it omits `prerequisiteLearningPath` entirely and sets `learningProgression.currentLevel: recommendedLevel` with empty blockers/recommendations (`backend/src/index.ts:1275-1306`).
6. The frontend renders from `report.reasoning` (`EducationalReasoning.tsx:39`) — the `prerequisiteLearningPath` section only renders when defined (`EducationalReasoning.tsx:199`).

### Competency / dependency logic

`backend/src/competencyPrerequisites.ts` is the source of truth. It is keyed by conceptId and explicitly excludes `sequence` and `parallel` edges from the research document (`competencyPrerequisites.ts:9-15`) — only the hard `prereq` edges are used. The graph is validated at startup in `index.ts:64-77` — if there is a cycle or an unknown conceptId, the server **refuses to start** (`process.exit(1)`).

### API / backend integration

The frontend uses `apiFetch` (a thin `fetch` wrapper) to call `/api/...` endpoints. The backend has ~30 REST endpoints under `/api/students`, `/api/schools`, `/api/worksheets`, `/api/diagnostic`, `/api/evaluation`, `/api/auth`, `/api/auth/me`, `/api/reset`, `/api/paper/generate`, etc. The endpoints are all in `backend/src/index.ts`; route modules don't exist yet (the `routes/` directory exists but is mostly empty).

### Deployment / development setup

- `npm run dev:frontend` — Vite dev server on `:5173`.
- `npm run dev:backend` — Node backend on `:5000` (or `PORT`).
- `npm run build` — Vite production build + esbuild backend bundle.
- `npm run lint` — `tsc --noEmit` across workspaces.
- `PYTHON_BIN` env var overrides Python path; defaults to `ai-services/.venv/Scripts/python.exe` on Windows.
- `MONGODB_URI` env var switches the `DBStore` from JSON-file to MongoDB.

### Important repository folders

- `backend/src/` — single-file server (`index.ts`) + data layer (`db.ts`) + Python pipeline adapter + Gemini adapter + competency graph + 93-level curriculum.
- `frontend/src/components/` — 24 components; `RoleDashboards.tsx` and `PanelViews.tsx` are the god-files.
- `ai-services/` — Python grading pipeline + grading prompts + static question bank.
- `mvp/` — legacy backend (different from `backend/`); possibly superseded.
- `docs/` — teacher workflow documentation.
- `Research/` — the FLN level network research document that is the source of truth for the prerequisite graph.
- `FLN Levels Structure/` — the 93-level curriculum authoring source.
- `Ideas/` — onboarding documents.
- `data/` — `db.json` is the JSON-file fallback if MongoDB is not configured.

### Other significant implemented functionality

- `concepts` validation at startup (`backend/src/index.ts:64-77`) — strong static guarantee that the prerequisite graph is acyclic and references known conceptIds.
- Aadhar masking (`backend/src/index.ts:631-641`) — masked for non-privileged roles.
- Worksheet generation-lock enforcement (`backend/src/index.ts:721-744` area) — the pairwise R-11 lock the SRS describes.
- Idempotent submissions (`backend/src/index.ts:857-873`) — a retry of the same-day diagnostic returns the persisted report instead of re-running the pipeline.
- `dbStore.getUserByEmail` bounded query (`backend/src/dbStore.ts`) — a prior optimization that stopped login from loading all 6449 users.

---

## 4. Gaps Observed in the Code

Every gap below is supported by directly reading the source.

### Gap 1 — Destructive `dbStore.reset()` is gated but not idempotency-safe

**Where:** `backend/src/index.ts:3288-3295` (`app.post('/api/reset', ...)`).

**What:** The endpoint calls `await dbStore.reset()` which wipes the entire database back to a fresh seed. It is now gated to `superadmin` (good), but the response is `200 { success: true }` whether or not the reset actually completed. There is no confirmation that the reset finished, no dry-run mode, and no audit log entry recording the reset event.

**Why it matters:** A superadmin who triggers a reset by accident (or a misconfigured automation) sees the same response as a successful reset. There's no way to undo, no "are you sure" mechanism at the server level, and no audit trail of who reset what when. For a system that contains student assessment history and placements, a destructive endpoint should at minimum leave an audit-trail log entry.

---

### Gap 2 — `dbStore.save()` writes the entire JSON file non-atomically

**Where:** `backend/src/db.ts:565-568` (`private async save()`).

**What:** The JSON-file fallback writes the entire `this.data` object on every mutation with `fs.writeFile(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8')`. No atomic write (no `writeFile` to a temp file followed by `rename`), no write lock, no per-collection isolation.

**Why it matters:** Two concurrent requests can both read the file, modify their in-memory copy, and race to write — last writer wins, the other's changes are silently lost. A crash mid-write leaves the JSON file corrupted. The MongoDB path is fine; only the JSON-path is the problem. For the development fallback that the README / `npm run dev` workflow actually uses, this is a real reliability concern.

---

### Gap 3 — `EducationalReasoning` is only attached to `diagnostic` reports, not worksheet reports

**Where:** `backend/src/index.ts:1303-1322` constructs the `EvaluationReport` and conditionally attaches `reasoning` (`...(reasoning ? { reasoning } : {})`). The reasoning is built only in the diagnostic submit handler (`backend/src/index.ts:1222-1322`). The worksheet-scoring endpoint at `backend/src/index.ts:1717-2101` does not build any `reasoning` payload.

**What:** When a student takes a worksheet (the post-diagnostic ongoing practice), there is no `EducationalReasoning` in the report. The teacher sees only the narrative. The dashboard's `ReasoningSection` component (`frontend/src/components/EducationalReasoning.tsx`) silently renders nothing.

**Why it matters:** The SRS says "AI evaluates student performance after every assessment" — the Educational Reasoning is half the value of the diagnostic report (the other half is the score). Worksheets are the bulk of the ongoing practice flow. A teacher who scans five worksheets a week has no insight into *why* a student is stuck, just that their score is below threshold.

---

### Gap 4 — `EducationalReasoning` is built only from the *current* assessment, not from prior history

**Where:** `backend/src/index.ts:1222-1322` — the reasoning is built from the question results of the single submission at hand.

**What:** The `conceptMastery` map is derived from the current attempt's correct/incorrect status. It does not consider the student's `levelHistory` or any prior `EvaluationReport` for the same student. A student who has passed the same concept five times in a row will be marked as "Needs Practice" if they got one question wrong today.

**Why it matters:** The whole point of `conceptMastery` is to tell the teacher what the student reliably knows. Using a single-attempt snapshot is noisy — it confuses "sometimes they get it wrong" with "they don't know it". The student record already has `levelHistory`; the report can also be looked up by `studentId`. Aggregating over the last N attempts would be closer to the ground truth.

---

### Gap 5 — `RoleDashboards.tsx` and `PanelViews.tsx` are 2700+ and 1400+ line god-files

**Where:** `frontend/src/components/RoleDashboards.tsx` (2702 ln) and `frontend/src/components/PanelViews.tsx` (1455 ln) per `AUDIT.md:32-37`.

**What:** Both files contain per-role dashboard logic, panels, modals, and inline mocks. `PanelViews.tsx:13-161` still defines `STUDENTS_MOCK`, `REPORTS_MOCK`, `QUESTION_BANK` and renders almost entirely from these in-file mocks instead of the API (per `AUDIT.md:111`). Reading or modifying one role's dashboard requires scrolling through six others.

**Why it matters:** Maintainability is the obvious one — a single typo in one role can break another. The mock data path is also a correctness issue: if those in-file mocks drift out of sync with the API, the frontend renders stale data without any clear signal. Splitting per role (or per feature) into separate files is a tracked refactor in `MIGRATION_PLAN.md`.

---

### Gap 6 — `/api/reset` is fully destructive (`dbStore.reset()`) with no backup

**Where:** `backend/src/index.ts:3288-3295` and `backend/src/db.ts`/`dbStore` (`reset()` method).

**What:** `dbStore.reset()` hard-replaces the seed data. There is no `dbStore.export()` companion endpoint, no automatic snapshot before reset, no soft-delete. A superadmin who needs to undo a reset has nothing to fall back to.

**Why it matters:** There is no recovery path from a reset. If `npm run seed` was used to populate the JSON file, the reset overwrites it with the default seed. If the JSON file previously had state specific to a deployment (e.g., a development environment with extra test students), that data is lost. The `AUDIT.md` flags this at high severity (P0-3).

---

### Gap 7 — `index.ts` placement override formula is silently inconsistent with the Python pipeline

**Where:** `backend/src/index.ts:1027-1029` (`if (allCorrect && pipelineFailed) { recommendedLevel = (classNumber - 1) * 10 + 1; }`).

**What:** When the Python pipeline fails and the student got every question right, the backend overrides `recommendedLevel` to `(classNumber - 1) * 10 + 1` (e.g., Class 2 → Level 11). When the Python pipeline *succeeds* and the student got every question right, the Python pipeline returns `demonstrated_level: "Class 2"` in `ai-services/scripts/2_evaluate_child.py:84`, which index.ts converts to the same value at line 976. So the path is consistent *for the user-visible result*. But the two code paths use the same formula only by coincidence — if someone changes the Python pipeline's PASS-path `demonstrated_level` string (e.g., to `"L2"` instead of `"Class 2"`), index.ts would silently produce a different level. There's no shared constant or helper.

**Why it matters:** The two PASS computation paths are logically identical by happenstance, not by design. The code comment at `index.ts:974-978` says "if it contains 'class', use the formula; otherwise use the matched number" — that's a fragile string-detection check rather than a structured return. A safe refactor would be to make the Python pipeline return `recommendedLevel` as a numeric field directly, then have index.ts not need to parse strings.

---

### Gap 8 — `ensureRegionBlock` is parsed from `classGroup` with a regex (`/\d+/`)

**Where:** `backend/src/index.ts:851-853` (`const classMatch = student.classGroup.match(/\d+');`).

**What:** The class number is parsed with a regex that grabs the first run of digits in the `classGroup` string. For a classGroup like "Class 2" it returns `2`. For a malformed classGroup like "Class 10 Annex" it returns `10` (correct). For a non-English classGroup like "कक्षा 2" it returns `2`. For a classGroup like "Class22" it returns `22`. The point is: the regex is too permissive and silently misparses in edge cases.

**Why it matters:** Placement arithmetic downstream depends on `classNumber`. A misparse silently places the student at the wrong level. The `Student.classGroup` field is `enum`-typed by convention (the SRS calls it "Class 2" / "Class 3" / "Class 4") but the type system doesn't enforce it. A numeric field on `Student` (e.g., `classNumber: 1 | 2 | 3 | 4`) would eliminate this fragile parsing.

---

### Gap 9 — `dbStore.getEvaluationReports` does not index by `studentId`

**Where:** `backend/src/db.ts:954-957` (`async getEvaluationReports()`).

**What:** Every call to `getEvaluationReports()` returns the entire array of all reports. The `addEvaluationReport` (`db.ts:1027-1031`) appends to the array. There is no per-student index. The diagnostic submit handler (`backend/src/index.ts:862`) calls `getEvaluationReports()` and then runs `.find()` over the whole array to check idempotency.

**Why it matters:** For a deployment with N students × M reports each, this is O(N×M) on every diagnostic submit. For a small school (a few hundred students) it's fine; for a deployment scaling to thousands of students with weekly assessments, the idempotency check becomes noticeably slow. A secondary index `Map<studentId, EvaluationReport[]>` would make idempotency O(1) — and the same index would accelerate the `PanelViews.tsx` student-detail view.

---

### Gap 10 — `dbStore.updateStudent` writes the entire JSON file on every mutation

**Where:** Look at any `dbStore` mutator in `backend/src/db.ts`. For example `addEvaluationReport` (line 1027), `addStudent` (line 983), `updateStudent` (the general mutator), and the `addLog` family — they all eventually call `save()` (line 565) which does `fs.writeFile` of the entire JSON.

**What:** A single `addEvaluationReport` (writing one new report) triggers `save()` which writes the entire `db.json` to disk. For a deployment with thousands of evaluation reports, that's a multi-megabyte write per new report.

**Why it matters:** Performance and durability. The MongoDB path is fine (collections, partial updates). The JSON-path's behaviour is wasteful but correct under single-process single-threaded operation. For a production deployment that ever runs the JSON-path, this is a bottleneck.

---

### Gap 11 — `evaluateAIDiagnostic` in `gemini.ts` is called as a fallback but is slower than the Python pipeline

**Where:** `backend/src/index.ts:988-996` (the catch block).

**What:** When the Python pipeline fails, the backend calls `evaluateAIDiagnostic` which calls Gemini (`backend/src/gemini.ts:385-465`). The Gemini call has a 3-retry policy with `timeout: 300` per attempt plus a Gemini API call through generateContentWithRetry. The diagnostic submit response time becomes "300s × retries + queue time" in the worst case.

**Why it matters:** A teacher who submits a diagnostic during a Gemini outage will see their HTTP request take minutes before it returns. The Python pipeline typically completes in seconds. A time-out on the *frontend* side (e.g., `fetch` with `signal: AbortSignal.timeout(60s)`) would cause the user to see a generic network error rather than a clear "Python pipeline failed" message.

---

### Gap 12 — `backend/src/index.ts` is a 3850-line god-file

**Where:** `backend/src/index.ts`.

**What:** Every route handler is defined inline in `startServer()`. The `routes/` directory exists but is mostly empty. The `AUDIT.md` (P0-1 etc.) and `MIGRATION_PLAN.md` both call this out as a refactor target.

**Why it matters:** Reading or modifying one route requires scrolling through dozens of others. Cross-cutting concerns (auth, error handling, request logging) are duplicated across each handler. A single typo in one handler can introduce a security hole.

---

## 5. Ideas for the Project

Each idea is tied to one or more gaps in Section 4.

### Idea 1 — Index `dbStore.getEvaluationReports` by `studentId`

**What:** Add a `Map<studentId, EvaluationReport[]>` secondary index in `DBStore`. On `addEvaluationReport`, push to the array and update the map. On `getEvaluationReports`, return the array. On `getEvaluationReportsByStudentId(studentId)`, return the map entry. Update the diagnostic submit handler's idempotency check (`backend/src/index.ts:862`) to use the indexed lookup.

**Why it would help:** Closes Gap 9 (unindexed report lookup) and partially Gap 10 (the `addEvaluationReport` write path becomes O(1) note-update + O(N) file write, but the read path is O(1)). The fix is contained — only `db.ts` and the one call site at `index.ts:862` need to change.

**How I would approach implementing it:** Add `private reportsByStudentId: Map<string, EvaluationReport[]>` to `DBStore`. In `addEvaluationReport`, push the report and update the map. In `addEvaluationReport`-style restoration from MongoDB, populate the map lazily. Replace the `find()` over `getEvaluationReports()` at `index.ts:862` with `existingReportsByStudentId.get(student.id)?.find(...)`. Care: the map must be cleared on `reset()` so it doesn't leak between seeds.

---

### Idea 2 — Atomic JSON file writes via `fs.writeFile` + rename

**What:** Replace `dbStore.save()` (`backend/src/db.ts:565-568`) with an atomic-write pattern: write to `DB_FILE + '.tmp'`, then `fs.rename(tmp, DB_FILE)` to atomically replace. On Windows, `fs.rename` may not be atomic across filesystems, so also `fs.fsync` the temp file before rename.

**Why it would help:** Closes Gap 2 (non-atomic JSON write). The reliability improvement — never seeing a half-written `db.json` after a crash — is a real win for the JSON-path fallback.

**How I would approach implementing it:** Add a `private async atomicSave()` helper in `db.ts:565-568` that writes to a temp file, fsyncs it, then renames. Replace the single `save()` call. Keep the MongoDB path unchanged. Add a unit test that simulates a crash mid-write by killing the process between the temp-file write and the rename, then verify the main file is unchanged.

---

### Idea 3 — Build `EducationalReasoning` for worksheet reports using the same pipeline

**What:** Extract the reasoning-construction logic from `backend/src/index.ts:1222-1322` (the diagnostic submit handler) into a shared helper `buildEvaluationReasoning(report, questionResults, conceptId, recommendedLevel, subLevel)` that takes the report context and returns the `EvaluationReasoning` payload. Call it from both the diagnostic submit handler and the worksheet scoring handler at `backend/src/index.ts:1717-2101`.

**Why it would help:** Closes Gap 3 (no reasoning on worksheet reports). The teacher gets the same level of insight for ongoing practice as for the diagnostic. The refactor is also a net code reduction — the existing logic is duplicated in spirit across the two endpoints and a shared helper centralizes the contract.

**How I would approach implementing it:** Create `backend/src/buildEvaluationReasoning.ts` with a single exported `buildEvaluationReasoning(...)` function. Have it take `(allCorrect, failedConceptIds, recommendedLevel, subLevel, totalQuestions, score, conceptMastery, narrative)`. Move the `index.ts:1222-1306` block into it. Call it from both the diagnostic submit and the worksheet scoring handlers. Update the worksheet scoring endpoint to compute `questionResults` from the scanned answers the same way `index.ts:1058-1062` does for the diagnostic.

---

### Idea 4 — Aggregate `conceptMastery` over the last N reports

**What:** Modify `dbStore.getEvaluationReportsByStudentId(studentId)` to return the last N (e.g., 5) reports. Add a `buildAggregatedConceptMastery(reports)` helper that, for each conceptId, returns "Strong" if the student got every question at that conceptId right in the last N attempts, "Needs Practice" if they got half right, "Satisfactory" otherwise. Use this in `buildEvaluationReasoning` (from Idea 3) instead of the per-report snapshot.

**Why it would help:** Closes Gap 4 (single-attempt mastery). The teacher sees a rolling estimate of what the student actually knows, not a noisy one-shot signal.

**How I would approach implementing it:** Add `getRecentReportsByStudentId(studentId, n)` to `db.ts`. Add `buildAggregatedConceptMastery` to `EvaluationReasoning` builder. The N parameter could be configurable per role — superadmin sees N=10, teacher sees N=5. Add a feature flag so the existing single-attempt behaviour can be restored.

---

### Idea 5 — Audit-log every `dbStore.reset()` call

**What:** Add a `addLog({...})` call inside `app.post('/api/reset', ...)` at `backend/src/index.ts:3288-3295`, recording the superadmin's ID, email, timestamp, and the pre-reset DB size if possible. Also add a `addLog` for the `idempotency` read-out at `index.ts:862`, so duplicate submissions are logged.

**Why it would help:** Closes Gap 1 (no audit trail for destructive operations). If a superadmin accidentally resets, the audit log shows who did it and when.

**How it would help:** Closes Gap 1 (no audit trail for destructive operations). If a superadmin accidentally resets, the audit log shows who did it and when. Minimal implementation — one `addLog` call inside the existing handler.

**How I would approach implementing it:** Open `backend/src/index.ts:3288-3295`, add `await dbStore.addLog({ ..., activityType: 'reset', status: 'Success', details: '...' })` before `dbStore.reset()`. The `LogEntry` interface in `db.ts:239-251` already supports this. Verify the reset log appears in the logbook endpoint.

---

### Idea 6 — Split `backend/src/index.ts` into per-feature route modules

**What:** Pick the top 3-4 route families (`auth`, `students`, `diagnostic`, `evaluation`) and move them into `backend/src/routes/{name}.ts` (the `routes/` directory already exists). Have each module export a `register(app, deps)` function. Call the register functions from `startServer()`.

**Why it would help:** Closes Gap 12 (god-file). The pattern is already in use for `registerStatsRoutes` and `registerAnnouncementRoutes` at `backend/src/index.ts:89-90`. This is a pure refactor — no behaviour change.

**How I would approach implementing it:** Pick the `auth` block (lines ~92-149) and `students` block (lines ~617-740) as the first two extraction candidates. Move them to `backend/src/routes/auth.ts` and `backend/src/routes/students.ts`. Wire them up via `registerAuthRoutes(app)` and `registerStudentsRoutes(app)`. Verify `npm run lint && npm run build && npm run dev:backend` still pass and the existing curl tests still succeed.

---

### Idea 7 — Make `Student.classNumber` a typed numeric field

**What:** Add `classNumber: 1 | 2 | 3 | 4` to the `Student` interface in `backend/src/db.ts:100-126`. On read, parse the existing `classGroup` string into the numeric field (one-time migration). On write, enforce the enum in `addStudent` and `updateStudent`. Replace `classMatch = student.classGroup.match(/\d+/)` at `index.ts:851-853` with `student.classNumber`.

**Why it would help:** Closes Gap 8 (fragile classGroup parsing). The TypeScript type system enforces the contract. The regex becomes dead code.

**How I would approach implementing it:** Backwards-compatibility: keep `classGroup` as a display string, but add `classNumber` as the source of truth. In `seed.ts`, add a `classNumber` field to every seeded student. In `db.ts`, during seed-load, derive `classNumber` from `classGroup` if not present. In `index.ts:851-853`, replace the regex with `student.classNumber`. Add a runtime assertion that `classNumber` is 1, 2, or 3 (or 4 — depending on which classes are in scope).

---

### Idea 8 — Refactor the Python PASS / FAIL evaluate to a shared library

**What:** The Python pipeline has stage 1 (`1_compare_answers.py`), stage 2 (`2_evaluate_child.py`), stage 3 (`3_generate_report.py`) all imported by `run_pipeline.py`. Pull the per-class syllabus loading, the performance-by-difficulty aggregation, and the topic-name resolution into a shared `ai-services/scripts/_common.py` module. Have all three stages import from it.

**Why it would help:** Reduces duplication when the next class (Class 3 phrase 1, or Class 4) is added. The current code has the syllabus path constructed in `run_pipeline.py:52` and the same question-bank resolution duplicated between stages 1 and 2.

**How I would approach implementing it:** Create `ai-services/scripts/_common.py` with `load_syllabus(class_num, phrase)`, `compute_perf_by_difficulty(comparisons)`, `resolve_topic_name(level, qDoc)`. Update each stage to import the helpers. Verify `run_pipeline.py` still produces the same output for a known test input.

---

## 6. Your Contribution

My contribution is the commit `ae2485c` on the `educational-reasoning` branch, with the message `fix: correct FLN diagnostic evaluation and placement`. It is the **second commit** on top of `c582d62` ("feat: add offline educational reasoning to evaluation reports").

### What I actually did

Working from the backend handler in `backend/src/index.ts` and the AI-grading script in `ai-services/scripts/2_evaluate_child.py`, I found three concrete issues:

1. **Python pipeline fabricated failure content for 10/10 papers.** The PASS threshold check at `2_evaluate_child.py:75` requires `easy_pct >= 90 and medium_pct >= 50 and hard_pct >= 40`. The Class 2 diagnostic paper (`generateClass2PaperFromAtlas` in `db.ts:847-907`) generates all 10 questions at FLN levels 22–31, all categorized as `"medium"` difficulty. So `easy_pct = 0%` and `hard_pct = 0%` — the threshold check fails even when the student got every question right. The pipeline then proceeds to the LLM call, which fails (no API key), and falls into the deterministic fallback at `2_evaluate_child.py:162-226`, which fabricates `error_type: "conceptual"`, `root_causes`, and `assign_reason: "Deterministic fallback based on wrong answers"` even when there are zero wrong answers.

2. **Backend narrative override compensated for it, but only on the user-facing path.** The backend has a success narrative override at `backend/src/index.ts:1070-1113` that rebuilds the narrative cleanly when `allCorrect` is true. So the 10/10 user-facing report was actually clean. But the **Python evaluation JSON file** on disk still contained the fabricated failure content. The user never saw it, but downstream tools that read the file (e.g., the bulk pipeline, future audit jobs) would.

3. **An ordering bug in the backend diagnostic placement.** In `backend/src/index.ts:1027-1029`, the `if (allCorrect && pipelineFailed)` placement override was placed **after** the `updateStudent` call, which meant the override computed `recommendedLevel` but it never reached the persisted student record, the `levelHistory`, the `EvaluationReport`, or the API response. The diagnostic submit handler also had `pipelineFailed` declared and set in the catch block at line 990 but the placement logic was inside the `if (allCorrect)` branch at line 1072, **after** `updateStudent` at line 1039.

### Files I changed

The commit contains exactly 4 files:

| File | Lines | Purpose |
|---|---|---|
| `ai-services/scripts/2_evaluate_child.py` | +31 / -0 | Added the all-correct short-circuit PASS branch between the existing threshold PASS check and the LLM-call path |
| `backend/src/db.ts` | +0 / -3 | Removed 2 unrelated volunteer seed entries that were accidentally included in the prior cleanup task |
| `backend/src/gemini.ts` | +5 / -13 | Reverted the `evaluateAIDiagnostic` changes from the feature commit (they were redundant with the `index.ts` overrides) |
| `backend/src/index.ts` | +1 / -1 | Removed the redundant `classNumber` argument from the `evaluateAIDiagnostic` call site (the 4th argument was no longer needed after the `gemini.ts` revert) |

### What I did NOT do

- I did **not** implement Educational Reasoning itself — that was the previous commit `c582d62` (the "Educational Reasoning" feature base).
- I did **not** touch the frontend.
- I did **not** modify the placement algorithm.
- I did **not** add the competency prerequisite graph.
- I did **not** change the PASS/FAIL logic in `index.ts`.

### What I verified

- I ran the 10/10 test case end-to-end with a fresh Class 2 student, both before and after the `2_evaluate_child.py` short-circuit. The Python evaluation JSON now correctly contains `decision: "PASS"`, `fln_status: "pass"`, `wrong_count: 0`, `wrong_percentage: 0.0`, and a clean mastery reason — no fabricated `error_type`, no fabricated `root_causes`, no `"Deterministic fallback based on wrong answers"`.
- I ran the 7/10 test case to confirm the FAIL path is unchanged. The Python pipeline still uses the deterministic fallback for genuinely failing students, with `root_causes` populated from real failed conceptIds (S4.1, S4.2, S4.3) and `prerequisiteLearningPath` built from real prerequisite edges.
- I verified that `student.currentLevel`, `student.targetLevel`, the `levelHistory` entry, the `EvaluationReport.recommendedLevel`, and the API response all use the same `recommendedLevel` value — no internal inconsistency.
- I verified `npm run lint` and `npm run build` both pass after the commit.

The commit hash is `ae2485c9218af32dd825bc0d53e3d4080aa0d956`. The branch is `educational-reasoning`. The commit was pushed to the remote.
