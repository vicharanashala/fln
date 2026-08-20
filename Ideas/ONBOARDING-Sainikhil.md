# Onboarding Document — Sainikhil Cheedalla

## 1. What is FLN?

FLN stands for **Foundational Literacy and Numeracy**. It is a structured assessment and intervention platform designed to address a real crisis in Indian primary education: children regularly move from Class 1 to Class 4 without mastering the basics — they cannot read a simple paragraph, cannot do a two-digit subtraction, and these gaps silently compound. By the time they reach upper primary, the gaps are too big to close.

The FLN platform attacks this by giving every child a **personalized learning path** built on a mastery ladder mapped to NEP 2020 expectations for Classes 1–4. The platform is not a content-delivery system — it is a **diagnostic + intervention** system. Teachers don't have to guess where a child is struggling; the platform places the child on the exact level, generates worksheets at that level, and measures growth over time. The system also rolls data up a 7-role hierarchy (Volunteer → Teacher → School → Block → District → State → National) so that policy-makers can see *real* outcomes, not just enrollment counts.

The platform's purpose is to make "every child at expected level" something a state can actually verify, not just a slogan.

## 2. What do you understand by FLN as a system?

After exploring the codebase, I see FLN as a system with four layers.

**Note on terminology — two different level schemes coexist:**

| Scheme | Where it lives | Granularity | Use |
|---|---|---|---|
| **59-level mastery ladder** (the original SRS design) | `Student.currentLevel` field, `backend/src/levelGenerator.ts`, the `competencyRequirements.seed.json` bucket keys | 1 number per student | Drives placement, worksheet generation, the certification decision (target cert = level 5) |
| **93-level skill graph** (upstream extension) | `frontend/src/data/skillProgressionMap.ts`, `docs/skill-graph/FLN_93_Level_Skill_Graph_Specification.md` | 93 levels × 24 core skills (SK01–SK24) × granular sub-skills | Drives the frontend skill-graph panel and the AI Services pipeline's personalised exam generation |

The student-facing placement number is still 59. The skill graph is a richer representation layer for the diagnostics/analytics surfaces — it does **not** change `Student.currentLevel`. This distinction is important to keep in mind whenever you read about "levels" in this repo.

**A. Identity & roles (7 roles, hierarchical):**
- `SUPERADMIN` / `ADMIN` — national/state-level governance, scope-all
- `DISTRICT_ADMIN` / `BLOCK_ADMIN` — geographic scoping (`stateCode` / `districtCode` / `blockCode`)
- `SCHOOL` — principal-style user, sees only their own school
- `TEACHER` — owns their assigned students + class roster, generates worksheets, records interventions
- `VOLUNTEER` — community-level, accesses only `assignedSchools[]`

**B. Domain entities (MongoDB collections + JSON fallback):**
- `users`, `schools`, `classes`, `students`, `questions`, `worksheets`, `levelWorksheets`, `questionBank`, `answerSubmissions`, `evaluationReports`, `tickets`, `logbook`, `announcements`, `interventions`, `bestPractices`, `diagnosticAnswerKeys`, `certifications`, `competencyRequirements`
- `Student.currentLevel` (1–59) is the placement; `Student.targetLevel` is always `currentLevel + 1`; `Student.classGroup` is a string like `"Class 3"`.
- `EvaluationReport.conceptMastery` is the per-topic verdict (`Strong | Satisfactory | Needs Practice`) — this is the **evidence** the Certification Engine consumes.

**C. Flow (the happy path):**
1. Teacher registers a student → placement diagnostic runs (12 questions across 8 levels).
2. Backend's Python pipeline (`ai-services/run_pipeline.py`) evaluates the diagnostic and writes an `EvaluationReport` with `conceptMastery`.
3. Each subsequent worksheet submission produces another `EvaluationReport`; `Student.currentLevel` advances when the new `recommendedLevel` exceeds it.
4. The Certification Engine fires **fire-and-forget** at every `addEvaluationReport` site (`backend/src/routes/evaluation.ts:411`, `:1046`; `backend/src/routes/students.ts:549`) and decides if the student qualifies for the Class-N Level-5 certificate.
5. Admins see aggregate analytics via `/api/stats` + `/api/analytics` and resolve any `review_needed` certs via `/api/certification/review/:id`.

**D. Cross-cutting concerns:**
- **Auth:** signed JWT (`jsonwebtoken`) with bcrypt password hashes; hardened by upstream (no more email-as-bearer bypass). Password policy: ≥8 chars, ≥1 uppercase, ≥1 digit, ≥1 special.
- **DB dual-mode:** MongoDB Atlas is primary; if `MONGODB_URI` is missing or unreachable, falls back to a JSON file at `data/db.json` so the server never silently dies.
- **AI services:** Python pipeline under `AI_SERVICES_DIR` does the heavy lifting (OCR, evaluation, personalized generation); Node calls it via `execFile` (no shell injection surface).
- **PDF generation:** Puppeteer + headless Chrome renders worksheets from `frontend/public/worksheets/levels_main.html`.

## 3. Current State of the Repository — What Has Been Done So Far

**Stack:**
- Frontend: React 19 + TypeScript + Vite + Tailwind + TanStack Query; `apiFetch` wraps `fetch()` with base-path-aware URLs (`frontend/src/services/apiClient.ts:19`).
- Backend: Node 20 + Express + TypeScript (esbuild-bundled to `dist/server.cjs`); npm workspaces monorepo (`frontend/`, `backend/`, `ai-services/`).
- DB: MongoDB Atlas (shared cluster) with local JSON fallback (`backend/data/db.json`).
- AI: Google Gemini (`backend/src/gemini.ts`) + Python pipeline + Ollama-Gemma 4 for ICR OCR.
- Auth: JWT (HS256) + bcrypt.

**Architecture:**
- Backend `index.ts` (`backend/src/index.ts`) is now a thin boot file — all routes are split into `backend/src/routes/*.ts` (17 files: `admin`, `analytics`, `announcements`, `auth`, `bestPractices`, `classes`, `diagnosticBulk`, `evaluation`, `geo`, `interventions`, `logbook`, `schools`, `stats`, `students`, `teachers`, `tickets`, `worksheets`) plus the Certification route.
- Each route exports a `registerXxxRoutes(app)` function mounted in `index.ts`.
- Frontend routes via `react-router-dom` (BrowserRouter in `main.tsx:19`); `activePanel` state in `App.tsx:52` dispatches to `PanelViews.tsx` for all non-special panels.

**Implemented features I observed:**
- Role-based dashboards (Superadmin, Admin, School, Teacher, Volunteer, Block Admin, District Admin).
- Student registration (single + bulk CSV via `/api/students/bulk-import`).
- AI-powered diagnostic + worksheet generation via Gemini.
- Personalized worksheet printing (PDF via Puppeteer).
- ICR scanner with two-stage blue-pen filter + Ollama OCR (`frontend/src/components/IcrTwoStageScan.tsx`).
- 93-level skill graph surfaced in `frontend/src/components/SkillGraphPanel.tsx` (frontend only — `Student.currentLevel` stays 1–59).
- Analytics with geographic and per-school drill-down.
- Intervention tracking + best-practices repository.
- Tickets system + logbook + announcements.

## 4. Gaps Observed in the Code

### Gap 1 — Public `/api/stats` still uses the obsolete `currentLevel >= 5` shortcut to count certified students

- **Where:** `backend/src/routes/stats.ts:28`
  ```ts
  db.collection('students').aggregate([{ $match: { currentLevel: { $gte: 5 } } }, { $count: 'count' }]).toArray(),
  ```
- **What:** The Certification Engine creates proper `Certification` rows with `status: 'active' | 'review_needed' | 'revoked'`, but this public endpoint still counts "certified" as any student whose `currentLevel >= 5`. The two numbers use different definitions of certification. **Verified live on the dev Atlas (86401 students):** `/api/stats.certifiedCount` = 63,276 (shortcut); `/api/certifications?status=active` count = 2 — a gap of 63,274 students.
- **Why it matters:** The public landing page (`LandingView.tsx`) reads `/api/stats` to display the national certification rate. If an admin `revoke`s a cert, the public counter still says "certified". For a national dashboard whose credibility depends on provable, auditable counts, this silent drift is unacceptable, and it directly contradicts the design contract documented in `backend/src/modules/certification/README.md:88-116`.

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
- **What:** When a student in Guntur, AP has their cert flipped to `review_needed`, this fires an email to **every** admin in the system — including State admins in Punjab, District admins in Ludhiana. There is no `stateCode` / `districtCode` filter.
- **Why it matters:** (a) Privacy — an administrator outside the student's jurisdiction (different state/district/block) may receive the student's certification event details (name pattern in subject line, student ID, class/level, review URL). The code at `notification.service.ts:35-45` only filters by role, not by scope; whether the recipient list in this codebase also includes non-admin roles is *not* verified from the file alone, but the absence of any scope filter on the admin list itself is what this gap is about. (b) Operational noise — every State admin gets pinged about cert events in other states, leading to alert fatigue. (c) Inconsistency — `canAccessStudent(user, student)` (the IDOR guard on the review endpoint) **does** enforce scope, but the email side-effect bypasses it.

### Gap 3 — In-memory `inFlight` Map for per-student cert serialization doesn't survive process restart or scale to multiple replicas

- **Where:** `backend/src/certificationRecords.ts:11-12`, `:24`, `:163-181`
  ```ts
  // Lost on process restart, which is acceptable for single-process dev/prod.
  // Revisit when scaling to multiple replicas (use a Mongo-backed lock then).
  const inFlight: Map<string, Promise<void>> = new Map();
  ```
- **What:** When two worksheet submissions for the same student arrive within milliseconds, the orchestrator chains them via a module-level `Map` so they don't race on the cert row. This works only in a single process.
- **Why it matters:** (a) After `nodemon` reload during dev, the Map is empty — a concurrent submit window opens. (b) The moment this backend runs in 2+ replicas, two replicas can both process the same student's worksheet simultaneously and both attempt the same `updateCertification`. The `version` guard prevents data corruption, but the engine logic runs twice and emits a duplicate email notification. The source comment flags this as "revisit later" — it should be revisited before production.

### Gap 4 — `demo-cert.ts` is hard-coded to Class 4 only

- **Where:** `backend/src/scripts/demo-cert.ts:29`
  ```ts
  const CLASS_NUMBER = 4;
  ```
- **What:** The demo seed only works for Class 4 students (Guntur). Classes 2 and 3 are SRS §3 scope but cannot be demo-seeded without editing the constant.
- **Why it matters:** A mentor reviewing the Certification Engine on a Punjab Class 2 school cannot see a live demo unless they manually edit the script. It also means there's no smoke test that the engine handles mandatory topics for lower classes — and `competencyRequirements.seed.json` only seeds Class 2-4 / level 5 mandatory topics, so those buckets are effectively untested in CI.

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

### Gap 6 — No regression test pinning the public `certifiedCount` to the Certification-table count after the stats migration

- **Where:** `backend/src/routes/stats.ts:28` (the shortcut) vs `backend/src/certificationRecords.ts:countActiveCertificationsFromMemory` (the engine)
- **What:** Today there is no assertion that the public stats number matches the number of `status: 'active'` Certification rows. Once Idea 1 (below) migrates `/api/stats` to read from the `certifications` collection, there is still no test pinning the new behaviour so a future refactor cannot silently regress it back to the shortcut.
- **Why it matters:** Without this guard, Gap 1 becomes a permanent silent drift. The right test pins the new source of truth (Certification rows) and asserts the public endpoint honours it; the test must **not** assert equality with the legacy shortcut, because the whole point of Idea 1 is to replace that shortcut.

## 5. Ideas for the Project

### Idea 1 — Make `/api/stats` read from the Certification table (closes Gap 1 & Gap 6)

- **What:** Replace the `currentLevel >= 5` aggregation in `backend/src/routes/stats.ts:28` with a `countDocuments({ status: 'active' })` on the `certifications` collection. During the brief window when the engine hasn't yet run on a student, fall back to the legacy shortcut **but log a warning** (matches the existing TODO in `AGENTS.md`).
- **Why:** Restores the principle that the `Certification` table is the single source of truth for "certified". Matches the contract documented in `backend/src/modules/certification/README.md:88-100`. Makes admin `revoke` actions immediately visible on the public landing page.
- **How:** Add a helper `countActiveCertificationsFromDb()` in `certificationRecords.ts` mirroring the existing in-memory `countActiveCertificationsFromMemory`. Swap the aggregate in `stats.ts`. Add a regression test in `__checks__/certification.check.ts` that pins `GET /api/stats → certifiedCount === db.certifications.countDocuments({ status: 'active' })`. **The test must compare against the Certification collection, not against the legacy shortcut.**

### Idea 2 — Scope-filtered notifications (closes Gap 2)

- **What:** Make `notification.service.ts:35-45` accept the student as input and return only admins whose scope covers that student's school.
- **Why:** State and District admins should only hear about events in their jurisdiction. Aligns the side-effect channel with the access-control channel (`canAccessStudent`).
- **How:** Pass `student` into `getScopedAdminEmails(student)`. Filter by `user.stateCode === student.schoolStateCode` (with SUPERADMIN exempted as the catch-all). Add a unit test in `__checks__/certification.check.ts` that pins the recipient list to "in-scope admins only".

### Idea 3 — Mongo-backed lock for cert orchestration (closes Gap 3)

- **What:** Replace the in-memory `inFlight: Map<studentId, Promise>` in `backend/src/certificationRecords.ts:24, :163` with a Mongo-backed advisory lock — a `cert_locks` collection with `findOneAndUpdate({ studentId, lockUntil: { $lt: now } }, ...)`, or a Redis lock if Redis is available.
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

### Idea 6 — Per-cohort certified counting (extends the analytics contract)

- **What:** A "certified student" should be counted for the cert that matches their current `classGroup`, not summed across all certs. Currently deferred in `backend/src/modules/certification/README.md:101-103`.
- **Why:** A student who was certified at Class 3 and has moved to Class 4 should not count as "certified" against the Class 4 metric until they earn a Class 4 cert. Without this, the dashboard over-counts and demotivates Class 4 teachers.
- **How:** Update `countActiveCertificationsFromMemory` to accept a `cohortKey` derived from `student.classGroup` and match it to `cert.classNumber`. One-line semantic change with meaningful correctness impact.

## 6. Your Contribution

I implemented the **Certification Engine (SRS §3.7, code-named "R-7")** end-to-end across the backend, the frontend, and the developer experience. This section focuses on **what was built, why it matters, and the technical decisions** — not on every file. Reviewers can verify ownership via `git log --author="Sainikhil-hub" --branches=certification-engine`.

### What I built and why

The platform previously marked a student "certified" using a single shortcut — `currentLevel >= 5`. That conflated *placement* with *competency*. A child could be at level 5 because Gemini graded their latest worksheet generously, without having demonstrated mastery of any specific topic. For a national platform whose promise is provable grade-level mastery, that shortcut is not safe.

I replaced it with an **evidence-based, audit-trailed certification model**: a pure eligibility engine that consumes mandatory topic requirements + the student's latest `conceptMastery`, produces a 3-valued verdict (`eligible | not_eligible | insufficient_evidence`), and writes an immutable `Certification` row keyed on `(studentId, classNumber, level)`. Every row is **version-stamped**; admins can transition `review_needed → active | revoked` but never silently rewrite history.

### Key technical decisions (and the reasoning)

- **Pure engine + thin orchestrator.** The decision logic (`backend/src/certification.ts`) is a pure function with no IO — it can be unit-tested without spinning up MongoDB. The orchestrator (`backend/src/certificationRecords.ts`) wires it to persistence. A byte-identical mirror in `backend/src/modules/certification/services/eligibility.service.ts` keeps the legacy and Mongoose backends in lockstep; assert scripts under `__checks__/` fail CI if they diverge.
- **Outcome precedence is load-bearing.** `insufficient_evidence > not_eligible > eligible` — a topic that was never tested is never reported as failed. This is the single most important correctness property of the engine, and it is the property most likely to be regressed by a careless future change. It is documented and tested.
- **Fire-and-forget at every evaluation creation site, never blocking the request.** Worksheet submission is the user's hot path; a cert-engine failure must never fail a submission. Errors are logged, the request succeeds. The 3 trigger sites are wired at `routes/evaluation.ts:411`, `:1046`, and `routes/students.ts:549`.
- **Optimistic concurrency on the cert row.** `updateCertificationIfVersion(id, expectedVersion, ...)` returns `null` on mismatch. The admin review endpoint surfaces this as `409 Concurrent modification`. Without it, two admins clicking "Revoke" at the same time would silently lose one decision.
- **`review_needed` is a one-way door for the engine — only admins resolve it.** The engine never flips `active → revoked` (that would silently strip a child's cert). It flips `active → review_needed` if new evidence falls below threshold, and an admin then explicitly confirms or revokes. The transition log goes to the in-app logbook.
- **Admin notifications are observability, not a hard gate.** When a cert transitions `active → review_needed`, two parallel fire-and-forget side-effects fire (in-app logbook entry + email to in-scope admins). Both wrapped in `.catch()` — failure of either never blocks the cert transition.

### Frontend surfaces I added

- **`CertificationReviewPanel.tsx`** — admin action queue. Status filter (`review_needed` ↔ `All`), `Confirm`/`Revoke` per row, an accessible revoke modal (Esc/click-outside/focus-on-open/required-reason textarea), success toast auto-clears, and a `useEffect` keyed on `currentUser.role` that clears local state on role-switch (this is the gap5 guard, defensive against the demo role-switcher; see Gap 5 / Idea 5 for why it's incomplete).
- **`CertificationHistoryCard.tsx`** — per-student cert history shown on the student profile. One card per `(classNumber, level)` bucket. Fetches `GET /api/certifications?studentId=...`.
- **Sidebar entry + panel routing** — `Layout.tsx` adds "Certification Reviews" under `SUPERADMIN` and `ADMIN` only, matching the backend allowlist. `PanelViews.tsx` mounts the panel when `activePanel === 'certification_reviews'`. State-driven routing — a volunteer cannot reach the panel via URL.

### Evidence (how to verify)

- `npm run lint` is clean (backend `tsc --noEmit` + frontend `tsc --noEmit`) — no new type errors.
- `npx tsx backend/src/scripts/demo-cert.ts --reset` seeds 5 Class 4 students and produces the canonical 3 outcomes (1 active, 1 not_eligible with no row, 2 review_needed on different topics).
- `curl -H "Authorization: Bearer <superadmin jwt>" "http://localhost:3000/api/certifications?status=review_needed"` returns the 2 review_needed rows.
- `__checks__/certification.check.ts` and `__checks__/certification-list.check.ts` are runnable assert scripts with zero external deps; both print `N passed, 0 failed`.
- Live race test: two parallel `POST /api/certification/review/:id` with the same `id` but different `decision` values → one succeeds, the other gets `409 Concurrent modification`.

### Integration with the upstream route split

The cert engine was originally written against the monolithic `backend/src/index.ts`. Upstream then split that file into 17 route files. I integrated the cert engine into the new structure in a single commit:
- Registered the new `registerCertificationRoutes(app)` in `index.ts`.
- Added the fire-and-forget `runCertificationEligibility(student)` trigger at all 3 `addEvaluationReport` sites in the new route files.
- Adapted my types and `DBStore` accessors (`Certification`, `CompetencyRequirement`, `MasteryLevel`, `CertificationStatus` + 7 accessor methods including `updateCertificationIfVersion` and `getLatestConceptMastery`) to the post-split `db.ts` shape.
- Verified the demo flow end-to-end against MongoDB Atlas (the data does not leak to git — cert rows live in Atlas only).

### Design rationale

`backend/src/modules/certification/README.md` (326 lines) is the source-of-truth for this module — outcome precedence, mastery comparator, idempotency key, re-evaluation trigger, admin review state machine, analytics contract, race-handling, notifications, and deferred items. Anyone touching this module in the future should start there.