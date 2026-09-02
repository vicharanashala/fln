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
- **`backend/`**: Node.js and Express.js REST API with optional MongoDB (mongodb driver) and local JSON-file fallback persistence, plus role-based JWT authentication.
- **`ai-services/`**: Python pipeline for TrOCR character recognition, OpenCV perspective correction, and LLM-assisted diagnostic evaluation.

### Implemented Features
1. **Role-Based Authentication & Navigation**: Server-side role resolution with JWT tokens, supporting Superadmin, Admin, Block Admin, School, Teacher, Volunteer, and Student views.
2. **Student & Cohort Management**: Database-backed single and bulk student registration with age validation, Aadhaar format checks, and school-scoping for teachers and volunteers.
3. **Paper Generation Engine**: Template-backed HTML/Puppeteer pipeline producing A4 printable worksheets equipped with QR identifiers, fiducial markers, and structured ROI bounding boxes.
4. **Evaluation & Verification Subsystem**: Multi-stage evaluation supporting rule-based scoring, OCR extraction, teacher override endpoints, and volunteer review drawers.
5. **Analytics & Role Dashboards**: Visual metrics tracking mastery transitions, regional performance dashboards, class-level aggregate metrics, and certification distances.
6. **Codebase Modularization**: Ongoing migration away from the legacy browser-side `localStorage` mock interceptor towards clean, modular Express controller routes and real MongoDB aggregation pipelines.

---

## 4. Gaps Observed in the Code

| # | File & Location | Gap / Issue | Impact & Risk |
|---|---|---|---|
| 1 | `ARCHITECTURE.md` (Lines 1–100) & `AUDIT.md` | Documentation still describes an app running on a client-side `localStorage` mock backend, whereas the real Express + MongoDB backend is now standard. | Misleads new contributors into making assumptions about mock data layers rather than building on the real API. |
| 2 | `frontend/src/views/RoleDashboards.tsx` | Legacy god-file contains thousands of lines of monolithic dashboard code, with remaining dashboard components requiring separation. | Decreases maintainability, causes merge conflicts, and slows down component testing. |
| 3 | `backend/src/routes/evaluation.ts` (Override Route) | The evaluation override endpoint (`PATCH /api/evaluation/:reportId/override`) updates test scores but does not recalculate downstream misconception fingerprints. | Results in inconsistent student mastery state and incorrect remedial worksheet recommendations. |
| 4 | `backend/src/routes/students.ts` & Schemas | Student Aadhaar identification lacks server-side field-level encryption and secure step-up detokenization before reaching storage. | Privacy compliance risk regarding student PII protection. |
| 5 | `backend/src/generators/` | Multiple question generators lack deterministic exclusion filters against repeated identical questions in a single assessment paper. | Risk of duplicate question generation on personalized student assessment sheets. |
| 6 | Past Pull Requests & Issues #36–#44 | Several legacy issues (#36 through #44) were partially merged or made redundant by subsequent backend refactors without being formally audited and closed. | Clutters issue tracker and obscures actual pending intern work. |

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
- **How**: Audit existing controller endpoints, Mongoose models, and React dashboard components, document findings, and update GitHub tracking issues.

---

## 6. My Contribution

For this onboarding contribution, I tackled **[Issue #341](https://github.com/vicharanashala/fln/issues/341)** (*Audit GitHub issues #36-44 against current code*) and paved the foundation for **[Issue #342](https://github.com/vicharanashala/fln/issues/342)** (*Re-scope remaining open dashboard issues as intern tasks*).

### Detailed Audit Report for GitHub Issues / PRs #36 – #44

| Issue/PR # | Title | Author | Status in Git | Codebase Audit Findings & Verification | Action Recommended |
|---|---|---|---|---|---|
| **#36** | `feat: student registration, management, and bulk upload with role-based access` | `yvarsha-crypto` | Closed (Unmerged) | **Verified Implemented**: Student Mongoose schemas, role-scoped routes (`/api/v2/students`), bulk XLSX parsing, and frontend views (`RegisterStudentView`, `BulkUploadView`) are fully functional in current `backend/` and `frontend/`. | **Closed / Settled**: Superseded by subsequent merged student modules. |
| **#37** | `feat: added database-backed SmartFLN paper generation and real TrOCR scanning pipeline` | `RahulPrsad` | Closed (Unmerged) | **Verified Implemented**: Core database paper generation and Python OCR service were merged into main development branch. | **Closed / Settled**: Superseded by PR #38 / active pipelines. |
| **#38** | `feat: implement end-to-end SmartFLN QR paper generation, ROI cropping, and TrOCR evaluation pipeline` | `RahulPrsad` | Open (PR) | **In Progress**: Full fiducial marker detection, perspective correction, and volunteer review queue. Requires 5GB storage for local TrOCR weights. | **Keep Open / Core Review**: Awaits final V0.1 release integration testing. |
| **#39** | `Update CHANGE_LOG.md and remove audit.md` | `AmanMehta22` | Closed (Unmerged) | **Verified Implemented**: Restructure from flat `mvp/` layout to `frontend/`, `backend/`, `ai-services/` monorepo is documented in `CHANGELOG.md`. | **Closed**: Structural changes already live. |
| **#40** | `feat: implement global dark mode support, fixed the broken dark mode` | `Crypticfr` | Closed (Unmerged) | **Verified Implemented**: Theme synchronization in `App.tsx`, localStorage persistence (`fln_dark_mode`), and global CSS overrides are live and working. | **Closed**: Feature verified in current frontend. |
| **#41** | `Improve audit documentation` | `AmanMehta22` | Closed (Unmerged) | **Verified**: Superseded by PR #43. | **Closed**: Duplicate doc update. |
| **#42** | `refactor(frontend): clean up Superadmin UI and improve dashboard visuals` | `ASpiderA-bot` | **Merged** | **Verified Merged**: Superadmin question bank removed from sidebar, numeric font-size classes added in `index.css`, dashboard metrics refined. | **Resolved & Merged**. |
| **#43** | `Update AUDIT.md` | `AmanMehta22` | **Merged** | **Verified Merged**: Updated `AUDIT.md` reflecting monorepo structure. | **Resolved & Merged**. |
| **#44** | `Fix essential changes in UI and accessibility` | `lakshya-aran` | **Merged** | **Verified Merged**: Font resizing (`A- A A+`) and notification bug fixes are present in current layout. | **Resolved & Merged**. |

---

### Re-Scoping Plan for Dashboard Intern Tasks (Issue #342)

Following the audit above, remaining open dashboard improvements should be partitioned into 3 modular, intern-ready tasks:

1. **Intern Task 1: Complete Dashboard Component Extraction from `RoleDashboards.tsx`**
   - *Scope*: Extract any remaining inline dashboard subcomponents into `frontend/src/components/dashboards/`.
   - *Benefit*: Reduces `RoleDashboards.tsx` file size and enables isolated unit testing.
2. **Intern Task 2: Standardize Role Dashboard Empty-State & Loading Indicators**
   - *Scope*: Add consistent skeleton loaders and empty-state placeholders for schools, classes, and pending evaluation reports across all 6 role views.
   - *Benefit*: Improves UX on slow network connections.
3. **Intern Task 3: Front-End Filter Persistence for Class Rosters**
   - *Scope*: Persist selected school/class/section filter state in session memory so teachers don't lose context upon navigating back from student detail views.
   - *Benefit*: Enhances teacher workflow efficiency during high-volume testing sessions.

---

### Contributor Signature
- **Name**: Mohammed Irfan
- **Date**: September 1, 2026
- **Repository**: [vicharanashala/fln](https://github.com/vicharanashala/fln)
