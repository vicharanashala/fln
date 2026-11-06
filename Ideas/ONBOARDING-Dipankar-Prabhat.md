# FLN Onboarding — Dipankar Prabhat

## 1. What is FLN?

FLN stands for **Foundational Literacy and Numeracy**. It means the basic reading, understanding, counting, and arithmetic skills that children develop from preschool through Class 3. These skills help children learn other subjects as they move to higher classes.

The FLN platform helps teachers identify what each student understands and where they need more support. It combines grade-level benchmarks with personalized assessments and practice based on the student’s learning level. Teachers can generate question papers, upload completed answer sheets, and track student progress.

Although FLN includes both language and mathematics, **the platform currently focuses on numeracy**. Literacy assessment is part of its broader goal.

## 2. What do you understand by FLN (as a system)?

I understand FLN as a platform that connects student assessments, teacher activities, and school administration. It has different roles, including Superadmin, State Admin, District Admin, Block Admin, School, Teacher, and Volunteer. Each role has its own responsibilities and access permissions.

Teachers can view their students and generate assessment papers. Students answer the questions on paper, and completed sheets can be uploaded for evaluation. The results help teachers see where a student needs more practice. Schools contain classes and student records. Assessments connect students to worksheets and results, and certifications record learning milestones. Administrators can review information within their permitted area.

The frontend provides the screens users interact with. The backend checks permissions, applies assessment rules, and reads or saves records in the database. Python tools support the evaluation of scanned answer sheets.

## 3. Current State of the Repository — What Has Been Done So Far

The FLN repository uses npm workspaces to keep the frontend and backend in one project while letting each part manage its own dependencies and commands.

| Part | What it does |
| --- | --- |
| `frontend/` | Uses React and TypeScript for dashboards, student rosters, and assessment screens. Vite runs the frontend during development. |
| `backend/` | Uses Node.js, Express, and TypeScript to handle API requests, check permissions, and coordinate assessment and worksheet generation. |
| `backend/fln-backend/` | A separate backend workspace that supports worksheet generation. |
| `ai-services/` | Contains Python tools that help process scanned answer sheets and support evaluation. |
| `backend/src/db.ts` | Handles access to MongoDB, which stores records such as schools, classes, students, and assessment results. |

The backend verifies signed JWTs for authentication and uses bcrypt for password hashing. Roles and student access rules control which records a signed-in user can act on. The root build command builds the Vite frontend and bundles the Express backend with esbuild. The production start command runs the bundled backend.

The platform supports sign-in, role-based dashboards, student rosters, diagnostic and level-wise worksheets, answer-sheet scanning and evaluation, and analytics views. I verified the teacher dashboard and paper generation locally with demo data.

I ran FLN locally with demo data and explored the teacher dashboard. I viewed the student roster, generated a diagnostic paper, and used the **Print L…** button to request a worksheet for one student. In the browser’s Network tab, I saw successful requests return `200` and repeat worksheet requests return `409` when a paper lock already existed. This helped me connect the actions on the teacher dashboard to the two backend routes I worked on for issue #740.

## 4. Gaps Observed in the Code

### Diagnostic requests could save a lock before checking access

- **Where.** `backend/src/routes/diagnosticBulk.ts`, in the handler for `POST /api/diagnostic/single`, around the call to `dbStore.addStudentCycleLock()`.
- **What.** The handler could write a lock before checking whether the student existed and whether the caller had permission.
- **Why it matters.** A teacher from another school could receive `403 Forbidden` after the lock was saved, blocking the student's own teacher from generating the paper. An unknown student ID could also leave a lock with no matching student.

### Single-student worksheet generation lacked a student access check

- **Where.** `backend/src/routes/worksheets.ts`, in the handler for `POST /api/worksheets/generate-level-pdf`, between the student lookup and lock creation.
- **What.** The handler checked whether the student existed but did not check whether the signed-in user could access that student before creating the lock.
- **Why it matters.** A signed-in user could request and lock a worksheet for a student outside their permitted scope.

Both gaps are tracked in [issue #740](https://github.com/vicharanashala/fln/issues/740).

## 5. Ideas for the Project

### Check student access before creating a paper lock

- **What.** Check that the student exists and that the caller can generate their paper before creating a lock in either route.
- **Why.** Rejected requests should leave the student eligible for paper generation by the correct teacher.
- **How.** Look up the student, return `404` if the record is missing, then apply the student access rules and return `403` if access is denied. Keep the existing `409` response for authorized requests when a lock already exists.

## 6. Your Contribution

On branch `fix/740-authorize-before-paper-lock`, I moved the student lookup and authorization ahead of the diagnostic lock and added a permission check before the single-student worksheet lock. The routes preserve the duplicate-request check for an authorized caller.

To verify this, I wrote and executed a hermetic Node test script using mocked database stores. I proved mathematically that:
- Requests for an unknown student return `404` with 0 locks written.
- Requests from an unauthorized teacher return `403` with 0 locks written.

I also successfully launched the backend server locally (`npm run dev`) connected to MongoDB and tested the local PDF generation fallback. Finally, I ensured the codebase remained clean by running the static type checker (`npm run lint` / `tsc --noEmit`), which passed with zero errors.
