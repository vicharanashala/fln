# Onboarding Document — Hemanjani Harika Kutani

**Contributor:** Hemanjani Harika Kutani (GitHub: `hemanjaniharika`)
**Parent repository:** [vicharanashala/fln](https://github.com/vicharanashala/fln)
**My fork:** [hemanjaniharika/fln](https://github.com/hemanjaniharika/fln)
**Intended first coding contribution:** Issue #598 — "Fix stale questionFamily type in QuestionTemplatePanel (only covers 2 of 10 valid families)"

**How this document was prepared.** I read the code in a fresh clone of the parent repository. Its `main` branch was at commit `fcb8324` (PR #569). All file paths and line numbers below refer to that commit. Issue and PR states were read from their GitHub pages. I did not run the app, the build, or any tests while preparing this document; everything here comes from reading code and GitHub pages.

---

## 1. What is FLN?

FLN stands for Foundational Literacy and Numeracy. Based on the project's own README and SRS documents, this repository focuses on the numeracy (maths) side of FLN, aligned with India's NIPUN Bharat and NCF-FS 2022 guidelines.

It is designed for foundational learning in the Indian school-education context, particularly for young children and the teachers, volunteers, and education administrators supporting them. From the code, the people it serves are young children roughly from pre-school age up to Class 4, along with the teachers, volunteers, and school/district/state admins who support them.

The problem this project is designed to address is the difficulty of identifying which maths concepts a child needs help with, providing practice matched to their level, and tracking progress. The repository is intended to support this process by:

- giving a child a diagnostic test to estimate their current level (`backend/src/routes/students.ts`, `POST /api/students/:id/diagnostic/submit`),
- generating a personalised paper worksheet for that level (`backend/src/paperGenerator.ts`, `backend/src/routes/worksheets.ts`),
- letting a teacher scan the completed worksheet so it can be checked using OCR and an AI model (`backend/src/routes/evaluation.ts`, `backend/src/gemini.ts`),
- tracking a child's level over time and showing this on dashboards (`frontend/src/components/dashboards/`),
- and issuing a certification once a child has shown enough mastery for their class (`backend/src/services/certificationEligibility.ts`).

So FLN, as implemented here, is not a general school-management app. It is specifically an assessment and personalised-worksheet platform built around one subject: foundational maths.

---

## 2. What do you understand by FLN (as a system)?

Reading through the code, FLN is a hierarchy of people plus a pipeline of data that flows between them.

**People / roles** (from `backend/src/db.ts`, `UserRole` enum): `superadmin`, `admin`, `district_admin`, `block_admin`, `school`, `teacher`, `volunteer`. A `Student` is a separate kind of record, not a login role in the same enum.

**How they are connected:**
- A `School` belongs to a state/district/block.
- A `ClassGroup` (e.g. "Class 3, Section A") belongs to one school and has one teacher.
- A `Student` belongs to one school, optionally one teacher, and one class/section.
- A `teacher`/`school` user can only access students in their own school (`backend/src/auth.ts`, `canAccessStudent()`), a `volunteer` can access students in the schools assigned to them, and the higher admin roles can currently access everything (more on this in Section 4).

**The curriculum backbone:** `backend/src/config/curriculumMap.ts` defines 109 numbered levels (Level 1 to Level 109), each tied to a concept ID like `S3.6` and a curriculum stage such as Balvatika or Class 1–4. Almost everything else in the system points back to one of these level numbers.

**The main data flow, as I understood it from the routes:**
1. A student is registered under a school/class (`backend/src/routes/students.ts`).
2. The student takes a diagnostic test, which produces a `recommendedLevel` for them.
3. Based on that level, a personalised worksheet is generated (`backend/src/routes/worksheets.ts`).
4. The child fills the paper worksheet, the teacher scans it, and the backend runs OCR/ICR checks plus a Gemini AI call to evaluate the answers, producing an `EvaluationReport`.
5. Over time, if a student meets the competency requirements for their class/level, a `Certification` record is created and can be reviewed (`backend/src/routes/certification.ts`).
6. Teachers/schools/admins see all of this through role-specific dashboards on the frontend.

**Questions vs question templates:** these are two separate layers. A `QuestionTemplate` (with `QuestionLogic`/`QuestionOption` building blocks) is the authoring side — a parameterised recipe for generating questions. A `Question`/`QuestionBankEntry` is the actual generated/seeded question tied to a specific level. I am being careful here not to assume that a question template existing for a level means a full worksheet can automatically be produced from it — I only treat that as true where I can see it wired end-to-end in the code.

My overall understanding is that FLN is a fairly complete assessment-to-report pipeline for one subject, with the level system as the thread tying diagnostics, worksheets, evaluation, and certification together.

---

## 3. Current State of the Repository — What Has Been Done So Far

This section describes only what I verified directly in the code at commit `fcb8324` on the `main` branch of `vicharanashala/fln`.

**Tech stack.** Frontend: React 19, React Router 7, Vite 6, Tailwind CSS 4, TypeScript, `i18next`, Vitest (`frontend/package.json`). Backend: Node.js + TypeScript, Express 4, and the native MongoDB driver (`backend/src/db.ts`). If `MONGODB_URI` is missing or unreachable, the backend automatically falls back to a local JSON file database at `data/db.json` (`backend/src/db.ts`, `connectDB()`). Auth is JWT + bcrypt (`backend/src/auth.ts`). AI evaluation uses Google Gemini through `@google/genai` (`backend/src/gemini.ts`), with a separate Python-based pipeline in `ai-services/` also calling Gemini. I could not find any Dockerfile, docker-compose file, or other deployment configuration anywhere in the repository.

**Repository structure.** It is an npm-workspaces monorepo with three workspaces: `frontend`, `backend`, and `backend/fln-backend`. These last two are not the same thing — `backend/src` is the real, full API used by the app, while `backend/fln-backend` is a separate, smaller Express+Puppeteer service that only batch-renders worksheets by driving a browser page headlessly. Its own README states the copy of `app/index.html` it ships with is partial, and I confirmed this: the `GENERATORS` object is empty (`backend/fln-backend/app/index.html:968`) and only 59 of the 109 levels are present. So this sub-service cannot currently generate real worksheets as shipped.

**Frontend architecture.** Data fetching uses a small hand-written `fetch` wrapper (`frontend/src/services/apiClient.ts`) that attaches the JWT from `localStorage` and logs the user out on a 401. Each dashboard panel fetches its own data through a shared hook (`frontend/src/components/panels/usePanelData.ts`).

**Backend architecture.** `backend/src/index.ts` is the single entry point. It connects to the database, validates the curriculum prerequisite graph at startup, registers 27 route files under `backend/src/routes/`, and either mounts Vite's dev middleware or serves the built frontend as static files, from the same Express process.

**Database / data layer.** Main collections are defined as TypeScript interfaces in `backend/src/db.ts`, including `User`, `School`, `ClassGroup`, `Student`, `Question`, `Worksheet`, `AnswerSubmission`, `EvaluationReport`, `CompetencyRequirement`, `Certification`, `QuestionTemplate`, and `CurriculumLevel`.

**Authentication / security.** JWT-based login with bcrypt password hashing. A separate "Aadhaar Vault" module (`backend/src/modules/vault/`) tokenises Aadhaar numbers using AES-GCM encryption instead of storing them as plain text, with its own MFA step-up approval flow before an admin can reveal a student's Aadhaar.

**Dashboards.** Role-specific dashboards exist for Superadmin, Admin, School, Teacher, and Volunteer (`frontend/src/components/dashboards/`), along with 29 panel components (`frontend/src/components/panels/`) covering student rosters, question bank management, curriculum levels, worksheets, certificates, and Aadhaar reveal.

**Assessments / diagnostics.** Diagnostic testing is implemented, both for a single student (`frontend/src/components/DiagnosticWorkflow.tsx`) and in bulk (`frontend/src/components/BulkDiagnosticWorkflow.tsx`, `backend/src/routes/diagnosticBulk.ts`).

**Question / question-template system.** Implemented as a layered system: `QuestionTemplate`/`QuestionLogic`/`QuestionOption` for authoring, and `Question`/`QuestionBankEntry` for the actual generated content, each with its own route file under `backend/src/routes/`.

**Worksheet generation.** Implemented in the main backend using Puppeteer and `pdf-lib` (`backend/src/paperGenerator.ts`, `backend/src/worksheetRenderer.ts`), with routes to generate single or batch level PDFs.

**AI / OCR / evaluation services.** `backend/src/scanQuality.ts` checks scan quality; PDF pages are rasterised by a Python subprocess (`ai-services/scripts/pdf_rasterize.py`, called from `backend/src/routes/evaluation.ts`); answers are then evaluated using Gemini. There is also a misconception-clustering feature (`backend/src/misconceptionFingerprint.ts`) that groups students by how they got questions wrong rather than just their score, and is explicitly read-only in the code.

**Certification / reporting.** Certification eligibility is checked against `CompetencyRequirement` records per class/level/topic, producing a `Certification` with a status of `active`, `review_needed`, or `revoked`, reviewable through `backend/src/routes/certification.ts`. Analytics endpoints exist for both regular and superadmin views.

**Other implemented functionality.** Support tickets, a teacher logbook, an intervention-tracking feature, and a best-practices repository each have their own backend route file and frontend component(s).

---

## 4. Gaps Observed in the Code

### Gap: Old "93 level" ceiling still hardcoded in several UI spots

**Where:** `frontend/src/components/panels/DiagnosticTestPanel.tsx:196`, `frontend/src/components/dashboards/FLNLevelReference.tsx:133`, `frontend/src/components/SuperAdminExecutiveDashboard.tsx:466` (`Array.from({ length: 93 }, ...)`), and `Math.min(93, ...)` caps in `frontend/src/components/DiagnosticWorkflow.tsx:313`, `frontend/src/components/panels/StudentProfilePanel.tsx:432`, `frontend/src/components/IcrScanner.tsx:2175`.

**What:** The curriculum moved from 93 levels to 109 levels (`backend/src/config/curriculumMap.ts` has 109 entries), and an earlier PR (#569, closing issue #542) already fixed most dashboards. These specific spots still say "93" or literally cap values at 93. The `SuperAdminExecutiveDashboard.tsx` dropdown only builds 93 `<option>` rows, so levels 94–109 are not selectable there at all.

**Why it matters:** This is not just a wrong label. The `Math.min(93, ...)` calls actively clamp a genuine "next level" recommendation above 93 down to "Level 93", which is incorrect information shown to a teacher or student. At the inspected commit, this was tracked in the repository under issue #570, which I am citing here only as evidence that the gap was real, not as an issue I am claiming for myself. Three PRs referencing #570 were open and unmerged when I checked — #607, #609, and #611 — so this gap may already be in progress or resolved by the time this document is reviewed.

### Gap: conceptMastery thresholds don't match the current class ranges

**Where:** `backend/src/routes/students.ts:1136-1140` (the `conceptMastery` object, thresholds such as `'Fractions': recommendedLevel >= 35 ? 'Strong' : 'Needs Practice'`); `backend/src/db.ts:1846-1851` (`classLevelRange`).

**What:** These thresholds top out at 35. But `classLevelRange` currently defines Class 2 as levels 60–76, Class 3 as 77–90, and Class 4 as 91–108. So for basically any Class 2, 3, or 4 student, `recommendedLevel` is already above every one of these thresholds.

**Why it matters:** A student's diagnostic result can show "Strong" on a topic almost regardless of actual performance once `recommendedLevel` clears the fixed thresholds, which misleads the teacher about the child's real ability. This matches issue #577, which was open when I checked, cited here only as corroborating evidence.

### Gap: The level-notation drift checker script is itself out of date

**Where:** `scripts/check-level-notation-drift.ts`, `Research/fln_L_to_S_crosswalk.json`, referenced in the comment at `frontend/src/data/skillProgressionMap.ts:415-422`.

**What:** This script exists to catch drift between the two ways the project numbers levels (S-code and L-number). The comment in `skillProgressionMap.ts` states that the reference file (`fln_L_to_S_crosswalk.json`) this script checks against was never updated when the curriculum grew from 93 to 109 levels, so the check is now comparing against outdated data.

**Why it matters:** A safety check meant to prevent silent curriculum-numbering drift cannot currently do its job. This shows up repeatedly in the repository's own automated "Repo Health Check" bot issues (for example #554, #555, #556).

### Gap: Higher admin roles have no geographic access scoping

**Where:** `backend/src/auth.ts`, `canAccessStudent()`.

**What:** For `school`, `teacher`, and `volunteer` roles, access to a student is checked against their `schoolId`/`assignedSchools`. For `superadmin`, `admin`, `district_admin`, and `block_admin`, the function returns `true` for every student, with no check against their state/district/block at all.

**Why it matters:** As written, a `district_admin` for one district can access and act on students in a completely different district or state. The code comment itself calls this a "separate, tracked fix," so it is a known gap, but it remains a real access-control weakness as the platform grows to more regions.

### Gap: No CI workflow runs tests or a build on pull requests

**Where:** `.github/workflows/` (`pr-gate-check.yml`, `parikshak-stale-check.yml`, `duplicate-question-check.yml`, `repo-health-check.yml`).

**What:** `pr-gate-check.yml` only posts an automated review comment; it does not run `npm test` or `npm run build`. `duplicate-question-check.yml` only runs on a narrow set of file paths. `repo-health-check.yml`, which does run `tsc --noEmit` and the drift checker, only runs on a schedule and on pushes to `main`, not on pull requests before merge.

**Why it matters:** A broken build or failing test can reach `main` and only be caught afterwards by the scheduled health check — which appears to be exactly what happened around issues #554–#556. Contributors also cannot rely on "CI is green" as proof a PR actually builds or passes tests; this has to be checked manually.

---

## 5. Ideas for the Project

The items below are ideas I am proposing based on the gaps in Section 4. None of them have been approved, scoped, or scheduled by the maintainers, and I have not started implementing any of them.

### Idea: Audit the frontend for remaining curriculum-count assumptions

**What:** Audit the frontend for any remaining curriculum-count or level-range assumptions after the 109-level migration.

**Why:** The repository has already undergone several changes from the old 93-level curriculum, so remaining assumptions can cause incorrect displays or behaviour.

**How:** Search for hardcoded level counts and compare each occurrence against the current curriculum data, then update only the locations that are still inconsistent.

### Idea: Scale conceptMastery thresholds with the student's class

**What:** Make `conceptMastery` thresholds scale with the student's class instead of using four fixed numbers.

**Why:** This would address the scoring issue described in #577, where the fixed thresholds no longer line up with the current class-level ranges, so a student's score can be marked "Strong" even when it sits low in their class's range.

**How:** In `backend/src/routes/students.ts`, replace the fixed thresholds with something derived from `DBStore.classLevelRange(classNumber)` in `backend/src/db.ts` — for example, a percentage of the student's class range rather than a fixed level number, so the thresholds would adjust automatically if the level ranges change again in future.

### Idea: Regenerate the level-notation crosswalk and wire the drift checker into CI

**What:** Regenerate `Research/fln_L_to_S_crosswalk.json` from the current 109-level data in `frontend/src/data/skillProgressionMap.ts`, and add `npm run check:level-notation-drift` as a CI step.

**Why:** This would close the gap where the drift checker itself is stale, and could stop the recurring "drift found" health-check issues from being reported without the underlying cause being fixed.

**How:** Write a script that walks `LEVEL_SKILL_MAP` and writes a fresh `L_to_S` mapping into `fln_L_to_S_crosswalk.json`, matching the shape `scripts/check-level-notation-drift.ts` already expects, then add that check to a pull-request-triggered workflow.

### Idea: Add geographic scoping to admin-tier access checks

**What:** Extend `canAccessStudent()` in `backend/src/auth.ts` to check `district_admin`/`block_admin` against the student's `districtCode`/`blockCode`, the same way `teacher`/`school` are already checked against `schoolId`.

**Why:** This is exactly the gap the existing code comment flags as a known, separately-tracked fix, and it would matter more as more states/districts are onboarded.

**How:** Add `districtCode`/`blockCode` fields to the relevant `User` records if not already present, and add matching `case` branches in `canAccessStudent()` that compare those fields against the student's school's district/block instead of returning `true` unconditionally.

### Idea: Run the build and tests on every pull request

**What:** Add a minimal GitHub Actions workflow that runs `npm run build` and `npm test` (for both `frontend` and `backend`) on every pull request.

**Why:** This would give contributors an automated signal about build and test failures before a PR is merged, instead of relying mainly on scheduled health checks afterward.

**How:** Add a new workflow file under `.github/workflows/` triggered on `pull_request`, running `npm install`, `npm run build`, and the existing `npm test` scripts already defined in `backend/package.json` and `frontend/package.json`.

---

## 6. Your Contribution

The work I have done so far as part of onboarding has been the repository investigation and analysis documented here. I cloned and read through the actual `vicharanashala/fln` repository, rather than relying only on my fork or the documentation. I traced the routes, database schema, frontend structure, and existing GitHub issues directly in the code and used this investigation to identify and verify the gaps listed in Section 4.

I also checked my own fork (`hemanjaniharika/fln`) against the current state of the parent repository and found that my fork is behind the parent repository. For example, the parent repository contains the changes from PR #569, while my fork still contains some of the older 93-level references. Before starting any coding contribution, I will sync my fork with the current `main` branch of `vicharanashala/fln` so that I am not working from stale code.

During the issue investigation, I identified GitHub Issue #598 as a potential first coding contribution. The issue concerns a stale frontend `questionFamily` type in `frontend/src/components/panels/QuestionTemplatePanel.tsx`. The local frontend state represents only `'counting' | 'operation'`, while the backend's `QuestionFamily` definition in `backend/src/types/questionTemplateParams.ts` contains ten valid families: `counting`, `operation`, `shape`, `pattern`, `comparison`, `classification`, `sequencing`, `vocabulary`, `calendar`, and `reasoning`. I verified this mismatch directly in the code.

At the time I checked the GitHub activity for the issue, PR #610 had already been opened for Issue #598. I therefore did not start a duplicate implementation. I will confirm the next contribution with the maintainer/mentor before beginning coding.

At this stage, my completed contribution is the repository investigation, onboarding analysis, identification of concrete code gaps, and preparation of this onboarding document. No coding implementation or test results are being claimed here because they have not yet been completed.