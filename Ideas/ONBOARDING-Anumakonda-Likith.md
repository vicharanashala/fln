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

### Gap 5 — The shared student roster is fetched by panels that do not use it

- **Related issue:** [#754 — make the student list smaller and faster](https://github.com/vicharanashala/fln/issues/754).
- **Where:** [`frontend/src/components/panels/usePanelData.ts`](../frontend/src/components/panels/usePanelData.ts), especially `STUDENTS_NOT_NEEDED_PANELS` and the `studentsUrl` effect; [`backend/src/index.ts`](../backend/src/index.ts), where the Express app and response middleware are registered.
- **What I found:** The shared hook requests `/api/students?all=1` for most panels. Some screens either do not display student records or make their own narrower request, so they do not need the full shared roster. The API also did not install response compression in the reviewed main branch.
- **Why it matters:** An unnecessary roster request can transfer a large amount of data when an admin opens a panel that does not use it. Compressing large JSON responses can also reduce network transfer size.
- **Existing work:** I did not find a previous PR attempt for #754 in the repository's pull-request history. The prerequisite admin-area scoping issue #737 is closed and its current implementation is in `backend/src/auth.ts`.
- **Contribution status:** I have committed an initial implementation on my fork branch [`fix/754-roster-performance`](https://github.com/LIKITH-3012-MAC/fln/tree/fix/754-roster-performance). It adds exclusions for panels that do not consume the shared student list, installs Express response compression and adds regression tests. The PR has not yet been opened, and runtime tests and the performance measurements in the issue still need to be run.
- **Boundary:** Keep the full roster for pages and calculations that actually use student records. Do not treat the skipped panels as permission to remove roster data from teacher, student, assessment or aggregate views.

### Gap 6 — There is no per-concept feedback report after an assessment

- **Related issue:** [#846 — add a per-concept feedback report](https://github.com/vicharanashala/fln/issues/846).
- **Where:** New service `backend/src/services/feedbackReport.ts`; a proposed route in `backend/src/routes/students.ts`; and a Feedback tab in `frontend/src/components/panels/StudentProfilePanel.tsx`.
- **What I found:** The issue describes that the existing skill-status service returns concept ratings, but the application does not yet format those ratings into a report of strengths, challenges and suggestions for teachers and parents.
- **Why it matters:** A teacher needs an understandable explanation of which concepts a student has demonstrated and what to practise next, not only the raw assessment result.
- **Existing work:** I did not find a previous PR attempt for #846 in the repository's pull-request history. The issue is open and unassigned.
- **Dependency:** The issue depends on #844 and #849. #849 is closed, but #844 remains open and depends on the certification-requirements decision in #836, which is marked `status: needs decision`. The issue describes this as mentor-supported work. I have selected it as planned work, but have not started implementation until the prerequisite shape and scope are confirmed.

### Gap 7 — The current certificate is not based on the stored concept-level certification

- **Related issue:** [#840 — print a skill-based certificate](https://github.com/vicharanashala/fln/issues/840).
- **Where:** `frontend/src/components/panels/CertificatesPanel.tsx`, with supporting certification data from `backend/src/routes/certification.ts` and the certification record.
- **What I found:** The issue describes that the current printable certificate uses a student's level, streak and class rank rather than the concept-level certification record. It also identifies that the ranking certificate should be separated and renamed to Weekly Recognition.
- **Why it matters:** A certificate should show the skills actually recorded for the student, with the agreed level words, certificate ID and issue date. It should not present a ranking as a learning certification.
- **Existing work:** I did not find a previous PR attempt for #840 in the repository's pull-request history. The issue is open and unassigned.
- **Dependency:** The issue depends on #844 and #846, and requires Pavani ma'am's confirmation of the printed wording. Because #846 and #844 are not complete, I have selected #840 as planned work but have not started implementation.

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

### Idea 5 — Reduce unnecessary student-roster downloads (Gap 5 / Issue #754)

- **What:** Avoid requesting the full shared student roster on panels that do not consume it, and compress large API responses.
- **Why:** This reduces unnecessary network transfer and can make panel navigation more responsive, especially for admin users with large role-scoped rosters.
- **How:** Keep a checked list of panels that do not use the shared roster, protect roster-dependent views with regression tests, and install Express compression before the body parsers. Measure the real response size and concurrent-request performance before calling the performance target complete.

### Idea 6 — Create a per-concept feedback report (Gap 6 / Issue #846)

- **What:** Build a report for each student and assessment cycle that groups concepts by competency and explains strengths, challenges, not-yet-assessed concepts and up to three suggestions.
- **Why:** Teachers and parents need clear next steps based on assessment evidence.
- **How:** First confirm the concept-level certification and competency data required by #844 and #849. Then create the service, an access-controlled student feedback route, a teacher-facing view and a parent-friendly printable layout. Keep unassessed concepts separate from concepts rated Beginner.

### Idea 7 — Print the recorded skill-based certificate (Gap 7 / Issue #840)

- **What:** Build a printable certificate from a complete certification record, showing each assessed skill, its agreed level label, a neutral icon, certificate ID and issue date. Keep weekly ranking recognition separate.
- **Why:** The certificate should represent a student's recorded skills rather than a class ranking or streak.
- **How:** Wait for the certification record shape in #844 and feedback/report dependencies in #846. Confirm the printed wording with Pavani ma'am, then add a pure certificate-view helper, frontend tests, role checks and print-layout verification.

## 6. Your Contribution

### Repository review and issue selection

For onboarding, I reviewed the FLN repository structure and followed the main frontend, backend, database, curriculum, assessment and evaluation flows. I recorded the initial gaps and proposals in Sections 4 and 5, then checked the current open issues and pull-request history before selecting further work.

### Coding contribution in progress — Issue #754

I selected [issue #754](https://github.com/vicharanashala/fln/issues/754), which is open and had no previous PR attempt in the history I reviewed.

- **Branch:** [`fix/754-roster-performance`](https://github.com/LIKITH-3012-MAC/fln/tree/fix/754-roster-performance) in my fork.
- **Latest commit:** [`f21257a`](https://github.com/LIKITH-3012-MAC/fln/commit/f21257adedb0a28434f2f95d1caf03966293301a) — corrects the backend workspace path used by the compression test.
- **Files changed:** `frontend/src/components/panels/usePanelData.ts`, `backend/src/index.ts`, `backend/package.json`, `package-lock.json`, `backend/tests/panel-isolation.test.cjs` and the new `backend/tests/http-compression.test.ts`.
- **Work done:** added exclusions for panels that do not use the shared student roster, installed response compression and added tests for panel isolation and gzip/identity responses.
- **Verification status:** I completed static checks of the changed source, test coverage and lockfile entries. I have not run `npm ci`, the new tests, workspace type checks, full CI or the performance measurements from issue #754. These checks remain necessary before the change can be considered verified.
- **PR status:** I have not yet opened a pull request for this branch, so there is no PR number to record yet.

### Selected next issues — not implemented yet

I also selected [#846](https://github.com/vicharanashala/fln/issues/846) for a per-concept feedback report and [#840](https://github.com/vicharanashala/fln/issues/840) for the skill-based printable certificate. I found no previous PR attempts for either issue in the pull-request history I reviewed. Both remain open and unassigned.

I have not started coding #846 or #840 because their dependencies and curriculum/output decisions need to be confirmed first: #846 depends on #844, and #840 depends on #844 and #846, with printed wording also requiring Pavani ma'am's confirmation. I will begin those tasks only after the maintainer confirms the prerequisites and scope.



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
