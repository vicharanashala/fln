# New MongoDB Backend + Frontend Feature Reference

## Backend Architecture (`backend/src/`) — MongoDB

### Layered Structure (Route → Controller → Service → Repository → Model → MongoDB)

```
backend/src/
├── config/
│   ├── database.ts          # Mongoose connection with event listeners; no longer exits on failure
│   └── environment.ts       # dotenv loader (ESM-safe with fileURLToPath) + typed env config
│
├── interfaces/              # TypeScript interfaces for each entity (Mongoose document types)
│   ├── state.interface.ts
│   ├── district.interface.ts
│   ├── block.interface.ts
│   ├── school.interface.ts
│   └── teacher.interface.ts
│
├── models/                  # Mongoose schemas with validation, hooks, toJSON transforms
│   ├── state.model.ts       # name, code (unique), isActive — index: { isActive: 1 }
│   ├── district.model.ts    # name, code (unique), state (ref), isActive — index: { state: 1 }
│   ├── block.model.ts       # name, code (unique), state (ref), district (ref), isActive
│   ├── school.model.ts      # name, code (unique), state/district/block (refs), strength, isActive
│   └── teacher.model.ts     # teacherId (unique), name, email (unique), phone (unique),
│                            # password (bcrypt pre-save), school (ref), isActive, isBanned
│
├── repositories/            # DB query methods (thin wrappers around Mongoose)
│   ├── state.repository.ts
│   ├── district.repository.ts
│   ├── block.repository.ts
│   ├── school.repository.ts
│   └── teacher.repository.ts
│
├── services/                # Business logic layer
│   ├── state.service.ts
│   ├── district.service.ts
│   ├── block.service.ts
│   ├── school.service.ts
│   └── teacher.service.ts   # create (auto-generates T000001 ID), login (JWT + bcrypt), dashboard, CRUD
│
├── controllers/             # Express request handlers — parse HTTP, call service, send response
│   ├── state.controller.ts
│   ├── district.controller.ts
│   ├── block.controller.ts
│   ├── school.controller.ts
│   ├── teacher.controller.ts
│   └── auth.controller.ts   # thin wrapper — delegates to teacherService.login
│
├── routes/                  # Express route definitions with middleware chains
│   ├── auth.routes.ts       # POST /api/auth/login (public)
│   ├── state.routes.ts      # GET (public), POST/PATCH/DELETE (authenticated + role-guarded)
│   ├── district.routes.ts   # GET (public), POST/PATCH/DELETE (authenticated)
│   ├── block.routes.ts      # GET (public), POST/PATCH/DELETE (authenticated)
│   ├── school.routes.ts     # GET (public), POST/PATCH/DELETE (authenticated)
│   └── teacher.routes.ts    # POST /api/teachers (public), POST login (public), GET /me (auth), rest (auth)
│
├── validators/              # express-validator chains
│   ├── state.validator.ts
│   ├── district.validator.ts
│   ├── block.validator.ts
│   ├── school.validator.ts
│   └── teacher.validator.ts # password: 8+ chars, uppercase, number, special; email; phone; MongoIds
│
├── middlewares/
│   ├── auth.ts              # JWT verify from Bearer header → req.user { teacherId, email, schoolId }
│   ├── authorize.ts         # Role guard — checks req.user.role (not yet populated in JWT)
│   ├── validate.ts          # Runs express-validator, returns 400 on failure
│   └── errorHandler.ts      # AppError + Mongoose error mapping → JSON error response
│
├── utils/
│   ├── response.ts          # sendSuccess(res, message, data, statusCode) / sendError
│   ├── idGenerator.ts       # Generates T000001-format teacher ID
│   ├── seed.ts              # Seeds 28 Indian states
│   └── seedGeo.ts           # Seeds districts/blocks/schools for PB, BR, MH
│
├── app.ts                   # Express app — wires CORS, JSON, all routes, error handler, /api/health
├── server.ts                # Entry point — connect DB → start listening on env.PORT (default 5000)
│
├── index.ts                 # Legacy — old JSON-file-based server (port 3000, do not modify)
├── db.ts                    # Legacy — old JSON file DB layer
├── paperGenerator.ts        # Legacy — PDF generation
├── gemini.ts                # Legacy — Gemini AI integration
├── levelGenerator.ts        # Legacy
├── classAdapters.ts         # Legacy
├── pdfMerge.ts              # Legacy
└── worksheetRenderer.ts     # Legacy
```

### API Endpoints (New Backend — port 5000)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/health` | No | Health check |
| `POST` | `/api/auth/login` | No | Login — returns `{ token, teacher }` |
| `GET` | `/api/states` | No | All states |
| `GET` | `/api/states/:id` | No | State by ID |
| `GET` | `/api/states/code/:code` | No | State by code (e.g. PB) |
| `POST` | `/api/states` | Yes | Create state |
| `GET` | `/api/districts/by-state/:stateId` | No | Districts for a state |
| `GET` | `/api/districts/:id` | No | District by ID |
| `POST` | `/api/districts` | Yes | Create district |
| `GET` | `/api/blocks/by-district/:districtId` | No | Blocks for a district |
| `GET` | `/api/blocks/:id` | No | Block by ID |
| `POST` | `/api/blocks` | Yes | Create block |
| `GET` | `/api/schools/by-block/:blockId` | No | Schools for a block |
| `GET` | `/api/schools/:id` | No | School by ID |
| `POST` | `/api/schools` | Yes | Create school |
| `POST` | `/api/teachers` | No | Create teacher (auto-generates teacherId T000001) |
| `POST` | `/api/teachers/login` | No | Teacher login |
| `GET` | `/api/teachers/me` | Yes | Dashboard (from token) |
| `GET` | `/api/teachers` | Yes | List teachers |

### Auth Flow

```
POST /api/auth/login { email, password }
  → auth.controller → teacherService.login()
  → Lookup by email (with +select('password'))
  → bcrypt.compare(password)
  → Sign JWT { teacherId, email, schoolId } with JWT_SECRET
  → Return { token, teacher }

Protected routes:
  Header: Authorization: Bearer <token>
  → auth middleware → jwt.verify(token, JWT_SECRET) → req.user = decoded
```

---

## Frontend Feature (`frontend/src/`) — Coordinator Registration

### New Files

```
frontend/src/
├── services/
│   ├── api.ts                  # Axios instance with baseURL '/api' + JWT auth interceptor
│   └── coordinatorService.ts   # API functions + TS types for geo data & teacher creation
│
├── hooks/
│   └── useCoordinator.ts       # React Query hooks: useStates, useDistricts, useBlocks,
│                                # useSchools, useCreateTeacher
│
├── pages/
│   └── CoordinatorRegistration.tsx  # Full form page with React Hook Form + cascading dropdowns
│
└── (modified)
    ├── main.tsx                # Added QueryClientProvider + BrowserRouter
    ├── App.tsx                 # Added /register-coordinator route via React Router
    ├── vite.config.ts          # Proxy /api → http://localhost:5000 (new backend)
    └── components/RoleDashboards.tsx  # Added "Full Form →" link in SuperAdmin panel
```

### Coordinator Registration Form Structure

```
CoordinatorRegistration.tsx
│
├── React Hook Form (useForm + Controller)
│   ├── firstName (required, max 50)
│   ├── lastName (required, max 50)
│   ├── email (required, email pattern)
│   ├── phoneNumber (required, phone pattern)
│   ├── password (required, 8+ chars, uppercase, number, special)
│   ├── role (Controller: Teacher / Admin / Super Admin)
│   │
│   └── [if role === 'teacher']
│       ├── stateId → useStates() → GET /api/states (on mount)
│       ├── districtId → useDistricts(stateId) → GET /api/districts/by-state/:id
│       ├── blockId → useBlocks(districtId) → GET /api/blocks/by-district/:id
│       └── schoolId → useSchools(blockId) → GET /api/schools/by-block/:id
│
├── Submission
│   └── useCreateTeacher() → POST /api/teachers { firstName, lastName, email,
│                                                   phoneNumber, password, school: schoolId }
│
└── States
    ├── Loading: Spinner in dropdown
    ├── Error: Error message
    └── Success: Green toast + form reset
```

### Cascading Dropdown Rules

| Field | Enabled When | On Change |
|-------|-------------|-----------|
| State | Always (loads on mount) | Clears district, block, school |
| District | State selected | Clears block, school |
| Block | District selected | Clears school |
| School | Block selected | — |

---

## Dev Commands

```bash
npm run dev              # Runs both servers (old :3000 + new :5000) via concurrently
npm run dev:frontend     # Frontend only (Vite :5173)
npm run dev:new          # New MongoDB backend only (:5000)
npm run dev:old          # Old JSON backend only (:3000)

npm run seed             # Seed 28 states
npm run seed:geo         # Seed districts/blocks/schools for PB, BR, MH

npm run lint             # TypeScript check across all workspaces
npm run build            # Build frontend + backend
```
