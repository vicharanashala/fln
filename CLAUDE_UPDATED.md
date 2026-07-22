# CLAUDE.md (Updated)

Guidance for Claude Code when working in this repository.

## What this is

FLN Assessment & Personalized Worksheet Platform — an AI-driven system that assesses each child's foundational **Mathematics** numeracy level (Classes 2–4), generates level-personalized printable worksheets, ingests scanned answers, evaluates them, and rolls data up a 7-role national hierarchy. See [SRS.md](SRS.md) (authoritative spec), [PRD.md](PRD.md) (product framing), [AUDIT.md](AUDIT.md) (code health), and [MIGRATION_PLAN.md](MIGRATION_PLAN.md) (target structure).

**Stack:** MERN Monorepo — React 19 + Vite + Tailwind CSS + TanStack React Query + Axios (frontend), Node/Express + TypeScript + MongoDB/Mongoose (backend API), Puppeteer worksheet renderer microservice (`backend/fln-backend`), Python (AI evaluation pipeline), Google Gemini / Groq (LLM). The repo is an **npm-workspaces monorepo**: `frontend/`, `backend/`, `ai-services/`.

## Architecture Overview

- **Backend API (`backend/`)**: Modular Express + TypeScript server running on port `3001` (or `PORT` env), connected to MongoDB (`MONGODB_URI`). Implements JWT authentication (`/api/auth`), role guard middleware, domain routes (`states`, `districts`, `blocks`, `schools`, `teachers`, `classes`, `students`), and database seeding (`npm run seed`).
- **Worksheet Generator Microservice (`backend/fln-backend`)**: Express + Puppeteer service running on port `4000` dedicated to batch worksheet rendering, answer key generation, and ZIP packaging.
- **Frontend (`frontend/`)**: React 19 + Vite SPA running on port `5173`. Connects to the backend via Axios (`frontend/src/services/api.ts`) and TanStack React Query. In dev mode, Vite proxies `/api`, `/output`, and `/worksheets` requests to the backend on `http://localhost:3001` (configurable via `VITE_API_TARGET`).
- **AI Services (`ai-services/`)**: Python evaluation pipeline for scanned OMR worksheets using Gemini / Groq models.

## Layout

```
fln/                          # npm-workspaces monorepo root
├── frontend/                 # @fln/frontend — React + Vite app
│   ├── index.html  vite.config.ts  tsconfig.json  package.json
│   ├── public/worksheets/    # worksheet HTML templates — read by backend / Puppeteer
│   └── src/
│       ├── main.tsx          # QueryClientProvider + BrowserRouter entrypoint
│       ├── App.tsx           # Router configuration & main application routing
│       ├── pages/            # Page-level route components
│       ├── components/       # UI components & role dashboards
│       ├── services/         # api.ts (Axios instance with JWT Bearer token header)
│       ├── hooks/            # Custom React hooks & data queries
│       ├── types.ts          # Frontend TypeScript interfaces
│       └── constants.ts      # UI labels and configuration
├── backend/                  # @fln/backend — Node/Express + MongoDB API
│   ├── package.json  tsconfig.json  .env.example
│   ├── fln-backend/          # Worksheet microservice (Express + Puppeteer, port 4000)
│   ├── src/
│   │   ├── server.ts         # Server bootstrap (connects MongoDB and starts Express server)
│   │   ├── app.ts            # Express application setup & middleware/route registration
│   │   ├── config/           # Database connection (Mongoose) & environment variables
│   │   ├── controllers/      # Request controllers (auth, students, classes, schools, geo)
│   │   ├── models/           # Mongoose models (User, Student, Teacher, School, State, etc.)
│   │   ├── routes/           # Express router modules
│   │   ├── services/         # Domain business logic & data repositories
│   │   ├── middlewares/      # JWT auth guard, input validation & error handler
│   │   ├── seed.ts           # MongoDB database seed script
│   │   ├── levelGenerator.ts # Worksheet level math question generator
│   │   └── paperGenerator.ts # HTML / PDF worksheet generation logic
├── ai-services/              # REAL Python evaluation pipeline (run_pipeline.py, prompts/, syllabus/)
├── scripts/                  # Development helper scripts (dev-backend.js)
└── docs/                     # Documentation & workflow specs
```

## Commands

Run from the repo root (npm workspaces). One install covers all packages:

```bash
npm install                       # Install dependencies across all workspaces
npm run dev:frontend              # Vite dev server on :5173 (proxies /api to main backend on :3001)
npm run dev:backend               # Launches dev-backend.js script — starts main API (:3001) and levels backend (:4000)
npm run dev                       # Runs backend workspace dev script
npm run build                     # Builds frontend (vite) and backend (esbuild)
npm run lint                      # tsc --noEmit across workspaces (type-check only)
npm run seed --workspace=@fln/backend  # Seeds MongoDB database with initial sample data
```

## Environment Variables

Copy `.env.example` to `.env` in the repository root:

- `MONGODB_URI` / `MONGO_URI` — Connection URI for MongoDB (default: `mongodb://localhost:27017/fln`).
- `JWT_SECRET` — Secret key for signing auth tokens.
- `JWT_EXPIRES_IN` — Expiration duration for JWT tokens (default: `7d`).
- `PORT` — Port for the main backend API server (default: `3001`).
- `VITE_API_TARGET` — Backend API target URL for Vite dev proxy (default: `http://localhost:3001`).
- `LEVELS_BACKEND_URL` — Service URL for the worksheet generation microservice (default: `http://localhost:4000`).
- `GEMINI_API_KEY` & `GROQ_API_KEY` — API keys for AI worksheet evaluation pipeline.

## Conventions & Gotchas

- **Authentication**: Real JWT authentication is active (`/api/auth/login`, `/api/auth/register`). Tokens are stored in `localStorage` under key `fln_token` and sent via `Authorization: Bearer <token>` through `frontend/src/services/api.ts`.
- **Database**: MongoDB with Mongoose ODM handles persistence. Run `npm run seed --workspace=@fln/backend` to seed sample state, district, block, school, teacher, class, and student records into MongoDB.
- **Microservices**: Main API handles REST endpoints on port `3001`, while `backend/fln-backend` on port `4000` handles heavy Puppeteer HTML-to-PDF rendering and ZIP generation.
- **Frontend State & Data Fetching**: TanStack React Query (`@tanstack/react-query`) manages server state on the frontend; client mock interceptors have been completely removed.
- **Type Safety**: `npm run lint` runs `tsc --noEmit` across all workspaces to verify TypeScript compilation.
- **Vite Config & HMR**: Avoid changing `frontend/vite.config.ts` HMR/watch settings directly if working in automated agent environments.
