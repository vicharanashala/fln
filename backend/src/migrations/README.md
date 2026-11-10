# migrations

## Overview
One-off data migration and reporting scripts for MongoDB content that changed shape. They are run manually and are not part of server startup.

## Interface
- `cleanInlineSvgFromDb.ts`: removes inline SVG/HTML from `questionBank.svgHtml` and `levelHtmlTemplates.htmlContent` now that file-based replacements exist. `questionBank.svgHtml` is replaced by files under `frontend/public/assets/svg/legacy-question-bank/` (checked via `manifest.json`); `levelHtmlTemplates.htmlContent` is replaced by the original source directory `FLN SVG HTML files(22-59)/*.html` at the repo root (checked by counting `.html` files). Dry run by default; `--apply` unsets the fields.
- `questionTemplateIntentV1.ts`: classifies stored question templates against the intent model. Exports `Classification` (`structured | legacy-free-text | hybrid | needs-review`) and `classify`. Report only by default. With `--apply` it calls `dbStore.updateQuestionTemplate` to set `paramMode` on every row not classified `needs-review`; `stem` and `answerSpec` are left as they are.

## Invariants
- `cleanInlineSvgFromDb.ts` refuses to touch a collection unless the file-based replacement looks complete in the current checkout. The guard is a count comparison (manifest entries >= rows with `svgHtml`; source `.html` files >= rows with `htmlContent`), not a per-row check that each row maps to a file.
- Known limitation: when that guard fails, the script only logs an `ABORT` message and does not set a non-zero exit code.
- Both scripts default to read-only reporting; writes need the explicit `--apply` flag.
- Intent classification is not auto-rewritten, because converting a stem into a generation intent is a pedagogy judgement.

## Side Effects
- Both scripts `import 'dotenv/config'`, which reads `.env` from the current working directory, not `backend/.env`. Run from the repo root (as below), set `MONGODB_URI` in the environment or in a root `.env`, or run from `backend/`.
- `cleanInlineSvgFromDb.ts` connects to `MONGODB_URI` with no fallback or check. `questionTemplateIntentV1.ts` uses `connectDB()`, so with `MONGODB_URI` unset it silently runs against the local file store.
- `cleanInlineSvgFromDb.ts --apply` unsets fields in Mongo collections. `questionTemplateIntentV1.ts --apply` writes `paramMode` on question templates.

## Verification
- Run: `npx tsx backend/src/migrations/cleanInlineSvgFromDb.ts` (dry run)
- Repo tests: `npm test --workspace @fln/backend`
