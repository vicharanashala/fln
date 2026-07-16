# Backend Modules — Structure, Purpose & API Reference

---

## Architecture

Layered architecture following `Route → Controller → Service → Repository → Model → MongoDB`.

```
backend/src/
│
├── config/              # Database connection, environment config
├── middlewares/         # Auth (JWT), authorization (role), validation, error handler
├── utils/               # Response helpers, ID generator, seed scripts
├── routes/              # Top-level route wiring for geo modules
├── controllers/         # HTTP handlers for geo modules
├── services/            # Business logic for geo modules
├── repositories/        # MongoDB query layer for geo modules
├── models/              # Mongoose schemas for geo modules
├── interfaces/          # TypeScript interfaces for geo modules
├── validators/          # express-validator rules for geo modules
├── modules/             # Feature-based modules (teacher, auth)
├── app.ts               # Express app setup
└── server.ts            # Entry point
```

---

## Module: State

**Purpose:** Represents Indian states/UTs (e.g., Punjab, Rajasthan). Top of the geographical hierarchy.

### Files

| File | Purpose |
|---|---|
| `interfaces/state.interface.ts` | `IState`, `IStateDocument` interfaces |
| `models/state.model.ts` | Mongoose schema: `name`, `code`, `isActive` + timestamps |
| `repositories/state.repository.ts` | CRUD, `findByCode`, `existsByCode`, `softDelete` |
| `services/state.service.ts` | Business logic — validates code uniqueness |
| `controllers/state.controller.ts` | Request/response handling |
| `routes/state.routes.ts` | Route definitions |
| `validators/state.validator.ts` | Validation rules |

### Schema

```
name:      String (required, unique)
code:      String (required, unique, uppercase, 2-5 chars)
isActive:  Boolean (default: true)
```

### Endpoints

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| `GET` | `/api/states` | JWT | Any | List all active states |
| `GET` | `/api/states?includeInactive=true` | JWT | Any | List all states (incl. inactive) |
| `POST` | `/api/states` | JWT | superadmin | Create a state |
| `GET` | `/api/states/:id` | JWT | Any | Get state by MongoDB ID |
| `GET` | `/api/states/code/:code` | JWT | Any | Get state by code (e.g., "PB") |
| `PATCH` | `/api/states/:id` | JWT | superadmin, admin | Update state |
| `DELETE` | `/api/states/:id` | JWT | superadmin | Delete state |
| `PATCH` | `/api/states/:id/deactivate` | JWT | superadmin | Soft delete (isActive=false) |
| `PATCH` | `/api/states/:id/restore` | JWT | superadmin | Restore (isActive=true) |

---

## Module: District

**Purpose:** Represents districts within a state (e.g., Ludhiana in Punjab). Second level of the hierarchy.

### Files

| File | Purpose |
|---|---|
| `interfaces/district.interface.ts` | `IDistrict`, `IDistrictDocument` interfaces |
| `models/district.model.ts` | Mongoose schema: `name`, `code`, `state` (ref), `isActive` |
| `repositories/district.repository.ts` | CRUD, `findByState`, `findByCode`, `existsByCode` |
| `services/district.service.ts` | Business logic — validates state ref + code uniqueness |
| `controllers/district.controller.ts` | Request/response handling |
| `routes/district.routes.ts` | Route definitions |
| `validators/district.validator.ts` | Validation rules |

### Schema

```
name:      String (required)
code:      String (required, unique, uppercase, 2-10 chars)
state:     ObjectId (ref: State, required)
isActive:  Boolean (default: true)
```

### Endpoints

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| `GET` | `/api/districts` | JWT | Any | List all active districts |
| `POST` | `/api/districts` | JWT | superadmin, admin | Create a district |
| `GET` | `/api/districts/:id` | JWT | Any | Get district by MongoDB ID |
| `GET` | `/api/districts/code/:code` | JWT | Any | Get district by code (e.g., "LDH") |
| `GET` | `/api/districts/by-state/:stateId` | JWT | Any | Get districts in a state |
| `PATCH` | `/api/districts/:id` | JWT | superadmin, admin | Update district |
| `DELETE` | `/api/districts/:id` | JWT | superadmin | Delete district |
| `PATCH` | `/api/districts/:id/deactivate` | JWT | superadmin, admin | Soft delete |
| `PATCH` | `/api/districts/:id/restore` | JWT | superadmin, admin | Restore |

---

## Module: Block

**Purpose:** Represents blocks/clusters within a district (e.g., LDH-01 in Ludhiana). Third level of the hierarchy.

### Files

| File | Purpose |
|---|---|
| `interfaces/block.interface.ts` | `IBlock`, `IBlockDocument` interfaces |
| `models/block.model.ts` | Mongoose schema: `name`, `code`, `state` (ref), `district` (ref), `isActive` |
| `repositories/block.repository.ts` | CRUD, `findByDistrict`, `findByState`, `findByCode` |
| `services/block.service.ts` | Business logic — validates state + district refs, code uniqueness |
| `controllers/block.controller.ts` | Request/response handling |
| `routes/block.routes.ts` | Route definitions |
| `validators/block.validator.ts` | Validation rules |

### Schema

```
name:      String (required)
code:      String (required, unique, uppercase, 2-20 chars)
state:     ObjectId (ref: State, required)
district:  ObjectId (ref: District, required)
isActive:  Boolean (default: true)
```

### Endpoints

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| `GET` | `/api/blocks` | JWT | Any | List all active blocks |
| `POST` | `/api/blocks` | JWT | superadmin, admin | Create a block |
| `GET` | `/api/blocks/:id` | JWT | Any | Get block by MongoDB ID |
| `GET` | `/api/blocks/code/:code` | JWT | Any | Get block by code (e.g., "LDH-01") |
| `GET` | `/api/blocks/by-state/:stateId` | JWT | Any | Get blocks in a state |
| `GET` | `/api/blocks/by-district/:districtId` | JWT | Any | Get blocks in a district |
| `PATCH` | `/api/blocks/:id` | JWT | superadmin, admin | Update block |
| `DELETE` | `/api/blocks/:id` | JWT | superadmin | Delete block |
| `PATCH` | `/api/blocks/:id/deactivate` | JWT | superadmin, admin | Soft delete |
| `PATCH` | `/api/blocks/:id/restore` | JWT | superadmin, admin | Restore |

---

## Module: School

**Purpose:** Represents individual schools. Fourth level of the hierarchy. Links to state, district, and block for geographical scoping.

### Files

| File | Purpose |
|---|---|
| `interfaces/school.interface.ts` | `ISchool`, `ISchoolDocument`, `SchoolStrength` |
| `models/school.model.ts` | Mongoose schema: `name`, `code`, `state/district/block` (refs), `strength`, `isAccessLocked`, `isActive` |
| `repositories/school.repository.ts` | CRUD, `findByBlock/District/State`, `lockAccess`, `unlockAccess` |
| `services/school.service.ts` | Business logic — validates all 3 parent refs, code uniqueness |
| `controllers/school.controller.ts` | Request/response handling |
| `routes/school.routes.ts` | Route definitions |
| `validators/school.validator.ts` | Validation rules |

### Schema

```
name:            String (required)
code:            String (required, unique, lowercase)
state:           ObjectId (ref: State, required)
district:        ObjectId (ref: District, required)
block:           ObjectId (ref: Block, required)
strength:        Enum: "high" | "low" (required)
isAccessLocked:  Boolean (default: false) — SRS §6.5 defaulter escalation
isActive:        Boolean (default: true)
```

### Endpoints

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| `GET` | `/api/schools` | JWT | Any | List all active schools |
| `POST` | `/api/schools` | JWT | superadmin, admin | Create a school |
| `GET` | `/api/schools/:id` | JWT | Any | Get school by MongoDB ID |
| `GET` | `/api/schools/code/:code` | JWT | Any | Get school by code |
| `GET` | `/api/schools/by-state/:stateId` | JWT | Any | Get schools in a state |
| `GET` | `/api/schools/by-district/:districtId` | JWT | Any | Get schools in a district |
| `GET` | `/api/schools/by-block/:blockId` | JWT | Any | Get schools in a block |
| `PATCH` | `/api/schools/:id` | JWT | superadmin, admin | Update school |
| `DELETE` | `/api/schools/:id` | JWT | superadmin | Delete school |
| `PATCH` | `/api/schools/:id/deactivate` | JWT | superadmin, admin | Soft delete |
| `PATCH` | `/api/schools/:id/restore` | JWT | superadmin, admin | Restore (also unlocks access) |
| `PATCH` | `/api/schools/:id/lock` | JWT | superadmin, admin | Lock school access (§6.5) |
| `PATCH` | `/api/schools/:id/unlock` | JWT | superadmin, admin | Unlock school access |

---

## Module: Teacher

**Purpose:** Represents teachers. Sixth level of the hierarchy. Teachers create worksheets, conduct assessments, and submit scanned answer sheets. Uses auto-generated `T000001`-format IDs.

### Files

| File | Purpose |
|---|---|
| `modules/teacher/teacher.interface.ts` | `ITeacher`, `ITeacherDocument`, `ITeacherDashboard` |
| `modules/teacher/teacher.model.ts` | Mongoose schema with bcrypt password hashing |
| `modules/teacher/teacher.repository.ts` | CRUD, `findByEmail`, `findByTeacherId`, `ban`, `revive` |
| `modules/teacher/teacher.service.ts` | Business logic — create, login, dashboard, CRUD, ban/revive |
| `modules/teacher/teacher.controller.ts` | HTTP request/response handling |
| `modules/teacher/teacher.routes.ts` | Route definitions |
| `modules/teacher/teacher.validator.ts` | Validation rules |

### Schema

```
teacherId:            String (unique, auto-generated: T000001)
firstName:            String (required)
lastName:             String (required)
email:                String (required, unique, lowercase)
phoneNumber:          String (required, unique)
password:             String (required, bcrypt hashed, select: false)
school:               ObjectId (ref: School, required)
employeeCode:         String
qualification:        String
experienceYears:      Number (default: 0)
isActive:             Boolean (default: true)
isBanned:             Boolean (default: false)  — §6.5 defaulter
delayedAttemptsCount: Number (default: 0)
```

### Endpoints

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| `POST` | `/api/teachers/login` | No | — | Teacher login (deprecated, use `/api/auth/login`) |
| `GET` | `/api/teachers/me` | JWT | Teacher | Dashboard — returns teacher + populated school name/code |
| `GET` | `/api/teachers` | JWT | Any | List all active teachers |
| `POST` | `/api/teachers` | JWT | Any | Create teacher (auto-generates T000001) |
| `GET` | `/api/teachers/:id` | JWT | Any | Get teacher by MongoDB ObjectId |
| `GET` | `/api/teachers/by-teacher-id/:teacherId` | JWT | Any | Get teacher by T-prefixed ID |
| `GET` | `/api/teachers/by-school/:schoolId` | JWT | Any | Get teachers in a school |
| `PUT` | `/api/teachers/:id` | JWT | Any | Update teacher |
| `DELETE` | `/api/teachers/:id` | JWT | Any | Hard delete |
| `PATCH` | `/api/teachers/:id/status` | JWT | Any | Toggle active/inactive |
| `PATCH` | `/api/teachers/:id/deactivate` | JWT | Any | Soft delete |

---

## Module: Auth

**Purpose:** Provides authentication endpoint for teachers. Returns JWT token and teacher info.

### Files

| File | Purpose |
|---|---|
| `modules/auth/auth.controller.ts` | Login handler (wraps TeacherService.login) |
| `modules/auth/auth.routes.ts` | Route definition for `/api/auth/login` |

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/login` | No | Login with email + password → returns `{ token, teacher }` |

### Login Request

```json
{
  "email": "teacher@example.com",
  "password": "Pass@123"
}
```

### Login Response

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "teacher": {
      "teacherId": "T000001",
      "firstName": "Sejal",
      "lastName": "Kumari",
      "email": "teacher@example.com",
      "phoneNumber": "9876543210",
      "school": "64a1b2c3d4e5f6a7b8c9d0e1",
      "employeeCode": "",
      "qualification": "B.Ed",
      "experienceYears": 5,
      "isActive": true,
      "isBanned": false,
      "delayedAttemptsCount": 0
    }
  }
}
```

### Dashboard Response (`GET /api/teachers/me`)

```json
{
  "success": true,
  "message": "Dashboard data fetched successfully",
  "data": {
    "teacherId": "T000001",
    "firstName": "Sejal",
    "lastName": "Kumari",
    "email": "teacher@example.com",
    "school": {
      "name": "Government Primary School",
      "code": "gps-mt-001"
    }
  }
}
```

---

## Shared Middleware

| Middleware | File | Purpose |
|---|---|---|
| `authenticate` | `middlewares/auth.ts` | Verifies JWT Bearer token, populates `req.user` |
| `authorize(...roles)` | `middlewares/authorize.ts` | Restricts access to specific roles |
| `validate` | `middlewares/validate.ts` | Runs express-validator and returns errors |
| `errorHandler` | `middlewares/errorHandler.ts` | Catches all errors, returns consistent JSON |

### Auth Payload (JWT decode → `req.user`)

```typescript
{
  userId?: string;      // For admin users
  email: string;        // Common
  role?: string;        // For admin users (superadmin, admin, etc.)
  teacherId?: string;   // For teacher users (T000001)
  schoolId?: string;    // For teacher users
}
```

---

## Utilities

| File | Purpose |
|---|---|
| `utils/response.ts` | `sendSuccess(res, message, data, statusCode)` and `sendError(res, message, statusCode)` |
| `utils/idGenerator.ts` | `generateTeacherId(repository)` — generates next `T000001`-format ID |
| `utils/seed.ts` | Seeds 28 Indian states into MongoDB |

---

## Standard API Response Format

### Success

```json
{
  "success": true,
  "message": "States fetched successfully",
  "data": []
}
```

### Error

```json
{
  "success": false,
  "message": "State not found",
  "data": null
}
```

### Validation Error

```json
{
  "success": false,
  "message": "State name is required, State code is required",
  "data": null,
  "errors": [
    { "msg": "State name is required", "param": "name", "location": "body" },
    { "msg": "State code is required", "param": "code", "location": "body" }
  ]
}
```

---

## Geographical Hierarchy

```
State (e.g., PB — Punjab)
  └── District (e.g., LDH — Ludhiana)
        └── Block (e.g., LDH-01)
              └── School (e.g., gps-mt-001)
                    └── Teacher (e.g., T000001)
                          └── Class → Students
```

Each level references its parent via `ObjectId`. School is the first entity with a `strength` field (`high`/`low`) that governs Teacher vs Volunteer assignment per SRS §1.2.
