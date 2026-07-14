# Changelog

## Post MVP Changes

### 1. Complete Project Restructure

* Complete restructure of the project — from a single flat `mvp/` directory to an npm-workspaces monorepo with separated concerns.

#### Previous Structure (Before)

```
fln/
├── README.md / SRS.md                         # repo-level docs only
├── FLN Levels Structure/                      # 59 curriculum levels (unchanged in restructure)
├── Research/                                  # reference material (unchanged in restructure)
└── mvp/                                       # ★ everything lived here — frontend, backend, AI, docs
    ├── .env.example / package.json / tsconfig.json / vite.config.ts / index.html
    │
    ├── server/                                # backend code (→ became backend/src/)
    │   ├── index.ts / db.ts / gemini.ts
    │   ├── paperGenerator.ts / levelGenerator.ts / classAdapters.ts
    │   └── pdfMerge.ts / worksheetRenderer.ts
    │
    ├── src/                                   # frontend code (→ became frontend/src/)
    │   ├── main.tsx / App.tsx / constants.ts / types.ts / index.css
    │   ├── components/                        # 21 components (same files)
    │   ├── mock/                              # in-browser fake backend
    │   └── utils/levelGenerator.ts
    │
    ├── public/                                # static assets
    │   ├── mock/*.json                        # 16 mock datasets
    │   └── worksheets/{class1..4}.html        # worksheet templates + JS libs
    │
    ├── evaluation_metrics/                    # AI pipeline (→ became ai-services/)
    │   ├── run_pipeline.py / scripts/         # pipeline scripts
    │   ├── prompts/                           # LLM prompt templates
    │   ├── questions/{class_1..4}/{phrase_1..3}/
    │   ├── syllabus/{class_1..4}/
    │   └── personalized_evaluation/
    │
    ├── data/db.json                           # JSON-file database
    ├── docs/                                  # teacher workflow docs (→ became repo-level docs/)
    └── test_submit.cjs
```

#### Current Structure (After)

```
fln/                                          # npm-workspaces monorepo
│
├── package.json                              # workspace root (frontend, backend, ai-services)
├── README.md / SRS.md / PRD.md / AUDIT.md   # project-level docs
├── ARCHITECTURE.md / CLAUDE.md / CONTRIBUTING.md
├── MIGRATION_PLAN.md / CHANGE_LOG.md
│
├── ai-services/                              # Python — AI evaluation pipeline
│   ├── run_pipeline.py                       # main entry
│   ├── run_evaluation_c2p2.py / personalized_evaluation_pipeline.py
│   ├── scripts/                              # 0_classify → 1_compare → 2_evaluate → 3_report
│   ├── prompts/                              # LLM prompt templates (assign, classify, evaluate, report)
│   ├── questions/{class_1..4}/{phrase_1..3}/ # exam JSONs — 4 classes × 3 phrases
│   ├── syllabus/{class_1..4}/                # syllabus JSONs per class × phrase
│   └── personalized_evaluation/              # per-student generated exam + response template
│
├── backend/                                  # Node/Express + TypeScript — real API
│   ├── .env.example                          # GEMINI_API_KEY, PORT, paths
│   ├── data/db.json                          # JSON-file database
│   └── src/
│       ├── index.ts                          # routes + auth (single file, ~1580 lines)
│       ├── db.ts                             # DB abstraction
│       ├── gemini.ts                         # Gemini AI integration
│       ├── paperGenerator.ts / levelGenerator.ts / classAdapters.ts
│       ├── pdfMerge.ts / worksheetRenderer.ts
│
├── frontend/                                 # React 19 + Vite + Tailwind
│   ├── index.html / vite.config.ts / tsconfig.json
│   ├── public/
│   │   ├── mock/*.json                       # 16 static mock datasets (slated for deletion)
│   │   └── worksheets/{class1..4}.html       # worksheet HTML templates + JS libs (PDF, ZIP)
│   └── src/
│       ├── main.tsx                          # installs mock fetch interceptor
│       ├── App.tsx / constants.ts / types.ts / index.css
│       ├── components/                       # 21 components
│       │   ├── RoleDashboards.tsx             # god-file (~2700 lines)
│       │   ├── PanelViews.tsx                 # god-file (~1450 lines)
│       │   ├── LandingView / LoginView / Layout / Form / Card / Table
│       │   ├── AssessmentCalendar / BaselineUpload / DiagnosticWorkflow
│       │   ├── BulkDiagnosticWorkflow / IcrScanner / LogbookView / LogbookPanel
│       │   ├── WorksheetWorkflow / WorksheetIframeModal / SvgLibraryResolver
│       │   └── Charts / MetricCard / TicketSubmission
│       ├── mock/                             # in-browser fake backend (fetchInterceptor + dbStore)
│       └── utils/levelGenerator.ts           # duplicate of backend logic
│
├── FLN Levels Structure/                    # 59 curriculum levels (Level 1 → Level 59)
│   ├── Level {N}_{Topic}/                    # each level = 1 descriptor .md + N sub-level .md files
│   │   ├── Level {N}_{Topic}.md              # level overview
│   │   └── {N}.{0,1,2,3}.md                 # sub-level content (varies per level)
│   └── Level 48 & 59                        # review / mastery assessments (descriptor only)
│
├── docs/                                     # teacher workflow documentation
│   ├── teacher-workflow-overview.md / teacher-api-endpoints.md
│   ├── teacher-diagnostic-workflow.md / teacher-bulk-diagnostic.md
│   ├── teacher-worksheet-workflow.md / teacher-governance-rules.md
│   ├── teacher-icr-scanner.md
│   ├── FLN_Levels_Complete_Data.md / sample-baseline-class3.json
│
└── Research/                                 # reference material
    ├── FLN_foundation.md / FLN_Assessment_Framework.md
    ├── ALEKS_case_studies.md / Child_psychology.md
    ├── Assessment_paper_rubric.md / Assessment_paper_validation.md
    └── National_status_report.md
```

#### Key Changes

| What | Before | After |
|------|--------|-------|
| Root | `README.md` + `SRS.md` only | Full project docs at root level |
| Backend | `mvp/server/` | `backend/src/` — proper Node package |
| Frontend | `mvp/src/` + `mvp/public/` | `frontend/src/` + `frontend/public/` — proper Vite package |
| AI Pipeline | `mvp/evaluation_metrics/` | `ai-services/` — standalone Python package |
| Database | `mvp/data/db.json` | `backend/data/db.json` |
| Docs | `mvp/docs/` | `docs/` — repo-level, not nested |
| Config | Single `package.json` in `mvp/` | npm-workspaces: root + 3 workspace packages |
| Static Assets | `mvp/public/` | `frontend/public/` |
| FLN Levels | Top-level (unchanged) | Top-level (unchanged) |
| Research | Top-level (unchanged) | Top-level (unchanged) |

**Conventions:**
- `FLN Levels Structure/` — 59 folders, each with `{N}.0.md` baseline + `{N}.1.md`..`{N}.{n}.md` sub-levels
- `ai-services/questions/` — pattern: `{class_1..4}/phrase_{1..3}/class_{1..4}_exam_phrase_{1..3}.json` (12 exam files)
- `ai-services/syllabus/` — pattern: `{class_1..4}/class_{1..4}_syllabus_phrase{1..3}.json` (12 files)
- `frontend/public/mock/` — 16 JSON files (activity, analytics, attendance, blocks, diagnostic, districts, leaderboard, notifications, performance, questions, reports, schools, students, teachers, volunteers, worksheets)
- `frontend/src/components/` — 21 `.tsx` files; `RoleDashboards.tsx` and `PanelViews.tsx` are god-files
