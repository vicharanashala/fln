# FLN — Foundational Literacy & Numeracy Assessment Platform

A large-scale, personalized assessment system that helps teachers measure, track, and improve every student's Foundational Literacy and Numeracy (FLN) outcomes — from automatic question paper generation to scanning answer sheets and instant, profile-driven evaluation.

> **Current build scope: Mathematics only.** "FLN" names the policy problem this project is built to eventually address in full (see [SRS.md](SRS.md)), but nothing here evaluates literacy today — every level, question, and evaluation path in this repo is numeracy. Don't read the sections below as literacy features that already exist.
>
> **Build order pivoted 2026-09-17 to stage-by-stage, not all-classes-at-once:** Balvatika (the year before Class 1) → Class 1 → Class 2 → Class 3, each stage frozen before the next starts. Class 4/5 are explicitly deferred to Tenali, not built here. Balvatika's 29 curriculum levels and their question-content (`generationIntent`) rows are already authored and seeded in the database, but **nothing in the codebase renders them into an actual worksheet yet** — see [issue #486](https://github.com/vicharanashala/fln/issues/486). Don't assume a level existing in `curriculumMap.ts` means a student can be assessed on it end-to-end.

---

## Table of Contents
- [What is FLN?](#what-is-fln)
- [Why FLN Matters](#why-fln-matters)
- [Initiatives](#initiatives)
- [What This Software Does](#what-this-software-does)
- [How It Works (Workflow)](#how-it-works-workflow)
- [The Level Framework](#the-level-framework)
- [Where This Is Headed](#where-this-is-headed)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Contribution Guidelines](#contribution-guidelines)
- [Branching & PR Convention](#branching--pr-convention)
- [License](#license)

---

## What is FLN?

**Foundational Literacy and Numeracy (FLN)** refers to the basic ability to read with comprehension and perform simple arithmetic operations — the core skills every child needs before they can meaningfully engage with the rest of their school curriculum. It typically covers children from pre-school through Grade 3 (roughly ages 3–9), and includes skills like letter and word recognition, reading fluency, basic comprehension, number sense, and elementary arithmetic.

FLN is considered the "foundation" of all future learning — without it, a child cannot effectively progress through later grades, no matter how good the rest of the curriculum is.

## Why FLN Matters

India has one of the largest school-going populations in the world, but enrollment has not translated into actual learning. Large-scale assessments have repeatedly shown that a significant share of children in upper primary grades cannot read a simple grade-appropriate text or solve basic arithmetic problems. This learning gap compounds over time — children who fall behind in FLN tend to struggle increasingly with every subject built on top of it, leading to disengagement, grade repetition, and eventually dropout.

The National Education Policy (NEP) 2020 explicitly recognized this and stated that achieving universal foundational literacy and numeracy in primary school is the highest near-term priority for the Indian education system — without it, the rest of education policy has limited impact for a large portion of students.

This is the problem our project aims to help solve: giving schools and teachers a reliable, scalable, and personalized way to **assess** where each child stands on FLN, **act** on that data quickly, and **track** progress until every child clears the foundational bar.

## Initiatives

Some of the key national and state-level efforts this project aligns with:

- **NIPUN Bharat** (National Initiative for Proficiency in Reading with Understanding and Numeracy) — launched in July 2021 under the Samagra Shiksha scheme, with the goal that every child achieves grade-level FLN competencies by the end of Grade 3, by 2026–27. It uses a five-tier implementation structure (national, state, district, block, school).
- **NEP 2020** — the policy mandate that established universal FLN as the top priority for the Indian school system.
- **DIKSHA & UDISE+** — existing national digital infrastructure for teacher resources and student/school data that FLN initiatives are encouraged to build on or align with.
- **State-led missions** — several states have their own FLN programs aligned with NIPUN Bharat (e.g., Mission Buniyaad in Delhi, Mission Ankur in Madhya Pradesh), often with localized assessment tools and workbooks.

This project is built to be usable by schools, teachers, and administrators operating within this broader policy ecosystem — generating assessments aligned with grade-wise FLN expectations ("Lakshyas") rather than a generic test.

## What This Software Does

The platform is built around **personalized, student-specific assessment**, not one-size-fits-all testing. Core capabilities:

- **Student Profiling** — every student has a profile that tracks their current FLN level, assessment history, and progress over time.
- **Teacher Dashboard** — central workspace for teachers to manage classes, generate assessments, scan results, and view analytics.
- **Automatic Question Paper Generation** — question papers are generated automatically based on grade level and the student's current FLN level, not just a static template.
  - For a **new class/new school** with no prior data, the system falls back to a **standard question paper** aligned with the generic FLN benchmark expected for that grade.
  - Once a student has a profile, future papers are **personalized**, while still meeting the minimum competency bar defined for that grade under FLN criteria.
- **Print & Distribute** — teachers can print a generic class paper or individual, name-tagged worksheets per student.
- **Scan & Auto-Evaluate** — after collecting completed sheets, the teacher scans them (via phone camera or a school scanner) and the system evaluates them automatically.
- **Instant Results & Certification**
  - If a student **clears** the FLN benchmark for their grade → they receive a certificate for that grade and progress forward.
  - If a student **does not clear** it → they receive a detailed analysis of which FLN level they're actually at, along with a scheduled re-assessment date for the appropriate (lower) level.
  - Students who clear a lower-level re-assessment go on to attempt the FLN qualifier for their original grade again — every subsequent paper is generated from their updated, personalized profile.

## How It Works (Workflow)

1. Teacher generates a question paper from the dashboard (standard paper for new classes, or personalized per student once profiles exist).
2. Paper is printed and distributed to students.
3. Students take the assessment on paper.
4. Teacher collects the answer sheets.
5. Teacher scans the sheets (phone or scanner) and uploads them into the app.
6. System auto-evaluates the sheet and updates the student's profile.
7. Teacher gets an instant result:
   - **Pass** → certificate issued, student advances.
   - **Fail** → FLN level diagnosis + scheduled re-assessment at the appropriate level.
8. Cycle repeats until the student clears the grade-level FLN qualifier.

## The Level Framework

Every question, worksheet, and diagnostic is pinned to one of **109 curriculum levels** (`backend/src/config/curriculumMap.ts`), each mapped to a stage, age group, and a concept ID (`S1.1`–`S7.18`). The count has moved twice: an older 59-level numbering was replaced by 93, which grew to 109 when the year before Class 1 was finalised against NCF-FS 2022 (PR #517). The migration is still in progress, and the most recently added levels have had the least real-world testing.

**Stage 3 (levels 19–46, concept IDs mostly `S3.*` with a few relocated `S4`/`S5` nodes) is Balvatika** — "the year before Class 1," defined by school-admission-year, not by the child's actual age (NCF and Nipun Bharat both treat the 3/4/5 age split as tentative, so there's no age-specific sub-staging). It's the stage currently being built out: 29 nodes have curriculum entries, skill/subskill mappings, and authored `generationIntent` question content in Mongo (`backend/src/seedBalvatikaQuestionTemplates.ts`, seeded via PR #529), but the content-authoring and pipeline-wiring work were done as deliberately separate passes — see the scope note at the top of this file and issue #486.

**Open, deliberately unsolved: how many questions per node are needed for mastery, and how that fits a Balvatika-length worksheet.** ~30 nodes × the ~4-5-questions/concept that standard mastery norms (and ASER's own practice) call for is a 90+ question diagnostic — infeasible for a 5-6-year-old in one sitting, and combining multiple nodes into one question (the usual fix) has limited reach here since most Balvatika nodes are independent rather than interconnected. FLN grades pass/fail per concept, never a partial score, which constrains whatever threshold gets picked. The same open question applies to teacher observation worksheets (how many times to observe a skill before ticking it off). Being researched deliberately, not guessed at under time pressure — don't hardcode a per-node question count or observation threshold until this is resolved.

Two things worth knowing before you touch level numbers:

- **Levels can't be freely renumbered.** `questionBankId()` bakes the level number directly into every stored question-bank ID, so changing a level's number would orphan existing data, not just relabel it.
- **The curriculum is a build-time snapshot, not a live lookup table.** Levels, their ordering, and their prerequisite relationships are expected to change as the pedagogy is refined — see [Where This Is Headed](#where-this-is-headed) below. Anything you build against the level framework should tolerate that source of truth moving.

## Where This Is Headed

This is the thinking behind why issues get raised the way they do on this repo. If a PR contradicts a point below, that's usually why it gets sent back — read this before proposing a design, not just before writing code.

**1. FLN stays level-based, but the prerequisite structure is being redesigned as a DAG with clauses, not a tree.** A tree gives each level exactly one parent; the actual pedagogy has *alternative* minimal prerequisite sets (failing a level can mean missing that level's own content, *or* missing one of several different combinations of earlier levels). This is what lets two students with the same score be diagnosed differently. Code that assumes one-parent-per-level is encoding the old, wrong model. The concrete rule: a **hard prerequisite is AND** (all required), **multiple valid routes to the same concept are OR** (a real alternative pathway, not a hedge for uncertainty — e.g. multiplication via skip-counting OR via times-tables). Balvatika itself has almost no OR cases — most of its nodes are independent with no prerequisite edges at all — the OR case matters more from Class 1 onward. Backward-mapping depth (how far below a failed level to place a student on a wrong answer) follows a **half-split rule** from Knowledge Space Theory: move the student roughly halfway down the prerequisite chain below the failed level, proportional to chain length, not a fixed count or straight to the bottom. Not yet implemented — depends on the topological-sort work over the DAG.

**2. The level number is a display label, not the canonical ID — treat it as one that can move.** The target model gives every concept an immutable internal ID; the 1–109 level number, the S-strand code, and the legacy 1–59 and 1–93 numbers are all versioned aliases of it, kept specifically so the numbering can be corrected by curriculum research without another storage migration. Today's code hasn't fully caught up to this (see [The Level Framework](#the-level-framework) — `questionBankId()` still bakes the level number directly into stored IDs), which is itself one of the things being migrated away from, not a pattern to extend.

**3. Scoring and progression are deterministic and auditable; an LLM never silently decides them.** Gemini (or any model) can assist with generation, tagging, and explanations, but pass/fail/certification decisions run on deterministic rules, and a wrong answer that doesn't match a known misconception pattern stays "unclassified" until a human confirms it — the system never invents a diagnosis for a case it hasn't seen before.

**4. Wrong answers are evidence to build the diagnostic model from, not a catalogue to hardcode up front.** The plan is deliberately vertical-slice-first: prove one 8–12 concept chain end-to-end with a human doing the diagnosis manually, collect real wrong-answer data from that, and only then automate classification — rather than authoring all 109 levels of content or inventing a full misconception catalogue speculatively before any real student has used it. If you're proposing to "finish" the level framework or the misconception model in one PR, check whether that's actually the current priority; it usually isn't.

**5. Question authoring is being decoupled from the legacy generators.** See [`docs/question-authoring-and-assets.md`](docs/question-authoring-and-assets.md) for the current intent-based authoring flow (PRs #428/#431) and where question/SVG content actually lives in the database — don't assume the old hardcoded generator logic is still the only path.

**6. New code must be modular and plug-and-play, because the source of truth above is expected to keep changing.** If the Levels turn out to be wrong, or the prerequisite DAG gets revised, or a concept gets re-tagged, that should mean editing data/config in one place — not rebuilding or re-threading logic through the repository. Don't hardcode a level number, a prerequisite edge, or a misconception rule somewhere it can't be swapped independently of the rest of the system.

**7. Stop designing around what the codebase already does.** Where the existing implementation and the intended pedagogy disagree, the pedagogy wins — the code is expected to change to match the design, not the other way around. Corollary: don't spend a review cycle defending existing code just because it's already there.

If you're picking up level-framework, curriculum, or scoring/diagnosis work, check with a maintainer first — this area is mid-redesign and the source of truth is expected to keep changing.

## Tech Stack

This is an **npm-workspaces monorepo** with three separate backend-side pieces, not one:

- **`frontend/`** (`@fln/frontend`) — React 19 + Vite + Tailwind. Talks only to `backend/`.
- **`backend/`** (`@fln/backend`) — Node.js + Express + TypeScript. This is "the" API server — the one described in [Getting Started](#getting-started) below. It uses the **native `mongodb` driver, not Mongoose**, and falls back to a local JSON file (`backend/data/db.json`) if `MONGODB_URI` is unset — useful for a zero-setup demo, but not concurrency-safe, so don't rely on it for anything beyond a solo local run.
- **`backend/fln-backend`** (`fln-worksheet-backend`) — a second, separate plain-JS backend workspace for worksheet-specific functionality.
- **`ai-services/`** — a Python evaluation/OCR pipeline, invoked by `backend/` as a subprocess (not a service you run yourself in normal dev).

So "MERN" is shorthand for the general shape (Mongo + Express + React + Node), not a literal description of one Express app talking to one Mongoose-modeled database — there are two JS backends and a Python service, and the primary one doesn't use Mongoose.

## Getting Started

```bash
git clone https://github.com/vicharanashala/fln.git
cd fln
npm install
```

### Run against your own MongoDB (recommended for local dev)

Each contributor should point their local backend at **their own** MongoDB — either
a free [Atlas](https://www.mongodb.com/cloud/atlas/register) cluster or a local
`mongod` — instead of hardcoding data or sharing one database. This lets you seed
your own test data and iterate on features without touching anyone else's.

1. Copy the backend env template: `cp backend/.env.example backend/.env`
   (the file at the repo root, `.env.example`, is only for the AI scripts in
   `ai-services/` — it does **not** configure the database).
2. In `backend/.env`, set `MONGODB_URI` to your own connection string, e.g.
   `mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/fln` (Atlas) or
   `mongodb://127.0.0.1:27017/fln` (local mongod).
3. Populate it with the full demo dataset (states/districts/schools/teachers/
   volunteers/students — matches the demo login buttons in the UI):
   ```bash
   npm run seed --workspace @fln/backend
   ```
   Optionally also run `npm run seed:question-bank` and `npm run seed:html`
   (workspace-scoped) to load the question bank / worksheet HTML collections.
4. Start the app:
   ```bash
   npm run dev:backend    # API on :3000, reads backend/.env
   npm run dev:frontend   # Vite dev server on :5173
   ```

Demo login after seeding: `superadmin@fln.org` (see `backend/src/seed.ts` for the
full list of generated teacher/volunteer/admin emails, which follow a predictable
`role.<state>_<district>_<block>_<school>@fln.org` pattern). Every seeded account
shares one password, controlled by the `SEED_DEMO_PASSWORD` env var
(`backend/src/db.ts`) — **set it in your own `backend/.env` rather than relying on
the built-in default.** Never deploy with the default value, and never print the
actual password value in a commit, doc, or issue — that's exactly how it ended up
published here before (see the git history on this line).

### Aadhaar tokenization (in-process vault)

Student registration tokenizes the 12-digit Aadhaar through the in-process
vault module at [`backend/src/modules/vault/`](backend/src/modules/vault/) —
the FLN backend never stores plaintext Aadhaar and never exposes Vault
service JWTs to the browser (see
[`backend/src/aadhaarVault.ts`](backend/src/aadhaarVault.ts) and
[`backend/src/routes/students.ts`](backend/src/routes/students.ts)). The
module is wired unconditionally at boot; no feature flag, no separate
process, no service-JWT exchange.

The module needs two env vars (both required for tokenization to succeed):

- `MONGODB_URI` — the FLN backend's existing Mongo connection. The vault
  reuses the same replica set; the module fails fast with
  `VAULT_DB_REQUIRES_REPLICA_SET` (503) if pointed at a standalone
  `mongod` because `session.withTransaction(...)` is unsupported there.
- `LOCAL_DEV_MASTER_KEY` — base64; ≥ 32 decoded bytes. The
  per-record DEK wrap subkey is derived from this via
  `HKDF-SHA-256(master, salt=context, info="aadhaar-vault/dek-wrap")`.
  Production deployments are expected to swap `LocalDevKeyManager` for a
  real KMS provider; the port is stable.

Until both are set, `POST /api/students` and `POST /api/students/bulk-import`
fail with `VaultError NOT_CONFIGURED` (by design — no plaintext fallback).

End-to-end contract is enforced by the integration test suite at
[`backend/tests/aadhaar-hardening.test.ts`](backend/tests/aadhaar-hardening.test.ts)
and [`backend/tests/aadhaar-detokenize.test.ts`](backend/tests/aadhaar-detokenize.test.ts)
(run with `npm test` from `backend/`), and by the read-only at-rest audit
at [`backend/scripts/audit-aadhaar-at-rest.ts`](backend/scripts/audit-aadhaar-at-rest.ts)
(`npm run audit:aadhaar`).

## Rules
 Contributor Onboarding — Onboarding Document (Mandatory)

    Every student contributing to the FLN project is required to submit an Onboarding Document (.md) before their first pull request.
    The document is a record of your understanding of the project and your plan for contributing to it. Submissions that omit any of the sections below will be returned for revision.

    Purpose:

    The Onboarding Document exists to ensure that every contributor:

    1. Has a working understanding of what FLN is and the problem it solves.
    2. Has read the existing codebase and can describe its current state in their own words.
    3. Has independently identified weaknesses, gaps, and risks in the current implementation.
    4. Has formed opinions and proposed ideas for improving the project.
    5. Has a concrete plan for tackling at least one identified gap.
    6. Has produced a tangible contribution (code, documentation, tests, or design) that advances the project.

    Reading the code without forming a view is not enough. The document is intended to surface misunderstanding early and to surface good ideas quickly.

    File Naming and Location:

    - File name: ONBOARDING-<your-name>.md 
    - Location: you have to make the PR in the Ideas folder .
    - Format: Markdown (.md).( PDF, .docx, or plain .txt will not be accepted.)

    Required Sections:

    The document must contain the following six sections, in this order.

    1. What is FLN?

    Describe, in your own words, what FLN stands for, the domain it operates in (Foundational Literacy and Numeracy / education), the population it
    serves, and the problem it aims to solve. Do not copy the project description verbatim — paraphrase it. A reader who has never heard of FLN should be
    able to understand the project's purpose from this section alone.

    2. What do you understand by FLN (as a system)?

    Go beyond the mission statement. Describe FLN as a system: the users (students, teachers, administrators, superadmins), the main entities (schools,
    classes, assessments, worksheets, certifications), and the high-level flow of data through it. This section is about demonstrating that you
    understand how the pieces fit together, not just what the project is for.

    3. Current State of the Repository — What Has Been Done So Far:

    Walk through the repository and describe what already exists:

    - Tech stack (frontend, backend, database, auth, deployment).
    - Implemented features (authentication, role-based access, dashboards, worksheet generation, OMR, analytics, etc.).

    4. Gaps Observed in the Code:

    This is the most important section. List concrete weaknesses, bugs, missing features, or design problems you found while reading the code. You can also pick issues which are stated on FLN git repo and solve them. For each
    gap, include:

    - Where — file path and line range or component.
    - What — what is wrong or missing.
    - Why it matters — the impact on users, maintainability, performance, or correctness.

    5. Ideas for the Project:

    Propose improvements, new features, or refactors that would make FLN better. Each idea should include:

    - What — the proposed change in one or two sentences.
    - Why — the problem it solves or the value it adds.
    - How — a sketch of the implementation


    6. Your Contribution:

    Describe the actual work you have done as part of this onboarding. A contribution can be any of:

    - A bug fix.
    - A new feature or endpoint.
    - A refactor.
    - Tests (unit, integration, or end-to-end).
    - Documentation (this onboarding document counts only if it is exceptional; the document itself is mandatory, not the contribution).
    - A design document or architectural proposal.

    Review Criteria

    A reviewer will check the Onboarding Document against the following:

    - All six sections are present and in order.
    - Section 4 cites real files and real code, not vague impressions.
    - Section 5 ideas are grounded in the gaps from Section 4.
    - The document is written in the contributor's own words, not generated by an AI without understanding.

    A document that reads as if it was written without reading the codebase will be sent back.

### Working Only From Listed Issues (No Self-Invented PRs)

**Every PR must map to an issue or feature already listed on the repo.** Contributors pick work from the issue tracker; nothing self-invented gets built and submitted speculatively — if you think something is missing, raise it as a new issue first and wait for it to be scoped, rather than opening a PR for it directly. Until Version 1 is clean end-to-end, prefer issues labeled [`intern-ready`](https://github.com/vicharanashala/fln/issues?q=is%3Aissue+is%3Aopen+label%3Aintern-ready) — mechanical, well-scoped tasks that don't require a judgment call about platform behavior. Issues without that label may touch pedagogical logic (the level framework, certification distance, diagnostic scoring) or unbuilt backend features, and need core-team review before and during the work — don't self-assign those without checking with a maintainer first.

## Contribution Guidelines

This is an **open-source** project — contributions are welcome. Before contributing:

1. Pick an issue already listed on the repo — see [Working Only From Listed Issues](#working-only-from-listed-issues-no-self-invented-prs) above.
2. Fork the repo (or create a branch if you have write access).
3. Follow the branch naming and PR process below.
4. Keep PRs focused — one feature or one fix per PR.
5. Write clear commit messages describing *what* and *why*.

## Branching & PR Convention

All branches must follow this naming convention (`/`, not `:` — a colon is not a valid character in a git branch name and git will refuse to create one):

| Type | Branch Name Format | Example |
|------|--------------------|---------|
| Feature | `feat/<name-of-feature>` | `feat/auto-question-paper-generation` |
| Fix | `fix/<name-of-fix>` | `fix/scanner-upload-crash-on-android` |
| Chore | `chore/<name>` | `chore/split-backend-routes-batch-a` |
| Docs | `docs/<name>` | `docs/repo-hygiene-changelog-readme` |
| Refactor | `refactor/<name>` | `refactor/level-migration-59-to-93` |

(`chore/`, `docs/`, and `refactor/` aren't new conventions — they're already how the repo's own recent branches are named; this table just documents what's actually in use.)

**Process:**
1. Create a branch using the convention above.
2. Make your changes and commit with clear messages.
3. Push the branch and **raise a Pull Request (PR)** against `main`, referencing the issue it addresses.
4. **Review is two stages, in order: an automated first pass, then human review.** A bot pass may auto-reject a PR with a comment explaining why (fix and resubmit) — it never auto-approves. A PR that passes the automated pass is queued for human review; a maintainer merges it, not the contributor who opened it, and not necessarily the first human to look at it.
5. If you're a new contributor, submit your [Onboarding Document](#rules) (see Rules above) with or before your first PR.

## License

This repository is open source. *(License file to be added — e.g., MIT/Apache 2.0. Update this section once finalized.)*
