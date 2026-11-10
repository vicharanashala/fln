# services

## Overview
Thin API-access layer. `apiClient.ts` is the single door to the backend: components call `apiFetch` instead of raw `fetch` (the one exception is `components/panels/DiagnosticTestPanel.tsx:130`, which fetches the diagnostic PDF URL directly), so the base path (`import.meta.env.BASE_URL`, set via `VITE_BASE_PATH`) and the auth token are handled in one place.

## Interface
- `apiClient.ts`: `withBase(path)`, `apiFetch(path, init)` (adds `Authorization: Bearer` from `localStorage.fln_token` unless already set).
- `coordinatorService.ts`: `fetchStates`, `fetchDistricts`, `fetchBlocks`, `fetchSchools`, `createTeacher` (calling `/api/states`, `/api/districts/by-state/:id`, `/api/blocks/by-district/:id`, `/api/schools/by-block/:id` and `POST /api/teachers`; it re-reads `fln_token` itself through its own `authHeaders()`) plus types `State`, `District`, `Block`, `School`, `CreateTeacherPayload`, `CreateTeacherResponse` (used by `../pages/CoordinatorRegistration.tsx` via `../hooks/useCoordinator.ts`).
- `paperTypeConfig.ts`: `fetchPaperTypeConfig(paperType)`, `paperRequestBody`, types `PaperType` (diagnostic | midline | endline | personalized), `PaperTypeConfig`.
- `simulatedAnswers.ts`: `morphologyForStudent`, `simulateWrongAnswer`, type `SimulatedMorphology` (shaped wrong answers for the Simulation Controls).

## Invariants
- A 401 response from any path other than `/api/auth/login` (matched with `path.includes`) removes `fln_token` and dispatches a `fln_unauthorized` window event; `App.tsx` listens for it.
- `paperTypeConfig.ts` reads question counts per paper type from the backend (`/api/paper-types/:type/config`) and never hard-codes them; malformed config throws a readable Error. Its `fetchPaperTypeConfig` and `paperRequestBody` have no caller outside `paperTypeConfig.test.ts`: `WorksheetTemplatesPanel.tsx` calls the different `/api/paper-types/config` (all types) endpoint and imports only the `PaperTypeConfig` type.
- `simulatedAnswers.ts` only generates wrong values; classification stays in the backend `misconceptionFingerprint`. Generated answers must remain wrong.

## Side Effects
- Network calls to `/api/*`; reads and clears `localStorage.fln_token`; dispatches `fln_unauthorized`.

## Verification
- Run: `npm test --workspace @fln/frontend` (vitest run, from repo root)
