# Onboarding Document — Swasti

## 1. What is FLN?

FLN stands for Foundational Literacy and Numeracy — the basic ability to read with understanding and do simple arithmetic, which every child needs before the rest of school can really land for them. From the current repository and documentation, the implemented scope appears focused on numeracy — the README states this explicitly ("Current build scope: Mathematics only") — so nothing here teaches or tests reading yet, even though the name promises both.

The problem it's responding to is a scale problem: India has a huge number of children in school, but a large share of them reach the upper primary grades without being able to do grade-level arithmetic. Once a child falls behind on this foundation, every subject stacked on top of it gets harder, and the gap tends to widen rather than close on its own. NEP 2020 and the NIPUN Bharat mission both treat closing this gap by the end of Grade 3 as a national priority.

What this project actually builds is a way for a teacher to find out, cheaply and repeatedly, exactly where a child's numeracy actually stands — not just pass/fail against their grade, but which specific concept is missing — and to keep re-testing until the child clears it. The paper-based test plus scan-and-auto-grade loop exists specifically so this can happen at the scale of a real government classroom, not just in a research pilot.

## 2. What do you understand by FLN (as a system)?

There are four roles that matter: **students** (the ones being assessed), **teachers** (who run the classroom loop — generate papers, distribute them, scan results), **volunteers** (who seem to support teachers on specific assigned schools), and **admins/superadmins**, who sit above individual schools at block/district/state level and manage the geographic hierarchy and oversight.

The core entities are **schools** (which sit inside a state → district → block hierarchy), **students** (each with a profile tracking their current level and history), **classes** (grouped by classGroup, e.g. "Class 1"), **worksheets/papers** (generated per student or per class), and **certifications** (issued when a student clears the FLN bar for their grade).

Data flow, as I understand it end to end:
1. A teacher generates a paper — either a standard one (no student history yet) or a personalized one drawn from the student's current level.
2. The paper is printed, given to the student, and completed on paper.
3. The teacher scans the completed sheet.
4. An OCR/vision pipeline reads the handwriting and an evaluation pipeline compares it against expected answers.
5. The system decides pass/fail deterministically (never an LLM's own judgment) and either certifies the student or diagnoses which lower level they should be re-tested on.
6. The student's profile updates, and the cycle repeats.

The part I found genuinely interesting is that the "level" a student is placed at isn't just their grade — it's one of up to 109 fine-grained curriculum levels, and the project is moving toward a model where these levels have multiple valid prerequisite paths (a DAG, not a tree), so two students who get the same score wrong can be diagnosed differently depending on *which* questions they got wrong.

## 3. Current State of the Repository — What Has Been Done So Far

**Tech stack:**
- `frontend/` — React 19 + Vite + Tailwind, talks only to `backend/`.
- `backend/` — Node.js + Express + TypeScript. Uses the **native `mongodb` driver (v6.12)**, not Mongoose — confirmed there's no `mongoose` dependency in `backend/package.json` at all, and `backend/src/db.ts` imports `MongoClient` directly from `mongodb`. It falls back to a local `backend/data/db.json` file if `MONGODB_URI` is unset.
- `backend/fln-backend` — a second, separate plain-JS backend workspace just for worksheet-specific functionality.
- `ai-services/` — a Python pipeline (Groq LLM calls, invoked as a subprocess by `backend/`) that does OCR comparison, evaluation, and report generation.
- Auth: JWT-based (`backend/src/auth.ts`), with role-based checks scattered per-route rather than centralized middleware in most places I looked.
- Aadhaar handling has its own dedicated module (`backend/src/modules/vault/`) that tokenizes the number and never stores or exposes it in plaintext, with its own integration test suite and an at-rest audit script.

**Implemented features I could actually verify by reading code, not just docs:**
- Role-based dashboards for teacher/volunteer/school/admin (`frontend/src/components/dashboards/`), including empty-state cards and skeleton loaders (`EmptyStateCard.tsx`, `DashboardSkeleton.tsx`, `RosterSkeleton.tsx` all exist under `frontend/src/components/ui/`).
- A working Support Ticket + Activity Logbook flow: `TicketModal` and `LogbookModal` are both imported and wired up in `frontend/src/components/Layout.tsx` (lines 11–12, and rendered around lines 808–818), backed by real `/api/tickets` and `/api/logbook` routes.
- Question authoring as a separate, intent-based model (`generationIntent`) from the legacy hardcoded generators, with images stored as ids referencing files under `frontend/public/assets/svg/questions/` rather than as blobs in Mongo.
- Balvatika (the "year before Class 1") has 29 curriculum levels fully authored and seeded in the database, per `docs/question-authoring-and-assets.md` and the README's build-order note.

**Explicitly NOT built yet (per the README and docs, and confirmed by reading the referenced files):**
- Nothing in `paperGenerator.ts` or `levelGenerator.ts` actually consumes the new `generationIntent` authoring model yet — so the 29 seeded Balvatika levels can't be turned into an actual worksheet end-to-end today (tracked as issue #486).
- The prerequisite DAG / half-split backward-mapping described in the README's "Where This Is Headed" section is design intent, not implemented logic — it depends on topological-sort work that hasn't landed.

## 4. Gaps Observed in the Code

**Gap 1 — Documentation describes an architecture the backend doesn't use**
- *Where:* `docs/backend-modules-reference.md` (the whole "Module: State/District/Block" section) describes Mongoose schemas (`models/state.model.ts` with Mongoose field definitions) as the current architecture.
- *What:* `backend/package.json` has no `mongoose` dependency at all, and `backend/src/db.ts` (top of the file) imports and uses `MongoClient` from the native `mongodb` driver directly, with a JSON-file fallback for local dev. The layered `Route → Controller → Service → Repository → Model` structure the doc describes doesn't match what's under `backend/src/` either (routes and business logic mostly live together under `backend/src/routes/*.ts`).
- *Why it matters:* a new contributor reading this doc first (which is exactly what onboarding is supposed to encourage) would go looking for Mongoose model files that don't exist, or worse, write new code assuming Mongoose semantics (like `.save()` or schema validation) against a driver that doesn't provide them.

**Gap 2 — `docs/intern-dashboard-tasks.md` is stale for two of its four "open" tasks**
- *Where:* `docs/intern-dashboard-tasks.md`, Task 2 ("Standardize Role Dashboard Empty-States and Skeleton Loaders") and Task 4 ("Connect Logbook & Support Ticketing Modals in Navigation").
- *What:* Task 2 lists `DashboardSkeleton.tsx`, `RosterSkeleton.tsx`, and `EmptyStateCard.tsx` as files still to be created — all three already exist under `frontend/src/components/ui/` and are imported into `TeacherDashboard.tsx`. Task 4 describes the Ticket/Logbook nav buttons as "currently unlinked or placeholder stubs" — but `frontend/src/components/Layout.tsx` already imports and fully wires both `TicketModal` and `LogbookModal` with working open/close state and role-scoped visibility.
- *Why it matters:* this doc is exactly what a new intern is pointed at to pick up "intern-ready" work. As written, it risks someone spending real time re-implementing something that already shipped, and it undersells the two tasks (1 and 3) that are genuinely still open.

**Gap 3 — Task 3's own spec doesn't match the current component split**
- *Where:* `docs/intern-dashboard-tasks.md`, Task 3 ("Session-Persisted Filters for Class and School Rosters"), which names `selectedSchool`, `selectedClass`, `selectedSection` state inside `frontend/src/components/panels/StudentListPanel.tsx`.
- *What:* none of those three state variables exist in `StudentListPanel.tsx` — that file only holds registration/CSV-import form state. The actual class filter a teacher interacts with is `activeClassFilter` in `frontend/src/components/dashboards/TeacherDashboard.tsx` (previously line 40), and there is no school-level or section-level filter anywhere in that flow — a teacher's dashboard is already scoped to their one school.
- *Why it matters:* someone following the doc literally would edit the wrong file and look for filter state that was never there. The underlying user complaint (losing your place after drilling into a student) is real, though — it was just filed against the wrong component.

**Gap 4 — No validation on ticket creation**
- *Where:* `backend/src/routes/tickets.ts`, `POST /api/tickets/create`.
- *What:* `subject` and `description` are pulled straight off `req.body` and written into the ticket with no check that they're non-empty strings. Only the `type === 'curriculum'` role check is validated; a request with a missing or empty `subject`/`description` still creates a ticket.
- *Why it matters:* superadmins reviewing tickets (`GET /api/tickets` for `UserRole.SUPERADMIN`) could end up with blank or junk entries mixed into real feedback, with no server-side signal that something was malformed on submission.

**Gap 5 — A fully built remedial-intervention feature is never called from the frontend**
- *Where:* `backend/src/routes/interventions.ts` (all five routes: `POST /api/interventions`, `GET /api/interventions`, `GET /api/interventions/:id`, `POST /api/interventions/:id/promote`) versus `frontend/src/` as a whole.
- *What:* the backend already supports a complete remedial workflow — a teacher can record an intervention against a student's weak competencies with a strategy type/description/duration, the system tracks its outcome, and a successful intervention can be promoted into a `BestPractice` record other teachers can browse (`isPromoted`, `viewCount` fields already modeled). `grep -rn "api/interventions" frontend/src` returns zero matches — nothing in the UI ever calls it. The only frontend component with "Intervention" in its name, `QuestionInterventionPanel.tsx`, is unrelated — it's a superadmin authoring tool for question-generation logic, not this feature; the shared word is a naming coincidence I nearly mistook for the real thing.
- *Why it matters:* this is a substantial, already-designed feature (competency tracking, outcome tracking, a peer best-practices repository) sitting completely unused because nobody built the screens for it. A teacher has no way today to actually log or see a remedial intervention, even though the data model and API fully support it.

**Gap 6 — The AI/OCR pipeline's answer comparison is less forgiving than the backend's, for the same kind of input**
- *Where:* `ai-services/scripts/1_compare_answers.py`, line 92: `is_correct = str(student_ans["answer"]).strip() == str(question["answer"]).strip()`. Compare with `backend/src/answerMatching.ts`, whose whole `normalizeAnswer`/`asNumber` design exists specifically because, as its own comment says, "the inputs are OCR'd handwriting, so surface-level variation is the norm rather than the exception" (case differences, "07" vs "7", trailing punctuation, etc.).
- *What:* the standalone `ai-services` pipeline's comparator does a bare `.strip()` equality check — no case folding, no numeric normalization. A student who correctly wrote "07" against an expected "7", or "Yes" against an expected "yes", would be marked wrong here even though the equivalent backend comparator was deliberately built to treat those as equal.
- *Why it matters:* this feeds `2_evaluate_child.py`'s PASS/FAIL threshold and eventually the level placement a child gets. A false "wrong" from formatting noise, not an actual misconception, could push a correctly-performing student into unnecessary remediation — which is precisely the failure mode `answerMatching.ts`'s own comment warns about, just in the other pipeline.

## 5. Ideas for the Project

*Ideas 1–6 below are proposals for possible future contributions, grounded in the gaps above — none of them are part of the PR I'm actually submitting with this document. My actual contribution is the single change described in Section 6.*

**Idea 1 — Build the frontend for the remedial-intervention feature that already exists (grounded in Gap 5)**
- *What:* add teacher-facing screens for the `/api/interventions` endpoints that already work: a form to log a remedial intervention against a student's weak competencies (`strategyType`, `strategyDescription`, `duration`), a list/detail view of a teacher's own interventions, and a way to browse promoted `BestPractice` entries from other teachers.
- *Why:* this isn't a new feature to design — it's a finished backend capability with zero UI, which is a bigger and cheaper win than inventing something new: no new data model, no new business logic, no discussion needed with maintainers about scoring or certification, since none of that is touched.
- *How:* a `frontend/src/components/panels/InterventionPanel.tsx` (following the existing panel pattern, e.g. `TicketModal`/`LogbookModal` in `Layout.tsx` for how a modal/panel gets wired into navigation) that calls `POST /api/interventions` to log one, `GET /api/interventions` to list the teacher's own, and surfaces the "promote to Best Practice" action for interventions whose `outcome.improved` is true — the backend already gates that check (`backend/src/routes/interventions.ts`, the `/promote` route), so the frontend only needs to call it, not re-validate it.

**Idea 2 — Reconcile `docs/backend-modules-reference.md` with the actual driver**
- *What:* either rewrite the doc's architecture section to describe the real native-`mongodb` + `data/db.json`-fallback setup, or clearly mark it as an aspirational/legacy doc if a Mongoose migration is still intended.
- *Why:* stops new contributors from designing against an architecture that isn't there (directly addresses Gap 1).
- *How:* a short PR against `docs/backend-modules-reference.md` replacing the Mongoose schema blocks with the actual collection shape read from `backend/src/db.ts`, and a one-line note at the top stating which driver is authoritative.

**Idea 3 — Add a status line to each task in `docs/intern-dashboard-tasks.md`**
- *What:* before scoping or re-publishing intern task docs, add a `Status: Open / In Progress / Done` line per task, checked against the actual codebase at doc-review time.
- *Why:* directly prevents Gap 2 — someone picking "Task 2" or "Task 4" today would immediately see they're done and move to what's actually open.
- *How:* small doc edit; could optionally be enforced by a lightweight script that greps for the files each task says it will create and warns in CI if they already exist.

**Idea 4 — Correct Task 3's target file and implement the persistence (see Section 6)**
- *What:* update the task description to point at `TeacherDashboard.tsx`'s `activeClassFilter` instead of the non-existent `StudentListPanel.tsx` state, and close the loop by actually persisting it.
- *Why:* the underlying UX complaint (filters reset when a teacher navigates back from a student) is real and worth fixing even though the original file reference was wrong.
- *How:* done as my contribution below — `sessionStorage`, scoped by teacher id.

**Idea 5 — Validate ticket fields server-side**
- *What:* reject `POST /api/tickets/create` with a 400 if `subject` or `description` is missing or empty after trimming, and validate `type` is one of the known enum values rather than only special-casing `'curriculum'`.
- *Why:* keeps the superadmin ticket queue (Gap 4) free of junk entries and gives the frontend a clear error to show instead of silently succeeding.
- *How:* a few lines at the top of the route handler in `backend/src/routes/tickets.ts`, consistent with how other routes in the file already return `400`/`403` JSON error bodies.

**Idea 6 — Bring `answerMatching.ts`'s normalization into the Python pipeline**
- *What:* port the same normalization rules (case folding, numeric equivalence like "07" == "7", trailing punctuation) into `ai-services/scripts/1_compare_answers.py`'s comparison step, rather than a bare `.strip()` equality.
- *Why:* removes the inconsistency in Gap 6 so a child's answer isn't graded differently depending on which pipeline happens to process their sheet.
- *How:* either reimplement the same small set of rules in Python directly in `1_compare_answers.py`, or (better for long-term consistency) expose `answerMatching.ts`'s logic as a tiny shared JSON-driven rule set both the TypeScript and Python sides read from, so the two never drift again.

## 6. Your Contribution

I implemented the real, still-open half of Task 3 from `docs/intern-dashboard-tasks.md` — session-persisted class filters — against the file where the filter state actually lives (`frontend/src/components/dashboards/TeacherDashboard.tsx`), since the task's original file reference (`StudentListPanel.tsx`) doesn't hold this state (Gap 3).

**What I changed:**
- `activeClassFilter` now initializes from `sessionStorage` (key `fln_roster_filter`) instead of always defaulting to `null` ("All Students"), so returning from a student's report keeps the teacher on the class tab they were viewing.
- The stored value is scoped by `teacherId`, so if a different teacher logs in within the same browser session, the old filter isn't silently applied to their roster.
- A `useEffect` keeps `sessionStorage` in sync every time the teacher switches tabs.
- Both the read and the write are wrapped in `try/catch` so a browser with `sessionStorage` disabled (private browsing, storage quota) degrades gracefully back to the old default behavior instead of throwing.

This is a small, self-contained change scoped to one file, in the spirit of the "one feature or fix per PR" contribution guideline, and it doesn't touch any scoring, level-calculation, or certification logic — consistent with the "No Business Logic on Frontend" rule in the intern task doc.

Idea 1 in Section 5 (the interventions UI) is deliberately left as a proposal rather than folded into this PR — it's a larger, multi-screen piece of work that deserves its own scoped issue and its own PR, not bundled in with an unrelated one-line filter fix.
