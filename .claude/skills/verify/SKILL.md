---
name: verify
description: How to run and verify FLN app flows end-to-end (dev servers, mock login, browser driving, QR sync).
---

# Verifying FLN flows

## Launch

From repo root (npm workspaces, one install):

- `npm run dev:backend` → real API on :3000 (JSON-file DB at `backend/data/db.json`)
- `npm run dev:frontend` → Vite on :5173 (~8s to ready). The UI runs on the in-browser mock; unhandled `/api` routes fall through the interceptor to the Vite proxy → :3000.

**Back up `backend/data/db.json` before any import/write test and restore after — it is tracked in git.**

## Auth handles

- Real backend: any `@fln.org` email as `Authorization: Bearer <email>` works (auth is broken by design for now); teacher = `gps-mt-001.t01@fln.org`.
- Frontend (mock): set `localStorage.fln_token = '<email>'` and reload — App calls `/api/auth/me`, mock accepts and lands on the dashboard. The mock DB (`localStorage.fln_mock_db_store`) seeds lazily on the FIRST intercepted API call, i.e. only after login — log in first, then edit the store.

## Browser driving

No Playwright; use the repo's own Puppeteer: `require('D:/fln/node_modules/puppeteer')`, `headless: 'new'` works with the bundled Chromium. Run node from anywhere (require by absolute path).

- Camera-based pages (`/sync`): fake the webcam by overriding `navigator.mediaDevices.getUserMedia` in `evaluateOnNewDocument` to return `canvas.captureStream(15)` and draw test frames onto the canvas on an interval. jsQR decodes 440px QR data-URL images drawn with a white margin fine.
- To force a multi-frame QR export, plant ~60 cloned answerSubmissions with fresh `submittedAt` in the mock store (gzip compresses clones hard; 60 clones ≈ 2 frames).
- Capture the import POST body via `page.on('request')` for replay/idempotency probes with curl.

## Gotchas

- A 404 console error on app load in dev is the PWA manifest (dev-mode only artifact), not a failure.
- Malformed JSON to the backend returns Express's default HTML error page, not JSON (pre-existing).
- PWA/service worker only active in `npm run build` + preview, not dev.
