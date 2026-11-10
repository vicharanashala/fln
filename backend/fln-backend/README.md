# FLN Worksheet Batch Generator — Backend

## System Overview

Express + Puppeteer backend that generates personalized worksheets, answer keys, and OMR
coordinate maps for a whole class in one batch, by driving the existing browser app
(`frontend/public/worksheets/levels_main.html`) headlessly — no worksheet-generation logic is reimplemented server-side.

## What's reused unmodified vs. what's new

**Reused unmodified** (must be the real, complete files from the browser app):
- `frontend/public/worksheets/levels_main.html` — the page `services/renderWorksheet.js` loads. It defines
  `GENERATORS`, `LEVELS`, `levelSublevelIds`, `buildWorksheet`, `buildAnswerKeyForSet`,
  `buildCleanAnswerKey`, `captureCoords` and `makeHiddenContainer`, and loads html2canvas + jsPDF +
  jszip from CDN as the browser does. It also provides the `#studentName` and `#studentId` inputs that
  the renderer fills in before building each worksheet.
- `app/index.html` and `app/icons.js` — an older snapshot of the browser app (about 8,750 lines, with its
  own complete `GENERATORS` and `LEVELS`). The render service does not load it; it is used only by
  `scripts/debug-page.js`, and it has diverged from `levels_main.html`.

**New** (this backend):
- `server.js` — Express app entrypoint.
- `services/renderWorksheet.js` — Puppeteer wrapper. Loads `levels_main.html` in a headless
  page, calls `buildWorksheet` / `buildCleanAnswerKey` / `captureCoords` in-page, and
  reproduces the same section-by-section `html2canvas` → `jsPDF` pagination loop the
  original `buildPdfBlob()` uses (necessary because that function reads from a
  browser-only global array we don't have server-side; the math/logic is copied 1:1).
  Beyond the page's own globals it also fills the student name and ID inputs, falls back to
  `.worksheet-header-full` when a sublevel has no `.page-header`, stamps a `SET-xxxxx` label on
  each PDF page, and builds `question_paper.json` from the answer key.
- `services/storage.js` — writes each rendered set to disk and streams a batch ZIP with
  `jszip`.
- `services/batchProcessor.js` — orchestrates roster × sublevel × set combinations across a
  small pool of Puppeteer pages, tracks progress in memory.
- `routes/generate.js`, `routes/download.js` — the three HTTP endpoints (`POST /api/generate-batch`,
  `GET /api/batch-status/:batchId`, `GET /api/download-batch/:batchId`).
- `public/index.html` — minimal two-button demo page (inline styles only). It does not poll
  `batch-status`: after the 202 it logs "Batch complete" and enables Download immediately, so a download
  taken before rendering finishes can return a partial or missing ZIP.

## Setup

```bash
npm install
npm start
# -> http://localhost:4000
```

Puppeteer downloads its own bundled Chromium on `npm install`. If you're on a locked-down
CI/host, you may need `puppeteer` launch args beyond `--no-sandbox` (already included) —
see `services/renderWorksheet.js`.

Environment variables:
- `PORT` — HTTP port (default `4000`).
- `RENDER_CONCURRENCY` — number of Puppeteer pages rendered in parallel per batch (default
  `4` in `services/batchProcessor.js`). Raise cautiously; each page runs full `html2canvas` rasterization per section.

## API

### `POST /api/generate-batch`

Body: an array of roster entries.

```json
[
  { "studentName": "John Doe", "rollNumber": "12", "levelId": 26, "sublevelId": "26.0", "setsPerSub": 1 },
  { "studentName": "Jane Smith", "rollNumber": "13", "levelId": 41 }
]
```

- `sublevelId` — optional. `"all"` (default) renders every sublevel of that level (resolved
  via the app's own `levelSublevelIds`); or a specific id like `"26.0"`.
- `setsPerSub` — optional, default `1`. Number of sets to generate per resolved sublevel.
- `studentData` — optional object per entry, spread into the student passed to the renderer.
- An unknown `levelId` raises no HTTP error: it is recorded only in `manifest.students[].error` with `files: []`. An unknown specific `sublevelId` resolves to zero jobs silently. The 202 response always returns `errors: []`.

Response:

```json
{ "batchId": "a1b2c3d4e5f6", "studentsProcessed": 2, "totalFiles": 0, "errors": [] }
```

The response is `202 Accepted` and returned immediately; rendering continues in the background,
so `totalFiles` is `0` here. Poll `/api/batch-status/:batchId` for progress.

Files land under `storage/{batchId}/{RollNo-12_John_Doe}/{sublevelId}_set{n}/`:
`worksheet.pdf`, `answer_key.json` (shape from `buildCleanAnswerKey`), `coords.json` (shape
from `captureCoords`), and `question_paper.json`.

### `GET /api/batch-status/:batchId`

Returns in-memory progress:

```json
{ "status": "running", "processed": 3, "total": 5, "message": "Rendered 3/5 (...)" }
```

A failed batch additionally carries an `error` field.

### `GET /api/download-batch/:batchId`

Streams one ZIP of the whole batch folder (every student's files) plus a top-level
`manifest.json` (roster, level assignments, and relative file paths — mirrors the shape of
the original client's `exportSetsAsZip()` manifest, keyed by student instead of set index).
The ZIP also contains flat copies under `all_worksheets/` (`<student>_<sublevel>.pdf`, `_answer_key.json`, `_coords.json`, `_question_paper.json`).

## Non-goals (per spec)

- No changes to `GENERATORS`, `LEVELS`, the difficulty engine, or any SVG helper in
  `icons.js`.
- No change to worksheet visual layout, `answer_key.json` shape, or `coords.json` shape —
  downstream ICR marking depends on these exactly matching `buildCleanAnswerKey` /
  `captureCoords`.
- No UI polish beyond the two buttons in `public/index.html`.

## Local Interface & Invariants
- `server.js` builds the Express app, mounts `/api` routers, serves `public/` statically, and listens on
  `127.0.0.1:${PORT || 4000}`. It exits quietly on `EADDRINUSE` and closes the shared Puppeteer browser on
  `SIGINT`/`SIGTERM`. It exports `app`.
- Request body limit is 5 MB; the server binds to loopback only.

## Subdirectories & System Boundaries
- app: [./app/README.md](./app/README.md) - snapshot of the browser worksheet app and icon helpers (used by the debug script).
- routes: [./routes/README.md](./routes/README.md) - `/api` HTTP endpoints for generate, status, download.
- scripts: [./scripts/README.md](./scripts/README.md) - debug diagnostics.
- services: [./services/README.md](./services/README.md) - Puppeteer rendering, batch orchestration, storage and ZIP.
- public: static two-button demo page (assets, not documented separately).

## Global Invariants
- Worksheet logic is never reimplemented server-side; only the browser page's globals are called.
- `answer_key.json` and `coords.json` shapes must match `buildCleanAnswerKey` / `captureCoords`.
- Batch status is in-memory only; generated files persist under `storage/`.

## Global Side Effects
- Launches headless Chromium; writes PDFs and JSON under `storage/` (gitignored); reads `frontend/public/worksheets/levels_main.html`.

## System Verification
- Run: no `test` script exists in `package.json` (only `start` and `dev`). Use `node scripts/debug-page.js` and `npm start` plus curl as a smoke check.
