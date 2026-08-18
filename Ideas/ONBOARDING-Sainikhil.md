# Onboarding Document — Sainikhil Cheedalla

## 1. What is FLN?

FLN stands for **Foundational Literacy and Numeracy**. It is a structured assessment and intervention platform designed to address a real crisis in Indian primary education: children regularly move from Class 1 to Class 4 without mastering the basics — they cannot read a simple paragraph, cannot do a two-digit subtraction, and these gaps silently compound. By the time they reach upper primary, the gaps are too big to close.

The FLN platform attacks this by giving every child a **personalized learning path** built on a 59-level mastery ladder mapped to NEP 2020 expectations for Classes 1–4. The platform is not a content-delivery system — it is a **diagnostic + intervention** system. Teachers don't have to guess where a child is struggling; the platform places the child on the exact level, generates worksheets at that level, and measures growth over time. The system also rolls data up a 7-role hierarchy (Volunteer → Teacher → School → Block → District → State → National) so that policy-makers can see *real* outcomes, not just enrollment counts.

The platform's purpose is to make "every child at expected level" something a state can actually verify, not just a slogan.

## 2. What do you understand by FLN as a system?

After exploring the codebase, I see FLN as a system with four layers:

**A. Identity & roles (7 roles, hierarchical):**
- `SUPERADMIN` / `ADMIN` — national/state-level governance, scope-all
- `DISTRICT_ADMIN` / `BLOCK_ADMIN` — geographic scoping (`stateCode` / `districtCode` / `blockCode`)
- `SCHOOL` — principal-style user, sees only their own school
- `TEACHER` — owns their assigned students + class roster, generates worksheets, records interventions
- `VOLUNTEER` — community-level, accesses only `assignedSchools[]`

**B. Domain entities (MongoDB collections + JSON fallback):**
- `users`, `schools`, `classes`, `students`, `questions`, `worksheets`, `levelWorksheets`, `questionBank`, `answerSubmissions`, `evaluationReports`, `tickets`, `logbook`, `announcements`, `interventions`, `bestPractices`, `diagnosticAnswerKeys`, `certifications`, `competencyRequirements`
- `Student.currentLevel` (1–59) is the placement, `Student.targetLevel` is always `currentLevel + 1`, `Student.classGroup` is a string like `"Class 3"`.
- `EvaluationReport.conceptMastery` is the per-topic verdict (`Strong | Satisfactory | Needs Practice`) — this is the **evidence** the Certification Engine consumes.

**C. Flow (the happy path):**
1. Teacher registers a student → placement diagnostic runs (12 questions across 8 levels)
2. Backend's Python pipeline (`ai-services/run_pipeline.py`) evaluates the diagnostic and writes an `EvaluationReport` with `conceptMastery`
3. Each subsequent worksheet submission produces another `EvaluationReport`; `Student.currentLevel` advances when the new `recommendedLevel` exceeds it
4. The Certification Engine fires **fire-and-forget** at every `addEvaluationReport` site (`backend/src/routes/evaluation.ts:411`, `:1046`; `backend/src/routes/students.ts:549`) and decides if the student qualifies for the Class-N Level-5 certificate
5. Admins see aggregate analytics via `/api/stats` + `/api/analytics` and resolve any `review_needed` certs via `/api/certification/review/:id`

**D. Cross-cutting concerns:**
- **Auth:** signed JWT (`jsonwebtoken`) with bcrypt password hashes; hardened by upstream (no more email-as-bearer bypass).
- **DB dual-mode:** MongoDB Atlas is primary; if `MONGODB_URI` is missing or unreachable, falls back to a JSON file at `data/db.json` so the server never silently dies.
- **AI services:** Python pipeline (`ai-services/`) under `AI_SERVICES_DIR` does the heavy lifting (OCR, evaluation, personalized generation); Node calls it via `execFile` (no shell).
- **PDF generation:** Puppeteer + headless Chrome renders worksheets from `frontend/public/worksheets/levels_main.html`.

## 3. Current State of the Repository — What Has Been Done So Far

**Stack:**
- Frontend: React 19 + TypeScript + Vite + Tailwind + TanStack Query; `apiFetch` wraps `fetch()` with base-path-aware URLs (`frontend/src/services/apiClient.ts:19`)
- Backend: Node 20 + Express + TypeScript (esbuild-bundled to `dist/server.cjs`); npm workspaces monorepo (`frontend/`, `backend/`, `ai-services/`)
- DB: MongoDB Atlas (shared cluster) with local JSON fallback
- AI: Google Gemini (`backend/src/gemini.ts`) + Python pipeline (`ai-services/run_pipeline.py`, `personalized_evaluation_pipeline.py`) + Ollama-Gemma 4 for ICR OCR
- Auth: JWT (HS256) + bcrypt; password policy: ≥8 chars, ≥1 uppercase, ≥1 digit, ≥1 special (`backend/src/routes/auth.ts:18-24`)

**Architecture:**
- Backend `index.ts` (`backend/src/index.ts`) is now a thin boot file — all routes are split into `backend/src/routes/*.ts` (17 files: `admin`, `analytics`, `announcements`, `auth`, `bestPractices`, `classes`, `diagnosticBulk`, `evaluation`, `geo`, `interventions`, `logbook`, `schools`, `stats`, `students`, `teachers`, `tickets`, `worksheets`) plus my new `certification` route
- Each route exports a `registerXxxRoutes(app)` function mounted in `index.ts`
- Frontend routes via `react-router-dom` (BrowserRouter in `main.tsx:19`); `activePanel` state in `App.tsx:52` dispatches to `PanelViews.tsx` for all non-special panels

**Implemented features I observed:**
- Role-based dashboards (Superadmin, Admin, School, Teacher, Volunteer, Block Admin, District Admin)
- Student registration (single + bulk CSV via `/api/students/bulk-import`)
- AI-powered diagnostic + worksheet generation via Gemini
- Personalized worksheet printing (PDF via Puppeteer)
- ICR scanner with two-stage blue-pen filter + Ollama OCR (`frontend/src/components/IcrTwoStageScan.tsx`, 1144 lines)
- 93-level skill graph (`frontend/src/data/skillProgressionMap.ts`, 713 lines)
- Analytics with geographic and per-school drill-down
- Intervention tracking + best-practices repository
- Tickets system + logbook + announcements
- **My contribution: full Certification Engine (R-7)** — see Section 6

## 4. Gaps Observed in the Code

### Gap 1 — Public `/api/stats` still uses the obsolete `currentLevel >= 5` shortcut to count certified students

- **Where:** `backend/src/routes/stats.ts:28`
  ```ts
  db.collection('students').aggregate([{ $match: { currentLevel: { $gte: 5 } } }, { $count: 'count' }]).toArray(),
  ```
- **What:** The Certification Engine creates proper `Certification` rows with a `status: 'active' | 'review_needed' | 'revoked'` field, but this endpoint still counts "certified" as any student whose `currentLevel >= 5`. The two numbers can — and do — disagree.
- **Why it matters:** The public landing page (`LandingView.tsx`) reads `/api/stats` to display the national certification rate (`backend/src/routes/stats.ts:42-43`). If an admin `revoke`s a cert, the public counter still says "certified". For a national dashboard whose entire credibility is "we can prove X% of children are at grade level", this silent drift is unacceptable. Also contradicts the design contract documented in `backend/src/modules/certification/README.md:88-116`.

### Gap 2 — `notification.service.ts` emails **every** SUPERADMIN + ADMIN regardless of geographic scope

- **Where:** `backend/src/modules/certification/services/notification.service.ts:35-45`
  ```ts
  export async function getAdminEmails(): Promise<string[]> {
    const users = await dbStore.getUsers();
    return users
      .filter((u) => u.role === UserRole.SUPERADMIN || u.role === UserRole.ADMIN)
      .map((u) => u.email);
  }
  ```
- **What:** When a student in Guntur, AP has their cert flipped to `review_needed`, this fires an email to **every** admin in the system — including State admins in Punjab, District admins in Ludhiana, etc. There is no `stateCode` / `districtCode` filter.
- **Why it matters:** (a) Privacy — a teacher in Punjab learns the name/ID of a student in AP. (b) Operational noise — every State admin gets pinged about cert events in other states, leading to alert fatigue. (c) Inconsistency — `canAccessStudent(user, student)` (the IDOR guard on the review endpoint) **does** enforce scope, but the email side-effect bypasses it.

### Gap 3 — In-memory `inFlight` Map for per-student cert serialization doesn't survive process restart or scale to multiple replicas

- **Where:** `backend/src/certificationRecords.ts:11-12`, `:24`, `:163-181`
  ```ts
  // Lost on process restart, which is acceptable for single-process dev/prod.
  // Revisit when scaling to multiple replicas (use a Mongo-backed lock then).
  const inFlight: Map<string, Promise<void>> = new Map();
  ```
- **What:** When two worksheet submissions for the same student arrive within milliseconds, the orchestrator chains them via a module-level `Map` so they don't race on the cert row. This works only in a single process.
- **Why it matters:** (a) After `nodemon` reload during dev, the Map is empty — a concurrent submit window opens. (b) The moment this backend runs in 2+ replicas (load-balanced deployment), two replicas can both process the same student's worksheet simultaneously and both attempt the same `updateCertification` — the `version` guard prevents data corruption but one of them runs engine logic twice and emits a duplicate email notification. The author of the code flagged this as a "revisit later" but it should be revisited before production deployment.

### Gap 4 — `demo-cert.ts` is hard-coded to Class 4 only

- **Where:** `backend/src/scripts/demo-cert.ts:29`
  ```ts
  const CLASS_NUMBER = 4;
  ```
- **What:** The demo seed only works for Class 4 students (Guntur). Classes 2 and 3 are SRS §3 scope but cannot be demo-seeded without editing the constant.
- **Why it matters:** A mentor reviewing the Certification Engine on a Punjab Class 2 school cannot see a live demo unless they manually edit the script. It also means there's no smoke test that the engine handles mandatory topics for lower classes — and `competencyRequirements.seed.json` only seeds Class 2-4 / level 5 mandatory topics, so untested.

### Gap 5 — Race in `CertificationReviewPanel.tsx` cache invalidation when role switches mid-fetch

- **Where:** `frontend/src/components/CertificationReviewPanel.tsx:62-71`
  ```ts
  const prevRoleRef = useRef(currentUser.role);
  useEffect(() => {
    if (prevRoleRef.current !== currentUser.role) {
      ...setRows([]); ...
    }
  }, [currentUser.role]);
  ```
- **What:** The `useEffect` clears local state when the role changes. But if the in-flight `apiFetch` from the old role resolves **after** the role change, its `setRows(certs)` overwrites the cleared state with data the new role may not have permission to see (the old fetch used the old role's JWT, which might have been broader).
- **Why it matters:** The demo role-switcher in this app makes this trivially reproducible — switch from SUPERADMIN to VOLUNTEER in <100ms during a slow network, and a cert list meant for SUPERADMIN could be momentarily visible in the volunteer view. Low severity but the panel guards explicitly against "demo role-switching" elsewhere; this hole contradicts that intent.

### Gap 6 — No test that the cert engine and the Certification Engine's stats shortcut agree

- **Where:** `backend/src/routes/stats.ts:28` (the shortcut) vs `backend/src/certificationRecords.ts` (the engine)
- **What:** There is no assertion that `countActiveCertificationsFromMemory(students, certs) === students.filter(s => s.currentLevel >= 5).length`. If someone tweaks `competencyRequirements.seed.json` (e.g. adds a new mandatory topic), the numbers diverge silently and no test catches it.
- **Why it matters:** Without this guard, Gap 1 becomes a permanent silent drift. Tests should pin the discrepancy to a known tolerance (or zero) and fail CI if it grows.

## 5. Ideas for the Project

### Idea 1 — Make `/api/stats` read from the Certification table (closes Gap 1 & Gap 6)

- **What:** Replace the `currentLevel >= 5` aggregation in `backend/src/routes/stats.ts:28` with a `countDocuments({ status: 'active' })` on the `certifications` collection. For the brief period when the engine hasn't run on a student yet, fall back to the legacy shortcut **but log a warning** (already a TODO in `AGENTS.md`).
- **Why:** Restores the principle that the `Certification` table is the single source of truth for "certified" — matches the contract documented in `backend/src/modules/certification/README.md:88-100`. Also makes admin `revoke` actions immediately visible on the public landing page.
- **How:** Add a helper `countActiveCertificationsFromDb()` in `certificationRecords.ts` mirroring the existing in-memory `countActiveCertificationsFromMemory`. Swap the aggregate in `stats.ts`. Add an assert in `__checks__/certification.check.ts` that pins the shortcut-vs-engine discrepancy to `0` for any seed snapshot.

### Idea 2 — Scope-filtered notifications (closes Gap 2)

- **What:** Make `notification.service.ts:35-45` accept the student as input and return only admins whose scope covers that student's school.
- **Why:** State and District admins should only hear about events in their jurisdiction. Aligns the side-effect channel with the access-control channel (`canAccessStudent`).
- **How:** Pass `student` into `getAdminEmails(student)` (or split into `getScopedAdminEmails`). Filter by `user.stateCode === student.schoolStateCode` (with SUPERADMIN exempted as the catch-all). Add a unit test in `__checks__/certification.check.ts` that pins the recipient list to "in-scope admins only".

### Idea 3 — Mongo-backed lock for cert orchestration (closes Gap 3)

- **What:** Replace the in-memory `inFlight: Map<studentId, Promise>` in `backend/src/certificationRecords.ts:24, :163` with a Mongo-backed advisory lock — either a `cert_locks` collection with `findOneAndUpdate({ studentId, lockUntil: { $lt: now } }, ...)` or a Redis lock if a Redis is available.
- **Why:** Makes the engine safe under multiple replicas and across restarts. Removes the "acceptable for dev only" caveat in the source comment.
- **How:** Add a `tryAcquireCertLock(studentId, ttlMs)` helper. Wrap `runCertificationEligibilityForStudent` with `tryAcquireCertLock → run → release`. Keep the current in-memory fallback for dev so no infra change is required.

### Idea 4 — Make `demo-cert.ts` configurable + cover all classes (closes Gap 4)

- **What:** Accept `CLASS_NUMBER` and `LEVEL` as CLI args (`npx tsx backend/src/scripts/demo-cert.ts --class 3 --level 5`) and seed appropriate mandatory topics.
- **Why:** Makes the demo script a true smoke test for the engine — running it across all 3 classes (2, 3, 4) verifies every bucket has at least one positive + one negative path.
- **How:** Parse `process.argv`, look up the mandatory topics for that `(classNumber, level)` from `getRequirementsForClassLevel`, build conceptMastery accordingly. Add 3 separate smoke tests under `__checks__/`.

### Idea 5 — Cancel in-flight fetches on role switch (closes Gap 5)

- **What:** Use an `AbortController` in `CertificationReviewPanel.tsx`'s `fetchQueue` so a role switch aborts the in-flight request before it can `setRows`.
- **Why:** Removes the small window where stale SUPERADMIN data could land in a volunteer's render.
- **How:** `const controller = new AbortController(); apiFetch(..., { signal: controller.signal })`. In the role-switch `useEffect`, call `controller.abort()` and create a fresh one.

### Idea 6 — Per-cohort certified counting (closes Gap 6 partially)

- **What:** A "certified student" should be counted for the cert that matches their current `classGroup`, not summed across all certs. Currently deferred in `backend/src/modules/certification/README.md:101-103`.
- **Why:** A student who was certified at Class 3 and has moved to Class 4 should not count as "certified" against the Class 4 metric until they earn a Class 4 cert. Without this, the dashboard over-counts and demotivates Class 4 teachers.
- **How:** Update `countActiveCertificationsFromMemory` to accept a `cohortKey` derived from `student.classGroup` and match it to `cert.classNumber`. This is a one-line semantic change with a meaningful correctness impact.

## 6. Your Contribution

During onboarding, I built the **complete Certification Engine (SRS §3.7, code-named "R-7")** end-to-end across all layers — backend engine + orchestration, admin review API, frontend surfaces, runnable assert scripts, and a demo seed script. Here is what I delivered:

### A. Pure eligibility decision engine — `backend/src/certification.ts` (81 lines)

- `decideEligibility(requirements, conceptMastery, evaluatedAt)` is a **pure** function — no DB, no IO, fully unit-testable.
- Implements **outcome precedence** (insufficient_evidence > not_eligible > eligible) so untested topics are never reported as failures.
- Implements **mastery rank** (Strong > Satisfactory > Needs Practice) with a comparator `MASTERY_RANK`.
- Has a byte-identical Mongoose-side mirror in `backend/src/modules/certification/services/eligibility.service.ts` so the two backends cannot drift; assert scripts guard this.

### B. Orchestration + persistence — `backend/src/certificationRecords.ts` (358 lines)

- Wires the pure engine to the legacy `DBStore`; per-student serialisation via `inFlight: Map<studentId, Promise>` so two simultaneous worksheet submissions don't race on the cert row.
- **`updateCertificationIfVersion`** — optimistic concurrency on `(id, version)`; the admin review endpoint uses it so two admins cannot accidentally double-confirm/revoke.
- **`resolveCertificationReview`** — pure helper for `confirm` / `revoke` with `WRONG_STATE` / `MISSING_REASON` / `INVALID_DECISION` error codes, exhaustively unit-tested.
- **`countActiveCertificationsFromMemory`** + **`buildPerSchoolStats`** — single source of truth for certification analytics, called from both top-level `certifiedCount` and `pipeline.certified` so they cannot drift.

### C. Admin review endpoints — `backend/src/routes/certification.ts` (153 lines, NEW file)

- `POST /api/certification/review/:certificationId` — `confirm`/`revoke` action; allowlist `[SUPERADMIN, ADMIN]`; revokes require non-empty `reason`; IDOR guard via `canAccessStudent`; 409 on concurrent modification; logs to in-app logbook.
- `GET /api/certifications?status=&studentId=` — queue view for admins (full read), per-student view for any role with access (mirrors the same `canAccessStudent` policy).

### D. Mandatory competency registry — `backend/src/competencyRequirements.ts` (44 lines) + `backend/src/data/competencyRequirements.seed.json` (124 lines)

- Loads the same seed JSON the Mongoose backend uses, with the matching `(classNumber, level, topic, meetsThreshold, isMandatory)` shape — single source of truth across both backends.
- `getRequirementsForClassLevel(classNumber, level)` is the single lookup the orchestrator calls.

### E. Frontend surfaces — 574 lines of new React

- **`frontend/src/components/CertificationReviewPanel.tsx`** (407 lines) — admin action queue with status filter (review_needed ↔ All), `Confirm`/`Revoke` action buttons per row, an accessible `RevokeModal` (Esc/click-outside/focus-on-open/textarea label), success toast auto-clears after 5s, and a `useEffect` keyed on `currentUser.role` that clears local state on role change to defend against the demo role-switcher.
- **`frontend/src/components/CertificationHistoryCard.tsx`** (167 lines) — per-student cert history; one card per `(classNumber, level)` bucket; fetches `GET /api/certifications?studentId=...`; uses a `useRef` cache scoped to the card's mount lifetime so switching students is fast without risking cross-session staleness.

### F. Sidebar + panel wiring

- `frontend/src/components/Layout.tsx` — added the "Certification Reviews" sidebar entry (with the `Award` icon from lucide-react) under `UserRole.SUPERADMIN` and `UserRole.ADMIN` only — matches the backend allowlist and is **state-driven**, so a volunteer can't reach it via URL.
- `frontend/src/components/PanelViews.tsx` — added the `panel === 'certification_reviews'` case that mounts `<CertificationReviewPanel />` with the standard `PageHeader` wrapper.

### G. Phase-6 admin notifications — `backend/src/modules/certification/services/notification.service.ts` (145 lines)

- When a cert transitions `active → review_needed`, two parallel fire-and-forget notifications:
  1. An in-app logbook entry via `dbStore.addLog()`, visible to admins via the existing `/api/logbook`.
  2. An email payload to all SUPERADMIN + ADMIN users, built via `nodemailer` if `SMTP_HOST` is set, otherwise logged to stdout so the demo runs end-to-end without SMTP credentials.
- Both calls are wrapped in `.catch()` — failures never block the cert transition itself (observability, not a hard gate).

### H. Runnable assert scripts (no Vitest dependency)

- `backend/src/__checks__/certification.check.ts` (398 lines) — exhaustively tests the orchestrator's `resolveCertificationReview`, `countActiveCertificationsFromMemory`, and per-student `inFlight` serialisation across 5 scenarios.
- `backend/src/__checks__/certification-list.check.ts` (155 lines) — tests the review endpoint's optimistic concurrency + role allowlist + invalid-input handling.
- Both are runnable via `npx tsx` and print `N passed, 0 failed`. If they diverge from the Mongoose engine's parallel scripts, the two backends are out of sync — see "Two-backend drift" in `backend/src/modules/certification/README.md:300-305`.

### I. Demo seed script — `backend/src/scripts/demo-cert.ts` (220 lines)

- Picks 5 Class 4 students and injects hand-crafted `EvaluationReport`s with specific `conceptMastery` values that produce the canonical 3 outcomes:
  - **Student A** (Anita Dalal) — all topics `Strong` → cert becomes `active`
  - **Student B** (Ramesh Malik) — one topic `Needs Practice` → no cert row (correct: no false certification)
  - **Student C** (Sushma Khan) — first all `Strong` then corrected on `Number Operations` → cert transitions `active → review_needed` (so the admin panel has a Confirmable case)
  - **Student D** (Rajesh Saini) — `Fractions` intentionally missing from the verdict → `insufficient_evidence` (the engine reports unassessed, not failed)
  - **Student E** (Savita Ansari) — same flow as C but on `Money` → second `review_needed` (so the admin panel has a Revokeable case)
- Supports `--reset` flag to wipe the 5 demo students' reports + certs before re-seeding for a guaranteed clean state before each mentor demo.

### J. Design rationale — `backend/src/modules/certification/README.md` (326 lines)

- Documents the full design contract: outcome precedence, mastery comparator, idempotency key `(studentId, classNumber, level)`, the re-evaluation trigger, the admin review state machine, the analytics contract, the race-handling strategy, the admin notification flow, and the deferred items with explicit "why deferred" rationale.
- This is the source-of-truth for anyone touching this module in the future.

### K. Integration with the upstream split-routes architecture (PR to vicharanashala/fln)

When upstream split the monolithic `index.ts` into 17 route files, my module had to be re-integrated. In a single, well-documented commit (`d0f5575` → amended `6591788`):
- Registered the new `registerCertificationRoutes(app)` in `backend/src/index.ts`
- Added the `runCertificationEligibility(student)` fire-and-forget trigger at all 3 `addEvaluationReport` sites (`routes/evaluation.ts:411`, `:1046`; `routes/students.ts:549`)
- Adapted all my types and DBStore accessors to the upstream `db.ts` shape (`Certification`, `CompetencyRequirement`, `MasteryLevel`, `CertificationStatus`, plus 7 accessor methods including `updateCertificationIfVersion` and `getLatestConceptMastery`)
- Cleaned up the Mongoose stub files (`modules/certification/models/*.ts`, `backend/src/models/competency/competencyRequirement.model.ts`) with `@ts-nocheck` so they don't generate false type errors against the post-`remove-streak-backend` Student shape
- Verified `npm run lint` (both backend `tsc --noEmit` and frontend `tsc --noEmit`) is clean, no new type errors
- Verified end-to-end via `GET /api/certifications?status=review_needed` returns the demo certs with `decisionSnapshot.missingTopics` populated as expected

### Why this matters

The Certification Engine replaces a brittle level-threshold shortcut (`currentLevel >= 5`) with **evidence-based, audit-trailed, version-stamped** certification. Every cert row is immutable — admins can flip `review_needed → active | revoked` but never silently rewrite history. This is the difference between "the system says X% of children are at grade level" (a slogan) and "the system can prove X% of children met the mandatory competency threshold, with per-child evidence attached" (a measurement).