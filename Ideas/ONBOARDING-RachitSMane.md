# Onboarding Document — Rachit S. Mane

Everything below is written from reading this repository at commit `ae51962` on the
`educational-reasoning` branch (branched from `origin/main` at `5cd3ecb`). Where I
could not verify something by running it, I say so explicitly rather than assuming.

---

## 1. What is FLN?

FLN stands for **Foundational Literacy and Numeracy**. In the Indian school-education
context it refers to the baseline competencies a child is expected to hold before
subject learning can meaningfully begin — recognising numerals, counting with
cardinality, comparing quantities, and the early arithmetic that everything later
depends on. This repository implements the **numeracy (Mathematics) half** of that
idea, for children roughly in the preschool-to-Class-4 band.

The problem it addresses is a specific one, and it is not "students need more
worksheets". It is that **a classroom is not homogeneous**. In a single Class 3 room
one child may still be building one-to-one correspondence while another is
comfortable with two-digit regrouping. A teacher handed one uniform worksheet for
the whole class necessarily teaches over the heads of some children and under the
feet of others. Teachers in the schools this targets are also frequently
multi-grade and time-poor, so "just differentiate manually" is not a real option.

The platform's answer is to make differentiation mechanical rather than manual:

1. **Assess** each child individually with a diagnostic paper and place them at a
   precise point on a shared national competency ladder.
2. **Generate** printable, level-personalised worksheets for that specific child.
3. **Ingest** the completed paper answers back — the sheets are worked on paper,
   because the children do not have devices.
4. **Evaluate** the answers and move the child's placement accordingly.
5. **Roll up** the resulting data through the administrative hierarchy so that
   block, district and state officials can see where learning is actually stalling.

The paper-first design is the important constraint. The child never touches a
screen; the teacher and the system do. That is what forces the PDF-generation and
scanning machinery that dominates a lot of this codebase.

---

## 2. What do you understand by FLN as a system?

### The people

`backend/src/db.ts:55-63` defines exactly seven roles, and they map onto India's
education administration hierarchy rather than a generic app's permission tiers:

```
superadmin → admin (state) → district_admin → block_admin → school → teacher
                                                                   → volunteer
```

- **Students** are the subjects, not users. They have no login. Everything about
  them is entered on their behalf. (`Student`, `db.ts:100`)
- **Teachers** and **volunteers** are the operators at the sharp end — they trigger
  diagnostics, print worksheets, and scan answers back in. A volunteer differs from
  a teacher in being scoped to a list of `assignedSchools` rather than one
  `schoolId` (`auth.ts:45-49`).
- **School / block / district / state admins and superadmin** consume rollups. They
  do not do data entry; they read aggregates.

### The entities

From the interfaces in `db.ts`: `User`, `School`, `ClassGroup`, `Student`,
`Question`, `Worksheet`, `LevelWorksheet`, `DiagnosticAnswerKey`, `QuestionBankEntry`,
`AnswerSubmission`, `EvaluationReport`, plus governance objects — `Ticket`,
`LogEntry`, `Announcement`, `Intervention`, `BestPractice`.

The spine of the whole system, though, is not any of those. It is
`backend/src/config/curriculumMap.ts`: a **93-level curriculum**, where each level
carries an immutable `conceptId` in the range `S1.1`–`S7.18`, a `levelTitle`, a
`strand` (Number Sense, Number Operations, Shapes & Spatial, Measurement, Patterns,
Money, Calendar & Time, Fractions, Data Handling, Pre-Number Foundations), a
`stage` (1–7) and an `ageGroup`. The file's own comment is the design intent:

> "Re-ordering levels in the curriculum requires ONLY changing the levelNumber
> assignment here."

That is why `conceptId` and `levelNumber` are deliberately separate things — the
level number is a position in an ordering that may change; the concept ID is the
identity of the skill itself, which does not. This distinction matters a great deal
in Section 6.

### How data moves

```
Student onboarded (no level history)
   → POST /api/students/:id/diagnostic        (index.ts:726)
       Puppeteer builds a printable paper  ─── fails ──→ generateQuestionsForLevel()
   → teacher prints, child writes on paper
   → answers ingested: DiagnosticWorkflow form, or the ICR scanner (photo/PDF → OCR)
   → POST /api/students/:id/diagnostic/submit (index.ts:821)
       Python pipeline in ai-services/  ─── fails ──→ Gemini  ─── no key ──→ deterministic fallback
       → score, recommendedLevel, subLevel, narrative, conceptMastery
       → student.currentLevel / targetLevel / levelHistory updated
       → EvaluationReport persisted
   → dashboards + rollups read the reports
```

Two structural things stand out. First, **every AI dependency has a non-AI
fallback** — the Python pipeline falls back to Gemini, Gemini falls back to
deterministic generation, Puppeteer falls back to the level generator. The system
is designed to stay up when its cleverest parts are unavailable. Second,
**placement is a ladder walk, not a score**: `subLevel` is 0 = Mastery, 1 = Easier,
2 = Remedial, derived from how the child did on questions at their own recommended
level specifically (`index.ts:946-963`), not from the overall percentage.

---

## 3. Current State of the Repository — What Has Been Done So Far

### Stack and layout

An npm-workspaces monorepo. The root `package.json` declares three workspaces:
`frontend`, `backend`, and `backend/fln-backend`.

| Area | Technology |
|---|---|
| Frontend | React 19, Vite 6, Tailwind, react-router, TanStack Query |
| Backend | Node + Express, TypeScript, bundled with esbuild to `dist/server.cjs` |
| Data | MongoDB (`mongodb` driver) with a JSON-file fallback store |
| Auth | JWT (HS256, `jsonwebtoken`) + bcrypt password hashes |
| AI | Google Gemini (`backend/src/gemini.ts`) + a Python pipeline in `ai-services/` |
| PDF | Puppeteer / headless Chrome (`paperGenerator.ts`, `browser.ts`) |
| OCR | EasyOCR plus optional cloud providers, driven from `/api/icr/*` |

### Authentication — genuinely implemented

This is worth stating plainly because the repo's own `CLAUDE.md` describes an
older, broken model that no longer matches the code. As it stands today:

- `POST /api/auth/login` looks the user up, `bcrypt.compare`s the submitted
  password, and issues a signed JWT (`index.ts:72-116`). The route is rate-limited
  by `authRateLimiter` (`index.ts:44`, applied at `:72`).
- `getAuthUser()` (`auth.ts:16-31`) verifies the signature on every request and
  returns `null` on an invalid or expired token. Its comment is explicit:
  *"There is deliberately NO role synthesis from the email/prefix."*
- `canAccessStudent()` (`auth.ts:37-52`) scopes by-ID student operations, so a
  teacher cannot reach another school's student by guessing IDs.
- `sanitizeUser()` strips `passwordHash` before anything is returned to a client.

The frontend side stores the token in `localStorage` and attaches it in
`apiFetch()`, clearing it and firing an `fln_unauthorized` event on a 401
(`frontend/src/services/apiClient.ts`).

### Backend

`backend/src/index.ts` is a single **3,681-line** file registering **55 routes** —
auth, students, schools, classes, diagnostics, worksheets, ICR/OCR, announcements,
stats, tickets, interventions, best practices. Two areas have been extracted into
modules (`routes/announcements.ts`, `routes/stats.ts`); the rest has not.

Question generation is layered and, unusually for this codebase, quite clean:

```
generateQuestionsForLevel(level)          levelGenerator.ts:11
  └─ QuestionService.getQuestionsByLevel  services/questionService.ts:11
       └─ generateQuestionsByConcept      utils/conceptQuestionGenerator.ts:13
            → emits Question objects carrying conceptId, source_level, topic=strand
```

### Frontend

23 components. The largest are `RoleDashboards.tsx` (3,149 lines),
`PanelViews.tsx` (1,770) and `SuperAdminExecutiveDashboard.tsx` (1,769). Role
dashboards, the diagnostic workflow, the ICR scanner and its two-stage variant,
assessment calendar, and the landing view are all present and wired to the real
API through `apiFetch`.

### AI services

`ai-services/` holds a Python pipeline (`run_pipeline.py`, `scripts/0..3`,
`personalized_evaluation_pipeline.py`), prompt templates, per-class syllabus JSON
and a question bank. The backend shells out to it with `execFileSync` and reads
back JSON evaluation output plus a text report card.

### Research

`Research/` contains the curriculum design work the framework is built on —
including `fln_level_networks.md`, which I make heavy use of in Section 6.

### Development and deployment

`npm run dev:backend` / `dev:frontend`; `npm run build` builds Vite then esbuild;
in production the backend serves `frontend/dist` and in development it mounts Vite
middleware (`index.ts:3653-3673`). Configuration is via `.env` — `MONGODB_URI`,
`JWT_SECRET`, `GEMINI_API_KEY`, `CHROME_EXECUTABLE_PATH`, `AI_SERVICES_DIR`.

**`npm run lint` is `tsc --noEmit` and nothing else, and there is no test suite** —
no `test` script in any of the three `package.json` files, and no `*.test.ts` or
`*.spec.ts` anywhere outside `node_modules`. A green lint proves the types compile
and says nothing about behaviour. I treated that as a hard constraint throughout my
own work.

---

## 4. Gaps Observed in the Code

Six gaps, each one I can point at and justify. I have deliberately kept this list
short — these are the ones I would actually argue for in review.

### Gap 1 — Non-null assertions on the Mongo handle crash the whole process when running without MongoDB

**Where:** `backend/src/db.ts:969-983` (`addStudent` at :970, `updateStudent` at
:976-977); the same `this.mongoDb!` pattern recurs in neighbouring mutators —
`:960`, `:966`, `:986`.

```ts
async updateStudent(studentId: string, updates: Partial<Student>) {
  await this.mongoDb!.collection('students').updateOne({ id: studentId }, { $set: updates });
```

**What:** The class supports a file-based fallback and announces it at boot
("No MongoDB — falling back to file-based DB", `db.ts:551`), but these methods
assert the Mongo handle is non-null. Without Mongo, `this.mongoDb` is `null` and
the call throws `TypeError: Cannot read properties of null (reading 'collection')`.
The call site (`index.ts:975`) sits in an `async` Express handler with no outer
`try/catch` — the handler's inner `try` blocks wrap only the Python/Gemini pipeline
— and Express 4 does not catch a rejected promise returned from an async handler.
There is also no global error-handling middleware. So the rejection is never turned
into a 500 response; it surfaces as an unhandled rejection and **the Node process
exits.**

**Why it matters:** This is the most severe issue I found, and I hit it for real. I
ran the backend and posted a genuine diagnostic submission; the server died
outright at `index.ts:975 → db.ts:976`, taking down every other user's session.
The fallback path advertises support it does not have, so the failure mode is
"whole service dies" rather than "one request fails". It also makes the entire
diagnostic-submission flow untestable without a live MongoDB, which is exactly what
blocked my own end-to-end testing in Section 6. The non-null assertion is what hid
this from the type-checker: TypeScript would have flagged it otherwise.

### Gap 2 — The shared demo password authenticates every account, including accounts with their own password

**Where:** `backend/src/index.ts:96-99`

```ts
const targetHash = user.passwordHash || SEED_DEMO_PASSWORD_HASH;
let passwordOk = await bcrypt.compare(password, targetHash);
if (!passwordOk && user.passwordHash) {
  passwordOk = await bcrypt.compare(password, SEED_DEMO_PASSWORD_HASH);
}
```

**What:** The second comparison is the problem. If a user has set their own
password and it does not match, the code tries the **shared seed demo password**
as a fallback and accepts it. Every account in the system therefore has a second,
universal, publicly-known credential. There is no `NODE_ENV` guard and no check
restricting this to seeded accounts.

**Why it matters:** It defeats the rest of the authentication work, which is
otherwise sound. Anyone who knows the shared password — it is in `README.md` and in
`backend/.env.example` — can sign in as any user, including `superadmin`, and the
role scoping in `auth.ts` then correctly grants them everything a superadmin may
do. Given the system holds children's names, ages, guardian contact details and
masked Aadhaar identifiers, this is a live data-protection exposure, not a
theoretical one. The fix is small: drop the fallback comparison, or gate it to
users who still carry the seed hash and only outside production.

### Gap 3 — Over 400 lines of `levelGenerator.ts` are unreachable

**Where:** `backend/src/levelGenerator.ts:11-15`, and the `switch (level)` block
spanning lines 61–476.

```ts
export function generateQuestionsForLevel(level: number, subLevel: number): Question[] {
  if (CURRICULUM_MAPPING[level]) {
    return QuestionService.getQuestionsByLevel(level, subLevel);
  }
  // ...the per-level question builders, switch (level) at :61-476, sit below here
```

**What:** `CURRICULUM_MAPPING` is populated for **all 93 levels**, so the guard is
always true and the function always returns on line 13. Every `case` below it is
dead. I confirmed this by calling the function directly: `generateQuestionsForLevel(26, 0)`
returns `[Concept S3.9] Level 26 Practice Question #1`, produced by the concept
generator, not the `case 26:` branch's "Carry Addition: Solve …".

**Why it matters:** It is an active trap, not merely clutter. The code reads as
live — it has topic assignments, difficulty tuning, sub-level range adjustment —
so a maintainer editing `case 26:` to fix a Class-3 question will change nothing
and have no signal that they changed nothing. There is no test suite to catch it.
I know this concretely because the first version of my own feature added metadata
into that dead switch and it silently never executed. Deleting the block, or
inverting the guard so the legacy path is reachable for unmapped levels only, would
remove the trap.

### Gap 4 — Puppeteer-generated diagnostic questions carry a fabricated `source_level` that collides with real level numbers

**Where:** `backend/src/paperGenerator.ts:86`, `:102`, `:192`, `:205`

```ts
source_level: classNumber * 10
```

**What:** Questions extracted from the generated PDF's `masterJson` are stamped
with `classNumber * 10` — 10, 20, 30, 40 — as their level, and carry no
`conceptId`. Those numbers are not the levels the questions came from; they are a
placeholder. They are also **valid level numbers in `CURRICULUM_MAPPING`**, each
naming a real and unrelated concept (`curriculumMap.ts:27,39,51,61`):

| Placeholder | Real level in `CURRICULUM_MAPPING` | Concept |
|---|---|---|
| 10 | Classification (Increasing Complexity) | S2.3 |
| 20 | Numeral Comparison (Object-Mediated) | S3.3 |
| 30 | Counting Objects to 20 | S4.3 |
| 40 | Ordinal Positions (1st-10th) | S4.13 |

**Why it matters:** Any code that reads `source_level` as a curriculum position
will silently attribute these questions to an unrelated concept, and nothing
distinguishes a placeholder from a genuine level. The sub-level calculation at
`index.ts:947` filters questions by `source_level === recommendedLevel`, so
placement precision on this path depends on a value that is not real. I verified
the behaviour live: a Class-3 student's generated paper came back with every
question at `source_level: 30`. This is a data-integrity problem at the source, and
it is why my own feature deliberately produces nothing on this path rather than
guessing (Section 6).

### Gap 5 — A dead configuration module carries a second, divergent JWT secret fallback

**Where:** `backend/src/config/environment.ts:10-16` versus `backend/src/auth.ts:6`

```ts
// config/environment.ts  (imported by nothing)
port:      parseInt(process.env.PORT_NEW || '5000', 10),
jwtSecret: process.env.JWT_SECRET || 'fallback_secret_change_in_prod',

// auth.ts  (the one actually used)
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
```

**What:** `config/environment.ts` is imported nowhere in `backend/src` — I grepped
the whole tree. It defines a different default secret and reads a different port
variable (`PORT_NEW`, which nothing sets). Only `auth.ts` is live, and only it
carries the production warning when the secret is unset.

**Why it matters:** Two plausible-looking config modules with different defaults is
how token-verification bugs get introduced. A developer wiring up
`config/environment.ts` — it is the more conventional-looking of the two — would
sign tokens with one fallback secret while `getAuthUser` verifies with another,
and every request would 401 for reasons that are hard to trace. The dead module
also silently loses the production warning. It should be deleted or made the single
source, not left as a decoy.

### Gap 6 — The full user collection is held in memory and linearly scanned on every authenticated request

**Where:** `backend/src/db.ts:532-533` and `db.ts:601-604`

```ts
// at boot
this.data.users = await db.collection<User>('users').find({}, { projection: { password: 0 } }).toArray();

// on every request, via getAuthUser()
getUserSync(email: string): User | null {
  return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}
```

**What:** Every user document is loaded into process memory at startup, and
`getAuthUser()` resolves the caller with an `Array.prototype.find` plus a
`toLowerCase()` per element on every single authenticated request.

**Why it matters:** It is O(n) per request against a table sized by the national
hierarchy — an existing comment at `index.ts:89` references 6,449 users in the
previous login implementation, which gives a sense of the scale involved, and this
system is intended to reach state and national deployment. Two further
consequences: the snapshot is taken once at boot, so a user created or
role-changed afterwards is invisible to authentication until restart; and every
Node process holds a full copy of the user table, so horizontal scaling multiplies
memory rather than sharing it. An indexed lookup exists immediately below
(`getUserByEmail`), but the synchronous path cannot use it because `getAuthUser` is
not async.

---

## 5. Ideas for the Project

Each idea addresses a gap above.

### Idea 1 — A database-access safety pass, starting with the null-handle crashes (Gap 1)

**What:** Remove the `this.mongoDb!` non-null assertions across `db.ts`, replacing
each with an explicit branch that uses the file store when Mongo is absent — the
pattern the read accessors already follow (`getEvaluationReports`, `db.ts:941-943`,
branches correctly). Add an Express error-handling middleware so a rejected handler
becomes a 500 rather than a process exit.

**Why:** It converts the single most severe failure mode from "service dies" to
"one request fails", and it makes the advertised file-based fallback actually
usable — which in turn makes the diagnostic flow testable without provisioning
MongoDB, unblocking everything in Idea 4.

**How:** Grep `db.ts` for `mongoDb!` and handle each occurrence; the read methods
supply the template. Then add a terminal `app.use((err, req, res, next) => …)` in
`index.ts`. TypeScript will point at every remaining unsafe site once the
assertions are gone, so the work is bounded and mechanical.

### Idea 2 — Delete the demo-password fallback and add a first-login password change (Gap 2)

**What:** Remove the second `bcrypt.compare` at `index.ts:96-99`. Add a
`mustChangePassword` flag on seeded users and an endpoint that lets a user set a
real password on first login.

**Why:** Demo convenience is currently implemented as a permanent universal
backdoor over real children's PII. The convenience can be preserved honestly —
seeded accounts keep the shared password until someone changes it — without
letting it override a password a user has deliberately set.

**How:** Delete the fallback branch. Add `mustChangePassword?: boolean` to `User`,
set it in `getSeedData()`, return it from `/api/auth/login`, and have the frontend
route to a change-password form when it is set. A `POST /api/auth/password`
endpoint that verifies the old password and stores a new bcrypt hash completes it.
Small and self-contained.

### Idea 3 — Make `conceptId` the mandatory identity on every generated question (Gaps 3 and 4)

**What:** Have every question-producing path stamp a real `conceptId`, and delete
the dead `switch` in `levelGenerator.ts`. Concretely: resolve the actual curriculum
level in `paperGenerator.ts` instead of writing `classNumber * 10`, and once every
path complies, make `conceptId` required on `Question` rather than optional.

**Why:** It removes the fabricated-level problem at its source, deletes 400+ lines
of code that cannot run, and gives every downstream consumer — placement, analytics
and the prerequisite feature I built — one trustworthy key. Today each consumer has
to defend itself against questions with no usable identity.

**How:** Incrementally. I already did one step of this on the Atlas/Class-2 path,
where the real level is in scope: `conceptId: CURRICULUM_MAPPING[lvl]?.conceptId`
(`db.ts:876`, `:891`). The `masterJson` path needs the level threaded through from
whatever selects the questions, which is the larger piece of work. Making the field
required is the final step and the compiler will enumerate every site that must
change.

### Idea 4 — A first test suite, seeded from the flows that already broke (Gap 1, and the absence of tests generally)

**What:** Add Vitest to both workspaces plus a `test` script, and write the first
tests against the pure, dependency-free logic that already exists: the prerequisite
graph resolver, `subLevel` computation, `canAccessStudent`, and the curriculum-map
invariants.

**Why:** There is no test suite at all, and `npm run lint` proves only that types
compile. Every gap in Section 4 is the kind a modest test would have caught — Gap 3
in particular is invisible precisely because nothing asserts what
`generateQuestionsForLevel` actually returns. Starting with pure functions avoids
needing MongoDB, so it can land before Idea 1.

**How:** `vitest` is a natural fit alongside Vite. Start with
`competencyPrerequisites.test.ts` asserting `validateConceptPrerequisites()`
returns `isValid: true` with 78 edges and no cycles — that is a real regression
guard on curriculum data. Then `auth.test.ts` for the role-scoping matrix. Then a
supertest-based route test once Idea 1 makes the file-store path survive a
mutation.

### Idea 5 — Collapse the duplicated configuration and load the authenticated user by index (Gaps 5 and 6)

**What:** Delete `backend/src/config/environment.ts`, or promote it to the single
config module that `auth.ts` and `index.ts` both read. Separately, make
`getAuthUser` async so it can use the indexed `getUserByEmail` instead of scanning
an in-memory array.

**Why:** One config module with one JWT fallback removes a whole class of
"tokens mysteriously fail to verify" bugs. The indexed lookup removes an O(n)
per-request scan, drops the boot-time full-table load, and makes newly created
users authenticate without a restart.

**How:** The config change is a deletion plus fixing any import. The auth change is
wider — `getAuthUser` is called in most of the 55 routes — so it is best done as
a mechanical pass adding `await`, ideally after Idea 4 provides a route-level
safety net. The JWT already carries `sub` and `role`, so a short-lived cache keyed
on the token is a viable intermediate step if the full change is too large to do
at once.

---

## 6. Your Contribution

My contribution is the **Educational Reasoning / Prerequisite Learning Path**
feature, on branch `educational-reasoning` (two commits ahead of `origin/main`).

### The problem it solves

When a child fails a diagnostic question, the existing evaluation tells the teacher
*what* went wrong — a score, a placement level, a narrative — but not *why*, and
not what to do on Monday morning. A child failing "Tens and Ones" may be failing it
because they have not secured counting-to-20 first. The curriculum knows that
relationship. The application did not use it.

### What I built

**A prerequisite graph keyed on curriculum concept identity.**
`backend/src/competencyPrerequisites.ts` holds 78 prerequisite edges over
`conceptId`s. I did not invent these relationships: they are transcribed from
`Research/fln_level_networks.md` Part 2, which already expresses the 93-level
framework as ten typed strand chains and states that "The Evaluation Engine should
consume the edge list". The file is **generated from that markdown, not hand-typed**,
and I verified the result by re-parsing the source independently and comparing.

The edge typing is the part I care most about getting right. The research document
distinguishes three relationship kinds and warns that conflating them "produces
false conclusions":

| Type | Meaning | Used? |
|---|---|---|
| `→` prereq | hard cognitive dependency | **yes — all 78** |
| `⇢` sequence | taught in this order; no inference permitted | **no — 20 excluded** |
| `∥` parallel | co-equal, no dependency | **no — 6 excluded** |

Only `→` edges are represented. I verified no sequence or parallel edge leaked in.

**Backend resolution.** In `POST /api/students/:id/diagnostic/submit`
(`index.ts:1004-1090`) the submitted answers are grouped by each question's
`conceptId`; a concept counts as failed only when the child got *none* of its
questions right; the failed concepts' transitive prerequisites are walked and
merged, with a prerequisite blocking two or more failed concepts promoted to
"high-priority foundations". IDs are rendered to human-readable titles through the
existing `CURRICULUM_MAPPING` — no second name table, and no raw `S4.5` reaches
the UI.

**The reasoning payload.** The result is attached to `EvaluationReport.reasoning`,
alongside the report's existing explanation, concept mastery and learning
progression — all populated from values the handler had already computed.

**Frontend.** `EducationalReasoning.tsx` renders the payload, and I wired it into
`DiagnosticWorkflow.tsx`, which is the component that actually receives the
backend-generated report. **The frontend performs no prerequisite computation** —
it renders what the backend sends and nothing more.

### The design decision I would defend in review

**The feature stays silent rather than guessing.** If a question has no
`conceptId`, it is skipped. If a failed concept has no prerequisite edge, no path
is produced. If nothing resolves, the `reasoning` field is omitted entirely and the
report renders exactly as it did before. There is no fuzzy matching, no
string-similarity fallback, and no level arithmetic anywhere in the resolution
path. A teacher acting on a fabricated prerequisite would be actively misled, which
is worse than showing nothing.

This is also why an earlier iteration of this feature was wrong and I rewrote it.
It keyed on competency *names* drawn from the older 59-level FLN Levels Structure
and bridged to the current framework by matching level titles. That bridge resolved
for only 3 of 93 levels, and it meant two different interpretations of the same
level number coexisted in the codebase. The current implementation removes that
layer entirely — `_buildCompetencies.ts`, `competencyGraph.ts`, `competencyLookup.ts`
and `competencyDependencies.ts` were deleted, a net removal of ~520 lines — and
uses `conceptId`, the identity the curriculum map already defines, as the single
source of truth.

I also fixed a build-breaking encoding problem I found along the way:
`EducationalReasoning.tsx` had been committed as UTF-16LE, which esbuild rejects
outright (`✘ [ERROR] Unexpected "\xff"`), and which made Git treat the file as
binary so no reviewer could read its diff. Re-encoding to UTF-8/LF was verified as
content-identical by SHA-256 comparison of the decoded text.

### What I verified, and what I could not

Verified by running it:

- `npm run lint` (tsc across both workspaces) and `npm run build` (Vite + esbuild)
  both pass with zero errors.
- `validateConceptPrerequisites()` passes at runtime: 78 edges across 68 of the 93
  concepts, **zero unknown concept IDs and zero cycles** — those two are the
  invariants the validator actually checks. I verified the absence of duplicate
  edges **separately**, by re-parsing the research document offline and diffing it
  against the generated table; that check is not part of the runtime validator.
- Resolution produces sensible chains — e.g. `S4.5 "Tens and Ones"` resolves back
  through Counting Small Sets → Counting to 5 → Counting 6-10 → Numeral Recognition
  → Numeral-Quantity Correspondence → Numeral Sequencing → Counting Objects to 20 →
  Reading & Writing Numerals to 99.
- Output is deterministic across repeated runs.

**Not verified — stated plainly:** I could **not** complete end-to-end HTTP testing
of the submission endpoint. It is blocked by Gap 1: posting a real diagnostic
submission crashes the server process at `db.ts:976`, before the reasoning code is
reached. That bug is pre-existing on `main` and unrelated to this feature, and I
deliberately did not patch it to make my own testing easier.

Instead I extracted the reasoning block's **verbatim source text** from `index.ts`
programmatically and executed it against the real modules and real generated
questions. That covered four cases — all correct (no path emitted), a failed
concept with prerequisites (correct chain), two failed concepts sharing
prerequisites (deduplicated, shared foundations promoted), and a failed concept
with no prerequisite edge (nothing fabricated). **These are harness results, not
live HTTP results**, and I want that distinction on the record.

### Known limitation

The feature only produces output for questions that carry a `conceptId`. The
concept-driven generator always supplies one, and I added it to the Atlas/Class-2
path. The Puppeteer `masterJson` path does not (Gap 4), so diagnostics generated
that way produce no prerequisite path. That is correct behaviour under the
no-fabrication rule rather than a defect in this feature, but it does mean
**Idea 3 is the work that would make this feature reach every diagnostic**, and I
would like to pick that up next.

### What I did not build

To be unambiguous: I did not write the OCR/ICR pipeline, the Gemini or Python
evaluation integration, the AI narrative generation, the scoring logic, or the
placement/sub-level logic. All of those pre-date my work and I changed none of
them. My changes are additive, and I verified that no line touching score,
`recommendedLevel`, `subLevel`, `targetLevel`, `levelHistory`, the narrative, or
`CURRICULUM_MAPPING` was modified.
