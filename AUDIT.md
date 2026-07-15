# FLN Platform — Codebase Audit (Update)

**Scope:** entire monorepo (`frontend/`, `backend/`, `ai-services/`, `docs/`, plus root docs).
**Method:** static read-through of every source file; no code was changed.
**Date:** 2026-07-14
**Supersedes:** the 2026-07-10 `AUDIT.md` (which audited the pre-migration `mvp/` layout).

**TL;DR:** The folder-level move described in `MIGRATION_PLAN.md` happened — `mvp/server` → `backend/src`, `mvp/src` → `frontend/src`, `mvp/evaluation_metrics` → `ai-services`. **Nothing else in the plan happened.** The plan's Phases 2–9 (config extraction, domain modules, `apiClient`, real auth, deleting the mock) are all still open. The frontend still boots a fake in-browser backend (`frontend/src/mock/fetchInterceptor.ts`, installed from `main.tsx:8`) instead of calling the real `backend/`. Every P0/P1 finding from the last audit is still present, unchanged, at the same severity. Two things got worse in the interim: `backend/src/index.ts` grew from 1580 → 1712 lines (more endpoints piled into the same monolith) and `RoleDashboards.tsx` grew from 2702 → 2849 lines. New work (bulk diagnostic jobs, level-wise PDF generation, the `classAdapters` registry) is genuinely well-built but inherits the same unfixed backend problems (no auth on new endpoints, `execSync` with interpolated args, client-side answer keys).

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

## 1. What actually changed since the last audit (2026-07-10 → 2026-07-14)

| Area | Then (`mvp/`) | Now | Verdict |
|---|---|---|---|
| Top-level layout | `mvp/src`, `mvp/server`, `mvp/evaluation_metrics` | `frontend/`, `backend/`, `ai-services/` (npm workspaces root `package.json`) | ✅ Done — Phase 1/4 of the migration plan |
| `backend/src/index.ts` | 1580 ln, monolithic | **1712 ln**, still monolithic — no `modules/`, `middleware/`, `config/`, `db/` subfolders exist | ❌ Not started — Phase 3 skipped |
| `shared/` (domain constants, DTOs) | proposed, didn't exist | **still doesn't exist** | ❌ Not started — Phase 2 skipped |
| Frontend `apiClient.ts` | proposed | **doesn't exist**; no `lib/`, `features/`, `auth/`, `layout/` folders — components are still a flat list under `src/components/` | ❌ Not started — Phase 5 skipped |
| Mock backend (`fetchInterceptor.ts`, `dbStore.ts`) | live, installed in `main.tsx` | **still live, still installed** (`main.tsx:5-8`) | ❌ Not started — Phases 5–8 skipped |
| `RoleDashboards.tsx` | 2702 ln god-file | **2849 ln** — grew, not split | ❌ Worse |
| `PanelViews.tsx` | 1455 ln god-file, in-file PII/mocks | 1455 ln, unchanged, PII intact | ❌ Not started |
| Auth (password hashing, JWT, role-guard middleware) | none; email-prefix role synthesis | **identical code**, same file/line shape; `backend/package.json` still has no `bcrypt`/`jsonwebtoken`/similar dependency | ❌ Not started — Phase 7 skipped |
| Duplicate `levelGenerator.ts` | two byte-identical copies | **still two copies** (`backend/src/levelGenerator.ts`, `frontend/src/utils/levelGenerator.ts`, both 485 ln) | ❌ Not started — Phase 2 skipped |
| New feature work | — | **Diagnostic Paper Generator** extended: `backend/src/classAdapters.ts` (adapter registry for `CLASS_1..4` + new `LEVEL_PERSONALIZED` pointing at `levels_main.html`), `/api/diagnostic/bulk` (+ progress/download), `/api/diagnostic/single`, `/api/worksheets/generate-level-pdf` | 🟡 New surface, see §4 |
| `docs/` | lived under `mvp/docs/` | moved to repo-root `docs/`, content unchanged | ✅ Done |
| `ai-services/` | `mvp/evaluation_metrics/` | moved, unchanged; still invoked via `execSync` with string-interpolated args, not the planned `pythonBridge.ts` | 🟡 Moved but not hardened — Phase 6 note skipped |

**Bottom line:** this was a **relocation**, not a **remediation**. Every security/architecture finding below already existed in the last audit; they're repeated here (updated to current line numbers) because the user asked for the current, accurate picture — not a diff.

---

## 2. Current repo map

```
fln/
├── README.md  SRS.md  PRD.md  AUDIT.md  MIGRATION_PLAN.md  ARCHITECTURE.md  CLAUDE.md  CONTRIBUTING.md  CHANGELOG.md
├── package.json                     # npm workspaces: frontend, backend (ai-services NOT a workspace member)
├── docs/                            # teacher workflow docs — describe backend/ behavior
├── Research/                        # curriculum/pedagogy research notes
├── FLN Levels Structure/            # 59 level content folders (curriculum source docs)
│
├── frontend/                        # React 19 + Vite + Tailwind
│   ├── index.html  vite.config.ts  tsconfig.json  package.json
│   ├── public/
│   │   ├── mock/*.json              # ⚠ THIRD mock dataset, still present
│   │   └── worksheets/              # class1-4.html + levels_main.html (8811 ln) + jspdf/html2canvas/jszip
│   └── src/
│       ├── main.tsx                 # ⚠ still calls setupFetchInterceptor() before render
│       ├── App.tsx                  # role switch still client-side (App.tsx handleRoleSwitch)
│       ├── constants.ts (763 ln)    # ⚠ hardcoded seed data
│       ├── mock/
│       │   ├── fetchInterceptor.ts (829 ln)  # ⚠ FAKE BACKEND — still answers /api/* in-browser
│       │   └── dbStore.ts (1006 ln)          # ⚠ localStorage "database"
│       ├── utils/levelGenerator.ts (485 ln)  # ⚠ duplicate of backend/src/levelGenerator.ts, ships answer keys
│       └── components/ (24 files, flat — no feature folders)
│           ├── RoleDashboards.tsx (2849 ln)  # ⚠ god-file, grew since last audit
│           ├── PanelViews.tsx (1455 ln)      # ⚠ god-file, in-file PII + mock data
│           ├── IcrScanner.tsx (601 ln)       # simulated scanner, Math.random() "extraction"
│           └── ...
│
├── backend/                         # Node/Express + TS
│   ├── package.json  tsconfig.json
│   └── src/
│       ├── index.ts (1712 ln)       # ⚠ all ~31 endpoints in one file; no modules/middleware/config dirs
│       ├── db.ts (2190 ln)          # JSON-file store (data/db.json), not MongoDB
│       ├── gemini.ts (646 ln)       # real Gemini integration; hardcoded model IDs
│       ├── paperGenerator.ts (415 ln), worksheetRenderer.ts, pdfMerge.ts  # real Puppeteer/pdf-lib pipeline
│       ├── classAdapters.ts (73 ln) # NEW — adapter registry, well-designed (see §4)
│       └── levelGenerator.ts (485 ln)
│
├── ai-services/                     # Python (moved from mvp/evaluation_metrics, unchanged)
│   ├── run_pipeline.py, personalized_evaluation_pipeline.py, run_evaluation_c2p2.py
│   ├── scripts/ (implied 0..3 pipeline stages), prompts/, questions/{class_1..4}/, syllabus/{class_1..4}/
│   └── requirements.txt, PIPELINE.md
│
└── data/ (referenced by backend/src/db.ts as db.json; not present at this path in the archive — see §5.4)
```

### Data-flow reality (unchanged from last audit)
- `frontend/src/main.tsx:5,8` imports and calls `setupFetchInterceptor()` before `createRoot(...).render()`.
- The interceptor still answers any URL containing `/api/` locally against `localStorage`; only unmatched paths reach the network. The React app's `/api/*` calls — now including the newer `/api/diagnostic/bulk`, `/api/worksheets/generate-level-pdf` calls — need to be checked one-by-one for whether the interceptor has a matching mock branch; where it doesn't, those calls silently fall through to a backend that isn't running in the default dev flow described in `README.md`.
- `backend/`, `ai-services/` only get exercised via direct HTTP/CLI calls (curl, `backend/test_submit.cjs`), not through the shipped app.

---

## 3. Business logic still in the frontend that belongs on the backend

(Same substance as the 2026-07-10 audit; paths updated to the new tree. Nothing here has moved.)

| # | Logic | Frontend location | Should be |
|---|---|---|---|
| 3.1 | Authentication — password never verified server-side either; client only checks length/complexity | `frontend/src/mock/fetchInterceptor.ts` | Backend, and backend needs real verification too (§5.1) |
| 3.2 | Identity/role resolution from email prefix, synthesizes a user with no credential check | `fetchInterceptor.ts` (mirrors `backend/src/index.ts` `getAuthUser`, lines 32-79) | Real session/auth |
| 3.3 | Diagnostic scoring + level placement | `fetchInterceptor.ts` | `ai-services`/backend evaluation pipeline (which already exists and is correct) |
| 3.4 | Worksheet scoring + promotion (`≥80% → level+1`) | `fetchInterceptor.ts` | Backend |
| 3.5 | Generation-lock enforcement, sub-level assignment, certification rule (`currentLevel ≥ 5`), defaulter/escalation reversal | `fetchInterceptor.ts` | Backend (already implemented correctly in `backend/src/index.ts`) |
| 3.6 | ID generation (`STD_`, `WS_`, `Date.now()`, `Math.random()`) | `fetchInterceptor.ts` | Backend/DB |
| 3.7 | Question pool generation for levels 1–59, **including answer keys**, shipped to the browser | `frontend/src/utils/levelGenerator.ts` | Backend/curriculum service only |
| 3.8 | Client-side role switch — any logged-in user can become any role | `App.tsx` `handleRoleSwitch` | Remove; superadmin-only server action |
| 3.9 | ICR extraction faked with `Math.random()` (deliberately corrupts ~30% of answers to simulate OCR noise); result badge not tied to actual accuracy | `IcrScanner.tsx:110,114,116` | Real ICR/ML service |
| 3.10 | Client-side authorization decisions (who may restore a school, audit-log redaction, analytics scope) | `RoleDashboards.tsx`, `LogbookPanel.tsx` | Server must decide/redact |

---

## 4. New surface since the last audit — assessed

The Diagnostic Paper Generator work (class-level bulk pipeline, now being extended to the level-wise generator) added real functionality on top of the existing Puppeteer/pdf-lib pipeline:

- **`backend/src/classAdapters.ts`** — a small, clean adapter registry (`ADAPTERS: Record<string, Adapter>`) mapping `CLASS_1..4` and the new `LEVEL_PERSONALIZED` entry to their HTML template, PDF-building function name, and argument shape. This is a good pattern: it's typed, has a single lookup function (`getAdapter`) that throws with the valid-keys list on a miss, and is the right shape to extend for more levels. **Worth keeping and following as the template for other refactors** (e.g. the eventual `modules/` split in `MIGRATION_PLAN.md`).
- **`/api/diagnostic/bulk`, `/api/diagnostic/bulk/:jobId/progress`, `/api/diagnostic/bulk/:jobId/download`, `/api/diagnostic/single`, `/api/worksheets/generate-level-pdf`** — new endpoints in `backend/src/index.ts` (jobs tracked in an in-memory `Map<string, BulkDiagnosticJob>`).
  - 🔴 In-memory job map means **all bulk-job state is lost on server restart** and **doesn't scale past one process** — fine for a demo, worth flagging before this becomes the path another frontend (the roster-holding one mentioned as the broader goal) depends on programmatically.
  - 🔴 The two `execSync` calls with string-interpolated `classNumber`/`studentId` (`backend/src/index.ts:559,566,758`, pre-existing pattern) are now exercised by more call sites, widening the same command-injection surface rather than shrinking it.
  - `/api/diagnostic/bulk` does check `getAuthUser` and 401s if missing (`index.ts` inside the bulk handler) — better than several of the older endpoints, but since `getAuthUser` still accepts any well-formed `*@fln.org` email with no password check, this "auth" doesn't add real protection.
- **`frontend/public/worksheets/levels_main.html` (8811 ln)** — the level-wise counterpart to `class1-4.html`. It declares `answerKeys = []` as a parallel array to the generated worksheet HTMLs and embeds correct/wrong answer pairs directly in the page script (e.g. unit-conversion answer pairs around line 647). Same class of problem as `frontend/src/utils/levelGenerator.ts`: **this ships answer keys to any browser that loads the worksheet**, now for all 59 levels in addition to the four classes.

**Net assessment:** the new work is competently engineered (typed adapters, progress polling, per-job PDF output) and extends the existing *working* pipeline rather than duplicating it — this is the right way to grow the paper generator. It just hasn't addressed (and in the injection/answer-key cases, has slightly enlarged) the backend hardening debt that predates it.

---

## 5. Persisting critical issues (all present at last audit, still present)

### 5.1 Auth — unchanged
- Login only validates password *shape* (`length ≥ 8`, uppercase, number, special char), never the actual password against a stored credential — `backend/src/index.ts` `/api/auth/login`.
- Token = the user's own email, forgeable by construction — same handler.
- `getAuthUser` auto-promotes any unrecognized `*@fln.org` address to a role guessed from its prefix (`admin.` / `district.` / `block.` / `vol.` / `*.t` / else) with **no credential check at all** — `backend/src/index.ts:32-79`.
- No password-hashing dependency anywhere in `backend/package.json` (no bcrypt/argon2/etc.), confirming this was never wired up, not just disabled.

### 5.2 Open endpoints — unchanged
- `/api/reset` accepts both GET and POST with **no auth check**, and fully wipes/reseeds the database — `backend/src/index.ts`, "DATABASE RESET (Development convenience)" block.
- Several GET reads (schools, announcements, evaluation history) still have no auth gate.

### 5.3 Secrets/PII shipped to the browser — unchanged, now larger
- `frontend/src/components/PanelViews.tsx` `EXTENDED_PROFILES` (guardian names, phone numbers, home addresses, blood group, disability notes) — still present, still hardcoded, still shipped in the bundle to every visitor regardless of role.
- Demo password `Fln@2026` for all 12 accounts, printed in the login UI — `LoginView.tsx`.
- Answer keys for all 4 classes *and now all 59 levels* shipped client-side (§4).

### 5.4 Data layer
- `backend/src/db.ts` is still a single JSON file rewritten in full on every mutation — no concurrency safety, no transactions. The runtime file itself (`data/db.json`) isn't present in this archive (likely gitignored/runtime-generated), consistent with `.gitignore` entries seen for `node_modules`; worth confirming it isn't accidentally excluded from deploys too.

### 5.5 Three-to-four parallel seed/mock datasets — unchanged
`frontend/src/constants.ts`, `frontend/src/mock/dbStore.ts`, `frontend/public/mock/*.json`, and in-file mocks inside `PanelViews.tsx` (`STUDENTS_MOCK`, `REPORTS_MOCK`, `QUESTION_BANK`) all still coexist.

### 5.6 Gemini model IDs
`gemini-3.5-flash`, `gemini-3.1-flash-lite`, `gemini-3.1-pro-preview` are still hardcoded and repeated across `backend/src/gemini.ts` (lines 35-37, 394, 472, 582). These names don't correspond to any publicly documented Gemini model line — worth verifying against the actual Gemini API model catalog before relying on them in production, since a silent fallback-model swap could change output quality without anyone noticing.

---

## 6. Duplicated logic — unchanged from last audit

| # | Duplication | Locations |
|---|---|---|
| 6.1 | `levelGenerator.ts` byte-identical (485 ln each) | `backend/src/levelGenerator.ts` ↔ `frontend/src/utils/levelGenerator.ts` |
| 6.2 | Entire backend re-implemented twice (auth, locks, scoring, escalation, analytics) | `frontend/src/mock/fetchInterceptor.ts` ↔ `backend/src/index.ts` |
| 6.3 | Four seed datasets | `constants.ts`, `dbStore.ts`, `public/mock/*.json`, in-file mocks in `PanelViews.tsx` |
| 6.4 | Certification `>=5` computed in ~6 places | `RoleDashboards.tsx`, `fetchInterceptor.ts`, `backend/src/index.ts` |
| 6.5 | Teacher & Volunteer dashboards still ~600 ln near-identical | `RoleDashboards.tsx` |
| 6.6 | Bulk-job polling `useEffect` pattern repeated across dashboard + `BulkDiagnosticWorkflow.tsx`, now also matched by the new backend `bulkJobs` polling pattern | `RoleDashboards.tsx`, `BulkDiagnosticWorkflow.tsx`, `backend/src/index.ts` |

---

## 7. What's genuinely good and worth keeping (updated)

Everything the last audit called out as the real asset is still the real asset, plus the new adapter work:

- **`classAdapters.ts`** (new) — clean, typed, extensible; the model to copy elsewhere.
- **Gemini integration with fallback chain and deterministic non-AI fallback** — `backend/src/gemini.ts`.
- **Puppeteer + pdf-lib PDF pipeline**, now generalized across 4 classes + 59 levels via the adapter registry — `paperGenerator.ts`, `worksheetRenderer.ts`, `pdfMerge.ts`, `classAdapters.ts`.
- **Python evaluation pipeline** (classify → compare → evaluate → report) — `ai-services/`.
- **Correct server-side governance logic** — generation lock, delayed-attempt ban, timing windows, Aadhaar masking, revive/restore — all still intact in `backend/src/index.ts`, just still unreachable from the shipped app because of §2.
- **React UI shell** — dashboards, landing page, workflows remain a usable, polished presentation layer once wired to the real API.
- **npm workspaces** now correctly split `frontend`/`backend` as independent packages — genuine, if partial, progress on `MIGRATION_PLAN.md` §1.

---

## 8. Prioritized action list

| Rank | Action | Blast × Effort | Refs |
|---|---|---|---|
| 🔴 **P0-1** | Remove `setupFetchInterceptor()` from `main.tsx`; point frontend at `backend/` via a real `apiClient`. This is Phase 5 of the existing migration plan — still not started. | High × Med | `frontend/src/main.tsx:5,8` |
| 🔴 **P0-2** | Fix auth: hash + verify passwords, issue signed tokens, delete the email-prefix→role synthesis. | Critical × Med | `backend/src/index.ts` (`getAuthUser`, `/api/auth/login`) |
| 🔴 **P0-3** | Require auth on `/api/reset` and remaining open GETs; delete client-side `handleRoleSwitch`. | High × Low | `backend/src/index.ts`, `App.tsx` |
| 🔴 **P0-4** | Stop shipping answer keys and PII to the browser — this now spans 4 classes **and** 59 levels (`levels_main.html`), plus `PanelViews.tsx` PII and demo passwords in `LoginView.tsx`. | High × Low | §3.7, §4, §5.3 |
| 🔴 **P0-5** | Replace the two interpolated `execSync` calls with sanitized args or a proper subprocess API (argv array, not a template string) — surface widened by the new bulk/single diagnostic endpoints. | High × Low-Med | `backend/src/index.ts:559,566,758` |
| 🟠 **P1-1** | De-duplicate `levelGenerator.ts` into one shared module (backend-only). | Med × Low | §6.1 |
| 🟠 **P1-2** | Persist bulk-job state (currently an in-memory `Map`) if another frontend is going to depend on `/api/diagnostic/bulk` programmatically, per the stated broader goal. | Med × Med | §4 |
| 🟠 **P1-3** | Extract one config module for magic numbers (`59`, cert `5`, score bands, timing windows, Gemini model IDs) — Phase 2 of the migration plan, still not started. | Med × Low | §5.6, MIGRATION_PLAN.md §1 |
| 🟠 **P1-4** | Consolidate seed data; delete the redundant `public/mock/*.json` and in-file `PanelViews.tsx` mocks once real API is wired. | Med × Med | §6.3 |
| 🟡 **P2-1** | Split `RoleDashboards.tsx` (now 2849 ln) and `PanelViews.tsx` (1455 ln) — Phase 5's planned `features/` split, still not started, and the former has grown. | Med × High | §2 |
| 🟡 **P2-2** | Verify the Gemini model IDs against the current API catalog. | Med × Low | §5.6 |
| ⚪ **P3** | Plan JSON-file → real DB migration; implement the SRS's 50%-fail auto-flag rule (still not found in either backend). | High × High (later) | `db.ts` |

---

*Audit is read-only; no files were modified. Line numbers are from the repository state as uploaded on 2026-07-14.*