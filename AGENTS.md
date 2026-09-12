# AGENTS.md

Guidance for AI coding agents (Codex, Cursor, Windsurf, …) working in this repository. This file mirrors [CLAUDE.md](CLAUDE.md) — the maintained source of this guidance; keep the two in sync when either changes.

## What this is

FLN Assessment & Personalized Worksheet Platform — an AI-driven system that assesses each child's foundational **Mathematics** numeracy level (Classes 2–4), generates level-personalized printable worksheets, ingests scanned answers, evaluates them, and rolls data up a 7-role national hierarchy. See [SRS.md](SRS.md) (authoritative spec), [PRD.md](PRD.md) (product framing), [AUDIT.md](AUDIT.md) (current code health), and [MIGRATION_PLAN.md](MIGRATION_PLAN.md) (target structure).

**Stack:** MERN-ish — React 19 + Vite + Tailwind (frontend), Node/Express + TypeScript (backend), Python (AI evaluation pipeline), Google Gemini (LLM). The repo is an **npm-workspaces monorepo**: `frontend/`, `backend/`, `ai-services/` (see Layout).

## ⚠ Critical thing to understand before editing

**The app uses the real backend only. No mock backend should run.**

- The source of truth for all `/api/*` calls is the Express server at `backend/` (+ `ai-services/` Python pipeline). It implements the SRS: generation locks, defaulter escalation, Aadhaar masking, role-scoping, real Gemini, real PDF generation. It boots on `:3000` and is verified to answer the API directly via curl.
- The legacy in-browser mock (`frontend/src/mock/fetchInterceptor.ts`, `frontend/src/mock/dbStore.ts`) and the `setupFetchInterceptor()` call that previously lived at `frontend/src/main.tsx:8` are **deleted**. The frontend must talk to the real backend — no fallback, no parallel store.
- Any leftover `frontend/src/mock/**` files, the `public/mock/*.json` dataset, the `frontend/src/constants.ts` hardcoded seed, and `frontend/src/utils/levelGenerator.ts` (a byte-identical duplicate of `backend/src/levelGenerator.ts`) are slated for deletion — never reference them in new code.
- When asked to change "backend behavior," edit `backend/src/**` only. Do not reintroduce a second copy of business logic in the frontend.

See AUDIT.md for the full cleanup list and MIGRATION_PLAN.md for the deletion sequence.

## Layout

```
fln/                          # npm-workspaces monorepo root (package.json = workspaces)
├── frontend/                 # @fln/frontend — React + Vite app (talks to real backend on :3000 via proxy)
│   ├── index.html  vite.config.ts  tsconfig.json  package.json
│   ├── public/worksheets/    # worksheet HTML templates — ALSO read by the backend (Puppeteer)
│   └── src/
│       ├── main.tsx          # React entry; NO fetch interceptor
│       ├── App.tsx           # top-level views + role switch
│       ├── mock/             # deleted (was: fetchInterceptor.ts, dbStore.ts) — do not recreate
│       ├── constants.ts      # 763 ln of hardcoded seed data — slated for deletion; do not extend
│       ├── utils/levelGenerator.ts   # byte-identical duplicate of backend/src/levelGenerator.ts — slated for deletion
│       └── components/       # components; large dashboards are being split into panels/ sub-components
├── backend/                  # @fln/backend — REAL Node/Express API (API only; no Vite)
│   ├── package.json  tsconfig.json  .env.example
│   ├── data/db.json          # JSON-file fallback store (MongoDB is the primary store)
│   └── src/                  # index.ts, db.ts, routes/, services/, gemini.ts, paperGenerator.ts, ...
├── ai-services/              # REAL Python evaluation pipeline (run_pipeline.py, scripts/0..3, prompts/, syllabus/)
└── docs/                     # teacher workflow docs — describe the SERVER's behavior
```

## Commands

Run from the repo root (npm workspaces). One install covers both packages:

```bash
npm install
npm run dev:backend    # tsx backend/src/index.ts — real API on :3000  (REQUIRED; start this first)
npm run dev:frontend   # Vite dev server on :5173, proxies /api -> http://localhost:3000
npm run build          # builds frontend (vite) then backend (esbuild -> backend/dist/server.cjs)
npm run lint           # tsc --noEmit across workspaces (type-check only; there are no unit tests)
```

The app you see is the **frontend on :5173** talking to the **real backend on :3000**. Start the backend first; the frontend's Vite proxy (`vite.config.ts`) forwards `/api/*` to it. There is no in-browser mock — never add one. In production the backend serves `frontend/dist` (`FRONTEND_DIST_DIR`).

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
- **Backend structure is governed by an ADR** — [docs/adr/001-backend-structure.md](docs/adr/001-backend-structure.md): new endpoints go in `backend/src/routes/<domain>.ts` (exporting `register<Domain>Routes(app)`), reusable logic in `backend/src/services/`, data access through the existing `dbStore`. Do not introduce `modules/`, `controllers/`, `models/`, `repositories/`, or `interfaces/` layers, or a second database abstraction (e.g. Mongoose) without reopening that ADR.
- **Auth is hardened.** `backend/src/auth.ts` issues and verifies real signed JWTs (`jsonwebtoken`, `JWT_SECRET`); login (`backend/src/routes/auth.ts`) does a real `bcrypt.compare()` against stored hashes. There is deliberately no role synthesis from the email/prefix — only real, seeded users with a valid signed token authenticate. Still apply normal per-endpoint scrutiny (e.g. `canAccessStudent` scoping).
- **`npm run lint` is `tsc --noEmit` — it proves types compile, nothing about behavior.** There is no test suite beyond the `backend/src/__checks__/` assert scripts. A green lint tells you nothing about whether a flow works; verify by running the app (`npm run dev:frontend`) and/or curl against the real backend (`npm run dev:backend`).
- **`.gitignore` is authored as UTF-8/ASCII.** The original root `.gitignore` was UTF-16, which silently broke `node_modules/` matching. If you edit ignore files on Windows, confirm `file .gitignore` says ASCII/UTF-8, not UTF-16.

## Migration rules

The repo is being restructured per [MIGRATION_PLAN.md](MIGRATION_PLAN.md). While that is in progress, follow these hard rules:

- **Current phase:** _real-backend cutover done (2026-09-02)._ The frontend's `fetch()` interceptor, `src/mock/**`, `public/mock/*.json`, the `constants.ts` seed, and the duplicated `utils/levelGenerator.ts` are all slated for deletion in the cleanup phase. Vite proxies `/api/*` to the Express backend on `:3000`. Do not reintroduce any in-browser mock.
- **Cut over so far:** _all routes._ Every `/api/*` call from the UI reaches the real Express backend. There is no parallel mock store and no fallback path. When you add a new route, add it to `backend/src/**` only.
- **No opportunistic refactors during cleanup.** Do not split the god-files or dedupe the Teacher/Volunteer dashboards as a side effect of removing the mock. Relocation and restructuring are separate phases (see the plan) — keep each change one kind of change.
- Do not re-add the mock interceptor to `frontend/src/main.tsx` under any flag, env var, or "dev-only" mode. If the backend is unreachable, the right fix is to fix the backend, not to fall back to a mock.

## Where new code goes

- **Backend endpoints** → `backend/src/routes/<domain>.ts`, each exporting `register<Domain>Routes(app)` and registered in `backend/src/index.ts`.
- **Reusable backend business logic** → plain modules under `backend/src/services/` (e.g. `services/certificationRecords.ts`). Data access goes through the existing `dbStore` in `backend/src/db.ts` — not through a second ORM/database path. See [docs/adr/001-backend-structure.md](docs/adr/001-backend-structure.md); per the ADR, `modules/`, `controllers/`, `models/`, `repositories/`, and `interfaces/` layers are deliberately not used. Revisit the ADR if a route file grows past ~800 lines or a meaningful test suite makes layer isolation worthwhile.
- **Shared thresholds/constants** (`59`, cert `>=5`, score bands, timing windows) → a `shared/` location (not yet created). Never re-inline a new magic number; reference the shared value.
- **New data-fetching in the frontend** goes through the real API (`frontend/src/services/apiClient.ts`), not an in-browser store.
- **No business logic in React components** — scoring, level assignment, locks, certification, ID generation belong on the backend. This is an existing anti-pattern being unwound, not a pattern to copy.
- Keep answer keys and student PII **out of the frontend bundle** (both currently leak — AUDIT §2.13, §3.2).
