# Onboarding Document — Jinendran

All file references below were checked against the repository at the head of
branch `feat/misconception-fingerprinting`, after that branch was synced with
`origin/main` (which recently split the backend into route modules). Line numbers
are from that tree, not from the pre-split layout — several of the gaps below
moved file during the split, and I re-verified each one rather than carrying the
old citation forward.

---

## 1. What is FLN?

FLN stands for **Foundational Literacy and Numeracy**. In this repository it is
specifically the *numeracy* half: an assessment and personalised-worksheet
platform for **Mathematics in Classes 2–4** in Indian government schools.

The educational problem it addresses is the one every large school system runs
into. A class of forty children is taught one lesson at one pace, but the
children in it are not at one level — some are still counting on fingers while
others are ready for multi-digit regrouping. A teacher can see this happening,
but has no practical instrument to measure *where* each child actually is, and
no time to hand-write forty different worksheets. So the class is taught to the
middle, and the children at either end are underserved. Nationally, this is what
produces the gap between "years spent in school" and "skills acquired".

FLN's purpose is to make per-child teaching mechanically possible:

1. **Assess** each child on a diagnostic paper and place them on a fine-grained
   **level scale (1–93, each with 3 sub-levels)** rather than a coarse pass/fail
   grade.
2. **Generate** a printable worksheet personalised to that level — printable
   matters, because these are classrooms where a child does not have a device.
3. **Ingest** the completed paper back in by scanning it (`IcrScanner.tsx`,
   `IcrTwoStageScan.tsx` — a blue-ink filter plus OCR), so the loop closes
   without manual data entry.
4. **Evaluate** the scanned answers through a Python + Gemini pipeline
   (`ai-services/run_pipeline.py`) that produces a per-child report with root
   causes, not just a score.
5. **Roll up** the results through a seven-role administrative hierarchy so that
   a block, district or state officer sees aggregates rather than paperwork.

It serves **children** first (they receive work at their own level), **teachers**
second (they get a diagnosis and a concrete action instead of a spreadsheet), and
**administrators** third (they get evidence of where intervention is needed).

---

## 2. What do you understand by FLN as a system?

### Actors

The role enum lives in `backend/src/db.ts` (`UserRole`) and is enforced through
`getAuthUser` / `canAccessStudent` in `backend/src/auth.ts`:

| Role | What it owns | Scope of visibility |
|---|---|---|
| `SUPERADMIN` / `ADMIN` | The platform | Everything |
| `DISTRICT_ADMIN` | A district | All schools within it |
| `BLOCK_ADMIN` | A block | All schools within it |
| `SCHOOL` | One school | Students of that school |
| `TEACHER` | A class in a school | Students of that school |
| `VOLUNTEER` | Assessment duty | Only `assignedSchools` |

The scoping rule is visible in `auth.ts:38-53`: the four admin tiers return
`true` unconditionally, school and teacher are gated on `student.schoolId ===
user.schoolId`, and a volunteer is gated on their explicit `assignedSchools`
list. A volunteer is deliberately the narrowest role — they conduct assessments
but own no teaching group, which is also why they are excluded from renaming
misconception archetypes (`routes/misconceptions.ts:19-26`).

### Entities and how they interact

The core chain is:

```
School ──has──> ClassGroup ──has──> Student
                                      │
                                      ├─ currentLevel (1..93)
                                      │
Worksheet ──(questions[])──> AnswerSubmission ──> EvaluationReport
    │                              │                     │
 generated from                 what the             score, conceptMastery,
 the child's level           child wrote            recommendedLevel
                                                          │
                                                   MisconceptionCluster
                                                  (which archetype they are)
```

- A **Student** carries `currentLevel`, which is the single number driving what
  they are given next. Certification is `currentLevel >= 5`.
- A **Worksheet** holds `questions[]`, each with `question`, `answer`, `topic`,
  `difficulty` and `source_level` — so a question knows which FLN level it tests.
- An **AnswerSubmission** is the child's raw responses, keyed by `question_id`.
  It is the only record of *what the child actually wrote*.
- An **EvaluationReport** is the graded verdict: `score`, `conceptMastery`,
  `narrative`, `recommendedLevel` and `recommendedSubLevel`. Notably it does
  **not** retain the child's answers.
- A **MisconceptionCluster** (`db.ts:371-404`) groups children by *how* they
  fail, keyed by `classGroup`, defined by a `centroid` vector.

The interaction that matters most, and which I only understood by tracing it: a
report keeps the score but throws away the responses, so any analysis of *how* a
child thinks has to join `AnswerSubmission.answers` back against
`Worksheet.questions`. That join is the raw material the whole misconception
feature is built on.

### The lifecycle

1. Teacher or volunteer administers a **diagnostic**.
2. The paper is scanned (ICR) or entered; an `AnswerSubmission` is written.
3. The Python pipeline evaluates it; an `EvaluationReport` is written.
4. The child's `currentLevel` is set from the report's `recommendedLevel`, using
   a **minimum-failure-level** rule — fail at Level 3 and Level 12 and you are
   placed at 3, because the higher skill stands on the lower one.
5. `assignStudentToArchetype()` fires (`routes/students.ts:552` for the
   diagnostic, `routes/evaluation.ts:414` for an ICR scan, `:884` for a worksheet
   submission) and files the child into a misconception archetype.
6. A **personalised worksheet** is generated for the new level
   (`paperGenerator.ts`, rendered to PDF via Puppeteer).
7. Results aggregate upward; `certificationRate` and level distributions surface
   on each role's dashboard.

---

## 3. Current State of the Repository — What Has Been Done So Far

### Stack and layout

An **npm-workspaces monorepo** (`package.json` → `workspaces`), three parts:

| Workspace | Stack | Size |
|---|---|---|
| `frontend/` | React 19 + Vite + Tailwind 4 + react-router 7 + TanStack Query 5 | ~14,458 lines across 23 components |
| `backend/` | Node + Express + TypeScript, run via `tsx`, bundled by `esbuild` | ~15,154 lines |
| `ai-services/` | Python — `run_pipeline.py`, `scripts/0..3`, `prompts/`, `questions/` | — |

Commands: `npm run dev:frontend` (Vite, :5173), `npm run dev:backend`
(:3000 by default, though `.env.example:1` sets `PORT=5000`), `npm run build`,
`npm run lint`.

### Backend architecture — recently de-monolithed

This is the most significant recent change and it is worth stating because most
existing documentation predates it. `backend/src/index.ts` is now a **131-line
bootstrap** that does nothing but wire middleware and delegate; the API lives in
**18 route modules** under `backend/src/routes/` (`auth`, `students`,
`worksheets`, `evaluation`, `analytics`, `admin`, `schools`, `teachers`,
`classes`, `geo`, `tickets`, `logbook`, `interventions`, `bestPractices`,
`diagnosticBulk`, `announcements`, `stats`, `misconceptions`). Each exports a
`register*Routes(app)` function called from the bootstrap.

### Authentication — real, and better than the docs claim

`backend/src/auth.ts` implements proper JWT auth:

- Login (`routes/auth.ts:10-50`, `POST /api/auth/login`, behind an
  `authRateLimiter` from `config.ts`) enforces password complexity, looks the
  user up with a bounded query, verifies with **bcrypt**, and issues a **signed
  JWT** (`jsonwebtoken`, 7-day expiry).
- `getAuthUser` (`auth.ts:16-31`) verifies the signature on every request and
  resolves the user from the database. The comment at `auth.ts:13-15` is explicit
  that there is *no* role synthesis from the email prefix.
- `sanitizeUser` (`auth.ts:56`) strips `passwordHash` before anything is returned.
- `canAccessStudent` (`auth.ts:38-53`) guards by-ID endpoints against IDOR.

The frontend stores the token as `fln_token` in `localStorage` and attaches it in
`apiFetch` (`frontend/src/services/apiClient.ts:20-33`), which also clears the
token and fires an `fln_unauthorized` event on any 401.

### Data layer

`backend/src/db.ts` (3,046 lines) is a `DBStore` class over **MongoDB**
(`connectDB`, `MONGODB_URI`, `MongoClient` at `:4`), with a seed-file fallback
when no URI is set. On boot it mirrors collections into `this.data` for
synchronous reads (`:518-529`), and mutation methods write to Mongo and then
patch the in-memory copy (e.g. `updateStudent`, `updateWorksheet`, `updateUser`).

### Implemented features

- **Level generation** (`levelGenerator.ts`, 493 lines) — the 93-level scale
  (`levelGenerator.ts:10`: *"Programmatic math builder for all 93 levels and 3
  sub-levels"*).
- **Paper generation** (`paperGenerator.ts`) — Puppeteer → PDF, using the HTML
  templates in `frontend/public/worksheets/` (shared across workspaces).
- **ICR/OCR scanning** — blue-ink filter, PDF upload, a provider toggle across
  Google / MiniMax / OCR.space.
- **Gemini integration** (`gemini.ts`, 656 lines) with `generateContentWithRetry`
  and a deterministic non-AI fallback on every AI path, so the server runs
  without `GEMINI_API_KEY`.
- **Role dashboards** — `RoleDashboards.tsx` (3,121 lines),
  `PanelViews.tsx` (1,611), `SuperAdminExecutiveDashboard.tsx`.
- **Misconception fingerprinting** — see §6.
- **Governance** — tickets, interventions, best practices, defaulter escalation,
  teacher banning (`isBanned`).

### Deployment and CI

In production the backend serves the built frontend from `FRONTEND_DIST_DIR`.
`apiClient.ts` is base-path aware via `import.meta.env.BASE_URL`, so the app works
under a subpath without rewriting built files. There is no Dockerfile and no
deployment manifest in the repo.

There is now **one** GitHub Actions workflow,
`.github/workflows/repo-health-check.yml`. It is worth being precise about what it
does, because its existence is easy to mistake for CI: it runs on a **daily cron
(`30 3 * * *`) and `workflow_dispatch` only** — there is no `push` or
`pull_request` trigger — and it executes `scripts/repo-health-check.js`, opening
or closing a `repo-health` tracking issue. It does not run the type-checker or
the test suite, and nothing at all runs when a PR is opened. See G6.

### Verified state of the toolchain

I ran the type-checker in both workspaces rather than trusting the docs:

```
backend:  npx tsc --noEmit  → exit 0, no errors
frontend: npx tsc --noEmit  → exit 0, no errors
```

Both are clean.

---

## 4. Gaps Observed in the Code

### G1 — `Fln@2026` is a working password for every account, including superadmin

**Where:** `backend/src/routes/auth.ts:34-38`, with the hash from
`backend/src/auth.ts:7`

```ts
const targetHash = user.passwordHash || SEED_DEMO_PASSWORD_HASH;   // :34
let passwordOk = await bcrypt.compare(password, targetHash);       // :35
if (!passwordOk && user.passwordHash) {                            // :36
  passwordOk = await bcrypt.compare(password, SEED_DEMO_PASSWORD_HASH);  // :37
}
```

**What:** Line 34's `||` fallback is defensible — a seeded user with no hash yet
needs *something* to compare against. Lines 36-38 are not. The guard is
`user.passwordHash`, meaning the demo hash is tried **precisely when the user
does have a real password of their own**. A user who has set a strong password
still authenticates with `Fln@2026`. There is no role exception, so this includes
`SUPERADMIN`.

**Why it matters:** This is a complete authentication bypass requiring only a
known-plaintext constant that is committed to the repository. Behind it sit
children's names, schools and Aadhaar references, plus every write endpoint in
the seven-role hierarchy. Everything else in `auth.ts` — bcrypt, signed JWTs,
IDOR guards — is correctly built and then bypassed by these three lines.

### G2 — The documented mitigation for G1 silently does nothing

**Where:** `backend/src/auth.ts:7` vs `backend/src/db.ts:12-13`; import at
`backend/src/routes/auth.ts:5`

```ts
// db.ts:12-13  — respects the environment
export const SEED_DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'Fln@2026';
export const SEED_DEMO_PASSWORD_HASH = bcrypt.hashSync(SEED_DEMO_PASSWORD, 10);

// auth.ts:7    — ignores it
export const SEED_DEMO_PASSWORD_HASH = bcrypt.hashSync('Fln@2026', 10);
```

**What:** Two constants share a name and diverge. `backend/.env.example`
documents `SEED_DEMO_PASSWORD` as the override for private deployments, and
`db.ts` honours it — but `routes/auth.ts:5` imports the constant from
**`../auth`**, the hardcoded one. Setting `SEED_DEMO_PASSWORD` in production
therefore changes what `reseed` writes (`db.ts:1409`) but **not** what the login
endpoint accepts.

**Why it matters:** An operator who follows `.env.example` will believe the
public demo password has been disabled. It has not. A gap you think you closed is
worse than one you know is open.

### G3 — `JWT_SECRET` falls back to a literal and production only warns

**Where:** `backend/src/auth.ts:6-11`

```ts
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
...
if (JWT_SECRET === 'dev-insecure-secret-change-me' && process.env.NODE_ENV === 'production') {
  console.warn('[auth] WARNING: JWT_SECRET is unset in production — ...');
}
```

**What:** The check correctly identifies the dangerous state and then continues
booting. A deployment that misses the env var runs with a signing key published
in the repository, so anyone can forge a token for any role.

**Why it matters:** Same total bypass as G1 by a second route. A `console.warn`
in a container log is not a control; this should be a hard boot failure.

### G4 — Cohort archetype statistics mix weighted and unweighted vectors

**Where:** `backend/src/misconceptionFingerprint.ts:2135-2157` (persistent
branch), compare with `:2267-2291` (k-means branch)

**What:** The persistent branch computes the cohort mean from **raw** vectors:

```ts
cohortMean[key] = assignedFingerprints.reduce((a, f) => a + f.vector[key], 0) / n;   // :2137
```

but the cluster centroid through `toArray` → `fromArray`:

```ts
const centroidPoint = meanPoint(members.map(m => toArray(m.vector)));   // :2146
const centroid = fromArray(centroidPoint);                             // :2147
```

`toArray` multiplies each component by `BLOCK_WEIGHTS` (`:961-962`, weights
declared at `:113`) and `fromArray` (`:1368`) reads it straight back as a feature
value, so `fromArray(toArray(v)) !== v`: distribution features return at 0.7×,
`skillInconsistency` at 0.85×, `contextSpecificity` at 0.5×. `lift` is then
computed as weighted ÷ raw (`:2152`). The k-means branch at `:2269` averages raw
values and is correct, so the two paths disagree.

**Why it matters:** Correctness of the feature's own output. `distinctiveFeatures`
keeps only entries clearing `lift > 1.1` (`:2155`), so distribution and
consistency features are systematically under-reported as distinctive whenever a
class has persisted clusters — which is the normal case. It also shifts the
`INCOHERENCE_THRESHOLDS.inconsistency` cut of 0.4 (`:1359`, applied in
`isIncoherent` at `:1361-1365`) to an effective 0.47 on the raw scale, making the
"Careless, Not Confused" group under-fire. The same class can be described two
different ways depending on which branch ran.

### G5 — The certification threshold `>= 5` is duplicated nine times, including in React

**Where:**

- `backend/src/routes/analytics.ts:53`, `:91`
- `frontend/src/components/PanelViews.tsx:196`, `:214`, `:986`, `:1287`, `:1558`
- `frontend/src/components/RoleDashboards.tsx:1258`, `:1266`

**What:** `s.currentLevel >= 5` is written out longhand in nine places across two
workspaces, and seven of them are inside React components that recompute
certification rates client-side rather than reading them from the API. The
backend route split moved two of these between files without reducing the count.

**Why it matters:** Certification is national policy — if the threshold moves,
it must move in nine places or dashboards will silently disagree with the
backend, and two officers looking at different screens will see different
certification rates for the same district. It is also business logic living in
the view layer, which makes it untestable.

### G6 — Nothing runs on a pull request

**Where:** `.github/workflows/repo-health-check.yml:3-6`;
`backend/package.json:13` (`test:fingerprint`); root `package.json:19` (`lint`
only, no `test`)

**What:** The repository has exactly one workflow and it is scheduled, not
triggered:

```yaml
on:
  schedule:
    - cron: '30 3 * * *'
  workflow_dispatch: {}
```

There is no `pull_request` or `push` trigger anywhere, and the job runs
`scripts/repo-health-check.js` — a changelog/staleness reporter — rather than the
type-checker or the tests. The repository's only automated tests
(`misconceptionFingerprint.test.ts`, 1,058 lines) are runnable solely by name:
`npm run test:fingerprint --workspace @fln/backend`. There is no `test` script at
the root at all. `npm run lint` is `tsc --noEmit`, which proves types compile and
nothing about behaviour.

**Why it matters:** A reviewer approving a PR has no signal beyond reading the
diff — not even a type-check. 1,058 lines of good assertions rot silently the
first time someone changes a threshold. G4 is exactly the class of bug a run of
those tests could be made to catch, and it reached the default branch precisely
because nothing ran.

### G7 — `CLAUDE.md` describes a repository that no longer exists

**Where:** `CLAUDE.md`, the "⚠ Critical thing to understand before editing"
section, the `Layout` section, and the auth bullet under "Conventions & gotchas"

**What:** Six claims, each falsified by the current tree:

| Claim | Reality |
|---|---|
| A mock `fetch` interceptor answers every `/api/*` call in-browser | `frontend/src/mock/` does not exist; `main.tsx` has no interceptor |
| Any `@fln.org` email in a Bearer header is auto-promoted to a role | Replaced by verified JWT (`auth.ts:16-31`) |
| Two pre-existing type errors at `index.ts:665` and `paperGenerator.ts:233` | Both workspaces type-check clean (exit 0) |
| `frontend/src/utils/levelGenerator.ts` duplicates the backend copy | No `frontend/src/utils/` directory exists |
| `backend/src/index.ts` is "still one 1580-line file" | It is 131 lines; the API lives in 18 route modules |
| `backend/data/db.json` is the JSON-file "database" (not MongoDB) | That file does not exist; `db.ts` is MongoDB (`MongoClient`, `:4`) |
| "max level `59`" is a magic threshold to grep for | The scale is **93** levels (`levelGenerator.ts:10`, `gemini.ts:461`) |

**Why it matters:** This is the file a new contributor is told to read first, and
it currently sends them looking for a mock backend that was deleted, warns them
off an auth model that was fixed, and points at a monolith that has been split.
I lost time to it during this onboarding before checking the tree directly.

### G8 — An archetype rename is visible to every school teaching that class

**Where:** `backend/src/routes/misconceptions.ts:251-322`;
`backend/src/db.ts:371-404`

**What:** `MisconceptionCluster` carries `classGroup` but no `schoolId`, so
`PATCH /api/misconceptions/clusters/:clusterId` writes a name shared by every
school teaching that class. The schema comment at `db.ts:388-396` acknowledges
this and records `nameSetBy`/`nameSetByRole`/`nameSetAt` rather than restricting
the write. Separately, **no frontend code calls this endpoint** — a repo-wide
search for `misconceptions/clusters` returns exactly one hit, the route
definition itself — so the capability is unreachable from the UI.

**Why it matters:** A Class 2 teacher in one school renaming a group to something
meaningful in their own room silently relabels it for every other school in the
state. Attribution records who did it but does not prevent it.

### G9 — Every user is held in process memory for the lifetime of the server

**Where:** `backend/src/db.ts:518-520`, `getUserSync` at `:587-590`

**What:** Boot loads the entire `users` collection into `this.data.users`, and
`getAuthUser` resolves against that array with a linear `find` on **every
authenticated request**. The comment at `routes/auth.ts:27` notes the collection
was already 6,449 users when the login path itself was optimised — the boot-time
mirror was not.

**Why it matters:** Scalability. A system designed to roll up a national
hierarchy will not hold every user in every replica's heap, and an O(n) scan per
request degrades as the user table grows.

### G10 — The route split left `index.ts` importing six symbols it never uses

**Where:** `backend/src/index.ts:21`

```ts
import { getAuthUser, canAccessStudent, sanitizeUser, JWT_SECRET, JWT_EXPIRES_IN,
         SEED_DEMO_PASSWORD_HASH } from './auth';
```

**What:** I found this while re-verifying the other gaps against the post-split
tree. All six symbols moved to the route modules with the handlers that used
them; the import line stayed behind. Nothing in the remaining 131 lines
references any of them. `tsc --noEmit` does not complain because unused *imports*
are not an error under this config (`noUnusedLocals` is not enabled).

**Why it matters:** Small, but it is the kind of residue that makes a refactor
hard to trust — a reader of `index.ts` reasonably concludes the bootstrap still
participates in authentication. It also keeps `index.ts` bound to `auth.ts` in
the module graph for no reason, and it is a standing signal that the linting
configuration cannot catch dead code, which is what let it survive the split in
the first place.

---

## 5. Ideas for the Project

### I1 — Close the authentication bypass (addresses G1, G2, G3)

**What:** One focused security PR:

1. Delete `routes/auth.ts:36-38` outright. The demo-password path keeps only the
   `user.passwordHash || SEED_DEMO_PASSWORD_HASH` fallback at `:34` for genuinely
   unhashed seed accounts, which then immediately persists a real hash via the
   existing `updateUserPasswordHash` call at `:45`.
2. Delete the duplicate constant in `auth.ts:7` and re-export `db.ts`'s
   environment-aware one, so `SEED_DEMO_PASSWORD` behaves as `.env.example`
   documents. One definition, one behaviour.
3. Turn the `JWT_SECRET` warning into a `throw` when `NODE_ENV === 'production'`.

**Why:** These are three routes to the same total compromise, they share a root
cause (convenience defaults that survived into the production path), and fixing
them separately leaves the system exploitable in the interim.

**How:** Small diff, but it changes who can log in, so it needs a deliberate
migration: run a one-off script to confirm every user document has a
`passwordHash` *before* removing the fallback, otherwise legitimate seeded
accounts lock out. Add tests asserting that a user with a real password is
rejected when given `Fln@2026`, and that boot fails in production without a
secret. I would raise this one first and on its own.

### I2 — Make the two clustering paths agree on one metric (addresses G4)

**What:** In the persistent branch, average raw vectors exactly as the k-means
branch does, and keep `toArray`'s weighting strictly inside distance
computations, where it belongs.

**Why:** `BLOCK_WEIGHTS` exists to shape *distance* — how far apart two children
are. It has no meaning as a displayed feature value, and letting it leak into one
means the archetype a teacher reads depends on which code path produced it. The
fix also removes the accidental drift in the `isIncoherent` thresholds.

**How:** Replace `fromArray(meanPoint(members.map(toArray)))` at `:2146-2147`
with the same per-key raw mean used at `:2269`. Then add a regression test
asserting that the same cohort, analysed through both branches, yields the same
`distinctiveFeatures` and the same `incoherent` verdicts — which is the property
that was actually violated, and is stronger than asserting a round-trip identity.

### I3 — A shared constants module (addresses G5)

**What:** Introduce `shared/constants.ts` exporting `CERTIFICATION_LEVEL = 5`,
`MAX_LEVEL = 93` and the mastery score bands, consumed by both workspaces. Then
move the certification computation itself out of `PanelViews.tsx` /
`RoleDashboards.tsx` and onto the existing aggregate endpoints in
`routes/analytics.ts`, so components render a number rather than deriving one.

The score bands are scattered the same way as the certification threshold, with
the added hazard that they *disagree*: `routes/evaluation.ts:377` splits
sub-levels on `>= 80 / >= 50`, while `:401-402` calls mastery on `>= 60 / >= 50`,
`IcrScanner.tsx:305-306` and `:443-444` repeat that pair client-side, and
`misconceptionDemoSeed.ts:291-296` uses a three-way `80/60`. Also worth folding
in is the `Math.min(93, …)` cap repeated at `gemini.ts:461`, `:586` and `:647`.

**Why:** Fixes the nine-copy problem and the business-logic-in-components problem
with the same change, and makes the threshold testable in one place.

**How:** Two steps, deliberately separate PRs — first introduce the constant and
replace the literals (mechanical, zero behaviour change); then move the
computation backend-side (behaviour change, needs the dashboards re-verified).
The monorepo already has `workspaces`, so a third workspace is the natural home.

### I4 — Give the existing workflow a `pull_request` trigger and a test job (addresses G6, G10)

**What:** Three additive changes, no new infrastructure:

1. Add `"test": "npm run test:fingerprint --workspace @fln/backend"` at the root.
2. Add a second workflow (or a second job) triggered `on: [pull_request]` running
   `npm run lint && npm test` on `ubuntu-latest` with Node 20 — the same setup
   `repo-health-check.yml:20-22` already proves works in this repo.
3. Enable `noUnusedLocals` in `backend/tsconfig.json` so `tsc --noEmit` catches
   G10-class residue, and clean the existing violations in the same PR.

**Why:** The repo already has 1,058 lines of good assertions and a working
Actions setup; the missing piece is purely that nothing invokes them on a PR.
This is the cheapest durable quality win available, and it is a precondition for
I1 and I2 being safe to review — both change logic that currently has no
automated check at all.

**How:** No Mongo needed — the fingerprint suite is pure functions over fixtures,
which is why it can run in a bare Node container. Step 3 should land last and
separately; turning on a compiler flag across a 15,000-line workspace is a
mechanical but noisy diff that should not be mixed with a CI change.

### I5 — Scope archetypes to schools and build the rename UI (addresses G8)

**What:** Add `schoolId` to `MisconceptionCluster`, include it in the lookup in
`getMisconceptionClusters` and in `assignStudentToArchetype`'s scoping, and only
then add the rename affordance to `MisconceptionFingerprint.tsx`.

**Why:** In that order specifically. Building the UI first would take a
cross-school write that is currently unreachable in practice and hand it to every
teacher — turning a latent data-model gap into a live one.

**How:** The field is additive and optional, so existing clusters keep working —
`classGroup` was introduced the same way, and the schema comment at
`db.ts:380-385` records that pre-existing clusters carrying no class are simply
skipped.
The rename UI is then a small edit form against the endpoint that already exists,
already validates, and already records attribution.

### I6 — Correct `CLAUDE.md` (addresses G7)

**What:** Rewrite the seven stale claims in G7 to match the tree — most
importantly the mock-backend warning, the auth model, and the description of
`index.ts` as a monolith, which is now the opposite of true and actively
misdirects anyone looking for where to add a route.

**Why:** It is the designated first read for new contributors and it currently
costs each of them the same hour it cost me. Cheap to fix, and the cost of
leaving it recurs per contributor. The route split made it materially worse: a
contributor told to "add to the matching area of `index.ts`" will now find a
131-line file with nothing to add to.

**How:** Documentation-only diff, verifiable by the same commands I used —
`ls frontend/src/mock`, `ls backend/data/db.json`, `wc -l backend/src/index.ts`,
`npx tsc --noEmit` in each workspace.

---

## 6. Your Contribution

My contribution during onboarding is the **Misconception Fingerprinting**
feature, on branch `feat/misconception-fingerprinting`.

### The problem it addresses

Every assessment path in this repo reduces a child to a scalar — a score, and a
level derived from it. Two children on 40% get the same worksheet next week. But
a child who writes `27 + 15 = 312` (adding each column and writing the results
side by side) and a child who writes `27 + 15 = 43` (counting on, one step short)
have made the *same number* of mistakes and need completely different teaching.
The data to tell them apart was already being persisted and thrown away:
`AnswerSubmission.answers` joined against `Worksheet.questions`.

### What I built

**`backend/src/misconceptionFingerprint.ts` (2,369 lines)** — the analysis layer:

- A **17-dimension error-signature vector** per child: 9 mutually exclusive error
  *morphologies* (concatenation, place-value, reversal, permutation, operation
  substitution, off-by-one, near-miss, gross magnitude, omission), 5
  *distribution* features (where the errors land), and 3 *consistency* features.
- `classifyError` — a deterministic priority cascade assigning each wrong answer
  exactly one morphology. Order is load-bearing: `312` is also a gross-magnitude
  error, so testing the specific patterns first is what preserves the diagnosis.
- The **consistency block**, which is the part I am most confident matters. It is
  conditioned on *opportunities* rather than errors, over cells of equivalent
  questions (`topic|difficulty|regrouping|level`), so it can separate "fails this
  every time" (a wrong rule) from "fails this half the time" (inattention).
  `4·r·(1−r)` is symmetric — reliably right and reliably wrong score identically —
  which keeps it score-blind by construction.
- **Clustering**: k-means++ with `k` chosen by silhouette rather than hardcoded,
  so the cohort decides how many distinct minds it contains. Implemented in plain
  TypeScript — no new runtime dependency.
- **Discovered, not predefined, archetypes**: each cluster is named from its own
  most distinctive features. A cohort with no place-value problem cannot produce
  a place-value archetype.
- **Deliberate constraints**: overall accuracy is never a feature (it would
  dominate the distance metric and rebuild the thing being replaced); nothing in
  the module throws, since it is a read-only layer over already-graded data; and
  clusters whose members fail *erratically* are detected statistically
  (`isIncoherent`, `:1361`) and named by fixed copy, never sent to the LLM —
  asked to infer a mental model from noise, a model will confidently supply one.

**`backend/src/studentArchetypeService.ts` (409 lines)** — persistent membership.
A child joins the nearest archetype within a `SAME_PATTERN_DISTANCE` of 0.25
(`:57`), or founds a new one. The radius is measured, not guessed: same-pattern
pairs sit a median 0.114 apart, cross-pattern pairs never closer than 0.272
(`:41`).

**`backend/src/geminiClusterMatcher.ts` (251 lines)** — Gemini naming, with a
strict JSON schema and full validation.

**`backend/src/misconceptionFingerprint.test.ts` (1,058 lines)** — assertions
over the classifier, the feature construction and the clustering.

**Frontend** — `MisconceptionFingerprint.tsx` (1,235 lines): per-child dossier,
cohort view, side-by-side comparison of two children with the same score, and a
deterministic **glyph** rendering each signature as a closed spline, so "same
score, different mind" is visible at a glance.

**API** — `backend/src/routes/misconceptions.ts` (323 lines):
`/api/misconceptions/cohort`, `/fingerprint/:studentId`, `/compare`, `/residue`,
and `PATCH /clusters/:clusterId` for renaming with role checks, validation and
attribution.

### Integrating with the backend route split

The feature was written against the old monolithic `index.ts`. While preparing
this document I synced the branch with `origin/main`, which had meanwhile split
the backend into 18 route modules. That merge was the non-trivial part of the
contribution and is worth describing, because a careless resolution would have
shipped silently broken code:

- The five endpoints were **extracted into a new `routes/misconceptions.ts`**
  following the established `register*Routes(app)` pattern, rather than left in a
  file that no longer holds routes.
- The cohort analysis cache had been a closure inside `startServer()`. It moved
  to module scope and exports `invalidateFingerprintCache`, because the submit
  handlers that must invalidate it now live in *other* modules
  (`routes/evaluation.ts`, `routes/students.ts`).
- The three `assignStudentToArchetype()` call sites lived in the monolith and had
  **no equivalent in the new modules**. I traced each to its new home
  (`routes/students.ts:552` diagnostic, `routes/evaluation.ts:414` ICR scan,
  `:884` worksheet submission) and rewired them. Had I not, both
  `studentArchetypeService.ts` and `geminiClusterMatcher.ts` — 660 lines — would
  have compiled cleanly as unreachable dead code, and archetype assignment would
  have silently stopped happening. `tsc` would not have said a word. This is G6
  and G10 in miniature, which is part of why I raised them.

Both workspaces type-check clean after the merge.

### Design decisions I would defend in review

1. **Membership is decided by distance, not by the model.** Given the free
   choice, Gemini put thirteen of twenty children into whichever archetype
   happened to be created first, while splitting the digit reversers across
   three. Naming a discovered pattern is a language problem and stays with the
   model; deciding whether two children fail the same way is a distance
   comparison. The code keeps the model's prose and discards its choice
   (`studentArchetypeService.ts:307-325`).
2. **Stable identity separate from display name.** Gemini renames the same seven
   children differently on every run, so `slug`/`stableName` are derived from the
   group's own statistics and the model's wording sits on top. A teacher cannot
   organise a remedial group around a label that changes overnight.
3. **The module reports its own blind spot.** Wrong answers the nine rules cannot
   read are flagged `unparsed` and surfaced as `unclassifiedRate` and `residue`,
   because the rules cannot report a pattern they have no name for — but they can
   report how often they failed to read one.
4. **Children with too little evidence are reported, not dropped.** Below three
   wrong answers the vector is essentially one-hot, so they are flagged rather
   than handed an archetype on the strength of one slip.

### Also produced during this onboarding

Reading my own code back against the rest of the repository surfaced **G4** — the
weighted/unweighted centroid mismatch in `analyseCohort`'s persistent branch,
which is a defect in the feature I contributed. It is a real bug affecting the
statistics teachers see, and I2 plus I4 are my proposed fixes for it. I have
written it up here rather than quietly patching it, because how it got past
review — a green `tsc` on a repo where nothing runs on a PR — is the more useful
finding of the two.

**G10** came out of the same exercise from the opposite direction: re-verifying
every citation in this document against the post-split tree, rather than
carrying the old line numbers forward, is what turned up the dead import block
left behind in `index.ts`.

---

*Prepared by Jinendran. Every file path, line number and command result above was
verified against the working tree at the head of
`feat/misconception-fingerprinting` — not taken from the existing documentation,
which, as noted in G7, is materially out of date.*
