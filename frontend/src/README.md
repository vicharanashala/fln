# src

## Overview
Entry code for the React 19 + Vite + Tailwind 4 single-page app. `main.tsx` mounts `App` inside TanStack Query and React Router providers (router basename = Vite `BASE_URL`).

## Interface
- `main.tsx`: bootstraps React, `QueryClient` (retry 1, no refetch on focus), `BrowserRouter`, i18n and `index.css`.
- `App.tsx`: default `App`; restores the session via `/api/auth/me`, owns token and theme state, routes `/register-coordinator` to the registration page and everything else (`path="*"`, `App.tsx:174`) to Landing/Login/Layout plus panels; panel switching is by `activePanel` state and `PanelViews`, not by React Router paths. It also implements the Announcements and Settings views inline (`:215-300`); the "High-Contrast Border Outlines" and "Audio voice narration" checkboxes there have no state or handler.
- `types.ts`: shared domain types (`UserRole`, `User`, `Student`, `School`, `Worksheet`, `EvaluationReport`, `Ticket`, `QuestionTemplate`, `QuestionBankEntry`, `CurriculumLevel`, and others).
- `constants.ts`: `FLN_STRANDS`, `FLN_LEVELS`, location name maps and `INITIAL_*`/`MOCK_*` seed fixtures. Only `STATE_NAMES`, `DISTRICT_NAMES` and `BLOCK_NAMES` are imported anywhere in `src`; the strands, levels and fixtures are unused.
- `index.css`: Tailwind import and theme tokens, Google font imports.
- Subdirectories: [components](./components/README.md), [data](./data/README.md), [hooks](./hooks/README.md), [i18n](./i18n/README.md), [pages](./pages/README.md), [services](./services/README.md), [utils](./utils/README.md).

## Invariants
- Auth token lives in `localStorage.fln_token`, theme in `fln_theme`; a `fln_unauthorized` event logs the user out. Other persisted keys: `fln_language` (`i18n/i18n.ts`), `fln_font_size` and `fln_sidebar_collapsed` (`components/Layout.tsx`), and `fln_roster_filter:*` (`hooks/useRosterFilters.ts`).
- Backend calls go through `services/apiClient` so deployment under a subpath (`VITE_BASE_PATH`) keeps working. One exception: `components/panels/DiagnosticTestPanel.tsx:130` calls raw `fetch` for the diagnostic PDF URL, bypassing `apiFetch`.
- `UserRole` values must match the backend role strings.

## Side Effects
- Reads and writes `localStorage`, toggles the `dark` class on `document.documentElement`, performs `/api` requests, loads Google Fonts.

## Verification
- Run: `npm test --workspace @fln/frontend` (vitest run, from repo root)
