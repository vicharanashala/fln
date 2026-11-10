# services

## Overview
Domain logic between routes and storage: the certification engine (SRS R-7), question-template rendering and download, concept mastery rating, and worksheet content resolution.

## Interface
- `certificationEligibility.ts`: pure `decideEligibility(...)` returning an `EligibilityDecision` (`EligibilityOutcome`).
- `certificationCompetencyRequirements.ts`: read-only registry over `src/data/competencyRequirements.seed.json` (loaded once and cached per process; the database is not consulted): `getAllCompetencyRequirements`, `getRequirementsForClassLevel`, `getMandatoryRequirementTopics`.
- `certificationRecords.ts`: scope is hardcoded to classes 2-4 at level 5 (`certificationRecords.ts:56,61`). `runCertificationEligibilityForStudent`, `runCertificationEligibility` (fire-and-forget), `resolveCertificationReview` (`ReviewDecision` is `confirm | revoke`), `CertificationReviewError`, `countActiveCertificationsFromMemory`, `buildPerSchoolStats`.
- `certificationNotifications.ts`: `getAdminEmails`, `buildEmailPayload`, `sendEmail`, `notifyCertificationReviewNeeded`. Reads `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
- `questionTemplateRenderer.ts`: `renderTemplateQuestion`, `instanceSeed`, `answerHint`, `filterEligibleTemplates`, `isApprovedForGeneration`, `generateQuestionsFromTemplates`, `RenderedQuestion`.
- `questionTemplateDownload.ts`: `buildQuestionTemplateDownload` (spreadsheet export).
- `questionService.ts`: `QuestionService`, a wrapper over concept-driven generation (the backing for `levelGenerator.ts`). `getQuestionsByLevel` falls back to concept `S1.1` with a console warning for an unknown level. `updateLevelMapping` mutates `CURRICULUM_MAPPING[level].conceptId` at runtime.
- `skillStatus.ts`: `computeConceptMastery`, `MASTERY_RULE_VERSION` (`v1-provisional-2of3`), `ConceptRating`, `ConceptMasteryResult`. Balvatika only.
- `worksheetContent.ts`: `resolveWorksheetContent`, types `ResolvedQuestion`, `ConceptShortfall`, `ResolvedConcept`, `ResolvedWorksheetContent`, `MAX_CONCEPTS_PER_BATCH` (20), `MAX_QUESTIONS_PER_CONCEPT` (50), `MAX_PRINTED_PICTURES` (20).

## Invariants
- `decideEligibility` is pure; verdict changes must keep `__checks__/certification.check.ts` passing.
- Rendering and content resolution are deterministic: the same concepts, count and seed give the same questions and artwork.
- Only approved, eligible templates are used for generation.
- Mastery rule: Proficient needs at least 2 attempts and a correct share of 0.6 or more (`skillStatus.ts:74`), so 2 of 2 and 3 of 5 also count; more than 0 correct = Progressive; otherwise Beginner. The `v1-provisional-2of3` version string must change with the rule. Concepts rated are the hardcoded `S3.1, S3.2, S3.3, S3.4, S3.5, S3.7` plus any concept id found in the student's reports (parsed by regex from `questionId` or question text). `computeConceptMastery` returns `null` for non-Balvatika students.
- In the reference CSVs of a template download, every cell is quoted and a cell starting with `=`, `+`, `@` or `-` (after optional whitespace) gets a leading apostrophe so it cannot become a spreadsheet formula. `questions.csv` is a header-only file and is not passed through this guard.

## Side Effects
- `certificationRecords.ts` reads and writes certifications through `dbStore` (Mongo) and triggers notifications on `active` to `review_needed`. Revoked certifications are terminal: new evidence is only logged, never re-evaluated.
- `certificationNotifications.ts` writes an in-app logbook entry through `dbStore.addLog`, and sends email to admin addresses only when `SMTP_HOST` is set; otherwise it logs the payload to stdout.
- `questionTemplateRenderer.ts`, `skillStatus.ts`, `worksheetContent.ts` read Mongo collections; `worksheetContent.ts` also reads SVG assets via `svgAssetCatalog.ts`.

## Verification
- Run: `npm test --workspace @fln/backend`
- Colocated: `questionTemplateRenderer.test.ts` (`npx tsx --test src/services/questionTemplateRenderer.test.ts`); also `tests/worksheet-content.test.ts`, `tests/question-template-download.test.ts`.
