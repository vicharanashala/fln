# Onboarding Document — Jinendran

Every file path, line number and command result in this document was verified
against `origin/main` at commit `1bd4599` — the tree this PR branches from — and
not carried over from existing documentation, which (see G11) is materially out
of date. Where I cite my own feature work that is not yet on `main`, I say so
explicitly rather than pointing a reviewer at a path they cannot open.

---

## 1. What is FLN?

FLN stands for **Foundational Literacy and Numeracy**. This repository implements
the *numeracy* half: an assessment and personalised-worksheet platform for
**Mathematics in Classes 2–4** in Indian government schools.

The educational problem is one that every large school system hits. A class of
forty children is taught one lesson at one pace, but the forty children are not
at one level — some are still counting on their fingers while others are ready
for multi-digit regrouping. The teacher can see this happening. What they do not
have is a practical instrument to measure *where each child actually is*, or the
hours to hand-write forty different worksheets. So the class gets taught to the
middle, and the children at both ends are underserved. Aggregated over a state,
this is what produces the gap between *years spent in school* and *skills
actually acquired*.

FLN's purpose is to make per-child teaching mechanically possible at scale:

1. **Assess** each child on a diagnostic paper and place them on a fine-grained
   **93-level scale**, each level with 3 sub-levels
   (`backend/src/levelGenerator.ts:10` — *"Programmatic math builder for all 93
   levels and 3 sub-levels"*), rather than a coarse pass/fail grade.
2. **Generate** a printable worksheet personalised to that level. *Printable*
   is not a limitation here — it is the requirement. These are classrooms where
   a child does not have a device.
3. **Ingest** the completed paper back by scanning it (ICR — a blue-ink filter
   plus OCR), so the loop closes without a teacher retyping forty papers.
4. **Evaluate** the answers through a Python + Gemini pipeline
   (`ai-services/run_pipeline.py`) that produces a per-child report carrying
   root causes, not merely a score.
5. **Roll up** results through a seven-role administrative hierarchy so a block,
   district or state officer sees evidence instead of paperwork.

It serves **children** first (work at their own level), **teachers** second (a
diagnosis and a concrete action instead of a spreadsheet), and **administrators**
third (evidence of where intervention is actually needed).

The thing I would emphasise, having read the code rather than the pitch: the
system's real product is not the score. It is the **level assignment**, because
that single number decides what the child is handed next week. Everything
upstream exists to make that number trustworthy, and everything downstream
inherits it if it is wrong.

---

## 2. What do you understand by FLN as a system?

### Actors

The role enum lives in `backend/src/db.ts` (`UserRole`) and is enforced by
`getAuthUser` / `canAccessStudent` in `backend/src/auth.ts`:

| Role | What it owns | Scope of visibility |
|---|---|---|
| `SUPERADMIN` / `ADMIN` | The platform / a state | Everything / state |
| `DISTRICT_ADMIN` | A district | All schools within it |
| `BLOCK_ADMIN` | A block | All schools within it |
| `SCHOOL` | One school | Students of that school |
| `TEACHER` | A class in a school | Students of that school |
| `VOLUNTEER` | Assessment duty | Only their `assignedSchools` |

The scoping rule is visible in `backend/src/auth.ts:38-53`: the admin tiers
return `true` unconditionally, school and teacher are gated on
`student.schoolId === user.schoolId`, and a volunteer is gated on an explicit
`assignedSchools` list. The volunteer is deliberately the narrowest role — they
conduct assessments but own no teaching group.

Geographic scoping is a *join*, not a field: an `ADMIN`/`DISTRICT_ADMIN`/
`BLOCK_ADMIN` has a `stateCode`/`districtCode`/`blockCode`, and student
visibility is resolved by looking each student's school up in the schools
collection and comparing codes (`backend/src/routes/students.ts:91-103`).

### Entities and how they interact

```
School ──has──> ClassGroup ──has──> Student
                                      │
                                      ├─ currentLevel (1..93) + currentSubLevel (0..2)
                                      ├─ levelHistory[]
                                      │
Worksheet ──(questions[])──> AnswerSubmission ──> EvaluationReport
    │                              │                     │
 generated from                what the child        score, conceptMastery,
 the child's level                wrote              recommendedLevel
```

- A **Student** carries `currentLevel`, the single number driving what they are
  given next. Certification is `currentLevel >= 5`.
- A **Worksheet** holds `questions[]`, each with `question`, `answer`, `topic`,
  `difficulty` and `source_level` — so every question knows which FLN level it
  tests. That last field is what makes a *diagnostic* possible at all: the level
  is inferred from which questions failed, not from a raw percentage.
- An **AnswerSubmission** holds the child's raw responses keyed by
  `question_id`. It is the only record of *what the child actually wrote*.
- An **EvaluationReport** is the graded verdict: `score`, `conceptMastery`,
  `narrative`, `recommendedLevel`, `recommendedSubLevel`. Note that it does
  **not** retain the answers.

The interaction that took me longest to see, and which turns out to matter more
than anything else in this document: **a report keeps the verdict and throws away
the evidence.** Any question of the form "*how* does this child think?" — as
opposed to "how much did they score?" — can only be answered by joining
`AnswerSubmission.answers` back against `Worksheet.questions`. G5 and G6 below
are both consequences of that join being unavailable on the diagnostic path.

### The lifecycle

1. Teacher or volunteer administers a **diagnostic**.
2. The paper is scanned (ICR) or entered.
3. The Python pipeline evaluates it; an `EvaluationReport` is written.
4. `currentLevel` is set from `recommendedLevel`, using a
   **minimum-failure-level** rule — fail at Level 3 and Level 12 and you are
   placed at 3, because the higher skill stands on the lower one.
5. `currentSubLevel` is set by re-checking only the questions at the
   recommended level: fail all → sub-level 2 (Remedial), fail some → 1
   (Easier), fail none → 0 (Mastery) (`backend/src/routes/students.ts:478-493`).
6. A **personalised worksheet** is generated for the new level
   (`paperGenerator.ts` → Puppeteer → PDF).
7. Results aggregate upward; certification rates and level distributions surface
   on each role's dashboard.

---

## 3. Current State of the Repository — What Has Been Done So Far

### Stack and layout

An **npm-workspaces monorepo** (root `package.json` → `workspaces`), three parts:

| Workspace | Stack |
|---|---|
| `frontend/` | React 19 + Vite + Tailwind 4 + react-router 7 + TanStack Query 5 |
| `backend/` | Node + Express + TypeScript, run via `tsx`, bundled by `esbuild` |
| `ai-services/` | Python — `run_pipeline.py`, `scripts/0..3`, `prompts/`, `questions/` |

Commands: `npm run dev:frontend` (Vite, :5173), `npm run dev:backend` (:3000),
`npm run build`, `npm run lint`.

### Backend architecture — recently de-monolithed

The most significant recent change, and worth stating plainly because most
existing documentation predates it: `backend/src/index.ts` is now a **146-line
bootstrap** that wires middleware and delegates. The API lives in **17 route
modules** under `backend/src/routes/` — `admin`, `analytics`, `announcements`,
`auth`, `bestPractices`, `classes`, `diagnosticBulk`, `evaluation`, `geo`,
`interventions`, `logbook`, `schools`, `stats`, `students`, `teachers`,
`tickets`, `worksheets` — each exporting a `register*Routes(app)` function.

### Authentication — real, and better than the docs claim

`backend/src/auth.ts` (59 lines) implements genuine JWT auth:

- Login (`backend/src/routes/auth.ts`, `POST /api/auth/login`, behind an
  `authRateLimiter`) enforces password complexity, looks the user up with a
  bounded query, verifies with **bcrypt**, and issues a **signed JWT**
  (7-day expiry).
- `getAuthUser` (`auth.ts:16-31`) verifies the signature on every request and
  resolves the user from the database. The comment at `auth.ts:13-15` is
  explicit that there is **no** role synthesis from the email prefix.
- `sanitizeUser` strips `passwordHash` before anything leaves the server.
- `canAccessStudent` (`auth.ts:38-53`) guards by-ID endpoints against IDOR.

That is a sound design. G1–G3 are about three specific lines that undo it.

### Data layer

`backend/src/db.ts` (2,989 lines) is a `DBStore` class over **MongoDB**
(`connectDB`, `MONGODB_URI`, `MongoClient`), with a seed-file fallback when no
URI is set. On boot it mirrors the users collection into `this.data.users` for
synchronous auth lookups (`db.ts:448-459`), and mutation methods write to Mongo
and then patch the in-memory copy.

`getStudents(opts?)` (`db.ts:557`) pushes `limit`/`offset`/`schoolId`/
`teacherId` down into Mongo — but **`limit` defaults to `0`, meaning unbounded**.
Called bare, it ships the entire students collection (86,435 documents in the
dev database I ran against). This detail matters for G4.

### Implemented features

- **Level generation** — `levelGenerator.ts` (493 lines), the 93-level scale.
- **Paper generation** — `paperGenerator.ts`, Puppeteer → PDF, using the HTML
  templates in `frontend/public/worksheets/` (shared across workspaces).
- **ICR/OCR scanning** — blue-ink filter, PDF upload, multi-provider toggle
  (Google / MiniMax / OCR.space, and an Ollama provider added recently).
- **Gemini integration** — `gemini.ts` (652 lines) with `generateContentWithRetry`
  and a model fallback chain (`gemini.ts:12`), plus a deterministic non-AI
  fallback on every AI path, so the server runs without `GEMINI_API_KEY`.
- **Role dashboards** — `RoleDashboards.tsx` (3,138 lines), `PanelViews.tsx`
  (1,611 lines), `SuperAdminExecutiveDashboard.tsx`.
- **Governance** — tickets, interventions, best practices, defaulter escalation,
  teacher banning.

### Deployment and CI

In production the backend serves the built frontend from `FRONTEND_DIST_DIR`.
`apiClient.ts` is base-path aware via `import.meta.env.BASE_URL`, so the app
works under a subpath. There is no Dockerfile and no deployment manifest.

There is **one** GitHub Actions workflow,
`.github/workflows/repo-health-check.yml`. It is worth being precise, because
its existence is easy to mistake for CI: it runs on a **daily cron
(`30 3 * * *`) and `workflow_dispatch` only** — no `push`, no `pull_request` —
and executes `scripts/repo-health-check.js`, which opens or closes a
`repo-health` tracking issue. See G8.

### Verified state of the toolchain

I ran the type-checker in both workspaces rather than trusting the docs:

```
backend:  npx tsc --noEmit  → exit 0, no errors
frontend: npx tsc --noEmit  → exit 0, no errors
```

Both clean. `git ls-files | grep -cE '\.test\.|\.spec\.|__tests__'` returns
**0** — there is not a single test file in the repository.

---

## 4. Gaps Observed in the Code

All eleven verified against `origin/main` @ `1bd4599`.

### G1 — `Fln@2026` is a working password for every account, including superadmin

**Where:** `backend/src/routes/auth.ts:34-38`, with the hash from
`backend/src/auth.ts:7`

```ts
const targetHash = user.passwordHash || SEED_DEMO_PASSWORD_HASH;          // :34
let passwordOk = await bcrypt.compare(password, targetHash);              // :35
if (!passwordOk && user.passwordHash) {                                   // :36
  passwordOk = await bcrypt.compare(password, SEED_DEMO_PASSWORD_HASH);   // :37
}                                                                         // :38
```

**What:** Line 34's `||` fallback is defensible — a seeded user with no hash yet
needs *something* to compare against, and line 45 immediately persists a real
hash afterwards. Lines 36–38 are not defensible. The guard is
`user.passwordHash`, so the demo hash is tried **precisely when the user does
have a real password of their own**. A user who has set a strong password still
authenticates with `Fln@2026`. There is no role exception, so this includes
`SUPERADMIN`.

**Why it matters:** A complete authentication bypass requiring only a
known-plaintext constant committed to the repository. Behind it sit children's
names, schools and Aadhaar references, plus every write endpoint in the
seven-role hierarchy. Everything else in `auth.ts` — bcrypt, signed JWTs, IDOR
guards — is correctly built and then bypassed by these three lines.

### G2 — The documented mitigation for G1 silently does nothing

**Where:** `backend/src/auth.ts:7` vs `backend/src/db.ts:12-13`; the import at
`backend/src/routes/auth.ts:5`

```ts
// db.ts:12-13 — respects the environment
export const SEED_DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'Fln@2026';
export const SEED_DEMO_PASSWORD_HASH = bcrypt.hashSync(SEED_DEMO_PASSWORD, 10);

// auth.ts:7 — ignores it
export const SEED_DEMO_PASSWORD_HASH = bcrypt.hashSync('Fln@2026', 10);
```

**What:** Two exported constants share a name and diverge. `backend/.env.example`
documents `SEED_DEMO_PASSWORD` as the override for private deployments and
`db.ts` honours it — but `routes/auth.ts:5` imports the constant from
**`../auth`**, the hardcoded one. Setting `SEED_DEMO_PASSWORD` in production
changes what `reseed` writes (`db.ts:1353`) but **not** what the login endpoint
accepts.

**Why it matters:** An operator who follows `.env.example` will believe the
public demo password has been disabled. It has not. A gap you think you have
closed is worse than one you know is open.

### G3 — `JWT_SECRET` falls back to a literal and production only warns

**Where:** `backend/src/auth.ts:6-10`

```ts
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
...
if (JWT_SECRET === 'dev-insecure-secret-change-me' && process.env.NODE_ENV === 'production') {
  console.warn('[auth] WARNING: JWT_SECRET is unset in production — set it to a strong random value.');
}
```

**What:** The check correctly identifies the dangerous state and then continues
booting. A deployment that misses the env var runs with a signing key published
in the repository, so anyone can forge a token for any role.

**Why it matters:** The same total compromise as G1 by a second route. A
`console.warn` in a container log is not a control.

### G4 — `GET /api/students/:id/diagnostic-paper` ignores `:id` and returns the entire student list

**Where:** `backend/src/routes/students.ts:60-125`

**What:** The route is named for a per-student diagnostic paper. It never
generates or returns one, and it **never reads `req.params.id`**. What it
actually does is call `dbStore.getStudents()` with no arguments, mask Aadhaar and
guardian PII, apply role scoping, and `res.json(scoped)` — a student *list*. I
found this by calling it during onboarding and getting back 94 student objects
where I expected a question paper. The real paper generation lives at
`POST /api/students/:id/diagnostic` (`:256`).

**Why it matters:** Three separate problems in one handler.

- **Correctness:** the endpoint does not do what its name and its `:id` promise.
  Any client written against it is broken by construction, and the misleading
  name means the bug survives casual review.
- **Performance:** `getStudents()` with no `opts` means `limit = 0`, i.e.
  unbounded — the full students collection, 86,435 documents in my dev
  database, serialised on a request that looks per-student.
- **Maintainability:** it duplicates the scoping and masking logic of
  `GET /api/students` (`:13-57`) rather than reusing it, so a change to PII
  policy has to be made twice and one copy will be missed.

### G5 — The Python pipeline's per-error analysis is computed and then thrown away

**Where:** `backend/src/routes/students.ts:445-446` and `:522-524`, against
`ai-services/scripts/2_evaluate_child.py:90, 181, 186, 256`

**What:** `2_evaluate_child.py` writes a rich per-child evaluation JSON:
`root_causes` (`:256`), `levels_failed` (`:186`), `prerequisites_to_check`
(`:181`) and `performance_by_difficulty` (`:90`, `:130`). The backend opens that
same file **twice** and reads four scalars from it — `total_questions`,
`wrong_count`, `demonstrated_level` (`:445-448`) and `topics_to_focus`
(`:522-524`). Everything else is discarded. A repository-wide search for
`rootCauses` in `backend/src` returns **zero hits**: the field is not consumed,
not stored, and not even declared on `EvaluationReport`.

**Why it matters:** This is the most expensive data the system produces — it
costs a Python subprocess and an LLM call per child — and it is dropped on the
floor. The teacher-facing report is reduced to a score and a level when a
per-question diagnosis was already sitting in the file. Every downstream feature
that wants to answer *how* a child failed has to recompute it from scratch or
give up.

### G6 — A diagnostic writes no `AnswerSubmission`, so the child's answers are never persisted

**Where:** `backend/src/routes/students.ts:350-562` (the diagnostic submit
handler); compare `backend/src/routes/evaluation.ts:1024`, the only
`addAnswerSubmission` call in the codebase

**What:** The worksheet path persists both records — an `AnswerSubmission` (what
the child wrote) and an `EvaluationReport` (the verdict). The diagnostic path
persists **only the report**. The handler has the raw material in hand: it
receives `questions` and `answers` in the request body and compares them
directly at `:478-493` to compute the sub-level. It then discards the answers.

**Why it matters:** The diagnostic is the **first and most important** assessment
a child sits — it is what sets their initial level. It is the one assessment
whose evidence is not retained. Nothing downstream can ever revisit *how* a child
answered their placement paper: not a teacher querying a surprising placement,
not an appeal against a level, not any future analysis. The data existed in
memory and was allowed to fall out of scope. Combined with G5, the diagnostic
path discards both the pipeline's analysis *and* the child's raw answers.

### G7 — The certification threshold `>= 5` is duplicated nine times, including in React

**Where:**

- `backend/src/routes/analytics.ts:53`, `:91`
- `frontend/src/components/PanelViews.tsx:196`, `:214`, `:986`, `:1287`, `:1558`
- `frontend/src/components/RoleDashboards.tsx:1259`, `:1267`

**What:** `s.currentLevel >= 5` is written out longhand in nine places across two
workspaces, and seven of them are inside React components that recompute
certification rates client-side rather than reading them from the API.

**Why it matters:** Certification is national policy. If the threshold moves it
must move in nine places, or dashboards will silently disagree with the backend
and two officers looking at different screens will see different certification
rates for the same district. It is also business logic living in the view layer,
which makes it untestable.

### G8 — There are no tests, and nothing runs on a pull request

**Where:** `.github/workflows/repo-health-check.yml:3-6`; root `package.json:19`;
`backend/package.json:6-18`

**What:** Two findings that compound.

```yaml
on:
  schedule:
    - cron: '30 3 * * *'
  workflow_dispatch: {}
```

There is no `pull_request` or `push` trigger anywhere in the repository, and the
single workflow runs a changelog/staleness reporter rather than the type-checker.
Separately, `git ls-files | grep -cE '\.test\.|\.spec\.|__tests__'` returns
**0** — there is no test suite to run even if something triggered it. No
workspace defines a `test` script. `npm run lint` is `tsc --noEmit`, which proves
types compile and nothing whatever about behaviour.

**Why it matters:** A reviewer approving a PR has no signal beyond reading the
diff — not even a type-check. Every gap in this section reached the default
branch through a review process with zero automated verification, and G1 (a total
auth bypass, three lines) is exactly the class of defect one assertion would
have caught permanently.

### G9 — Every user is held in process memory for the lifetime of the server

**Where:** `backend/src/db.ts:448-459`; `getUserSync` at `:517-519`

**What:** Boot loads the entire `users` collection into `this.data.users`
(`:449`), and lookups scan that array with a linear `find` (`:519`). The boot log
in my dev environment reads `MongoDB ready: 6449 users in Atlas (6449 active)`.

**Why it matters:** Scalability, in a system explicitly designed to roll up a
*national* hierarchy. Every replica holds every user in heap, and an O(n) scan
per lookup degrades as the table grows. The login path itself was already
optimised to a bounded query (`getUserByEmail`) — the boot-time mirror was not,
so the optimisation is undone by the thing sitting next to it.

### G10 — The route split left `index.ts` importing six symbols it never uses

**Where:** `backend/src/index.ts:21`

```ts
import { getAuthUser, canAccessStudent, sanitizeUser, JWT_SECRET, JWT_EXPIRES_IN,
         SEED_DEMO_PASSWORD_HASH } from './auth';
```

**What:** All six symbols moved into the route modules along with the handlers
that used them; the import line stayed behind. `grep -c` for each of the six in
`index.ts` returns exactly `1` — the import itself. `tsc --noEmit` does not
complain because `noUnusedLocals` is not enabled.

**Why it matters:** Small on its own, but it is the residue that makes a refactor
hard to trust: a reader of `index.ts` reasonably concludes the bootstrap still
participates in authentication. It also demonstrates that the current lint
configuration cannot detect dead code — which is what let it survive the split.

### G11 — `CLAUDE.md` describes a repository that no longer exists

**Where:** `CLAUDE.md` — the "⚠ Critical thing to understand before editing"
section, the `Layout` section, and the auth bullet under "Conventions & gotchas"

**What:** Seven claims, each falsified by the current tree:

| Claim | Reality |
|---|---|
| A mock `fetch` interceptor answers every `/api/*` call in-browser | `frontend/src/mock/` does not exist |
| Any `@fln.org` email in a Bearer header is auto-promoted to a role | Replaced by verified JWT (`auth.ts:16-31`) |
| Two pre-existing type errors at `index.ts:665`, `paperGenerator.ts:233` | Both workspaces type-check clean |
| `frontend/src/utils/levelGenerator.ts` duplicates the backend copy | No `frontend/src/utils/` directory exists |
| `backend/src/index.ts` is "still one 1580-line file" | It is 146 lines; the API is in 17 route modules |
| `backend/data/db.json` is the JSON-file "database" (not MongoDB) | That file does not exist; `db.ts` uses `MongoClient` |
| "max level `59`" is a magic threshold to grep for | The scale is **93** levels (`levelGenerator.ts:10`) |

**Why it matters:** This is the file a new contributor is told to read first. It
sends them looking for a mock backend that was deleted, warns them off an auth
model that was fixed, and points them at a monolith that has been split. It cost
me an hour before I started checking the tree directly instead. The route split
made it actively harmful: a contributor told to "add to the matching area of
`index.ts`" now finds a 146-line bootstrap with nothing to add to.

---

## 5. Ideas for the Project

### I1 — Close the authentication bypass (addresses G1, G2, G3)

**What:** One focused security PR.

1. Delete `routes/auth.ts:36-38` outright. Keep the `user.passwordHash ||
   SEED_DEMO_PASSWORD_HASH` fallback at `:34` for genuinely unhashed seed
   accounts — it already persists a real hash immediately afterwards at `:45`.
2. Delete the duplicate constant at `auth.ts:7` and re-export `db.ts`'s
   environment-aware one, so `SEED_DEMO_PASSWORD` behaves as `.env.example`
   documents. One definition, one behaviour.
3. Turn the `JWT_SECRET` warning into a `throw` when `NODE_ENV === 'production'`.

**Why:** Three routes to the same total compromise, sharing one root cause —
convenience defaults that survived into the production path. Fixing them
separately leaves the system exploitable in the interim, and (2) in particular is
worthless without (1) since the demo hash would still be accepted.

**How:** The diff is small but it changes who can log in, so it needs a
deliberate migration: run a one-off script confirming every user document has a
`passwordHash` **before** removing the fallback, otherwise legitimate seeded
accounts lock out. I verified in my dev database that all 6,449 users already
carry a hash, so the migration is likely a no-op — but that must be checked
against production, not assumed. Add tests asserting a user with a real password
is rejected when given `Fln@2026`, and that boot fails in production without a
secret. I would raise this first and on its own.

### I2 — Make `diagnostic-paper` return a diagnostic paper (addresses G4)

**What:** Decide what the route is for and make it honest. It should read
`req.params.id`, authorise with the existing `canAccessStudent`, and return that
child's paper — either the stored one or a freshly generated one via the same
`generateDiagnosticPaper` path `POST /api/students/:id/diagnostic` already uses.
If the student-list behaviour is genuinely relied on by a caller, that caller
should be moved to `GET /api/students`, which already does exactly this.

**Why:** A route whose name, parameter and behaviour disagree is a trap for every
future contributor, and this one also pulls 86,435 documents per call.

**How:** Grep the frontend for `diagnostic-paper` first to find the real callers
and see which behaviour they depend on — the fix is either "implement the paper"
or "delete the route", and the callers decide which. Whichever way it goes, the
duplicated masking/scoping block should be extracted into one helper shared with
`GET /api/students` so PII policy has a single home.

### I3 — Persist the diagnostic's own evidence (addresses G5, G6)

**What:** Two changes in the diagnostic submit handler.

1. Declare `rootCauses`, `levelsFailed`, `prerequisitesToCheck` and
   `performanceByDifficulty` as optional fields on `EvaluationReport`, and map
   the pipeline JSON's `root_causes` / `levels_failed` /
   `prerequisites_to_check` / `performance_by_difficulty` onto them when reading
   the file that is *already being parsed twice*.
2. Write an `AnswerSubmission` alongside the report, exactly as
   `routes/evaluation.ts:1024` does for worksheets.

**Why:** Both recover data the system already has, at essentially no cost. (1)
turns a score into a diagnosis on the report a teacher actually opens. (2) makes
the placement paper auditable — a level assignment that cannot be traced back to
the answers that produced it cannot be questioned by the teacher it constrains.

**How:** (1) is additive and safe: optional fields, defensive mapping, no
behaviour change for existing readers. (2) needs care about *what* the submission
joins to — a diagnostic has no persisted `Worksheet`, so either the generated
paper is persisted as one (making the questions retrievable, which is what any
later analysis needs) or the submission stores the questions inline. I would do
(1) first as a standalone PR since it is pure gain, then (2) with the worksheet
question resolved. **I have implemented (1) — see §6.**

### I4 — A shared constants module (addresses G7)

**What:** Introduce a `shared/` workspace exporting `CERTIFICATION_LEVEL = 5`,
`MAX_LEVEL = 93` and the mastery score bands, consumed by both frontend and
backend. Then move the certification computation itself out of `PanelViews.tsx`
and `RoleDashboards.tsx` onto the existing aggregate endpoints in
`routes/analytics.ts`, so components render a number instead of deriving one.

The score bands are scattered the same way, with the added hazard that they
*disagree*: `routes/evaluation.ts` splits sub-levels on `>= 80 / >= 50` in one
place and calls mastery on `>= 60 / >= 50` in another, and `IcrScanner.tsx`
repeats that pair client-side. The `Math.min(93, …)` level cap is likewise
repeated across `gemini.ts`.

**Why:** Fixes the nine-copy problem and the business-logic-in-components problem
with one change, and makes the threshold testable in one place.

**How:** Two deliberately separate PRs — first introduce the constants and
replace the literals (mechanical, zero behaviour change); then move the
computation server-side (behaviour change, dashboards need re-verifying). The
monorepo already has `workspaces`, so a third workspace is the natural home.

### I5 — Give the repository a test job on pull requests (addresses G8, G10)

**What:** Three additive changes, no new infrastructure.

1. Add a `test` script at the root and in `backend/`, using Node's built-in
   `node:test` — no new dependency required on Node 20.
2. Add a workflow triggered `on: [pull_request]` running `npm run lint &&
   npm test`, on `ubuntu-latest` with Node 20 — the same runner setup
   `repo-health-check.yml` already proves works here.
3. Enable `noUnusedLocals` in `backend/tsconfig.json` so `tsc --noEmit` catches
   G10-class residue, cleaning existing violations in the same PR.

**Why:** This is the cheapest durable quality win available and it is a
*precondition* for I1 being safe to review — I1 changes authentication, which
currently has no automated check whatsoever. Seeding the suite with the auth
assertions from I1 gives the job something real to protect from day one.

**How:** Start the suite with pure-function tests that need no Mongo (level
mapping, sub-level derivation, error classification) so the job runs in a bare
Node container with no services. Step 3 should land last and separately: turning
on a compiler flag across a 15,000-line workspace is a mechanical but noisy diff
that should not be mixed with a CI change.

### I6 — Bound the user cache (addresses G9)

**What:** Stop mirroring the whole users collection at boot. Replace
`getUserSync`'s linear scan with the bounded `getUserByEmail` query the login
path already uses, behind a small LRU with a TTL for the hot path.

**Why:** Removes an O(n)-per-lookup cost and a per-replica memory cost that both
grow with national rollout, without changing any caller's contract.

**How:** `getUserSync` is synchronous and its callers are not, which is the only
real work here — the call sites need to become `await`. That is a mechanical but
wide change, so it should be its own PR with no behaviour changes riding along.
An index on `users.email` should be confirmed at the same time.

### I7 — Correct `CLAUDE.md` (addresses G11)

**What:** Rewrite the seven stale claims in G11 to match the tree — most
importantly the mock-backend warning, the auth model, and the description of
`index.ts` as a monolith, which is now the opposite of true.

**Why:** It is the designated first read for new contributors and it currently
costs each of them the same hour it cost me. Cheap to fix; the cost of leaving it
recurs per contributor.

**How:** Documentation-only diff, verifiable with the same commands I used:
`ls frontend/src/mock`, `ls backend/data/db.json`, `wc -l backend/src/index.ts`,
`npx tsc --noEmit` in each workspace.

---

## 6. Your Contribution

### 6.1 Bug fixes made during onboarding

**Recovering the pipeline's discarded analysis (I3 part 1, addresses G5).**
I implemented the mapping described in I3: a `readPipelineDetail()` helper that
lifts `root_causes`, `levels_failed`, `prerequisites_to_check` and
`performance_by_difficulty` out of the pipeline JSON that the handler was already
parsing, and writes them onto the `EvaluationReport`.

Two details I would defend in review:

- **Nothing is inferred.** When the pipeline's LLM step falls back it emits a
  single overall verdict instead of one entry per question. In that case each
  wrong answer is recorded with *its own* topic and FLN level taken from the
  question the child actually sat, and the pipeline's overall `error_type`
  restated against it — never a per-question diagnosis invented to fill the
  shape. A fabricated cause is indistinguishable from a measured one once it is
  downstream.
- **The difficulty breakdown is measured** from the paper when the pipeline
  reports none, rather than left empty.

Verified end-to-end against a running stack: a fresh 0/42 diagnostic now writes
**42 root causes** carrying real per-question topic and level, `levelsFailed:
[2]`, and a measured breakdown of 13 easy / 8 medium / 21 hard — where
previously the report carried none of it. I removed the test records and restored
the student document afterwards.

### 6.2 Feature — Misconception Fingerprinting

Developed on branch `feat/misconception-fingerprinting`. **It is not on `main`
and is not part of this PR**, which is documentation only, per the onboarding
instructions. I am describing it here because it is the substance of my
contribution; the file paths in this subsection are on that branch.

**The problem.** Every assessment path in this repo reduces a child to a scalar.
Two children on 40% get the same worksheet next week. But a child who writes
`27 + 15 = 312` (adding each column and writing the results side by side) and a
child who writes `27 + 15 = 43` (counting on, one step short) have made the same
*number* of mistakes and need completely different teaching. The data to tell
them apart was already being persisted and thrown away — which is how I came to
notice G5 and G6.

**What it does.** Each child gets a **17-dimension error-signature vector**: 9
mutually exclusive error *morphologies* (concatenation, place-value, reversal,
permutation, operation substitution, off-by-one, near-miss, gross magnitude,
omission), 5 *distribution* features (where the errors land), and 3 *consistency*
features. The cohort is clustered on that vector with **k-means++**, with `k`
chosen by **silhouette** rather than hardcoded, so the cohort decides how many
distinct minds it contains. Implemented in plain TypeScript — no new runtime
dependency.

Design decisions I would defend:

1. **Overall accuracy is deliberately not a feature.** Every dimension is
   conditioned on the child's *incorrect* answers only. If score leaked into the
   vector it would dominate the distance metric and rebuild the scalar the
   feature exists to replace.
2. **Membership is decided by distance, not by the model.** Given the free
   choice, Gemini put thirteen of twenty children into whichever archetype
   happened to be created first, while splitting the digit reversers across
   three. Naming a discovered pattern is a language problem and stays with the
   model; deciding whether two children fail the same way is a distance
   comparison. The code keeps the model's prose and discards its choice.
3. **Erratic groups are never sent to the LLM.** Clusters whose members fail with
   no consistent shape are detected statistically and named by fixed copy
   ("Careless, Not Confused"). Asked to infer a mental model from noise, a
   fluent model will confidently supply one.
4. **Children with too little evidence are reported, not dropped.** Below three
   wrong answers the vector is essentially one-hot, so they are flagged rather
   than handed an archetype on the strength of a single slip.

**Tests.** 50 assertions over the error classifier, feature construction,
clustering determinism and naming — currently the only test file in the project,
which is what prompted G8 and I5.

### 6.3 A defect I found in my own feature

Late in the work I traced a report of the per-child panel reading *"Not enough
wrong answers yet to see a pattern"* for a child who had scored **0/10** — every
answer wrong.

The cause was G6 wearing a different hat. The cohort analysis builds fingerprints
from `AnswerSubmission` records; a diagnostic writes only an `EvaluationReport`;
so every diagnostic-only child was counted as having made no submission and
silently dropped, and the endpoint returned 404. Worse, the system contradicted
itself — the per-submission path *did* have an evaluation-report fallback, so the
child was a listed member of an archetype while the cohort pass reported no
signature for them at all.

I fixed it by giving the cohort pass the same fallback the per-submission path
already used, and added two regression tests: a diagnostic-only child must get a
signature, and a submission must still outrank a report when both exist.

I am including this here rather than quietly patching it because *how* it
survived is the more useful finding: a green `tsc` on a repository where nothing
runs on a pull request. That is G8, and it is why I5 is the idea I would pick up
first after I1.

---

*Prepared by Jinendran. Every path, line number and command result above was
verified against `origin/main` at `1bd4599`.*
