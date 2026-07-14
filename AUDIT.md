# FLN Platform — Codebase Audit

**Scope:** `mvp/` (the actual application). **Method:** static read-through of every source file; no code was changed.
**Date:** 2026-07-10
**TL;DR:** There are **two parallel backends**. A real Node/Express + Python backend (`mvp/server/`, `mvp/evaluation_metrics/`) implements most of the SRS correctly. But the React app never talks to it — `src/main.tsx` installs a `fetch()` interceptor that answers every `/api/*` call inside the browser against a `localStorage` mock DB (`src/mock/`), which re-implements the same business logic in a weaker, insecure form. The single highest-value action is to **delete the mock backend and point the frontend at the real server.** Almost everything else on this list collapses once that is done.

---

## 0. How to read the rankings

Each finding is scored **Blast radius** (harm if left unfixed) × **Effort to fix now** (while the codebase is still small). Priority = high blast × low effort first.

| Priority | Meaning |
|---|---|
| 🔴 **P0** | High blast radius, low/medium effort — do these first |
| 🟠 **P1** | High blast radius but higher effort, or medium blast + low effort |
| 🟡 **P2** | Medium blast, medium effort |
| ⚪ **P3** | Low blast or cosmetic — cleanup |

---

## 1. Current folder structure & what actually lives where

```
fln/
├── SRS.md, PRD.md, README.md, Research/     # docs only
└── mvp/                                       # the app
    ├── index.html, vite.config.ts, package.json, tsconfig.json
    ├── src/                                   # React frontend (Vite + React 19 + Tailwind)
    │   ├── main.tsx                           # ⚠ installs fetch interceptor at boot
    │   ├── App.tsx                            # top-level view/router + role switch
    │   ├── constants.ts        (763 ln)       # ⚠ hardcoded seed data (states/schools/students/levels)
    │   ├── types.ts
    │   ├── mock/
    │   │   ├── fetchInterceptor.ts (829 ln)   # ⚠ FAKE BACKEND #1 — answers /api/* in-browser
    │   │   └── dbStore.ts          (1006 ln)  # ⚠ localStorage "database" + seed
    │   ├── utils/levelGenerator.ts (485 ln)   # ⚠ byte-identical duplicate of server/levelGenerator.ts
    │   └── components/                         # 24 components; business logic mixed into UI
    │       ├── RoleDashboards.tsx  (2702 ln)  # ⚠ god-file: 5 role dashboards + logic
    │       ├── PanelViews.tsx      (1455 ln)  # ⚠ god-file: all secondary panels
    │       ├── IcrScanner.tsx      (601 ln)   # simulated scanner animation
    │       └── ... (Login, Layout, Charts, workflows, etc.)
    ├── server/                                # REAL BACKEND (Node/Express) — mostly unused by the app
    │   ├── index.ts            (1580 ln)      # ~30 real endpoints, real governance logic
    │   ├── db.ts              (2190 ln)       # JSON-file "DB" (data/db.json), not MongoDB
    │   ├── gemini.ts          (646 ln)        # real Gemini AI integration + fallbacks
    │   ├── paperGenerator.ts  (410 ln)        # real Puppeteer HTML→PDF
    │   ├── worksheetRenderer.ts, pdfMerge.ts, classAdapters.ts, levelGenerator.ts
    ├── evaluation_metrics/                    # REAL Python evaluation pipeline
    │   ├── run_pipeline.py, personalized_evaluation_pipeline.py
    │   ├── scripts/{0_classify,1_compare,2_evaluate,3_report}.py, _api.py
    │   ├── prompts/*.txt, questions/, syllabus/   # curriculum data as JSON
    ├── data/db.json          (3597 ln)        # server's persistent store
    ├── public/
    │   ├── mock/*.json                        # ⚠ a THIRD set of mock data (static JSON)
    │   └── worksheets/*.html + jspdf/html2canvas/jszip   # standalone HTML worksheets
    └── docs/                                  # teacher workflow docs (describe the SERVER behavior)
```

**The core structural problem in one sentence:** the frontend (`src/mock/`), the server (`server/`), and `public/mock/` are three separate implementations/copies of the same domain, and the app runs on the weakest one.

### Data-flow reality
- `src/main.tsx:8` → `setupFetchInterceptor()` overrides `window.fetch` **before React renders**.
- `fetchInterceptor.ts:178-180` — any URL containing `/api/` is handled locally; only unmatched paths fall through to the network (`:822`). The React app's ~30 `/api/*` calls therefore **never reach `server/index.ts`**.
- The real server + Python pipeline only run if you exercise the API directly (curl/tests). The documented "Quick Start" (`npm run dev` → localhost:3000) serves the frontend, which self-serves from `localStorage`.

---

## 2. Business logic in the frontend that belongs on the backend

> All of the following runs in the browser via `src/mock/`. The **good news**: the real server already implements correct versions of most of these (cited in §5), so "moving to backend" is largely "stop intercepting and call the server that already exists."

| # | Logic | Frontend location | Should be |
|---|---|---|---|
| 2.1 | **Authentication / credential check** — password never verified; only `length ≥ 8` checked, then returns `token: user.email` | `fetchInterceptor.ts:207-224` | Backend (server has `index.ts:85`, itself also weak — see §5) |
| 2.2 | **Identity/role resolution from email prefix** — `admin.` / `district.` / `block.` / `vol.` / `.t` → role; mints synthetic user | `fetchInterceptor.ts:106-165` (`getAuthUser`) | Backend auth/session |
| 2.3 | **Diagnostic scoring + level placement** — counts correct, `recommendedLevel = min(failed source_level)` | `fetchInterceptor.ts:6-60` (`evaluateDiagnosticMock`) | Python evaluation engine |
| 2.4 | **Worksheet scoring + concept mastery + promotion** (`≥80% → level+1`) | `fetchInterceptor.ts:63-103` (`evaluateWorksheetMock`) | Backend/Python |
| 2.5 | **Generation-lock (pairwise R-11) enforcement** | `fetchInterceptor.ts:522-597` | Backend (server has it: `index.ts:721-744`) |
| 2.6 | **Sub-level / remedial assignment + level-history mutation** | `fetchInterceptor.ts:440-520` | Backend |
| 2.7 | **Certification rule** `currentLevel ≥ 5` + analytics %/topic-mastery formulas | `fetchInterceptor.ts:694-765` | Backend |
| 2.8 | **Defaulter escalation reversal** (`revive-teacher`, `restore-school`) | `fetchInterceptor.ts:791-812` | Backend (server has it: `index.ts:1205,1251`) |
| 2.9 | **ID generation** (`STD_`, `WS_`, `Date.now()`, `Math.random()`) | `fetchInterceptor.ts:352,564,242,269,…,156,778` | Backend/DB |
| 2.10 | **Question pool generation for levels 1–59** | `dbStore.ts:20-26` + `utils/levelGenerator.ts` | Backend/curriculum service |
| 2.11 | **Timing-window computation** (print +60 / exam +105 / submission +165 min) | `fetchInterceptor.ts:580-587` | Backend |
| 2.12 | **Client-side full role switch** — any logged-in user can become any role | `App.tsx:127-163` (`handleRoleSwitch`) | Remove entirely / superadmin-only server action |
| 2.13 | **Answer keys generated in the browser** — all 59 levels × 3 sub-levels with correct answers shipped in the bundle (extractable by any student) | `utils/levelGenerator.ts:9-485` | Backend/curriculum service |
| 2.14 | **ICR extraction faked with `Math.random()`** (70% correct, deliberately corrupts answers); "Certified" badge hardcoded regardless of score | `IcrScanner.tsx:105-123, 539` | Real ICR/ML service (backend) |
| 2.15 | **Client-side authorization decisions** — `canRestore` (who may restore a school), audit-log redaction, analytics-scope selection all decided in-browser over data already sent | `RoleDashboards.tsx:1191,223-235,1260`; `LogbookPanel.tsx:27-92` | Server must decide/redact |
| 2.16 | **Timing-window / lock status from client clock** (`new Date()` vs timestamps) — trivially spoofable | `WorksheetWorkflow.tsx:137-156` | Server-authoritative |

### UI-layer logic duplicated in components (not just the mock)
- **Certification threshold `currentLevel >= 5`** recomputed in the dashboard UI: `RoleDashboards.tsx:599, 995, 1003` (in addition to `fetchInterceptor.ts` and `server/index.ts`).
- **Score-band coloring `≥80 / ≥60`** hand-inlined across render code: `PanelViews.tsx:527, 680, 684, 1009` and throughout `RoleDashboards.tsx`.
- **Class-number parsing** `parseInt(classMatch[0]) ?? 2` reimplemented: `RoleDashboards.tsx:1812, 2439`.
- **46** scattered `role === '…' / UserRole.*` gating decisions across `src/components/*.tsx` — presentation gating is fine, but several encode authorization.

---

## 3. Hardcoded values that should be config / DB / env

### 3.1 Credentials & auth (highest severity)
- **Shared password `Fln@2026` for all 12 demo accounts**, printed in the UI — `LoginView.tsx:22-35, 155`.
- Password **never verified** server-side or client-side (only complexity/length) — `fetchInterceptor.ts:214`, `server/index.ts:92-102`.
- Token = plaintext email, forgeable — `fetchInterceptor.ts:223`, `server/index.ts:108`.

### 3.2 Seed data hardcoded in source (should be DB/fixtures)
- `src/constants.ts` (763 ln): `STATES_DATA:20`, `DISTRICTS_DATA:29`, `BLOCKS_DATA:56`, `FLN_LEVELS` (algorithmically faked 1–59):94, `INITIAL_SCHOOLS:201`, `INITIAL_STUDENTS` (w/ full assessment history + masked Aadhaar):284, `INITIAL_ANNOUNCEMENTS:507`, `INITIAL_TICKETS:534`, `INITIAL_LOGS:651`.
- `src/mock/dbStore.ts`: seed users `46-114`, schools `29-44`, students `139-212`, etc.
- `public/mock/*.json` — a third redundant seed set.
- **`PanelViews.tsx:13-161`** — a *fourth* set: `STUDENTS_MOCK`, `REPORTS_MOCK`, `QUESTION_BANK` (with answers), etc. `PanelViews` renders almost entirely from these in-file mocks, not the API (parallel/dead data path).
- 🔴 **Hardcoded student PII in the bundle** — `PanelViews.tsx:354-361` (`EXTENDED_PROFILES`): guardian names, phone numbers, home addresses, blood groups, disability notes. Ships to every visitor.
- Fake national stats presented as real: `"82.4"` national score, `"Level 3.2"` — `RoleDashboards.tsx:678,668`.

### 3.3 Magic numbers / thresholds (should be a single config)
| Value | Meaning | Locations |
|---|---|---|
| `59` | max FLN level | `constants.ts:178`, `fetchInterceptor.ts:35,53,481,666`, `dbStore.ts:22`, `server/index.ts:1533` |
| `>= 5` | certification | `fetchInterceptor.ts:698,719`, `RoleDashboards.tsx:599,995,1003`, `server/index.ts:1132,1170` |
| `>= 80 / >= 60` | promotion / score bands | `fetchInterceptor.ts:94`, `PanelViews.tsx:527,680,684,1009` |
| `3` | delayed-attempt ban | `server/index.ts:1031` (mock does **not** enforce it) |
| `60/45/60 min` | timing windows | `fetchInterceptor.ts:583-586`, `server/index.ts:786-789` |
| topic-mastery coeffs `55 + avgLevel*8` etc. | fabricated analytics | `fetchInterceptor.ts:724-729`, `server/index.ts:1138-1143` |

> Note: the SRS's **"50%+ fail an easy question → auto-flag"** and **"3 delayed attempts → ban"** are only partially implemented (ban exists server-side; auto-flag not found in either backend).

### 3.4 Server-side hardcoding
- **Gemini model IDs** `gemini-3.5-flash` / `gemini-3.1-flash-lite` / `gemini-3.1-pro-preview` hardcoded and repeated — `gemini.ts:35-37,394,472,582`. *(These IDs look invalid/future-dated — verify before relying on them.)*
- Retry/backoff constants `gemini.ts:43-69`; `User-Agent: 'aistudio-build'` `gemini.ts:19`.
- **Python binary + script paths** `python run_pipeline.py`, `evaluation_metrics/…` hardcoded and shelled via `execSync` — `server/index.ts:551,558,513-514`.
- Default geo codes `'PB'/'LDH'/'LDH-01'`, fallback school `'GPS'` — `server/index.ts:1095-1097,381,679`.
- ✅ Correctly env-driven already: `GEMINI_API_KEY` (`gemini.ts:9`), `PORT` (`index.ts:14`), `CHROME_EXECUTABLE_PATH` (`paperGenerator.ts:129`).

---

## 4. Duplicated logic across files

| # | Duplication | Locations | Risk |
|---|---|---|---|
| 4.1 | **`levelGenerator.ts` — byte-identical** (485 ln) except the import on line 1 | `server/levelGenerator.ts` ↔ `src/utils/levelGenerator.ts` | Will silently drift |
| 4.2 | **Entire backend re-implemented twice** (auth, locks, scoring, escalation, analytics) | `src/mock/fetchInterceptor.ts` ↔ `server/index.ts` | Two sources of truth; frontend runs the weaker one |
| 4.3 | **Three seed datasets** | `src/constants.ts`, `src/mock/dbStore.ts`, `public/mock/*.json` | Inconsistent demo data |
| 4.4 | **Three question-generation paths** | `levelGenerator.ts` (both copies), `gemini.ts:113-348` (`generateClassSpecificDiagnostic`), `paperGenerator.ts` HTML gen | Divergent question logic |
| 4.5 | **Certification `>=5` computed in ≥6 places** | see §3.3 | Change one, miss five |
| 4.6 | **Score-band thresholds inlined** in many JSX expressions | `PanelViews.tsx`, `RoleDashboards.tsx` | Cosmetic drift |
| 4.7 | **`classNum` parse-from-name** | `RoleDashboards.tsx:1812,2439`, `BulkDiagnosticWorkflow.tsx` | Minor |
| 4.8 | **Teacher & Volunteer dashboards ~600 ln near-identical** (`handlePrintLevelWorksheet`, `handleAddStudent`, roster table, bulk-job polling, workflow guards) | `RoleDashboards.tsx:1434-2062` ↔ `2068-2702` | Two copies to maintain |
| 4.9 | **`handleAddStudent` verbatim duplicate** | `RoleDashboards.tsx:1534-1586` ↔ `2166-2218` | Drift |
| 4.10 | **Bulk-job polling `useEffect` (1500ms)** repeated 3× | `RoleDashboards.tsx:1515,2147`, `BulkDiagnosticWorkflow.tsx:31` | Extract `useBulkJob` hook |
| 4.11 | **`Math.round((score/total)*100)` and cert/avg-level computations** repeated ~10–15× | throughout `PanelViews.tsx` | Extract `scoreUtils` |
| 4.12 | **Diagnostic result scorecard UI** rendered near-identically | `DiagnosticWorkflow.tsx:277-311`, `IcrScanner.tsx:513-562`, `WorksheetWorkflow.tsx:460-518` | Shared component |

---

## 5. What actually works and is worth keeping

The **server + Python side is the asset.** It is more complete and closer to the SRS than the frontend suggests.

**Keep (real, working):**
- **Real Gemini AI integration** with retry/backoff, model fallback, and structured `responseSchema` — `server/gemini.ts:14,29-76,379,464,557`. Each AI path has a deterministic non-AI fallback (`:423,516,617`), so it degrades gracefully.
- **Real HTML→A4 PDF generation** via Puppeteer + pdf-lib — `server/paperGenerator.ts:37,117,281`, `worksheetRenderer.ts:14`, `pdfMerge.ts`. Output written to `output/` and served statically (`index.ts:24`).
- **Real Python evaluation pipeline** (classify → compare → evaluate → report) — `evaluation_metrics/scripts/0..3_*.py`, driven from `index.ts:551,558`. Matches SRS §9's three stages. *(Integration is fragile — synchronous `execSync`, hard `python`-in-PATH dependency.)*
- **Correct server-side governance logic** (this is the SRS work, done right): pairwise generation lock `index.ts:721-744`; delayed-attempt ban after 3, school lockout `index.ts:1019-1045`; timing-window sequencing `index.ts:770-815`; Aadhaar masking for non-superadmin `index.ts:314-320,346-356`; role-scoped data filtering `index.ts:171,300-330`; revive/restore `index.ts:1205,1251`. The docs in `mvp/docs/` accurately describe this behavior.
- **~30 real REST endpoints** in `server/index.ts` covering auth, students, worksheets, diagnostics, evaluation, analytics, admin, bulk jobs.
- **Frontend UI shell** — the React dashboards, landing page, login, charts, and workflow components are a genuinely usable, polished UI. Worth keeping as the presentation layer once wired to the real API. Cleanest, most reusable pieces (good refactor templates): `Layout.tsx` (role-driven nav shell), `LogbookPanel.tsx`, `BulkDiagnosticWorkflow.tsx` (proper validation + polling cleanup), `AssessmentCalendar.tsx`, `TicketSubmission.tsx`, and the shared primitives `Table`/`MetricCard`/`Form`/`SvgLibraryResolver`/`WorksheetIframeModal`.
- **Curriculum/exam data** — `evaluation_metrics/questions/`, `syllabus/`, `prompts/`, and `mvp/docs/FLN_Levels_Complete_Data.md` are real content assets.

**Don't keep / retire:**
- `src/mock/fetchInterceptor.ts`, `src/mock/dbStore.ts` — the fake backend (delete once frontend calls the real server).
- `public/mock/*.json` — redundant third dataset.
- One of the two `levelGenerator.ts` copies.
- `src/main.tsx:8` interceptor install.

**Caveats on "working" (server-side, must fix before any real use):**
- **Critical auth bypass:** unknown `@fln.org` emails are auto-promoted to a role inferred from the prefix — anyone can send `Authorization: Bearer superadmin@fln.org` and become superadmin — `server/index.ts:39-77`. No password, no signing.
- **No password hashing** (comment admits it) — `index.ts:106`; seed users have no password field.
- **`/api/reset` has no auth** (GET or POST) — anyone can wipe the DB — `index.ts:1298,1304`. Same for several GET reads (`/api/schools`, `/api/announcements`, evaluation history).
- **"MongoDB" is a single JSON file** rewritten in full on every mutation — `server/db.ts:5,268-270` — no concurrency safety, no indexes, no transactions (`data/db.json`). Fine for a demo, not for the national scale the SRS describes.
- **Command-injection surface** — server-generated ids/classNumber flow into `execSync` shell strings unsanitized — `index.ts:551,558`.

---

## 6. Prioritized action list

| Rank | Action | Blast × Effort | Refs |
|---|---|---|---|
| 🔴 **P0-1** | **Remove the fetch interceptor; point the frontend at the real server.** Collapses §2, §4.2, §4.3 at once and makes the app actually use its backend. | High × Med | `main.tsx:8`, `src/mock/*` |
| 🔴 **P0-2** | **Fix auth:** hash passwords, verify them, issue signed JWTs, and delete the email-prefix→role synthesis. | Critical × Med | `index.ts:39-77,101-108`, `fetchInterceptor.ts:207-224` |
| 🔴 **P0-3** | **Lock down open endpoints** — require auth on `/api/reset`, schools, announcements, evaluation history. Remove client-side `handleRoleSwitch`. | High × Low | `index.ts:1298,1304,289,123,1078`, `App.tsx:127` |
| 🔴 **P0-4** | **Stop shipping secrets/PII to the browser** — answer keys (`utils/levelGenerator.ts`), student PII (`PanelViews.tsx:354-361`), demo passwords (`LoginView.tsx`). Move to backend / remove. Folds into P0-1. | High × Low | §2.13, §3.1, PII above |
| 🟠 **P1-1** | **De-duplicate `levelGenerator.ts`** — single shared module. | Med × Low | §4.1 |
| 🟠 **P1-2** | **Extract one config module** for the magic numbers (`59`, cert `5`, bands `80/60`, windows, model IDs). | Med × Low | §3.3, §3.4 |
| 🟠 **P1-3** | **Move seed data out of `src/`** into fixtures/DB; pick one dataset, delete the other two. | Med × Med | §3.2, §4.3 |
| 🟡 **P2-1** | **Harden the Python integration** — async job + argument sanitization instead of `execSync` with interpolated ids. | Med × Med | `index.ts:551,558` |
| 🟡 **P2-2** | **Split the two god-files** (`RoleDashboards.tsx` 2702 ln, `PanelViews.tsx` 1455 ln) once the API layer is stable. | Med × High | §1 |
| 🟡 **P2-3** | Verify/replace the Gemini model IDs (look invalid). | Med × Low | `gemini.ts:35-37` |
| ⚪ **P3** | Plan the JSON-file → real DB (MongoDB per SRS) migration; implement missing SRS rules (50%-fail auto-flag). | High × High (later) | `db.ts`, SRS §6.7 |

---

*Audit is read-only; no files were modified. Line numbers are from the repository state on 2026-07-10.*
