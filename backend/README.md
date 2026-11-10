# FLN Backend (`@fln/backend`)

## Overview
npm workspace package holding the FLN API server and its operator tooling. The live server is `src/` (Express + MongoDB, TypeScript, run with `tsx` in dev and bundled by esbuild to `dist/server.cjs` for production). `fln-backend/` is a separate, standalone Express + Puppeteer batch worksheet renderer. `scripts/` holds operator-run maintenance scripts. `tests/` holds the backend test suite (test-only, not documented separately).

## Interface
- `package.json` scripts: `dev` (`tsx src/index.ts`), `build` (esbuild bundle), `start` (`node dist/server.cjs`), `lint` (`tsc --noEmit`), `test` and the many `test:*` subsets, plus `dev:old` (same as `dev`), `dev:new` (`tsx src/server.ts`, a file that does not exist, so it fails), `seed`, `seed:html`, `seed:levels`, `seed:question-bank`, `seed:balvatika-questions`, `seed:geo` (`tsx src/utils/seedGeo.ts`, also missing), `reseed` and `audit:aadhaar`. `.env.example` lists the environment variables.
- `test_submit.cjs`: manual smoke script that POSTs a diagnostic submission to `http://localhost:3000/api/students/s1/diagnostic/submit`. It is not part of `npm test`.
- Subdirectories:
  - [src](./src/README.md) - the API server, persistence, auth, paper generation, evaluation and certification.
  - [fln-backend](./fln-backend/README.md) - standalone Puppeteer batch worksheet generator.
  - [scripts](./scripts/README.md) - operator maintenance scripts (Aadhaar-at-rest audit, archetype renaming).

## Invariants
- `src/` is the only server wired to the frontend; `fln-backend/` is a separate process that shares no in-memory state with it, but it does render the static page `frontend/public/worksheets/levels_main.html` from the frontend package. `src/` also depends on it and on `ai-services/`: it calls `fln-backend` over HTTP at `LEVELS_BACKEND_URL` (default `http://127.0.0.1:4000`, `src/levelsBackendClient.ts:19`) and spawns `ai-services/scripts/pdf_rasterize.py` (`src/routes/evaluation.ts`).
- `test_submit.cjs` assumes a locally running dev server on port 3000 and a seeded demo student `s1`; never point it at a shared environment.

## Side Effects
- `npm run dev` / `npm start` listen on `PORT` (default 3000, `src/index.ts:178`) and open a MongoDB connection when `MONGODB_URI` is set; without it the server falls back to the local file store `backend/data/db.json` (which CI relies on). `LEVELS_BACKEND_URL`, `PYTHON_BIN` and `AI_SERVICES_DIR` configure the neighbouring services.
- `npm run reseed` wipes every collection and re-seeds the demo dataset (`src/reseed.ts`), and `npm run seed` drops all collections before seeding (`src/seed.ts:299`).
- `npm run build` writes `dist/server.cjs` and a sourcemap.
- Several `test:*` scripts write bundled test output under `tests/dist/`.

## Verification
- Run: `npm test --workspace @fln/backend` (from the repo root; requires `npm install` first)
