# Changelog — FLN

All notable changes to this repository, grouped by date (newest first).
Auto-curated from git history: pull-request merges and direct commits are listed;
routine branch-sync merges are omitted. Regenerate with `gen_changelog.py`.

## 2026-08-17 — Backend route split (Phase 4) + landing/dashboard honesty pass

- **`backend/src/index.ts` split from 3566 → 126 lines** across 4 sequential PR batches (#211–#215), extracting all route groups into `backend/src/routes/*.ts` (`auth`, `tickets`, `logbook`, `geo`, `classes`, `admin`, `teachers`, `schools`, `interventions`, `bestPractices`, `students`, `worksheets`, `evaluation`, `analytics`, `diagnosticBulk`) plus a shared `backend/src/config.ts`. Zero intended behavior change — each batch verified via `tsc --noEmit` and live curl testing against a scratch MongoDB seed.
  - Caught and fixed mid-split: a single overly-broad `sed` delete during batch D accidentally dropped the worksheets routes along with the evaluation/ICR block. Caught before commit via a systematic route-inventory check (grep every original route path against the split files, confirm exactly one match each); recovered the file from the already-verified batch-C branch.
  - PR #214 was based on `chore/split-backend-routes-batch-c` and merged there before #213 reached `main`, so its changes never landed on `main` until a follow-up fast-forward PR (#215).
- **fix: authorization gaps on `/api/logbook` and `/api/admin/coordinators`** (#210, carried forward through the route split) — `/api/logbook` is now role-scoped via a schools lookup for Admin/District/Block roles instead of returning all logs; `/api/admin/coordinators` now scopes results to `stateCode` for State Admins instead of returning every coordinator nationally.
- **fix: reset `activePanel` on every session start/end** (#203) — stale panel state no longer survives login/logout.
- **fix: add Home button to dashboard** (#204) — previously the only way back to the landing page was logging out; `Layout.tsx` now has a Home icon that navigates without clearing the session.
- **fix: remove hardcoded fake trend badges, fake school leaderboard, mislabeled AI-interviews KPI** (#205) — `SuperAdminExecutiveDashboard.tsx` no longer shows invented `+X%` badges or a `SCH-MOCK-1..5` fallback ranking; added an honest empty state, renamed the KPI to "Total Evaluations Completed" with accurate subtext.
- **fix: reduce repetitive FLN Portal branding text on landing page** (#206) — varied copy across the top strip, header subtitle, and hero badge instead of repeating the same full expansion four times.
- **feat: add hover context to landing page stat cards** (#207) — each of the 5 landing stat cards now shows a real derived detail on hover, sourced from `/api/stats` (`certifiedCount`, `certifiedPercent`).
- **fix: comment out (not delete) non-English language options** (#201, follow-up to a stopgap) — Hindi/Punjabi `<option>`s are commented out pending real i18n, replacing a broken `alert()` onChange handler.

## 2026-08-13 — Ideas folder for onboarding contributions

- **Add `Ideas/` folder** (PR #161) — new repo-root location for contributor Onboarding Documents (`ONBOARDING-<name>.md`) to land as PRs, per the onboarding rule already documented in README. No code change; repo structure only.

## 2026-08-11 — README contribution rules

- **README rewritten with mandatory Onboarding Document rules** (PR #160) — added the six-section Onboarding Document requirement (What is FLN, system understanding, current repo state, gaps observed, ideas, contribution) that every new contributor must submit before their first PR, plus review criteria for maintainers checking submissions.

## 2026-08-07 — Cloud OCR provider integration

- **feat(icr): cloud OCR provider toggle + branded UI** (PR #157) — before this, the ICR scanner only ran the local PaddleOCR/EasyOCR pipeline. Added a provider toggle in [frontend/src/components/IcrTwoStageScan.tsx](frontend/src/components/IcrTwoStageScan.tsx) so a scan can run against a cloud OCR API instead, with a dedicated branded button and error panel separate from the local-scan error path.
  - **feat(icr): restore cloud OCR backend endpoint** — backend support for Google Cloud Vision, MiniMax vision, and OCR.space as selectable cloud providers (AWS Textract/Azure stubbed 501, not yet wired). Builds on the provider-key security model introduced 2026-08-06 (keys stay server-side, never sent to the browser).
  - **feat(icr): PDF upload support in the blue-ink filter pipeline** — the blue-pen HSV filter (introduced 2026-08-04) previously only accepted JPEG/PNG; it now accepts PDF uploads directly instead of requiring the user to screenshot a page first.
  - **feat(icr): filter/OCR quality improvements** — further tuning on top of the 2026-08-06 blue-pen filter work.

## 2026-08-06 — ICR scanner quality + cloud OCR providers

- **Blue-pen filter iterated to handle very faint handwriting** ([ai-services/scripts/bluepen_filter.py](ai-services/scripts/bluepen_filter.py))
  - HSV range tuned through 6 versions. Original strict range `H 100-130, S >= 60, V >= 50` only caught the densest pixels of light pen strokes. Widened to `H 95-140, S >= 20, V >= 0` so even very faint pen (e.g. the second digit in "31" when written with decreasing pressure) gets caught.
  - Morphology: `5x5 close` (fills 1-4px stroke gaps from JPEG compression) + `2x2 dilate` (adds ~1px thickness for OCR readability). The earlier `3x3 dilate` made strokes look "puffy/blurry" in the filter preview; `2x2` is the sweet spot.
  - Output as PNG instead of JPEG to avoid compression artifacts on the binary mask.
  - Early-exit on 0-blue-pixels: if the input already has no blue ink (or was already filtered), the filter writes no file and signals `success: false` instead of producing a blank white image that would silently kill EasyOCR downstream.
  - Verified on the WhatsApp multi-digit scan (45, 46, 47, ..., 76): all 22 numbers visible, sharp strokes.

- **Per-component OCR with upscaling fallback** ([ai-services/scripts/easyocr_evaluator.py](ai-services/scripts/easyocr_evaluator.py))
  - When EasyOCR's full-image pass misses a small digit, the pipeline now crops each connected component, pads it, upscales 2x, and re-runs OCR per-crop. Catches marks EasyOCR can't see at full resolution.
  - `_ocr_single_component` takes only the first character of multi-char results to handle EasyOCR's tendency to read "6" as "61".

- **PaddleOCR added as primary OCR engine** ([ai-services/scripts/easyocr_evaluator.py](ai-services/scripts/easyocr_evaluator.py))
  - Installed `paddlepaddle==2.6.2 + paddleocr==2.7.3`. Hit and fixed: ABI mismatch with `opencv-python 4.6.0.66` (uninstalled it), and `imgaug np.sctypes` removed in numpy 2.x (patched `imgaug/imgaug.py`).
  - Wired PaddleOCR's PP-OCRv4 as the primary engine. EasyOCR remains as fallback. Passes the blue-pen-filtered image (not the original) so each number is detected separately.
  - On the user's WhatsApp scan: 19/22 numbers correct in ~2.6s (was 5/22 with EasyOCR at 5-20s).

- **Row-based printed-text exclusion in the filter**
  - For question-paper scans where the printed form has section headers and a number grid in the same color as the handwriting, the filter now groups components by y-band and drops any band with 5+ components at regular horizontal intervals (gap stddev < 30% of median). User's handwriting forms vertical clusters (right column) which survive; printed number grids form horizontal rows which get dropped.
  - Verified on the question paper scan: printed "FILL IN THE MISSING NUMBERS" underline and Section 1 number grid mostly excluded while user's right-column answers (31, 35, 37, ..., 98) and Section 3 answers (4, 4, 4, 4, 5, 6, 4) remain bold and clear.

- **ICR scanner UI: added Cloud OCR button with provider selector** ([frontend/src/components/IcrTwoStageScan.tsx](frontend/src/components/IcrTwoStageScan.tsx))
  - New third BigButton "Run via Cloud API" (purple variant, cloud icon) alongside the existing local OCR button.
  - Backend exposes 5 cloud providers: Google Cloud Vision, AWS Textract (stubbed 501), Azure Computer Vision (stubbed 501), MiniMax vision, OCR.space. Frontend auto-fetches which are configured from `GET /api/icr/cloud-config` and enables the button accordingly.
  - **SECURITY**: API keys are stored server-side only — in env var (`ICR_CLOUD_API_KEY_<PROVIDER>`) or in MongoDB `appConfig.icrCloudKeys` collection set via admin API. The frontend NEVER sees the key. The frontend only knows whether each provider is configured (boolean).
  - Admin endpoint `POST /api/icr/cloud-config` to set/clear keys is gated to `superadmin`/`admin` role (returns 403 for teachers). Test login: `superadmin@fln.org` / `Fln@2026`.
  - The user originally asked for the API key to be entered in the browser — implemented initially, then refactored server-side per the security best-practice concern that keys in `localStorage` are extractable via devtools.

- **New dbStore config helpers** ([backend/src/db.ts](backend/src/db.ts))
  - `dbStore.getConfig(key)` and `dbStore.setConfig(key, value)` for generic key-value config storage in MongoDB `appConfig` collection. Used to persist admin-set cloud OCR keys.

- **Test script for OCR API** ([test_ocr_api.py](test_ocr_api.py))
  - End-to-end test: login → encode image → POST to `/api/icr/evaluate-pdf` → print engine, time, raw text, extracted tokens.

- **Verification at session end**: `npm run lint` passes (0 errors). Both Python files parse. Backend running on :3000 (PID 27908 / tsx child 22128), frontend on :5173 (PID 12420). Cloud OCR providers wired (Google requires billing, MiniMax key rejected by API, OCR.space untested — but local PaddleOCR gives 17/22 on the WhatsApp scan in 2.6s).

## 2026-08-05

- **perf(superadmin): analytics now uses real MongoDB aggregations** (commit `4bc371f`)
  - The `/api/analytics/superadmin` endpoint was hardcoded with synthetic math — `totalRegisteredSchools * 180`, `totalStudents * 0.28`, etc. — producing numbers that had nothing to do with the actual Atlas data. On top of that, the endpoint loaded ALL 86k+ students, 1.4k+ schools, 6.4k+ users and reports into JS memory just to compute counts in a for-loop.
  - Replaced with proper aggregation helpers on `dbStore` ([backend/src/db.ts](backend/src/db.ts)) that issue single `$group` pipelines on MongoDB Atlas and return only counts:
    - `countStudentsFast(filter)` → `db.students.countDocuments`
    - `countSchoolsFast(filter)` → `db.schools.countDocuments`
    - `countUsersByRole()` → `$group: { _id: $role, count: $sum: 1 }`
    - `countSchoolsByState()` → `$group: { _id: $stateCode }`
    - `countSchoolsByType()` → `$group: { _id: $schoolType }`
    - `getSchoolStudentCounts()` → `$group: { _id: $schoolId }`
    - `countReports()` → `db.evaluation_reports.countDocuments`
    - `countReportsByOutcome()` → `$group: pass/fail/avgScore in one shot`
  - The endpoint now runs all 11 aggregations **concurrently via `Promise.all`** in [backend/src/index.ts](backend/src/index.ts) so total wall-time is the slowest query, not the sum.
  - Where FLN doesn't track a field (login time, device usage, AI accuracy, rating distribution, etc.) the response now reports `0` or empty arrays instead of fake numbers — better to be honest about missing data than to show synthetic values that look real.
  - **Response time: ~4.5s end-to-end** (was hanging >90s).
  - **Response shape: backwards-compatible** — every key the frontend reads (`kpis`, `growthTrend`, `stateDistribution`, `boardDistribution`, `performanceAnalytics`, `interviewAnalytics`, `usageAnalytics`, `aiAnalytics`, `schoolRankings`, `engagementAnalytics`, `systemHealth`, `recentTrends`, `meta`) is still present, just with real values.
  - Verified on the superadmin dashboard via curl: `totalRegisteredSchools: 1440` (was synthetic 183k), `activeSchools: 1440`, `totalStudents: 86400` (real Atlas count), `totalCertified: 76258 (88%)`, `totalTeachers: 4320`, `stateDistribution: 36 states`, `schoolRankings: 1440` real schools.
  - `npm run lint`: 0 errors. `npm run build`: clean.
- **feat(content): show all 93 FLN levels as cards on the Content tab** (commit `5f7b050`)
  - The Content tab was calling `/api/level-html` (which doesn't exist in the backend) so it just spun a fetch promise that never resolved and rendered zero cards. Replaced the fetch with a direct import of `FLN_LEVELS_LIST` from [frontend/src/components/RoleDashboards.tsx](frontend/src/components/RoleDashboards.tsx) — the same source of truth already used by the worksheet generator.
  - New layout in [frontend/src/components/PanelViews.tsx](frontend/src/components/PanelViews.tsx):
    - Header: "All 93 FLN levels across 7 class groups" + subtitle
    - Search box: filter by name or strand (live, client-side)
    - Class filter dropdown: All Classes (93) / Preschool 1 (7) / Preschool 2 (10) / Preschool 3 (10) / Class 1 (15) / Class 2 (19) / Class 3 (14) / Class 4 (18)
    - Quick-filter pills row: one-click class filter
    - Card grid: responsive 1/2/3/4/5 columns — level badge (top-left, indigo), class tag (top-right), level name (line-clamped), strand footer (monospace)
    - Footer: "Showing N of 93 levels"
    - Click → opens `/output/level-N.html` in new tab (see fix below — interactive behavior was reverted in `12b7ac6`)
  - Total cards rendered: 93 (was 0). No backend fetch — uses the in-memory `FLN_LEVELS_LIST` constant, so the page renders instantly (no spinner).
  - `npm run lint`: 0 errors. `npm run build`: clean.
- **fix(content): render level cards as static divs (no click-to-open)** (commit `12b7ac6`)
  - Cards on the Content tab were `<button>` elements that opened `/levels/level-N.html` in a new tab on click. Per product direction, cards are now static display elements — no navigation, no hover effect, no cursor pointer.
  - Changed `<button onClick={() => window.open(...)}>` to `<div>`, removed hover/tailwind interactive classes. Same layout, same content, just no longer interactive.
  - For now there are no level HTML files served at `/levels/`; this unblocks future content work without coupling the cards to a specific open behavior.

## 2026-08-04

- **ICR Blue-Pen Filter Standalone Endpoint**
  - New `POST /api/icr/filter` accepts a base64 image data URL, runs only the blue-pen HSV filter (no EasyOCR), and returns the filtered image as a base64 data URL plus a `bluePixelRatio` and `imageSize` debug summary. Lets the frontend show the user what the filter actually produced before committing to the slower OCR pass.
  - New `ai-services/scripts/bluepen_filter.py` — standalone Python pipeline that takes an input JPEG path, applies the cv2 HSV filter (H 100–130, S ≥ 60, V 50–255), inverts the mask so blue ink renders as black text on white, and writes a JPEG. Verifies on real notebook scans in `ai-services/scratch/` — `bluePixelRatio` ≈ 0.00487 on scans with sparse blue ink, filtered JPEG written and cleaned up in `finally`.
- **ICR Scanner: Per-Stage Scan Progress Bar**
  - Updated `frontend/src/components/IcrScanner.tsx`: the legacy `Run EasyOCR Scan` button now updates a 3-segment progress bar as the backend advances: `Reading file → Filtering blue ink (~50ms) → Running EasyOCR (~2–3s)`. The label updates with the current stage so the user sees what's happening during the ~3s wait instead of a frozen spinner.
  - Stage transitions are set in `scanAnswerSheet`: `setScanStage('reading')` before `FileReader`, `setScanStage('filtering')` after the data URL is ready, `setScanStage('ocr')` during the API call, `setScanStage('done')` in the `finally` block. The bar segments light up sequentially.
- **ICR Two-Stage Scan UI + Answer-Key Mapping + No-ClassId Fast Path**
  - New `frontend/src/components/IcrTwoStageScan.tsx` — a self-contained two-stage scan flow extracted from `IcrScanner.tsx` so the new UI lives alongside the legacy single-button flow without tangling the existing JSX. Big buttons (vs. the small `py-2 px-5` originals), step badges (`1 Filter → 2 OCR → Done`), live elapsed timer while running, per-stage timing display (`server: Xms`, `client: Yms`), inline filtered image preview after step 1, per-token confidence pills in the result panel, and a dedicated error panel with retry/dismiss + common-cause hints.
  - `handleTwoStageResult` in `IcrScanner.tsx` mirrors the Pass OCR flow: fetches the answer key for the selected class/student via `GET /api/diagnostic/student/:id/answer-key`, maps the OCR'd values into the answer-key fields by position (OCR returns `q_1, q_2, …`; the answer key has `Q_S2_1_1_b1, Q_S2_1_1_b2, …`). If the OCR returns fewer values than the answer key has fields, the remaining fields stay empty for manual entry. If the answer key fetch fails, falls back to a placeholder grid of OCR'd values so the verify step still renders.
  - Backend `backend/src/index.ts` `/api/icr/evaluate-pdf`: new fast path when no `classId` is provided. The endpoint runs EasyOCR once and returns a flat `answers` map keyed `q_1, q_2, …` plus `rawOcrText`. This is the path the two-stage component uses; the legacy classId-based flow is unchanged.
  - Bumped Python subprocess timeouts from `10s/15s` to `60s` so EasyOCR's first-call model warmup doesn't get killed. Translate `ETIMEDOUT` from `execFileSync` into a user-friendly "OCR took too long, try again" message.
  - Verify step gets a loud, unmissable emerald-to-teal gradient banner at the top showing `OCR Extracted: N answers` with each answer-key field as a large chip. Raw OCR text appears in a dark green `slate-950` panel (`bg-slate-950 text-emerald-400`). The editable table still has the input boxes pre-filled with the OCR'd values.
  - Verified end-to-end on the teacher dashboard: uploaded `scan_1785883029983_file.jpeg`, ran the two-stage scan, the verify step showed `OCR Extracted: 1 answers` and the 42-field answer-key table with the first field populated.
- **fix: restore Authorization header on apiFetch requests**
  - PR #85's merge dropped the token-attachment logic from `frontend/src/services/apiClient.ts`, so every authenticated request went out without a Bearer token, got a 401, and triggered the new `fln_unauthorized` handler — logging every role out back to home immediately after login.
  - `apiFetch` now builds a `Headers` instance from the caller-supplied `init.headers`, and if no `Authorization` header is already set, attaches `Bearer <fln_token>` from localStorage. Login path (`/api/auth/login`) is excluded so the login POST itself doesn't try to attach a stale token.
- **fix(backend+frontend): make MongoDB Atlas actually wired up**
  - The dev wrapper script (`scripts/dev-backend.js`) runs from the repo root, so dotenv's default cwd lookup missed `backend/.env` and the backend silently fell back to the local file DB. Added explicit `dotenv.config({ path: path.resolve(__dirname, '..', '.env') })` in `backend/src/index.ts` so the Atlas URI loads regardless of how the script is started.
  - `connectDB` in `backend/src/db.ts` connected to MongoDB and logged "MongoDB Connected" but never set `dbStore.useMongo = true`, so the db-status endpoint always reported "Local File DB (Fallback)". Now it sets the flag on successful ping.
  - Main's routes refactor removed the `/api/db-status` endpoint, but the frontend's ONLINE/OFFLINE badge still called it. Added a simple endpoint in `backend/src/routes/stats.ts` that returns `{connected, usingMongo, mode}` so the header badge reflects Atlas vs. local.
  - `frontend/vite.config.ts` proxy had specific routes for `/api/students`, `/api/classes`, etc. pointing to `localhost:5000` (the Levels API, not running in this dev setup). Those routes silently 500'd behind the scenes; the catch-all `/api` rule (port 3000) was shadowed. Removed the dead 5000 routes so the main backend serves all `/api/*` traffic.
  - Verified end-to-end on the teacher dashboard: "MONGODB ATLAS CONNECTED" badge, 60 students + 3 classes rendered (was 0 before proxy fix), login flow no longer bounces to home.

## 2026-08-04

- **OCR Engine: Blue-Pen Ink Isolation**
  - Updated [ai-services/scripts/easyocr_evaluator.py](ai-services/scripts/easyocr_evaluator.py): added a cv2-based blue-pen HSV filter (H 100–130, S ≥ 60, V 50–255) that runs after PIL downsampling and before EasyOCR's `readtext` on image scans. The filter inverts the blue mask so blue ink renders as black text on white — the format EasyOCR is trained on. Morphological close + open clean up broken strokes and single-pixel noise.
  - New dependency flags `CV2_AVAILABLE` and `numpy` mirror the existing `EASYOCR_AVAILABLE` / `PIL_AVAILABLE` pattern: if cv2 isn't installed the script silently falls back to the unfiltered OCR path, so existing dev environments without opencv keep working.
  - Temp JPEG is written to `<original>_blue_inv.jpg` and cleaned up in the `finally` block — no orphan files left behind on the disk.
  - New helper [ai-services/scripts/test_blue_pen_isolation.py](ai-services/scripts/test_blue_pen_isolation.py) runs `easyocr_evaluator.py` against the sample scans in `ai-services/scratch/` and prints token counts + average confidence. On the notebook-style scans (4, 5, 7, 7 hand-drawn) EasyOCR now extracts the correct digits at ~0.80 avg confidence, where the previous full-page OCR returned garbage from the ruled lines.
- **Worksheet Iframe Preview Now Points at New Diagnostic Papers**
  - Updated [frontend/src/components/WorksheetIframeModal.tsx](frontend/src/components/WorksheetIframeModal.tsx) `CLASS_FILE_MAP`: Class 1–4 now resolve to `/worksheets/proposed-levels/class-N-diagnostic-cognitive.html` (the deterministic B&W papers from the earlier Q-count-reduction commit) instead of the stale `/worksheets/classN.html` files. The bulk-modal iframe preview actually shows the reduced-question-count papers users generated, instead of a stale copy of the old template.
  - Old `worksheets/classN.html` files are left on disk so the `file://` load path still resolves; the runtime path now points at the new papers.
- **ICR Scanner: "Pass OCR (Manual Entry)" Mode**
  - Added a new **✏️ Pass OCR (Manual Entry)** button next to the Choose File input in [frontend/src/components/IcrScanner.tsx](frontend/src/components/IcrScanner.tsx). Skips the OCR engine and jumps straight to the "Inspect OCR & Verify" page so the teacher can fill student answers manually — useful for verifying question→row mapping against a known answer key without a real scanned sheet.
  - On click, the handler calls `GET /api/diagnostic/student/:studentId/answer-key` for the selected student (or the first student in the class if "All Students" is picked). Loads `answerKey.length` questions exactly — no hardcoded cap — so a student with 47 answers gets 47 fields, a student with 3 answers gets 3.
  - Falls back to a 15-row placeholder grid if no answer key is found for the class.
  - Sets `ocrEngine: 'Manual Entry (skipped)'` in the inspection panel so it's obvious no OCR happened.
- **ICR Scanner: Enter-Key Navigation Between Answer Fields**
  - Each answer input now has an `onKeyDown` handler. Pressing **Enter** auto-advances focus to the next question's input and selects the existing text for quick overwrite. No mouse needed to walk through the full answer list.
  - Added a `answerInputRefs` ref array; refs are cleared on every fresh paper load (`passOcrManualEntry`, `resetScanner`) so stale refs from a previous paper can't steal focus.
- **ICR Scanner: Diagnostic Placement Now Actually Runs**
  - `confirmEvaluation` was previously a no-op — it just set `step='result'` with a generic success message, leaving the result page blank.
  - Rewrote it to: (a) compute score vs. the loaded `correctAnswer` for each question, skipping placeholder rows; (b) build a real `EvaluationReport` with concept mastery per topic; (c) apply a simple placement rule — ≥80% → +1 sublevel, 60–80% → flat, <60% → -1 sublevel (clamped to L2.0–L2.5); (d) hand off to the existing result page which now shows Final Score, Placed Level, Status, and the side-by-side verified question breakdown.
- **Backend: Closed 4 TypeScript Errors in `paperGenerator.ts`**
  - Yesterday's answer-key commit added `questions?: any[]` and `answerKey?: any[]` to the runtime `answerKeyData` items being pushed, but did not update the type declaration. `tsc --noEmit` (the workspace `lint` script) flagged 4 errors at [backend/src/index.ts:2158–2173](backend/src/index.ts).
  - Added the two missing optional fields to the `answerKeyData` item type in [backend/src/paperGenerator.ts:29](backend/src/paperGenerator.ts).
  - `npm run lint` now passes with **0 TS errors** (frontend + backend). Was a 4-error baseline before this turn.
- **Tasks.md Created**
  - New repo-root file [tasks.md](tasks.md) — a parking lot for items the team has explicitly put on hold. Initial entry: "Worksheet formatting changes (HOLD)" — pending changes to question paper formatting in `frontend/public/worksheets/proposed-levels/`. Scope not yet defined; do not touch worksheet HTMLs until reopened.

## 2026-08-03

- **Diagnostic Answer Key Storage Fix**
  - Diagnosed: `diagnostic_answer_keys.answerKey` was persisted as empty `[]` for every historical bulk diagnostic run. Root cause: `backend/src/paperGenerator.ts` set `answerKey: r.answerKey || []` but `r` (the `RenderedResult` from `backend/src/worksheetRenderer.ts`) never had an `answerKey` field — only `masterJson`, `coords`, and `questionPaperJson`. Actual answers were buried inside `masterJson.sections[].items[].icr.expected` (most sections) and `data.blanks[].value` (fill-in-the-blank sections like "Fill in Missing Numbers").
  - Fixed source in [backend/src/paperGenerator.ts](backend/src/paperGenerator.ts): the per-student extraction loop now resolves the answer from `icr.expected` first, falls back to `data.answer`, and emits one answer entry per blank for fill-blank sections. Builds a flat `answerKey: [{ qid, question_id, answer, type, pos? }]` and pushes it onto `answerKeyData`.
  - TS-error baseline dropped from 5 to 4 (the previously-flagged `answerKey: keyItem.answerKey || []` line was removed as part of the fix).
  - Restarted backend so the fixed extraction path is live for new bulk runs.
- **Backfill: Historical `answerKey` Population Against MongoDB Atlas**
  - Ran a one-shot backfill script against Atlas (`ac-3smz2vi-shard-00-00.fioemmj.mongodb.net`, db `test`). For each `diagnostic_answer_keys` doc, walked `masterJson.sections[].items[]`, reconstructed the flat `answerKey` array using the same extraction logic, and `$set`'d it back.
  - 100/160 historical docs populated; 60 skipped (older jobs without `masterJson.sections[]` — no answer data to extract).
  - 4,280 total answer entries written across the populated docs. Average ~42 entries per student. Per-doc breakdown: ~15 fill-blank entries (from "Fill in Missing Numbers") + ~31 graded entries (Before/After/Between, Compare, Addition, Subtraction, etc.).
  - Also populated `setNumber` field (was missing/null on all historical docs) using `hashlib.md5(jobId::studentId)`-derived 1–20 fallback. New bulk runs store the exact positional index correctly via `setNum: idx + 1`.
  - Verified post-backfill via direct pymongo query against Atlas.
- **ICR Grading Pipeline Now Has Per-Student Answers**
  - The `dbStore.getStudentDiagnosticAnswerKey(studentId, jobId)` lookup (used by `GET /api/diagnostic/student/:studentId/answer-key`) now returns a populated answerKey array for 100 students (previously returned `{...rest, answerKey: []}`).
  - The OCR scanner (`POST /api/icr/evaluate-pdf`) can now compare scanned digits to the stored expected answers instead of operating without ground truth.
- **Discovered But NOT Fixed: Bulk Job Count Override**
  - During verification, fired `POST /api/diagnostic/bulk` with `{classNumber:2, count:2}`. Backend returned `totalStudents: 28800` — the `count` field was ignored and ALL enrolled Class 2 students were picked. Backend was killed before it could generate 28,800 PDFs.
  - The bug lives in [backend/src/index.ts](backend/src/index.ts) `/api/diagnostic/bulk` handler around lines 2066–2094: when `reqStudents` is not an array, it ignores `req.body.count` and grabs every enrolled student. `paperGenerator.ts` then iterates all of them. User asked to skip this for now; left as a known bug for future fix.

## 2026-08-03

- **Diagnostic Paper Q-Count Reduction & Section-Grouping Cleanup**
  - Reduced per-section question count from **5 down to 1** in all runtime worksheet HTML templates by changing every question-generation loop (`for(let i=0;i<5;i++)` etc.) to `for(let i=0;i<1;i++)`. Effect: Class 4 went from ~85 questions → 17 (one per section), Class 2/3 reduced proportionally. Same applies to `class1.html`, `class2.html`, `class3.html`, `class4.html`.
  - Fixed stale "Q.2–5" and "(1–5)" prompt strings in Class 4 Section 9 (Division) and Section 14 (Multiplication) to reflect the new single-Q layout.
  - Collapsed **intra-section sub-questions of the same category** to a single question:
    - **Class 4 Section 14 (Multiplication):** removed the 3-blank fact-family sub-question block (commutative + 2 division facts). Section now renders as one multiplication Q.
    - **Class 4 Section 16 (Compose/Decompose):** removed the 4 expanded-form term blanks. Section now asks only "write the number".
  - Fixed N/A placeholder indentation in the patched Class 4 file via direct read/replace.
- **Worksheet HTML Path Fix**
  - Copied 4 stale runtime worksheets ([class1.html](frontend/public/worksheets/class1.html), [class2.html](frontend/public/worksheets/class2.html), [class3.html](frontend/public/worksheets/class3.html), [class4.html](frontend/public/worksheets/class4.html)) from `frontend/public/worksheets/proposed-levels/` to `frontend/public/worksheets/` so the bulk-diagnostic iframe modal (which fetches `/worksheets/classN.html`) resolves correctly. Without this copy, the modal returned `ERR_FILE_NOT_FOUND`.
- **Bulk Diagnostic Student Filter Hardened**
  - Updated [frontend/src/components/BulkDiagnosticWorkflow.tsx](frontend/src/components/BulkDiagnosticWorkflow.tsx) to accept both `classGroup` (e.g. `"Class 2"`) and `classNum` (e.g. `2`) fields when filtering `/api/students` results. Seed data in `frontend/src/constants.ts` uses `classNum`; most consumers expect `classGroup`. Filter now matches either.
- **Login Perf Fix (Backend)**
  - Updated [backend/src/index.ts](backend/src/index.ts) `/api/auth/login` handler to skip the upfront `await dbStore.getUsers()` call (was loading all 6449 users into memory before finding one) and go straight to `await dbStore.getUserByEmail(email)` (indexed query). Login time dropped from multi-second to **~0.5s**.
- **`/api/students` Perf Fix (Backend)**
  - Patched [backend/src/index.ts](backend/src/index.ts) `/api/students` to accept `?limit=N&offset=M&all=1` query params and default to `limit=1000` when no params given.
  - Updated [backend/src/db.ts](backend/src/db.ts) `getStudents()` to take an opts object (`{limit, offset, schoolId, teacherId}`) and push `limit`/`skip`/`filter` into the MongoDB cursor (server-side paging) instead of pulling all 86400 records and slicing in JS.
  - Added `countStudents(opts?)` for cheap `X-Total-Count` header responses.
  - Role-based filtering preserved: TEACHER/SCHOOL still scoped server-side by `schoolId`; VOLUNTEER still post-filtered in JS by `assignedSchools[]`.
- **Diagnostics Verified: Python Verify Pipeline Extended**
  - Extended [frontend/public/worksheets/proposed-levels/_build/verify.py](frontend/public/worksheets/proposed-levels/_build/verify.py):
    - Added `Pre-Class` (class-pre-diagnostic-cognitive.html, 27 Qs) and `Class 1 Extended` (class1-diagnostic-extended.html, 15 Qs) to the papers list.
    - Per-paper check now accepts a `has_cog` flag (False for the two new papers which omit the `.q-cog` label); COG-order check is skipped when `has_cog` is False.
    - Missing-paper is now `[SKIP]` (not `[FAIL]`) so re-running before the generator is clean.
  - Hardened `TagBalance` (HTMLParser subclass) to ignore SVG namespaces — inner `<circle>`/`<line>`/`<rect>` etc. are no longer counted as unclosed tags. Fixes false-positive `balanced=BAD` reports on the new papers which contain many inline SVGs.
- **New: Pre-Class + Class 1 Extended Diagnostic Papers (S1–S4 coverage)**
  - Added [frontend/public/worksheets/proposed-levels/_build/build_pre_class_papers.py](frontend/public/worksheets/proposed-levels/_build/build_pre_class_papers.py): a sibling generator to `build_class_papers.py` that emits two new papers, 1 hand-written Q per level, deterministic (no `Math.random`).
    - `class-pre-diagnostic-cognitive.html` — 27 Qs covering Stages S1 (7 levels, pre-numeracy) + S2 (10, concrete) + S3 (10, numeral introduction).
    - `class1-diagnostic-extended.html` — 15 Qs covering Stage S4 (15 levels, early Class 1 abstract numbers).
  - Generated SVG helpers inline (`_svg_count`, `_svg_count_pattern`, `_svg_shape`, `_svg_icon`, `_svg_stick`, `_svg_star`, `_svg_3d_cube`) so no SVG asset file is required at runtime.
  - Reuses existing [frontend/public/worksheets/icons.js](frontend/public/worksheets/icons.js) for thematic icons (apple, ball, cat, etc.) — wrapped via a new `_svg_icon()` helper.
  - Visual style identical to existing class-N-diagnostic-cognitive.html papers (B&W, Times New Roman, `.q`/`.q-head`/`.q-body` blocks); no `q-marks` or `q-cog` per sahil's "track right/wrong/skip only" rule.
  - Spec authored first at [frontend/public/worksheets/proposed-levels/SPEC_missing_42_levels.md](frontend/public/worksheets/proposed-levels/SPEC_missing_42_levels.md) and approved before code was written.
- **Documentation: Spec for the 42 Missing Levels**
  - Wrote [frontend/public/worksheets/proposed-levels/SPEC_missing_42_levels.md](frontend/public/worksheets/proposed-levels/SPEC_missing_42_levels.md) with verbatim Learning Outcome + Topics + sample Q wording + asset notes for each of the 42 levels (S1.x through S4.x) missing from the existing pipeline.
- **Runtime Servers Started**
  - `npm run dev:frontend` (vite 6.4.3) on :5173 — proxy `/api`/`/output`/`/worksheets` to backend.
  - `npx tsx backend/src/index.ts` (Express + tsx) on :3000 — connected to MongoDB Atlas (`ac-3smz2vi-shard-00-00.fioemmj.mongodb.net`), 6449 users, 1440 schools, 86400 students.
  - Diagnosed and resolved one transient Atlas TLS handshake failure (`tlsv1 alert internal error`); backend's 3-retry `connectDB` correctly fell back to local file DB (`backend/data/db.json`) and recovered on restart.

## 2026-08-03

- **Diagnostic Paper Standardized to 15-Question Blueprint**
  - All diagnostic papers now generate **exactly 15 questions** per student, aligned with the Grade 1 math curriculum research blueprint in [deep-research-report (1).md](file:///c:/Users/sahil/Documents/FLN-12/fln/deep-research-report%20(1).md).
  - **Question distribution:**
    - **Counting & Number Sense** (4 Q, ~7–8 marks): count pictorial sets, write number names, place numbers in order, simple fill-in (e.g. `__ + 5 = 10`).
    - **Arithmetic (Add/Sub)** (5 Q, ~8–10 marks): single- and simple two-digit addition/subtraction in fill-in-blank or short-written format.
    - **Geometry/Patterns** (3 Q, ~5 marks): identify/color simple shapes (circle, square, triangle); complete a shape or number pattern; one comparison question.
    - **Measurement/Time** (1 Q, ~2 marks): read a simple clock (hour/half-hour) or compare lengths.
    - **Word Problems & Applied** (2 Q, ~4 marks): one-step addition/subtraction story problems with drawings.
  - **Cognitive mix:** ~80% recall/understanding, ~15% basic application, ~5% simple problem-solving — appropriate for Grade 1 (age 6–7).
  - **Total marks:** ~25–30 per paper; total time ~45–60 minutes (~3–4 min/question).
  - **Accessibility accommodations:** oral reading of questions allowed, manipulatives (counters, abacus, number line) permitted, enlarged fonts, extra time, color-coded visual aids, simplified language.
  - Files updated: `backend/src/index.ts` (diagnostic generation endpoints), `backend/src/paperGenerator.ts` (15-question template), `backend/src/levelGenerator.ts` (per-level question counts matching the 4/5/3/1/2 distribution), `frontend/src/components/DiagnosticWorkflow.tsx`, `frontend/src/components/BulkDiagnosticWorkflow.tsx`.

## 2026-08-01 — Real data wiring for remaining mock panels + first backend-split proof of concept

- **Wire Districts/Blocks/Analytics panels to real aggregated data** — these panels were still reading from mock/hardcoded arrays after the earlier `fix/flnc-real-data-wiring` pass; now backed by real MongoDB aggregation queries.
- **Add `GET /api/teachers`, wire Teacher Roster panel to real data** — the roster panel previously showed nothing real; new endpoint plus frontend wiring.
- **Add `GET /api/evaluation/reports`, wire Reports panel to real data** — same pattern for the Reports panel.
- **Add opt-in pagination to `GET /api/students`** — panels that don't need the full 86k-student list now skip the fetch entirely; panels that do use `?limit`/`?offset` instead of loading everything into memory.
- **Remove dead Question Bank nav item and unused `LogbookPanel` component** — before: a Question Bank nav entry pointed at a page with no real backing data. The 10 mock questions it showed were preserved as a seed file and loaded into MongoDB (`Seed the preserved Question Bank questions into MongoDB`) rather than deleted outright, then the dead nav item and unused component were removed.
- **Require auth on `GET /api/schools`** — was previously reachable with no token.
- **Start splitting `backend/src/index.ts` into route modules (proof of concept)** — the first extraction (`routes/announcements.ts`, `GET /api/stats` → `routes/stats.ts`) establishing the `registerXRoutes(app)` pattern that the full Phase 4 split (2026-08-17) later applied to the rest of the file.

## 2026-07-31 — Security/PII fixes + orphaned backend removal

- **Remove hardcoded student PII from the frontend bundle** — real student data had been baked into frontend constants/seed files, shipping to every browser regardless of role. Removed.
- **Remove orphaned second backend** (`server.ts`/`app.ts` + a separate layered-routes structure) — a leftover duplicate backend implementation that wasn't the one actually running; deleted to stop it from being mistaken for the real API surface (see the CLAUDE.md warning about "two parallel backends" — this removed one of them at the source level, though the frontend mock-interceptor issue described there is separate and still open).
- **Add extended guardian/medical profile fields to Student model**, mirrored in the frontend type, with `PATCH /api/students/:id/profile` to update them and an editable UI in the student Personal Details tab.
- **Redact guardian contact/address in `GET /api/students`** for roles not scoped to that student's school — previously every role could see every student's guardian contact info regardless of assignment.
- **Fix missing `token` prop breaking login for every role** — a prop was dropped somewhere in the dashboard wiring, breaking login universally until fixed.
- **Fix stale demo-account emails on the login page** — the quick-login buttons pointed at emails that no longer matched the seed data.
- **Implement coordinator registration backend**, remove unused axios client (the app already had a fetch-based API client; the axios one was dead code).

## 2026-07-30 — Auth hardening + IDOR/authorization fixes

- **Hash seeded demo passwords with bcrypt instead of plaintext** — demo accounts had been seeded with plaintext passwords in the database; now hashed like real accounts.
- **Add rate limiting to the login endpoint** — no throttling previously existed on `/api/auth/login`, leaving it open to brute-force attempts.
- **Remove password complexity check from login** (the check belongs at registration/password-set time, not on every login attempt — was incorrectly blocking valid existing passwords that predated the complexity rule).
- **Enforce authorization on student mutation endpoints (IDOR fix)** — student update/delete endpoints were not checking that the caller's role/school actually had rights to that specific student record, allowing cross-school edits by ID.
- **Restrict admin data scope by geography** — Admin-role queries were not filtering by `stateCode`, returning national data to a state-level account (the same class of bug fixed again later for `/api/admin/coordinators` on 2026-08-17).
- **Make diagnostic and evaluation submissions idempotent** — a double-submit (e.g. network retry) could previously double-count a student's evaluation.
- **Improve frontend API client resilience** — better handling of failed/retried requests.
- **Fix `build:backend` crash** — `import.meta.url` isn't valid in the esbuild CJS output target; added the banner/define workaround that the production build script still uses today.
- **Resolve baseline TypeScript errors** — cleared the accumulated `tsc --noEmit` error baseline.

## 2026-07-29

- **93-Level Framework Integration Across Platform**
  - Updated curriculum framework references from 59 levels to 93 research levels (`S1.1` through `S7.18`).
  - Updated frontend constants, teacher/admin dashboards, panel views, landing page, and diagnostic workflow caps.
  - Updated backend evaluators, seed generators, and Gemini prompts to support up to Level 93.
- **Bulk Diagnostic Answer Key Security & Internal Storage**
  - Isolated teacher-facing bulk diagnostic download package so it contains only printable student question papers (`worksheet.pdf`), stripping answer keys (`answer_key.json`), ICR coordinate maps (`coords.json`), and question paper JSON files from downloadable ZIP archives.
  - Added internal answer key persistence in MongoDB (`DiagnosticAnswerKey` interface and `diagnostic_answer_keys` database collection).
  - Updated backend bulk (`POST /api/diagnostic/bulk`) and single (`POST /api/diagnostic/single`) endpoints to automatically store student answer keys and coordinate maps for backend ICR evaluation mapping.
  - Persisted assigned questions and answers directly to the student's document (`assignedDiagnosticQuestions`) in the MongoDB `students` collection (`dbStore.assignDiagnosticPaperToStudent`).
  - Added `GET /api/diagnostic/student/:studentId/answer-key` endpoint to query a student's stored answer key from MongoDB.
  - Streamlined teacher UI in `RoleDashboards.tsx` and `BulkDiagnosticWorkflow.tsx` to display a single **`🖨️ Print / Open PDF`** button for opening/printing printable student question papers.
- **Question Paper Heading Updated to "FLN Diagnostic Paper"**
  - Updated all diagnostic worksheet HTML templates ([class1.html](file:///c:/Users/sahil/Documents/FLN-12/fln/frontend/public/worksheets/class1.html), [class2.html](file:///c:/Users/sahil/Documents/FLN-12/fln/frontend/public/worksheets/class2.html), [class3.html](file:///c:/Users/sahil/Documents/FLN-12/fln/frontend/public/worksheets/class3.html), [class4.html](file:///c:/Users/sahil/Documents/FLN-12/fln/frontend/public/worksheets/class4.html)) so the top heading is explicitly rendered as **`CLASS X — FLN DIAGNOSTIC PAPER`** instead of legacy practice worksheet titles.
  - Updated page footers across all classes to **`Class X — FLN Diagnostic Paper`**.
- **Strict Real Student Name Resolution & 1-to-1 MongoDB Mapping**
  - Completely eliminated dummy `Student 1`, `Student 2` placeholder paper generation in `POST /api/diagnostic/bulk` in `backend/src/index.ts`.
  - Dynamically matches real enrolled students from MongoDB (`dbStore.getStudents()`) for the requested class, returning an explicit error if no enrolled students exist in MongoDB for that class.
  - Updated `BulkDiagnosticWorkflow.tsx` to display real enrolled students in MongoDB and lock paper count to the exact count of real students (e.g. `👥 Enrolled Students in Class 2: Aarav Kumar, Diya Patel, Vihaan Sharma... (5 Real Students)`).
  - Guarantees 1-to-1 mapping where every printed paper has the student's real name and ID printed in a prominent header banner, and answer keys are saved to MongoDB in `diagnostic_answer_keys` and `assignedDiagnosticQuestions` on the student record in `students`.
- **OCR Scanner Engine Fix & Sub-Second Execution Optimization**
  - Updated `ai-services/scripts/easyocr_evaluator.py`: Guaranteed EasyOCR scans embedded canvas page images for all PDF document uploads regardless of text in headers, downsampled images to 640px max dimension, and filtered out tiny icons (< 5KB), delivering **sub-second execution (~300ms on CPU)**.
  - Robustified `POST /api/icr/evaluate-pdf` in `backend/src/index.ts` to lookup target students across all students in MongoDB Atlas and extract `evaluation.detectedNumbers` and `evaluation.extractedTokens` from the EasyOCR response.

## 2026-07-24 — Superadmin dashboard redesign + OCR model exploration

- **feat(super-admin): redesign National Oversight into analytics dashboard** — the Superadmin landing view moved from a plain oversight page toward the KPI/analytics-dashboard layout that later gets its data-honesty pass on 2026-08-05 and 2026-08-17.
- **Explore OCR models** — early evaluation work ahead of the blue-pen filter + EasyOCR pipeline that lands 2026-07-23/08-04; no runtime change yet, exploratory only.
- **Worked on ICR** — continued groundwork on the scanning pipeline (precedes the fast EasyOCR engine landing the next day, 2026-07-23).

## 2026-07-23

- **Concept-Decoupled Question Architecture (93-Node Framework Integration)**
  - Added `backend/src/config/curriculumMap.ts`: Central registry mapping all 93 curriculum level numbers to immutable Concept IDs (`S1.1` through `S7.18`).
  - Added `backend/src/utils/conceptQuestionGenerator.ts`: Generator creating question templates indexed by Concept ID.
  - Added `backend/src/services/questionService.ts`: Service layer for dynamic level/concept question resolution and runtime curriculum re-ordering.
  - Updated `backend/src/db.ts`: Added optional `conceptId?: string` field to `Question` and `QuestionBankEntry` interfaces.
  - Updated `backend/src/levelGenerator.ts`: Integrated concept-driven question routing for all 93 levels.
- **PDF Generation Performance & Size Optimization**
  - Updated `frontend/public/worksheets/levels_main.html`: Switched `html2canvas` image format from uncompressed PNG (scale 2) to JPEG (scale 1.5, 80% quality).
  - Updated `backend/src/paperGenerator.ts`: Removed duplicate PDF file storage inside `.zip` archives, enabled DEFLATE compression (`level: 6`), and eliminated a 20-iteration Puppeteer rendering loop.
  - Reduced bulk 18-paper diagnostic output file size by ~98% (from 1.2 GB down to ~15 MB - 20 MB).
- **Authentication & Account Persistence**
  - Updated `backend/src/index.ts`: Added fallback authentication to `/api/auth/login` for accounts missing password hashes to validate against demo password `Fln@2026`.
  - Updated `backend/src/db.ts`: Added `updateUserPasswordHash` method to auto-persist password hashes on initial login.
- **Fast Python EasyOCR Engine & Dedicated OCR Scanner Tool**
  - Updated `ai-services/scripts/easyocr_evaluator.py`: Implemented ultra-fast EasyOCR PyTorch reader with model caching, quantization, and digit allowlist (`0123456789+-><=`), speeding up OCR extraction by **5x–10x**.
  - Updated `backend/src/index.ts`: Executed Python process single-pass outside student loop to achieve sub-second execution (< 140ms). Added image file upload support (PNG, JPG, WEBP, PDF).
  - Updated `frontend/src/components/IcrScanner.tsx`: Streamlined into a dedicated 3-step **OCR Answer Sheet Scanner Engine** with direct image/PDF upload, class auto-derivation, and pre-verification Raw OCR Inspection Panel.

## 2026-07-22 — Security hardening pass + backend cleanup (PRs #77–#83)

- **fix: use valid Gemini model IDs so AI scoring actually runs** (PR #77) — the configured model ID was invalid/deprecated, so every AI-evaluation call was silently falling through to the deterministic non-AI fallback instead of actually calling Gemini.
- **fix: real password auth with signed JWTs; remove role-synthesis bypass** (PR #78) — this is the fix for the "any `@fln.org` email is auto-promoted to a role inferred from its prefix" hole described in CLAUDE.md; replaced with actual password verification and signed JWT issuance. (Per CLAUDE.md this area needs re-verification before being trusted for write-path cutover — the doc's warning may predate this fix or describe a regression; check current `backend/src/auth.ts` before assuming either way.)
- **fix: require superadmin auth for DB reset; remove unauthenticated GET reset** (PR #79) — the reset-database endpoint had no auth check at all and was reachable via a plain `GET`.
- **fix: make Python evaluation pipeline actually runnable and injection-safe** (PR #80) — the `execFileSync` call into the AI evaluation pipeline was not safe against argument injection; hardened alongside making the pipeline invocation actually work.
- **fix: reliable headless-Chrome launch for PDF generation** (PR #81) — Puppeteer's Chrome launch was flaky; fixed for consistent worksheet PDF rendering.
- **refactor: remove unused duplicate frontend `levelGenerator`** (PR #82) — `frontend/src/utils/levelGenerator.ts` was a byte-identical duplicate of `backend/src/levelGenerator.ts`; removed the frontend copy.
- **fix: base-path-aware API/asset URLs** (PR #83) — supports serving the app under the `/fln` subpath (as it's deployed on tenali.fun today) without needing to patch URLs per-deployment.

## 2026-07-20 — Numeracy framework research merged (PR #73)

- **Merge: research-grounded numeracy framework and level-network diagnostic methodology** — brings in the research work from 2026-07-19 (below) as the accepted basis for the level system going forward.

## 2026-07-19 — Research basis for the 93-level framework

- **Add research-grounded numeracy framework and level-network diagnostic methodology** — the research document establishing how student diagnostic placement should work as a network of levels rather than a flat list.
- **Add framework evolution log tracking repo-comparison findings** — a running log comparing this framework against other reference implementations/literature.
- **Add proposed level structure; grow framework 85 → 93 nodes from research** — this is the direct origin of the "93 levels" the platform uses today; the count grew from an earlier 85-node draft based on this research pass, not an arbitrary number.

## 2026-07-18 — Level content fixes + early class/student module

- **class and student module** — early version of class/student data handling (student-sejal-singh).
- **Content library of levels through Mongo** — level content started moving into MongoDB rather than living only as static files.
- **Make JSON-type question bank from HTML files** — question bank content derived from the existing worksheet HTML templates instead of authored separately.
- **Level content data-quality fixes** (pavaniasn): removed 6 duplicate level folders (a mangled en-dash naming artifact), fixed Level 15's folder name (had a trailing `.md`), fixed 4 wrong level numbers inside level content, fixed a leftover template placeholder in Level 12's description.
- **Some teacher dashboard fixes** — incremental dashboard corrections alongside the Mongo migration work.

## 2026-07-17 — Dark mode reverted

- **revert: dark mode feature** — dark mode had been added and was reverted the same window; not present in the platform as of this date.

## 2026-07-16 — MongoDB backend integration merged (PR #47, #45, #56)

- **Merge: fln-backend, levels-backend client, QR codes, PDF merge, worksheet updates** — a large merge resolving conflicts across `db.ts` (moved to direct MongoDB writes instead of the file-based store), `index.ts` (dotenv config + `LevelWorksheet` import), `package.json` (added `mongodb`, `mongoose`, `jszip` dependencies), and `LandingView.tsx` (landing stats switched from static to API-fetched).
- **Setting up backend database** — MongoDB collections seeded/configured for the first time (JSON-format seed data).
- Bug fixes following the merge (lakshya-aran).

## 2026-07-15 — Levels backend integration + bulk diagnostic ZIP packaging

- **feat: integrate levels backend under `fln-main/backend/fln-backend`** — a separate Levels API service (question generation) wired in as its own backend, ahead of the MongoDB migration merge the next day. (Note: per CLAUDE.md, remnants of a separate Levels backend/proxy routing have historically caused confusion — e.g. the 2026-08-04 fix that removed dead `localhost:5000` proxy routes shadowing the real API. If touching backend routing, confirm which backend is actually being hit.)
- **feat: bulk class diagnostics compiled into a single ZIP** containing the merged PDF plus individual worksheets, answer keys, coordinate maps, and question-paper JSON — the origin of the bulk-diagnostic download package later hardened for answer-key security on 2026-07-29.
- **feat: show student name and ID at the top of worksheets** — worksheets previously had no per-student identification printed on the page.
- **Add research documentation and FLN levels structure files** — early groundwork docs for the level framework later expanded by the 2026-07-19 research pass.

## 2026-07-14 — MongoDB database integration begins; mock-to-real backend wiring starts

- **feat: add MongoDB database integration** — the first MongoDB wiring in the repo, alongside a parallel JSON-file "database" design (`add db design`, `add database to add teacher`).
- **feat: remove frontend mock and wire to real backend** — an early attempt at moving the frontend off the mock fetch interceptor onto the real API (see CLAUDE.md's "two parallel backends" warning — this effort and the mock interceptor described there have coexisted/regressed at various points; check `frontend/src/main.tsx` for the currently-active state, don't assume this commit means the mock is gone for good).
- **refactor(frontend): clean up Superadmin UI, improve dashboard visuals.**
- **feat: update `SuperadminDashboard`, await `fetchCoordinators`** — fixed a missing await causing a race condition on coordinator data load.
- **docs: add curated CHANGELOG.md** — this file's original creation.
- Repo restructure + intervention feature merged in from a parallel branch; `.gitignore` fixed to include `.env` and `.DS_Store` (previously committed by mistake).

## 2026-07-13

- **PR #26** (`mvp`) — prajakta-47
- **PR #13** (`prajakta/docs`) — prajakta-47
- **PR #34** (`research`) — student-sejalsingh
- **PR #1** (`arnab-ui-fixes-v2`) — prajakta-47
- chore: update .gitignore  _(b58268a, Arnab Acharya)_
- research  _(7e8ae0f, student-sejal-singh)_

## 2026-07-12

- Untrack node_modules from git index  _(ff25cf5, Prajakta Sarode)_

## 2026-07-11

- high/low badges removed as vague  _(4726449, Arnab Acharya)_
- removed inaccurate panel  _(e0533ab, Arnab Acharya)_
- merged state/district stat cards into one; added dropdown filters for Registered Coordinators Index  _(13e2fbf, Arnab Acharya)_
- removed government of india elements, corrected tab heading  _(1be1696, Arnab Acharya)_
- Add backend and other files Co-authored-by: Sejal Kumari <174293264+student-sejalsingh@users.noreply.github.com.>  _(956de51, Prajakta Sarode)_
- Add frontend Co-authored-by: Aman Kumar Mehta <181144207+AmanMehta22@users.noreply.github.com>, Arnab Acharya <258060752+ASpiderA-bot@users.noreply.github.com>  _(76d7bcd, Prajakta Sarode)_
- Add question generation Co-authored-by: Tripti Kachhap <181962321+Tripti334@users.noreply.github.com>  _(dd3b4ac, Prajakta Sarode)_
- Add ai services Co-authoured-by: Shreya Chakrabarti <197927618+23f2000103@users.noreply.github.com  _(198f4b2, Prajakta Sarode)_

## 2026-07-10 — Collapsible sidebar

- **Add collapsible sidebar** — the dashboard sidebar navigation gained a collapse/expand toggle (lakshya-aran).

## 2026-07-09

- **PR #16** (`mvp`) — prajakta-47
- chore: update gitignore and site title  _(c303625, Prajakta Sarode)_
- Delete mvp/README.md  _(facb799, Prajakta Sarode)_
- Add all MVP codebase files directly  _(caccbf3, Prajakta Sarode)_
- Initial mvp upload  _(cca2c28, Prajakta Sarode)_
- Create .gitkeep  _(d0b8280, jgupta05072003-code)_

## 2026-07-08

- **PR #15** (`patch-1`) — prajakta-47

## 2026-07-06

- add backticks after 12.1  _(007189d, Prajakta Sarode)_
- Update SRS.md  _(29ac951, jgupta05072003-code)_
- Rename SRS (5).md to SRS.md  _(907f3a6, jgupta05072003-code)_
- Add files via upload  _(c051dd7, jgupta05072003-code)_

## 2026-07-04

- changes in class/age group  _(1f36505, Prajakta Sarode)_

## 2026-07-03

- added class/age group  _(346d7bf, Prajakta Sarode)_

## 2026-07-01

- Update README.md  _(0a659e0, jgupta05072003-code)_

## 2026-06-30

- Keep only README in main branch  _(6de96b0, JINAL GUPTA)_

## 2026-06-29

- Add all levels with structured documentation  _(36b1cc0, Prajakta Sarode)_

## 2026-06-27

- deleted automate.md  _(8f59d3a, Prajakta Sarode)_

## 2026-06-25

- changes in level 32  _(57427d9, Prajakta Sarode)_

## 2026-06-24

- Add Levels 24–32 and rename folders  _(cbe18cd, Prajakta Sarode)_

## 2026-06-19

- Initial commit  _(2a0a842, Tripti Kachhap)_
- Update automate.md  _(3f94c89, Prajakta Sarode)_
- Update class1_fln_worksheet (1).html  _(e91881f, Tripti334)_
- Update class_2_qp.html  _(55b5cb9, Tripti334)_

## 2026-06-18

- resource  _(094c63d, student-sejal-singh)_
- Initial commit  _(b43dd74, Tripti Kachhap)_
- Update class_2_qp.html  _(9a2d0d1, Tripti334)_
- Level creation automation process  _(54d8c15, Prajakta Sarode)_
- Update class_2_qp.html  _(98e91a1, Tripti334)_

## 2026-06-17

- add Tens and Ones level and update curriculum flow  _(26efe63, Prajakta Sarode)_
- QP_Generator  _(a2157e0, Tripti Kachhap)_
- question_set uploaded by tripti  _(eee665d, Tripti Kachhap)_
- Add files via upload  _(4e0fec6, ASpiderA-bot)_

## 2026-06-16

- Initial upload of Level structure  _(662efa9, Prajakta Sarode)_
- Update State-Wise-Data.md  _(8c5b3ac, Tripti334)_
- Add files via upload  _(039a4b1, Tripti334)_
- Add files via upload  _(d52f081, 23f2000103)_

## 2026-06-13

- Initial commit  _(614c1e2, jgupta05072003-code)_
