# Teacher API Endpoints

All server endpoints accessible to a Teacher role.

---

## Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Login with email + password (complexity: >=8 chars, uppercase, digit, special char) |
| GET | `/api/auth/me` | Get authenticated user profile |

## Students

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/students` | List students in teacher's school (Aadhar masked to last-4 digits) |
| POST | `/api/students` | Register new student |
| PATCH | `/api/students/:id` | Update student level (manual override) |

## Diagnostics

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/students/:id/diagnostic` | Generate AI diagnostic paper for a student |
| POST | `/api/students/:id/diagnostic/submit` | Submit and evaluate diagnostic answers |
| POST | `/api/diagnostic/bulk` | Start bulk diagnostic generation (async job) |
| GET | `/api/diagnostic/bulk/:jobId/progress` | Poll bulk job progress |
| GET | `/api/diagnostic/bulk/:jobId/download` | Download merged bulk diagnostic PDF |
| POST | `/api/diagnostic/single` | Generate single enhanced diagnostic PDF |

## Worksheets

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/worksheets/generate` | Generate personalized class worksheets (Baseline/Mid-year/End-of-year) |
| POST | `/api/worksheets/generate-pdf` | Generate printable PDF for an existing worksheet |
| POST | `/api/worksheets/generate-level-pdf` | Generate level-wise PDF for a single student |
| POST | `/api/paper/generate` | Generate multi-student PDF worksheet paper |

## Evaluation

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/evaluation/submit` | Submit completed worksheet answers for evaluation |
| GET | `/api/evaluation/:studentId/history` | Get evaluation history for a student |

## Data

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/classes` | List classes scoped to teacher's school |
| GET | `/api/schools` | List schools |
| GET | `/api/announcements` | View system announcements |
| GET | `/api/analytics` | View analytics (scoped to teacher's region) |

## Support

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/tickets` | View own support tickets |
| POST | `/api/tickets/create` | Create feedback/support ticket (curriculum type allowed for teachers only) |
| GET | `/api/logbook` | View activity log |
