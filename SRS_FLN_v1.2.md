# Software Requirements Specification (SRS)
# FLN Assessment & Personalized Worksheet Platform (Merged)

**Version:** v1.2 (Merged from SRS v0.1 — Worksheet Generation, and SRS v2.0 — Adaptive Assessment System; fully revised across all sections with the District Admin/Block Admin hierarchy, dual-pair generation lock, fixed 3-cycle assessment calendar, delayed-attempt/defaulter escalation, continuous level revision, and announcement/ticketing systems)
**Subject Scope:** Mathematics FLN (Foundational Literacy & Numeracy), Classes 2–4
**Technology Stack:** MERN (MongoDB, Express.js, React.js, Node.js) + Python (AI/Automation services)
**Document Status:** Draft — v1.2 baseline for review

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Home Page / Landing Page](#2-home-page--landing-page)
3. [Authentication & Role Management](#3-authentication--role-management)
4. [User Roles & Hierarchy](#4-user-roles--hierarchy)
5. [System Architecture](#5-system-architecture)
6. [Core Workflows](#6-core-workflows)
7. [Functional Requirements](#7-functional-requirements)
8. [Scanning & Answer Ingestion (ICR/OCR)](#8-scanning--answer-ingestion-icrocr)
9. [Evaluation Engine](#9-evaluation-engine)
10. [Database Collections (MongoDB)](#10-database-collections-mongodb)
11. [API Overview](#11-api-overview)
12. [Worksheet / Question Paper JSON Schema](#12-worksheet--question-paper-json-schema)
13. [Governance & Access Control](#13-governance--access-control)
14. [Dashboards (Cross-Role)](#14-dashboards-cross-role)
15. [Non-Functional Requirements](#15-non-functional-requirements)
16. [Repository / Folder Structure](#16-repository--folder-structure)
17. [Acceptance Criteria](#17-acceptance-criteria)
18. [Risks](#18-risks)
19. [Out of Scope / Future Versions](#19-out-of-scope--future-versions)
20. [Appendices](#20-appendices)

---

## 1. Introduction

### 1.1 Purpose
This document specifies the requirements for the FLN Assessment & Personalized Worksheet Platform — an AI-driven system that spans from national program oversight down to individual student learning. The platform:

- Places each child on a personalized FLN math level via an AI diagnostic test (new students only).
- Generates **AI-personalized worksheets per student** for printing — generation/print rights are shared across Teacher, School, Volunteer, and Block Admin, gated by a per-class generation lock so only one role produces the paper for a given exam session.
- Runs a fixed national assessment calendar of **three test cycles per academic year** — Baseline (start of year), Mid-year, and End-of-year.
- Captures completed answer sheets via scanning (structured ICR ingestion and/or image-based OCR).
- Evaluates each child's performance using AI and recommends the next level.
- Rolls performance data up through a national governance hierarchy (Superadmin → Admin → District Admin → Block Admin → School → Teacher/Volunteer) for oversight, targeting, and certification.

### 1.2 Scope
This SRS covers a single, unified web application with role-based dashboards, permissions, and workflows for:

- **Superadmin** — National-level oversight (e.g., IIT Ropar / Vicharanashala Lab). Owns curriculum and core pedagogical decisions; does **not** generate question papers.
- **Admin** — State/UT-level management.
- **District Admin** — District-level coordination. *(Renamed from "Subadmin" — same tier, same responsibilities, new label only.)*
- **Block Admin** — Block-level coordination; sits between District Admin and School in the hierarchy; can generate/print papers and oversees Volunteers.
- **School** — Institution-level student/class management (Principal/coordinator account).
- **Teacher** — Classroom-level operator: manages their own class roster, triggers diagnostics, triggers AI-personalized worksheet generation, reviews reports, and conducts exams at schools with adequate student strength. **[from SRS v0.1]**
- **Volunteer** — Field-level execution, reporting under Block Admin: deployed only to schools with low student strength to generate/print papers, conduct assessments, and scan/upload completed sheets. **[from SRS v2.0]**

**[UPDATED DECISION — v1.2]** There is no longer a separate fixed-bank/Question-Bank track, and **Superadmin does not generate any question paper**. All papers are produced through the single AI-personalized generation flow, and **generation/print rights are shared across four roles: Teacher, School (Principal), Volunteer, and Block Admin.** Rather than one universal lock across all four, the system enforces **two independent pairwise locks**, matching the two deployment paths (see §13.2, Rule R-11):
- **High-strength / internet-connected schools:** **Teacher** and **School (Principal)** are the eligible generators. Whichever of the two generates first for a given class/day locks the other out for that same instance.
- **Low-strength / no-internet schools:** **Volunteer** and **Block Admin** are the eligible generators. Whichever of the two generates first for a given class/day locks the other out for that same instance.

Both locks auto-release when the exam cycle for that instance closes. Within a school, **Teacher and Volunteer sit at the same operational tier** — School (Principal), Teacher, and Volunteer are treated as parallel, school-level execution roles for the purpose of generating papers and conducting exams, even though Volunteer accounts are administratively created and managed by Block Admin (§4.7). *Who conducts the exam* is determined by school student strength, not by paper type:
- **High-strength schools** are self-sufficient: the **Teacher** generates/prints and conducts the exam for their own class (School/Principal may also generate, subject to the lock above).
- **Low-strength schools** are visited by exactly **one** of **Volunteer or Block Admin** (never both for the same session), who generates/prints and conducts the exam on-site.

Both paths feed the same Student, Worksheet, AnswerSubmission, and EvaluationReport data model, so a school can be run under either mode without a schema change.

### 1.3 Key Design Principles
> No public sign-up. Every user account is created by a Superadmin or Admin. Volunteers and Teachers only access schools/classes explicitly assigned to them. Every school has a unique School ID, every student has a unique Student ID, and every question maps to exactly one competency. Every student's Aadhar/Birth Certificate number is a mandatory, unique identifier, stored masked for every role except Superadmin. Pedagogical/curriculum decisions are AI/core-team-first: teacher feedback is submitted through an in-app ticketing system and only incorporated after Superadmin-team review.

### 1.4 Scope of v1.0
- Mathematics FLN only (no Literacy).
- Curriculum stored as Markdown files per level, authored by the core team (not editable via UI). AI/core-team pedagogical decisions take first priority; teacher feedback on curriculum or content is submitted via an in-app ticketing system and incorporated only after review by the Superadmin team.
- AI diagnostic test for new-student level placement (one-time, on student onboarding).
- Fixed national assessment calendar: three test cycles per academic year — Baseline (start of year), Mid-year, End-of-year. Diagnostic papers are not level-gated: each covers a mix of questions across levels, and the child is mapped to their weakest demonstrated level; levels are milestones the child is progressed toward with worksheets, not individual test gates the child must clear one at a time.
- Single AI-personalized worksheet-production flow. Generation/print rights are shared across Teacher, School, Volunteer, and Block Admin, governed by two independent pairwise generation locks — {Teacher ↔ School} and {Volunteer ↔ Block Admin} — first to generate locks the paired role out for that class/session; auto-releases when the exam cycle closes.
- Fixed exam-day timing cycle per class: 1-hour print/download access window → 45-minute exam window (30 minutes exam + 15 minutes commute/settling buffer) → 1-hour submission window (scan + upload) — a 2-hour-45-minute total cycle, with a 1-hour gap before the next class's cycle begins.
- Delayed-attempt/defaulter escalation: a submission after the 1-hour submission window closes is logged as a "Delayed Attempt" and triggers a "Not Submitted" alert to the Teacher and Principal. After 3 lifetime Delayed Attempts, a Teacher is permanently blocked from generating/conducting exams and is replaced by a Volunteer, who is granted Teacher Dashboard access for that class going forward. If all Teachers in a school default, School/Teacher dashboard access is locked entirely and reassigned to Block Admin/Volunteer; Admin or Superadmin may manually restore School access at any time.
- Pre-built SVG asset library for AI-personalized worksheets; category-based substitution on missing assets; the image/visual style of questions is refreshed by the core team on a yearly cadence.
- HTML → A4 PDF rendering for worksheets.
- Answer ingestion via two paths: structured ICR JSON (e.g., `{"Q1":"A"}`) and image-based OCR (upload/scanner/camera) with bubble detection, handwriting recognition, and confidence scoring. Dedicated scanners are provided for bulk scanning (~40–50 sheets in 2–3 minutes).
- Python evaluation engine: classification, comparison, scoring, AI narrative report, next-level recommendation. Evaluation processing for a school begins 8 hours after all of that day's classes have closed their submission windows.
- Continuous level/question revision: if 50%+ of students consistently fail a question tagged "easy," the system auto-flags that question for core-team review; Teacher feedback (via the in-app ticketing system) also feeds into level/curriculum revision, subject to Superadmin-team review before any change is applied.
- Full national role hierarchy (Superadmin → Admin → District Admin → Block Admin → School (Principal) → Teacher/Volunteer) with access-control matrix, school/district/state analytics, and audit logbook.
- Mandatory Aadhar/Birth Certificate number as a unique student identifier, masked for all roles except Superadmin.
- Superadmin-only announcement channel, broadcast to all dashboards, with optional email escalation when Superadmin flags an announcement as urgent/important.
- In-app ticketing system for Teacher feedback (curriculum, content, or exam-process issues), routed to a Superadmin review queue; incorporated only after review.

### 1.5 Out of Scope (v1.0)
Adaptive mid-worksheet difficulty, curriculum editing via UI, multi-LLM provider switching UI, real-time collaboration, dropout-tracking/outreach campaigns (e.g. Pratham tie-up), physical student-detail stickers on question papers.

### 1.6 Intended Audience
Developers (MERN + Python), project mentors, curriculum designers, AI engineers, QA, program administrators, and AI coding assistants (Claude Code, Cursor, etc.) implementing modules directly from this spec.

### 1.7 Definitions
| Term | Description |
|---|---|
| FLN | Foundational Literacy and Numeracy |
| ICR | Intelligent Character Recognition — produces structured answer JSON directly from a scan pipeline |
| OCR | Optical Character Recognition — image-based recognition of bubbles/handwriting, with confidence scoring |
| Level Structure | Markdown-defined curriculum level: objectives, topics, activities, difficulty bands |
| Diagnostic Test | Initial AI-generated assessment placing a new student at their correct starting level |
| Worksheet JSON | Structured, validated output of AI worksheet generation |
| Evaluation Engine | Python subsystem scoring a completed assessment and recommending next level |
| Competency | A single, atomic FLN skill/concept that a question maps to |
| District Admin | District-level coordination role (renamed from "Subadmin"; same tier) |
| Block Admin | Block-level coordination role, sitting between District Admin and School; can generate/print papers and oversees Volunteers |
| Generation Lock | Per-class, per-exam-session lock. Two independent pairs — {Teacher ↔ School} and {Volunteer ↔ Block Admin} — where the first role in the pair to generate/print locks the other out of generating for that same class/session; auto-releases when the exam cycle closes |
| Delayed Attempt | A submission made after the 1-hour submission window has closed |
| Defaulter | A Teacher who has exhausted all 3 lifetime Delayed Attempts and is permanently blocked from generating/conducting exams (replaced by a Volunteer with Teacher Dashboard access) |
| Test Cycle | One of three fixed annual assessment windows: Baseline (start of year), Mid-year, End-of-year |
| Ticketing System | In-app channel for Teacher feedback on curriculum/content/process, routed to Superadmin for review before any change is made |
| Level Flag | Auto-generated review flag on a curriculum question when 50%+ of attempting students consistently fail it despite an "easy" difficulty tag |
| Weakest-Level Mapping | Diagnostic placement rule: a child is mapped to the weakest level they demonstrate across a mixed-level diagnostic paper, not tested level-by-level |

---

## 2. Home Page / Landing Page

*(from SRS v2.0)*

### 2.1 Purpose
Public-facing landing page communicating the mission, vision, and scale of the FLN initiative. No login required.

### 2.2 Layout
```
┌─────────────────────────────────────────────────────────────┐
│  [Logo] FLN Assessment                [Vision/Mission] [Login] │
├─────────────────────────────────────────────────────────────┤
│  HERO: "Foundational Literacy & Numeracy — Assessment for   │
│         Every Child, at Their Level"      [CTA → Login]     │
├─────────────────────────────────────────────────────────────┤
│  STATISTICAL OVERVIEW (Cards): States | Districts | Schools │
│                                 Assessments | FLN Score      │
├─────────────────────────────────────────────────────────────┤
│  VISION & MISSION                                            │
├─────────────────────────────────────────────────────────────┤
│  GENERAL KNOWLEDGE CARDS (quotes, ASER/NAS stats, images)   │
├─────────────────────────────────────────────────────────────┤
│  FOOTER (About · Contact · Privacy · © FLN)                 │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Requirements
| ID | Requirement | Description |
|----|-------------|-------------|
| H-1 | Public Access | Home page accessible without authentication |
| H-2 | Login Button | Fixed in the upper-right corner |
| H-3 | Vision & Mission | Dedicated section |
| H-4 | Statistical Cards | Total States, Districts, Schools, Students, Assessments, National FLN Score |
| H-5 | Knowledge Cards | Educational quotes, ASER/NAS statistics, images |
| H-6 | No Sign-Up | New users are created only by Superadmin/Admin |
| H-7 | Responsive | Desktop, tablet, mobile |

---

## 3. Authentication & Role Management

*(from SRS v2.0)*

### 3.1 Login Page
```
┌──────────────────────────────────────┐
│           LOGIN                       │
│   [ Email / Username           ]      │
│   [ Password              👁   ]      │
│   [         Sign In          ]        │
│   ⚠ Invalid email or password         │
│   [Back to Home]                      │
└──────────────────────────────────────┘
```

### 3.2 Requirements
| ID | Requirement | Description |
|----|-------------|-------------|
| A-1 | No Role Dropdown | Role is resolved server-side from credentials |
| A-2 | Email Domain Convention | Structured addresses under a common, shortened domain: `@fln.org` |
| A-3 | Password Rules | Min 8 chars, 1 uppercase, 1 number, 1 special character |
| A-4 | Eye Icon Toggle | Toggles password visibility |
| A-5 | Error Message | `"Invalid email or password"` |
| A-6 | Role Mapping | Backend maps user → `superadmin \| admin \| district_admin \| block_admin \| school \| teacher \| volunteer` |
| A-7 | Session | JWT-based, 7-day expiry |
| A-8 | Redirect | Role-specific dashboard on login |

### 3.3 Email Naming Convention
**Domain shortened from `fln-assessment.org` to `fln.org`.**

| Role | Pattern | Example |
|------|---------|---------|
| Superadmin | `superadmin@fln.org` | One account, head of project |
| Admin (State/UT) | `admin.<state-code>@fln.org` | `admin.pb@fln.org` |
| District Admin | `district.<district-code>@fln.org` | `district.ldh@fln.org` **[renamed from Subadmin]** |
| Block Admin | `block.<block-code>@fln.org` | `block.ldh-01@fln.org` **[new]** |
| School | `<school-id>@fln.org` | `gps-mt-001@fln.org` |
| Teacher | `<school-id>.t<n>@fln.org` | `gps-mt-001.t01@fln.org` |
| Volunteer | `vol.<name>@fln.org` | `vol.rahul@fln.org` |

---

## 4. User Roles & Hierarchy

### 4.1 Role Hierarchy Diagram
```
Superadmin (National)
    │   owns curriculum/pedagogy; sets/monitors exam cycles; does NOT generate papers
    │
    ├── Admin (State/UT)
    │       │
    │       ├── District Admin  (same tier as legacy "Subadmin"; renamed only)
    │       │       │
    │       │       └── Block Admin  ── block-level coordination; can generate/print papers
    │       │               │
    │       │               ├── Volunteer(s)  ── administratively managed here;
    │       │               │                     deployed to low-strength / no-internet schools
    │       │               │                     (paired generation lock with Block Admin)
    │       │               │
    │       │               └── School (Principal)
    │       │                       │
    │       │                       ├── Teacher(s)  ── owns class(es); paired generation
    │       │                       │                   lock with School (Principal)
    │       │                       └── Students
    │
    └── ... (more states)
```
> Operationally, **School (Principal), Teacher, and Volunteer sit at the same school-level execution tier** — whichever of them is present/eligible for a given school generates papers and conducts the exam. Volunteer's *account* is created and managed by Block Admin; Teacher's *account* is created and managed by School.

### 4.2 Superadmin
**Scope:** Head of project; access to all data across all states; owns curriculum and all core pedagogical decisions.
**Key Actions:** Set/monitor the fixed 3-cycle national assessment calendar (Baseline/Mid-year/End-of-year); manage Admin accounts; view all-India analytics and certification overview; author/update curriculum Markdown and the periodic (yearly) image/visual-style refresh; review the auto-flagged questions (50%+ easy-question failure rule) and the Teacher-feedback ticketing queue, and approve curriculum/level changes; own and post to the announcement channel, with optional email escalation for items marked urgent; manually restore a locked-out School's dashboard access if needed. **Superadmin never generates a question paper.**

### 4.3 Admin (State/UT)
**Scope:** One admin per state/UT; state-scoped data only.
**Key Actions:** District overview; flag lagging districts (<40% FLN certification); school-level drill-down; manage District Admin accounts; view state FLN certification %; may manually restore a locked-out School's dashboard access.

### 4.4 District Admin *(renamed from "Subadmin" — same tier, same responsibilities)*
**Scope:** District-level coordination.
**Key Actions:** Oversee Block Admins and their assigned blocks; district-wide data-flow dashboard (Conducted → Scanned → Evaluated → Certified) with bottleneck flags; view per-school/per-block performance; manage Block Admin accounts.

### 4.5 Block Admin *(new tier, between District Admin and School)*
**Scope:** Block-level coordination; sits between District Admin and School.
**Key Actions:** Manage Volunteer accounts and assignments; for low-strength/no-internet schools — generate/print question papers and set the exam date (paired generation lock with Volunteer, §13.2 R-11); add students collected by Volunteers to the student database; take over School/Teacher dashboard access if a school is fully locked out for defaulting (§6.5); block-level analytics.

### 4.6 School (Principal)
**Scope:** One login per school (unique School ID); manages that school's students/classes.
**Key Actions:** Add/manage Teacher accounts for the school; verify student details (Aadhar/Birth Certificate) submitted at onboarding and add block details; for high-strength/internet schools — generate/print question papers for all classes (paired generation lock with Teacher, §13.2 R-11); class-wise analytics and mastery; competency/learning-gap reports; concept-focus suggestions per class.

### 4.7 Teacher — *[from SRS v0.1, School-level sub-role]*
**Scope:** Owns one or more classes within a school; workspace isolated to their own class(es) only.
**Key Actions:**
- Manage own class roster; add students.
- Trigger AI diagnostic test for a newly added student (mixed-level diagnostic; student mapped to weakest demonstrated level, §6.1).
- Generate/print AI-personalized worksheets for their class within the 1-hour print window, subject to the Teacher↔School generation lock (§13.2 R-11) — for schools with adequate student strength.
- Conduct the exam within the 45-minute exam window and submit within the 1-hour submission window (§6.4).
- Upload/process scanned answer sheets (ICR structured JSON or OCR image).
- View AI-generated narrative reports and student progress history.
- Submit curriculum/content/process feedback via the in-app ticketing system (§7, FR-12).
- Subject to the Delayed-Attempt/Defaulter escalation policy (§6.5): permanently blocked after 3 lifetime Delayed Attempts.

### 4.8 Volunteer
**Scope:** Field worker, administratively reporting under **Block Admin**; accesses only schools explicitly assigned to them — deployed only to schools with low student strength or no internet connectivity.
**Key Actions:** View assigned schools; generate/print AI-personalized papers on-site, subject to the Volunteer↔Block Admin generation lock (§13.2 R-11); conduct the exam on-site; collect new-student details (Aadhar/Birth Certificate + basic info) for Block Admin to add to the database; scan & upload (file, direct scanner, or camera); manual verification of low-confidence OCR results; reprocess scans; view scan/logbook history. Takes over Teacher Dashboard access automatically if a Teacher is marked Defaulter (§6.5), or School/Teacher dashboard access if an entire school defaults.

### 4.9 Role Comparison Summary
| Capability | Superadmin | Admin | District Admin | Block Admin | School (Principal) | Teacher | Volunteer |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| National/all-India data | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Set/monitor assessment calendar | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage accounts (next tier down) | Admins | District Admins | Block Admins | Volunteers | Teachers | — | — |
| Add/remove students | ❌ | ❌ | ❌ | ✅ (volunteer-sourced) | ✅ (verify + block details) | ✅ (own class) | Collects details only |
| Trigger diagnostic | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Generate/print papers | ❌ | ❌ | ❌ | ✅ (paired w/ Volunteer) | ✅ (paired w/ Teacher) | ✅ (paired w/ School) | ✅ (paired w/ Block Admin) |
| Conduct exam | ❌ | ❌ | ❌ | Low-strength schools only | ❌ | High-strength schools | Low-strength schools only |
| Scan & upload answers | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Post/broadcast announcements | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Submit curriculum feedback ticket | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Review/approve curriculum tickets | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manually restore locked School access | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View reports for own scope | ✅ | ✅ (state) | ✅ (district) | ✅ (block) | ✅ (school) | ✅ (class) | ✅ (assigned schools) |

---

## 5. System Architecture

*(from SRS v0.1, extended with the role hierarchy)*

```
                              Role-based Dashboards (React)
   Superadmin / Admin / District Admin / Block Admin / School (Principal) / Teacher / Volunteer
                                    │
                                    ▼
                         Express.js REST API (Node)
              (incl. Generation-Lock Service + Delayed-Attempt/Defaulter Engine)
                                    │
       ┌────────────────┬──────────┼──────────┬────────────────┐
       ▼                ▼          ▼          ▼                ▼
    MongoDB        Python AI      SVG Asset   OCR/Scan       LLM Provider
  (Users, Roles,   Services       Store       Pipeline
   Schools,       (Diagnostics,
   Students,      Generation,
   Worksheets,    Evaluation,
   Reports, Logs, Level-Flag
   Announcements, Review,
   Tickets))
```

- **Node.js** owns: authentication, role/permission enforcement (per §13 access-control matrix), CRUD across all entities, API surface for the React frontend, orchestration of Python service calls, the **Generation-Lock Service** (enforces the two pairwise locks in §13.2 R-11), and the **Delayed-Attempt/Defaulter Engine** (tracks submission-window compliance, issues alerts, escalates per §6.5).
- **Python** owns: all AI logic — diagnostic generation, level placement (mixed-level, weakest-level mapping), AI-personalized worksheet generation, prompt construction, SVG resolution, evaluation/scoring, report narrative generation, and the **Level-Flag service** (auto-flags a question when 50%+ of attempting students fail it despite an "easy" tag). Hidden entirely behind the Node API.
- **Curriculum** is authored as Markdown files (one per level), read by the Python generation service; added/revised by the core team following Superadmin review, not directly editable via UI. Revision inputs are the Level-Flag service and the Teacher-feedback ticketing queue.
- There is a single, AI-personalized worksheet-production path only — no separate fixed question-bank collection. All four generation-eligible roles (Teacher, School, Volunteer, Block Admin) call the same generation service, subject to the Generation-Lock Service.
- **OCR/Scan Pipeline** (image preprocessing, bubble detection, handwriting recognition, confidence scoring) sits alongside the ICR structured-JSON ingestion path; both feed the same Evaluation Engine.

---

## 6. Core Workflows

### 6.1 Student Verification & Onboarding
```
Aadhar / Birth Certificate collected at enrollment
        │
        ▼
┌───────────────────────────┬───────────────────────────────┐
│  High-strength schools    │  Low-strength / no-internet    │
│  School verifies details  │  Volunteer collects student    │
│  + adds block details     │  details in the field          │
│        │                  │        │                       │
│        ▼                  │        ▼                       │
│  Teacher adds student     │  Block Admin adds student       │
│  to class roster          │  to the database                │
└───────────┬───────────────┴───────────────┬───────────────┘
            └───────────────┬────────────────┘
                             ▼
              Student Database (Aadhar/Birth Certificate
              number stored as mandatory, unique identifier;
              masked for all roles except Superadmin)
```

### 6.2 New Student Diagnostic (Mixed-Level, Weakest-Level Mapping)
```
Student added to class (Teacher) or database (Block Admin)
        │
        ▼
System triggers AI Diagnostic Test — NOT level-gated:
    a single mixed-level paper spanning multiple levels,
    not a sequence of per-level pass/fail gates
        │
        ▼
Student completes diagnostic (printed/scanned via ICR or OCR)
        │
        ▼
Evaluation Engine scores diagnostic across all levels covered
        │
        ▼
AI maps student to their Weakest demonstrated level (Current Level)
+ sets Target Level
        │
        ▼
Student Profile created with starting level;
Teacher subsequently uses worksheets to progress the child
  toward higher levels (levels are milestones, not test gates)
```

### 6.3 Class Worksheet Generation — High-Strength / Internet Schools (Teacher ↔ School)
```
Block Admin / District Admin sets the exam date for the current Test Cycle
(Baseline / Mid-year / End-of-year)
        │
        ▼
Teacher OR School (Principal) clicks "Generate Worksheets" for a class
  (whichever generates first LOCKS the other out for that class/session
   — Generation Lock, §13.2 R-11)
        │
        ▼
For each student:
    Read student's current level (weakest-level mapping, §6.2)
    Python reads matching curriculum Level .md file(s)
    AI Prompt Builder constructs prompt
    LLM returns Worksheet JSON (validated)
    SVG Asset Resolver maps asset names → SVG files
        (missing → same-category substitution, logged)
    HTML Renderer builds A4 worksheet
    PDF Generator exports
        │
        ▼
Generator (Teacher or School) receives one PDF per student
(or combined batch PDF), available within the 1-hour print window (§6.4)
        │
        ▼
Generation Lock auto-releases when the exam cycle for this
instance closes
```

### 6.4 Class Worksheet Generation — Low-Strength / No-Internet Schools (Volunteer ↔ Block Admin)
```
Block Admin sets the exam date for the assigned school
        │
        ▼
Volunteer OR Block Admin generates/prints the paper on-site
  (whichever generates first LOCKS the other out for that
   class/session — same Generation Lock mechanism, §13.2 R-11)
        │
        ▼
Exactly ONE of {Volunteer, Block Admin} travels to the school
and conducts the exam (never both for the same session)
        │
        ▼
Same generation/render pipeline as §6.3 (AI-personalized, SVG,
HTML → PDF) — no separate fixed-bank/question-bank path
        │
        ▼
Generation Lock auto-releases when the exam cycle closes
```

### 6.5 Exam-Day Timing Cycle & Delayed-Attempt/Defaulter Escalation
```
Per class, per exam day:
  1-hour PRINT/ACCESS WINDOW  (download + print, opens 1 day
                                after generation, i.e. "1 day prior")
        │
        ▼
  45-minute EXAM WINDOW  (30 min exam + 15 min commute/settling buffer)
        │
        ▼
  1-hour SUBMISSION WINDOW  (scan + upload; bulk scanner handles
                              ~40–50 sheets in 2–3 minutes)
        │
        ▼
  Total cycle: 2 hr 45 min  |  1-hour gap before the next class's cycle

If NOT submitted within the Submission Window:
        │
        ▼
  "Not Submitted" alert → Teacher + Principal
        │
        ▼
  Any later submission attempt is logged as a "Delayed Attempt"
        │
        ▼
  Delayed Attempt count reaches 3 (LIFETIME, permanent)?
        │
   ┌────┴─────┐
  YES          NO → Teacher continues normally
   │
   ▼
  Teacher permanently blocked from generating/conducting exams
  → replaced by a Volunteer, who is granted Teacher Dashboard
    access for that class (permanent; does not reset)
        │
        ▼
  If ALL Teachers in a school are Defaulters:
    School/Teacher dashboard access is locked entirely
    → reassigned to Block Admin / Volunteer
        │
        ▼
    Admin or Superadmin may manually restore School access
    at any time (§13.2 R-12)
```

### 6.6 Assessment & Reporting (either generation path, converges)
```
Completed sheets → scanned/ingested (ICR JSON or OCR image)
        │
        ▼
Evaluation processing for a school begins 8 hours after all
of that day's classes have closed their submission windows
        │
        ▼
Python Evaluation Engine:
    - Compares answers to answer key
    - Classifies question type/difficulty
    - Scores performance
    - AI generates narrative report (strengths, weaknesses, mistakes)
    - AI recommends next level
    - Flags any question where 50%+ of students failed an
      "easy"-tagged item for core-team review (Level Flag, §6.7)
        │
        ▼
Student profile updated: level history, report stored
        │
        ▼
Dashboards updated at Teacher/School/Block Admin/District Admin/
Admin/Superadmin level per their scope
```

### 6.7 Continuous Level & Curriculum Revision
```
Two independent feeds into curriculum/level revision:

(a) Level Flag (automatic)              (b) Teacher Feedback (manual)
    50%+ of students fail an                Teacher submits an in-app
    "easy"-tagged question in the           ticket (curriculum, content,
    Evaluation Engine  ───────┐             or exam-process issue)
                               │                        │
                               ▼                        ▼
                         Superadmin Review Queue (§7, FR-12)
                               │
                               ▼
                  Superadmin team approves/rejects
                               │
                               ▼
        Approved changes applied to curriculum Markdown files
        (core team edits; still not directly UI-editable, §5)
```

---

## 7. Functional Requirements

**FR-1 Authentication & Roles**
- JWT authentication for all seven roles; no public sign-up; accounts created only by Superadmin/Admin (Teacher accounts created by School — see §4.5).
- Dashboards scoped strictly to each role's own data (see §13 access-control matrix).

**FR-2 Curriculum**
- Curriculum loaded from per-level Markdown files, core-team maintained.
- Each question is tagged to exactly one competency and a difficulty band (Easy/Medium/Hard).

**FR-3 Student Profile Management**
- Store: Student ID (unique, persistent), Name, Age, Class, Section, School, Teacher (if applicable), Current Level, Target Level, Level History, Worksheet/Paper History, Report History.

**FR-4 Diagnostic Test**
- AI-generated diagnostic for any new student with no level history; determines Current Level and Target Level.

**FR-5 Worksheet / Paper Generation**
- Single AI-personalized generation flow: one-click batch generation, one worksheet per student at their current level; AI outputs structured Worksheet JSON only, validated (reject/regenerate on schema failure).
- Generation/print rights shared across Teacher, School (Principal), Volunteer, and Block Admin, governed by two independent pairwise generation locks (§13.2 R-11).

**FR-6 SVG Asset Management** *(AI-personalized flow only)*
- Categorized, pre-built SVG library (fruits, animals, shapes, numbers, tracing); no AI-generated assets.
- Missing asset → same-category substitution (or generic placeholder), logged for future library coverage, never blocks generation.

**FR-7 Worksheet Rendering**
- Worksheets render to an HTML → A4 print-ready PDF.

**FR-8 Answer Ingestion**
- *ICR path:* structured JSON per student (e.g. `{"Q1":"A","Q2":"5"}`), no raw image OCR needed.
- *OCR path:* accept PNG/JPG/PDF upload, direct scanner (TWAIN/SANE), or camera capture; preprocess (grayscale, deskew, contrast); bubble detection; handwritten numeral/symbol recognition (0–9999, +, −, =, ×, ÷); per-answer confidence score (0–100%); manual verification/override for low-confidence results; reprocess option.

**FR-9 Evaluation Engine**
- Compare submitted answers to the answer key; classify each question by type/difficulty; compute performance score; generate AI narrative report (strengths, weaknesses, mistake patterns, recommended next level).

**FR-10 Reporting & Dashboards (per role)**
- Teacher: class roster with level/last worksheet/last report/progress history.
- School: class-wise mastery, competency/learning-gap reports, concept suggestions.
- District Admin: district-level analytics, data-flow pipeline status, bottleneck flags, Block Admin oversight.
- Block Admin: block-level analytics, Volunteer tracking, school performance overview.
- Admin: district rankings, lagging-district flags, FLN certification %.
- Superadmin: national/state-wise analytics, certification overview.

**FR-11 Logbook & Audit**
- Auto-log every significant action (download, print, conduct, scan, verify) with date/school/activity/status; filterable by date/school/activity type; exportable as CSV/PDF; visible to Volunteer, Block Admin, and above.

---

## 8. Scanning & Answer Ingestion (ICR/OCR)

*(from SRS v2.0, reconciled with SRS v0.1's ICR-JSON path)*

### 8.1 Two Ingestion Paths
| Path | Used By | Input | Output |
|---|---|---|---|
| ICR (structured) | Teacher flow | Pre-processed structured JSON from ICR scanner hardware/software | `{"Q1":"A","Q2":"5"}` — no image processing needed by the platform |
| OCR (image-based) | Volunteer flow | Uploaded/scanned/camera image | Bubble detection + handwriting recognition + confidence score, resolved to the same structured answer format |

### 8.2 Scan Interface (OCR path)
```
┌─────────────────────────────────────────────────────────────┐
│  SCAN & OCR                              [Volunteer View]   │
│  📤 Upload File   OR   📷 Capture Camera   OR 🖨 Connect Scanner │
│  PROCESSING STATUS                                            │
│  ● Image Preprocessing   ✅   ● Bubble Detection  ✅ 30/30    │
│  ● OCR Processing        ⏳   ● Evaluation        ⏳          │
│  CONFIDENCE SCORE: 87%  — 3 answers below 90%, review needed  │
│  [✅ Accept All]  [✏ Manual Verify]  [🔄 Reprocess]           │
│  SCAN HISTORY: Date | School | Status | Confidence | Action  │
└─────────────────────────────────────────────────────────────┘
```

### 8.3 Requirements
| ID | Requirement | Description |
|----|-------------|-------------|
| OCR-1 | File Upload | Accept PNG, JPG, PDF |
| OCR-2 | Direct Scanner | TWAIN/SANE auto-capture |
| OCR-3 | Camera Capture | Optional; validate clarity, prompt retake if blurry |
| OCR-4 | Preprocessing | Grayscale, deskew, contrast enhancement |
| OCR-6 | Handwritten OCR | Numerals (0–9999) and symbols (+, −, =, ×, ÷) |
| OCR-7 | Confidence Score | Per-answer, 0–100% |
| OCR-8 | Manual Verification | Teacher/Volunteer review and override on low confidence |
| OCR-9 | Reprocess | Re-run OCR on a scan |
| OCR-10 | Scan History | Full log with status/timestamps |
| ICR-1 | Structured Ingestion | Accept pre-structured JSON directly, bypassing image OCR entirely |

---

## 9. Evaluation Engine

*(from SRS v0.1, applies to both ICR and OCR-sourced answers)*

Evaluates **student performance after the assessment is attempted**, not worksheet quality. Implemented in Python, three stages (derived from `0_auto_classify_questions.py`, `1_compare_answers.py`, `2_evaluate_child.py`):

**Stage 1 — Question Classification:** each question auto-classified by type/difficulty via AI prompt (`classify_question.txt`) → structured question→concept/difficulty map. Classification runs against the generated Worksheet JSON.

**Stage 2 — Answer Comparison:** submitted answers (from ICR JSON or resolved OCR output) compared against the stored answer key → per-question correct/incorrect result set.

**Stage 3 — Child Evaluation & Reporting:** AI prompt (`evaluate_child.txt` → `generate_report.txt`) consumes classification + comparison results to produce:
- Overall performance score
- Strengths (concepts mastered) / Weaknesses (concepts struggled with)
- Observed mistake patterns
- Recommended next level
- Narrative summary for the Teacher/Volunteer/School

**Score Output Example**
```
Correct Answers      18 / 20
Concept Mastery      Counting: Strong | Patterns: Needs Practice
Confidence (OCR)     87% (3 answers manually verified)
Recommended Level    Level 5 (up from Level 4)
```

Runs independently of worksheet/paper generation; triggered only after answers are ingested (either path).

---

## 10. Database Collections (MongoDB)

| Collection | Purpose |
|---|---|
| **Users** | All role accounts (Superadmin/Admin/District Admin/Block Admin/School/Teacher/Volunteer), credentials, role mapping |
| **States / Districts / Blocks** | Hierarchy nodes for Admin/District Admin/Block Admin scoping |
| **Schools** | School ID, name, district/state/block reference, assigned Teachers/Volunteers |
| **Classes** | Teacher-owned class groupings within a school |
| **Students** | Profile, current/target level, level history, Aadhar/Birth Certificate (masked), class/school reference |
| **Curriculum** | Metadata/index referencing Markdown level files |
| **Worksheets** | AI-generated worksheet JSON, associated student, level, timestamp, PDF reference |
| **AnswerSubmissions** | Structured answers per student per worksheet (from either ICR or resolved OCR) |
| **EvaluationReports** | Scores, narrative feedback, recommended next level, confidence data, linked to student + worksheet |
| **SVGAssets** | Categorized pre-built asset library, version |
| **AssetSubstitutionLog** | Missing-asset resolution log |
| **PromptTemplates** | Reusable AI prompt templates (diagnostics, generation, evaluation) |
| **Logbook** | Audit trail of all significant actions (download/print/conduct/scan/verify) |
| **Certifications** | FLN certification status per student, issued when competency requirements are met |
| **Announcements** | Superadmin-posted announcements with optional email escalation flag |
| **Tickets** | Teacher-submitted feedback tickets, routed to Superadmin review queue |

---

## 11. API Overview

**Auth**
`POST /api/auth/login`
`POST /api/auth/register` (Superadmin/Admin provisioning; School provisions Teacher accounts)

**Hierarchy / Org**
`GET /api/states` · `GET /api/districts/:stateId` · `GET /api/schools/:districtId`
`GET /api/classes/:teacherId` · `POST /api/students` · `GET /api/students/:id` · `GET /api/students/:id/history`

**Diagnostics**
`POST /api/diagnostics/generate`
`POST /api/diagnostics/:studentId/submit`

**AI-Personalized Worksheets (Teacher flow)**
`POST /api/worksheets/generate-class/:classId`
`GET /api/worksheets/:id` · `GET /api/worksheets/student/:studentId`

**Worksheets (Volunteer/Block Admin flow — low-strength schools)**
`POST /api/worksheets/generate-class/:classId` (Volunteer/Block Admin, subject to generation lock)
`GET /api/worksheets/:id` · `GET /api/worksheets/student/:studentId`

**Answer Ingestion / Scanning**
`POST /api/evaluation/submit` — ICR structured JSON in
`POST /api/scan/upload` — image/PDF, triggers OCR pipeline
`GET /api/scan/:id/status` — preprocessing/bubble-detection/OCR/evaluation status
`POST /api/scan/:id/verify` — manual override on low-confidence answers
`POST /api/scan/:id/reprocess`

**Evaluation & Reports**
`GET /api/evaluation/:studentId/latest` · `GET /api/evaluation/:studentId/history`

**SVG Assets**
`GET /api/assets` · `GET /api/assets/substitution-log`

**Analytics (role-scoped)**
`GET /api/analytics/national` (Superadmin) · `GET /api/analytics/state/:id` (Admin)
`GET /api/analytics/district/:id` (District Admin) · `GET /api/analytics/block/:id` (Block Admin)
`GET /api/analytics/school/:id` (School/Teacher/Volunteer)

**Logbook**
`GET /api/logbook` (filterable by date/school/activity) · `GET /api/logbook/export`

---

## 12. Worksheet JSON Schema (Single AI-Personalized Flow)

### 12.1 Worksheet JSON
```json
{
  "studentId": "string",
  "level": "string",
  "worksheetTitle": "string",
  "questions": [
    {
      "id": "Q1",
      "type": "count | compare | trace | pattern | arithmetic",
      "instruction": "string",
      "asset": "string (svg asset name, optional)",
      "count": "number (optional)",
      "answer": "string"
    }
  ]
}
```

*Note: There is no separate fixed-bank schema. All question papers use the single AI-personalized Worksheet JSON schema (12.1).*

---

## 13. Governance & Access Control

### 13.1 Access Control Matrix
| Feature | Superadmin | Admin | District Admin | Block Admin | School (Principal) | Teacher | Volunteer |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| All-India Data | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| State Data | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| District Data | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Block Data | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| School Data | ✅ | ✅ | ✅ | ✅ | ✅ | Own class only | Assigned only |
| Student Data | ✅ | ✅ | ✅ | ✅ | ✅ | Own class only | During assessment |
| Set assessment calendar | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Trigger AI Diagnostic | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Generate/print worksheets | ❌ | ❌ | ❌ | ✅ (pair w/ Volunteer) | ✅ (pair w/ Teacher) | ✅ (pair w/ School) | ✅ (pair w/ Block Admin) |
| Conduct exam | ❌ | ❌ | ❌ | Low-strength only | ❌ | High-strength only | Low-strength only |
| Scan & Upload | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage Admins | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage District Admins | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Block Admins | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage Volunteers | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Manage Teachers | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Add/Remove Students | ❌ | ❌ | ❌ | ✅ (vol-sourced) | ✅ | ✅ (own class) | Collects only |
| Post announcements | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Submit feedback tickets | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Review/approve tickets | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Restore locked School access | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Certification View | ✅ | ✅ (state) | ✅ (district) | ✅ (block) | ✅ (school) | ✅ (own class) | ❌ |
| View reports (own scope) | ✅ | ✅ (state) | ✅ (district) | ✅ (block) | ✅ (school) | ✅ (class) | ✅ (assigned) |

### 13.2 Governance Rules
| Rule | Description |
|------|-------------|
| R-1 | No public sign-up; all accounts created by Superadmin/Admin (Teacher accounts by School) |
| R-2 | Volunteers/Teachers only see and access schools/classes explicitly assigned to them |
| R-3 | Every school has a unique School ID |
| R-4 | Every student has a unique, persistent Student ID |
| R-5 | Every question maps to exactly one competency |
| R-6 | Every student's Aadhar/Birth Certificate number is a mandatory, unique identifier, stored masked for all roles except Superadmin |
| R-7 | Certificates generated only after all competency requirements are met |
| R-8 | AI-personalized worksheets validate against the Worksheet JSON schema before rendering; invalid output is rejected/regenerated |
| R-9 | Missing SVG assets are substituted from the same category and logged, never blocking generation |
| R-10 | The image/visual style of questions is refreshed by the core team on a yearly cadence |
| R-11 | **Generation Lock (pairwise):** Two independent locks — {Teacher ↔ School (Principal)} and {Volunteer ↔ Block Admin}. Whichever role in a pair generates/prints first for a given class/day locks the other out for that same instance. Both locks auto-release when the exam cycle for that instance closes |
| R-12 | **Delayed-Attempt/Defaulter escalation:** After 3 lifetime Delayed Attempts (submissions after the 1-hour window), a Teacher is permanently blocked from generating/conducting exams. A Volunteer takes over with Teacher Dashboard access. If all Teachers in a school default, School/Teacher dashboard access is reassigned to Block Admin/Volunteer; Admin or Superadmin may manually restore School access at any time |
| R-13 | **Announcement channel:** Superadmin-only broadcast to all dashboards, with optional email escalation when flagged as urgent/important |
| R-14 | **Ticketing system:** Teacher feedback on curriculum/content/process is submitted via an in-app ticket, routed to Superadmin review queue; incorporated only after Superadmin-team approval |
| R-15 | **Level auto-flag:** If 50%+ of students consistently fail an "easy"-tagged question, the system flags it for core-team review |
| R-16 | **Curriculum revision:** All curriculum/level changes are subject to Superadmin-team review and approval before being applied |

---

## 14. Dashboards (Cross-Role)

### 14.1 Common Layout
```
┌─────────────────────────────────────────────────────────────┐
│  SIDEBAR (Role-specific nav)              [User] [Logout]   │
├──────────┬──────────────────────────────────────────────────┤
│  Nav     │  Summary Cards → Table/Chart → Search + Filters  │
└──────────┴──────────────────────────────────────────────────┘
```

### 14.2 Shared UI Components
| Component | Description |
|-----------|-------------|
| Sidebar Navigation | Role-specific menu |
| Summary Cards | Metric + icon + trend indicator |
| Data Tables | Sortable, searchable, paginated |
| Search Bar | Global search within current view |
| Filters | Dropdowns, date pickers, checkboxes |
| Charts | Bar/line/heatmap for performance data |
| Drill-Down | Clickable rows → detailed views |
| Export | CSV/PDF |

### 14.3 Role-Specific Highlights
- **Superadmin:** state-wise map/table, district drill-down, certification overview, announcement channel (post + email escalation for urgent), ticket review queue.
- **Admin:** state ranking, learning-gap analysis, lagging-district flags (<40%), district performance table.
- **District Admin:** Block Admin tracking, data-flow pipeline (Conducted→Scanned→Evaluated→Certified) with bottleneck flags, district-wide performance dashboards.
- **Block Admin:** Volunteer tracking and assignments, low-strength school paper generation, block-level analytics, escalate defaulting schools.
- **School (Principal):** class-wise overview, concept suggestions, quick actions (add/remove student, class report), generate/print for high-strength schools.
- **Teacher:** class roster, per-student level/worksheet/report status, "Generate Worksheets" one-click action, submit feedback tickets.
- **Volunteer:** assigned low-strength schools, generate/print papers, scan/logbook history, exam conduct.

---

## 15. Non-Functional Requirements

### 15.1 Performance
| ID | Requirement |
|----|-------------|
| NFR-1 | Single-student AI worksheet generation completes within ~30 seconds | 
| NFR-2 | Batch generation processes students in parallel/queued fashion with UI progress feedback |
| NFR-3 | Dashboard pages load under 3 seconds |
| NFR-4 | Search results return under 2 seconds |
| NFR-5 | Support 1000+ concurrent users |
| NFR-6 | Database designed for 1M+ student records |

### 15.2 Security
| ID | Requirement |
|----|-------------|
| NFR-7 | JWT auth, 7-day expiry, refresh mechanism |
| NFR-8 | Passwords hashed with bcrypt |
| NFR-9 | Role-based access enforced at both API and UI level |
| NFR-10 | Data encrypted at rest |
| NFR-11 | HTTPS required for all communication |
| NFR-12 | Per-teacher/per-volunteer data isolation |

### 15.3 Reliability
| ID | Requirement |
|----|-------------|
| NFR-13 | Graceful handling of AI failures (retry/regeneration) |
| NFR-14 | Missing SVG assets handled via same-category substitution, never blocking |
| NFR-15 | Malformed AI JSON rejected with validation error, regenerated |
| NFR-16 | System uptime 99.9% when connected |


### 15.5 Usability
| ID | Requirement |
|----|-------------|
| NFR-20 | Teacher/Volunteer training(using scanner or using dashboard) time under 30 minutes |
| NFR-21 | Worksheets/papers must render correctly in black-and-white and fit the defined A4 print size |

### 15.6 Audit & Compliance
| ID | Requirement |
|----|-------------|
| NFR-22 | All user actions logged immutably (audit trail / Logbook) |
| NFR-23 | Data retention minimum 3 years |
| NFR-24 | Compliance with RTE Act 2009 data provisions |

### 15.7 Maintainability
| ID | Requirement |
|----|-------------|
| NFR-25 | Clear separation between Node (API/orchestration) and Python (AI/evaluation) services |
| NFR-26 | Modular curriculum files, independently updatable |

---

## 16. Repository / Folder Structure

```
fln-platform/
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/               # per-role dashboards, home, login
│   │   ├── services/
│   │   └── assets/
├── server/                     # Node/Express orchestration layer
│   ├── controllers/
│   ├── routes/
│   ├── models/                 # Users, Schools, Students, Worksheets, Papers, ...
│   ├── middleware/              # role-based access control
│   └── services/                # calls into Python services via REST
├── automation/                  # Python services
│   ├── diagnostics/
│   ├── generation/               # AI-personalized worksheet gen
│   ├── svg_resolver/
│   ├── ocr_pipeline/              # preprocessing, handwriting OCR
│   ├── evaluation/
│   ├── prompts/
│   └── utils/
├── curriculum/
│   └── levels/
│       ├── Level1.md
│       └── ...
├── assets/
│   └── svg/
│       ├── fruits/ animals/ shapes/ numbers/ tracing/
├── docs/
│   └── SRS_Merged_FLN_Platform.md
└── README.md
```

---

## 17. Acceptance Criteria

- [ ] All seven roles authenticate correctly and are scoped per the access-control matrix (§13.1).
- [ ] A new student triggers an AI diagnostic test that correctly assigns a Current Level.
- [ ] Teacher can one-click generate AI-personalized worksheets for every student in their class.
- [ ] AI generation always returns valid Worksheet JSON; invalid output is rejected/regenerated.
- [ ] SVG assets resolve correctly; missing assets substitute same-category without blocking.
- [ ] Generation lock enforces pairwise locks: Teacher↔School and Volunteer↔Block Admin; auto-releases when exam cycle closes.
- [ ] Delayed-attempt/defaulter escalation works: 3 lifetime Delayed Attempts → Teacher blocked → Volunteer takes over.
- [ ] Admin/Superadmin can manually restore a locked-out School's dashboard access.
- [ ] Worksheets render as HTML and export as printable A4 PDF.
- [ ] Both ICR structured JSON and OCR image-based answers can be ingested and linked to the correct student.
- [ ] OCR pipeline reports a per-answer confidence score; low-confidence answers are flagged for manual verification.
- [ ] Evaluation engine produces a score, narrative report, and next-level recommendation regardless of ingestion path.
- [ ] Certification is issued only when all competency requirements are met.
- [ ] Aadhar/Birth Certificate number is mandatory, unique, and masked for all roles except Superadmin.
- [ ] Superadmin announcement channel is visible on all dashboards; email escalation works for urgent posts.
- [ ] Teacher feedback ticketing system routes tickets to Superadmin review queue.
- [ ] Level auto-flag triggers when 50%+ of students fail an "easy"-tagged question.
- [ ] Data-flow dashboard (District Admin/Block Admin) correctly reflects Conducted → Scanned → Evaluated → Certified status per school.
- [ ] Logbook records every significant action and is filterable/exportable.
- [ ] All REST APIs are functional and documented.

---

## 18. Risks

- AI-generated Worksheet JSON may occasionally fail schema validation, requiring regeneration latency.
- Frequent SVG asset substitutions could reduce worksheet quality if library coverage lags; mitigated by the substitution log.
- Diagnostic test accuracy directly affects all downstream personalization — errors compound.
- OCR handwriting recognition accuracy is a dependency outside full platform control; mitigated by confidence scoring + manual verification.
- National-scale role hierarchy introduces additional permission-boundary surface area (7 roles) — access-control bugs have higher blast radius than in a single-role MVP.
- Generation-lock pairwise enforcement requires careful race-condition handling to prevent both roles from printing the same session.
- Delayed-Attempt/Defaulter escalation must be atomic and permanent — accidental lockouts require manual Admin/Superadmin restoration.
- Offline field support (Volunteer in no-internet schools) adds sync-conflict risk (CRDT complexity) if pursued in the same release.

---

## 19. Out of Scope / Future Versions

- v2.0+: Raw image OCR quality improvements, multi-language worksheets, adaptive mid-worksheet difficulty, curriculum UI editor, multi-LLM provider support, offline-first Volunteer app, native mobile app, deployment automation (Docker), student performance analytics expansion.

---

## 20. Appendices

### Appendix A: Role Hierarchy
```
Superadmin (IIT Ropar / Vicharanashala Lab)  — owns curriculum, pedagogical decisions
    │
    ├── Admin (State/UT) — e.g., Punjab, Haryana
    │       │
    │       ├── District Admin — e.g., Ludhiana, Moga
    │       │       │
    │       │       └── Block Admin — e.g., Ludhiana-01, Ludhiana-02
    │       │               │
    │       │               ├── Volunteer(s)  ── deployed to low-strength / no-internet schools
    │       │               │                     (paired generation lock with Block Admin)
    │       │               └── School (Principal)
    │       │                       │
    │       │                       ├── Teacher(s)  ── owns class(es); paired generation
    │       │                       │                   lock with School (Principal)
    │       │                       └── Students
    │       └── (another District Admin → ...)
    │
    └── (more states)
```
> Operationally, School (Principal), Teacher, and Volunteer sit at the same school-level execution tier — whichever is present/eligible for a given school generates papers and conducts the exam.

### Appendix B: Email Format Reference
```
superadmin@fln.org
admin.pb@fln.org                       (Punjab)
district.ldh@fln.org                   (Ludhiana District)
block.ldh-01@fln.org                   (Ludhiana Block 1)
gps-mt-001@fln.org                     (School)
gps-mt-001.t01@fln.org                 (Teacher)
vol.rahul@fln.org                      (Volunteer)
```

### Appendix C: Password Policy
- Minimum 8 characters
- At least 1 uppercase letter (A–Z)
- At least 1 number (0–9)
- At least 1 special character (! @ # $ % ^ & * etc.)
- Eye icon (👁) toggles password visibility on the login form

### Appendix D: Recommended Next Documents
1. `02_System_Architecture.md` — detailed sequence diagrams, Node↔Python contract, OCR pipeline internals
2. `03_Database_Design.md` — full schema with field-level definitions across all collections
3. `04_API_Design.md` — full request/response contracts, including role-scoped analytics endpoints
4. `05_AI_Workflow.md` — diagnostic + AI-personalized generation prompt design
5. `06_SVG_System.md` — asset taxonomy, resolution & substitution flow
6. `07_Evaluation_System.md` — full classification/scoring spec, reconciling ICR vs. OCR confidence handling
7. `08_Dashboards_UX.md` — full wireframes and interaction flows per role
8. `09_Governance_Compliance.md` — RTE Act provisions, data retention, audit requirements
9. `10_Deployment.md`
10. `11_Roadmap.md`
11. `12_Generation_Lock_Spec.md` — pairwise lock enforcement, race-condition handling, auto-release logic

---

*End of SRS FLN Platform Document v1.2*
