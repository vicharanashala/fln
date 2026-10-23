# Issue #755 — Request body limits

## Problem and fix

The backend previously parsed up to 100 MB on every endpoint, including login.
Normal JSON and URL-encoded requests now have a 1 MB limit. Only these JSON POST
uploads retain 100 MB:

- `/api/icr/check-quality`
- `/api/icr/evaluate-cloud`
- `/api/icr/evaluate-bulk`
- `/api/students/bulk-import`
- `/api/question-templates/import`

The fifth endpoint is needed because `QuestionTemplatePanel.tsx` sends an uploaded
CSV inside JSON. The other upload callers are `IcrTwoStageScan.tsx`,
`BulkIcrScan.tsx`, `StudentListPanel.tsx` and `DiagnosticTestPanel.tsx`.
`BaselineUpload.tsx` sends parsed answers, not the source file.

The allowance applies to whole POST routes, not arbitrary subpaths. Authentication
and upload processing are unchanged. This reduces general parser exposure; it
does not add authentication-before-parsing or replace upload rate limiting.

## Automated checks

From the repository root:

```powershell
npm.cmd run test:request-body-limits --workspace @fln/backend
```

Expected: 18 passing tests. Fourteen parser tests cover small requests, the exact 1 MiB boundary,
a 5 MB login rejection, all five upload paths, trailing slashes/query strings,
other methods and paths, URL-encoded bodies, malformed JSON, compressed bodies,
and an upload exceeding 100 MiB. Tests exercise the production parser over HTTP
without accessing the database or calling OCR services.

Four additional tests in `backend/tests/request-body-uploads.test.ts` exercise the
real authenticated student and evaluation routes with bodies above 1 MiB:

- Student bulk import creates a synthetic student in an isolated temporary store,
  using a test implementation of the vault contract; plaintext identity is not stored.
- Scan-quality checking decodes a real synthetic PNG.
- Single-image OCR forwards the complete image to a local test provider and parses
  its structured response without truncation.
- Unauthenticated uploads return 401 without reaching the vault or OCR provider.

These tests do not call paid services or touch developer data. They verify route
integration, not live OCR accuracy, PDF rasterization, bulk OCR processing or a
production MongoDB/vault deployment.

The new `test:request-body-limits` script is also discovered by `npm run check:pr`.

## Manual local check

1. Use your own local backend/database. Start it with `npm run dev:backend`.
2. In another PowerShell window, run the following against that local server:

   ```powershell
   $payload755 = @{ padding = ('a' * (5 * 1024 * 1024)) } | ConvertTo-Json -Compress
   try {
     Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000/api/auth/login' -Method Post -ContentType 'application/json' -Body $payload755
   } catch {
     [int]$_.Exception.Response.StatusCode
   }
   ```

   Expected: **413**, without needing a login token or creating any record.
3. Start the frontend, sign in normally, and confirm a small login still works.
4. With authorized local accounts, try your normal scan upload and student bulk
   import. Confirm they are not rejected with 413 for a JSON body between 1 and
   100 MB. Other validation errors still apply; use test data only, since real
   imports save data and OCR may call a configured external provider.
5. In Question Intervention, validate an appropriately formatted CSV using
   **Check the file** (dry run). Confirm the large-body allowance also applies to
   this importer. Do not click Import unless you intend to save the test rows.

Limits measure the entire encoded request body, not just the file's disk size.
Base64 increases size. A reverse proxy may impose a smaller limit separately.

## Local verification — 14 October 2026

- All 18 request-limit and authenticated-upload tests passed.
- Full `npm run check:pr` passed with `RUN_BROWSER_TESTS=1` and local Chrome:
  backend/frontend type-checks, backend suites, 80 frontend tests, both builds,
  curriculum snapshot drift and 44-route smoke checks (superadmin and teacher).
- All 23 concept-worksheet tests passed after replacing URL `.pathname` with
  Node's `fileURLToPath()` in the test's generated-PDF cleanup helper. This fixes
  the seven Windows-only `C:\C:` failures without changing worksheet production code.
- Against the temporary real backend, a 5 MB unauthenticated login returned 413.
  The same-sized requests to the five upload paths reached their existing auth
  checks (401/403), rather than being rejected by the body limit. No import was saved.
- The earlier manual checks established size handling and authentication rejection,
  not successful live OCR or a production-vault-backed student import. The added
  automated integration tests close part of that gap under controlled dependencies;
  live-service acceptance remains a separate deployment check.
