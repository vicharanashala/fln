# FLN Worksheet Batch Generator — Backend

Express + Puppeteer backend that generates personalized worksheets, answer keys, and OMR
coordinate maps for a whole class in one batch, by driving the existing browser app
(`app/index.html`) headlessly — no worksheet-generation logic is reimplemented server-side.

## What's reused unmodified vs. what's new

**Reused unmodified** (must be the real, complete files from the browser app):
- `app/index.html` — defines `GENERATORS`, `LEVELS`, `levelSublevelIds`, `buildWorksheet`,
  `buildAnswerKeyForSet`, `buildCleanAnswerKey`, `captureCoords`, `makeHiddenContainer`, and
  loads `icons.js` + html2canvas + jsPDF + jszip from CDN exactly as the browser does.
- `app/icons.js` — the SVG icon helpers. Included here verbatim and complete.

> **Setup note:** `app/index.html` in this delivered project is a partial copy (all the
> SVG/markup helper functions and app state are present, but the full `GENERATORS` object and
> `LEVELS` array — thousands of lines — were left out to keep the handoff a reasonable size).
> **Before running this for real, replace `app/index.html` with your complete, unmodified
> original file.** `app/icons.js` is already complete as-is. The backend code itself never
> needs to change for this swap — it only calls the named globals above via Puppeteer.

**New** (this backend):
- `server.js` — Express app entrypoint.
- `services/renderWorksheet.js` — Puppeteer wrapper. Loads `app/index.html` in a headless
  page, calls `buildWorksheet` / `buildCleanAnswerKey` / `captureCoords` in-page, and
  reproduces the same section-by-section `html2canvas` → `jsPDF` pagination loop the
  original `buildPdfBlob()` uses (necessary because that function reads from a
  browser-only global array we don't have server-side; the math/logic is copied 1:1).
- `services/storage.js` — writes each rendered set to disk and streams a batch ZIP with
  `jszip`.
- `services/batchProcessor.js` — orchestrates roster × sublevel × set combinations across a
  small pool of Puppeteer pages, tracks progress in memory.
- `routes/generate.js`, `routes/download.js` — the two HTTP endpoints.
- `public/index.html` — minimal two-button demo page (no styling).

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
  `2`). Raise cautiously; each page runs full `html2canvas` rasterization per section.

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

Response:

```json
{ "batchId": "a1b2c3d4e5f6", "studentsProcessed": 2, "totalFiles": 5, "errors": [] }
```

Files land under `storage/{batchId}/{RollNo-12_John_Doe}/{sublevelId}_set{n}/`:
`worksheet.pdf`, `answer_key.json` (shape from `buildCleanAnswerKey`), `coords.json` (shape
from `captureCoords`).

### `GET /api/batch-status/:batchId`

Returns in-memory progress:

```json
{ "status": "running", "processed": 3, "total": 5, "message": "Rendered 3/5 (...)" }
```

### `GET /api/download-batch/:batchId`

Streams one ZIP of the whole batch folder (every student's files) plus a top-level
`manifest.json` (roster, level assignments, and relative file paths — mirrors the shape of
the original client's `exportSetsAsZip()` manifest, keyed by student instead of set index).

## Non-goals (per spec)

- No changes to `GENERATORS`, `LEVELS`, the difficulty engine, or any SVG helper in
  `icons.js`.
- No change to worksheet visual layout, `answer_key.json` shape, or `coords.json` shape —
  downstream ICR marking depends on these exactly matching `buildCleanAnswerKey` /
  `captureCoords`.
- No UI polish beyond the two buttons in `public/index.html`.
