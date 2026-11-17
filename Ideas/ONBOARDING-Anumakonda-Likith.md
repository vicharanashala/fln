# FLN Contributor Onboarding

**Contributor:** Anumakonda Likith  
**Repository:** [vicharanashala/fln](https://github.com/vicharanashala/fln)  
**Fork:** [LIKITH-3012-MAC/fln](https://github.com/LIKITH-3012-MAC/fln)  
**Review date:** 17 November 2026  
**Source reviewed:** FLN repository archive dated 6 November 2026; related issue and PR statuses rechecked on 17 November 2026

---

## 1. What is FLN?

FLN means **Foundational Literacy and Numeracy**. It focuses on the basic reading and mathematics skills children need for further learning. Foundational numeracy includes understanding numbers and quantities, recognising patterns and learning basic operations.

Children in the same class may not all understand a topic at the same level. A general test score can show that a child needs help, but it may not show which concept is difficult for that child. Finding the exact learning gap can help the teacher decide what the child should practise next.

The FLN platform is intended to help teachers understand a student's learning level, assess important concepts and follow the student's progress. It connects student records and curriculum concepts with questions, worksheets, paper-based assessments, scanning and evaluation.

Although the project name includes both literacy and numeracy, the current software in this repository focuses on **mathematics/numeracy**. Reading and literacy assessment are not implemented in the current build. The README describes 109 curriculum levels, 24 skills and 183 subskills. The current development plan moves from Balvatika to Class 3. Class 4 is outside the current MVP and is deferred to Tenali. Also, having a level in the curriculum map does not always mean that the complete assessment flow for that level is ready. See [`README.md` lines 1–9](../README.md#L1-L9), [56–68](../README.md#L56-L68) and [30–52](../README.md#L30-L52).

## 2. What do I understand by FLN as a system?

I understand FLN as a system that helps teachers and education teams assess students and follow their learning. It stores school, class and student details. It connects questions to curriculum concepts, records written answers and teacher observations, processes assessment evidence and shows progress information to authorised users.

### Users and main entities

The account roles listed in [`backend/src/identity.types.ts` lines 3–10](../backend/src/identity.types.ts#L3-L10) are Superadmin, Admin, District Admin, Block Admin, School, Teacher and Volunteer. School and class details are also defined in this file at [lines 29–63](../backend/src/identity.types.ts#L29-L63). A student is not a role in the `UserRole` enum. Student information is stored separately in [`backend/src/student.types.ts` lines 5–43](../backend/src/student.types.ts#L5-L43).

The main records I found are:

- **School and class:** school and class/section details in [`backend/src/identity.types.ts` lines 29–63](../backend/src/identity.types.ts#L29-L63).
- **Student profile:** the student's school and class, current and target levels, and level history in [`backend/src/student.types.ts` lines 5–26](../backend/src/student.types.ts#L5-L26).
- **Curriculum concept and question template:** `conceptId` identifies the curriculum concept for a `QuestionTemplate`. `levelNumber` and `levelName` describe its level. The template also supports `assessmentMode` values of `written`, `observed` or `both` in [`backend/src/curriculum.types.ts` lines 119–147](../backend/src/curriculum.types.ts#L119-L147).
- **Worksheet and answer submission:** the generated assessment paper and the answers submitted later in [`backend/src/assessment.types.ts` lines 80–146](../backend/src/assessment.types.ts#L80-L146).
- **Teacher observation:** a record of what a teacher observes while a child performs an activity, in [`backend/src/assessment.types.ts` lines 149–198](../backend/src/assessment.types.ts#L149-L198).
- **Evaluation report and certification:** assessment results and certification information in [`backend/src/evaluation.types.ts` lines 91–152](../backend/src/evaluation.types.ts#L91-L152) and [`backend/src/operations.types.ts` lines 5–42](../backend/src/operations.types.ts#L5-L42).

### High-level system flow

1. An authorised teacher selects a class or student.
2. The platform uses the student's profile and curriculum/question information to prepare an assessment.
3. The backend prepares a worksheet or question paper for printing.
4. The student completes the paper. The teacher can also record observations for concepts that need them.
5. The teacher scans or uploads the completed work.
6. The backend processes the submission and stores the assessment evidence.
7. The result can be used to understand progress and plan practice, reassessment or certification.

The product flow is described in [`README.md` lines 81–107](../README.md#L81-L107). The architecture is explained in [`ARCHITECTURE.md` lines 9–87](../ARCHITECTURE.md#L9-L87), with user roles and the assessment flow at [lines 91–145](../ARCHITECTURE.md#L91-L145).

## 3. Current State of the Repository — What I Found

The repository is an **npm-workspaces monorepo**. This means that multiple related applications and packages are kept in one repository. The root workspace contains `frontend`, `backend` and `backend/fln-backend`. The `ai-services/` folder contains separate Python code. See the root [`package.json`](../package.json) and [`README.md` lines 152–161](../README.md#L152-L161).

- **Frontend — `frontend/`:** This is the user interface. It uses React 19, Vite and Tailwind CSS. It contains the main application, role-based dashboards and workflow panels. `frontend/src/services/apiClient.ts` is the shared helper for API requests. See [`frontend/README.md` lines 1–16](../frontend/README.md#L1-L16).
- **Primary backend — `backend/`:** This is the main API application. It uses Node.js, Express and TypeScript. It contains API routes, authentication, data types, assessment logic and database access.
- **Database:** The primary backend uses the native MongoDB driver when `MONGODB_URI` is configured. It also has a local JSON-file option for individual development. The architecture documentation says that this local option should not be treated as a shared database for concurrent use. See [`ARCHITECTURE.md` lines 48–53 and 81–87](../ARCHITECTURE.md#L48-L53).
- **Worksheet backend — `backend/fln-backend/`:** This is a separate JavaScript workspace used for worksheet generation and rendering. It is different from the main TypeScript backend.
- **AI and document tools — `ai-services/`:** This folder contains Python scripts for PDF processing and evaluation-related work. The `ai-services/README.md` says that the normal backend path calls `scripts/pdf_rasterize.py`. It does not call `run_pipeline.py` or `personalized_evaluation_pipeline.py` as part of the normal backend request flow. So I should not assume that every Python script is connected to the live application. See [`ai-services/README.md` lines 3–18](../ai-services/README.md#L3-L18).

The repository includes authentication and role checks, student/school/class records, curriculum and question-template data, worksheet flows, answer submissions, teacher observations, evaluation reports and certification logic. In the reviewed snapshot, the Question Template panel also has an Assessment Mode field, filter and table column. See [`QuestionTemplatePanel.tsx` around lines 950–996](../frontend/src/components/panels/QuestionTemplatePanel.tsx#L950-L996). The full workflow is described in the documentation, but implementation can differ by feature and curriculum stage.

## 4. Gaps Observed in the Code

The following are the issues I noticed while reviewing the supplied source. Before working on any of them, I would check the latest upstream `main` branch and the current issue/PR status so that I do not repeat another contributor's work.

### Gap 1 — Certification is limited to Classes 2–4 and uses a fixed level value

- **Related issue:** [#837 — replace the hardcoded level 5 and Class 2–4 gate with Balvatika to Class 3](https://github.com/vicharanashala/fln/issues/837).
- **Where:** [`backend/src/services/certificationRecords.ts` lines 26–32 and 55–77](../backend/src/services/certificationRecords.ts#L26-L32); [`backend/src/data/competencyRequirements.seed.json` lines 1–123](../backend/src/data/competencyRequirements.seed.json#L1-L123); [`backend/src/operations.types.ts` lines 9–15](../backend/src/operations.types.ts#L9-L15).
- **What I found:** `parseClassNumber()` reads digits from `student.classGroup`. A value such as `Balvatika` has no digits, so it becomes `0`. The service skips values below 2 and above 4. It also looks up certification requirements using the fixed level value `5`. In this source snapshot, the requirement seed contains rows for Classes 2, 3 and 4 at level 5, but not for Balvatika or Class 1.
- **Why it matters:** this logic does not match the planned Balvatika-to-Class-3 development scope. Changing only the class check would not be enough; the correct stage mapping and requirement data are also needed.
- **Existing work:** Another contributor's PR [#879](https://github.com/vicharanashala/fln/pull/879) implemented this issue and has been merged. Issue #837 is now closed, so I should not duplicate this work.
- **Boundary:** Stage identifiers, competency thresholds and Class 4 compatibility must follow the issue requirements or an approved curriculum decision. They should not be guessed.

### Gap 2 — The concept-level assessment-mode registry is missing from this snapshot

- **Related issue:** [#850 — add written / observed / both assessment mode for each concept](https://github.com/vicharanashala/fln/issues/850).
- **Where:** [`backend/src/curriculum.types.ts` lines 119–147](../backend/src/curriculum.types.ts#L119-L147); expected path `backend/src/config/assessmentMode.ts`, which was not present in the reviewed snapshot.
- **What I found:** A `QuestionTemplate` can already have an `assessmentMode`, but the separate configuration that maps each curriculum concept to its assessment mode was missing from this snapshot.
- **Why it matters:** The system should know whether a concept needs written assessment, teacher observation or both, even when a question template has not yet been created.
- **Existing work:** Another contributor's PR [#877](https://github.com/vicharanashala/fln/pull/877) implemented the related concept-level assessment-mode mapping and has been merged. Issue #850 is now closed, so I should not duplicate this work.
- **Boundary:** The mode for each concept is a curriculum decision. It should come from the approved mapping, not from assumptions.

### Gap 3 — The SK13 Q-Matrix pilot file is provisional and is not loaded by the application

- **Related issue:** [#478 — D1.3 Q-Matrix](https://github.com/vicharanashala/fln/issues/478), with dependency [#354](https://github.com/vicharanashala/fln/issues/354).
- **Where:** [`backend/src/data/sk13PilotQuestions.seed.json` lines 1–24](../backend/src/data/sk13PilotQuestions.seed.json#L1-L24), with question examples from line 49 onward.
- **What I found:** The file marks the pilot content as `draft` and `provisional`. It lists #354 and #478 as dependencies and says that no loader, route or collection currently reads this file. It also mentions that some concept IDs and schema details still need to be settled.
- **Why it matters:** If draft data is loaded before the question schema and curriculum links are agreed, the application could store inconsistent question information.
- **Existing work:** Another contributor has an open pull request, [#907](https://github.com/vicharanashala/fln/pull/907), linked to this issue. Issue #478 remains open, so I should review the PR and confirm with the maintainer what, if anything, remains before attempting related work.
- **Boundary:** The #354 dependency and the accepted question schema should be confirmed before adding a loader or changing production question records.

### Gap 4 — The diagnostic PDF download does not use the shared frontend API helper

- **Where:** [`frontend/src/components/panels/DiagnosticTestPanel.tsx` lines 117–147](../frontend/src/components/panels/DiagnosticTestPanel.tsx#L117-L147); [`frontend/src/services/apiClient.ts` lines 14–32](../frontend/src/services/apiClient.ts#L14-L32); [`frontend/README.md` lines 14–16](../frontend/README.md#L14-L16).
- **What I found:** The diagnostic API request uses `apiFetch()`, but the later PDF download uses a direct `fetch(pdfUrl, ...)` call. The shared helper handles the configured base path and 401 responses. The direct download call does not automatically get the same handling.
- **Why it matters:** The download may behave differently from other API requests, especially when the application is deployed under a subpath or a user's session has expired.
- **Boundary:** I did not find this in the intern-ready issue list I reviewed. I would first ask for an existing issue or maintainer guidance rather than opening an unrelated PR.

### Issue shortlist cross-checks

- **#703:** In the reviewed `QuestionTemplatePanel.tsx`, I found an Assessment Mode column and filter around lines 950–996. I would check the latest issue and PR status before treating this as unfinished work.
- **#850:** PR #877 from another contributor has been merged, and issue #850 is closed. I would not select this as new work.
- **#837:** PR #879 from another contributor has been merged, and issue #837 is closed. I would not select this as new work.
- **#478:** The pilot file lists #354 as a dependency, and PR #907 remains open and linked to this issue. I would confirm the dependency and ask the maintainer what work, if any, remains before proceeding.

## 5. Ideas for the Project

The ideas below are possible improvements based on the gaps above. They are proposals only; I have not implemented these changes.

### Idea 1 — Make certification stage and requirement lookup clear (Gap 1 / Issue #837)

- **What:** Use an explicit mapping between supported class/stage names and the correct certification requirement level, instead of relying only on extracting digits from the class name.
- **Why:** Supporting Balvatika to Class 3 needs the correct stage mapping and requirement data, not just a change to the class-number check.
- **How:** Confirm the approved stage names and requirement data first. Then update the class resolver, requirement seed, certification queries and types together. Add tests for supported stages, unknown values, missing requirements, certificate creation and existing records. PR #879 has since been merged, so this proposal is historical context rather than a new task.

### Idea 2 — Add a validated concept-to-assessment-mode mapping (Gap 2 / Issue #850)

- **What:** Define a typed mapping from each in-scope concept to `written`, `observed` or `both`.
- **Why:** The system should know the expected assessment method even if a question template is not available yet.
- **How:** Use the approved curriculum mapping, check that every in-scope concept has a valid mode, and test that the mapping works with the existing question-template field. PR #877 has since been merged, so review its implementation before proposing further changes.

### Idea 3 — Use the agreed question schema for the Q-Matrix pilot (Gap 3 / Issue #478)

- **What:** Make sure the SK13 pilot data follows the final question schema and the agreed representation/context values.
- **Why:** Consistent question-to-skill information will make it possible to find which questions assess a particular skill in a particular representation.
- **How:** First resolve the #354 dependency and confirm the allowed fields and skill/subskill relationships. Then add data validation and tests before connecting the pilot data to the application. Check PR #907 to avoid duplicate work.

### Idea 4 — Use a shared helper for diagnostic PDF downloads (Gap 4)

- **What:** Use a shared download helper that supports the configured base path and authentication handling.
- **Why:** PDF downloads should behave consistently with other frontend API requests.
- **How:** First get an issue or maintainer-approved scope. Then implement the helper and test normal deployment, subpath deployment and unauthorised responses.

## 6. Your Contribution

### Repository review and initial technical analysis

For onboarding, I reviewed the FLN repository structure and followed the main frontend, backend, database, curriculum, assessment and evaluation flows.

I wrote down four areas that may need improvement and added possible technical approaches for each one in this document.

I also studied the certification-record logic in `backend/src/services/certificationRecords.ts` to understand why its current class and level checks do not cover the planned Balvatika-to-Class-3 scope.

This was repository analysis and preliminary design work. It was not a completed code fix. I did not change production frontend or backend behaviour, and I am not claiming that I ran runtime tests or the full CI checks for this onboarding work.

My next step is to select an available issue, compare it with the latest upstream code, confirm the scope with the maintainer when needed, implement the change, run the relevant tests and submit a separate pull request.

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
