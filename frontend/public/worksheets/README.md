# Worksheets (static HTML worksheet generators)

## Overview
Static, browser-only worksheet and diagnostic-paper pages served from `public/` (reachable at `/worksheets/<file>`, base-path aware). In dev, `vite.config.ts:37` proxies `/worksheets` to the backend (`VITE_API_TARGET`, default port 3000), which mounts Vite's middleware; Vite on its own defaults to port 5173. The dashboard loads them in an iframe through `src/components/WorksheetIframeModal.tsx`; today the modal still loads only `levels_main.html` from this directory (the Class 1-4 previews come from `proposed-levels/`). Vendored libraries (`html2canvas.min.js`, `jspdf.umd.min.js`, `jszip.min.js`, `qrcode.min.js`) are used by `class1.html` to `class4.html`; `levels_main.html` loads html2canvas, jsPDF and JSZip from cdnjs instead, so it needs network access. `icons.js` (inline B/W SVG icon table) is loaded only by `levels_main.html`; `class1-4.html` define their own inline `ICONS`.

## Interface
- `class1.html` to `class4.html`, `levels_main.html` (personalized per-level generator, mapped to `LEVEL_PERSONALIZED` and the duplicate key `'Level Personalized'` in the modal). `class1.html` to `class4.html` are superseded as dashboard previews (see `WorksheetIframeModal.tsx:12-24`) but remain on disk.
- `icons.js`: `ICONS` map of inline SVG path builders used by `levels_main.html`; of the Python builders only `proposed-levels/_build/build_pre_class_papers.py` parses it.
- [proposed-levels](./proposed-levels/README.md): generated diagnostic papers and their Python builders.
- Parent-frame message contract (documented below): `FLN_WORKSHEET_DOWNLOADED` with `classLevel`, `fileType`, `fileName`, `totalQuestions`.

## Invariants
- Pages must work standalone (no backend call is required to render or download); `levels_main.html` additionally needs network access for its CDN scripts.
- The modal's class-to-file map must point at files that exist; today it requests `proposed-levels/class-N-diagnostic-cognitive.html` for N=1..4 but the Class 1 file on disk is named `class1-diagnostic-cognitive.html`, so verify the name before relying on the Class 1 link.
- Nothing in these pages changes generation logic when the download-notification snippet is added.

## Side Effects
- Downloads files in the browser (PDF/zip/HTML) and, when the snippet below is present, posts a message to the parent window. At the time of writing none of the `.html` files here contain `notifyDashboard`, so the integration described below is still a to-do. On the receiving side `WorksheetIframeModal.tsx:36-43` only `console.log`s the `FLN_WORKSHEET_DOWNLOADED` payload; no dashboard code consumes `classLevel`, `fileType`, `fileName` or `totalQuestions`.

## Verification
- Run: `npm test --workspace @fln/frontend` (vitest run, from repo root) (these static files are not covered by unit tests; open them via the dev server to check).

---

## Developer notes (original, preserved)

### Where your 4 existing HTML files go

Put your already-built files here, renamed exactly like this:

```
public/worksheets/class1.html
public/worksheets/class2.html
public/worksheets/class3.html
public/worksheets/class4.html
```

Vite serves everything in `public/` as-is at the site root, so once the dev
server is running, `class1.html` is reachable at:

```
http://localhost:3000/worksheets/class1.html
```

That was the URL the dashboard's modal originally loaded in an iframe; the modal now maps Class 1-4 to `proposed-levels/class-N-diagnostic-cognitive.html` (see the Invariants above), and the port is the backend's (3000), not Vite's default 5173. **Nothing about
your generation logic changes.**

---

## The one snippet to add to each file

Your files already build the question paper / answer key and trigger the
browser download (you said this part works). Right after that download
fires — wherever your existing code currently does the download trigger
(e.g. wherever you call `link.click()`, `a.download = ...`, or similar) —
add this:

```html
<script>
  // Tell the dashboard a download just completed. Drop this call right
  // after your existing download-trigger code — do not replace anything,
  // just add this block after it.
  function notifyDashboard(fileType, fileName, totalQuestions) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: "FLN_WORKSHEET_DOWNLOADED",
          classLevel: "CLASS_1", // change to CLASS_2 / CLASS_3 / CLASS_4 per file
          fileType: fileType, // "question_paper" or "answer_key"
          fileName: fileName, // use your real filename variable here
          totalQuestions: totalQuestions, // use your real count variable here
        },
        "*"
      );
    }
  }

  // Example of calling it right after your existing download logic:
  // notifyDashboard("question_paper", myFileName, myQuestionCount);
</script>
```

That's it — one function definition, one call, placed after code you
already have. Everything else in your file is untouched.

If a file generates only one type of output (just the paper, or just the
key) call `notifyDashboard` once with the matching `fileType`. If it
generates both in one go, call it twice.
