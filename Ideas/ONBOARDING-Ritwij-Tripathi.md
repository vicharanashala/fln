# FLN Onboarding Document — Ritwij Tripathi

> Prepared after hands-on exploration of the repository and shipping a first contribution (a teacher-mediated **Learning Path** remediation loop). File paths and line ranges below refer to the state of the repo at the time of writing.

---

## 1. What is FLN?

FLN stands for **Foundational Literacy and Numeracy**. In this project specifically, it is an **AI-assisted foundational-numeracy platform for young government-school children in India** (roughly Classes 2–4), built around the national **NEP-2020 / NIPUN Bharat** goal that every child attains basic numeracy by the end of the early grades.

The educational problem it addresses is concrete and well-documented in Indian primary education: large numbers of children are promoted grade-to-grade without actually mastering the foundational skills (number sense, place value, the four operations, basic shapes, measurement, fractions, money, time, data) that everything later depends on. A Class 4 child may be sitting in a Class 4 classroom while functionally operating at a Class 1 level. Teachers in crowded, multi-grade, under-resourced classrooms have neither the time nor the fine-grained tooling to diagnose *exactly* where each child is stuck and to act on it.

The product's purpose is to close that gap by making assessment and remediation **operational** rather than aspirational. It encodes the numeracy curriculum as a **93-level framework** (concept tags `S1.1` … `S7.18` across seven strands), generates diagnostic worksheets, uses AI to evaluate a child's answers, places the child at their true level, and surfaces the specific skills they are missing — so a teacher or volunteer can teach to the actual gap instead of to the grade label on the door.

It serves **children** (the ultimate beneficiaries), the **teachers and volunteers** who run assessments and teach, and the **administrative hierarchy** (school principals, block/district/state officials, and a super-admin) who need visibility into how foundational learning is progressing across the system.

---

## 2. What do you understand by FLN as a system?

Reading the code, FLN is a **role-based, hierarchically-scoped assessment platform**. The entities and how they interact:

**Users and roles.** The role model is defined in `frontend/src/types.ts` (lines 1–9) and mirrored on the backend:

```
SUPERADMIN, ADMIN (state), DISTRICT_ADMIN, BLOCK_ADMIN, SCHOOL (principal), TEACHER, VOLUNTEER
```

Notably there is **no `student` login role** — a child never authenticates. Students are *records* that teachers and volunteers act upon. This is a deliberate and correct design for the context (young children, shared devices, paper-based exams), and it shapes the whole product: everything is **teacher/volunteer/admin-mediated**.

**Geographic and organisational scoping.** Users carry `stateCode / districtCode / blockCode / schoolId / assignedSchools` (types.ts, `User` interface, lines 11–23). This forms a tree — nation → state → district → block → school → class → student — and every screen and API is scoped to the slice of that tree a user is allowed to see. On the backend this is enforced by `getAuthUser(req)` + `canAccessStudent(user, student)` (used throughout `backend/src/routes/*` and `backend/src/index.ts`).

**Core domain entities** (all modelled in `frontend/src/types.ts` and the backend `db.ts`):

- **School / ClassGroup / Student** — the roster hierarchy. A `Student` (types.ts lines 78–113) has a `currentLevel`, `targetLevel`, `levelHistory`, and a rich demographic profile.
- **Worksheet / Question** — a worksheet is a generated set of `Question`s for a class and an assessment cycle (Baseline / Mid-year / End-of-year), with print/exam timing windows and locks (types.ts lines 115–158).
- **AnswerSubmission** — a student's captured answers for a worksheet.
- **EvaluationReport** — the heart of the system (types.ts lines 254–285). After a diagnostic is evaluated it holds the score, per-topic `conceptMastery`, a recommended level, and — crucially — `passedLevels`, `failedLevels`, and a `skillGaps` list, plus a detailed `reasoning` object including a computed `prerequisiteLearningPath`.
- **Intervention / BestPractice** — a teacher records a remediation strategy for a weak student (types.ts lines 318–367); successful ones are promoted into a shared best-practices repository.
- **Ticket / Announcement / LogEntry** — support, broadcast messaging, and an audit log (`LogEntry.activityType` ∈ `download | print | conduct | scan | verify | ticket`, types.ts line 304).

**How a cycle flows.** A teacher registers/imports students (CSV bulk import via `DiagnosticTestPanel` → `POST /api/students/bulk-import`) → generates diagnostic papers → conducts the paper-based exam → the answers are evaluated (AI-assisted, `backend/src/gemini.ts`) → an `EvaluationReport` is produced with the child's `failedLevels` / `skillGaps` → the child is placed at their true level → admins roll all of this up into dashboards. The **assessment → evaluation → placement → reporting** loop is the spine of the system.

**AI's role.** A separate `ai-services` (Python) tier plus `backend/src/gemini.ts` (`generateAIDiagnostic`, `evaluateAIDiagnostic`, `generateAIPersonalizedWorksheet`, `evaluateAIWorksheet`) handle diagnostic generation and evaluation, while `backend/src/levelGenerator.ts` deterministically generates practice questions per level/sub-level.

---

## 3. Current State of the Repository — What Has Been Done So Far

**Repository shape.** A single **MERN monorepo** using **npm workspaces** with three tiers: `frontend`, `backend`, and `ai-services`.

**Technology stack.**

| Tier | Stack |
| --- | --- |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, `lucide-react` icons, `react-jsx` runtime |
| Backend | Node.js, Express 4, TypeScript (ESM, `"type":"module"`), run directly with `tsx`; bundled for prod with `esbuild` |
| AI services | Python (`ai-services`), invoked from the backend |
| Data | MongoDB (Atlas) via the official `mongodb` driver, **with a local file-based DB fallback** |
| Other libs | `jsonwebtoken`, `bcrypt`, `puppeteer` (PDF/worksheet rendering), `pdf-lib`, `jszip`, `express-rate-limit`, `@google/genai` (`backend/package.json`) |

**Architecture.** The backend is the single entry point (`backend/src/index.ts`). It:
- loads env via `dotenv` (with an explicit re-resolve of `backend/.env`, lines 6–11),
- connects to MongoDB with a 3-attempt retry that **falls back to a local file DB** (lines 69–76),
- validates the prerequisite graph at startup and refuses to boot if it is invalid (lines 83–96),
- registers all API routes through a consistent `registerXRoutes(app)` pattern (lines 108–137),
- and **serves the frontend itself** — Vite middleware in dev (lines 141–153), static `frontend/dist` + SPA fallback in prod (lines 154–162).

**Authentication.** JWT Bearer tokens. The frontend stores the token in `localStorage` under `fln_token` and attaches it via a central `apiFetch` helper (`frontend/src/services/apiClient.ts`, lines 20–33); `auth.ts` exposes `getAuthUser`, `canAccessStudent`, `sanitizeUser`, `JWT_SECRET`, and a seed-demo password hash. Passwords are hashed with `bcrypt`.

**Dashboards & UI.** A role-driven shell in `frontend/src/components/Layout.tsx` builds a per-role navigation registry (a `switch (currentUser.role)` producing nav items and `subItems`, lines ~128–208). Navigation keys flow into `frontend/src/components/PanelViews.tsx`, which is a large string-switch router (`if (panel === 'x') return <XPanel/>`) over ~20 panels in `frontend/src/components/panels/`. Shared data is fetched once by the `usePanelData` hook (`frontend/src/components/panels/usePanelData.ts`).

**Implemented features (working).** Role-scoped auth and dashboards; student roster + CSV bulk import; diagnostic paper generation and a **bulk** diagnostic workflow; AI-assisted evaluation producing rich `EvaluationReport`s with per-level pass/fail and skill gaps; a **93-level curriculum map** (`backend/src/config/curriculumMap.ts`) and a validated **cross-skill prerequisite graph** (`backend/src/competencyPrerequisites.ts` — `resolvePrerequisites` at lines 158–171, `describeConcept` at 127–138); deterministic per-level question generation (`levelGenerator.ts`); interventions + best-practices repository; audit logbook, tickets, announcements; and geographic rollup screens for admins.

**Database layer.** A `dbStore` singleton in `backend/src/db.ts` abstracts over both backends (Atlas and local file) with mode-aware CRUD, so the rest of the app is storage-agnostic. This file is very large (~3,469 lines) and also holds all the TypeScript model interfaces.

**Verification tooling.** `npm run lint` = `tsc --noEmit` on each workspace. Both `tsconfig.json` files are deliberately **non-strict** (`frontend/tsconfig.json` has no `strict`/`strictNullChecks`; `isolatedModules: true`, `moduleResolution: bundler`). Prior to my contribution there was **no automated test runner** wired up.

**Deployment setup.** Production is a **single Node process** that serves both the API and the pre-built frontend: `npm run build` (esbuild → `dist/server.cjs`; Vite build of the frontend) then `npm start` (`node dist/server.cjs`), configured via `.env` (Mongo connection string, `PORT`, `NODE_ENV`). I did not find evidence of container/CI manifests during exploration, so orchestration appears to be environment-driven rather than codified in the repo.

---

## 4. Gaps Observed in the Code

Each gap lists **Where / What / Why it matters**. These are drawn from files I read directly.

### Gap 1 — The diagnostic identifies gaps but there is no durable *remediation* loop (functional gap)
- **Where:** `backend/src/routes/students.ts` (diagnostic submit handler) computes `reasoning.prerequisiteLearningPath`; the shape is declared in `frontend/src/types.ts` lines 207–212, and `EvaluationReport.passedLevels / failedLevels / skillGaps` at lines 278–284.
- **What:** The prerequisite learning path is a **throwaway snapshot** — recomputed on every diagnostic, displayed on the report card, and never persisted. There is nowhere to record that a teacher has actually taught a gap and that the child has moved on. The product effectively **stops at diagnosis**.
- **Why it matters:** This is the core mission — moving children *up* the 93 levels — and it is the one loop that is left open. Without persistence there is no progress tracking, no continuity across re-tests, and no way to see remediation actually happening. (This is the gap my contribution closes.)

### Gap 2 — Mock/fallback data is silently served as if it were real
- **Where:** `frontend/src/components/panels/usePanelData.ts` — `TEACHERS_MOCK` (lines 19–24), `SCHOOLS_FALLBACK` (lines 26–41), `USERS_FALLBACK` (lines 43–53), applied at lines 98–106 (`apiSchools.length > 0 ? apiSchools : SCHOOLS_FALLBACK`, etc.).
- **What:** When an API call returns empty or fails, the UI substitutes hard-coded fake schools/users/teachers. The code itself acknowledges the danger for reports (comment at lines 100–104 explains why mock reports were removed), but the anti-pattern remains for schools, users, and teachers.
- **Why it matters:** Correctness and trust. An admin whose fetch quietly fails sees fabricated entities as though they were live data and cannot distinguish "genuinely empty" from "load failed." Decisions get made on fiction.

### Gap 3 — No pagination; whole national roster fetched into the browser
- **Where:** `frontend/src/components/panels/usePanelData.ts` lines 81–95 (the comment explicitly notes "up to 86,400 records nationally for Superadmin"), fetching `GET /api/students` in full.
- **What:** The entire role-scoped student list is pulled to the client with no pagination or server-side limiting.
- **Why it matters:** Scalability and performance. At national scale this is a huge payload, high memory, and slow first render — and it gates the analytics in Gap 4.

### Gap 4 — Analytics rollups are computed client-side by scanning every student
- **Where:** `usePanelData.ts` — `getDistrictStats` (lines 110–126) and `getBlockStats` (lines 128–144) filter the full `students` array in the browser.
- **What:** District/block aggregates (school counts, certified rates) are recomputed in the client over the entire dataset; there is no aggregation endpoint.
- **Why it matters:** Scalability. This is `O(schools × students)` work in the browser and inherits the full-fetch cost of Gap 3. Aggregation belongs in the database.

### Gap 5 — Non-strict TypeScript hides real null-safety bugs
- **Where:** `frontend/tsconfig.json` (no `strict` / `strictNullChecks`) and the backend equivalent. Concrete example: `Student.currentLevel` and `targetLevel` are `number | null` (types.ts lines 86–88), yet `frontend/src/components/panels/StudentProgressPanel.tsx` does `b.currentLevel - a.currentLevel` (line 11) and `(s.currentLevel / s.targetLevel) * 100` for a progress-bar width (line 14).
- **What:** With strict checks off, `null` arithmetic compiles silently and yields `NaN` widths / incorrect sorts at runtime for any not-yet-placed student.
- **Why it matters:** Correctness and maintainability. The type system is already describing the danger (`| null`) but is configured not to enforce it.

### Gap 6 — JWT stored in `localStorage`
- **Where:** `frontend/src/services/apiClient.ts` lines 22–24 (`localStorage.getItem('fln_token')`) and 28–31.
- **What:** The auth token lives in `localStorage`, which is readable by any script running on the page.
- **Why it matters:** Security. A single XSS foothold exfiltrates a valid token. `httpOnly`, `SameSite` cookies remove this class of exposure.

### Gap 7 — Process-wide swallowing of fatal errors
- **Where:** `backend/src/index.ts` lines 53–58 — `process.on('unhandledRejection', …)` and `process.on('uncaughtException', …)` that only `console.warn` and continue.
- **What:** The intent (survive transient MongoDB driver rejections) is reasonable, but the handler is blanket: **any** uncaught exception is swallowed and the process keeps serving in a possibly-corrupt state.
- **Why it matters:** Reliability and debuggability. Genuine bugs are masked, and standard Node guidance is to log and let the process restart on a truly uncaught exception rather than soldier on.

### Gap 8 — "Content" library is a hard-coded stub
- **Where:** `frontend/src/components/PanelViews.tsx` lines 37–44 (`CONTENT_ITEMS`) rendered by `ContentPanel`.
- **What:** The teaching-content feature is a fixed in-code array — no backing collection, CRUD, or upload.
- **Why it matters:** Missing functionality presented as a real feature; teachers cannot actually manage learning content.

### Gap 9 — No automated test suite / CI gate, and a monolithic `db.ts`
- **Where:** `backend/package.json` scripts (only `lint` before my change); `backend/src/db.ts` (~3,469 lines mixing model interfaces, both DB backends, and all CRUD).
- **What:** There is no unit/integration test runner across the workspaces, and the data layer is a single very large file.
- **Why it matters:** Maintainability and regression safety. Behaviour like the placement/prerequisite logic is high-stakes and currently unguarded by tests; the size of `db.ts` makes it hard to change safely.

### Gap 10 — Magic-number "certified" threshold embedded in a UI hook
- **Where:** `usePanelData.ts` lines 116 and 134 — the `st.currentLevel >= 5` filter, feeding `certifiedRate` at lines 123 and 141.
- **What:** The definition of "certified" is a bare constant living inside a frontend data hook, duplicated across two functions, and unrelated to the 93-level framework's own semantics.
- **Why it matters:** Correctness and single-source-of-truth. If the certification bar changes, it must be edited in multiple UI spots and can silently disagree with backend logic.

---

## 5. Ideas for the Project

Each idea maps to a gap above.

### Idea A — Persist a teacher-mediated Learning Path (→ Gap 1) **[implemented, see §6]**
- **What:** Turn the throwaway `prerequisiteLearningPath` into a durable, prerequisite-ordered, status-tracked remediation journey persisted on the student, with printable practice per step.
- **Why:** It closes the product's central open loop (diagnose → *teach* → master) and reuses assets that already exist (curriculum map + prerequisite graph + skill gaps).
- **How:** A pure ordering/merge engine over `resolvePrerequisites` + `CURRICULUM_MAPPING`; a small set of REST endpoints for get/recompute/status/practice; a panel under *Assessment*. (Details in §6.)

### Idea B — Honest data states instead of silent mocks (→ Gap 2)
- **What:** Remove the `*_FALLBACK` substitution and thread real `loading` / `error` / `empty` states through `usePanelData`, with a visible "couldn't load" banner and retry.
- **Why:** Prevents fabricated data from driving administrative decisions.
- **How:** The reports list already models the correct behaviour (no mock fallback, comment at lines 100–104). Generalise that: return `{data, loading, error}` per resource and render explicit empty/error components (the `EmptyStudents` component in `PanelShared.tsx` is a starting point).

### Idea C — Server-side pagination + aggregation endpoints (→ Gaps 3 & 4)
- **What:** Add `GET /api/students?page&limit&scope&search` and dedicated rollup endpoints (e.g. `GET /api/analytics/rollup?level=district`).
- **Why:** Removes the national full-fetch and moves `O(n)` aggregation to the database, where it belongs.
- **How:** Push filtering/aggregation into the `dbStore` layer (Mongo aggregation pipeline in Atlas mode; an equivalent reduce in file mode); have panels consume summaries and lazy-load detail. Pairs naturally with Idea B's `{data, loading, error}` shape.

### Idea D — Move auth to `httpOnly` cookies (→ Gap 6)
- **What:** Issue short-lived access tokens in `httpOnly`, `SameSite=Strict` cookies plus a refresh token; add CSRF protection.
- **Why:** Eliminates token theft via XSS.
- **How:** Set cookies on login in `routes/auth.ts`; read them server-side in `getAuthUser`; drop the `localStorage` read in `apiClient.ts` and rely on `credentials: 'include'`.

### Idea E — Turn on `strict` incrementally (→ Gap 5)
- **What:** Enable `strictNullChecks` first (frontend), fix the fallout, then the rest of `strict`.
- **Why:** Converts a whole class of runtime `NaN`/`undefined` bugs into compile errors.
- **How:** Flip the flag, start with the concrete `currentLevel/targetLevel` null-arithmetic in `StudentProgressPanel.tsx`, and guard `number | null` reads. Do it per-directory to keep PRs reviewable.

### Idea F — Adopt a test runner + CI gate, and split `db.ts` (→ Gap 9)
- **What:** Add `vitest` (frontend) and a lightweight backend test setup, run on every PR; extract model interfaces and each collection's CRUD out of `db.ts` into modules.
- **Why:** Protects the high-stakes placement/prerequisite logic and makes the data layer changeable.
- **How:** My Learning Path self-test (`backend/src/learningPathEngine.selftest.ts`, wired as `npm test`) is a working template for pure-logic tests; expand from there and add a CI workflow.

### Idea G — Make the Content library real (→ Gap 8) and centralise thresholds (→ Gap 10)
- **What:** Back `ContentPanel` with a `content` collection + CRUD + upload; move the "certified" cutoff into the curriculum config as a named constant consumed by both tiers.
- **Why:** Ships a genuine feature and removes duplicated magic numbers that can drift.
- **How:** Add `routes/content.ts` following the standard `registerXRoutes` pattern; export a `CERTIFICATION_LEVEL` from the curriculum config and import it in `usePanelData` and any backend equivalent.

### Idea H — Scope the global error handlers (→ Gap 7)
- **What:** Narrow the process-level handlers so only the known-benign MongoDB driver rejections are swallowed, and log-and-exit on everything else (letting a process manager restart cleanly).
- **Why:** Keeps the Atlas-resilience the handler was written for without masking genuine bugs in a possibly-corrupt process.
- **How:** In `backend/src/index.ts` (lines 53–58), inspect `reason`/`err`, re-throw or `process.exit(1)` for anything that is not the recognised driver rejection, and emit structured logs so swallowed events stay visible.

---

## 6. Your Contribution

**Contribution: a complete, push-ready teacher-mediated *Learning Path* remediation loop** — directly resolving **Gap 1** (and demonstrating **Idea A** and **Idea F**).

**What it does.** After a diagnostic, a teacher opens the new **Learning Path** screen, selects a student, and generates a path built from that student's latest `failedLevels` / `skillGaps`. The path is ordered **foundations first, then gaps** — prerequisite skills that unblock a failed level are taught before the level itself, using the existing prerequisite graph. Each step carries a teacher-advanced status (**Not started → Teaching → Mastered**) with a live mastery %, and any step can be printed as a targeted practice worksheet (Easier / Mastery / Remedial) with a teacher answer key. Re-running a diagnostic later **preserves recorded progress** rather than wiping it.

**Design highlights.** All ordering/merge logic is a **pure, dependency-free engine** so it is unit-testable in isolation and reuses `resolvePrerequisites` + `CURRICULUM_MAPPING` (single source of identity — the immutable `conceptId`). Persistence rides on the existing `dbStore.updateStudent` path, so both DB modes behave identically. The change is **additive, backward-compatible, and adds no dependencies**.

**Files (all following existing repo conventions).**

*Backend*
- `backend/src/learningPathEngine.ts` — **new.** Pure engine: `buildLearningPath`, `applyNodeStatus`, `summarizeLearningPath`, `isLearningPathStatus`.
- `backend/src/routes/learningPath.ts` — **new.** Four endpoints:
  - `GET /api/students/:id/learning-path`
  - `POST /api/students/:id/learning-path/recompute`
  - `PATCH /api/students/:id/learning-path/nodes/:conceptId`
  - `GET /api/students/:id/learning-path/nodes/:conceptId/practice?subLevel=`
- `backend/src/learningPathEngine.selftest.ts` — **new.** 18-assertion, dependency-free test harness driven by the real curriculum graph (the repo's first automated test — see Idea F).
- `backend/src/db.ts` — added `learningPath?` to the `Student` model (type-only import, no runtime cycle).
- `backend/src/index.ts` — registered the routes next to `registerStudentRoutes`.
- `backend/package.json` — wired `"test": "tsx src/learningPathEngine.selftest.ts"`.

*Frontend*
- `frontend/src/components/panels/LearningPathPanel.tsx` — **new.** The screen (student picker, foundations-before-gaps journey, status controls, recompute, printable practice).
- `frontend/src/types.ts` — mirror types + `learningPath?` on `Student`.
- `frontend/src/components/PanelViews.tsx` — router entry for `learning_path`.
- `frontend/src/components/Layout.tsx` — *Learning Path* nav item under *Assessment* for Teacher and Volunteer.

**How to verify.**
```bash
cd backend  && npm test && npm run lint
cd frontend && npm run lint
```

**Why it matters.** It reuses the analysis the product already performs and turns it into the missing teaching half — the durable, trackable remediation journey that the mission (every child moving up the 93 levels) actually depends on.

---

*Authored by Ritwij Tripathi as part of FLN onboarding.*
