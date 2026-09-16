# 1. What is FLN?

FLN stands for Foundational Literacy and Numeracy. In this project, it refers to the baseline skills a child needs to make meaningful progress in school: reading with understanding, identifying letters and words, working with numbers, and solving basic arithmetic. The repository is built around the idea that these early competencies are not a side issue; they are the foundation that determines whether a student can later succeed in the broader curriculum.

The project is trying to help schools and education administrators move from a reactive, paper-heavy model to a more systematic model: assess each child, identify the current level of understanding, generate targeted learning support, track progress over time, and support administrators with a role-based operating view. In practical terms, this project is an education-technology system for classroom assessment, remediation, and monitoring in the FLN domain.

# 2. What do you understand by FLN as a system?

I understand FLN as an end-to-end education system rather than a single feature. In this repository, the system connects multiple roles, data objects, workflow stages, and dashboards into one operating model.

The role model is explicit in the frontend types and dashboard composition:

- `frontend/src/types.ts` defines the main user and organizational model using `UserRole`, including `SUPERADMIN`, `ADMIN`, `DISTRICT_ADMIN`, `BLOCK_ADMIN`, `SCHOOL`, `TEACHER`, and `VOLUNTEER`.
- Student and school records are modeled with `School`, `ClassGroup`, and `Student` objects.
- The operational hierarchy is reflected across the dashboard set under `frontend/src/components/dashboards/`.

The workflow is not just a single test screen. It is a loop across several domains:

1. Student and school records are created and scoped by role.
2. Teachers and volunteers run classroom workflows around student rosters and class groups.
3. Assessment or diagnostic actions are executed through the dashboard components, such as `TeacherDashboard`, `VolunteerDashboard`, and `SchoolDashboard`.
4. The platform can generate or print worksheets and evaluation artifacts, which is consistent with the routes under `backend/src/routes/worksheets.ts` and the question/worksheet generation flow described in the project docs.
5. Results are evaluated and rolled into student-level learning progress, which is reflected in student level history and the progress indicators used throughout the frontend.
6. The system surfaces operational information to the right actors through role-scoped dashboards, analytics panels, and access controls.

The code also shows that FLN is organized around a learning progression model rather than only raw testing. `frontend/src/types.ts` includes `currentLevel`, `targetLevel`, `levelHistory`, and related student competency fields, while the project documentation describes a 93-level curriculum structure. That indicates a system where a student is evaluated, placed, remediated, and then tracked as they move through a progression model rather than being treated as a one-time exam result.

This is also visible in the dashboard architecture. The split dashboards under `frontend/src/components/dashboards/` are organized by role and responsibility:

- `SuperadminDashboard.tsx` manages national oversight and coordinators.
- `AdminDashboard.tsx` is scoped to state/district/block oversight and regional analytics.
- `SchoolDashboard.tsx` handles school-level operations.
- `TeacherDashboard.tsx` handles classroom rosters and assessments.
- `VolunteerDashboard.tsx` is a field-support classroom variation.

The repository therefore models FLN as a governance + operations + learning-analytics system: the same underlying student learning data is used across classroom, school, district, and national oversight layers.

# 3. Current State of the Repository — What Has Been Done So Far

The repository is a monorepo built around a frontend, a backend, and a Python-based AI/vision evaluation layer.

The repo structure matches the current code:

- `frontend/` contains the React 19 + TypeScript + Vite application.
- `backend/` contains the Express API and route modules.
- `ai-services/` contains the Python evaluation and OCR-related services.
- `data/` contains local persistence artifacts and seed data.

The current backend is modular and route-oriented. The relevant files in `backend/src/routes/` include:

- `auth.ts` for login and authentication flow
- `students.ts` for student management, class scoping, and bulk imports
- `worksheets.ts` for worksheet generation and print-related functionality
- `evaluation.ts` for scoring and evaluation outputs
- `curriculum.ts` for curriculum-facing functionality
- `admin.ts`, `stats.ts`, `analytics.ts`, `schools.ts`, `teachers.ts`, `classes.ts`, `interventions.ts`, `logbook.ts`, and `tickets.ts` for role-scoped operational functionality

The frontend is organized into role dashboards and reusable panels. The implemented components already include:

- `frontend/src/components/dashboards/SuperadminDashboard.tsx`
- `frontend/src/components/dashboards/AdminDashboard.tsx`
- `frontend/src/components/dashboards/SchoolDashboard.tsx`
- `frontend/src/components/dashboards/TeacherDashboard.tsx`
- `frontend/src/components/dashboards/VolunteerDashboard.tsx`
- `frontend/src/components/LogbookView.tsx`
- `frontend/src/components/TicketSubmission.tsx`

In terms of functionality, the repository already contains a substantial operational layer:

- Role-based user access and organization modeling in `frontend/src/types.ts`.
- School, class, and student management in the frontend and backend routes.
- Dashboard-based workflows for teachers, schools, admins, and superadmins.
- Student progress tracking through `currentLevel`, `targetLevel`, `levelHistory`, and related indicators.
- Diagnostic and assessment flows, including classroom workflows and student evaluation interactions.
- Curriculum/learning-level concepts and a progression-based model, reflected in project docs and the TypeScript types.
- Regional and comparative analytics views, including `RegionalAnalyticsView` under `frontend/src/components/dashboards/`.
- Audit log and ticketing modules implemented as reusable components and API routes.
- Authentication and authorization patterns, with backend role checks and a JWT-style authentication flow described in the project documentation and route definitions.

This means the repository is already far beyond a blank scaffold: it contains the core educational workflow, the operational dashboard layer, and the supporting role-based data paths needed to run a real FLN system in a classroom and administrative context.

# 4. Gaps Observed in the Code

## Gap 1

### Where
`frontend/src/components/dashboards/TeacherDashboard.tsx` and `frontend/src/components/dashboards/VolunteerDashboard.tsx`

### What
Both dashboards implement similar classroom roster and diagnostic flows. They fetch `/api/classes` and `/api/students`, define parallel state for `activeClass`, `diagnosticStudent`, and `baselineStudent`, and render similar per-row actions such as “Run Diagnostic,” “Upload Sheet,” and “Print L…”.

### Why it matters
This duplication increases the maintenance surface for teacher and volunteer workflows. If one dashboard changes, the other must be updated separately to stay aligned.

## Gap 2

### Where
`frontend/src/components/dashboards/AdminDashboard.tsx`, `frontend/src/components/dashboards/SuperadminDashboard.tsx`, `frontend/src/components/dashboards/SchoolDashboard.tsx`, and `frontend/src/components/dashboards/TeacherDashboard.tsx`

### What
Each dashboard independently loads overlapping data, including `/api/schools`, `/api/students`, `/api/classes`, and `/api/admin/coordinators`, and stores the results in local component state.

### Why it matters
This repeats the same data-fetch and state-normalization logic across multiple role views, which increases duplicate network activity and can make refresh behavior harder to keep consistent across the platform.

## Gap 3

### Where
`backend/src/routes/logbook.ts` and `backend/src/routes/tickets.ts`

### What
Both route handlers call `dbStore.getLogbook()` and `dbStore.getTickets()` and return the full array after role-based filtering. The route definitions currently do not include request query parameters for pagination, result limits, or explicit server-side caps.

### Why it matters
As the number of audit entries and tickets grows, these endpoints will return larger arrays and require the client to process more data than necessary.

## Gap 4

### Where
`frontend/src/components/dashboards/SchoolDashboard.tsx` and `frontend/src/components/dashboards/TeacherDashboard.tsx`

### What
The dashboard headers include static school context such as “GPS Model Town Ludhiana” in the school dashboard and “gps-mt-001 Model Town” in the teacher dashboard, even though each dashboard receives a real `user` object and the repository models school identity through `user.schoolId` and the school records.

### Why it matters
Hardcoded school labels can drift from the actual assigned school scope and make the UI inconsistent in multi-school or production deployment settings.

# 5. Ideas for the Project

## Idea 1: Extract shared dashboard data hooks

### What
Create a shared data layer or hook for the role dashboards so they fetch and normalize schools, classes, students, and coordinator data in a consistent way instead of repeating the same fetch logic in each component.

### Why
This addresses the overlapping fetch and local-state pattern in the admin, school, and teacher dashboards.

### How
Use the existing `frontend/src/types.ts` model and current dashboard structure as the source of truth. Introduce a small shared fetch helper or hook that takes a role and returns the scoped data, then reuse it from `TeacherDashboard.tsx`, `SchoolDashboard.tsx`, `AdminDashboard.tsx`, and `SuperadminDashboard.tsx`.

## Idea 2: Add pagination and server-driven filtering for logs and tickets

### What
Add pagination, request-scoped limits, and server-side filtering to the `/api/logbook` and `/api/tickets` routes, and update the frontend to consume the limited result set.

### Why
This addresses the current full-array response pattern in `backend/src/routes/logbook.ts` and `backend/src/routes/tickets.ts`.

### How
Keep the current route registration pattern, but add request query parameters such as `page`, `limit`, and optional filters, and adapt the existing `LogbookView` and `TicketSubmission` UI to consume paged results.

## Idea 3: Replace hardcoded school labels with real data-driven display values

### What
Use the authenticated user and actual school records to render dashboard scope labels instead of static text in the main views.

### Why
This addresses the hardcoded school-name issue visible in `SchoolDashboard.tsx` and `TeacherDashboard.tsx`.

### How
Read `user.schoolId`, `user.stateCode`, and the resolved school metadata already present in the repo instead of embedding static labels in the dashboard JSX.

## Idea 4: Split repeated dashboard logic into reusable subcomponents

### What
Factor the repeated teacher/volunteer roster, diagnostic, and worksheet logic into shared components or helper functions while preserving the current role-specific behavior.

### Why
This addresses the duplicate classroom workflow logic visible in `TeacherDashboard.tsx` and `VolunteerDashboard.tsx`.

### How
Extract the repeated roster or action logic into a reusable component or helper while leaving the role-specific differences intact. This fits the current component structure under `frontend/src/components/` and `frontend/src/components/dashboards/`.

# 6. Your Contribution

My contribution in PR #72 is the integration of the existing Audit Logbook and in-app ticketing features into the current split-dashboard architecture, rather than a reintroduction of the older monolithic dashboard structure.

The current codebase already organizes the dashboards by role under `frontend/src/components/dashboards/`. In this repo revision, the relevant files are:

- `frontend/src/components/dashboards/SuperadminDashboard.tsx`
- `frontend/src/components/dashboards/AdminDashboard.tsx`
- `frontend/src/components/dashboards/SchoolDashboard.tsx`
- `frontend/src/components/dashboards/TeacherDashboard.tsx`

The implementation reuses the existing dashboard components and route layer already present in the repository:

- `LogbookView` is mounted in the `logbook` tab in `SuperadminDashboard.tsx` and `AdminDashboard.tsx`.
- `TicketSubmission` is mounted in `SchoolDashboard.tsx` and `TeacherDashboard.tsx`.
- The backend routes already exist at `/api/logbook` and `/api/tickets`.

This means the PR is scoped to surfacing functionality that already exists in the app through the current refactored dashboard composition, without changing the underlying backend contracts or the current role architecture.
