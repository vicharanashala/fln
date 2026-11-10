# services

## Overview
Core batch-generation logic: a Puppeteer wrapper around the browser worksheet app, a batch orchestrator with in-memory progress tracking, and disk/ZIP storage.

## Interface
- `renderWorksheet.js`
  - `createRenderPage()` opens a page on a shared headless Chromium, loads `frontend/public/worksheets/levels_main.html` (resolved as `../../../frontend/public/worksheets/levels_main.html`), and waits for the required globals.
  - `resolveSublevels(page, levelId, sublevelId)` returns `{ levelTitle, slug, sublevelIds, subIdxs }`, or `null` for an unknown level. An unknown specific `sublevelId` instead returns `{ sublevelIds: [], subIdxs: [] }`, which yields a student with no jobs and no error.
  - `renderStudentSet(page, levelId, subIdx, setNum, student)` returns `{ pdfBuffer, answerKeyJson, coordsJson, questionPaperJson, meta }`.
  - `closeBrowser()` closes the shared browser.
- `batchProcessor.js`
  - `createBatch()`, `failBatch(batchId, err)`, `processBatch(roster, batchId?)`, `getBatchStatus(batchId)`.
  - Status values: `running`, `completed`, `completed_with_errors`, `failed`.
- `storage.js`
  - `STORAGE_ROOT`, `sanitize`, `studentFolderName`, `batchDir`, `saveStudentSet`, `saveManifest`, `readManifest`, `batchExists`, `zipBatch`.
  - Layout: `storage/<batchId>/RollNo-<roll>_<name>/<sublevelId>_set<n>/` holding `worksheet.pdf`, `answer_key.json`, `coords.json`, `question_paper.json`, plus `manifest.json` at the batch root.

## Invariants
- Worksheet content, answer keys, and coordinates come only from the page's own globals; the main duplicated logic is the html2canvas to jsPDF pagination loop in `evaluateRender`, which must stay in sync with the original `buildPdfBlob`. `evaluateRender` also fills the `#studentName` / `#studentId` inputs, falls back to `.worksheet-header-full` for the header, stamps a `SET-xxxxx` label on each page, and builds `questionPaperJson` itself from the answer key.
- A4 layout: 210x297 mm pages, 10 mm margins.
- Concurrency is `RENDER_CONCURRENCY` (default `4` in code, matching the root README).
- Batch status lives only in process memory and is lost on restart; files on disk persist.
- All path segments derived from user input pass through `sanitize()` (alphanumerics, `_`, `-`, space to `_`, max 80 chars).
- A failed job is recorded in `manifest.errors` and does not abort the batch. An unknown `levelId` is recorded instead in `manifest.students[].error` with `files: []`.
- `zipBatch` also adds flat copies under `all_worksheets/`.

## Side Effects
- Spawns Chromium (`--no-sandbox`) and keeps it for the process lifetime.
- Reads local HTML via `file://` and loads CDN or local scripts the page references.
- Writes PDFs and JSON under `backend/fln-backend/storage/`, which is gitignored.
- Logs errors to the console.

## Verification
- Run: `node scripts/debug-page.js`, then `npm start` and POST a one-student roster. No test script is defined in `package.json`.
