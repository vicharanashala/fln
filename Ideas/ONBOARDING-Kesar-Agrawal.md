# ONBOARDING — Kesar Agrawal

---

## 1. What is FLN?

FLN stands for **Foundational Literacy and Numeracy**. In the context of this project, it specifically addresses foundational **Mathematics and Numeracy** for early primary and pre-primary children across Classes 2–4 (and extending down to Balvatika / preschool, spanning ages 3–10).

The fundamental educational challenge it tackles is that millions of children attend school and progress through grade levels without acquiring basic numeracy: counting, number recognition, place value, and arithmetic operations. In typical classrooms with large, mixed-ability student cohorts, teachers must teach one uniform lesson at a single pace. Without accessible diagnostic instruments, teachers have no practical way to identify where each individual child sits on the learning continuum, and lack the bandwidth to hand-craft personalized practice sheets for forty different learners. Children who fail early concepts get left behind, compounding learning deficits across successive academic years.

The FLN platform resolves this structural problem through a closed, data-driven cycle:

1. **Assess & Diagnose**: Evaluate learners using diagnostic papers to place them on a granular, progressive scale (109 levels across Stages 1–7) rather than a coarse pass/fail mark.
2. **Personalize & Generate**: Produce printable worksheets dynamically tailored to each student's current learning level and prerequisite needs. Paper worksheets are essential because students in Indian government classrooms typically do not have personal computing devices.
3. **Ingest & Scan**: Digitally capture completed physical worksheets via image and ICR scanning (`frontend/src/components/IcrScanner.tsx`) using blue-ink extraction and OCR technology.
4. **Evaluate & Fingerprint**: Run scanned inputs through an AI evaluation pipeline (`ai-services/run_pipeline.py` and Google Gemini) to extract question-level scores, competency masteries, and root-cause diagnostic feedback.
5. **Roll Up Hierarchy**: Aggregate student outcomes through a 7-tier governance hierarchy (from classroom teacher up to national superadmin) to provide data-backed visibility into systemic learning deficiencies.

---

## 2. What do you understand by FLN (as a system)?

### Actors and Governance Roles

The system is governed by a strict 7-role administrative hierarchy declared in `backend/src/db.ts` (`UserRole`) and enforced on the backend via `getAuthUser` and `canAccessStudent` in `backend/src/auth.ts`:

| Role | Operational Scope | Responsibilities & Access Boundaries |
|---|---|---|
| `SUPERADMIN` | National / Global | Full platform access: manages curriculum map, authoring question templates, global configurations, and role provisioning. |
| `ADMIN` | State level | High-level regional oversight, school and district-level performance analytics, state-wide certifications. |
| `DISTRICT_ADMIN` | District level | District analytics, monitoring school compliance and performance across all constituent blocks. |
| `BLOCK_ADMIN` | Sub-district / Block | Operational monitoring of schools and clusters within a specific administrative block. |
| `SCHOOL` | Single institution | Institutional dashboard, student roster management, teacher oversight. |
| `TEACHER` | Class / School | Daily classroom instruction, worksheet generation, diagnostic scheduling, student evaluations. |
| `VOLUNTEER` | Assigned schools | Targeted field assessment duty strictly limited to their `assignedSchools` list. |

### Core Entities & Data Architecture

The interaction graph across core entities follows a clear progression:

```
School ──has──> ClassGroup ──has──> Student (currentLevel, levelHistory, aadharMasked)
                                      │
Worksheet ──(questions[])────────────┼──> AnswerSubmission (raw student answers)
   │                                  │          │
   ├─ cycleLock (timing window)       │          ▼
   └─ generated from currentLevel     └──> EvaluationReport (score, mastery, recommendedLevel)
                                                 │
                                                 ├──> Certification (audit trail)
                                                 └──> MisconceptionCluster
```

- **Student** (`backend/src/db.ts`): Stores `currentLevel`, `targetLevel`, `levelHistory`, demographic metadata, and `aadharMasked`. Sensitive Aadhaar identifiers are securely detokenized via the Aadhaar Vault.
- **School & ClassGroup**: Structural containers grouping cohorts, determining teacher authorization and data isolation.
- **QuestionTemplate & QuestionBank**: Reusable items authored by superadmins with `skills`, `tags`, `difficulty`, and `assessmentMode` (`'written'`, `'observed'`, or `'both'`).
- **Worksheet**: Generated question sets constrained by assessment cycle locks (`Baseline`, `Mid-year`, `End-of-year`) and print/submission timing windows.
- **AnswerSubmission**: Captures raw student responses keyed by question ID, preserving the exact answers written or entered by the child.
- **EvaluationReport**: Stores the evaluated assessment outcomes (score distributions, topic mastery, and recommended next level), driving level promotions and remedial branching.
- **Aadhaar Vault**: High-security, fail-closed cryptographic tokenization module with an isolated master key management layer.

---

## 3. Current State of the Repository — What Has Been Done So Far

### Monorepo Structure

The platform is structured as an **npm-workspaces monorepo** with three active workspaces:

| Workspace | Technology Stack | Purpose & Responsibility |
|---|---|---|
| `frontend/` (`@fln/frontend`) | React 19, Vite, Tailwind CSS, TanStack Query | Client application serving interactive dashboards across all 7 roles, ICR scanning interfaces, and curriculum/question authoring panels. Proxies `/api/*` requests to `:3000`. |
| `backend/` (`@fln/backend`) | Node.js, Express, TypeScript, native MongoDB driver, Puppeteer, esbuild | Modular Express API structured into distinct route modules under `backend/src/routes/`. Handles authentication, student records, worksheet PDF rendering, and vault encryption. |
| `backend/fln-backend/` (`fln-worksheet-backend`) | Node.js, Express, Puppeteer | Batch-generates personalised worksheets, answer keys and OMR coordinates by driving the browser app headlessly. |

`ai-services/` (Python 3, Gemini API, OCR) is not an npm workspace; it holds the handwriting-recognition and scoring pipeline that the backend calls.

### Key Architectural Highlights

1. **API-Driven Architecture**: The frontend operates strictly against the real backend API running on port 3000 (proxied via Vite). Legacy in-browser mock interceptors have been fully excised.
2. **Modularized Backend Routes**: Endpoints are partitioned into domain-specific route modules under `backend/src/routes/` (`auth.ts`, `students.ts`, `worksheets.ts`, `evaluation.ts`, `schools.ts`, etc.) registered via a clean bootstrap in `backend/src/index.ts`.
3. **Authentication & Access Control**: Handled via signed JSON Web Tokens (`jsonwebtoken`) and bcrypt-hashed credentials with brute-force rate limiting. Access boundaries are validated on every endpoint via `getAuthUser` and `canAccessStudent`.
4. **Data Persistence**: Primary storage uses MongoDB with multi-document transaction support; local development falls back to `backend/data/db.json`.
5. **Fail-Closed Aadhaar Vault**: Student Aadhaar numbers are tokenized using AES-256-GCM envelope encryption with HKDF-SHA-256 derived keys. Plaintext Aadhaar numbers are never stored in the primary database.

---

## 4. Gaps Observed in the Code

Through active codebase inspection, PR reviews, and testing, several gaps were identified across security, frontend usability, and administrative workflows:

### Gap 1: Insecure, Malformed, and Unescaped Client-Side CSV Exports
- **Location**: `frontend/src/components/Table.tsx`, `LogbookView.tsx`, `StudentListPanel.tsx`, `TeacherDashboard.tsx`, `VolunteerDashboard.tsx`, `SuperadminDashboard.tsx`.
- **What**: Data tables throughout the application implemented custom, ad-hoc CSV export snippets using primitive string concatenation:
  - Spreadsheets opened by administrators were vulnerable to **CSV Formula Injection** (Spreadsheet Formula Injection / DDE execution) if fields contained leading `=, +, -, @, \t, \r` characters.
  - Cell values containing quotes or commas caused corrupted column alignments and broken exports.
  - Unicode/Hindi names (e.g. `आरव शर्मा`) opened with garbled characters in Microsoft Excel due to missing UTF-8 Byte Order Marks (BOM `\uFEFF`).
  - Lines were terminated with LF (`\n`) rather than RFC 4180-compliant CRLF (`\r\n`).
  - In generic tables, when `accessor` returned JSX (like `<LevelBadge />` or `<div className="student-id" />`), the export fell back to `row[sortKey]` or `row[filterKey]`, emitting empty cells for IDs, current levels, and diagnostic statuses.
- **Why it matters**: FLN data is routinely exported by government school teachers and district administrators into Excel. Malformed files impair administrative reporting, while formula injection exposes educator workstations to malicious code execution.
- **Status**: **Resolved in merged PR #799**.

### Gap 2: Undocumented and Silent Aadhaar Vault Configuration Failures
- **Location**: `README.md`, `backend/.env.example`, `backend/src/index.ts`.
- **What**: The Aadhaar Vault tokenization system mandates a base64-encoded master key (`LOCAL_DEV_MASTER_KEY`) and replica set transactions. In production mode (`NODE_ENV=production`), `LocalDevKeyManager` requires `VAULT_ALLOW_UNSAFE_KEY_PROVIDER=true` to explicitly acknowledge the risk of running an unsafe local key provider with environment variable key storage. However:
  - Key derivation requirements and key generation commands (`openssl rand -base64 32`) were undocumented in `backend/.env.example`.
  - The server started up silently without validating vault settings. When teachers later attempted student registration or bulk roster imports, the operations crashed with runtime 503 `VaultError NOT_CONFIGURED`.
  - There was no startup diagnostic or structured pre-flight check to inform administrators of missing vault credentials before encountering runtime student registration failures.
- **Why it matters**: Silent startup of a misconfigured security service causes sudden failures during classroom onboarding. Operators need immediate diagnostic feedback at boot without sacrificing fail-closed security.
- **Status**: **Resolved in merged PR #798**.

### Gap 3: Missing Assessment Mode Visibility and Filtering in Curriculum Question Templates
- **Location**: `frontend/src/components/panels/QuestionTemplatePanel.tsx`, `backend/tests/question-template-assessment-mode.test.cjs`.
- **What**: The question template model supported Balvatika assessment modes (`written`, `observed`, `both`), but the question bank authoring UI provided no way to view or filter by mode:
  - The Question Template table lacked a `Mode` column, leaving authors unable to distinguish between observational checklist items and written test questions.
  - The filter toolbar only offered Level, Skill, and Tag filters, preventing authors from isolating observed tasks.
  - Legacy question templates stored without an explicit `assessmentMode` field risked displaying blank badges or breaking filtering logic.
- **Why it matters**: Balvatika (Stage 3, ages 5–6) relies heavily on oral and observed evaluation (e.g., counting physical objects). Superadmins authoring foundational numeracy papers could not verify whether questions were printable written problems or observational tasks.
- **Status**: **Resolved in merged PR #711**.

### Gap 4: Full-Collection Overwrites in Data Persistence
- **Location**: `backend/src/db.ts` (`persistCollection`, lines 1497–1508; `save`, lines 1492–1495).
- **What**: Data mutations in `DBStore` write collections in bulk. When connected to MongoDB, `persistCollection(key)` executes a `deleteMany({})` followed by `insertMany(items)` for the entire in-memory collection array. In local file-storage mode, `save()` rewrites the entire `db.json` file.
- **Why it matters**: Under concurrent write requests, non-atomic full-collection deletion and reinsertion introduces a potential risk of race conditions and subsequent data loss in shared collections unless operations are serialized.
- **Status**: **Open architectural issue**.

### Gap 5: Source-Text Pattern Matching in Integration Test Suites
- **Location**: `backend/tests/*.test.cjs` (e.g. `tests/question-template-assessment-mode.test.cjs`, `tests/panel-isolation.test.cjs`).
- **What**: Certain test suites in the backend verify frontend React components and route behaviors by reading `.tsx` and `.ts` files with `fs.readFileSync` and matching regular expressions against source code strings (`readSource(PANEL_SOURCE)`), rather than mounting components or executing full DOM/HTTP integration tests.
- **Why it matters**: While effective for fast syntax and fallback checks, static regex assertions represent a limitation of the current testing approach: they can be fragile to benign code formatting changes and do not evaluate runtime React lifecycle execution or user event handling, presenting an opportunity for future test suite enhancement.
- **Status**: **Open testing issue**.

---

## 5. Ideas and Possible Improvements Linked to Gaps

### Idea 1: Introduce Granular Upsert Operations in DBStore (Addresses Gap 4)

- **What**: Refactor collection mutation paths in `backend/src/db.ts` to replace full collection `deleteMany + insertMany` passes with targeted document operations (e.g., `replaceOne({ id }, doc, { upsert: true })` or atomic update operators) for entities with stable IDs.
- **Why**: Eliminates overwrite races during concurrent operations and reduces unnecessary database I/O.
- **Implementation**: Introduce an internal upsert helper in `DBStore` and update entity mutation methods (`updateStudent`, `updateWorksheet`, `updateCertification`) to persist individual documents.

### Idea 2: Transition Frontend Component Assertions to DOM-Based Tests (Addresses Gap 5)

- **What**: Expand the `@fln/frontend` Vitest suite with React Testing Library to test panel components through rendered DOM outputs rather than static file regex checks.
- **Why**: Ensures component state, user events, and rendered JSX are tested against actual browser DOM semantics while remaining resilient to benign code formatting changes.
- **Implementation**: Add `@testing-library/react` suites for key panels such as `QuestionTemplatePanel.tsx` in `frontend/src/`.

### Idea 3: Centralize Core Domain Constants in a Shared Package

- **What**: Extract shared constants—including curriculum level bounds (109 levels), certification thresholds (`currentLevel >= 5`), score bands (`80/60`), and assessment modes (`written | observed | both`)—into a shared workspace package consumed by both frontend and backend.
- **Why**: Prevents constant duplication across workspaces and ensures that server-side validation rules and client-side presentation badges remain synchronized.
- **Implementation**: Introduce a shared package or directory in the monorepo exporting typed constants for import by `@fln/backend` and `@fln/frontend`.

---

## 6. My Contributions and Merged PRs

### PR #799 — CSV Export Safety and Consistency

- **Pull Request**: [PR #799](https://github.com/vicharanashala/fln/pull/799) — Fix/747 safe csv exports clean
- **Merged On**: October 12, 2026

#### Problem Addressed
Client-side CSV exports across the application suffered from security and formatting limitations:
1. **Spreadsheet Formula Injection**: Unescaped leading formula characters (`=`, `+`, `-`, `@`, `\t`, `\r`) could allow spreadsheet formula execution when exported CSV files were opened in Microsoft Excel.
2. **Missing and Unaligned Data**: In generic table exports, columns utilizing custom JSX renderers (such as student IDs, level badges, or status pills) defaulted to empty strings in CSV output because accessors were not scalar values.
3. **Encoding & Formatting Inconsistencies**: Exports lacked UTF-8 Byte Order Marks (`\uFEFF`), causing non-ASCII and Devanagari text (e.g., `आरव शर्मा`) to open with garbled characters in Excel. Files also used Unix LF line endings instead of standard RFC 4180 CRLF (`\r\n`).

#### Technical Changes & Implementation
- **Shared CSV Utilities (`frontend/src/utils/csv.ts`)**:
  - `csvCell(value)`: Neutralizes formula injection by prefixing a single quote (`'`) to strings starting with `=, +, -, @, \t, \r`. Escapes internal double quotes (`""`) and wraps values in double quotes.
  - `buildCsv(headers, rows)`: Formats 2D arrays into RFC 4180-compliant CSV text with `\r\n` line endings.
  - `downloadCsv(filename, csv)`: Triggers a browser download using a `text/csv;charset=utf-8;` Blob prepended with UTF-8 BOM (`\uFEFF`), cleaning up object URLs after invocation.
- **Table Export Value Handler (`frontend/src/components/Table.tsx`)**:
  - Extended `Column<T>` with an optional `exportValue?: (row: T) => string | number` function.
  - Updated `handleExportCSV` and extracted `extractTableRows` to prioritize `exportValue` over raw accessor results.
- **Component Export Alignment**:
  - `TeacherDashboard.tsx` & `VolunteerDashboard.tsx`: Added `exportValue` mappings for `ID`, `Current Level`, `Target Level`, and `Diagnostic Status`.
  - `SuperadminDashboard.tsx`: Formatted role tiers and scoped geographic node hierarchies into explicit export strings.
  - `StudentListPanel.tsx` & `LogbookView.tsx`: Refactored CSV generation to use `buildCsv` and `downloadCsv` via extracted row mapping helpers (`extractInvalidStudentRows`, `extractLogbookRows`).
  - `CertificationReviewPanel.tsx` & `PanelShared.tsx`: Added `exportValue` accessors for student names, versions, and review statuses.

#### Testing Performed & Verification
- Authored 12 unit tests in `frontend/src/utils/csv.test.ts` covering formula injection neutralization (`=HYPERLINK`, `+cmd`, `@SUM`), quote escaping, Devanagari Unicode preservation, CRLF line delimiters, UTF-8 BOM byte generation (`0xEF, 0xBB, 0xBF`), and table/logbook row extraction helpers.
- Verified test suite passes: `npx --prefix frontend vitest run src/utils/csv.test.ts` (12/12 passing).

#### System Impact
Hardened CSV downloads against formula injection, ensured reliable Devanagari text display in Excel, and corrected blank cell anomalies in student roster and audit exports.

---

### PR #798 — Aadhaar Vault Configuration and Startup Diagnostics

- **Pull Request**: [PR #798](https://github.com/vicharanashala/fln/pull/798) — fix: document vault configuration and log missing settings (#744)
- **Merged On**: October 12, 2026

#### Problem Addressed
The Aadhaar tokenization vault enforces strict cryptographic and transactional prerequisites:
1. Tokenization requires a base64-encoded `LOCAL_DEV_MASTER_KEY` (≥ 32 decoded bytes) and a MongoDB replica set supporting multi-document transactions.
2. In production (`NODE_ENV=production`), `LocalDevKeyManager` refuses to construct unless `VAULT_ALLOW_UNSAFE_KEY_PROVIDER=true` is explicitly set to acknowledge the risk of running an unsafe local key provider where the master key lives in process environment variables (rather than a proper KMS provider). Setting this flag acknowledges the insecure configuration but is not a recommended production practice.
3. These configuration settings were undocumented in `backend/.env.example` and `README.md`.
4. The server previously initialized without validating vault settings, causing student registration (`POST /api/students`) and bulk roster imports to fail with runtime `VaultError NOT_CONFIGURED` (503).

#### Technical Changes & Implementation
- **Startup Diagnostics (`backend/src/index.ts`)**:
  - Implemented `checkVaultConfig(env, logger)` to inspect `LOCAL_DEV_MASTER_KEY` and verify production key provider settings at startup.
  - Emitted informative `[vault]` warnings without terminating the process or exposing secret values.
  - Preserved strict **fail-closed security**: startup diagnostics do not introduce plaintext fallbacks or bypass cryptographic tokenization. Tokenization calls still require valid vault configuration.
  - Guarded `startServer()` with an `isDirectRun` check, allowing test files to import `checkVaultConfig` without starting background server listeners.
- **Documentation & Configuration**:
  - Documented MongoDB replica set transaction requirements, base64 key generation (`openssl rand -base64 32`), and key provider security implications in `README.md` and `backend/.env.example`.
  - Added `"test:vault-config": "tsx --test tests/vault-config.test.ts"` in `backend/package.json`.

#### Testing Performed & Verification
- Authored 10 tests in `backend/tests/vault-config.test.ts` validating missing and whitespace key detection, production flag requirements, zero false-positive warnings in valid environments, and secret masking in log outputs.
- Verified test suite passes: `npm run test:vault-config` in `backend` (10/10 passing).

#### System Impact
Provides early diagnostic feedback during server boot for misconfigured environments, reducing troubleshooting time during onboarding while maintaining Aadhaar encryption safeguards.

---

### PR #711 — Assessment Mode in Question Templates

- **Pull Request**: [PR #711](https://github.com/vicharanashala/fln/pull/711) — fix: show assessment mode in question templates
- **Merged On**: October 8, 2026

#### Problem Addressed
Foundational numeracy in Balvatika (Stage 3) incorporates both paper-based and observational items. While the backend schema supported `assessmentMode` (`'written' | 'observed' | 'both'`), the superadmin Question Template authoring panel lacked UI visibility and filtering for assessment modes. Legacy question templates created prior to the field also required backward-compatible handling.

#### Technical Changes & Implementation
- **Authoring Panel UI (`frontend/src/components/panels/QuestionTemplatePanel.tsx`)**:
  - Added a `Mode` column displaying assessment modes in styled badges with a nullish fallback to `'written'` (`t.assessmentMode ?? 'written'`).
  - Added a mode filter dropdown (`aria-label="Filter by mode"`) supporting `All modes`, `written`, `observed`, and `both`.
  - Integrated mode filtering into `visibleTemplates` using the legacy fallback:
    ```tsx
    (filterMode === '' || (t.assessmentMode ?? 'written') === filterMode)
    ```
- **Regression Test Coverage (`backend/tests/question-template-assessment-mode.test.cjs`)**:
  - Added assertions verifying table header rendering, mode filter options, and the `'written'` fallback expression in the panel source.

#### Testing Performed & Verification
- Ran regression test suite: `node backend/tests/question-template-assessment-mode.test.cjs` (8/8 passing).

#### System Impact
Enables curriculum authors to view and filter question templates by assessment mode, ensuring appropriate selection of written versus observed tasks when designing Balvatika assessments.

---

## Summary of Contributions

| PR Number | Title / Area | Primary Files Changed | Key Impact |
|---|---|---|---|
| [PR #799](https://github.com/vicharanashala/fln/pull/799) | CSV export safety and consistency | `frontend/src/utils/csv.ts`, `frontend/src/utils/csv.test.ts`, `frontend/src/components/Table.tsx`, `StudentListPanel.tsx`, `LogbookView.tsx`, `TeacherDashboard.tsx`, `VolunteerDashboard.tsx`, `SuperadminDashboard.tsx` | Neutralized formula injection, added UTF-8 BOM and CRLF formatting, and resolved missing ID/level data in exports. |
| [PR #798](https://github.com/vicharanashala/fln/pull/798) | Aadhaar Vault configuration and diagnostics | `backend/src/index.ts`, `backend/tests/vault-config.test.ts`, `README.md`, `backend/.env.example`, `backend/package.json` | Added non-fatal startup diagnostics, documented replica-set and master-key setup, and added regression test suite. |
| [PR #711](https://github.com/vicharanashala/fln/pull/711) | Assessment mode in question templates | `frontend/src/components/panels/QuestionTemplatePanel.tsx`, `backend/tests/question-template-assessment-mode.test.cjs` | Added Mode column and filter with backward-compatible `'written'` fallback for legacy question templates. |

---

*Document updated and verified against the FLN repository. All file paths, code changes, and test executions reflect verified source implementations.*
