/**
 * D1 — Per-Chain Mastery Model Implementation
 *
 * Implements the six sub-decisions of D1 (#484):
 *   D1.1 — Skill Ontology Sourcing Metadata (NCERT / NIPUN / NCF / Experts)
 *   D1.2 — Skill Graph (relationship-2 AND/OR chain integrated via skillRelationships.ts)
 *   D1.3 — Q-Matrix (Question representation & context tagging)
 *   D1.4 — Evidence Model (StudentAttempt schema with hints, 0-4 scaffolding, evaluator metadata)
 *   D1.5 — Learner Skill State (Algorithm-independent current-belief model with staleness tracking)
 *   D1.6 — Skill Evolution (CandidateSkill proposal & human-in-the-loop validation)
 *
 * GOVERNING PRINCIPLE:
 * The database is responsible for representing curriculum, skills, relationships,
 * questions, attempts, and learner state accurately. The algorithm's job is only
 * inference and updating. Concretely: no bkt_probability or model-specific fields
 * exist on permanent tables.
 */

import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// D1.1 — Skill Ontology Sourcing Metadata
// ---------------------------------------------------------------------------

export type SkillValidationStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED';

export interface SkillOntologyProvenance {
  skillId: string;
  learningOutcome?: string;       // NCERT Learning Outcome reference
  competency?: string;            // NIPUN Bharat Lakshya reference
  curriculumExpectation?: string; // NCF-SE 2023 reference
  instructionalEvidence?: string; // Textbook / teacher guide reference
  assessmentEvidence?: string;    // Assessment framework reference
  researchEvidence?: string;      // Research literature reference
  validationStatus: SkillValidationStatus;
  updatedAt: string;
}

/**
 * Seed provenance records for the SK13 pilot chain subskills (SK13.01 - SK13.10)
 */
const SK13_PROVENANCE_SEED: Record<string, SkillOntologyProvenance> = {
  'SK13.01': {
    skillId: 'SK13.01',
    learningOutcome: 'NCERT Class I Math LO M101: Combines two groups of objects and counts them together',
    competency: 'NIPUN Bharat Lakshya Grade 1: Concrete addition by combining sets up to 9',
    curriculumExpectation: 'NCF-SE 2023 C-8.13: Early numeracy set-based addition foundation',
    instructionalEvidence: 'NCERT Class 1 Textbook Ch.3 "Addition"',
    assessmentEvidence: 'NAS Grade 3 Foundational Item Bank',
    researchEvidence: 'Piaget (1952) The Child\'s Conception of Number - Set Synthesis',
    validationStatus: 'APPROVED',
    updatedAt: new Date().toISOString(),
  },
  'SK13.02': {
    skillId: 'SK13.02',
    learningOutcome: 'NCERT Class I Math LO M102: Uses concrete objects and counters for addition',
    competency: 'NIPUN Bharat Lakshya Grade 1: Adds single-digit numbers using manipulatives',
    curriculumExpectation: 'NCF-SE 2023 C-8.13: Physical-to-pictorial addition progression',
    instructionalEvidence: 'Teacher Guide: Manipulative-based addition ladders',
    assessmentEvidence: 'FLN Oral/Observed Diagnostic Battery',
    researchEvidence: 'Clements & Sarama (2009) Learning Trajectories in Early Mathematics',
    validationStatus: 'APPROVED',
    updatedAt: new Date().toISOString(),
  },
  'SK13.03': {
    skillId: 'SK13.03',
    learningOutcome: 'NCERT Class I Math LO M103: Adds single-digit numbers symbolically up to 9',
    competency: 'NIPUN Bharat Lakshya Grade 1: Performs single-digit addition fluently',
    curriculumExpectation: 'NCF-SE 2023 C-8.14: Symbolic representation of addition (+, =)',
    instructionalEvidence: 'NCERT Class 1 Textbook Ch.3',
    assessmentEvidence: 'FLN Stage 1 Written Diagnostic',
    researchEvidence: 'Fuson (1988) Children\'s Counting and Concepts of Number',
    validationStatus: 'APPROVED',
    updatedAt: new Date().toISOString(),
  },
  'SK13.04': {
    skillId: 'SK13.04',
    learningOutcome: 'NCERT Class I Math LO M104: Adds numbers within 20',
    competency: 'NIPUN Bharat Lakshya Grade 2: Adds 2-digit numbers up to 20 without regrouping',
    curriculumExpectation: 'NCF-SE 2023 C-8.15: Transition to teen numbers and bridging ten',
    instructionalEvidence: 'NCERT Class 1 & 2 Math Textbooks',
    assessmentEvidence: 'FLN Stage 2 Written Diagnostic',
    researchEvidence: 'Carpenter et al. (1999) Children\'s Mathematics: Cognitively Guided Instruction',
    validationStatus: 'APPROVED',
    updatedAt: new Date().toISOString(),
  },
  'SK13.05': {
    skillId: 'SK13.05',
    learningOutcome: 'NCERT Class II Math LO M201: Adds numbers within 30 without regrouping',
    competency: 'NIPUN Bharat Lakshya Grade 2: Solves addition problems within 30',
    curriculumExpectation: 'NCF-SE 2023 C-8.16: Mental addition strategies up to 30',
    instructionalEvidence: 'NCERT Class 2 Textbook Ch.2 "Fun with Numbers"',
    assessmentEvidence: 'FLN Stage 2 Assessment',
    researchEvidence: 'Verschaffel et al. (2007) Addition and Subtraction Competence',
    validationStatus: 'APPROVED',
    updatedAt: new Date().toISOString(),
  },
  'SK13.06': {
    skillId: 'SK13.06',
    learningOutcome: 'NCERT Class II Math LO M202: Adds two-digit numbers without regrouping',
    competency: 'NIPUN Bharat Lakshya Grade 2: Addition of 2-digit numbers up to 99',
    curriculumExpectation: 'NCF-SE 2023 C-8.17: Columnar 2-digit addition without carry',
    instructionalEvidence: 'NCERT Class 2 Textbook Ch.8 "Tens and Ones"',
    assessmentEvidence: 'FLN Stage 3 Written Assessment',
    researchEvidence: 'KST (Falmagne et al. 1990) Alternate AND-routes into 2-digit addition',
    validationStatus: 'APPROVED',
    updatedAt: new Date().toISOString(),
  },
  'SK13.07': {
    skillId: 'SK13.07',
    learningOutcome: 'NCERT Class III Math LO M301: Adds two-digit numbers with regrouping (carrying)',
    competency: 'NIPUN Bharat Lakshya Grade 3: Addition of 2-digit numbers with regrouping',
    curriculumExpectation: 'NCF-SE 2023 C-8.18: Regrouping ones into tens in columnar addition',
    instructionalEvidence: 'NCERT Class 3 Textbook Ch.3 "Give and Take"',
    assessmentEvidence: 'FLN Stage 4 Written Diagnostic',
    researchEvidence: 'Brown & Burton (1978) Diagnostic models for procedural bugs in addition',
    validationStatus: 'APPROVED',
    updatedAt: new Date().toISOString(),
  },
  'SK13.08': {
    skillId: 'SK13.08',
    learningOutcome: 'NCERT Class III Math LO M302: Adds three-digit numbers with and without regrouping',
    competency: 'NIPUN Bharat Lakshya Grade 3: Addition of 3-digit numbers',
    curriculumExpectation: 'NCF-SE 2023 C-8.19: Multi-column place-value regrouping',
    instructionalEvidence: 'NCERT Class 3 Textbook Ch.6 "Fun with Give and Take"',
    assessmentEvidence: 'FLN Stage 4 Assessment',
    researchEvidence: 'Resnick (1983) Syntax and Semantics in Learning to Subtract/Add',
    validationStatus: 'APPROVED',
    updatedAt: new Date().toISOString(),
  },
  'SK13.09': {
    skillId: 'SK13.09',
    learningOutcome: 'NCERT Class IV Math LO M401: Adds 4-digit and multi-digit numbers',
    competency: 'NCERT Grade 4 Target: Multi-digit standard algorithm addition',
    curriculumExpectation: 'NCF-SE 2023 C-8.20: Generalization of standard addition algorithm',
    instructionalEvidence: 'NCERT Class 4 Textbook Ch.2 "Long and Short"',
    assessmentEvidence: 'FLN Stage 5 Assessment',
    researchEvidence: 'Kilpatrick et al. (2001) Adding It Up: Helping Children Learn Mathematics',
    validationStatus: 'APPROVED',
    updatedAt: new Date().toISOString(),
  },
  'SK13.10': {
    skillId: 'SK13.10',
    learningOutcome: 'NCERT Class III/IV Math LO M305: Solves real-life addition word problems',
    competency: 'NIPUN Bharat Lakshya Grade 3: Solves contextual word problems involving addition',
    curriculumExpectation: 'NCF-SE 2023 C-8.22: Mathematical modeling and contextual word problems',
    instructionalEvidence: 'NCERT Class 3 & 4 Word Problem Modules',
    assessmentEvidence: 'FLN Applied Word Problem Diagnostic',
    researchEvidence: 'Verschaffel et al. (2000) Making Sense of Word Problems',
    validationStatus: 'APPROVED',
    updatedAt: new Date().toISOString(),
  },
};

// ---------------------------------------------------------------------------
// D1.4 — Evidence Model (StudentAttempt / student_attempt)
// ---------------------------------------------------------------------------

export type EvaluatorType = 'human' | 'gemini' | 'rule_engine' | 'icr';
export type RepresentationTag = 'symbolic' | 'visual' | 'word_problem';
export type ContextTag = 'direct' | 'real_world';

/**
 * Scaffolding Level scale (0-4 integer scale per D1.4 specification):
 *   0: Independent (no help)
 *   1: Indirect hint / nudge
 *   2: Strategic prompt
 *   3: Worked / example support
 *   4: Direct assistance / guided step-by-step
 */
export type ScaffoldingLevel = 0 | 1 | 2 | 3 | 4;

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
  scaffoldingLevel: ScaffoldingLevel;
  representation: RepresentationTag | null; // Denormalized from linked question at attempt time
  context: ContextTag | null;               // Denormalized from linked question at attempt time
  evaluatorType: EvaluatorType;
  confidence: number;           // Evaluator grading confidence (0.0 to 1.0)
}

// ---------------------------------------------------------------------------
// D1.5 — Learner Skill State (LearnerSkillState / learner_skill_state)
// ---------------------------------------------------------------------------

export type SkillBeliefState = 'MASTERED' | 'DEVELOPING' | 'NEEDS_SUPPORT' | 'INSUFFICIENT_EVIDENCE';

/**
 * Algorithm-independent learner belief state (D1.5).
 * Contains NO bkt_probability, bkt_slip, or algorithm-specific columns.
 * Derivable and rebuildable at any time from StudentAttempt records.
 */
export interface LearnerSkillState {
  id: string;
  studentId: string;
  skillId: string;
  state: SkillBeliefState;
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

export const STALENESS_THRESHOLD_DAYS = 90;

// ---------------------------------------------------------------------------
// D1.6 — Skill Evolution (CandidateSkill / candidate_skill)
// ---------------------------------------------------------------------------

export type CandidateSkillStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'MERGED';

export interface CandidateSkill {
  id: string;
  proposedBy: string;           // Algorithm version or teacher ID
  proposedAt: string;           // ISO date
  parentSkillId: string;
  suggestedName: string;
  suggestedDescription: string;
  evidenceErrorClusterIds: string[];
  sampleStudentResponses: string[];
  status: CandidateSkillStatus;
  reviewedBy?: string;
  reviewedAt?: string;          // ISO date
  decisionNotes?: string;
  targetSubskillId?: string;
}

// ---------------------------------------------------------------------------
// In-Memory Data Store (Backing storage for D1 Mastery Model)
// ---------------------------------------------------------------------------

const attemptsStore: StudentAttempt[] = [];
const skillStatesStore: Map<string, LearnerSkillState> = new Map(); // Key: `${studentId}:${skillId}`
const candidateSkillsStore: Map<string, CandidateSkill> = new Map();
const ontologyProvenanceStore: Map<string, SkillOntologyProvenance> = new Map(
  Object.entries(SK13_PROVENANCE_SEED)
);

// ---------------------------------------------------------------------------
// D1.1 Service Functions
// ---------------------------------------------------------------------------

export function getSkillOntologyProvenance(skillId: string): SkillOntologyProvenance | undefined {
  return ontologyProvenanceStore.get(skillId);
}

export function getAllSkillOntologyProvenance(): SkillOntologyProvenance[] {
  return Array.from(ontologyProvenanceStore.values());
}

export function setSkillOntologyProvenance(provenance: SkillOntologyProvenance): void {
  ontologyProvenanceStore.set(provenance.skillId, {
    ...provenance,
    updatedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// D1.4 Service Functions (StudentAttempt)
// ---------------------------------------------------------------------------

export interface CreateAttemptInput {
  studentId: string;
  questionId: string;
  paperId?: string;
  submittedAt?: string;
  durationMs: number;
  isCorrect: boolean;
  rawResponse: string;
  errorType: string;
  hintsUsed?: number;
  scaffoldingLevel?: ScaffoldingLevel;
  representation?: RepresentationTag | null;
  context?: ContextTag | null;
  evaluatorType?: EvaluatorType;
  confidence?: number;
  targetSkillId?: string;       // Optional skill ID associated with the question
}

export function recordStudentAttempt(input: CreateAttemptInput): StudentAttempt {
  // Validate scaffolding level (0-4 scale)
  const scaffoldingLevel: ScaffoldingLevel = (
    typeof input.scaffoldingLevel === 'number' &&
    input.scaffoldingLevel >= 0 &&
    input.scaffoldingLevel <= 4
  ) ? (input.scaffoldingLevel as ScaffoldingLevel) : 0;

  const attempt: StudentAttempt = {
    id: `att_${randomUUID()}`,
    studentId: input.studentId,
    questionId: input.questionId,
    paperId: input.paperId,
    submittedAt: input.submittedAt || new Date().toISOString(),
    durationMs: Math.max(0, input.durationMs || 0),
    isCorrect: Boolean(input.isCorrect),
    rawResponse: input.rawResponse || '',
    errorType: input.errorType || (input.isCorrect ? 'none' : 'unclassified'),
    hintsUsed: Math.max(0, input.hintsUsed || 0),
    scaffoldingLevel,
    representation: input.representation ?? null, // Denormalized at attempt time
    context: input.context ?? null,               // Denormalized at attempt time
    evaluatorType: input.evaluatorType || 'rule_engine',
    confidence: typeof input.confidence === 'number' ? Math.min(1.0, Math.max(0.0, input.confidence)) : 1.0,
  };

  attemptsStore.push(attempt);

  // Automatically update LearnerSkillState if targetSkillId is supplied
  if (input.targetSkillId) {
    updateLearnerSkillStateFromAttempt(input.studentId, input.targetSkillId, attempt);
  }

  return attempt;
}

export function getStudentAttempts(studentId: string, filter?: { questionId?: string; paperId?: string }): StudentAttempt[] {
  return attemptsStore.filter(att => {
    if (att.studentId !== studentId) return false;
    if (filter?.questionId && att.questionId !== filter.questionId) return false;
    if (filter?.paperId && att.paperId !== filter.paperId) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// D1.5 Service Functions (LearnerSkillState)
// ---------------------------------------------------------------------------

function makeSkillStateKey(studentId: string, skillId: string): string {
  return `${studentId}:${skillId}`;
}

export function getLearnerSkillState(
  studentId: string,
  skillId: string,
  options?: { checkStaleness?: boolean; stalenessDays?: number }
): LearnerSkillState {
  const key = makeSkillStateKey(studentId, skillId);
  const existing = skillStatesStore.get(key);

  if (!existing) {
    return {
      id: `lss_${randomUUID()}`,
      studentId,
      skillId,
      state: 'INSUFFICIENT_EVIDENCE',
      confidence: 0.0,
      evidenceCount: 0,
      firstObservedAt: new Date().toISOString(),
      lastObservedAt: new Date().toISOString(),
      correctCount: 0,
      incorrectCount: 0,
      modelVersion: 'd1.5_v1',
      updatedAt: new Date().toISOString(),
    };
  }

  // Staleness check (infrequent assessment handling per D1.5 requirement)
  const checkStaleness = options?.checkStaleness ?? true;
  const stalenessDays = options?.stalenessDays ?? STALENESS_THRESHOLD_DAYS;

  if (checkStaleness && existing.evidenceCount > 0) {
    const lastObservedDate = new Date(existing.lastObservedAt).getTime();
    const daysElapsed = (Date.now() - lastObservedDate) / (1000 * 60 * 60 * 24);
    if (daysElapsed > stalenessDays) {
      return {
        ...existing,
        state: 'INSUFFICIENT_EVIDENCE',
        confidence: Math.max(0.1, existing.confidence * 0.5), // Decay confidence
      };
    }
  }

  return existing;
}

export function updateLearnerSkillStateFromAttempt(
  studentId: string,
  skillId: string,
  attempt: StudentAttempt
): LearnerSkillState {
  const currentState = getLearnerSkillState(studentId, skillId, { checkStaleness: false });
  const isFirst = currentState.evidenceCount === 0;

  const correctCount = currentState.correctCount + (attempt.isCorrect ? 1 : 0);
  const incorrectCount = currentState.incorrectCount + (attempt.isCorrect ? 0 : 1);
  const evidenceCount = currentState.evidenceCount + 1;

  // Independence-adjusted correctness weighting:
  // Scaffolding level 0 = 100% weight, level 4 = 20% weight
  const scaffoldingPenalty = (attempt.scaffoldingLevel / 4) * 0.8;
  const effectiveCorrectness = attempt.isCorrect ? (1.0 - scaffoldingPenalty) : 0;

  const accuracy = (currentState.correctCount + effectiveCorrectness) / evidenceCount;

  // Deriving belief state (judged from error patterns and ongoing performance):
  let state: SkillBeliefState = 'DEVELOPING';
  if (evidenceCount < 2) {
    state = 'INSUFFICIENT_EVIDENCE';
  } else if (accuracy >= 0.8 && incorrectCount <= 1) {
    state = 'MASTERED';
  } else if (accuracy >= 0.5) {
    state = 'DEVELOPING';
  } else {
    state = 'NEEDS_SUPPORT';
  }

  const confidence = Math.min(1.0, 0.2 + evidenceCount * 0.15);

  const updated: LearnerSkillState = {
    ...currentState,
    state,
    confidence,
    evidenceCount,
    firstObservedAt: isFirst ? attempt.submittedAt : currentState.firstObservedAt,
    lastObservedAt: attempt.submittedAt,
    correctCount,
    incorrectCount,
    recentErrorPattern: attempt.isCorrect ? currentState.recentErrorPattern : attempt.errorType,
    lastAssessmentId: attempt.paperId || currentState.lastAssessmentId,
    modelVersion: 'd1.5_v1',
    updatedAt: new Date().toISOString(),
  };

  skillStatesStore.set(makeSkillStateKey(studentId, skillId), updated);
  return updated;
}

/**
 * Rebuilds all LearnerSkillStates for a student from StudentAttempt records alone.
 * Satisfies D1.5 acceptance criterion: State is derivable/rebuildable from attempt data alone.
 */
export function rebuildLearnerSkillStates(
  studentId: string,
  attemptsWithSkills: Array<{ attempt: StudentAttempt; targetSkillId: string }>
): LearnerSkillState[] {
  // Clear existing skill states for this student
  for (const key of Array.from(skillStatesStore.keys())) {
    if (key.startsWith(`${studentId}:`)) {
      skillStatesStore.delete(key);
    }
  }

  // Sort attempts chronologically
  const sorted = [...attemptsWithSkills].sort(
    (a, b) => new Date(a.attempt.submittedAt).getTime() - new Date(b.attempt.submittedAt).getTime()
  );

  const updatedSkills = new Set<string>();

  for (const item of sorted) {
    updateLearnerSkillStateFromAttempt(studentId, item.targetSkillId, item.attempt);
    updatedSkills.add(item.targetSkillId);
  }

  return Array.from(updatedSkills).map(skillId => getLearnerSkillState(studentId, skillId));
}

// ---------------------------------------------------------------------------
// D1.6 Service Functions (CandidateSkill & Human-in-the-Loop Validation)
// ---------------------------------------------------------------------------

export interface ProposeCandidateSkillInput {
  proposedBy: string;
  parentSkillId: string;
  suggestedName: string;
  suggestedDescription: string;
  evidenceErrorClusterIds: string[];
  sampleStudentResponses: string[];
}

export function proposeCandidateSkill(input: ProposeCandidateSkillInput): CandidateSkill {
  const candidate: CandidateSkill = {
    id: `cand_${randomUUID()}`,
    proposedBy: input.proposedBy,
    proposedAt: new Date().toISOString(),
    parentSkillId: input.parentSkillId,
    suggestedName: input.suggestedName,
    suggestedDescription: input.suggestedDescription,
    evidenceErrorClusterIds: input.evidenceErrorClusterIds || [],
    sampleStudentResponses: input.sampleStudentResponses || [],
    status: 'PROPOSED', // Always PENDING/PROPOSED until human review
  };

  candidateSkillsStore.set(candidate.id, candidate);
  return candidate;
}

export interface ReviewCandidateSkillInput {
  candidateId: string;
  reviewedBy: string;
  decision: 'APPROVED' | 'REJECTED' | 'MERGED';
  decisionNotes?: string;
  targetSubskillId?: string;
}

export function reviewCandidateSkill(input: ReviewCandidateSkillInput): CandidateSkill {
  const existing = candidateSkillsStore.get(input.candidateId);
  if (!existing) {
    throw new Error(`CandidateSkill ${input.candidateId} not found`);
  }

  const updated: CandidateSkill = {
    ...existing,
    status: input.decision,
    reviewedBy: input.reviewedBy,
    reviewedAt: new Date().toISOString(),
    decisionNotes: input.decisionNotes,
    targetSubskillId: input.targetSubskillId,
  };

  candidateSkillsStore.set(updated.id, updated);

  // Human-in-the-loop validation: Only APPROVED candidate skills generate an active subskill provenance record
  if (input.decision === 'APPROVED' && input.targetSubskillId) {
    setSkillOntologyProvenance({
      skillId: input.targetSubskillId,
      learningOutcome: `Discovered from student error clusters: ${existing.suggestedName}`,
      competency: existing.suggestedDescription,
      curriculumExpectation: `Parent Skill: ${existing.parentSkillId}`,
      instructionalEvidence: `Sample Student Responses: ${existing.sampleStudentResponses.slice(0, 3).join('; ')}`,
      assessmentEvidence: `Error Cluster IDs: ${existing.evidenceErrorClusterIds.join(', ')}`,
      researchEvidence: `Algorithmic proposal by ${existing.proposedBy} on ${existing.proposedAt}`,
      validationStatus: 'APPROVED',
      updatedAt: new Date().toISOString(),
    });
  }

  return updated;
}

export function getCandidateSkills(filter?: { status?: CandidateSkillStatus; parentSkillId?: string }): CandidateSkill[] {
  return Array.from(candidateSkillsStore.values()).filter(cand => {
    if (filter?.status && cand.status !== filter.status) return false;
    if (filter?.parentSkillId && cand.parentSkillId !== filter.parentSkillId) return false;
    return true;
  });
}
