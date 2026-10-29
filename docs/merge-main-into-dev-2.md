# Main integration into dev-2

Integrated upstream `main` at `e03a8cbb275744a399e14ba3e733011e779539df`
with project `dev-2` at `e14d4620fef71b3b259d94456663b2f64b714af0`.
The branches differed by 940 upstream commits and 25 project commits.

## Conflict resolutions

- Kept upstream's database implementation, domain types, migrations, authentication,
  vault, role scope, route modules, dashboard modules, and paper generator.
- Extended the upstream store with scan-template contracts and per-paper/page Mongo
  upserts; file storage supports existing files without a scan-template collection.
- Preserved dev-2's complete model service, sample papers, QR/fiducial/ROI scanner,
  paper renderer, question selection, and one-command launcher.
- Kept standard upstream scanning and added the local TrOCR workflow as a scanner
  choice. Both use the authenticated, deployment-base-aware API client.
- Added a QR/local TrOCR paper choice to bulk diagnostics while retaining upstream
  generation locks, answer-key validation, worksheet records, and test history.
- Moved dev-2 scan endpoints into `backend/src/routes/scan.ts` and applied upstream
  student-access rules to template retrieval, processing, and finalization.
- Kept upstream's removal of the old LogbookPanel and Axios API service; their
  replacements remain present. Regenerated the workspace lockfile with both
  branches' required packages.
- Preserved the project's tracked database file without test-generated changes.

## Verification

- All 2,191 tracked upstream paths are present in the integrated working tree.
- No unresolved Git index entries or merge markers in integrated source files.
- `npm run lint`: passes frontend and backend TypeScript checks.
- `npm run build`: passes frontend and backend production builds.
- Frontend test suite: 90 passing tests across 10 files.
- Backend default test suite: passes. All 44 `test:*` backend scripts also pass.
- Additional backend tests for answer keys, scan keys, paper types, administrator
  scope, file-store fallback, worksheet content/layout, student history, and roster
  filters: 71 passing tests.
- `backend/tests/scan-integration.test.ts`: 3 passing integration tests covering real
  PDF/template generation, authentication/school scope/QR identity, and Mongo upserts.
- Python model contract and pipeline suites: 18 passing tests.
- ESLint, curriculum level count and generated skill-map consistency checks: pass.
- Live route checks: 139 routes, 400 requests as anonymous/teacher/superadmin;
  12 pre-existing baseline findings and zero new findings. The launcher was adapted
  in memory for Windows so the repository source remained unchanged.

The upstream `check:pr` Bash wrapper fails before executing checks on this Windows
host (`NAMES: unbound variable`); the checks above were invoked directly. The separate
Bash smoke wrapper was not run. The production build reports an existing bundle-size warning. Upstream files retain
their existing whitespace. Live Atlas connectivity and inference with downloaded
TrOCR weights were not exercised; the tests use local stores and contract fixtures.
File presence and retained merge ancestry establish upstream inclusion, while the
listed tests cover specific behaviors rather than every possible application flow.

## Using the retained local scan workflow

In Bulk Diagnostic Generator, choose **QR / local TrOCR paper**. In Scan & Upload,
choose **QR / local TrOCR scanning**. Standard diagnostic generation and standard/bulk
scanning remain the defaults. `npm run dev` starts the project's local services.
