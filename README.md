# FLN — Foundational Literacy & Numeracy Assessment Platform

A large-scale, personalized assessment system that helps teachers measure, track, and improve every student's Foundational Literacy and Numeracy (FLN) outcomes — from automatic question paper generation to scanning answer sheets and instant, profile-driven evaluation.

---

## Table of Contents
- [What is FLN?](#what-is-fln)
- [Why FLN Matters](#why-fln-matters)
- [Initiatives](#initiatives)
- [What This Software Does](#what-this-software-does)
- [How It Works (Workflow)](#how-it-works-workflow)
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

## Tech Stack

This project is built on the **MERN stack**:
- **M**ongoDB — database
- **E**xpress.js — backend framework
- **R**eact — frontend
- **N**ode.js — backend runtime

(Specific libraries for OCR/scanning, PDF generation, etc. will be documented as they're added.)

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

Demo login after seeding: `superadmin@fln.org`, password `Fln@2026` (see
`backend/src/seed.ts` for the full list of generated teacher/volunteer/admin
emails, which follow a predictable `role.<state>_<district>_<block>_<school>@fln.org`
pattern).

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


## Contribution Guidelines

This is an **open-source** project — contributions are welcome. Before contributing:

1. Check open issues or discuss the feature/fix you want to work on.
2. Fork the repo (or create a branch if you have write access).
3. Follow the branch naming and PR process below.
4. Keep PRs focused — one feature or one fix per PR.
5. Write clear commit messages describing *what* and *why*.

## Branching & PR Convention

All branches must follow this naming convention:

| Type | Branch Name Format | Example |
|------|--------------------|---------|
| Feature | `feat: <name of feature>` | `feat: auto question paper generation` |
| Fix | `fix: <name of fix>` | `fix: scanner upload crash on android` |

**Process:**
1. Create a branch using the convention above.
2. Make your changes and commit with clear messages.
3. Push the branch and **raise a Pull Request (PR)** against `main` (or the appropriate base branch).
4. PRs should reference the related issue (if any) and briefly describe the change.
5. At least one review/approval is required before merging (process may be refined as the team grows).

## License

This repository is open source. *(License file to be added — e.g., MIT/Apache 2.0. Update this section once finalized.)*
