# Onboarding Document — nini0t7

**Contributor:** nini0t7 (umaenumula04@gmail.com)  
**Target Repository:** [vicharanashala/fln](https://github.com/vicharanashala/fln) / [nini0t7/fln](https://github.com/nini0t7/fln)  
**Target Issue:** [Issue #323: Close out resolved AUDIT.md items (mock interceptor, levelGenerator dup)](https://github.com/vicharanashala/fln/issues/323)  
**Date:** September 2026  

All file citations and line numbers in this document were verified through direct inspection of the codebase on the `main` branch following the backend route modularization and the frontend dashboard decomposition.

---

## 1. What is FLN?

FLN stands for **Foundational Literacy and Numeracy**. In the context of early childhood and primary education (pre-school through Class 4, covering children roughly aged 3 to 10), FLN represents the essential gateway competencies: letter and word recognition, reading with comprehension, counting with cardinality, number sense, spatial awareness, and early arithmetic operations. Without these foundational capabilities, a child cannot participate meaningfully in later academic schooling; as curricula progress, unaddressed early deficiencies compound exponentially into chronic learning poverty, classroom disengagement, and eventual dropout.

In India and similar developing educational ecosystems, annual learning assessments (such as the ASER reports) consistently surface a stark reality: millions of students in Class 3 and Class 5 cannot read a simple Class 2 text or perform basic two-digit subtraction with borrowing. The root of this crisis is not merely a lack of teaching effort, but an acute structural mismatch in classroom delivery:

1. **Severe Classroom Heterogeneity:** In any single Class 3 room of 30 to 40 children, the developmental spread is enormous. One child may still struggle with single-digit one-to-one correspondence, another is comfortable adding single digits, while a third is ready for multi-digit multiplication.
2. **The "Teaching to the Middle" Trap:** Because teachers are often responsible for multigrade classrooms and burdened with heavy non-teaching administrative duties, they cannot manually diagnose every child and author 40 distinct practice papers every morning. They are forced to teach to the class average, leaving struggling students completely behind while failing to challenge faster learners.
3. **The Hardware Reality:** The children who need intervention most do not own smartphones, tablets, or computers. Any solution that requires children to sit in front of interactive screens or log into browser portals cannot work in the vast majority of government primary schools.

The FLN platform addresses this problem by making **personalized pedagogical differentiation mechanical rather than manual**:

- **Fine-Grained Diagnosis:** Rather than reducing a child's understanding to a coarse letter grade or binary pass/fail score, the platform evaluates students against an explicit 93-level competency continuum (each paired with 3 fine sublevels: Mastery, Intermediate, and Remedial), locating the precise floor where their understanding breaks down.
- **Paper-First, Personalized Worksheets:** The system algorithmically synthesizes customized, printable worksheets matched exactly to each individual child's current placement level. The child never touches a screen; they work with pencil and paper at their desk.
- **Closed-Loop Paper Ingestion:** Once worksheets or diagnostics are completed, teachers or field volunteers photograph or scan the papers. An automated OCR/ICR pipeline (integrating blue-ink isolation and vision intelligence) digests the physical papers back into digital evaluation reports without manual grading overhead.
- **Actionable Remediation & Misconception Profiling:** Instead of simply grading an answer as wrong, the evaluation engine isolates root misconceptions, traces missing prerequisite skills, and determines the next targeted level.
- **Hierarchical Governance:** Aggregates flow upward across schools, blocks, districts, and states, providing administrators with transparent, evidence-based visibility into where learning stagnation is occurring.

---

## 2. What do you understand by FLN (as a system)?

### 2.1 Actors and Organizational Hierarchy

The platform models India's public educational administration through a strict seven-role hierarchy (`backend/src/db.ts: UserRole`), where authorization and data visibility are gated server-side (`backend/src/auth.ts: canAccessStudent`):

```text
Superadmin (Platform-wide authority)
  └── State Admin (State-wide rollup & policy)
        └── District Admin (District-wide schools & analytics)
              └── Block Admin (Block-level oversight & school interventions)
                    └── School Administrator (Single school management)
                          ├── Teacher (Classroom instruction & diagnostic execution)
                          └── Volunteer (Roving assessment support across assigned schools)
```

- **Students:** Crucially, students are **subjects**, not users of the platform. They have no login credentials, no user accounts, and no digital interface. Every action regarding a student (enrollment, assessment generation, paper submission, level promotion) is transacted on their behalf by teachers or volunteers.
- **Teachers vs. Volunteers:** A `TEACHER` is strictly bound to a specific `schoolId` and manages their own classroom roster. A `VOLUNTEER` serves as field evaluation personnel, granted roving operational authority across a specific array of schools (`user.assignedSchools`), allowing them to administer diagnostics and scan papers during mass assessment drives without holding administrative rights over school governance.
- **Administrative Tiers:** School, Block, District, and State Administrators consume read-only aggregates, track defaulter escalations, manage coordinator rosters, and monitor certification progress across their respective geographic jurisdictions.

### 2.2 Core Domain Entities and Data Model

The platform's domain model connects identity, curriculum, assessment, and physical paper workflows:

- **`Student` (`backend/src/db.ts: Student`):** Represents the child. Key attributes include `currentLevel` (integer 1–93), `currentSubLevel` (0 = Mastery, 1 = Intermediate, 2 = Remedial), `targetLevel`, `levelHistory` (chronological trace of level adjustments), and attendance/demographic metadata.
- **The Curriculum Backbone (`backend/src/config/curriculumMap.ts`):** The definitive standard comprising **93 sequential levels** spanning 10 mathematical strands: *Pre-Number Foundations, Number Sense, Number Operations, Shapes & Spatial, Measurement, Patterns, Money, Calendar & Time, Fractions,* and *Data Handling*. Each level is assigned an immutable `conceptId` (e.g., `S1.1` through `S7.18`). Separating the immutable `conceptId` from the mutable `levelNumber` ensures the pedagogical progression can be re-ordered without breaking historical student records or prerequisite graphs.
- **`Question` & `QuestionBankEntry`:** Domain items linked to specific `conceptId`s, difficulty tags, and rendering templates.
- **`Worksheet` & `LevelWorksheet`:** Represents generated paper sets. A `Worksheet` coordinates class-level generation metadata, timing windows, and pairwise anti-collision locks. A `LevelWorksheet` stores the specific per-student PDF reference, unique batch identifier, OMR/ICR coordinates, and master answer keys.
- **`AnswerSubmission`:** Holds the raw scanned or transcribed responses from the child, maintaining the integrity of what was physically written.
- **`EvaluationReport`:** The structured verdict produced by the evaluation engine, detailing the computed score, concept-by-concept mastery, narrative teacher notes, and updated `recommendedLevel` and `recommendedSubLevel`.
- **`MisconceptionCluster`:** Cohort-level clusters that group students exhibiting identical mathematical error patterns, enabling small-group classroom remediation.

### 2.3 End-to-End System Data Flow

The operational lifecycle operates as an end-to-end continuous loop:

```text
[1. Baseline / Student Onboarding]
   Teacher/Admin registers student -> Initial placement set (Class baseline)
                 │
                 ▼
[2. Diagnostic / Worksheet Generation]
   Teacher requests generation (POST /api/students/:id/diagnostic or POST /api/worksheets/generate)
   -> System locks class (pairwise lockouts)
   -> Generates questions via levelGenerator / Puppeteer PDF engine
   -> Embeds unique QR code containing student identity and level metadata
                 │
                 ▼
[3. Physical Classroom Administration]
   Teacher prints generated A4 PDF -> Students solve questions on paper using pencil/pen
                 │
                 ▼
[4. Physical Ingestion & Scanning]
   Teacher/Volunteer photographs or scans completed sheets
   -> POST /api/icr/scan-two-stage (Blue-pen extraction, Ollama Gemma 4 vision OCR)
   -> Raw answers captured as AnswerSubmission
                 │
                 ▼
[5. Evaluation & Placement Engine]
   POST /api/students/:id/diagnostic/submit
   -> Python evaluation pipeline / Gemini fallback analyzes answer patterns
   -> Minimum-failure placement rule applied (lowest failing level becomes placement)
   -> EvaluationReport saved; student.currentLevel & levelHistory updated
   -> Student mapped to Misconception Cluster
                 │
                 ▼
[6. Administrative Aggregation & Remediation]
   Dashboards aggregate completion & certification rates (currentLevel >= 5)
   -> Targeted micro-practice worksheets generated for identified weak skills
   -> Cycle repeats
```

---

## 3. Current State of the Repository — What Has Been Done So Far

### 3.1 Tech Stack and Architectural Layout

The repository is organized as an **npm workspaces monorepo**:

- **Frontend (`frontend/`):** React 19, TypeScript, Vite 6, Tailwind CSS 4, TanStack Query (`@tanstack/react-query` v5), React Router 7, and `i18next` for multilingual localization (English, Hindi, Kannada, Tamil, Telugu, Marathi).
- **Backend (`backend/`):** Node.js + Express with TypeScript, executed in development via `tsx` and compiled for production via `esbuild`. The backend has transitioned from a monolithic `index.ts` into a clean bootstrap file (`backend/src/index.ts`, ~183 lines) that registers **23 dedicated route modules** under `backend/src/routes/`.
- **AI & Evaluation Services (`ai-services/`):** Python-based evaluation engine containing `run_pipeline.py`, classification scripts, PDF rasterization utilities (`scripts/pdf_rasterize.py`), prompts, and question banks.
- **Database Layer:** Primary persistence via MongoDB Atlas (`mongodb` official driver) encapsulated in `backend/src/db.ts` (`DBStore`), with an automated local JSON fallback (`data/db.json`) when `MONGODB_URI` is unconfigured.
- **Worksheet Rendering & PDF Generation:** Headless Chrome via Puppeteer (`backend/src/paperGenerator.ts`, `browser.ts`) paired with external batch rendering capabilities (`backend/src/levelsBackendClient.ts`).

### 3.2 Implemented Features

1. **Authentication and Access Governance:**
   - Real JWT-based authentication (`backend/src/auth.ts`, `backend/src/routes/auth.ts`) utilizing `bcrypt` password verification and 7-day signed tokens.
   - Brute-force mitigation via `authRateLimiter` (`backend/src/config.ts`).
   - Server-side IDOR defense and role-scoped student data gating via `canAccessStudent()`.
2. **Pedagogical Engine & Curriculum Mapping:**
   - Comprehensive 93-level mathematical competency curriculum (`curriculumMap.ts`) with formal prerequisite validation graph (`competencyPrerequisites.ts`).
   - Algorithmic question generation across all 93 levels with 3 sub-levels (`backend/src/levelGenerator.ts`).
3. **Physical-to-Digital Pipeline (ICR/OCR):**
   - Two-stage scanning pipeline (`frontend/src/components/IcrTwoStageScan.tsx`, `backend/src/routes/evaluation.ts`) featuring blue-ink threshold filtering, PDF-to-image rasterization, and vision OCR via Ollama Gemma 4.
4. **AI Diagnostic & Evaluation Engine:**
   - Multi-stage evaluation pipeline combining deterministic rule-based analysis, Python evaluation scripts, and Google Gemini API integration (`backend/src/gemini.ts`) with automatic deterministic non-AI fallbacks.
   - Automated Misconception Fingerprinting and archetype clustering (`backend/src/misconceptionFingerprint.ts`, `studentArchetypeService.ts`).
5. **Role-Based User Dashboards & Specialized Panels:**
   - Cleanly decoupled frontend components in `frontend/src/components/dashboards/` (`SuperadminDashboard`, `AdminDashboard`, `SchoolDashboard`, `TeacherDashboard`, `VolunteerDashboard`, `RegionalAnalyticsView`).
   - Over 25 specialized panel views in `frontend/src/components/panels/` covering student profiling, attendance, question template authoring, curriculum inspection, and bulk diagnostic tracking.

### 3.3 Verification of Codebase Health

Static type-checking was executed across both core workspaces to verify the baseline:

```bash
npm run lint --workspaces --if-present
# backend: npx tsc --noEmit -> clean (exit 0)
# frontend: npx tsc --noEmit -> clean (exit 0)
```

---

## 4. Gaps Observed in the Code

### Gap 1: Stale and Misleading Root Audit Documentation (`AUDIT.md`) — [Issue #323]

- **Where:** `AUDIT.md:5`, `AUDIT.md:29-37`, `AUDIT.md:63-64`, `AUDIT.md:140-141`, `AUDIT.md:187-191`.
- **What:** The root `AUDIT.md` document—originally drafted during the legacy `mvp/` architecture on 2026-07-10—still claims in its executive summary and action tables that:
  1. The frontend intercepts all `/api/*` calls using an in-browser `localStorage` mock interceptor (`src/mock/fetchInterceptor.ts`), preventing the app from ever communicating with the real backend.
  2. `levelGenerator.ts` is duplicated byte-for-byte across `src/utils/levelGenerator.ts` and `server/levelGenerator.ts`.
  
  In the current repository, `mvp/` has been retired, `src/mock/fetchInterceptor.ts` has been deleted, `frontend/src/services/apiClient.ts` executes authentic HTTP `fetch()` requests with JWT headers, and `levelGenerator.ts` exists exclusively on the backend (`backend/src/levelGenerator.ts`). However, because `AUDIT.md` does not mark P0-1 and P1-1 as resolved or struck through, new contributors continue to re-investigate settled problems.
- **Why it matters:** Inaccurate foundational documentation creates developer friction, wastes contributor time, and misleads reviewers regarding the current stability and architecture of the platform.

### Gap 2: Universal Master Demo Password Bypass on User Accounts

- **Where:** `backend/src/routes/auth.ts:34-38`, importing `SEED_DEMO_PASSWORD_HASH` from `backend/src/auth.ts:7`.
- **What:** When a user attempts to log in, the authentication handler checks:
  ```ts
  const targetHash = user.passwordHash || SEED_DEMO_PASSWORD_HASH;
  let passwordOk = await bcrypt.compare(password, targetHash);
  if (!passwordOk && user.passwordHash) {
    passwordOk = await bcrypt.compare(password, SEED_DEMO_PASSWORD_HASH);
  }
  ```
  While falling back to `SEED_DEMO_PASSWORD_HASH` when `!user.passwordHash` allows newly seeded demo accounts to authenticate, lines 36–38 specifically trigger when `user.passwordHash` **is present**. If an administrator or teacher changes their password to a custom passphrase, the secondary comparison still tests the input against `SEED_DEMO_PASSWORD_HASH` (`Fln@2026`).
- **Why it matters:** Any actor with knowledge of the public repository constant `Fln@2026` can authenticate into **any** existing account—including `SUPERADMIN`—regardless of whether the account owner configured a strong password. This represents an unintended authentication bypass across the platform.

### Gap 3: Environment Variable Desynchronization for Demo Password

- **Where:** `backend/src/auth.ts:7` versus `backend/src/db.ts:12-13`, imported in `backend/src/routes/auth.ts:5`.
- **What:** In `backend/src/db.ts`, the demo password respects the environment:
  ```ts
  export const SEED_DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'Fln@2026';
  export const SEED_DEMO_PASSWORD_HASH = bcrypt.hashSync(SEED_DEMO_PASSWORD, 10);
  ```
  However, in `backend/src/auth.ts`, the hash is hardcoded:
  ```ts
  export const SEED_DEMO_PASSWORD_HASH = bcrypt.hashSync('Fln@2026', 10);
  ```
  `backend/src/routes/auth.ts` imports `SEED_DEMO_PASSWORD_HASH` from `../auth` rather than `../db`.
- **Why it matters:** When a DevOps engineer or school administrator sets `SEED_DEMO_PASSWORD=CustomSecurePass` in their `.env` file per `.env.example`, the database reseed helper uses the new hash, but the login route continues to evaluate against the hardcoded `'Fln@2026'` hash. The documented security override is silently ignored.

### Gap 4: Single-Thread Blocking via Synchronous `execFileSync` in OCR/PDF Rasterization

- **Where:** `backend/src/routes/evaluation.ts:353-362` and `backend/src/routes/evaluation.ts:788-797`.
- **What:** When a teacher uploads a PDF answer sheet for OCR evaluation or student name extraction, the server executes the Python rasterization script synchronously:
  ```ts
  const childOut = execFileSync(
    PYTHON_BIN,
    [scriptPath, pdfPath, pagesDir, '--all-pages'],
    {
      cwd: AI_SERVICES_DIR,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      timeout: 60000,
      maxBuffer: 32 * 1024 * 1024,
    }
  );
  ```
- **Why it matters:** Node.js relies on an event-driven, single-threaded execution model. `execFileSync` blocks the main thread for the entire duration of the rasterization process (up to 60 seconds). During this time, the server cannot process any other incoming HTTP requests—dashboard queries freeze, health checks fail, and concurrent teacher submissions time out.

### Gap 5: High Collision Risk in Pseudo-Random 4-Digit Worksheet IDs

- **Where:** `backend/src/routes/worksheets.ts:261`.
- **What:** Newly generated class worksheets are assigned identifiers using a 4-digit pseudorandom number:
  ```ts
  id: 'WS_' + Math.floor(1000 + Math.random() * 9000),
  ```
  This creates a small keyspace of only 9,000 discrete identifiers (`WS_1000` to `WS_9999`) without any collision-check loop or database uniqueness constraint.
- **Why it matters:** Under the Birthday Paradox, across just 118 generated worksheets, the probability of an ID collision exceeds 50%; at 300 worksheets, collision is virtually guaranteed. When a collision occurs, existing worksheet timing windows, locks, or question assignments are overwritten, corrupting classroom evaluation records.

### Gap 6: Disk Space Leak from Orphaned Scratch Files on Rasterization Failure

- **Where:** `backend/src/routes/evaluation.ts:783-822`.
- **What:** Temporary PDF and page artifacts are created in `AI_SERVICES_DIR/scratch/`:
  ```ts
  const stamp = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  const pdfPath = path.join(scratchDir, `name_pdf_${stamp}.pdf`);
  const pagesDir = path.join(scratchDir, `name_pdf_${stamp}_pages`);
  ```
  The cleanup calls `fs.rmSync(pdfPath)` and `fs.rmSync(pagesDir)` are situated on lines 799–800, *after* `execFileSync`. If `execFileSync` throws due to a malformed PDF, process timeout, or Python runtime exception, execution immediately jumps to the `catch` block (lines 820–822), completely bypassing the cleanup logic.
- **Why it matters:** In production, failed or malformed PDF uploads will permanently accumulate multi-megabyte temporary files in the `scratch/` directory, eventually exhausting server disk storage and filesystem inodes.

---

## 5. Ideas for the Project

### Idea 1: Formal Audit & Architecture Verification in CI (Grounded in Gap 1)

- **What:** Modernize `AUDIT.md` by striking settled items, recording formal resolution entries, and introducing a lightweight repository health check script (`scripts/verify-architecture.js`) integrated into CI.
- **Why:** Documentation debt actively degrades engineering velocity. Having an automated check ensuring that deprecated mock interceptors or duplicated modules do not inadvertently reappear keeps the repository clean as new interns onboard.
- **How:**
  1. Update `AUDIT.md` to officially close P0-1 and P1-1 with resolution timestamps and commit traces.
  2. Add an architectural invariant assertion in `scripts/repo-health-check.js` that fails if `fetchInterceptor` or duplicate `levelGenerator.ts` files are detected.

### Idea 2: Unified Environment-Gated Authentication & Demo Credential Disablement (Grounded in Gaps 2 & 3)

- **What:** Refactor the authentication subsystem to remove the universal demo password fallback when a custom password exists, and consolidate demo credential configuration into a single configuration module (`backend/src/config.ts`).
- **Why:** Eliminates the master credential bypass on user accounts, restores true password privacy, and ensures that setting `SEED_DEMO_PASSWORD` in `.env` reliably governs the entire application.
- **How:**
  1. Move `SEED_DEMO_PASSWORD` and `SEED_DEMO_PASSWORD_HASH` definitions exclusively into `backend/src/config.ts`, deriving both from `process.env.SEED_DEMO_PASSWORD || 'Fln@2026'`.
  2. In `backend/src/routes/auth.ts`, restrict `SEED_DEMO_PASSWORD_HASH` validation strictly to accounts where `!user.passwordHash`.
  3. If `process.env.NODE_ENV === 'production'`, disable the demo fallback entirely unless an explicit `ALLOW_DEMO_LOGIN=true` flag is set.

### Idea 3: Asynchronous Non-Blocking PDF Rasterization Worker with Guaranteed Cleanup (Grounded in Gaps 4 & 6)

- **What:** Replace synchronous `execFileSync` calls in `backend/src/routes/evaluation.ts` with asynchronous child process execution (`util.promisify(execFile)`), wrapping filesystem allocations in a strict `try...finally` block.
- **Why:** Prevents the Node.js event loop from stalling during heavy OCR tasks, maintaining snappy dashboard response times while guaranteeing zero disk leaks on failed PDF processing.
- **How:**
  ```ts
  import { execFile } from 'child_process';
  import { promisify } from 'util';
  const execFileAsync = promisify(execFile);

  // In evaluation.ts:
  try {
    await fs.promises.writeFile(pdfPath, Buffer.from(base64Body, 'base64'));
    const { stdout } = await execFileAsync(PYTHON_BIN, [scriptPath, pdfPath, pagesDir, '--page', '1'], {
      cwd: AI_SERVICES_DIR,
      timeout: 30000,
      maxBuffer: 32 * 1024 * 1024,
    });
    // process stdout...
  } finally {
    await fs.promises.rm(pdfPath, { force: true }).catch(() => {});
    await fs.promises.rm(pagesDir, { recursive: true, force: true }).catch(() => {});
  }
  ```

### Idea 4: Collision-Free Cryptographic Identifiers for Worksheets (Grounded in Gap 5)

- **What:** Replace 4-digit pseudo-random numbers in `backend/src/routes/worksheets.ts` with standard cryptographically secure UUIDv4 identifiers.
- **Why:** Prevents worksheet ID collisions across regional and statewide deployments, safeguarding evaluation reports, student grades, and audit trails against silent overwrites.
- **How:**
  In `backend/src/routes/worksheets.ts:261`, change:
  ```ts
  id: 'WS_' + Math.floor(1000 + Math.random() * 9000),
  ```
  to:
  ```ts
  id: 'WS_' + randomUUID(),
  ```
  leveraging the existing `randomUUID` import from Node's built-in `crypto` module (already utilized for `LevelWorksheet` on line 98).

---

## 6. Your Contribution

### 6.1 Focus: Resolving Issue #323

My primary contribution for this onboarding milestone directly addresses **Issue #323: "Close out resolved AUDIT.md items (mock interceptor, levelGenerator dup)"**.

Prior to this work, `AUDIT.md` remained in its initial July 2026 state, prominently flagging the frontend fetch interceptor and `levelGenerator.ts` duplication as active, critical P0 and P1 vulnerabilities. This created significant confusion for incoming contributors who spent hours auditing frontend network stacks only to realize the code described in `AUDIT.md` had already been refactored.

### 6.2 Tangible Deliverables

1. **Architectural Verification & Codebase Audit:**
   - Conducted a full static audit of `frontend/src/main.tsx`, confirming the total absence of `setupFetchInterceptor()`.
   - Verified that `frontend/src/services/apiClient.ts` serves as the sole network communication layer via `apiFetch()`, correctly propagating `Authorization: Bearer <token>` to the Express backend.
   - Verified that `src/mock/fetchInterceptor.ts` and `src/mock/dbStore.ts` have been completely removed from the project.
   - Audited the repository for `levelGenerator.ts` occurrences, confirming that only one authoritative file exists: `backend/src/levelGenerator.ts`. Confirmed that no answer keys or generator code leak into client bundles.

2. **Formal Documentation Updates to `AUDIT.md`:**
   - Added an **Audit Update & Resolution Log (September 2026)** at the head of `AUDIT.md` summarizing the resolution of the two highest-priority findings.
   - Updated Section 1 (Current folder structure) with clear status tags demarcating deleted and refactored components.
   - Struck through and marked resolved items **2.10**, **2.13**, **4.1**, and **4.2** in Sections 2 and 4.
   - Struck through and marked closed **🔴 P0-1** ("Remove the fetch interceptor; point the frontend at the real server") and **🟠 P1-1** ("De-duplicate `levelGenerator.ts`") in Section 6's prioritized roadmap table.

3. **Creation of the Onboarding Document (`Ideas/ONBOARDING-nini0t7.md`):**
   - Synthesized the system architecture, domain motivations, codebase realities, and verified gaps into this comprehensive onboarding document.
   - Formulated actionable, grounded proposals for auth hardening, non-blocking PDF rasterization, and collision-free worksheet IDs.

### 6.3 Verification and Quality Assurance

- Executed repository-wide lint checks across both workspaces:
  ```bash
  npm run lint --workspaces --if-present
  ```
  Verified that both `@fln/frontend` and `@fln/backend` compile cleanly with 0 type errors.
- Verified that all route registrations in `backend/src/index.ts` cleanly link with their route modules without regressions.
