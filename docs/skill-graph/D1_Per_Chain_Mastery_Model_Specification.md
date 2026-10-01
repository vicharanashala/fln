# D1 — Per-Chain Mastery Model Architecture Specification

## Overview

The **Per-Chain Mastery Model** defines how child competency, skill relationships, observable evidence, and current learning state are represented across the FLN platform (Classes 2–4 foundational numeracy).

Replaces the coarse single-line tracker item (*"Decide per-chain mastery model"*) with six independently specified, built, and testable decisions (D1.1 through D1.6).

---

## Governing Principle

> **The database is responsible for representing curriculum, skills, relationships, questions, and evidence accurately. The algorithm's job is only inference and updating.**

Concretely:
1. No `bkt_probability`, `bkt_slip`, `bkt_guess`, or algorithm-specific field belongs in any permanent table.
2. Every table must be able to feed BKT, DINA, IRT, or any future cognitive diagnosis model without a database schema change.
3. Learner skill state is a current, recomputable belief — not an unchangeable certification.

---

## The Six Decisions & Architecture

| # | Decision | Question | Storage / Model | Active File / Service |
|---|---|---|---|---|
| **D1.1** | Skill Ontology | Where do initial skills come from? | `SkillOntologyProvenance` (7-source metadata) | `backend/src/masteryModel.ts` |
| **D1.2** | Skill Graph | How are skills related? | `SkillRelationship` (KST AND/OR prerequisite graph) | `backend/src/skillRelationships.ts` |
| **D1.3** | Q-Matrix | Which questions test which skills? | `QuestionTemplate` representation (`symbolic`/`visual`/`word_problem`) & context (`direct`/`real_world`) | `backend/src/routes/questionTemplates.ts` |
| **D1.4** | Evidence Model | What does an answer tell us? | `StudentAttempt` (`attempt`) append-only observable log | `backend/src/masteryModel.ts` |
| **D1.5** | Learner Skill State | What do we currently believe the learner can do? | `LearnerSkillState` (`learner_skill_state`) algorithm-independent belief model | `backend/src/masteryModel.ts` |
| **D1.6** | Skill Evolution | When do we propose a new skill? | `CandidateSkill` (`candidate_skill`) with human-in-the-loop review | `backend/src/masteryModel.ts` |

---

## Detailed Schemas & Invariants

### D1.1 — Skill Ontology Provenance (`SkillOntologyProvenance`)

Every skill's existence is anchored to one or more of 7 official evidence sources:

```ts
export interface SkillOntologyProvenance {
  skillId: string;
  learningOutcome?: string;       // NCERT Learning Outcome reference
  competency?: string;            // NIPUN Bharat Lakshya reference
  curriculumExpectation?: string; // NCF-SE 2023 reference
  instructionalEvidence?: string; // Textbook / teacher guide reference
  assessmentEvidence?: string;    // Assessment framework reference
  researchEvidence?: string;      // Research literature reference
  validationStatus: 'PROPOSED' | 'APPROVED' | 'REJECTED';
  updatedAt: string;
}
```

### D1.2 — Skill Graph (`SkillRelationship`)

Relational representation of the KST learning prerequisite graph (`Skill → prerequisite_of → Skill`):

```ts
export interface SkillRelationship {
  id?: string;
  toSkill: string;           // Target subskill/skill ID (e.g. 'SK13.06')
  fromSkill: string;         // Prerequisite subskill/skill ID (e.g. 'SK13.05', 'SK12')
  groupId: string;           // Clause/Group identifier (e.g. 'g1', 'g2') to group AND members into OR routes
  relationshipType: 'PREREQUISITE' | 'AND' | 'OR';
  status: 'PROPOSED' | 'VALIDATED' | 'DEPRECATED';
  rationale?: string;
}
```

**SK13 Pilot Rulings (11 Sep):**
- `SK13.01`–`SK13.10` are all required.
- `SK13.02` (concrete addition) strictly requires `SK13.01` (no OR bypass).
- `SK13.06` (two-digit addition) contains two valid AND-routes in an OR-group:
  - Route 1 (`g1`): via `SK13.05` (Addition within 30)
  - Route 2 (`g2`): via `SK13.04` (Addition within 20) + place value (`SK12`)

### D1.4 — Evidence Model (`StudentAttempt`)

Append-only observable event log:

```ts
export interface StudentAttempt {
  id: string;
  studentId: string;
  questionId: string;
  paperId?: string;
  submittedAt: string;          // ISO date
  durationMs: number;
  isCorrect: boolean;
  rawResponse: string;
  errorType: string;            // Required field — join key to D1.6 error classification (#459)
  hintsUsed: number;
  scaffoldingLevel: 0 | 1 | 2 | 3 | 4; // 0=Independent, 1=Indirect hint, 2=Prompt, 3=Example, 4=Direct help
  representation: 'symbolic' | 'visual' | 'word_problem' | null; // Denormalized at attempt time
  context: 'direct' | 'real_world' | null;               // Denormalized at attempt time
  evaluatorType: 'human' | 'gemini' | 'rule_engine' | 'icr';
  confidence: number;           // Evaluator grading confidence (0.0 to 1.0)
}
```

### D1.5 — Learner Skill State (`LearnerSkillState`)

Current belief state, strictly algorithm-independent and fully recomputable from attempts alone:

```ts
export interface LearnerSkillState {
  id: string;
  studentId: string;
  skillId: string;
  state: 'MASTERED' | 'DEVELOPING' | 'NEEDS_SUPPORT' | 'INSUFFICIENT_EVIDENCE';
  confidence: number;           // 0.0 to 1.0
  evidenceCount: number;
  firstObservedAt: string;      // ISO date
  lastObservedAt: string;       // ISO date
  correctCount: number;
  incorrectCount: number;
  recentErrorPattern?: string;
  lastAssessmentId?: string;
  modelVersion: string;
  updatedAt: string;            // ISO date
}
```

**Infrequent Assessment Invariant:**
If `lastObservedAt` is older than `STALENESS_THRESHOLD_DAYS` (90 days), queries return `state: INSUFFICIENT_EVIDENCE`.

### D1.6 — Skill Evolution (`CandidateSkill`)

```ts
export interface CandidateSkill {
  id: string;
  proposedBy: string;           // Algorithm version or teacher ID
  proposedAt: string;           // ISO date
  parentSkillId: string;
  suggestedName: string;
  suggestedDescription: string;
  evidenceErrorClusterIds: string[];
  sampleStudentResponses: string[];
  status: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'MERGED';
  reviewedBy?: string;
  reviewedAt?: string;          // ISO date
  decisionNotes?: string;
  targetSubskillId?: string;
}
```

**Human-in-the-Loop Principle:**
Algorithms propose candidate skills from recurring unclassified error clusters; only human curriculum lead review (`status: APPROVED`) promotes a candidate into the active skill ontology.

---

## API Endpoints

- `POST /api/mastery/attempts` — Record student attempt with scaffolding 0-4 and evaluator metadata
- `GET /api/mastery/attempts/:studentId` — Query attempt history
- `GET /api/mastery/skill-state/:studentId/:skillId` — Query learner skill belief state (with staleness check)
- `POST /api/mastery/skill-state/:studentId/rebuild` — Rebuild learner skill states from attempts alone
- `POST /api/mastery/candidate-skills` — Propose candidate skill from error cluster
- `GET /api/mastery/candidate-skills` — List candidate skill proposals
- `PATCH /api/mastery/candidate-skills/:id/review` — Human review candidate skill (APPROVE/REJECT/MERGE)
- `GET /api/mastery/ontology-provenance/:skillId` — Query 7-source ontology provenance metadata
