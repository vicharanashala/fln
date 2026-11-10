# routes

## Overview
Express route modules for the `/api` surface. Each file exports a `register*Routes(app)` function called from `src/index.ts` during startup. Handlers authenticate with `getAuthUser` from `../auth` and read or write state through `dbStore` (`../db`).

## Interface
Registrars, grouped by area. There are 28 registrar files, all listed below, plus `superadminGuard.ts` (the only file without a registrar):
- Identity and access: `auth.ts` (`POST /api/auth/login`, `GET /api/auth/me`), `admin.ts` (`/api/admin`, `/api/reset`, `GET /api/admin/questions`), `teachers.ts`, `schools.ts`, `classes.ts`, `geo.ts` (`/api/states`, `/api/districts`, `/api/blocks`, `/api/schools`), `mfaEnrollment.ts` (`/api/me/mfa/enroll`, `/verify`, `/factors`), `aadhaarDetokenize.ts` (`/api/students/:id/aadhaar/step-up/*`, `/detokenize`, plus two legacy MFA stubs that answer `410 Gone`), `superadminGuard.ts` (exports `requireSuperadmin`, a middleware, not a registrar).
- Students: `students.ts` (`/api/students` and `POST /api/paper/generate`, 11 routes; exports `PublicStudent`, which omits Aadhaar token fields).
- Assessment: `evaluation.ts` (`/api/evaluation`, `/api/icr`, `GET /api/students/:studentId/diagnostic-report`), `diagnosticBulk.ts` (`/api/diagnostic`), `worksheets.ts` (`/api/worksheets`, `/api/paper-types`), `observations.ts`, `analytics.ts`, `stats.ts` (`/api/stats`, `/api/db-status`), `interventions.ts`.
- Content authoring: `questionTemplates.ts` (`/api/question-templates`; exports `resolveTemplateTopic`, `parseCsv`), `questionLogics.ts`, `questionOptions.ts`, `questionBank.ts`, `errorTags.ts`, `curriculum.ts` (exports `LevelContentStatus`), `misconceptions.ts` (exports `invalidateFingerprintCache`).
- Operations: `certification.ts` (`/api/certifications`, `/api/certification`), `tickets.ts`, `logbook.ts`, `announcements.ts`, `bestPractices.ts`.

## Invariants
- A new registrar must be imported and called in `src/index.ts`; route files do not self-register.
- Registration order matters. The `/api` 404 catch-all and the Vite or static handler are mounted after all registrars.
- Student responses use `PublicStudent`; `aadhaarTokenId` and `aadhaarIdentityId` must not reach clients.
- Student access decisions go through `canAccessStudent` and `adminAreaIncludesSchool` in `../auth`.
- Superadmin-only endpoints use `requireSuperadmin`, but there are three separate implementations: `superadminGuard.ts` (takes a subject argument; used by `questionTemplates`, `questionLogics`, `questionOptions`), `requireSuperadmin` in `../auth` (Express middleware; used by `admin.ts`), and a private function in `questionBank.ts`.
- Secret-bearing routes (Aadhaar detokenize, MFA) are rate limited with `authRateLimiter` and covered by `tests/rate-limiting-secret-routes.test.ts`. The rate-limited routes are the step-up request, step-up approve and detokenize routes, `POST /api/me/mfa/enroll` and `/verify`, and `POST /api/auth/login`.
- The Aadhaar vault routes live in `../modules/` (registered separately in `index.ts`), not here. They are mounted at the app root (`/health`, `/v1/*`), outside `/api`, so they never reach the `/api` 404 catch-all.

## Side Effects
- Read and write Mongo through `dbStore`; question and template routes also write seeded content.
- `evaluation.ts` calls Gemini (`evaluateAIWorksheet`), calls Ollama Cloud over HTTP for ICR, and runs the Python AI services through `execFileSync` (`PYTHON_BIN`).
- `students.ts` calls Gemini (`evaluateAIDiagnostic`) and the PDF generator (`generateDiagnosticPaper`). `worksheets.ts` and `diagnosticBulk.ts` do not call Gemini or spawn processes; they render PDFs through `paperGenerator` (which may launch a headless browser), and `worksheets.ts` also calls the external levels backend through `levelsBackendClient`, falling back to the local generator on failure.
- `evaluation.ts` triggers `runCertificationEligibility`; `certification.ts` only exposes the admin review and list endpoints. Admin emails come indirectly from `services/certificationNotifications.ts` and are sent only when `SMTP_HOST` is set (otherwise logged to stdout).
- `aadhaarDetokenize.ts` and `mfaEnrollment.ts` write audit entries.

## Verification
- Run: `npm test --workspace @fln/backend`
- Per-area scripts, for example `npm run test:panel-isolation --workspace @fln/backend`, `npm run test:rate-limiting --workspace @fln/backend`, `npm run test:observations --workspace @fln/backend`.
