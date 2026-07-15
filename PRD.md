# Product Requirements Document (PRD)
# FLN Assessment & Personalized Worksheet Platform

**Version:** v0.1
**Status:** Draft
**Owner:** Vicharanashala Lab (VLED) / IIT Ropar core team
**Source of truth (technical):** [SRS.md](SRS.md)
**Subject Scope:** Mathematics FLN (Foundational Literacy & Numeracy), Classes 2–4
**Stack:** MERN + Python (AI/automation services)

---

## 1. Overview

The FLN Assessment & Personalized Worksheet Platform is an AI-driven system that assesses every child's foundational numeracy level, generates a worksheet personalized to that exact level, and rolls performance data up through a national governance hierarchy for oversight and certification.

This PRD frames **what** we are building and **why** — the problem, users, goals, scope, and success measures. Detailed functional/technical specification lives in the [SRS](SRS.md); this document should be read alongside it and takes the SRS as authoritative on implementation detail.

---

## 2. Problem Statement

National assessment data (ASER, NAS) consistently shows a large gap between a child's enrolled grade and their actual foundational numeracy level. Teaching to grade rather than to level leaves struggling children further behind each year.

Today there is no scalable way to:
- Assess each child at their **true** level (not their grade) three times a year.
- Produce learning material tailored to each child's current level.
- Give administrators — from block to national — timely visibility into who is being assessed, evaluated, and certified, and where the pipeline is stalling.

Existing tools are either grade-uniform, manual/paper-heavy, or lack a governance layer that scales from a single classroom to a national program.

---

## 3. Goals & Non-Goals

### 3.1 Goals
- **G1** — Assess every student (new and existing) three times per academic year and maintain an accurate, evolving FLN level per child.
- **G2** — Auto-generate a printable, level-personalized worksheet per student, on demand, in seconds.
- **G3** — Ingest completed answer sheets at scale (bulk ICR scan) and evaluate them into scores, narrative reports, and a next-level recommendation.
- **G4** — Provide role-scoped dashboards across a 7-tier national hierarchy with strict access control.
- **G5** — Keep pedagogy core-team-controlled: curriculum, level flags, and feedback flow through a single review queue.
- **G6** — Operate in both connected (Teacher-led) and no-internet/low-strength (Volunteer-led) school modes on one data model.

### 3.2 Non-Goals (v0.1)
- Literacy (reading/writing) — Mathematics only.
- Adaptive mid-worksheet difficulty.
- Curriculum editing via UI.
- Multi-LLM provider switching UI.
- Real-time collaboration.
- Offline-first Volunteer app / sync (dropout-tracking/outreach campaigns).

---

## 4. Users & Personas

| Role | Tier | Primary need |
|------|------|--------------|
| **Superadmin** | National (VLED/IIT Ropar) | Own curriculum & pedagogy; set assessment calendar; national analytics; review queue; announcements |
| **Admin** | State/UT | Flag lagging districts; state certification % |
| **District Admin** | District | Pipeline health (Conducted→Scanned→Evaluated→Certified); Block Admin oversight |
| **Block Admin** | Block | Manage Volunteers; generate papers for low-strength schools; take over defaulting schools |
| **School (Principal)** | Institution | Class-wise mastery; manage Teachers; generate papers for high-strength schools |
| **Teacher** | Classroom | Roster, run assessments, one-click worksheet generation, reports |
| **Volunteer** | Field | Serve low-strength/no-internet schools: generate, conduct, scan, upload |

**Beneficiary (indirect):** the student — assessed and taught at their true level.

---

## 5. Key Product Principles

1. **No public sign-up.** Every account is provisioned top-down (Superadmin/Admin; Teachers by School; Volunteers by Block Admin).
2. **Level, not grade.** Worksheets always target the student's latest AI-assigned FLN level.
3. **Pedagogy is core-team-first.** All feedback (tickets) and auto-flags feed a Superadmin review queue; no change is applied without approval.
4. **One data model, two field modes.** High-strength (Teacher) and low-strength (Volunteer) schools share Student/Worksheet/Submission/Report schema.
5. **Identity is mandatory & protected.** Aadhar/Birth Certificate number is a unique student key, masked for every role except Superadmin.
6. **Single generation flow, gated by locks.** Four roles can generate; pairwise locks prevent duplicate papers per class/session.

---

## 6. Scope & Core User Flows

### 6.1 In Scope (v0.1)
- Public landing page + role-based login (no role dropdown; resolved server-side).
- Three fixed annual assessment cycles: **Baseline**, **Mid-Year**, **End-Year**, each followed by AI evaluation + FLN level update.
- AI-personalized worksheet generation → HTML → A4 PDF, with pre-built SVG asset library and same-category substitution.
- Exam-day timing cycle (1h print → 45m exam → 1h submission; 2h45m total) with sequential, non-overlapping print windows per class.
- ICR bulk answer ingestion (structured JSON, ~40–50 sheets in 2–3 min).
- Python evaluation engine: classify → compare → score → narrative report → next-level recommendation.
- Generation locks, Delayed-Attempt/Defaulter escalation, level auto-flag, ticketing, announcements, logbook/audit.
- Role-scoped analytics dashboards national → class.

### 6.2 Critical Flows
1. **Onboarding** — Teacher (high-strength) or Volunteer→Block Admin (low-strength) collects & verifies identity, adds student.
2. **Assessment cycle** — Baseline → evaluate → level → personalized worksheets → Mid-Year → … → End-Year → progress report.
3. **Worksheet generation** — one-click per class; pairwise generation lock; per-student PDF within print window.
4. **Exam day** — timed print/exam/submission windows; late = Delayed Attempt → escalation.
5. **Evaluation** — begins 8h after all of a school's classes close submission; updates level history + dashboards.
6. **Continuous revision** — level auto-flag (50%+ fail an "easy" question) + Teacher curriculum tickets → Superadmin review → curriculum Markdown update.

*(See SRS §6 for full workflow diagrams.)*

---

## 7. Functional Requirements (summary)

Full detail in [SRS §7–§13](SRS.md). Product-level summary:

| Area | Requirement |
|------|-------------|
| Auth & Roles | JWT, 7 roles, server-resolved role, strict data scoping (SRS §13.1 matrix) |
| Curriculum | Per-level Markdown, core-team maintained; each question → exactly one competency + difficulty band |
| Students | Unique persistent Student ID; masked Aadhar/BC; level/target/history |
| Assessments | Baseline/Mid-Year/End-Year per fixed calendar; syllabus coverage per cycle; level updated after each |
| Generation | Single AI flow, one worksheet/student at current level; validated Worksheet JSON; two pairwise locks (R-11) |
| Assets | Categorized SVG library; missing → same-category substitution, logged, never blocking |
| Rendering | HTML → A4 print-ready PDF; correct in black-and-white |
| Ingestion | ICR structured JSON per student, linked to correct student |
| Evaluation | Score + strengths/weaknesses + mistake patterns + next-level recommendation |
| Dashboards | Role-scoped analytics; data-flow pipeline; drill-down; CSV/PDF export |
| Governance | Delayed-Attempt/Defaulter escalation, level auto-flag, ticketing, announcements, immutable logbook |

---

## 8. Success Metrics

**Adoption / coverage**
- % of enrolled students assessed per cycle (target: ≥95% Baseline coverage).
- Number of active schools operating in each mode.

**Pipeline health**
- Median time Conducted → Evaluated per school.
- % submissions inside window (Delayed-Attempt rate < 5%).
- Defaulter rate and restoration turnaround.

**Product quality**
- Single-student worksheet generation < 15s (NFR-1).
- Worksheet JSON schema-valid on first attempt ≥ 95%; SVG substitution rate trend down over time.
- Dashboard load < 3s, search < 2s.

**Outcome (program)**
- Distribution of FLN level movement (Baseline → End-Year) — % of students advancing at least one level.
- State/district FLN certification %.

---

## 9. Non-Functional Requirements (highlights)

- **Performance:** <15s single generation; parallel/queued batch with progress; <3s dashboards.
- **Security:** JWT (7-day + refresh), bcrypt, API+UI RBAC, encryption at rest, HTTPS, per-teacher/volunteer isolation.
- **Reliability:** auto-retry on AI timeout/schema failure; never block on missing SVG.
- **Usability:** Teacher/Volunteer trainable in <30 min; A4 B/W print fidelity.
- **Audit/Compliance:** immutable logbook, 3-year retention, RTE Act 2009 alignment.

*(Full list: SRS §15.)*

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| AI JSON schema failures add latency | Auto-reject + regenerate (R-8, NFR-13) |
| SVG library lag lowers worksheet quality | Same-category substitution + substitution log to prioritize coverage |
| Assessment errors compound into wrong level/personalization | Level history, auto-flag review, evaluation QA |
| 7-role permission surface → access-control bugs | Central matrix (§13.1), API+UI enforcement, isolation tests |
| Generation-lock race conditions | Atomic pairwise lock service, race-condition tests |
| Accidental defaulter lockouts | Atomic escalation + manual Admin/Superadmin restore path |
| Offline field sync complexity | Kept out of scope for v0.1 |

---

## 11. Release / Roadmap

**v0.1 (this PRD)** — Mathematics FLN, Classes 2–4; full 7-role hierarchy; three assessment cycles; single generation flow with locks; ICR ingestion; evaluation engine; dashboards; governance.

**Future (out of scope now):** Literacy, multi-language worksheets, adaptive difficulty, curriculum UI editor, multi-LLM support, offline-first Volunteer app, deployment automation, expanded analytics.

---

## 12. Open Questions

- Exact competency → certification thresholds per class/level (§SRS R-7 "all competency requirements met").
- ICR scanner hardware/software selection and JSON contract finalization.
- Academic-calendar dates per state/UT and how state variance maps to the "fixed national calendar."
- Section-level vs class-level generation batching for very large classes.

---

*Derived from SRS.md v0.1 — refer to the SRS for authoritative functional, data, and API specification.*
