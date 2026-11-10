# routes

## Overview
Express routers for the batch worksheet HTTP API. Both are mounted at `/api` in `../server.js`.

## Interface
- `generate.js` exports a router:
  - `POST /api/generate-batch` takes a non-empty JSON array of `{ studentName, rollNumber?, levelId, sublevelId?, setsPerSub?, studentData? }`. It validates each entry (object, numeric `levelId`, non-empty `studentName`, else 400) and starts rendering in the background. It responds `202 { batchId, studentsProcessed, totalFiles: 0, errors: [] }`; `totalFiles` is not yet known at that point.
  - `GET /api/batch-status/:batchId` returns `{ status, processed, total, message, startedAt, finishedAt? }`, or 404.
- `download.js` exports a router:
  - `GET /api/download-batch/:batchId` streams `batch_<id>.zip` (404 if the batch directory is missing, 500 if zipping fails).
- Depends on [../services/README.md](../services/README.md).

## Invariants
- `generate-batch` never blocks on rendering; clients must poll `batch-status`, then download.
- `batchId` from the URL is passed through `sanitize()` before touching the filesystem.
- Downloading a batch that is still running returns whatever is on disk so far.

## Side Effects
- `generate-batch` creates an in-memory batch record and kicks off Puppeteer rendering that writes under `storage/`.
- `download-batch` reads the batch directory and streams the response.

## Verification
- Run: `npm start` and exercise the endpoints with curl (no test script is defined in `package.json`).
