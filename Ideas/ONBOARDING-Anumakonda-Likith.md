# FLN Contributor Onboarding

**Contributor:** Anumakonda Likith  
**Repository:** [vicharanashala/fln](https://github.com/vicharanashala/fln)  
**Fork:** [LIKITH-3012-MAC/fln](https://github.com/LIKITH-3012-MAC/fln)  
**Review date:** 14 November 2026  
**Source reviewed:** supplied FLN repository archive dated 6 November 2026

> **Review note:** File paths and line references below refer to the supplied 6 November snapshot, not a live checkout of upstream `main`. They must be rechecked against the latest `main` before submission. This is an AI-assisted working draft; I must verify the observations and rewrite them in my own words so I can explain them during review.

---

## 1. What is FLN?

FLN stands for **Foundational Literacy and Numeracy**. It is about helping children develop the basic reading and mathematics skills they need for later learning. In numeracy, these foundations include number sense, recognising patterns, understanding quantities and performing basic operations.

Children in the same grade can have different levels of understanding. A common test score may show that a child is struggling, but it may not identify the concept the child has not understood. If that gap is missed, later topics can become harder to learn.

The FLN platform is intended to help teachers identify a student's current learning level, assess the relevant foundational concepts, and use the evidence to decide what should be practised or assessed next. It connects student profiles, curriculum concepts, question/worksheet generation, paper-based assessment, scanning, evaluation and progress tracking.

The project name covers literacy and numeracy, but the repository README explicitly says that the **current software build assesses mathematics/numeracy only**. It does not currently evaluate reading or literacy. The reviewed README describes 109 curriculum levels, 24 skills and 183 subskills, with the current build order moving from Balvatika to Class 3; Class 4 is outside the current MVP and deferred to Tenali. A level existing in the curriculum map does not automatically mean that its full assessment flow is implemented end to end. See [`README.md` lines 1–9](../README.md#L1-L9), [56–68](../README.md#L56-L68) and [30–52](../README.md#L30-L52).

## 2. What do I understand by FLN as a system?

I understand FLN as a connected workflow for students, teachers and education administrators. It maintains school/class and student records, links questions to curriculum concepts, records written and teacher-observed evidence, evaluates submissions and makes progress information available to teachers.

### Users and main entities

The account roles in [`backend/src/identity.types.ts` lines 3–10](../backend/src/identity.types.ts#L3-L10) are Superadmin, Admin, District Admin, Block Admin, School, Teacher and Volunteer. The architecture describes these as a hierarchy from platform/state/district/block administration through school and classroom operations. A student is a domain record, not a role in the `UserRole` enum; the student profile is defined separately in [`backend/src/student.types.ts` lines 5–43](../backend/src/student.types.ts#L5-L43).

The main entities I identified are:

- **School and class:** school and class/section records in [`backend/src/identity.types.ts` lines 29–63](../backend/src/identity.types.ts#L29-L63).
- **Student profile:** school/class association, current and target levels, and level history in [`backend/src/student.types.ts` lines 5–26](../backend/src/student.types.ts#L5-L26).
- **Curriculum concept and question template:** a `QuestionTemplate` uses `conceptId` as its canonical identity; `levelNumber` and `levelName` are display fields. It also includes `assessmentMode` (`written`, `observed` or `both`) in [`backend/src/curriculum.types.ts` lines 119–147](../backend/src/curriculum.types.ts#L119-L147).
- **Worksheet and answer submission:** the paper generated for an assessment and the answers later submitted in [`backend/src/assessment.types.ts` lines 80–146](../backend/src/assessment.types.ts#L80-L146).
- **Teacher observation:** evidence a teacher records while watching a child perform an activity, in [`backend/src/assessment.types.ts` lines 149–198](../backend/src/assessment.types.ts#L149-L198).
- **Evaluation report and certification:** assessment outcomes and certification decisions in [`backend/src/evaluation.types.ts` lines 91–152](../backend/src/evaluation.types.ts#L91-L152) and [`backend/src/operations.types.ts` lines 5–42](../backend/src/operations.types.ts#L5-L42).

### High-level system flow

1. An authorised teacher selects a class or student.
2. The platform uses the student's profile and curriculum/question data to prepare a standard or personalised assessment.
3. The backend generates a printable worksheet or question paper.
4. The student completes the paper; the teacher may also record an observation for concepts that require it.
5. The teacher scans or uploads the completed work.
6. The backend processes the submission and stores evaluation evidence.
7. The result can inform the student's progress, follow-up practice, reassessment and certification decisions.

The product workflow is described in [`README.md` lines 81–107](../README.md#L81-L107); the architecture overview is in [`ARCHITECTURE.md` lines 9–87](../ARCHITECTURE.md#L9-L87), and the role hierarchy/assessment lifecycle is in [lines 91–145](../ARCHITECTURE.md#L91-L145).

## 3. Current State of the Repository — What Has Been Done So Far

The repository is an **npm-workspaces monorepo**. The root workspace contains `frontend`, `backend` and `backend/fln-backend`; `ai-services/` is a separate Python code area. See the root [`package.json`](../package.json) and [`README.md` lines 152–161](../README.md#L152-L161).

- **Frontend — `frontend/`:** React 19, Vite and Tailwind CSS. It contains the single-page application, role-specific dashboards and workflow panels. The shared API helper is `frontend/src/services/apiClient.ts`. See [`frontend/README.md` lines 1–16](../frontend/README.md#L1-L16).
- **Primary backend — `backend/`:** Node.js, Express and TypeScript. It contains the main API routes, authentication, domain types, assessment logic and data-access layer.
- **Database:** the primary backend uses the native MongoDB driver when `MONGODB_URI` is configured. It also has a local JSON-file fallback for individual development; the architecture documentation says not to treat that fallback as a concurrent shared database. See [`ARCHITECTURE.md` lines 48–53 and 81–87](../ARCHITECTURE.md#L48-L53).
- **Worksheet backend — `backend/fln-backend/`:** a separate JavaScript workspace for worksheet-related generation/rendering, distinct from the primary TypeScript API.
- **AI/document tools — `ai-services/`:** Python scripts for PDF processing and evaluation-related work. The integration boundary matters: `ai-services/README.md` says the normal backend invokes `scripts/pdf_rasterize.py`, but does not invoke `run_pipeline.py` or `personalized_evaluation_pipeline.py` in the normal backend request path. I should not describe all Python scripts as automatically connected production services. See [`ai-services/README.md` lines 3–18](../ai-services/README.md#L3-L18).

The reviewed codebase contains authentication and role/scope checks, student/school/class records, curriculum and question-template models, worksheet-generation paths, answer submissions, teacher observations, evaluation reports and certification logic. The Question Template panel also has an Assessment Mode field/filter/column in this snapshot; see [`QuestionTemplatePanel.tsx` around lines 950–996](../frontend/src/components/panels/QuestionTemplatePanel.tsx#L950-L996). The README and architecture describe the intended assessment-to-evaluation workflow, but the degree of end-to-end support varies by curriculum stage and feature.

## 4. Gaps Observed in the Code

These findings are from the supplied source snapshot. I must compare them with the latest upstream `main` before implementation because other contributors may have changed the same areas.

### Gap 1 — Certification orchestration is limited to Classes 2–4 and a fixed level key

- **Related issue:** [#837 — replace the hardcoded level 5 and Class 2–4 gate with Balvatika to Class 3](https://github.com/vicharanashala/fln/issues/837).
- **Where:** [`backend/src/services/certificationRecords.ts` lines 26–32 and 55–77](../backend/src/services/certificationRecords.ts#L26-L32); [`backend/src/data/competencyRequirements.seed.json` lines 1–123](../backend/src/data/competencyRequirements.seed.json#L1-L123); [`backend/src/operations.types.ts` lines 9–15](../backend/src/operations.types.ts#L9-L15).
- **What:** `parseClassNumber()` extracts digits from `student.classGroup`; a named value such as `Balvatika` becomes `0`. The service returns for values below 2 or above 4, then looks up requirements with a fixed level value of `5`. The seed file in this snapshot contains requirement rows for Classes 2, 3 and 4 at level 5, but none for Balvatika or Class 1.
- **Why it matters:** this certification path does not match the repository's current Balvatika-to-Class-3 build direction. Widening the numeric guard alone would not define the Balvatika key or supply approved requirement data.
- **Boundary:** class/stage identifiers, competency thresholds and Class 4 compatibility must come from the issue's acceptance criteria or an authorised curriculum decision. They must not be guessed.

### Gap 2 — A concept-level assessment-mode registry is absent from this snapshot

- **Related issue:** [#850 — add written / observed / both assessment mode for each concept](https://github.com/vicharanashala/fln/issues/850).
- **Where:** [`backend/src/curriculum.types.ts` lines 119–147](../backend/src/curriculum.types.ts#L119-L147); expected path `backend/src/config/assessmentMode.ts` (not present in the reviewed snapshot).
- **What:** individual `QuestionTemplate` records already support `assessmentMode`, but the separate concept-to-mode configuration requested by #850 is absent in this snapshot.
- **Why it matters:** the intended evidence method should be known for an in-scope concept even when a question template has not yet been authored.
- **Boundary:** the mode values are curriculum decisions, not guesses. Another contributor mentioned PR #877 for related assessment-mode work in the FLN group, so I must inspect that PR and the latest `main` before attempting this issue.

### Gap 3 — The SK13 Q-Matrix pilot file is provisional and is not loaded by the application

- **Related issue:** [#478 — D1.3 Q-Matrix](https://github.com/vicharanashala/fln/issues/478), with dependency [#354](https://github.com/vicharanashala/fln/issues/354).
- **Where:** [`backend/src/data/sk13PilotQuestions.seed.json` lines 1–24](../backend/src/data/sk13PilotQuestions.seed.json#L1-L24), with question examples from line 49 onward.
- **What:** the file marks the content as `draft` and `provisional`, lists #354 and #478 as dependencies, and explicitly states that no loader, route or collection reads it yet. It also records unresolved concept-ID and schema questions.
- **Why it matters:** loading this data before the canonical question schema is agreed could introduce inconsistent question records or incorrect curriculum links.
- **Boundary:** confirm dependency #354 and the accepted schema before implementing a loader or changing the production question model.

### Gap 4 — The diagnostic PDF download bypasses the shared frontend API helper

- **Where:** [`frontend/src/components/panels/DiagnosticTestPanel.tsx` lines 117–147](../frontend/src/components/panels/DiagnosticTestPanel.tsx#L117-L147); [`frontend/src/services/apiClient.ts` lines 14–32](../frontend/src/services/apiClient.ts#L14-L32); [`frontend/README.md` lines 14–16](../frontend/README.md#L14-L16).
- **What:** the diagnostic API request uses `apiFetch()`, but the subsequent PDF download uses direct `fetch(pdfUrl, ...)`. The shared helper adds the configured base path and handles 401 responses; this direct request does not automatically use those behaviours.
- **Why it matters:** the PDF download can behave differently from other frontend API requests, especially under a subpath deployment or an expired session.
- **Boundary:** this was not in the supplied intern-ready issue shortlist. I should not open a speculative PR; it needs an existing issue or maintainer scoping first.

### Issue shortlist cross-checks

- **#703:** the reviewed `QuestionTemplatePanel.tsx` already has an Assessment Mode column and mode filter around lines 950–996. Check the live issue and latest `main` before treating it as unfinished.
- **#850:** a related PR #877 was mentioned by another contributor; avoid duplicating that work until its current state is checked.
- **#837:** it appeared in the open `intern-ready` list shared during this onboarding discussion. Reconfirm that it remains open, labelled `intern-ready`, unassigned and not covered by an active PR before selecting it.
- **#478:** the pilot file lists #354 as a dependency. Confirm that dependency and the issue's acceptance criteria before working on it.

## 5. Ideas for the Project

Each idea below is tied to a finding in Section 4. These are proposals, not claims that the changes have already been implemented.

### Idea 1 — Make certification scope and requirement lookup explicit (Gap 1 / Issue #837)

- **What:** use an explicit typed mapping for supported stage/class labels and their certification requirement buckets instead of inferring the class only by extracting digits.
- **Why:** Balvatika-to-Class-3 support needs an agreed stage key and requirement data as well as a changed class-range check.
- **How:** confirm stage identifiers, competency thresholds and Class 4 compatibility; update the resolver, requirement seed and types consistently; add tests for each supported stage, unknown labels, missing requirements, certification creation and existing-record compatibility.

### Idea 2 — Add a validated concept-to-assessment-mode registry (Gap 2 / Issue #850)

- **What:** provide a typed mapping from each in-scope concept to `written`, `observed` or `both`.
- **Why:** the application needs a defined evidence method even when no question template exists for a concept.
- **How:** use the approved curriculum mapping, validate that every in-scope concept has an allowed mode, and test compatibility with the existing template-level field. First inspect PR #877 and the current issue status.

### Idea 3 — Finalise the Q-Matrix pilot only after the question schema is settled (Gap 3 / Issue #478)

- **What:** align the SK13 pilot records with the canonical question schema and accepted representation/context vocabulary.
- **Why:** consistent question-to-skill metadata is needed for reliable filtering and analysis.
- **How:** resolve dependency #354, confirm the allowed fields and skill/subskill relationships, then add validation and tests before connecting the pilot data to an application loader.

### Idea 4 — Route the diagnostic PDF download through a shared helper (Gap 4)

- **What:** use a base-path-aware and authentication-aware download helper for the diagnostic PDF request.
- **Why:** download behaviour should be consistent with other frontend API requests.
- **How:** first find or request an issue that scopes the work; then implement a suitable helper and test root deployment, subpath deployment and unauthorised responses.

## 6. Your Contribution

### Repository Analysis and Preliminary Design Work

As part of my onboarding, I reviewed the FLN repository structure and traced the main frontend, backend, database, curriculum, assessment and evaluation workflows.

I identified and documented four areas for further improvement in Section 4 and proposed corresponding technical approaches in Section 5.

I also analysed the certification-record handling in `backend/src/services/certificationRecords.ts` and identified the changes needed to support the intended Balvatika-to-Class-3 scope.

This analysis is preliminary design work, not a completed code fix.

No production frontend or backend behaviour has been changed as part of this onboarding exercise. No runtime test or full CI success is claimed.

My next step is to select an eligible, open `intern-ready` issue, verify the problem against the latest upstream code, implement the solution and submit a separate pull request with appropriate tests.

---

## References reviewed

- [`README.md`](../README.md)
- [`ARCHITECTURE.md`](../ARCHITECTURE.md)
- [`PRD.md`](../PRD.md)
- [`SRS.md`](../SRS.md)
- [`backend/README.md`](../backend/README.md)
- [`frontend/README.md`](../frontend/README.md)
- [`ai-services/README.md`](../ai-services/README.md)
- [`backend/src/identity.types.ts`](../backend/src/identity.types.ts)
- [`backend/src/student.types.ts`](../backend/src/student.types.ts)
- [`backend/src/curriculum.types.ts`](../backend/src/curriculum.types.ts)
- [`backend/src/assessment.types.ts`](../backend/src/assessment.types.ts)
- [`backend/src/evaluation.types.ts`](../backend/src/evaluation.types.ts)
- [`backend/src/operations.types.ts`](../backend/src/operations.types.ts)
