# scripts

## Overview
Developer diagnostics. Not part of the server runtime.

## Interface
- `debug-page.js` is a standalone Node script. It launches headless Chromium, loads `../app/index.html`, logs console messages, page errors, and failed requests, then prints a table of whether the globals `renderWorksheet.js` needs (`GENERATORS`, `LEVELS`, `buildWorksheet`, `captureCoords`, `html2canvas`, `jspdf`, `JSZip`, and others) are defined. Run with `node scripts/debug-page.js`. The list it reports (it includes `GENERATORS` and `ICONS`) is maintained separately from `REQUIRED_GLOBALS_CHECK` in `services/renderWorksheet.js` (which does not check those two), so the two can disagree. Neither checks the `#studentName` / `#studentId` inputs that the renderer fills in.

## Invariants
- Read-only: it never writes files.
- It checks `app/index.html`, whereas the server loads `frontend/public/worksheets/levels_main.html`, so a clean report here does not prove the server's target page is healthy.

## Side Effects
- Launches and closes a Chromium process; may make network requests for CDN scripts the page references.

## Verification
- Run: `node scripts/debug-page.js` (this is the check itself; no test suite).
