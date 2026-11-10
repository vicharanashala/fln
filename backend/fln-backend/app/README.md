# app

## Overview
A snapshot copy of the browser worksheet app (`index.html`) and its SVG icon helpers (`icons.js`). The backend was designed to drive this app headlessly instead of re-implementing worksheet generation. Note that the render service currently loads `frontend/public/worksheets/levels_main.html` (see `../services/README.md`), not this copy; this directory is used only by `../scripts/debug-page.js`. The two files have diverged (`index.html` is 8,753 lines, `levels_main.html` 8,886), so this copy is not a reliable stand-in for the live page.

## Interface
- `index.html` (about 8,750 lines) defines the browser globals the backend depends on: `GENERATORS`, `LEVELS`, `levelSublevelIds`, `buildWorksheet`, `buildAnswerKeyForSet`, `buildCleanAnswerKey`, `captureCoords`, `makeHiddenContainer`.
- `icons.js` defines `ICONS`, `MEASURE_ICONS`, and helpers `icon`, `iconStretched`, `iconRotated`, `iconRow`, `measureIcon`, `clipIcon`, `sw`.

## Invariants
- Treated as unmodified third-party input: do not edit to suit the backend; the backend only calls the named globals.
- The `answer_key.json` and `coords.json` shapes come from `buildCleanAnswerKey` / `captureCoords`; downstream ICR marking depends on them.

## Side Effects
- None on the server. In a browser, `index.html` loads html2canvas, jsPDF, and jszip.

## Verification
- Run: `node scripts/debug-page.js` from `backend/fln-backend` (reports which required globals are defined). No automated tests exist.
