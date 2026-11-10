# scripts/ci

## Overview

The pull-request gate. `pr-checks.sh` is the single entry point (`npm run check:pr`) that
`.github/workflows/pr-checks.yml` runs against the merge of a PR into main. It composes the
other scripts in this directory with type checks, ESLint, backend and frontend tests, builds,
and two route probes. Several checks use a committed "baseline" file so that problems that
already existed do not block unrelated PRs; only new problems fail.

## Interface

| File | Invoked as | Role |
|---|---|---|
| `pr-checks.sh` | `npm run check:pr [-- <group>...]` | Runs every group (or only those named) and prints a summary. Groups: `consistency` (conflict markers, skill/level snapshot drift, level-count consistency), `types`, `eslint`, `tests-backend`, `tests-frontend`, `build`, `routes` (route smoke test, all-routes check). `PR_CHECKS_LABEL` sets the heading used in the summary and report. An unknown group name exits 2. |
| `check-levels.ts` | `npm run check:levels` (`--list` prints every finding, ignoring the baseline) | Level-count consistency. `CURRICULUM_MAPPING` in `backend/src/config/curriculumMap.ts` is the source of truth; `skillLevelMap.json`, the frontend `LEVEL_SKILL_MAP`, the class ranges in `DBStore.classLevelRange` and `level-history.json` must all agree with it. Also checks that `curriculumMap.ts` levels run contiguously 1..N with each key equal to its `levelNumber`, that `conceptId` values are unique and that stages never decrease. Reports literals of retired counts (59, 93) used as caps or loop bounds, scanning only `.ts`/`.tsx` under `backend/src` and `frontend/src`, and scans `README.md`, `SRS.md`, `PRD.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`, `AGENTS.md` and `CLAUDE.md` for stale level-count labels. |
| `check-routes.ts` | `npm run check:routes` (`--list` prints the route inventory and exits) | Discovers every registered backend route from source, boots the server with no database, and probes each route three ways: no login (must be 401, 403 or 429 unless listed in `public-routes.txt`), as a teacher, and as a superadmin (must not 5xx or hang). Routes outside `/api` (the vault `/v1` routes) are skipped for the teacher and superadmin probes, and template-literal paths are not probed. Also fails on a duplicate METHOD + path registration; `routes-baseline.txt` accepts `DUP METHOD /path` entries for those. Port from `ROUTES_PORT` (default 3998); demo password from `SEED_DEMO_PASSWORD`. |
| `smoke-routes.sh` | `bash scripts/ci/smoke-routes.sh` | Boots the backend on `SMOKE_PORT` (default 3999) with `MONGODB_URI` unset, and calls every parameterless `GET /api` route as superadmin and teacher. Discovery uses a regex that matches only single-quoted `app.get('/api/...')`, so `router.get`, backtick paths and `/api` GETs registered on a router are not covered; `check-routes.ts` uses a wider regex. A 5xx or timeout fails the check. |
| `level-history.json` | data | `current` level count (109) and `retired` counts (59, 93). |
| `levels-baseline.txt` | data | Known stale level-number lines, format `<file> :: <trimmed source line>`. |
| `routes-baseline.txt` | data | Known route problems, format `METHOD /path <probe>   # reason`, where probe is `anon`, `teacher` or `superadmin`. |
| `smoke-baseline.txt` | data | Parameterless GET routes known to fail without a database (one path per line). |
| `public-routes.txt` | data | Routes allowed to answer without a login, format `METHOD /path   # why`. |

## Invariants

- Only new problems fail. When a baselined problem is fixed, delete its line; the scripts report baseline lines that no longer match.
- When the level count changes, set `current` in `level-history.json` to the new count and move the old one into `retired`. `check-levels.ts` then fails until every leftover literal of the old count is fixed or baselined.
- `POST /api/reset` is never called while logged in as an admin by `check-routes.ts` (it wipes the database in use).
- `pr-checks.sh` runs every selected section even if an earlier one fails, then prints a summary and exits non-zero if any section failed.
- Backend `test:*` scripts are auto-discovered from `backend/package.json`; no edit to `pr-checks.sh` is needed for a new one.

## Side Effects

- `smoke-routes.sh` and `check-routes.ts` spawn a local backend (`tsx src/index.ts`) and kill it on exit. Both move `backend/data/db.json` aside (`smoke-routes.sh` to `db.json.smoke-backup`, `check-routes.ts` to `db.json.routes-backup`), start from a fresh seed, delete the db afterwards and restore the backup. It also runs `pkill -f "tsx src/index.ts"`, which stops any other local dev backend run that way.
- `smoke-routes.sh` runs `touch` on `smoke-baseline.txt`.
- `pr-checks.sh` writes a report file only if `PR_CHECKS_REPORT` is set, appends to `GITHUB_STEP_SUMMARY` if set, and uses a temp directory for per-section logs. The conflict-marker check reads `git diff` against `HEAD^1` (or `PR_BASE`, default `origin/main`).
- The script runs `npx tsx scripts/generate-skill-level-map.ts --check` from the parent directory as part of the `consistency` group (see [../README.md](../README.md)).

## Verification

- Run: `npm run check:pr` (all groups), or `npm run check:pr -- consistency` / `npm run check:levels` / `npm run check:routes` for one part.
- The repo root has no single test command for `scripts/`; `npm run lint` type-checks the workspaces, not these scripts.
