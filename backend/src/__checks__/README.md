# __checks__

## Overview
Hand-runnable assert scripts for backend logic that has no formal test harness: certification eligibility and review, mastery rating, error tags, and generation-window rules. They are not imported by the app and never run at boot.

## Interface
- `certification.check.ts`: intended spec for certification outcome precedence and mastery ranking (`services/certificationEligibility.ts`). It also covers `resolveCertificationReview`, `countActiveCertificationsFromMemory`, `buildPerSchoolStats`, `getAdminEmails`, `buildEmailPayload`, a state-admin review-queue scope, and an optimistic-lock update. See the known limitation under Invariants.
- `certification-list.check.ts`: unit asserts for `resolveCertificationReview` only, written for the review flow behind `GET /api/certifications` and `POST /api/certification/review/:certificationId`. It makes no HTTP or route assertions. Its concurrency case only checks that `version` is 2 after one confirm; the 409 and live-server cases are manual curl checks described in its comments.
- `balvatikaMasteryRating.check.ts`: asserts for the Balvatika concept-mastery rating rule.
- `errorTags.check.ts`: asserts for `errorTags.ts` (topic to tag lookup and validation), then starts an Express app on a random port with `registerErrorTagsRoutes` and `registerQuestionTemplateRoutes`, adds a superadmin through `dbStore.addUser`, signs a JWT with `JWT_SECRET`, and calls `GET /api/error-tags` and `POST /api/question-templates` (201 and 400 cases).
- `generationWindowCheck.ts`: asserts for `generationWindowRules.ts` (`getGenerationWindowStatus`, `getLatestGenerationWindow`, `isWorksheetGenerationLocked`) against a hardcoded timeline: a teacher-priority window of 30 minutes and a total window of 60 minutes. It does not follow the `*.check.ts` naming of the other files.
- `seedCompetencyRequirements.check.ts`: asserts only on `getSeedCompetencyRequirements()` from `db.ts` (16 entries, field types). It does not exercise `utils/seedCompetencyRequirements.ts`.

## Invariants
- Any change to certification verdicts is meant to keep `certification.check.ts` passing, as the spec for `decideEligibility`. Known limitation: as written it cannot pass. It imports `updateCertificationIfVersion` and `getReviewQueueForAdmin` from `../services/certificationRecords` (marked `// ASSUMED name`), and neither is exported there; `updateCertificationIfVersion` exists only as a `DBStore` method (`db.ts`) and `getReviewQueueForAdmin` exists nowhere in `src`. The calls at lines 428, 444 and 449 would fail, and `// @ts-nocheck` hides this from `tsc`.
- `certification.check.ts` and `certification-list.check.ts` carry `// @ts-nocheck` because their fixtures predate removal of `streak` from `Student`. They are skipped by `tsc` until the fixtures are updated.
- Scripts exit non-zero on assertion failure and are standalone; nothing in the app imports them.

## Side Effects
- Run via `npx tsx`. `balvatikaMasteryRating.check.ts` and `errorTags.check.ts` call `dbStore.init()` and then push fixtures or call `dbStore.addUser`; if `MONGODB_URI` is set (including via `.env`), `dbStore` may be Mongo-backed and these checks would write test data to that database. Unset `MONGODB_URI` before running them. `certification.check.ts` and `generationWindowCheck.ts` also load `.env`.

## Verification
- Run: `npm run test:error-tags --workspace @fln/backend`. This is the only check with an npm script; the other five are not part of `npm test` and must be run by hand.
- Others: `npx tsx backend/src/__checks__/<file>` from the repo root.
