# scripts

## Overview

Repository-level tooling for the FLN monorepo: local dev startup, one-off MongoDB data
migrations, generators for derived curriculum artifacts, drift and duplicate checks, and the
daily repo-health report. The CI gate lives in the `ci/` subdirectory. Scripts resolve paths
relative to the repo root (the parent of this directory).

## Interface

Subdirectory: [ci/](./ci/README.md) - the pull-request gate (`npm run check:pr`), level-count and route checks, and their baseline files.

Wired up in the root `package.json`:

| Script | npm command | Purpose |
|---|---|---|
| `dev-backend.js` | `npm run dev:backend` | Starts the main API (workspace `@fln/backend`, port 3000) and the levels backend (`backend/fln-backend`, port 4000), skipping whichever port is already in use. The "already running" probe checks fixed ports 3000 and 4000 even though both services honour `PORT` (`backend/src/index.ts:178`, `backend/fln-backend/server.js:16`), so a custom `PORT` defeats the skip. Stops both on SIGINT/SIGTERM or if one exits non-zero. |
| `check-level-notation-drift.ts` | `npm run check:level-notation-drift` | Compares `Research/02-93-levels/crosswalks/fln_L_to_S_crosswalk.json` with the `sCode` values computed in `frontend/src/data/skillProgressionMap.ts`. Exit 1 on any mismatch. |
| `check-duplicate-questions.ts` | `npm run check:duplicate-questions` (`-- --write-baseline` to regenerate) | Drives the generators in `frontend/public/worksheets/levels_main.html` through Puppeteer (`launchBrowser` from `backend/src/browser`) and flags generators that produce duplicate questions in one set or hang. Exits 1 only on a `bug` finding not in `duplicate-questions-baseline.json`. |
| `repo-health-check.js` | run by `.github/workflows/repo-health-check.yml` | Prints a markdown report: `npm run lint`, the level-notation drift check, and whether `CHANGELOG.md` is more than 5 days behind the latest commit. Exits 1 if anything needs attention. |

Run directly:

| Script | Command | Purpose |
|---|---|---|
| `generate-skill-level-map.ts` | `npx tsx scripts/generate-skill-level-map.ts [--check]` | Builds `backend/src/data/skillLevelMap.json` from `frontend/src/data/skillProgressionMap.ts` (the backend cannot import the frontend module). `--check` exits 1 if the committed file is out of date. |
| `export-levels-docs.js` | `node scripts/export-levels-docs.js` | Regenerates `levels-and-subskills.csv`, `all-levels.md` and `skills-and-subskills.md` in `Research/03-109-levels/` from `skillLevelMap.json`. |
| `build-curriculum-summary.ts` | `npx tsx scripts/build-curriculum-summary.ts` | Writes aggregate counts (`totalConcepts`, `totalStages`, `totalStrands`, `ageMin`, `ageMax`, `maxCellCount`, `stages` and a strand-by-stage `matrix`) from `CURRICULUM_MAPPING` to `frontend/src/data/curriculumSummary.json`. The output contains no bands. Runs as the frontend prebuild step. Exports `MATRIX_BANDS`, which nothing imports. |
| `propose-59-to-93-crosswalk.ts` | `npx tsx scripts/propose-59-to-93-crosswalk.ts` | Writes a DRAFT 59 to 93 crosswalk (`fln_59_to_93_crosswalk.PROPOSED.md` and `.json` under `Research/02-93-levels/crosswalks/`) by title token overlap, for pedagogy review. |
| `sanitize-question-bank-svgs.ts` | `npx tsx scripts/sanitize-question-bank-svgs.ts` | Escapes stray SVG text in `data/questionBank.json` using `escapeStraySvgText` from `backend/src/utils/svgEscape.ts` (imported as `.js`). |
| `add_class1_students.ts` | `tsx scripts/add_class1_students.ts [--dry-run \| --apply]` | Adds one Class 1 teacher, class record and 20 students to every existing school in MongoDB. Values are hard-coded or random: 20 students per school, random levels, ages and streaks, a fixed history date of `2026-04-10`, and `targetLevel` capped at the retired 93 (`:76`) although the curriculum now has 109 levels. It lives outside `backend/src` and `frontend/src`, so `check-levels.ts` does not scan it. |
| `backfill_missing_class_records.ts` | `tsx scripts/backfill_missing_class_records.ts [--dry-run \| --apply]` | Inserts missing `classes` documents for students whose school, class and section have none. A class with no teacher-owned student gets the placeholder `teacherId: 'unassigned'` (`:73-75`). |

Data file: `duplicate-questions-baseline.json` is the committed ratchet baseline for the duplicate-question check.

## Invariants

- Generated files must not be hand-edited. Change the source (`skillProgressionMap.ts`, `skillLevelMap.json`, `curriculumMap.ts`) and re-run the generator. CI runs `generate-skill-level-map.ts --check`.
- `propose-59-to-93-crosswalk.ts` never decides a mapping. The reviewed output must be saved as `Research/fln_59_to_93_crosswalk.json` (the path `backend/src/seedCurriculumLevels.ts:37` reads, which is not the `Research/02-93-levels/crosswalks/` directory the draft is written to) before `npm run seed:levels` will consume it; moving and renaming it is the human sign-off.
- The Mongo migration scripts default to dry-run: they write only when `--apply` is passed. `backfill_missing_class_records.ts` is idempotent (keyed on schoolId, className, section). `add_class1_students.ts` generates ids deterministically per school and, with `--apply`, skips any school whose Class 1 teacher id already exists (it only checks the teacher id), so re-runs do not duplicate that school's batch; run `--dry-run` first anyway.
- `check-duplicate-questions.ts` only reads `levels_main.html`; it never edits it. Only `--write-baseline` modifies the baseline file.
- `build-curriculum-summary.ts` refuses to write when `CURRICULUM_MAPPING` is empty and emits aggregates only, never per-level readiness (the landing page is public).

## Side Effects

- `add_class1_students.ts` and `backfill_missing_class_records.ts` read `MONGODB_URI` from `backend/.env` and, with `--apply`, insert into the live database.
- `sanitize-question-bank-svgs.ts` rewrites `data/questionBank.json` in place when any SVG changes.
- `generate-skill-level-map.ts` (no flag), `export-levels-docs.js`, `build-curriculum-summary.ts` and `propose-59-to-93-crosswalk.ts` write generated files as listed above.
- `check-duplicate-questions.ts` launches a headless browser.
- `dev-backend.js` spawns `npm` child processes and binds ports 3000 and 4000.
- `repo-health-check.js` shells out to `npm run lint`, `npm run check:level-notation-drift` and `git log`, and reads `CHANGELOG.md`.

## Verification

- No test command is configured at the repo root for `scripts/`. Use `npm run lint` (type-checks the workspaces) as the nearest check.
- Drift checks: `npm run check:level-notation-drift`, `npx tsx scripts/generate-skill-level-map.ts --check`, `npm run check:duplicate-questions`.
- Full PR gate, which includes the above: `npm run check:pr` (see [ci/README.md](./ci/README.md)).
