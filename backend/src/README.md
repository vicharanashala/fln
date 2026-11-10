# backend/src

## Overview
Source of the `@fln/backend` workspace: an Express and MongoDB server that backs the FLN (foundational literacy and numeracy) assessment platform. `index.ts` boots the server, connects Mongo through `db.ts` when `MONGODB_URI` is set, registers every route module, and serves the built frontend or the Vite dev middleware. The top level also holds the persistence layer, auth, worksheet and paper PDF generation, evaluation and misconception analysis, and the seed and extraction scripts.

## Interface
Subdirectories (each has a contract):
- [`__checks__`](./__checks__/README.md): hand-run assert scripts (certification, error tags, generation windows).
- [`config`](./config/README.md): curriculum map, NCF competencies, paper types, layout rules.
- [`migrations`](./migrations/README.md): one-off Mongo migrations and reports.
- [`routes`](./routes/README.md): `/api` route registrars.
- [`scripts`](./scripts/README.md): operator scripts such as `demo-cert.ts`.
- [`services`](./services/README.md): certification engine, template rendering, mastery rating.
- [`types`](./types/README.md): question-template parameter enums and validators.
- [`utils`](./utils/README.md): concept question generator, SVG escaping.
- `./modules/` (Aadhaar vault, not linked, documented separately). Its routes are registered by `registerVaultRoutes` in `index.ts`.
- `data/` holds JSON seed and snapshot data (question bank seed, competency requirements, SK13 pilot questions in `sk13PilotQuestions.seed.json`, and the skill-level map snapshot `skillLevelMap.json`).

Key top-level files:
- Server and storage: `index.ts` (boot, route registration, `app.listen` on `0.0.0.0`), `db.ts` (`connectDB`, `DBStore`, `dbStore`, `dedupeQuestionsById`, `getSeedCompetencyRequirements`), `config.ts` (`ROOT_DIR`, `PYTHON_BIN`, `AI_SERVICES_DIR`, `authRateLimiter`), `auth.ts` (`JWT_SECRET`, `JWT_EXPIRES_IN`, `getAuthUser`, `requireSuperadmin`, `canAccessStudent`, `adminAreaIncludesSchool`, `sanitizeUser`). Two other superadmin guards exist: `routes/superadminGuard.ts` and a private copy in `routes/questionBank.ts`.
- Domain types: `identity.types.ts` (`UserRole`, `User`, `School`, `ClassGroup`), `student.types.ts`, `curriculum.types.ts` (`Question`, `QuestionBankEntry`, `QuestionTemplate`, `CYCLE_NAMES`), `assessment.types.ts`, `evaluation.types.ts`, `operations.types.ts` (certification, tickets, logbook).
- Identity and IDs: `idGenerator.ts` (`generateId`, `generateStudentId`, `generateTeacherId`, `IdGenerationError`), `displayId.ts` (`computeStudentDisplayId`), `aadhaarVault.ts` (`VaultError`, `formatAadhaarMask`, `actorContextFromRequest`), `geoData.ts` (`STATES_UTS`).
- Assessment logic: `answerMatching.ts` (`normalizeAnswer`, `answersMatch`, `matchesChoiceLetter`), `answerKeyCheck.ts`, `gradeLevelCalculator.ts`, `errorClassification.ts` (`classifyErrorType`), `errorTags.ts`, `rootCauseAnalysis.ts`, `competencyPrerequisites.ts` (AND/OR prerequisite groups), `studentHistory.ts`, `scanQuality.ts` (`analyzeScanQuality`).
- Misconceptions: `misconceptionFingerprint.ts` (feature vectors), `geminiClusterMatcher.ts`, `studentArchetypeService.ts`, `misconceptionDemoSeed.ts`.
- Papers and worksheets: `paperGenerator.ts` (`generateDiagnosticPaper`, `generateLevelWorksheet`, `renderWorksheetPdf`), `paperLock.ts`, `generationWindowRules.ts`, `levelGenerator.ts` (`QUESTIONS_PER_LEVEL`, `generateQuestionsForLevel`), `classAdapters.ts`, `worksheetRenderer.ts` (`renderBatch`), `levelsBackendClient.ts` (client for the batch-generation service), `pdfMerge.ts`, `qrCode.ts`, `svgPdf.ts`, `svgAssetCatalog.ts`, `browser.ts` (`launchBrowser`), `gemini.ts` (`generateContentWithRetry` and AI diagnostic and worksheet functions).
- Seed and extraction scripts (run by hand): `seed.ts`, `reseed.ts`, `seedCurriculumLevels.ts`, `seedQuestionBank.ts`, `seedLevelHtml.ts`, `seedBalvatikaQuestionTemplates.ts`, `extractQuestions.ts`, `extractQuestionBankSvgs.ts`, `testConceptGenerator.ts`.
- Colocated tests: `answerMatching.test.ts`, `competencyPrerequisites.test.ts`, `errorClassification.test.ts`, `misconceptionFingerprint.test.ts`, `paperLock.test.ts`, `scanQuality.test.ts`.

## Invariants
- `index.ts` is the only place routes are registered; `connectDB()` and `dbStore.init()` run before any route is served.
- Backend and frontend are separate workspaces. Share data by snapshot (for example `data/skillLevelMap.json`), never by cross-import.
- The backend builds to one esbuild bundle (`dist/server.cjs`) with `--packages=external`.
- Aadhaar numbers are tokenized; raw values and token IDs stay out of API responses and logs.
- `seed.ts` and `reseed.ts` drop collections, and `seedLevelHtml.ts` (`npm run seed:html`) runs `deleteMany({})` on the level HTML collection before inserting. `seedCurriculumLevels.ts`, `seedQuestionBank.ts` and `seedBalvatikaQuestionTemplates.ts` are additive or upsert (the latter two have `--dry-run` or review-preserving behavior); do not substitute `seed` for them.
- Known limitation: `package.json` scripts `dev:new` (`src/server.ts`) and `seed:geo` (`src/utils/seedGeo.ts`) point at files that do not exist.
- Paper-lock and generation-window rules decide whether a student may get another baseline, mid-year or end-of-year paper.

## Side Effects
- Opens a Mongo connection when `MONGODB_URI` is set and listens on a TCP port (`PORT`, default 3000). With no `MONGODB_URI`, or after 3 failed connection attempts, it falls back to the local file DB, so Mongo is optional at runtime.
- Serves `/output` and `/worksheets` static files and writes generated PDFs and files under `ROOT_DIR`.
- Calls Gemini (AI diagnostic and worksheet evaluation from `routes/students.ts` and `routes/evaluation.ts`), calls Ollama Cloud for ICR/OCR (`OLLAMA_API_URL`, `OLLAMA_API_KEY`, `ICR_CLOUD_API_KEY_*`), calls the external levels backend for worksheet generation (`levelsBackendClient.ts`), spawns the Python AI services (`PYTHON_BIN`, `AI_SERVICES_DIR`), and launches headless Chromium.
- Certification notifications write a logbook entry and send admin email only when `SMTP_HOST` is set (also `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`); otherwise the email payload is logged to stdout.
- Seed and reseed scripts write or drop Mongo collections.

## Verification
- Run: `npm test --workspace @fln/backend` from the repo root (runs the Aadhaar, vault, panel-isolation, assessment-mode and vault-config suites).
- Individual scripts: `npm run test:answer-matching --workspace @fln/backend`, `npm run test:fingerprint --workspace @fln/backend`, `npm run test:error-tags --workspace @fln/backend`.
- Type check: `npm run lint --workspace @fln/backend` (`tsc --noEmit`).
