# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

FLN Assessment & Personalized Worksheet Platform — an AI-driven system that assesses each child's foundational **Mathematics** numeracy level (Classes 2–4), generates level-personalized printable worksheets, ingests scanned answers, evaluates them, and rolls data up a 7-role national hierarchy. See [SRS.md](SRS.md) (authoritative spec), [PRD.md](PRD.md) (product framing), [AUDIT.md](AUDIT.md) (current code health), and [MIGRATION_PLAN.md](MIGRATION_PLAN.md) (target structure).

**Stack:** MERN-ish — React 19 + Vite + Tailwind (frontend), Node/Express + TypeScript (backend), Python (AI evaluation pipeline), Google Gemini (LLM). The repo is an **npm-workspaces monorepo**: `frontend/`, `backend/`, `ai-services/` (see Layout).

## ⚠ Critical thing to understand before editing

**There are two parallel backends, and the running app uses the wrong one.**

- The React app installs a `fetch()` interceptor at boot (`frontend/src/main.tsx:8` → `setupFetchInterceptor()`), so **every `/api/*` call is answered inside the browser** by `frontend/src/mock/fetchInterceptor.ts` against a `localStorage` store (`frontend/src/mock/dbStore.ts`). The real server is never contacted by the UI.
- A **real backend exists** at `backend/` (Express) + `ai-services/` (Python) that *appears to* implement most of the SRS (generation locks, defaulter escalation, Aadhaar masking, role-scoping, real Gemini, real PDF generation) — this is from static reading, **unverified** by running the flows end-to-end. It boots and answers the API directly (verified via curl); the UI just doesn't call it.

When asked to change "backend behavior," ask **which** backend — the mock (what the UI shows) or the real server (what should eventually be used). Business logic is currently duplicated across both, plus partly re-computed in the React components. Do not add a third copy.

See AUDIT.md for the full list; the migration direction is to delete the mock and wire the frontend to the real server (MIGRATION_PLAN.md).

## Layout

```
fln/                          # npm-workspaces monorepo root (package.json = workspaces)
├── frontend/                 # @fln/frontend — React + Vite app (standalone)
│   ├── index.html  vite.config.ts  tsconfig.json  package.json
│   ├── public/worksheets/    # worksheet HTML templates — ALSO read by the backend (Puppeteer)
│   ├── public/mock/*.json     # a redundant mock dataset (leftover; slated for deletion)
│   └── src/
│       ├── main.tsx          # installs the mock fetch interceptor (see warning above)
│       ├── App.tsx           # top-level views + role switch
│       ├── constants.ts      # 763 ln of hardcoded seed data
│       ├── mock/             # the in-browser fake backend (fetchInterceptor.ts, dbStore.ts)
│       ├── utils/levelGenerator.ts   # byte-identical duplicate of backend/src/levelGenerator.ts
│       └── components/       # 24 components; RoleDashboards.tsx (2702 ln) + PanelViews.tsx (1455 ln) are god-files
├── backend/                  # @fln/backend — REAL Node/Express API (API only; no Vite)
│   ├── package.json  tsconfig.json  .env.example
│   ├── data/db.json          # the JSON-file "database" (not MongoDB despite comments)
│   └── src/                  # index.ts, db.ts, gemini.ts, paperGenerator.ts, ...
├── ai-services/              # REAL Python evaluation pipeline (run_pipeline.py, scripts/0..3, prompts/, syllabus/)
└── docs/                     # teacher workflow docs — describe the SERVER's behavior
```

## Commands

Run from the repo root (npm workspaces). One install covers both packages:

```bash
npm install
npm run dev:frontend   # Vite dev server on :5173 (runs the app on the mock — this is what you see today)
npm run dev:backend    # tsx backend/src/index.ts — real API on :3000
npm run build          # builds frontend (vite) then backend (esbuild -> backend/dist/server.cjs)
npm run lint           # tsc --noEmit across workspaces (type-check only; there are no unit tests)
```

The app you see is the **frontend on :5173** (answered by the mock). The real backend is a **separate** process on :3000; in dev the frontend does not proxy to it yet (the mock intercepts `/api`). In production the backend serves `frontend/dist` (`FRONTEND_DIST_DIR`).

Demo login (e.g. `gps-mt-001.t01@fln.org`): **ask the team for the demo password** (do not hardcode or paste it into docs/commits). The Python pipeline needs `python` on PATH; the backend invokes it from `ai-services/` (`AI_SERVICES_DIR` override).

## Environment

- `GEMINI_API_KEY` — required for real AI calls (`backend/src/gemini.ts:9`). Each AI path has a deterministic non-AI fallback, so the server runs without it.
- `PORT` (default 3000), `CHROME_EXECUTABLE_PATH` (Puppeteer PDF generation).
- `AI_SERVICES_DIR` (defaults to `../ai-services`), `WORKSHEET_ASSETS_DIR` (defaults to `../frontend/public/worksheets`), `FRONTEND_DIST_DIR` (prod static serve).
- Copy `backend/.env.example`. Never commit real keys.

## Conventions & gotchas

- **Match the surrounding file's style** — this codebase was AI-generated by non-devs; consistency varies. Don't reformat wholesale.
- **Don't touch `frontend/vite.config.ts` HMR/watch settings** — they're intentionally set for the AI Studio environment (comment in file).
- Magic thresholds recur across many files: max level `59`, certification `currentLevel >= 5`, score bands `80/60`. If you change one, grep for the others (they are NOT centralized). AUDIT §3.3 lists locations.
- The "MongoDB collections" in `backend/src/db.ts` are a single `backend/data/db.json` rewritten in full per mutation — not concurrency-safe.
- **Auth is actively broken, not just weak.** The "token" is a plaintext email, and any `@fln.org` email in a `Bearer` header is auto-promoted to a role inferred from its prefix (`backend/src/index.ts:39-77`). Concretely: sending `Authorization: Bearer superadmin@fln.org` makes you superadmin — no password, no signature. Passwords are never verified (only length-checked). `/api/reset` has no auth at all. Do not build features on top of this identity model; assume every request is unauthenticated until auth is hardened.
- **`npm run lint` is `tsc --noEmit` — it proves types compile, nothing about behavior.** There is no test suite. A green lint tells you nothing about whether a flow works; verify by running the app (`npm run dev:frontend`) and/or curl against the real backend (`npm run dev:backend`). Baseline note: two **pre-existing** type errors exist (`backend/src/index.ts:665`, `backend/src/paperGenerator.ts:233`) — don't add new ones.
- **`.gitignore` is authored as UTF-8/ASCII.** The original root `.gitignore` was UTF-16, which silently broke `node_modules/` matching. If you edit ignore files on Windows, confirm `file .gitignore` says ASCII/UTF-8, not UTF-16.

## Migration rules

The repo is being restructured per [MIGRATION_PLAN.md](MIGRATION_PLAN.md). While that is in progress, follow these hard rules:

- **Current phase:** _structure split done_ — the repo is now a `frontend/` + `backend/` + `ai-services/` npm-workspaces monorepo (was `mvp/`). Next up: shared constants + de-dupe, then wiring the frontend to the real API. Update this line as phases complete.
- **Cut over so far:** _nothing_ — the frontend still runs entirely on the mock interceptor; no `/api` call reaches the real backend yet. Keep a running list here of which features have been moved to the real API.
- **No write/mutation cutover before auth is hardened.** Read-only paths may move to the real API; do NOT route any create/update/delete through the real backend while the Bearer-email bypass above still exists.
- **No opportunistic refactors during migration.** Do not split the god-files (`RoleDashboards.tsx`, `PanelViews.tsx`) or dedupe the Teacher/Volunteer dashboards as a side effect of a move. Relocation and restructuring are separate phases (see the plan) — keep each change one kind of change.
- Remove the mock (`src/mock/**`, the `main.tsx` interceptor) only in its dedicated final phase, after every feature is off it — never partially.

## Where new code goes

- **Backend domain logic** → `backend/src/modules/<domain>/` (auth, students, worksheets, evaluation, governance, …). These modules don't exist yet — `backend/src/index.ts` is still one 1580-line file; add to the matching area until the module split phase. One home per domain — don't scatter.
- **Shared thresholds/constants** (`59`, cert `>=5`, score bands, timing windows) → a `shared/` location (not yet created). Never re-inline a new magic number; reference the shared value.
- **Never add to `frontend/src/mock/`** — it is being deleted. New data-fetching goes through the real API (via the planned `apiClient`), not the interceptor.
- **No business logic in React components** — scoring, level assignment, locks, certification, ID generation belong on the backend. This is an existing anti-pattern being unwound, not a pattern to copy.
- Keep answer keys and student PII **out of the frontend bundle** (both currently leak — AUDIT §2.13, §3.2).
