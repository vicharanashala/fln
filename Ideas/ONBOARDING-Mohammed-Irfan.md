# Contributor Onboarding — Mohammed Irfan

## 1. What is FLN?

**Foundational Literacy and Numeracy (FLN)** refers to a child's foundational ability to read with basic comprehension and perform elementary mathematical operations (such as number sense, counting, place value, addition, subtraction, and basic multiplication). It is the pedagogical cornerstone for primary education, typically targeting students from pre-school through Grade 3 (ages 3 to 9).

In India, large-scale educational assessments consistently reveal a significant learning gap: many children progress through grades without mastering foundational literacy and numeracy. Because all subsequent academic concepts build upon these core proficiencies, children lacking foundational skills face increasing cognitive strain, disengagement, and higher dropout rates.

Under the **National Education Policy (NEP) 2020** and the national **NIPUN Bharat Mission** (National Initiative for Proficiency in Reading with Understanding and Numeracy), universal FLN attainment by Grade 3 is established as an urgent national priority. The FLN platform aims to provide an open-source, scalable, and automated diagnostic evaluation ecosystem that empowers teachers, schools, and administrators to pinpoint each student's exact competency level, generate personalized adaptive assessments, and remediate learning deficits before students fall behind.

---

## 2. What do you understand by FLN (as a system)?

The FLN platform operates as a cohesive, role-based diagnostic and remediation ecosystem. It connects ground-level educational actors (teachers and volunteers) with administrative supervisors and automated AI evaluation pipelines.

### Primary User Roles & Hierarchy
1. **Superadmin (Vicharanashala Lab / Central Governance)**: Manages curriculum standards, 93-level progression frameworks, system-wide configurations, audit oversight, and high-level platform health.
2. **State & District Admins**: Supervise administrative units, monitor macro-level FLN transition metrics, school compliance, and regional equity across districts and blocks.
3. **Block Admin**: Manages schools within a specific block, coordinates volunteer allocations for low-connectivity or under-resourced schools, and generates assessments when needed.
4. **Teachers**: The primary operational users who manage classroom rosters, trigger assessment paper generation, administer tests, scan completed answer sheets, review borderline automated scores, and deliver targeted remediation.
5. **Volunteers**: Field facilitators supporting schools with limited technical infrastructure or bandwidth to conduct offline assessments and scanning.
6. **Students**: End beneficiaries possessing unique, trackable FLN profile records containing historical assessment data, concept mastery trajectories, and certification milestones.

### System Workflow & Data Flow
1. **Baseline / Periodic Assessment Generation**:
   - For fresh cohorts, standard grade-level benchmark assessments (Lakshyas) are generated.
   - For established cohorts with existing profiles, assessments are dynamically adapted to student mastery tiers while respecting grade-level competency qualifiers.
   - Assessments are rendered as standardized A4 PDF worksheets containing student QR codes, 4-corner fiducial alignment markers, and predefined Region of Interest (ROI) response boxes.
2. **Administration & Scanning**:
   - Students complete assessments on physical paper.
   - Teachers/volunteers capture answer sheets via smartphone camera or flatbed scanner.
3. **Automated Optical & AI Evaluation**:
   - The scanning subsystem detects fiducials, corrects perspective distortion, extracts ROIs, and decodes student metadata from the QR code.
   - Character/text answers are transcribed using TrOCR / Vision models, while objective and multi-choice items are verified against deterministic answer keys.
   - Low-confidence predictions and non-textual responses (drawings, matching) are routed to a human-in-the-loop volunteer/teacher review queue.
4. **Mastery Tracking & Certification Loop**:
   - Deterministic scoring updates the student's mastery matrix across the 93 FLN level nodes.
   - **Proficient Outcomes**: The student receives an official grade-level FLN qualification certificate and advances to subsequent curriculum milestones.
   - **Emerging / Developing Outcomes**: The system diagnoses specific concept misconceptions, flags prerequisite knowledge gaps, schedules a targeted re-assessment, and compiles personalized remedial practice worksheets.

---

## 3. Current State of the Repository — What Has Been Done So Far

The repository is structured as an **npm-workspaces monorepo** consisting of:
- **`frontend/`**: React 19 single-page application built with TypeScript, Tailwind CSS, Lucide icons, and Vite.
- **`backend/`**: Node.js and Express.js REST API; uses the MongoDB driver when `MONGODB_URI` is set, otherwise falls back to a local JSON file DB (`data/db.json` at repo root); role-based JWT authentication.
- **`ai-services/`**: Python pipeline for TrOCR character recognition, OpenCV perspective correction, and LLM-assisted diagnostic evaluation.

### Implemented Features
1. **Role-Based Authentication & Navigation**: Server-side role resolution with JWT tokens, supporting Superadmin, Admin, Block Admin, School, Teacher, Volunteer, and Student views.
2. **Student & Cohort Management**: Database-backed single and bulk student registration with age validation, Aadhaar format checks, and school-scoping for teachers and volunteers.
3. **Paper Generation Engine**: Template-backed HTML/Puppeteer pipeline producing A4 printable worksheets equipped with QR identifiers, fiducial markers, and structured ROI bounding boxes.
4. **Evaluation & Verification Subsystem**: Multi-stage evaluation supporting rule-based scoring, OCR extraction, teacher override endpoints, and volunteer review drawers.
5. **Analytics & Role Dashboards**: Visual metrics tracking mastery transitions, regional performance dashboards, class-level aggregate metrics, and certification distances.
6. **Codebase Modularization & API Layer**: The frontend communicates directly with the Express backend via `apiFetch()` (`frontend/src/services/apiClient.ts`) rather than any client-side mock interceptor. The backend operates on a flexible persistence model: it uses the native MongoDB driver when `MONGODB_URI` is configured, or automatically falls back to a local JSON database (`data/db.json` at repo root) for zero-dependency local development, with route handlers organized into modular Express controllers (`backend/src/routes/*.ts`).

---

## 4. Gaps Observed in the Code

| # | File & Location | Gap / Issue | Impact & Risk |
|---|---|---|---|
| 1 | `ARCHITECTURE.md` (Lines 1–100) & `AUDIT.md` | Documentation still describes an app running on a client-side `localStorage` mock backend, whereas the real Express backend supporting dual persistence (MongoDB when configured, local JSON file DB fallback) is now standard. *(Resolved in Issue #322 / PR #435)* | Misleads new contributors into making assumptions about mock data layers rather than building on the real API. |
| 2 | `frontend/src/components/RoleDashboards.tsx` | Legacy god-file contains monolithic dashboard orchestration code, with role-specific views and subpanels undergoing separation into `frontend/src/components/dashboards/` and `panels/`. *(Rescoped as intern tasks in Issue #342 / PR #417)* | Decreases maintainability, causes merge conflicts, and slows down component testing. |
| 3 | `backend/src/routes/evaluation.ts` (Override Route) | The evaluation override endpoint (`PATCH /api/evaluation/:reportId/override`) updates test scores but does not recalculate downstream misconception fingerprints. | Results in inconsistent student mastery state and incorrect remedial worksheet recommendations. |
| 4 | `backend/src/routes/students.ts` & Schemas | Student Aadhaar identification lacks server-side field-level encryption and secure step-up detokenization before reaching storage. | Privacy compliance risk regarding student PII protection. |
| 5 | `backend/src/levelGenerator.ts` & `frontend/public/worksheets/levels_main.html` | Multiple question generators lack deterministic exclusion filters against repeated identical questions in a single assessment paper. | Risk of duplicate question generation on personalized student assessment sheets. |
| 6 | Past Pull Requests & Issues #36–#44 | Several legacy issues (#36 through #44) were partially merged or made redundant by subsequent backend refactors without being formally audited and closed. *(Resolved in Issue #341 / PR #416)* | Clutters issue tracker and obscures actual pending intern work. |
| 7 | Curriculum Taxonomy & ID Nomenclature | Inconsistent level ID formats across modules (legacy 59-level `L1`-`L59` vs modern 93-level taxonomy with competing schemas: `L{N}`, `FLN{N}`, `FLN-NUM-{N}`, `G{grade}-M{milestone}`). *(Resolved in Issue #348 / PR #436)* | Incompatible question mapping, broken progression charts, and ambiguous API payloads. |

---

## 5. Ideas for the Project

### Idea 1: End-to-End Automated CI Quality Checks for Question Generators
- **What**: Implement a CI pipeline script that validates all 225+ question generator modules for duplicate-question collision risk and malformed SVG output.
- **Why**: Ensures that every dynamically synthesized paper meets rigorous quality standards before printing.
- **How**: Write an automated test suite in `backend/src/__tests__/generators.test.ts` running multi-iteration generation loops across all 93 level generators.

### Idea 2: Automated Downstream Misconception Re-computation on Teacher Override
- **What**: Trigger an automatic update of the concept mastery matrix and misconception fingerprint when a teacher overrides an OCR score.
- **Why**: Prevents stale diagnostic reports and ensures remediation worksheets match actual teacher-verified student ability.
- **How**: Connect the `PATCH /api/evaluation/:reportId/override` handler directly to the mastery calculation service.

### Idea 3: Audit & Re-scope Dashboard Issues into Modular Intern Tasks
- **What**: Conduct a codebase inspection of issues #36–#44 to verify what has been implemented and re-scope outstanding dashboard requirements into independent tasks.
- **Why**: Provides a clear roadmap for new open-source contributors and interns without conflicting with core architectural refactors.
- **How**: Audit existing controller endpoints, database models/dbStore collections, and React dashboard components, document findings, and update GitHub tracking issues.

---

## 6. My Contributions

During my onboarding, I identified, claimed, and successfully resolved **4 key issues** across the repository, spanning codebase audits, task re-scoping, architectural documentation, and curriculum taxonomy standardization:

| Issue # | Title | Pull Request | Key Deliverables & Artifacts | Status |
|---|---|---|---|---|
| **[#341](https://github.com/vicharanashala/fln/issues/341)** | Audit GitHub issues #36-44 against current code | [PR #416](https://github.com/vicharanashala/fln/pull/416) | Comprehensive audit report table; [Comment #341](https://github.com/vicharanashala/fln/issues/341#issuecomment-5491987298) | ✅ Resolved & Submitted |
| **[#342](https://github.com/vicharanashala/fln/issues/342)** | Re-scope remaining open dashboard issues as intern tasks | [PR #417](https://github.com/vicharanashala/fln/pull/417) | `docs/intern-dashboard-tasks.md`; [Comment #342](https://github.com/vicharanashala/fln/issues/342#issuecomment-5491992848) | ✅ Resolved & Submitted |
| **[#322](https://github.com/vicharanashala/fln/issues/322)** | Refresh ARCHITECTURE.md to match real backend/frontend split | [PR #435](https://github.com/vicharanashala/fln/pull/435) | Overhauled `ARCHITECTURE.md` with system Mermaid diagrams & invariants; [Comment #435](https://github.com/vicharanashala/fln/pull/435#issuecomment-5540269159) | ✅ Resolved & Submitted |
| **[#348](https://github.com/vicharanashala/fln/issues/348)** | Create canonical curriculum terminology and ID mapping document | [PR #436](https://github.com/vicharanashala/fln/pull/436) | Canonical `docs/curriculum-terminology-and-id-mapping.md` indexed in `docs/README.md` | ✅ Resolved & Submitted |

---

### Contribution 1: Comprehensive Codebase Audit of Issues/PRs #36–#44 (Issue #341)

- **Issue**: [Issue #341: Audit GitHub issues #36-44 against current code](https://github.com/vicharanashala/fln/issues/341)
- **Pull Request**: [PR #416](https://github.com/vicharanashala/fln/pull/416) (`audit/issue-341-audit-36-44`)
- **Key Deliverables**:
  - Systematic codebase audit inspecting backend Express routes (`backend/src/routes/*.ts`), MongoDB and JSON persistence layers (`backend/src/db.ts`, `data/db.json`), frontend React components (`frontend/src/components/`), and active Python OCR services.
  - Comprehensive findings comment posted to Issue #341 ([comment 5491987298](https://github.com/vicharanashala/fln/issues/341#issuecomment-5491987298)).
  - Peer review findings addressed and clean branch merged (`f3c003a0`).
- **Impact**: Classified which issues were already merged into the codebase (#42, #43, #44), which were superseded by recent architecture refactors (#36, #37, #39, #40, #41), and the concrete status of active work (#38), allowing maintainers to close stale issues safely.

#### Detailed Audit Report for GitHub Issues / PRs #36 – #44

| Issue/PR # | Title | Author | Status in Git | Codebase Audit Findings & Verification | Action Recommended |
|---|---|---|---|---|---|
| **#36** | `feat: student registration, management, and bulk upload with role-based access` | `yvarsha-crypto` | Closed (Unmerged) | **Verified Implemented**: Student document structure in `backend/src/db.ts`, role-scoped endpoints (`/api/students`, `/api/students/bulk-import` in `backend/src/routes/students.ts`) without Mongoose, and frontend student roster and diagnostic/bulk-import UI in `StudentListPanel.tsx` and `DiagnosticTestPanel.tsx` are live in the current codebase. | **Closed / Settled**: Superseded by subsequent merged student modules. |
| **#37** | `feat: added database-backed SmartFLN paper generation and real TrOCR scanning pipeline` | `RahulPrsad` | Closed (Unmerged) | **Verified Implemented**: Core database paper generation and Python OCR service were merged into main development branch. | **Closed / Settled**: Superseded by PR #38 / active pipelines. |
| **#38** | `feat: implement end-to-end SmartFLN QR paper generation, ROI cropping, and TrOCR evaluation pipeline` | `RahulPrsad` | Open (PR) | **In Progress**: Full fiducial marker detection, perspective correction, and volunteer review queue. Requires 5GB storage for local TrOCR weights. | **Keep Open / Core Review**: Awaits final V0.1 release integration testing. |
| **#39** | `Update CHANGE_LOG.md and remove audit.md` | `AmanMehta22` | Closed (Unmerged) | **Verified Implemented**: Restructure from flat `mvp/` layout to `frontend/`, `backend/`, `ai-services/` monorepo is documented in `CHANGELOG.md`. | **Closed**: Structural changes already live. |
| **#40** | `feat: implement global dark mode support, fixed the broken dark mode` | `Crypticfr` | Closed (Unmerged) | **Verified Implemented**: Theme synchronization in `App.tsx`, localStorage persistence (`fln_dark_mode`), and global CSS overrides are live and working. | **Closed**: Feature verified in current frontend. |
| **#41** | `Improve audit documentation` | `AmanMehta22` | Closed (Unmerged) | **Verified**: Superseded by PR #43. | **Closed**: Duplicate doc update. |
| **#42** | `refactor(frontend): clean up Superadmin UI and improve dashboard visuals` | `ASpiderA-bot` | **Merged** | **Verified Merged**: Superadmin question bank removed from sidebar, numeric font-size classes added in `index.css`, dashboard metrics refined. | **Resolved & Merged**. |
| **#43** | `Update AUDIT.md` | `AmanMehta22` | **Merged** | **Verified Merged**: Updated `AUDIT.md` reflecting monorepo structure. | **Resolved & Merged**. |
| **#44** | `Fix essential changes in UI and accessibility` | `lakshya-aran` | **Merged** | **Verified Merged**: Font resizing (`A- A A+`) and notification bug fixes are present in current layout. | **Resolved & Merged**. |

---

### Contribution 2: Re-Scoping Open Dashboard Issues as Structured Intern Tasks (Issue #342)

- **Issue**: [Issue #342: Re-scope remaining open dashboard issues as intern tasks](https://github.com/vicharanashala/fln/issues/342)
- **Pull Request**: [PR #417](https://github.com/vicharanashala/fln/pull/417) (`docs/rescope-dashboard-tasks-342`)
- **Key Deliverables**:
  - Authored the canonical task guide `docs/intern-dashboard-tasks.md`.
  - Comprehensive scoping comment posted to Issue #342 ([comment 5491992848](https://github.com/vicharanashala/fln/issues/342#issuecomment-5491992848)).
  - Addressed peer review feedback (`e013c08a`), refining task dependencies, boundary conditions, and manual verification scripts.
- **Impact**: Formulated 3 self-contained, bite-sized tasks tailored for incoming interns with clear touchpoint files, prerequisites, detailed acceptance criteria, and step-by-step verification commands:
  1. **Intern Task 1: Complete Dashboard Component Extraction from `RoleDashboards.tsx`**
     - *Scope*: Extract remaining inline subcomponents into `frontend/src/components/dashboards/`.
     - *Benefit*: Reduces `RoleDashboards.tsx` file size, eliminates monolithic anti-patterns, and enables isolated unit testing.
  2. **Intern Task 2: Standardize Role Dashboard Empty-State & Loading Indicators**
     - *Scope*: Add consistent skeleton loaders and empty-state placeholders for schools, classes, and pending evaluation reports across all 6 role views.
     - *Benefit*: Improves UX responsiveness on slow or intermittent network connections.
  3. **Intern Task 3: Front-End Filter Persistence for Class Rosters**
     - *Scope*: Persist selected school/class/section filter state in session memory so teachers don't lose context upon navigating back from student detail views.
     - *Benefit*: Enhances teacher workflow efficiency during high-volume testing sessions.

---

### Contribution 3: Refresh ARCHITECTURE.md to Reflect Real Backend/Frontend Split (Issue #322)

- **Issue**: [Issue #322: Refresh ARCHITECTURE.md to match real backend/frontend split](https://github.com/vicharanashala/fln/issues/322)
- **Pull Request**: [PR #435](https://github.com/vicharanashala/fln/pull/435) (`docs/refresh-architecture-split-322`)
- **Key Deliverables**:
  - Complete overhaul of `ARCHITECTURE.md` aligning documentation with modern monorepo reality.
  - Replaced legacy mock interceptor notes with 3 updated Mermaid diagrams: End-to-End System Architecture (React 19 SPA -> Vite Proxy -> Express :3000 -> dbStore / Puppeteer -> dual persistence MongoDB / `data/db.json` -> Python `ai-services/`), Role Hierarchy & Governance (Superadmin down to Student), and Closed-Loop Assessment & Evaluation Lifecycle.
  - Articulated 6 key architectural invariants including ADR 001 modular controllers, base-path aware routing (`apiFetch` and `withBase()` reading `import.meta.env.BASE_URL`), and server-authoritative JWT authentication.
  - Addressed PR review feedback ([review 5112475741](https://github.com/vicharanashala/fln/pull/435#pullrequestreview-5112475741)) in commit [`b1e216b4`](https://github.com/vicharanashala/fln/commit/b1e216b4), correcting local JSON DB fallback paths to `data/db.json` (repo root) and clarifying `withBase()`.
- **Impact**: Eliminates onboarding friction by ensuring all new contributors have an accurate, up-to-date mental model of the client/server boundary, persistence options, and AI evaluation pipeline.

---

### Contribution 4: Canonical Curriculum Terminology & ID Mapping Specification (Issue #348)

- **Issue**: [Issue #348: Create canonical curriculum terminology and ID mapping document](https://github.com/vicharanashala/fln/issues/348)
- **Pull Request**: [PR #436](https://github.com/vicharanashala/fln/pull/436) (`docs/curriculum-terminology-and-id-mapping-348`)
- **Key Deliverables**:
  - Authored canonical specification `docs/curriculum-terminology-and-id-mapping.md`, indexed in `docs/README.md`, commit [`c2793ffb`](https://github.com/vicharanashala/fln/commit/c2793ffb).
  - Formalized the 5-tier pedagogical hierarchy: Subject Domain -> Strand -> Substrand / Theme -> Skill Milestone / Competency Node (Level) -> Micro-Skill / Diagnostic Item.
  - Published the authoritative **Curriculum Crosswalk Table** mapping all 93 levels across 5 grades (Grade 1: Levels 1–21; Grade 2: Levels 22–45; Grade 3: Levels 46–65; Grade 4: Levels 66–80; Grade 5: Levels 81–93) with corresponding legacy IDs, canonical IDs (`FLN-NUM-001` .. `FLN-NUM-093`), short IDs (`L1` .. `L93`), milestone IDs (`G1-M01` .. `G5-M13`), and mathematical strands.
  - Established strict ID usage & serialization invariants across REST APIs (`/api/curriculum/*`), MongoDB collections (`dbStore`), and printed physical worksheet QR barcodes.
- **Impact**: Resolves conflicting level ID schemas across frontend, backend, and worksheets, providing an authoritative reference that eliminates ambiguity for future curriculum authoring and assessment workflows.

---

### Contributor Signature
- **Name**: Mohammed Irfan
- **GitHub**: [@MdIrfan325](https://github.com/MdIrfan325)
- **Date**: September 2026
- **Repository**: [vicharanashala/fln](https://github.com/vicharanashala/fln)
- **Resolved Contributions**: Issues #341, #342, #322, #348 (PRs #416, #417, #435, #436)
