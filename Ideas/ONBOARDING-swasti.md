# Contributor Onboarding: FLN Assessment & Remediation Platform

**Contributor:** Swasti  
**Target Repository:** vicharanashala/fln  
**Focus Area:** Assessment Engine, Diagnostic Pipelines, Misconception Modeling & Curriculum Evolution  

---

## 1. What is FLN?

**FLN** stands for **Foundational Literacy and Numeracy**. In primary education (specifically Classes 1–4, covering children aged roughly 5 to 9), foundational numeracy is the cornerstone of all future intellectual and academic growth. A child who cannot reliably compare numbers, understand place value, or grasp basic operations (addition, subtraction, multiplication, and division) will inevitably struggle as the curriculum shifts from "learning to count" to "counting to learn."

In large-scale public school systems, the prevailing problem is the **compounding learning gap**. Traditional classroom models administer standard exams, assign a collective score, and advance every child along with the academic year regardless of their true competence. When a child falls behind at single-digit addition, subsequent lessons on carrying and two-digit arithmetic become incomprehensible. Over time, students develop deep-seated math anxiety and fall into passive disengagement.

The FLN platform exists to fundamentally break this cycle. Rather than acting as a traditional grading portal or an administrative scoreboard, FLN provides **precision diagnostic evaluation and personalized remediation**:
1. It diagnoses exactly where each child sits on a continuous developmental numeracy framework.
2. It generates printable, customized paper worksheets tailored to that child's exact instructional frontier.
3. It ingests physical student work via optical scanning (ICR/AI), diagnoses underlying misconceptions, and guides educators on the specific remedial steps required to bring each learner to foundational mastery.

---

## 2. What do you understand by FLN (as a system)?

FLN is an interconnected, hybrid digital-and-physical educational assessment platform designed for low-resource environments (where students take tests on physical paper, but insights are computed in the cloud). 

### Key Stakeholders & Users
- **Students (Classes 1–4):** The learners whose progress is tracked across foundational levels (1 to 59). They interact with physical printed worksheets with distinct QR codes and individualized questions.
- **Teachers & Volunteers:** The primary ground operators. They generate class worksheets, administer exams, scan or photograph completed papers, review AI evaluation results, and submit manual overrides when handwriting or OCR edge cases arise.
- **School Principals:** School-level monitors who oversee teacher submission compliance, pass/fail trends, and intervention tracking for their institution.
- **Administrative Hierarchy (Block, District, State, Superadmin):** Multi-tier oversight roles that aggregate learning telemetry, track defaulters (teachers who missed exam submission windows), review school performance, and configure global curriculum rules.

### Core Entities & Data Architecture
- **Curriculum & Skill Graph:** A structured progression of numeracy competencies (spanning 93 nodes / levels 1–59) mapped into topics (Number Sense, Operations, Measurement, etc.), prerequisites, and target milestones.
- **Worksheets & Exams:** Periodic test instruments (Baseline, Midline, Endline, and remedial cycles) generated with specific time windows (`timing.examDate`, `printWindow`, `submissionWindow`) and lock states (`locks.locked`).
- **Answer Submissions & Attempt Evidence:** Records of child work. These range from high-level question answers (`AnswerSubmission`) to fine-grained micro-attempts (`AttemptRecord`) capturing hints, representations, and scaffolding levels.
- **Evaluation Reports & Diagnostic Profiles:** The diagnostic engine's output containing scores, question-by-question correctness, detected `rootCauses`, skill gaps, and recommended advancement levels.
- **Misconception Archetypes & Fingerprints:** Machine-learning-driven clustering that groups students by *how* they fail (e.g., place-value confusion vs. digit reversal) rather than merely *how much* they score, enabling group-level targeted remediation.

### High-Level System Flow
```
[Curriculum Graph] ──► [Worksheet Generator] ──► [Printable PDF with QR]
                                                            │
                                                     (Physical Exam)
                                                            ▼
[Diagnostic Feedback] ◄── [Teacher Override] ◄── [OCR / Evaluation Pipeline]
        │
        ├──► [Misconception Fingerprint & Archetype Update]
        └──► [Placement Level Recomputation & Remedial Worksheets]
```

---

## 3. Current State of the Repository — What Has Been Done So Far

The repository is structured as an **npm-workspaces monorepo** consisting of three primary modules:
- `frontend/`: A React 19 single-page application built with Vite and Tailwind CSS.
- `backend/`: A TypeScript Express REST API running on Node.js.
- `ai-services/`: A Python-based optical scanning and evaluation pipeline leveraging Google Gemini and OCR tooling.

### Key Implemented Capabilities
1. **Real Express Backend Architecture (ADR 001):**
   - The backend is the single source of truth (`backend/src/`). The legacy in-browser mock fetch interceptor has been cleanly eliminated.
   - Dual-persistence architecture in `backend/src/db.ts`: MongoDB serves as the primary operational store (when `MONGODB_URI` is provided), with an automated JSON file fallback (`data/db.json`) for zero-dependency local development and testing.
2. **Hardened Role-Based Access Control (RBAC):**
   - Implemented via signed JWTs and `bcrypt` password hashing in `backend/src/auth.ts`.
   - Access to student profiles and operations is strictly scoped by geographic and institutional hierarchy (`canAccessStudent`).
3. **Automated Worksheet & PDF Generation:**
   - Puppeteer-driven rendering converting HTML templates (`frontend/public/worksheets`) into print-ready assessment sheets with unique barcodes and student identifiers.
4. **Diagnostic & Remedial Evaluation Engine:**
   - Multi-stage answer evaluation matching handwritten strings against expected answers using OCR-resilient normalization (`backend/src/answerMatching.ts`).
   - Heuristic and AI-driven error classification (`backend/src/errorClassification.ts`) categorizing slips into `unanswered`, `digit_reversal`, `decimal_place_shift`, and `off_by_one`.
   - Learner archetype clustering (`assignStudentToArchetype`) grouping students into actionable intervention cohorts.

---

## 4. Gaps Observed in the Code

During in-depth analysis of the repository while implementing and testing features, several critical architectural and functional gaps were identified:

### Gap 1: Inability to Capture Real-Time Scaffolding & Pedagogical Attempt Nuance
- **Where:** `backend/src/db.ts` (`AnswerSubmission` interface)
- **What:** Student work was recorded purely as static answer submissions (`submittedAnswer: string`, `isCorrect: boolean`). There was no data model to record how the answer was reached: whether the student worked unprompted, needed verbal hints, used visual manipulatives, or required direct teacher guidance.
- **Why it matters:** In foundational learning, two students who both arrive at the answer "12" have completely different mastery levels if Student A solved it mentally in 5 seconds while Student B required 4 physical counting blocks and 2 teacher prompts. Treating them as identical binary "passes" distorts diagnostic accuracy.

### Gap 2: Teacher Overrides Desynchronized from Misconception Fingerprints & Root Causes
- **Where:** `backend/src/routes/evaluation.ts` (lines ~1340–1390) and `backend/src/routes/students.ts`
- **What:** When a teacher used `PATCH /api/evaluation/:reportId/override` to correct an OCR misread or grading error, the handler updated the numerical score (`score: newScore`) but never recomputed `rootCauses`. Furthermore, it never invalidated the student's cached misconception fingerprint or recomputed their archetype cluster.
- **Why it matters:** If a child was erroneously marked wrong for writing "7", the system permanently flagged them with a misconception and assigned them to a remedial archetype, even after the teacher corrected the score to 100%.

### Gap 3: Human Educator Diagnoses Overridden by Rigid Automated Fallbacks
- **Where:** `backend/src/routes/evaluation.ts` and `backend/src/rootCauseAnalysis.ts`
- **What:** The root cause calculation relied solely on automated classification (`classifyErrorType`), which defaults to `"unclassified"` for any non-trivial error. When teachers performed manual reviews and identified the exact pedagogical reason for an error (e.g., conceptual misunderstanding), there was no schema or parameter to capture and persist the teacher's diagnosis.
- **Why it matters:** The system discarded the highest-fidelity diagnostic signal available: the live classroom teacher's expert judgment.

### Gap 4: Static Curriculum Graph Unable to Evolve with Classroom Realities
- **Where:** `backend/src/config/curriculumMap.ts` and `backend/src/db.ts`
- **What:** The curriculum was locked into a static 93-node competency graph. There was no structured mechanism or API for teachers and curriculum designers to propose new micro-skills discovered during interventions, link them to classroom evidence, or review them through an expert validation workflow.
- **Why it matters:** Real foundational teaching regularly uncovers unmapped micro-competencies (e.g., distinguishing between standard numerals and number words, or directional subitizing). Without a dynamic evolution loop, the curriculum remains rigid.

---

## 5. Ideas for the Project

### Idea 1: Multi-Modal Scaffolding & Hint Analytics Dashboard
- **What:** Build a dedicated teacher and administrator visualization showing student progression through scaffolding independence.
- **Why:** Solves the visibility gap around student autonomy. Tracks how often students need level-3/level-4 assistance over time, highlighting true conceptual independence rather than just test scores.
- **How:** Create an aggregation endpoint `GET /api/students/:id/scaffolding-trends` querying the newly introduced `AttemptRecord` collection, and render a simple sparkline/badge indicator on the student profile panel.

### Idea 2: Expert Curriculum Evolution & Candidate Skill Review Panel
- **What:** Develop an administrative management view for curriculum experts to review and graduate proposed candidate skills.
- **Why:** Operationalizes the backend D1.6 Skill Evolution API (`POST /api/skills/candidates/:id/validate`) so curriculum leads can review evidence and promote emergent skills into the live curriculum without direct database manipulation.
- **How:** A panel component under the Admin / Curriculum navigation that fetches `GET /api/skills/candidates?status=under_review`, displays supporting evidence and classroom observations, and provides "Approve & Promote" or "Reject" actions.

### Idea 3: Unified Cross-Service Answer Normalization Specification
- **What:** Create a centralized, language-agnostic test suite and normalization spec shared between the TypeScript backend (`answerMatching.ts`) and Python OCR service (`1_compare_answers.py`).
- **Why:** Prevents discrepancy where an answer is marked correct by the backend's OCR-tolerant comparator but rejected by the Python script's strict comparison.
- **How:** Define a shared JSON specification file (`shared/answer-normalization-fixtures.json`) with edge cases (leading zeros, punctuation, spacing) and execute it in both Node.js (`npm run test:answer-matching`) and Python pytest suites.

---

## 6. Your Contribution

As part of my onboarding, I have actively worked on and submitted **four focused Pull Requests** addressing the core diagnostic, evaluation, and curriculum capabilities of the platform:

### 1. PR #654 (Issue #479): Granular AttemptRecord Evidence Schema
- **Code:** Implemented the `AttemptRecord` schema in `backend/src/db.ts` featuring the authoritative 0–4 scaffolding scale (`0 = unprompted`, `4 = full direct instruction`), representation styles, and error classifications.
- **Database:** Added `addAttemptRecord()` and indexed read method `getAttemptRecordsForStudent()` with an index on `studentId: 1`.
- **Testing:** Created regression tests validating student isolation and record retrieval.

### 2. PR #673 (Issue #402): Real-Time Root Cause & Archetype Synchronization on Teacher Override
- **Architecture:** Extracted per-question root-cause analysis out of `students.ts` into a clean, reusable module: `backend/src/rootCauseAnalysis.ts`.
- **Logic:** Wired `PATCH /api/evaluation/:reportId/override` to recompute `rootCauses` only for questions that remain wrong (`stillWrongIds`), clearing causes to `[]` when all answers are corrected.
- **Fingerprinting:** Connected `invalidateFingerprintCache()` and `assignStudentToArchetype()` to ensure the student's misconception profile updates immediately upon manual correction.
- **Testing:** Created `backend/tests/evaluation-override.test.ts` (runnable via `npm run test:evaluation-override`) covering HTTP override behaviors against live reports.

### 3. PR #700 (Issue #459): Teacher-in-the-Loop Error Classification
- **Feature:** Extended the override endpoint payload to accept `errorType?: string` within `corrections[]`.
- **Pedagogy:** Ensured that human educator diagnoses take precedence over deterministic regex classifier fallbacks when errors are manually reviewed.
- **Testing:** Added test suite asserting teacher error type overlay precedence.

### 4. PR #701 (Issue #481): D1.6 Skill Evolution & Expert Validation Framework
- **Data Model:** Defined `CandidateSkill` and `Skill` schemas in `backend/src/db.ts`, supporting lifecycle states (`proposed`, `under_review`, `validated`, `rejected`) and evidence linking.
- **REST Endpoints:** Built 5 production routes in `backend/src/routes/skillEvolution.ts`:
  - `GET /api/skills/candidates` & `GET /api/skills/candidates/:id`
  - `POST /api/skills/candidates`
  - `POST /api/skills/candidates/:id/validate`
  - `GET /api/skills`
- **Testing:** Created unit and integration tests in `backend/src/skillEvolution.test.ts` verifying proposal, status transitions, and graduation into active skills.
