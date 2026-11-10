Contributor Onboarding — Mahak
1. What is FLN?
Foundational Literacy and Numeracy (FLN) is the set of basic reading / mathematics abilities children must develop before confidently learning more advanced subjects. In India, the FLN initiative targets helping children gain these skills in the early years of schooling, rather than allowing learning gaps to grow year over year.
The FLN repository is building software to help schools measure foundational numeracy, to understand what a student has learned, and to track progress. Its intended workflow supports teachers with assessment papers, student records, evaluation results, and progress views. An important scope detail from the repository README is that the FLN initiative currently covers only mathematics: although FLN as a national education goal includes literacy and numeracy, this application does not currently measure literacy.
The software currently focuses on Balvatika through Class 3. Class 4 and Class 5 work is documented as being outside this repository's current build scope.
2. What do you understand by FLN (as a system)?
I understand FLN as a workflow connecting students, teachers, school staff, and administrators (not just as a question-paper generator).
User and access: Superadmins and administrators manage (at their level) the system; school staff and teachers work with their schools, classes, and student records. Access must stay limited to the schools and students a user can manage.
Core records: Schools and classes categorize students. Student profiles and assessment reports record progress. Question templates describe the intended skill and assessment mode; generated worksheets present assessment items to children. Evaluation reports hold results used by teacher-facing views and progression logic.
Assessment flow: A teacher prepares a standard paper or a paper personalized from the available student information, prints it, administers it, and scans or uploads the completed sheet. The backend processes the submission, saves an evaluation report, and makes results available to the relevant views.
Question authoring: The repository separates question intent and reusable template metadata from the final wording and visual rendering. docs/question-authoring-and-assets.md explains this authoring flow and where SVG/worksheet content is stored.
Progress and certification: Results can inform student progress, while certification must follow the project's rules for the relevant class and assessment cycle. The open issue #845 identifies a specific correctness gap in that last step: certification eligibility is rechecked for evaluations and diagnostics without consistently restricting to the End-of-year cycle.
This separation matters because an incorrect report or certification decision affects the student's record, not just the presentation of the interface.
3. Current State of the Repository — What Has Been Done So Far
The project is an npm-workspaces monorepo with multiple pieces:
frontend/ — React 19, Vite, and Tailwind CSS. Contains dashboards and panels for school workflows, question authoring, and assessment-related operations.
backend/ — Node.js, Express, and TypeScript. It is the primary API backend and uses the native MongoDB driver rather than Mongoose. Route modules live under backend/src/routes/.
backend/fln-backend/ — a separate, older JavaScript worksheet-backend workspace; it should not be conflated with the primary API backend.
ai-services/ — Python-based evaluation/OCR code invoked by the backend as a subprocess during normal workflows.
Data and configuration — curriculum data is represented in configuration such as backend/src/config/curriculumMap.ts. The level framework currently lists 109 curriculum levels, but the README warns that a level's presence in the map does not by itself prove that it can be assessed end-to-end.
The repository already includes role-aware application workflows, student and school records, question-template authoring, worksheet generation/printing, scan-and-evaluate paths, reports, and tests. The system is being developed in stages, with Balvatika receiving particular attention. The README also explains that the long-term design is changing: curriculum level numbers should not be treated as immutable IDs, pedagogy should take precedence over preserving old implementation assumptions, and important scoring/certification decisions should be deterministic and auditable.
For local development, the README documents installing dependencies with npm install, configuring backend/.env, seeding a developer database, and running the API and frontend on ports 3000 and 5173. MongoDB is recommended. If MONGODB_URI is unset, the primary backend can fallback to a local JSON file for a solo demo; the README warns that this fallback is not concurrency-safe. I have not verified a separate production deployment pipeline, so I would confirm deployment-specific instructions with a maintainer before changing them.
Before a code contribution, I will read the root README and the relevant feature documentation, reproduce the issue where possible, work only from an existing issue, and run the checks relevant to the changed workspace. The repository's contribution rules say not to submit speculative changes without an issue and recommend choosing intern-ready issues until Version 1 is clean end-to-end.
4. Gaps Observed in the Code
Gap 1 — Certification checks are not consistently limited to End-of-year assessments
Where:
backend/src/db.ts, EvaluationReport around line 558.
backend/src/routes/evaluation.ts, the report-save and eligibility-check path around lines 1093–1096.
backend/src/routes/students.ts, the diagnostic report and eligibility-check path around lines 1350–1360.
What: The open issue #845 documents that runCertificationEligibility(student) is called after a worksheet evaluation and after a diagnostic. The worksheet has a cycle value (Baseline, Mid-year, or End-of-year), but that cycle is not stored on the evaluation report. The diagnostic path does not carry a worksheet cycle, but also triggers certification eligibility.
Why it matters: A certificate should not be created or flagged by a Baseline/Mid-year worksheet or a diagnostic when the rule is to certify at End-of-year. Persistance of the cycle also makes the report auditable. This is a concrete correctness issue, and the issue is labelled intern-ready with a scoped solution and test cases.
Gap 2 — There is no single concept-to-NCF-competency mapping
Where: backend/src/config/curriculumMap.ts, especially the LevelConceptConfig definition at the beginning of the file and its level entries.
What: The current level configuration describes fields such as level number, title, concept ID, stage, age group, and strand, but the open issue #849 identifies the absence of a concept-to-NCF-competency mapping. That issue proposes a separate backend/src/config/ncfCompetencies.ts rather than expanding the already frequently touched curriculum map.
Why it matters: Reports and certification views cannot reliably group a child's demonstrated skills by NCF competency without this mapping. This is a useful data/configuration task, but mappings should be checked against the cited NCF/research source rather than guessed.
Gap 3 — Assessment mode exists on templates, but is not yet defined as a canonical mode for every concept
Where: backend/src/db.ts, the QuestionTemplate definition around line 898; backend/src/routes/questionTemplates.ts, where the allowed template modes are defined.
What: The open issue #850 notes that written, observed, and both are currently attached to individual question templates. A concept without an authored template has no canonical mode for downstream certification logic to consult. The issue proposes a separate concept-to-mode configuration. It also flags that Class 1–3 values are interim until reviewed by the relevant subject expert.
Why it matters: Some foundational skills are better assessed through teacher observation than a paper response. A missing or inconsistent mode can lead to the wrong evidence being expected during evaluation or certification. Because this touches pedagogy and evidence rules, the source mapping and review caveat must be preserved.
Gap 4 — CI only discovers backend tests through explicitly registered scripts
Where: scripts/ci/pr-checks.sh, run_backend_tests() around lines 61–72.
What: The script loops over test: scripts in backend/package.json and then runs npm test. The open issue #759 reports that some standalone test files are not run by CI because they are not part of those scripts.
Why it matters: A test file that CI never executes cannot protect the code from regressions. The issue suggests discovering eligible test files automatically, with exclusions for tests that require special setup. However, this issue is not currently labelled intern-ready, so I would ask a maintainer before starting it.
Issue-duplication check
I also checked the assessment-mode table issue #703. It has an open related PR, #715, so I would not start a parallel implementation of the same UI change unless a maintainer explicitly redirects the work.
5. Ideas for the Project
Idea 1 — Make certification decisions cycle-aware (preferred first contribution)
What: Add an optional cycle to EvaluationReport, save the worksheet's cycle with the report, run certification eligibility only after an End-of-year worksheet, and remove that trigger from the diagnostic path.
Why: This directly addresses Gap 1 and prevents diagnostics or earlier-year assessments from inadvertently triggering certification.
How: Follow the scoped steps in issue #845. Add an isolated test file modelled on backend/tests/observations.test.ts; cover Mid-year (no certification), End-of-year (certification check), diagnostic (no certification), and persistence of the report cycle. Run the new test, the backend checks, and the relevant CI checks. The issue is marked intern-ready; I would still confirm that no one has started the work immediately before opening a branch.
Idea 2 — Add a tested NCF competency map
What: Create backend/src/config/ncfCompetencies.ts with one explicit competency or null for each required concept.
Why: This addresses Gap 2 and gives reports/certification a stable way to group evidence by NCF competency without coupling that data to display level numbers.
How: Use the reference material named in issue #849, keep the map separate from curriculumMap.ts, and add tests for valid concept IDs, valid competency codes, complete coverage of required concepts, and explicit null entries where the NCF mapping does not apply. Do not fill uncertain values from memory.
Idea 3 — Define assessment mode at the concept level
What: Add backend/src/config/assessmentMode.ts and a tested mapping from concepts to written, observed, or both.
Why: This addresses Gap 3 so that downstream evaluation can determine the required evidence even when a concept has no question template yet.
How: Follow issue #850, use the cited research for Balvatika, clearly mark interim Class 1–3 values, and test that keys match curriculum concepts and values belong to the allowed mode set. Confirm review expectations before treating interim pedagogy data as final.
Idea 4 — Make CI run eligible tests without requiring a script entry for each one
What: Update scripts/ci/pr-checks.sh to discover and execute eligible test files automatically.
Why: This addresses Gap 4 and reduces the chance of a test silently being excluded from the pull-request checks.
How: Use the exact exclusions and execution cases described in issue #759, then verify the full script locally. Since the issue currently lacks the intern-ready label, seek maintainer approval before taking it.
6. Your Contribution
I have previously submitted two focused pull requests in this repository:
PR #606 — worksheet layout rules for Balvatika print, related to issue #603. The PR added named layout constraints for minimum font size, answer-box height, a questions-per-page maximum, and an explicit overflow policy. Its PR description records lint and build checks as passing.
PR #611 — migrate UI from the hardcoded 93-level ceiling, related to issue #570. The PR aimed to derive affected UI level references and filters from the curriculum source of truth. Its description records the frontend build and diff check as passing, with lint reporting unrelated baseline failures.
Status note: Both PRs are currently closed without being merged. I am listing them as actual prior work, not as accepted or merged contributions.
For this onboarding submission, I have also reviewed the repository's contributor rules, read the current architecture and question-authoring documentation, examined specific implementation paths, cross-checked open issues against related PRs, and written this file with code locations, impacts, and testable follow-up plans. This document is the required onboarding record; I understand it does not replace the expectation of a separate tangible code, test, or design contribution.
My proposed next implementation is issue #845, subject to a final duplicate-work check and maintainer guidance. It is scoped, labelled intern-ready, and has explicit acceptance tests. I would make that change in a separate issue-linked branch and PR rather than mixing it into this onboarding document.