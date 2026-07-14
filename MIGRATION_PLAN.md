# FLN Platform — Target Structure & Migration Plan

**Companion to:** [AUDIT.md](AUDIT.md)
**Status:** Proposal for review — no code written yet.
**Guiding principle from the audit:** the real backend (`server/` + `evaluation_metrics/`) is the asset; the in-browser fake backend (`src/mock/`) is the liability. This plan keeps the app runnable at every step while we (1) separate frontend/backend cleanly, (2) modularize by domain, and (3) delete the mock backend last, only once the real one is proven wired-in.

---

## 1. Target folder structure

A monorepo with three deployable units — **frontend** (React), **backend** (Node API/orchestration), **ai-services** (Python). Backend and frontend are each organized **by domain**, not by technical layer.

```
fln/
├── README.md  SRS.md  PRD.md  AUDIT.md  MIGRATION_PLAN.md
├── package.json                      # workspaces root (npm/pnpm workspaces)
├── docs/                             # existing mvp/docs/* moves up here
│
├── frontend/                         # React + Vite (was mvp/src + public)
│   ├── index.html  vite.config.ts  tsconfig.json
│   ├── public/
│   │   └── worksheets/               # standalone HTML worksheet templates (kept)
│   └── src/
│       ├── main.tsx  App.tsx  index.css
│       ├── lib/
│       │   ├── apiClient.ts          # NEW — single fetch wrapper, auth header, base URL
│       │   └── config.ts             # NEW — thresholds/labels that are truly presentational
│       ├── types/                    # shared DTO types (mirror backend contracts)
│       ├── components/ui/            # shared primitives: Table, MetricCard, Form, Card, Charts,
│       │                             #   SvgLibraryResolver, WorksheetIframeModal
│       ├── layout/                   # Layout, sidebar/nav, breadcrumbs
│       ├── auth/                     # LoginView, session hook
│       └── features/                 # by domain — each has components + a hook calling apiClient
│           ├── dashboard/            # role dashboards (split from RoleDashboards god-file)
│           │   ├── SuperadminDashboard.tsx  AdminDashboard.tsx
│           │   ├── SchoolDashboard.tsx       StaffDashboard.tsx   # Teacher+Volunteer unified
│           │   └── hooks/ (useClassRoster, useBulkJob, scoreUtils)
│           ├── students/             # roster, add-student, profile, StudentDashboard (shared)
│           ├── worksheets/           # WorksheetWorkflow, generation, PDF, iframe modal
│           ├── diagnostics/          # DiagnosticWorkflow, BulkDiagnosticWorkflow, IcrScanner
│           ├── evaluation/           # result scorecard (shared), report views
│           ├── analytics/            # regional/scope analytics, charts panels
│           ├── governance/           # tickets, announcements, logbook, calendar
│           └── landing/              # LandingView
│
├── backend/                          # Node + Express (was mvp/server)
│   ├── package.json  tsconfig.json
│   └── src/
│       ├── index.ts                  # app bootstrap only (was the 1580-ln index.ts, gutted)
│       ├── config/                   # NEW — env + constants (levels=59, cert=5, windows, models)
│       ├── middleware/               # auth (JWT verify), role-guard, error handler, request log
│       ├── db/                       # persistence abstraction (see §3 note on JSON→Mongo)
│       │   ├── index.ts              # repository interface
│       │   └── jsonStore.ts          # current data/db.json impl, behind the interface
│       ├── lib/
│       │   ├── gemini.ts             # AI client (moved as-is, model IDs → config)
│       │   ├── pdf/                  # paperGenerator, worksheetRenderer, pdfMerge, classAdapters
│       │   └── pythonBridge.ts       # NEW — safe wrapper around the Python pipeline (no execSync-with-interp)
│       └── modules/                  # by domain — each: routes.ts, service.ts, repo.ts, schema.ts
│           ├── auth/                 # login, me, tokens, password hashing
│           ├── users/               # coordinators/admin-create, role management
│           ├── schools/  classes/  students/
│           ├── worksheets/           # generation + lock enforcement lives here
│           ├── diagnostics/          # single + bulk jobs
│           ├── evaluation/           # calls ai-services, stores reports
│           ├── analytics/
│           ├── governance/           # generation-lock service, defaulter/escalation engine
│           └── content/              # tickets, announcements, logbook, curriculum/levels
│
├── ai-services/                      # Python (was mvp/evaluation_metrics) — largely as-is
│   ├── requirements.txt
│   ├── pipeline/ (run_pipeline.py, personalized_evaluation_pipeline.py, scripts/0..3, _api.py)
│   ├── prompts/  questions/  syllabus/
│   └── (optionally) a thin FastAPI/CLI entrypoint the backend calls
│
├── shared/                           # NEW — cross-cutting contracts
│   ├── domain-constants.*            # MAX_LEVEL=59, CERT_LEVEL=5, SCORE_BANDS, TIMING_WINDOWS
│   └── types/                        # request/response DTOs shared by front+back
│
└── data/                             # backend runtime store (db.json today; DB later)
    └── seed/                         # all seed data consolidated here (was constants.ts + 4 mock sets)
```

**Why this shape:** frontend and backend never share a process or a `fetch` monkey-patch; every domain concept (students, worksheets, governance…) has exactly one home on each side; thresholds live in `shared/` and `config/` instead of being sprinkled across ~15 files.

---

## 2. Where each existing file goes

### Backend — mostly moves, some gutting
| Current | Target | Action |
|---|---|---|
| `server/gemini.ts` | `backend/src/lib/gemini.ts` | **Move as-is**, then lift model IDs → `config/` |
| `server/paperGenerator.ts`, `worksheetRenderer.ts`, `pdfMerge.ts`, `classAdapters.ts` | `backend/src/lib/pdf/` | **Move as-is** |
| `server/db.ts` | `backend/src/db/jsonStore.ts` | **Move**, wrap behind a repository interface |
| `server/levelGenerator.ts` | `backend/src/modules/content/levelGenerator.ts` | **Move; becomes the single copy** (delete the `src/utils` twin) |
| `server/index.ts` (1580 ln) | split → `backend/src/index.ts` + `modules/*/routes.ts` | **Rewrite/split** — carve each endpoint group into its module; keep the logic, change the file boundaries |
| `data/db.json` | `data/db.json` | Stays (runtime store) |

### Python — moves wholesale
| Current | Target | Action |
|---|---|---|
| `evaluation_metrics/**` | `ai-services/**` | **Move as-is.** Only change: the backend invokes it through `pythonBridge.ts` with sanitized args instead of interpolated `execSync` |

### Frontend — move the UI, split the god-files, delete the mock
| Current | Target | Action |
|---|---|---|
| `src/main.tsx` | `frontend/src/main.tsx` | **Rewrite** — remove `setupFetchInterceptor()` (the whole point) |
| `src/App.tsx` | `frontend/src/App.tsx` | **Rewrite lightly** — drop `handleRoleSwitch`, use `apiClient` |
| `src/components/RoleDashboards.tsx` (2702 ln) | `features/dashboard/*` | **Split + partly rewrite** — 5 dashboards → files; unify Teacher+Volunteer into `StaffDashboard`; extract `useBulkJob`/`useClassRoster`/`scoreUtils` |
| `src/components/PanelViews.tsx` (1455 ln) | `features/{students,analytics,evaluation}/*` | **Split + rewrite** — replace in-file `*_MOCK`/PII with API calls |
| `src/components/IcrScanner.tsx` | `features/diagnostics/IcrScanner.tsx` | **Move UI, rewrite data** — remove `Math.random()` fake extraction; call backend |
| `WorksheetWorkflow`, `DiagnosticWorkflow`, `BulkDiagnosticWorkflow` | `features/{worksheets,diagnostics}/` | **Move**, thin out client-side timing/scoring |
| `LoginView.tsx` | `frontend/src/auth/LoginView.tsx` | **Move**, delete hardcoded credential roster |
| `Layout.tsx`, `LogbookPanel/View`, `TicketSubmission`, `AssessmentCalendar`, `LandingView` | `layout/`, `features/governance/`, `features/landing/` | **Move as-is** (near-clean already) |
| `Card, Charts, Form, MetricCard, Table, SvgLibraryResolver, WorksheetIframeModal` | `components/ui/` | **Move as-is** |
| `src/constants.ts` (763 ln) | `data/seed/` + `shared/domain-constants` | **Split** — seed data → backend seed; real constants → shared; delete the rest |
| `src/utils/levelGenerator.ts` | — | **Delete** (duplicate of server copy; answer keys must not be client-side) |
| `src/mock/fetchInterceptor.ts`, `src/mock/dbStore.ts` | — | **Delete** (last step) |
| `public/mock/*.json` | — | **Delete** (redundant seed) |
| `public/worksheets/*` | `frontend/public/worksheets/` | **Move as-is** |
| `docs/**` | `docs/**` (repo root) | **Move as-is** |

---

## 3. Rewrite vs move-as-is — the short version

**Move as-is (works, just relocates):** `gemini.ts`, all PDF generators, the entire Python pipeline, the UI primitives, `Layout`, `AssessmentCalendar`, `TicketSubmission`, `LogbookPanel`, `LandingView`, worksheet HTML assets, docs.

**Move + light edit:** `db.ts` (wrap in interface), `App.tsx` (drop role-switch, use apiClient), `LoginView` (drop creds), the workflow components (thin out client logic), `constants.ts` (split).

**Rewrite / restructure:** `server/index.ts` → per-module routes; `RoleDashboards.tsx` and `PanelViews.tsx` → split by feature + extract shared hooks; `main.tsx` → remove interceptor; the mock backend → **deleted, not migrated** (its correct behaviors already exist in `server/`).

**Net-new (small):** `apiClient.ts`, `config/`, `middleware/` (real JWT auth + role guard), `pythonBridge.ts`, `shared/domain-constants`, module `schema.ts` validators.

> **DB note:** this plan does **not** couple restructuring to the JSON→MongoDB migration. `db.ts` moves behind a repository interface now; swapping `jsonStore` for a Mongo implementation later touches only `backend/src/db/` and nothing else. Keep them separate so structure work doesn't block on a data-layer rewrite.

---

## 4. Migration order (app never fully breaks)

Each phase ends with a runnable app. Auth is deliberately near the end of the "logic" work because flipping it changes every request — we stage the plumbing first.

**Phase 0 — Scaffold, no behavior change.**
Create the `frontend/ backend/ ai-services/ shared/` folders and workspace config *alongside* `mvp/`. Nothing wired yet. App still runs from `mvp/`.

**Phase 1 — Relocate the backend, unchanged.**
Move `server/**` → `backend/src/` and `evaluation_metrics/**` → `ai-services/`, keeping `index.ts` monolithic for now. Fix imports/paths only. Verify: the real API boots and responds to curl exactly as before. (Frontend still on the mock — untouched.)

**Phase 2 — Extract config & de-dupe generators.**
Introduce `backend/src/config/` and `shared/domain-constants`; replace magic numbers/model IDs with references. Delete `src/utils/levelGenerator.ts`, keep the backend copy. No endpoint behavior changes.

**Phase 3 — Modularize the backend internally.**
Split `index.ts` into `modules/*/routes.ts` + `service.ts`. Pure refactor behind the same routes; curl contract unchanged after each module is carved out. Add `middleware/` scaffolding (role-guard) but keep the existing weak identity for now.

**Phase 4 — Relocate the frontend shell, still on the mock.**
Move `src/**` → `frontend/src/**`, move UI primitives/layout/landing into place. App still runs via the fetch interceptor. This isolates "moving files" from "changing the data source."

**Phase 5 — Introduce `apiClient`, cut over read paths first.**
Add `apiClient.ts` pointing at the real backend. Migrate **read-only** screens (dashboards, analytics, logbook, announcements) off the interceptor one feature at a time. The interceptor stays installed and still handles whatever hasn't been cut over — so the app is always whole. Split `RoleDashboards`/`PanelViews` during this pass as each feature moves.

**Phase 6 — Cut over write/mutation paths.**
Move students/worksheets/diagnostics/tickets mutations to the real API. Remove the `Math.random()` ICR simulation (call backend), remove client-side scoring/lock/timing computation. After each feature, that route no longer touches the mock.

**Phase 7 — Harden auth (single, deliberate switch).**
Implement password hashing + real JWT + role-guard on the backend; delete the email-prefix→role synthesis and the client `handleRoleSwitch`; require auth on the open endpoints (`/api/reset`, schools, etc.). Update `LoginView`/session to real tokens. This is the one intentionally breaking change — done in isolation so it's easy to verify and revert.

**Phase 8 — Delete the mock backend.**
With every feature on the real API, remove `src/mock/**`, `public/mock/**`, the interceptor install in `main.tsx`, hardcoded PII/answer-keys/credentials, and the leftover seed in `constants.ts`. Consolidate all seed into `data/seed/`.

**Phase 9 — Cleanup & retire `mvp/`.**
Remove the now-empty `mvp/` wrapper, finalize workspace scripts, update `docs/` and README paths.

**(Later, decoupled) Phase 10 — Data layer.** Swap `jsonStore` for MongoDB behind the repository interface; implement the missing SRS rules (50%-fail auto-flag). Touches only `backend/src/db/` + the relevant module.

---

## 5. Guardrails during migration
- **One data source per feature at a time** — the interceptor is removed feature-by-feature (Phases 5–6), never all at once, so there's always a working fallback.
- **Backend contract is frozen through Phases 1–4** — curl tests written in Phase 1 act as the regression net while the frontend moves.
- **Auth is one isolated phase (7)** — the only planned hard break, so a problem there can't be confused with a relocation bug.
- **DB migration is out of the critical path** — behind the repo interface from Phase 1, done whenever, not blocking structure work.

---

*Review targets: (a) the three-unit split and domain module list in §1, (b) the Teacher+Volunteer→`StaffDashboard` unification, (c) the phase ordering in §4 — especially deferring auth to Phase 7 and DB to Phase 10.*
