import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcrypt';
import { MongoClient, Db, ClientSession } from 'mongodb';
import { CURRICULUM_MAPPING } from './config/curriculumMap';
import type { StudentCycleLock } from './paperLock';

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DB_DIR, 'db.json');

// Every seeded demo account shares one password, stored ONLY as a bcrypt hash
// (never as plaintext). Defaults to the well-known demo password shown on the login
// screen; override with SEED_DEMO_PASSWORD for a private deployment.
export const SEED_DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'Fln@2026';
export const SEED_DEMO_PASSWORD_HASH = bcrypt.hashSync(SEED_DEMO_PASSWORD, 10);

export let mongoClient: MongoClient | null = null;

export const connectDB = async () => {
  let uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("MONGODB_URI not set — using local DB");
    return;
  }
  let connected = false;
  let attempt = 1;
  const maxAttempts = 3;
  while (!connected && attempt <= maxAttempts) {
    try {
      mongoClient = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 8000,
      });
      await mongoClient.connect();
      // Test ping to verify active MongoDB connection
      await mongoClient.db().command({ ping: 1 });
      console.log("MongoDB Connected");
      dbStore.useMongo = true;
      connected = true;
    } catch (err: any) {
      console.error(`MongoDB connection attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
      attempt++;
      if (attempt <= maxAttempts) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  if (!connected) {
    console.warn("Could not connect to remote MongoDB — falling back to local file DB so server runs reliably.");
    mongoClient = null;
  }
};

// Types & Interfaces corresponding to MongoDB Collections in SRS §10
export enum UserRole {
  SUPERADMIN = 'superadmin',
  ADMIN = 'admin',
  DISTRICT_ADMIN = 'district_admin',
  BLOCK_ADMIN = 'block_admin',
  SCHOOL = 'school',
  TEACHER = 'teacher',
  VOLUNTEER = 'volunteer'
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash?: string; // bcrypt hash; verified at login. Never sent to clients.
  phoneNumber?: string;
  stateCode?: string;
  districtCode?: string;
  blockCode?: string;
  schoolId?: string;
  assignedSchools?: string[]; // for Volunteers
  delayedAttemptsCount?: number;
  isBanned?: boolean;
}

export interface School {
  id: string;
  name: string;
  stateCode: string;
  districtCode: string;
  blockCode: string;
  strength: 'high' | 'low'; // High-strength vs. Low-strength (§1.2)
  teachersCount: number;
  isAccessLocked?: boolean;
}

export interface ClassGroup {
  id: string;
  schoolId: string;
  className: string; // e.g. "Class 2", "Class 3", "Class 4"
  section: string; // e.g. "A", "B"
  teacherId: string;
}

export interface Student {
  id: string;
  name: string;
  age: number;
  classGroup: string; // "Class 2" | "Class 3" | "Class 4"
  section: string;
  schoolId: string;
  teacherId?: string;
  currentLevel: number | null;
  currentSubLevel?: number | null;
  targetLevel: number | null;
  aadharMasked: string; // Masked identifier only; the plaintext Aadhaar is never stored in MongoDB.
  aadhaarTokenId?: string; // Opaque token returned by Aadhaar Vault.
  aadhaarIdentityId?: string; // Deterministic identity id used for duplicate detection.
  // Clean numeric ID for teacher-facing display (roster, profile, printed
  // worksheets) — see backend/src/displayId.ts. Derived from the same
  // non-sensitive state/district/block/school/class/sequence hierarchy
  // already encoded in `id`, just reformatted to be readable/printable.
  // Never used as a lookup key — `id` remains the only internal identifier.
  displayId?: string;
  levelHistory: { level: number; subLevel?: number; date: string; reason: string }[];
  assignedDiagnosticQuestions?: Question[];
  // Extended profile — optional, filled in by the student's own school/teacher.
  // guardianContact and address are PII and are redacted for roles beyond
  // superadmin/school/teacher (same treatment as aadharMasked, §13.2 R-6).
  gender?: 'Male' | 'Female' | 'Other';
  dob?: string;
  guardianName?: string;
  guardianRelation?: string;
  guardianContact?: string;
  address?: string;
  bloodGroup?: string;
  disabilityStatus?: string;
  midDayMealBeneficiary?: boolean;
  busRoute?: string;
  siblingsInSchool?: string;
  teacherNotes?: string;
  streak?: number;
}

export interface Question {
  question_id: string;
  question: string;
  answer: string;
  answer_type: 'text' | 'number' | 'choice';
  choices?: string[];
  topic: string;
  subtopic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  source_level: number; // Mapping to mathematical level
  conceptId?: string; // Concept ID from 93-node framework (e.g. S1.1, S3.3)
  svgAsset?: string; // Standard pre-built SVG asset category
}

/**
 * One rendered file coming out of the standalone Levels_backend batch
 * pipeline (POST /api/generate-batch) for a single student x sublevel x
 * set. answerKey/coords are stored verbatim (shape from that service's
 * buildCleanAnswerKey / captureCoords) so the ICR evaluation pipeline can
 * mark against the real thing instead of a placeholder.
 */
export interface LevelWorksheet {
  id: string;
  batchId: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  levelId: number;
  sublevelId: string;
  setNum: number;
  pdfUrl: string;
  answerKey: any;
  coords: any;
  generatedAt: string;
}

export interface DiagnosticAnswerKey {
  id: string;
  jobId: string;
  studentId: string;
  studentName: string;
  classNumber: number;
  setNumber: number;
  masterJson: any;
  coords: any;
  questionPaperJson: any;
  questions: Question[];
  answerKey?: any;
  /**
   * One physical answer region per gradable question, keyed by the real
   * question id, measured from the rendered worksheet at generation time.
   *
   * Distinct from `coords` above, which is keyed by layout name and cannot be
   * joined to a question id. This is what a scan reads: crop the region for
   * question X, recognise what is inside it, and the result is question X's
   * answer — no inference from ordering.
   */
  answerRegions?: Array<{
    question_id: string;
    /** Section heading the offset is measured from; found in the PDF text layer. */
    anchor?: string;
    dx_mm?: number;
    dy_mm?: number;
    page: number;
    x_mm: number;
    y_mm: number;
    w_mm: number;
    h_mm: number;
  }>;
  createdAt: string;
}

export interface LevelHtmlTemplate {
  levelNumber: number;
  title: string;
  fileName: string;
  htmlContent: string;
  createdAt: string;
}

export interface QuestionBankEntry {
  /**
   * Stable identity, derived from (level, section, questionNumber) — verified
   * unique across all 1202 seeded questions. Deliberately NOT derived from the
   * question text: 314 questions share their text with another, and fixing a
   * typo must not orphan a reviewer's mapping.
   *
   * This exists so review work survives a re-seed. Before it, `seedQuestionBank`
   * did deleteMany + insertMany, so every re-seed rotated the Mongo _ids and
   * would have silently destroyed every mapping a superadmin had made.
   */
  questionId: string;

  level: number;
  levelTitle: string;
  section: string;
  sectionType: string;
  questionNumber: number;
  questionText: string;
  answer: string;
  svgHtml: string;

  // --- Review state. Written by a human, never by the seeder. ---

  /** The 93-space level this question actually assesses, once a human says so. */
  mappedLevel?: number | null;
  /** Immutable concept tag (S1.1 - S7.18), set from the mapped level. */
  conceptId?: string;
  /**
   * `untagged` — nobody has looked at it yet.
   * `mapped`   — a human assigned it to a 93-space level.
   * `retired`  — a human judged it not worth keeping. Kept, not deleted, so the
   *              decision is auditable and reversible; readers must filter it out.
   */
  reviewStatus?: 'untagged' | 'mapped' | 'retired';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

/** The one place the question identity is computed. Seeder and API must agree. */
export function questionBankId(level: number | string, section: string, questionNumber: number | string): string {
  return `qb_L${level}_${String(section).replace(/[^A-Za-z0-9.]+/g, '-')}_${questionNumber}`;
}

// Canonical set of assessment cycle names, used everywhere a cycle name is
// displayed or written (levelHistory.reason, Worksheet.cycle) so there is
// exactly one naming scheme across the whole app.
export const CYCLE_NAMES = ['Baseline', 'Mid-year', 'End-of-year'] as const;
export type CycleName = typeof CYCLE_NAMES[number];

export interface Worksheet {
  id: string; // Exam ID
  classId: string;
  className: string;
  section: string;
  schoolId: string;
  generatedByRole: UserRole;
  generatedByEmail: string;
  cycle: CycleName;
  date: string;
  questions: Question[];
  // Which students this worksheet was actually generated for — needed to
  // compute how many are still pending evaluation (studentIds.length minus
  // the number with a matching EvaluationReport.worksheetId). Optional so
  // older/other worksheet-creation paths that don't set it still validate.
  studentIds?: string[];
  locks: {
    locked: boolean;
    lockedByRole: UserRole | null;
    lockedByEmail: string | null;
    timestamp: string | null;
  };
  timing: {
    examDate: string; // e.g. "2026-07-06"
    printWindowStart: string; // ISO String
    printWindowEnd: string; // ISO String
    examWindowStart: string; // ISO String
    examWindowEnd: string; // ISO String
    submissionWindowEnd: string; // ISO String
  };
  delayLogs: {
    delayedAttemptsCount: number;
    submittingTeachers: string[];
  };
}

// Issue #182: one entry per bulk-generation request (diagnostic/practice/
// remedial/midline/endline), written only from the existing bulk routes at
// the point they already run — not a new trigger point of its own.
export interface TestHistoryEntry {
  id: string;
  teacherId: string;
  teacherEmail: string;
  requestType: 'diagnostic' | 'practice' | 'remedial' | 'midline' | 'endline';
  timestamp: string;
  studentCount: number;
  classId?: string;
  className?: string;
  schoolId?: string;
}

export interface AnswerSubmission {
  id: string;
  worksheetId: string;
  studentId: string;
  studentName: string;
  schoolId: string;
  classId: string;
  submittedAt: string;
  isDelayed: boolean;
  answers: { [questionId: string]: string }; // Q1 -> A, Q2 -> 5, etc.
  /**
   * The paper this submission was written against, for assessments that have no
   * persisted `Worksheet` to join to.
   *
   * A worksheet submission resolves its questions through `worksheetId`. A
   * diagnostic and an ICR scan do not: both are generated per child and neither
   * is stored as a `Worksheet`, so `answers` alone is an unreadable map of ids
   * to strings — there is nothing to say what was asked or what the right answer
   * was. Recording the paper here makes the submission self-describing rather
   * than inventing synthetic `Worksheet` rows that would surface in the
   * generation and lock screens.
   *
   * Optional: submissions written before this field existed, and worksheet
   * submissions that do not need it, simply omit it.
   */
  questions?: Question[];
}

export type ConfidenceLevel = 'Very High' | 'High' | 'Moderate' | 'Low';

export interface TeacherActionPlanStep {
  week: number;
  title: string;
  topics: string[];
}

export interface PrerequisitePath {
  weakConcepts: string[];
  highPriorityFoundations: string[];
  supportingSkills: string[];
  actionPlan: TeacherActionPlanStep[];
}

export interface EvaluationReasoning {
  explanation: {
    headline: string;
    narrative: string;
  };
  conceptMastery: { [topic: string]: 'Strong' | 'Needs Practice' | 'Satisfactory' };
  confidence?: {
    score: number;
    level: ConfidenceLevel;
    explanation: string;
  };
  learningProgression: {
    currentLevel: number;
    currentLevelName: string;
    currentStrand: string;
    nextMilestone: { level: number; name: string; strand: string } | null;
    blockers: { topic: string; questionId?: string; errorType?: string }[];
    recommendations: string[];
  };
  // Phase 5: Prerequisite Learning Path. Built from the same questionResults
  // array that powers the rest of the reasoning payload, so the only source
  // of truth is the submitted paper's correctness.
  prerequisitePath?: PrerequisitePath;
  prerequisiteLearningPath?: {
    highPriorityFoundations: string[];
    supportingSkills: string[];
    affectedCompetencies: string[];
    remediationSequence: string[];
  };
  evidence?: {
    assessedTopics: string[];
    strongestConcepts: string[];
    weakestConcepts: string[];
    failedQuestionSummary: {
      total: number;
      byLevel: { level: number; name: string | null; count: number; pipelineReported?: boolean }[];
      byTopic: { topic: string; count: number }[];
    };
    difficultyBreakdown?: {
      easy: { correct: number; attempted: number };
      medium: { correct: number; attempted: number };
      hard: { correct: number; attempted: number };
    };
    conceptMastery: { [topic: string]: 'Strong' | 'Needs Practice' | 'Satisfactory' };
  };
  remediation?: {
    reusedFailedQuestions: number;
    newlyIntroducedCurriculum: number;
    remediationReason: string;
    targetClass: number | null;
    targetPhrase: string | null;
  };
  curriculumSummary?: {
    currentLevelName: string;
    currentObjective: string;
    currentLearningOutcome: string[];
    currentTopics: string[];
    nextLevelName: string | null;
    nextObjective: string | null;
    transitionReason: string;
  };
  personalized?: {
    failedQuestionsReused: number;
    newLevelQuestionsAdded: number;
    targetPhrase: string | null;
    targetClass: number | null;
    rationale: string;
  };
}

export interface EvaluationReport {
  id: string;
  studentId: string;
  worksheetId: string;
  score: number;
  totalQuestions: number;
  totalCorrect?: number;
  wrongCount?: number;
  conceptMastery: { [topic: string]: 'Strong' | 'Needs Practice' | 'Satisfactory' };
  narrative: string; // Narrative summary for parent/teacher
  recommendedLevel: number;
  recommendedSubLevel?: number;
  timestamp: string;
  /**
   * Per-wrong-answer root causes from the Python pipeline (`ai-services`,
   * step 2 `evaluate_child`).
   *
   * The pipeline has always produced these; until now the backend read only
   * `topics_to_focus` out of its JSON and discarded the rest, so the analysis
   * was recomputed on every diagnostic and then thrown away. Optional because
   * the worksheet-evaluation path does not run the pipeline.
   */
  rootCauses?: Array<{
    questionId: string;
    error: string;
    topic: string;
    flnLevel: number;
    /** conceptual = doesn't understand · careless = slip · prerequisite = missing foundation */
    errorType: 'conceptual' | 'careless' | 'prerequisite' | string;
    analysis: string;
  }>;
  levelsFailed?: number[];
  prerequisitesToCheck?: string[];
  performanceByDifficulty?: {
    [difficulty: string]: { attempted: number; correct: number };
  };
  reasoning?: EvaluationReasoning;
  // Issue #180: per-question breakdown, populated at creation time wherever
  // the grading logic already has this data. Optional because older reports
  // (and any evaluation path that doesn't yet populate it) predate this —
  // the teacher-override endpoint requires it to exist on the report it's
  // correcting, since a correction is meaningless without knowing which
  // question is being corrected.
  questionResults?: { questionId: string; question?: string; correctAnswer?: string; submittedAnswer: string; isCorrect: boolean }[];
    teacherReviewed?: boolean;
    reviewedBy?: string; // reviewing teacher's email
    reviewedAt?: string;
    // Per-level pass/fail breakdown for diagnostic reports — the diagnostic
    // intentionally does NOT assign a placement level (we are heading toward
    // analytics & reports, which read these instead). Populated wherever the
    // grading code knows the per-question source_level.
    passedLevels?: number[];
    failedLevels?: number[];
    // Skills the student is struggling with — conceptIds of the failed levels
    // plus any direct prerequisites (so the panel can show "you have gaps in
    // Number Sense: Counting 6-10"). Drives the status text in the diagnostic
    // panel instead of the old hardcoded "Verified & Certified".
    skillGaps?: { conceptId: string; level: number; levelTitle: string; strand: string }[];
  }

export interface Ticket {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: UserRole;
  type: 'general' | 'curriculum';
  subject: string;
  description: string;
  status: 'Open' | 'Reviewed' | 'Resolved';
  createdAt: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  schoolId: string;
  schoolName: string;
  userId: string;
  userEmail: string;
  userRole: UserRole;
  activityType:
    | 'download'
    | 'print'
    | 'conduct'
    | 'scan'
    | 'verify'
    | 'ticket'
    // Vault audit actions (the vault is the only writer of these
    // — see backend/src/modules/vault/audit/logbook-entry.ts). The
    // `logbook` collection is the single audit sink; there is no
    // separate `vault_audit_log` table. The Aadhaar vault command
    // and the surrounding route layer use the existing
    // `dbStore.addLog` / `dbStore.addLogInSession` path, so these
    // values are visible in the same `logbook` queries the rest
    // of the FLN backend already runs.
    | 'tokenize'
    | 'detokenize'
    | 'step_up_request'
    | 'step_up_approve'
    | 'mfa_enroll'
    | 'mfa_verify'
    // NEW (Wave 2A): account-level MFA enrollment lifecycle
    // events. The vault command and the FLN route layer both
    // write rows that carry these activityType values. The
    // mapping lives in
    // `backend/src/modules/vault/audit/logbook-entry.ts`.
    | 'mfa_enrollment_initiated'
    | 'mfa_enrollment_verified'
    | 'mfa_enrollment_failed'
    | 'mfa_enrollment_revoked';
  status: 'Success' | 'Failed' | 'Delayed';
  details: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  isUrgent: boolean;
  authorEmail: string;
  createdAt: string;
}

export type InterventionStrategyType = 'small_group' | 'one_on_one' | 'peer_tutoring' | 'visual_aids' | 'manipulatives' | 'worksheets' | 'game_based' | 'other';

export interface Intervention {
  id: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  schoolId: string;
  classId: string;
  className: string;
  section: string;
  weakCompetencies: string[];
  currentLevel: number;
  strategyType: InterventionStrategyType;
  strategyDescription: string;
  duration: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'completed' | 'pending_review';
  outcome?: {
    improved: boolean;
    previousLevel: number;
    newLevel?: number;
    improvementDetails?: string;
    assessmentId?: string;
    detectedAt?: string;
  };
  isPromoted: boolean;
  promotedAt?: string;
  createdAt: string;
}

export interface BestPractice {
  id: string;
  interventionId: string;
  teacherId: string;
  teacherName: string;
  schoolId: string;
  weakCompetencies: string[];
  strategyType: string;
  strategyDescription: string;
  levelBefore: number;
  levelAfter: number;
  levelJump: number;
  duration: string;
  tags: string[];
  viewCount: number;
  createdAt: string;
}
export interface MisconceptionCluster {
  id: string;
  name: string;
  description: string;
  teacherAction: string;
  forwardRisk: string;
  studentIds: string[];
  centroid?: number[];
  /**
   * The class this archetype belongs to. Archetypes never span classes: the
   * same-looking error means something different at each level (an off-by-one
   * in Class 2 counting is not the off-by-one of Class 4 regrouping), and a
   * teaching group a teacher can act on has to be one class they actually
   * teach. Optional only because clusters created before this field existed
   * carry no class; those are treated as belonging to no class and skipped.
   */
  classGroup?: string;
  /**
   * Who last renamed this archetype by hand, if anyone.
   *
   * Presence marks the name as human-authored, which is what stops automation
   * from taking it back: the deterministic re-naming pass skips these outright
   * rather than relying on the name merely not *looking* like a placeholder.
   *
   * Worth knowing when reading these: an archetype is scoped by `classGroup`
   * alone and carries no `schoolId`, so a rename is visible to every school
   * teaching that class — hence recording who did it.
   */
  nameSetBy?: string;
  nameSetByRole?: UserRole;
  nameSetAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A Superadmin-authored instruction describing *what to ask* at a given level —
 * not a question itself. One logic is the prompt the question-generation
 * pipeline turns into many concrete `Question` rows across many worksheets.
 *
 * Deliberately a separate collection from `questions`: these have different
 * authors (human vs. generator), different consumers (generation pipeline vs.
 * renderer and ICR scanner), and different lifecycles (editable in place vs.
 * immutable once a child has answered them). Folding them together would make
 * one collection carry two incompatible lifecycles.
 */
export interface QuestionLogic {
  id: string;
  /** 1..LEVEL_COUNT, L-notation. Mutable — a logic filed under the wrong level can be re-tagged. */
  level: number;
  /** Denormalized for display so the list view needs no join. */
  levelName: string;
  /** At least one. Validated server-side against the level's primary+supporting skills. */
  skills: string[];
  /** Optional. Empty means "assess the skill at full granularity", which is a valid choice. */
  subskills: string[];
  logicText: string;
  /**
   * Which relationship taxonomy was in force when this was authored.
   * The project is moving from the code's 4-type model to the research's
   * 3-type model; pinning it per-document means both can coexist through the
   * migration instead of forcing a schema break.
   */
  taxonomy: '3-type' | '4-type';
  createdBy: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  updatedByEmail: string;
  /** Soft delete: the generation pipeline may already hold this id, so the row stays for audit. */
  deletedAt: string | null;
  deletedBy: string | null;
}

/**
 * A Superadmin-authored question: the stem a child reads, how the answer is
 * recorded, and the constraints that govern the numbers inside it.
 *
 * Distinct from `QuestionLogic`, which described a question in prose and left
 * the generator to interpret it. A template says the same thing in fields that
 * can be validated, compared and bulk-imported, so two authors describing the
 * same variation produce the same row rather than two sentences that only a
 * human can tell apart.
 *
 * Addressed by `conceptId`, never by level number. Levels are insertable and
 * re-orderable; the concept a question assesses is not. See `CurriculumLevel`.
 */
export interface QuestionTemplate {
  id: string;

  /** Canonical curriculum identity, e.g. "S3.4". The thing this question assesses. */
  conceptId: string;
  /**
   * Display alias only, resolved from `conceptId` at write time. Never the
   * identity: it is denormalised so the list view needs no join, and it is
   * recomputed whenever the concept changes.
   */
  levelNumber: number;
  levelName: string;

  /** At least one. Validated server-side against the level's primary+supporting skills. */
  skills: string[];
  /** Optional. Empty means "assess the skill at full granularity", which is a valid choice. */
  subskills: string[];

  /**
   * What the question should make the child do, in the author's words. This is
   * an instruction to the generator, not a finished question: it names the
   * learning action, the visual behaviour, and how the answer is given.
   *
   * Required for structured records. Deliberately never contains a specific
   * number or object, so one intent can be rendered across every visual theme
   * without being re-authored.
   */
  generationIntent: string;

  /** Which family of question this intent produces. Governs how it is rendered. */
  questionFamily: 'counting' | 'operation';

  /**
   * How this row was authored. `structured` rows carry a generationIntent and
   * no authored answer. `legacy-free-text` rows predate that and carry a stem.
   * Kept explicit so a migration never has to guess by sniffing empty strings.
   */
  paramMode: 'structured' | 'legacy-free-text' | 'hybrid';

  /**
   * Visual themes this intent may be drawn with, as ids into the SVG manifest.
   * Plural because one counting intent should work across fruit, animals and
   * vehicles; the renderer picks a variant per paper.
   */
  svgThemeIds: string[];

  /**
   * LEGACY. What the child reads, written out by hand. Retained read-only so
   * rows authored before the intent model are not lost; new structured records
   * leave it empty. Do not add new writers.
   */
  stem: string;
  /**
   * LEGACY. A hand-authored answer. Retained for the same reason as `stem`.
   *
   * Structured records must not carry one: the answer is produced by the
   * generator and lives on the generated Question as an internal answer key,
   * never as something a Superadmin typed into the authoring form.
   */
  answerSpec: string;

  // --- Structured parameters. See backend/src/types/questionTemplateParams.ts ---
  numeralRange: string | null;
  digitCount: string | null;
  /** Empty means "not specified", not "any operation". */
  operations: string[];
  maxOperandCount: number | null;
  carryBehavior: string | null;
  borrowBehavior: string | null;
  maxSumOrDifference: string | null;
  answerType: string | null;
  blankCount: number | null;
  questionCount: number | null;
  subjectCategory: string | null;

  /**
   * Human-readable name for this variation, derived from the parameters at
   * creation. Editable afterwards, and an edit is preserved: the derivation
   * runs again only when an author asks for it.
   */
  name: string;
  /**
   * Fingerprint of (conceptId + parameters). Two templates constraining the
   * same thing at the same concept share a key, which is what makes duplicate
   * variations findable. Deliberately not a unique index — two Superadmins may
   * legitimately author the same variation with different stems.
   */
  variantKey: string;
  /** Free-form author tags, lowercased and de-duplicated on write. */
  tags: string[];

  /** Where the row came from. Bulk imports are worth being able to find again. */
  source: 'form' | 'csv';

  createdBy: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  updatedByEmail: string;
  /** Soft delete: a generated paper may already cite this id, so the row stays for audit. */
  deletedAt: string | null;
  deletedBy: string | null;
}

/**
 * One selectable value in the question-authoring form: a number range, an
 * operation, or a visual theme.
 *
 * These live in the database rather than in a TypeScript constant so a
 * Superadmin can add "0 to 500" without a deploy. The catalogue, the server
 * validation and the form all read these same rows, which is what stops a
 * value existing in the dropdown but being rejected on save.
 */
export interface QuestionOption {
  id: string;
  type: 'numeral-range' | 'operation' | 'svg-theme';
  /** Stable machine key, e.g. "0-500". Unique per type among active rows. */
  key: string;
  label: string;

  /** Range bounds. Only meaningful when type is 'numeral-range'. */
  min?: number;
  max?: number;

  /**
   * Whether anything can actually generate with this value yet.
   *
   * A label in the database is not an implementation: an author can record
   * that they want modulo questions, but the option stays out of the
   * generation catalogue until something can produce one. This is what stops
   * a Superadmin authoring rows that silently never generate.
   */
  implementationStatus: 'ready' | 'not-ready';

  /** Soft delete. Values are deactivated, never removed, because rows reference them. */
  active: boolean;

  /** Marks a value we intend to retire but have not migrated off yet. */
  deprecated?: boolean;

  metadata?: Record<string, unknown>;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * One row per FLN level in the canonical 93-level taxonomy.
 *
 * This collection exists to give the curriculum a single queryable home. Before
 * it, the 93 levels lived only as TypeScript in the frontend package, so every
 * backend feature that needed to reason about levels hand-authored its own copy
 * — there were six such copies at last count, in two different id spaces.
 *
 * Seeded (idempotently) by `npm run seed:levels` from
 * `frontend/src/data/skillProgressionMap.ts`. No route writes to it.
 */
export interface CurriculumLevel {
  /**
   * Canonical, immutable identity. Generated once at first insert and never
   * regenerated — student evidence points here, so renumbering would orphan it.
   * Every other identifier on this document is an alias of this one.
   */
  conceptId: string;

  /** L-notation, 1..93. The alias the platform standardises on. */
  levelNumber: number;
  /** Research S-notation, e.g. "S4.3". */
  sCode: string;
  /**
   * The retired 1..59 worksheet-engine id, where one maps.
   *
   * Deliberately temporary: it is the bridge that lets 59-keyed content be
   * re-keyed by lookup rather than by hand, and lets anything still speaking
   * 59 keep working mid-migration. Null once a level has no 59-space ancestor,
   * and the field is dropped entirely once nothing reads it.
   */
  legacyLevel59: number | null;

  stage: string;
  capability: string;
  strand: string;

  /** From the skill map — a level is defined by the skills it assesses. */
  primarySkills: string[];
  supportingSkills: string[];
  subskills: string[];

  /**
   * Content coverage, recomputed at every seed. These are the honest answer to
   * "how many of the 93 can we actually render today" — false is a real gap,
   * not a defect.
   */
  hasStaticHtml: boolean;
  hasBuilder: boolean;

  curriculumVersion: string;
  createdAt: string;
  updatedAt: string;
}

interface DatabaseSchema {
  users: User[];
  schools: School[];
  classes: ClassGroup[];
  students: Student[];
  questions: Question[];
  worksheets: Worksheet[];
  levelWorksheets: LevelWorksheet[];
  levelHtmlTemplates: LevelHtmlTemplate[];
  questionBank: QuestionBankEntry[];
  answerSubmissions: AnswerSubmission[];
  evaluationReports: EvaluationReport[];
  tickets: Ticket[];
  logbook: LogEntry[];
  announcements: Announcement[];
  interventions: Intervention[];
  bestPractices: BestPractice[];
  diagnosticAnswerKeys: DiagnosticAnswerKey[];
  misconceptionClusters: MisconceptionCluster[];
  testHistory: TestHistoryEntry[];
  questionLogics: QuestionLogic[];
  questionTemplates: QuestionTemplate[];
  questionOptions: QuestionOption[];
  curriculumLevels: CurriculumLevel[];
  studentCycleLocks: StudentCycleLock[];
}

const COLLECTION_NAMES: Record<keyof DatabaseSchema, string> = {
  users: 'users',
  schools: 'schools',
  classes: 'classes',
  students: 'students',
  questions: 'questions',
  worksheets: 'worksheets',
  levelWorksheets: 'levelWorksheets',
  levelHtmlTemplates: 'levelHtmlTemplates',
  questionBank: 'questionBank',
  answerSubmissions: 'answer_submissions',
  evaluationReports: 'evaluation_reports',
  tickets: 'tickets',
  logbook: 'logbook',
  announcements: 'announcements',
  interventions: 'interventions',
  bestPractices: 'best_practices',
  diagnosticAnswerKeys: 'diagnostic_answer_keys',
  misconceptionClusters: 'misconception_clusters',
  testHistory: 'testHistory',
  questionLogics: 'questionLogics',
  questionTemplates: 'questionTemplates',
  questionOptions: 'questionOptions',
  curriculumLevels: 'curriculumLevels',
  studentCycleLocks: 'studentCycleLocks',
};

/**
 * Aadhaar-sensitive fields that may ONLY be written by the tokenized creation
 * path (routes/students.ts → createStudentFromData via addStudent). Every key
 * that could carry a raw number, a vault reference, or the mask is listed so
 * updateStudent()'s generic $set can never reintroduce plaintext or clobber
 * vault references through a future, less careful caller.
 *
 * Deliberately broader than the Student interface: includes legacy/spelling
 * variants (`aadhar`, `aadhaarNumber`) that a well-meaning future contributor
 * might reach for.
 */
const AADHAAR_PROTECTED_UPDATE_FIELDS: readonly string[] = [
  'aadhaar',
  'aadhar',
  'aadharNumber',
  'aadhaarNumber',
  'aadhaarTokenId',
  'aadhaarIdentityId',
  'aadharMasked',
];

/**
 * Collapse multiple `Question` rows that share the same `question_id` into a
 * single row, comma-joining their `answer` values so no information is lost.
 *
 * The diagnostic paper can be assembled from several sources (cached
 * `assignedDiagnosticQuestions`, the freshly-generated class paper, the
 * `questionBank` collection). When those paths overlap the same question
 * can appear more than once. Without deduping, the OCR scan would treat
 * the duplicate as a separate row, inflate the total count, and silently
 * double-count correct/incorrect in the donut.
 *
 * Behavior:
 *   - First occurrence of each `question_id` wins for the metadata fields
 *     (conceptId, source_level, topic, ...).
 *   - Subsequent duplicates contribute their `answer` value to a comma-
 *     separated list on the merged row (de-duplicated within the join so
 *     the same answer string isn't repeated).
 *   - Order of the original list is preserved (first-seen order), so
 *     downstream iteration matches the paper the student was actually shown.
 */
export function dedupeQuestionsById(questions: Question[]): Question[] {
  const byId = new Map<string, Question>();
  const order: string[] = [];
  for (const q of questions) {
    const id = q.question_id;
    if (!id) continue;
    if (!byId.has(id)) {
      order.push(id);
      byId.set(id, { ...q });
      continue;
    }
    const existing = byId.get(id)!;
    const parts = new Set<string>();
    const existingParts = String(existing.answer ?? '').split(',').map(s => s.trim()).filter(Boolean);
    existingParts.forEach(p => parts.add(p));
    const incoming = String(q.answer ?? '').split(',').map(s => s.trim()).filter(Boolean);
    incoming.forEach(p => parts.add(p));
    existing.answer = Array.from(parts).join(', ');
  }
  return order.map(id => byId.get(id)!);
}

export class DBStore {
  private data: DatabaseSchema | null = null;
  public useMongo: boolean = false;
  private mongoDb: Db | null = null;

  getDb(): Db | null {
    if (this.mongoDb) return this.mongoDb;
    if (mongoClient) {
      const dbName = process.env.MONGODB_DB_NAME;
      this.mongoDb = dbName ? mongoClient.db(dbName) : mongoClient.db();
      return this.mongoDb;
    }
    return null;
  }

  // Generic key-value config store. Keys are arbitrary strings; values
  // are arbitrary JSON-serializable blobs. Stored in MongoDB collection
  // `appConfig` ({_id: key, value}). Used for runtime config like
  // ICR_CLOUD_API_KEY_GOOGLE etc that admins set via the API instead
  // of environment variables.
  async getConfig(key: string): Promise<any> {
    const db = this.getDb();
    if (!db) return null;
    const doc = await db.collection('appConfig').findOne({ _id: key } as any);
    return doc?.value ?? null;
  }

  async setConfig(key: string, value: any): Promise<void> {
    const db = this.getDb();
    if (!db) throw new Error('MongoDB not connected');
    await db.collection('appConfig').updateOne(
      { _id: key } as any,
      { $set: { value, updatedAt: new Date() } },
      { upsert: true }
    );
  }

  async init() {
    if (mongoClient) {
      try {
        const dbName = process.env.MONGODB_DB_NAME;
        this.mongoDb = dbName ? mongoClient.db(dbName) : mongoClient.db();
        this.data = {} as DatabaseSchema;
        const db = this.mongoDb;

        // Ensure diagnostic_answer_keys collection is explicitly created in MongoDB
        try {
          const collections = await db.listCollections({ name: 'diagnostic_answer_keys' }).toArray();
          if (collections.length === 0) {
            await db.createCollection('diagnostic_answer_keys');
            console.log('Explicitly created MongoDB collection "diagnostic_answer_keys"');
          }
        } catch (e: any) {
          console.warn('Collection check info:', e.message);
        }

        // Ensure indexes on students collection for performance
        try {
          const studentsColl = db.collection('students');
          await studentsColl.createIndex({ id: 1 }, { unique: true });
          await studentsColl.createIndex({ schoolId: 1 });
          await studentsColl.createIndex({ teacherId: 1 });
          await studentsColl.createIndex({ aadharMasked: 1 });
          // Phase 2 hardening: layer-2 duplicate detection queries this field
          // on every registration (routes/students.ts → getExistingAadhaar-
          // IdentityIds). Deliberately NON-unique for now: legacy records may
          // predate aadhaarIdentityId or contain duplicate values, and a
          // unique constraint introduced blind would turn reads/writes of
          // those rows into errors. Revisit uniqueness only after
          // scripts/audit-aadhaar-at-rest.ts reports the data is clean.
          await studentsColl.createIndex({ aadhaarIdentityId: 1 });
          // Case-insensitive search indexes for the Aadhaar Reveal / admin
          // student search. The route's $or uses BSON range ({$gte: $lt})
          // on these six fields; the index collation lets the range scan
          // be case-insensitive, and the index OR uses one IXSCAN per
          // branch. Without these, an 86k-row collection would COLLSCAN
          // on every keystroke. The same collation must be set on the
          // cursor (see getStudents) — a strength:2 index compared with
          // the simple-binary default ignores the index entirely.
          // The choice of strength:2 (case + accent insensitive but
          // still case-folded for ordering) is a deliberate compromise:
          // full case+accent insensitive would be strength:1, but
          // school/class identifiers do carry case information some
          // admins rely on, and strength:1 would also make 'a' and 'ä'
          // indistinguishable, which is wrong for names. Strength:2 is
          // the standard for "case-insensitive prefix search".
          const searchCollation = { locale: 'en', strength: 2 };
          for (const f of ['name', 'displayId', 'aadharMasked', 'schoolId', 'classGroup', 'section']) {
            await studentsColl.createIndex({ [f]: 1 }, { collation: searchCollation, name: f + '_ci' });
          }
          console.log('Successfully ensured indexes on "students" collection');
        } catch (e: any) {
          console.warn('Failed to ensure indexes on "students" collection:', e.message);
        }

        // Ensure indexes on users collection for performance
        try {
          const usersColl = db.collection('users');
          await usersColl.createIndex({ id: 1 }, { unique: true });
          await usersColl.createIndex({ email: 1 }, { unique: true });
          console.log('Successfully ensured indexes on "users" collection');
        } catch (e: any) {
          console.warn('Failed to ensure indexes on "users" collection:', e.message);
        }

        // Ensure indexes on the authoring collections.
        //
        // `questionLogics` has never carried any index, including on `id`,
        // which `getQuestionLogicById` queries by. Added here alongside the
        // new collection rather than left for later.
        try {
          const logicsColl = db.collection('questionLogics');
          await logicsColl.createIndex({ id: 1 }, { unique: true });

          const templatesColl = db.collection('questionTemplates');
          await templatesColl.createIndex({ id: 1 }, { unique: true });
          await templatesColl.createIndex({ conceptId: 1, deletedAt: 1 });
          await templatesColl.createIndex({ variantKey: 1, deletedAt: 1 });
          await templatesColl.createIndex({ tags: 1, deletedAt: 1 });
          await templatesColl.createIndex({ paramMode: 1, deletedAt: 1 });

          const optionsColl = db.collection('questionOptions');
          await optionsColl.createIndex({ id: 1 }, { unique: true });
          await optionsColl.createIndex({ type: 1, active: 1 });
          console.log('Successfully ensured indexes on the question authoring collections');
        } catch (e: any) {
          console.warn('Failed to ensure indexes on the question authoring collections:', e.message);
        }

        // Ensure indexes on evaluationReports collection for performance
        try {
          const reportsColl = db.collection('evaluationReports');
          await reportsColl.createIndex({ studentId: 1 });
          console.log('Successfully ensured indexes on "evaluationReports" collection');
        } catch (e: any) {
          console.warn('Failed to ensure indexes on "evaluationReports" collection:', e.message);
        }

        for (const [key, collName] of Object.entries(COLLECTION_NAMES)) {
          (this.data as any)[key] = [];
        }
        // Load users into memory for sync auth lookups (getUserSync)
        this.data.users = await db.collection<User>('users').find({}, { projection: { password: 0 } }).toArray();
        const userCount = this.data.users.length;
        const schoolCount = await db.collection('schools').countDocuments();
        const studentCount = await db.collection('students').countDocuments();

        // If MongoDB Atlas users collection is empty, merge local seed users into memory without modifying MongoDB
        if (userCount === 0) {
          const seed = this.getSeedData();
          this.data.users = seed.users;
        }
        console.log(`MongoDB ready: ${userCount} users in Atlas (${this.data.users.length} active), ${schoolCount} schools, ${studentCount} students`);
        return;
      } catch (err: any) {
        console.warn(`MongoDB initialization failed (${err.message}) — falling back to local file DB.`);
        this.mongoDb = null;
        mongoClient = null;
      }
    } else {
      console.log('No MongoDB — falling back to file-based DB');
      try {
        await fs.mkdir(DB_DIR, { recursive: true });
      } catch (_) { }
      try {
        const content = await fs.readFile(DB_FILE, 'utf-8');
        this.data = JSON.parse(content);
      } catch (_) {
        this.data = this.getSeedData();
        await this.save();
      }
    }
  }

  private async save() {
    if (!this.data) return;
    await fs.writeFile(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  private async persistCollection(key: keyof DatabaseSchema) {
    if (!this.data || !mongoClient) return;
    const db = this.getDb();
    if (!db) return;
    const collName = COLLECTION_NAMES[key];
    const items = (this.data as any)[key] || [];
    const coll = db.collection(collName);
    await coll.deleteMany({});
    if (items.length > 0) {
      await coll.insertMany(items);
    }
  }

  async reset() {
    this.data = this.getSeedData();
    if (mongoClient) {
      const db = this.getDb();
      if (!db) return;
      for (const [key, collName] of Object.entries(COLLECTION_NAMES)) {
        const items = (this.data as any)[key] || [];
        const coll = db.collection(collName);
        await coll.deleteMany({});
        if (items.length > 0) {
          await coll.insertMany(items);
        }
      }
    } else {
      await this.save();
    }
  }

  // --- Collection Accessors ---

  getUserSync(email: string): User | null {
    if (!this.data || !this.data.users) return null;
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (this.mongoDb) {
      try {
        // Anchored regex with the email field. The `email` field has a regular
        // index from init(); a fully-anchored regex on an indexed field still
        // scans the index, but the index is keyed on the value so it's bounded.
        const u = await this.mongoDb.collection<User>('users').findOne({
          email: { $regex: new RegExp(`^${cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') }
        });
        if (u) {
          if (this.data && this.data.users) {
            const idx = this.data.users.findIndex(x => x.email.toLowerCase() === cleanEmail || x.id === u.id);
            if (idx >= 0) this.data.users[idx] = u;
            else this.data.users.push(u);
          }
          return u;
        }
      } catch (_) { }
    }
    return this.getUserSync(cleanEmail);
  }

  async getUsers() {
    if (this.mongoDb) return await this.mongoDb.collection<User>('users').find({}).toArray();
    return this.data?.users || [];
  }
  async getSchools() {
    if (this.mongoDb) return await this.mongoDb.collection<School>('schools').find({}).toArray();
    return this.data?.schools || [];
  }
  async getClasses() {
    if (this.mongoDb) return await this.mongoDb.collection<ClassGroup>('classes').find({}).toArray();
    return this.data?.classes || [];
  }
  async getStudents(opts?: { limit?: number; offset?: number; schoolId?: string | string[]; teacherId?: string; sort?: 'latest'; q?: string }) {
    // Search must run BEFORE limit/offset. A previous version of this
    // function only sorted/paged, and the caller (routes/students.ts)
    // applied the search AFTER the paged result had been returned. On an
    // 86,400-row collection that meant a search match at position 500
    // would never appear in the page (the first 10 were the 10 most-recent
    // inserts, with no guarantee any of them matched). The result was a
    // panel that "did nothing" as the user typed. Pushing the search
    // here means the same query Mongo/JS does is also the one that
    // pagination slices.
    const search = (opts?.q || '').trim().toLowerCase();
    if (this.mongoDb) {
      const filter: any = {};
      if (opts?.schoolId) {
        if (Array.isArray(opts.schoolId)) {
          filter.schoolId = { $in: opts.schoolId };
        } else {
          filter.schoolId = opts.schoolId;
        }
      }
      if (opts?.teacherId) filter.teacherId = opts.teacherId;
      if (search) {
        // Case-insensitive PREFIX match on the same six fields the panel
        // advertises. The previous version used an unanchored case-insensitive
        // regex (e.g. /foo/i), which CANNOT use a B-tree index in this
        // MongoDB version — every keystroke COLLSCAN'd the 86k-row
        // collection. The fix is a BSON range { $gte: prefix, $lt: prefix+'￿' }
        // combined with a strength:2 collation on the cursor. Combined with
        // the matching collation-aware indexes (see the `init()` block
        // above), Mongo uses index OR (one IXSCAN per $or branch) and the
        // search runs in single-digit ms.
        //
        // The semantic change is "prefix" instead of "substring" — typing
        // "kar" still finds "Kartik", but typing "artik" no longer matches
        // "Kartik" via a mid-string substring. This is the smallest
        // architecturally correct change that preserves the user-typed
        // search box; the API contract (the ?q= parameter) is unchanged.
        // The in-memory (file-fallback) path below mirrors this with
        // .startsWith() so dev and prod return the same results.
        const prefix = search;
        const upper = prefix + '￿';
        filter.$or = [
          { name:        { $gte: prefix, $lt: upper } },
          { displayId:   { $gte: prefix, $lt: upper } },
          { aadharMasked:{ $gte: prefix, $lt: upper } },
          { schoolId:    { $gte: prefix, $lt: upper } },
          { classGroup:  { $gte: prefix, $lt: upper } },
          { section:     { $gte: prefix, $lt: upper } },
        ];
      }
      const skip = opts?.offset || 0;
      const limit = opts?.limit || 0;
      const cursor = this.mongoDb.collection<Student>('students').find(filter);
      // When the query has a search, use the same collation as the
      // `*_ci` indexes above. Without this, Mongo falls back to the
      // simple-binary collation, the index OR is unusable, and we
      // COLLSCAN the whole collection. With it, index OR turns 6
      // COLLSCANs into 6 IXSCANs (~1ms each on 86k rows).
      if (search) cursor.collation({ locale: 'en', strength: 2 });
      // `sort: 'latest'` returns most-recently-inserted first. In Mongo
      // the natural `_id` ObjectId is time-prefixed, so a descending
      // sort gives the same intent as "newest at the top" in the
      // file-fallback store (where students are `push`ed to the array
      // and we reverse the result). Other sort modes are intentionally
      // not exposed — the route layer is the only place that names
      // sort orders.
      if (opts?.sort === 'latest') cursor.sort({ _id: -1 });
      if (skip) cursor.skip(skip);
      if (limit) cursor.limit(limit);
      return await cursor.toArray();
    }
    let result = this.data?.students || [];
    if (opts?.schoolId) {
      const wanted = Array.isArray(opts.schoolId) ? opts.schoolId : [opts.schoolId];
      result = result.filter(s => wanted.includes(s.schoolId));
    }
    if (opts?.teacherId) result = result.filter(s => s.teacherId === opts.teacherId);
    if (search) {
      // Same six fields, same case-insensitive PREFIX semantics as the
      // Mongo $or above (see comment in the Mongo branch). The previous
      // version used `.includes()` (substring); the new Mongo path is
      // BSON range + collation, which is prefix-only. We mirror that
      // here with `.startsWith()` so dev (file-fallback) and prod
      // (Mongo) return the same rows for the same `q` — otherwise a
      // dev who types "artik" sees "Kartik" in their file-fallback
      // results but a prod deploy would not, and vice versa.
      result = result.filter(s => {
        const fields = [
          s.name, s.displayId, s.aadharMasked, s.schoolId, s.classGroup, s.section,
        ];
        for (const v of fields) {
          if (v != null && String(v).toLowerCase().startsWith(search)) return true;
        }
        return false;
      });
    }
    // For the file-fallback store, students are appended to the array
    // on insert, so the array is in chronological order. Reversing it
    // gives "latest first" — matching the Mongo sort({ _id: -1 })
    // path.
    if (opts?.sort === 'latest') result = [...result].reverse();
    if (opts?.offset) result = result.slice(opts.offset);
    if (opts?.limit) result = result.slice(0, opts.limit);
    return result;
  }
  /**
   * One student by business id, without pulling the collection.
   *
   * `getStudents()` ships all 86k student documents to the caller; anything
   * that needs a single child (archetype assignment runs once per evaluation,
   * and once per student inside the bulk ICR loop) must not pay that.
   */
  async getStudentById(id: string): Promise<Student | null> {
    if (this.mongoDb) {
      return await this.mongoDb.collection<Student>('students').findOne({ id });
    }
    return (this.data?.students || []).find(s => s.id === id) || null;
  }
  async countStudents(opts?: { schoolId?: string; teacherId?: string; q?: string }) {
    // Mirrors getStudents' search semantics so the route's X-Total-Count
    // header reflects the full match count, not the post-pagination
    // page count. The previous version took no `q` and the route fell
    // back to `masked.length` (the post-page count) — same
    // whole-collection / first-page mismatch that broke the search.
    const search = (opts?.q || '').trim().toLowerCase();
    if (this.mongoDb) {
      const filter: any = {};
      if (opts?.schoolId) filter.schoolId = opts.schoolId;
      if (opts?.teacherId) filter.teacherId = opts.teacherId;
      if (search) {
        // Mirror the BSON-range + collation pattern from getStudents
        // exactly. countStudents drives the route's X-Total-Count
        // header, and it MUST match the page's filter — otherwise
        // pagination shows the wrong total. With the same $or and
        // the same collation, Mongo uses the same six IXSCANs as
        // the find, so the count is also single-digit ms on 86k rows.
        const prefix = search;
        const upper = prefix + '￿';
        filter.$or = [
          { name:        { $gte: prefix, $lt: upper } },
          { displayId:   { $gte: prefix, $lt: upper } },
          { aadharMasked:{ $gte: prefix, $lt: upper } },
          { schoolId:    { $gte: prefix, $lt: upper } },
          { classGroup:  { $gte: prefix, $lt: upper } },
          { section:     { $gte: prefix, $lt: upper } },
        ];
      }
      // Same collation as the find; required for the *_ci indexes.
      // Without the search path, countDocuments hits the existing
      // schoolId/teacherId indexes and does not need a collation.
      if (search) {
        return await this.mongoDb.collection('students').countDocuments(filter, { collation: { locale: 'en', strength: 2 } });
      }
      return await this.mongoDb.collection('students').countDocuments(filter);
    }
    let result = this.data?.students || [];
    if (opts?.schoolId) result = result.filter(s => s.schoolId === opts.schoolId);
    if (opts?.teacherId) result = result.filter(s => s.teacherId === opts.teacherId);
    if (search) {
      // Same prefix-only semantics as getStudents' in-memory path.
      result = result.filter(s => {
        const fields = [
          s.name, s.displayId, s.aadharMasked, s.schoolId, s.classGroup, s.section,
        ];
        for (const v of fields) {
          if (v != null && String(v).toLowerCase().startsWith(search)) return true;
        }
        return false;
      });
    }
    return result.length;
  }


  /**
   * Fast aggregation: count of students, optionally filtered.
   * Uses MongoDB countDocuments (uses index, no docs loaded).
   */
  async countStudentsFast(opts?: { schoolId?: string; currentLevelMin?: number }): Promise<number> {
    if (this.mongoDb) {
      const filter: any = {};
      if (opts?.schoolId) filter.schoolId = opts.schoolId;
      if (opts?.currentLevelMin != null) filter.currentLevel = { $gte: opts.currentLevelMin };
      return await this.mongoDb.collection('students').countDocuments(filter);
    }
    let result = this.data?.students || [];
    if (opts?.schoolId) result = result.filter(s => s.schoolId === opts.schoolId);
    if (opts?.currentLevelMin != null) result = result.filter(s => (s.currentLevel || 0) >= opts.currentLevelMin!);
    return result.length;
  }

  /** Fast count of schools with optional filters. */
  async countSchoolsFast(opts?: { stateCode?: string; schoolType?: string; accessLocked?: boolean }): Promise<number> {
    if (this.mongoDb) {
      const filter: any = {};
      if (opts?.stateCode) filter.stateCode = opts.stateCode;
      if (opts?.schoolType) filter.schoolType = opts.schoolType;
      if (opts?.accessLocked != null) filter.accessLocked = opts.accessLocked;
      return await this.mongoDb.collection('schools').countDocuments(filter);
    }
    let result = (this.data?.schools || []) as any[];
    if (opts?.stateCode) result = result.filter((s: any) => s.stateCode === opts!.stateCode);
    if (opts?.schoolType) result = result.filter((s: any) => s.schoolType === opts!.schoolType);
    if (opts?.accessLocked != null) result = result.filter((s: any) => s.accessLocked === opts!.accessLocked);
    return result.length;
  }

  /** Fast count of users by role. Returns { role: count }. */
  async countUsersByRole(): Promise<Record<string, number>> {
    if (this.mongoDb) {
      const result = await this.mongoDb.collection('users').aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]).toArray();
      const counts: Record<string, number> = {};
      result.forEach(r => { counts[r._id] = r.count; });
      return counts;
    }
    const counts: Record<string, number> = {};
    (this.data?.users || []).forEach(u => {
      const r = u.role || 'unknown';
      counts[r] = (counts[r] || 0) + 1;
    });
    return counts;
  }

  /**
   * Fast aggregation: school counts grouped by stateCode.
   * Returns [{ stateCode, count }] sorted by count desc.
   */
  async countSchoolsByState(): Promise<Array<{ stateCode: string; count: number }>> {
    if (this.mongoDb) {
      const result = await this.mongoDb.collection('schools').aggregate([
        { $group: { _id: '$stateCode', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).toArray();
      return result.map(r => ({ stateCode: r._id || 'UNKNOWN', count: r.count }));
    }
    const counts: Record<string, number> = {};
    (this.data?.schools || []).forEach(s => {
      const sc = s.stateCode || 'UNKNOWN';
      counts[sc] = (counts[sc] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([stateCode, count]) => ({ stateCode, count }))
      .sort((a, b) => b.count - a.count);
  }

  /** Fast aggregation: school counts grouped by schoolType. */
  async countSchoolsByType(): Promise<Array<{ schoolType: string; count: number }>> {
    if (this.mongoDb) {
      const result = await this.mongoDb.collection('schools').aggregate([
        { $group: { _id: '$schoolType', count: { $sum: 1 } } }
      ]).toArray();
      return result.map(r => ({ schoolType: r._id || 'Unknown', count: r.count }));
    }
    const counts: Record<string, number> = {};
    ((this.data?.schools || []) as any[]).forEach(s => {
      const t = s.schoolType || 'Unknown';
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts).map(([schoolType, count]) => ({ schoolType, count }));
  }

  /** Fast aggregation: student count per school (for ranking). Returns top N. */
  async getSchoolStudentCounts(): Promise<Map<string, number>> {
    if (this.mongoDb) {
      const result = await this.mongoDb.collection('students').aggregate([
        { $group: { _id: '$schoolId', count: { $sum: 1 }, avgLevel: { $avg: '$currentLevel' } } }
      ]).toArray();
      const map = new Map<string, number>();
      result.forEach(r => { map.set(r._id, r.count); });
      return map;
    }
    const counts = new Map<string, number>();
    (this.data?.students || []).forEach(s => {
      counts.set(s.schoolId, (counts.get(s.schoolId) || 0) + 1);
    });
    return counts;
  }

  /** Fast aggregation: count of evaluation reports. */
  async countReports(): Promise<number> {
    if (this.mongoDb) {
      return await this.mongoDb.collection('evaluation_reports').countDocuments({});
    }
    return (this.data?.evaluationReports || []).length;
  }

  /** Fast aggregation: count reports grouped by pass/fail (score >= 50). */
  async countReportsByOutcome(): Promise<{ pass: number; fail: number; total: number; avgScore: number }> {
    if (this.mongoDb) {
      const result = await this.mongoDb.collection('evaluation_reports').aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pass: { $sum: { $cond: [{ $gte: ['$score', 50] }, 1, 0] } },
            avgScore: { $avg: '$score' }
          }
        }
      ]).toArray();
      if (result.length === 0) return { pass: 0, fail: 0, total: 0, avgScore: 0 };
      const r = result[0];
      return { pass: r.pass, fail: r.total - r.pass, total: r.total, avgScore: Math.round(r.avgScore || 0) };
    }
    const all = this.data?.evaluationReports || [];
    const pass = all.filter(r => (r.score ?? 0) >= 50).length;
    const avg = all.length > 0 ? all.reduce((s, r) => s + (r.score ?? 0), 0) / all.length : 0;
    return { pass, fail: all.length - pass, total: all.length, avgScore: Math.round(avg) };
  }
  async getQuestions() {
    if (this.mongoDb) return await this.mongoDb.collection<Question>('questions').find({}).toArray();
    return this.data?.questions || [];
  }
  async getWorksheets() {
    if (this.mongoDb) return await this.mongoDb.collection<Worksheet>('worksheets').find({}).toArray();
    return this.data?.worksheets || [];
  }
  async getStudentCycleLocks() {
    if (this.mongoDb) return await this.mongoDb.collection<StudentCycleLock>('studentCycleLocks').find({}).toArray();
    return this.data?.studentCycleLocks || [];
  }
  async getTestHistory(teacherId?: string) {
    if (this.mongoDb) {
      const filter = teacherId ? { teacherId } : {};
      return await this.mongoDb.collection<TestHistoryEntry>('testHistory').find(filter).sort({ timestamp: -1 }).toArray();
    }
    const all = this.data?.testHistory || [];
    const filtered = teacherId ? all.filter(t => t.teacherId === teacherId) : all;
    return [...filtered].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }
  async getLevelWorksheets() {
    if (this.mongoDb) return await this.mongoDb.collection<LevelWorksheet>('levelWorksheets').find({}).toArray();
    return this.data?.levelWorksheets || [];
  }
  async getLevelHtmlTemplates() {
    if (this.mongoDb) return await this.mongoDb.collection<LevelHtmlTemplate>('levelHtmlTemplates').find({}).sort({ levelNumber: 1 }).toArray();
    return this.data?.levelHtmlTemplates || [];
  }
  async getLevelHtmlTemplate(levelNumber: number) {
    if (this.mongoDb) return await this.mongoDb.collection<LevelHtmlTemplate>('levelHtmlTemplates').findOne({ levelNumber });
    return this.data?.levelHtmlTemplates?.find(t => t.levelNumber === levelNumber) || null;
  }
  async getQuestionBankByLevel(level: number) {
    if (this.mongoDb) return await this.mongoDb.collection<QuestionBankEntry>('questionBank').find({ level }).toArray();
    return [];
  }
  async getQuestionBankRandom(level: number, count: number) {
    if (this.mongoDb) {
      return await this.mongoDb.collection<QuestionBankEntry>('questionBank').aggregate([
        { $match: { level } },
        { $sample: { size: count } }
      ]).toArray();
    }
    return [];
  }

  /**
     * Level range for a given class, per the 93-level FLN registry
     * (see backend/src/config/curriculumMap.ts).
     *
     *   Pre-school 1:  1-7
     *   Pre-school 2:  8-17
     *   Pre-school 3: 18-27
     *   Class 1:      28-42
     *   Class 2:      43-61
     *   Class 3:      62-75
     *   Class 4:      76-93
     */
  static classLevelRange(classNumber: number): { min: number; max: number } {
    if (classNumber <= 1) return { min: 28, max: 42 }; // class 1
    if (classNumber === 2) return { min: 43, max: 61 };
    if (classNumber === 3) return { min: 62, max: 75 };
    return { min: 76, max: 93 }; // class 4 (and any >4 default)
  }

  /**
   * Generate a 10-question FLN paper for the given class using real MongoDB Atlas
   * `questionBank` documents. Each question is sourced from one level in the class's band.
   *
   * Default for class 2 was 22-31 (legacy); now correctly 43-61.
   */
  async generateClassPaperFromAtlas(studentId: string | undefined, classNumber: number): Promise<Question[]> {
    const { min: minLevel, max: maxLevel } = DBStore.classLevelRange(classNumber);
    const questions: Question[] = [];
    for (let lvl = minLevel; lvl <= maxLevel && questions.length < 10; lvl++) {
      let qDoc: any = null;
      if (this.mongoDb) {
        try {
          const docs = await this.mongoDb.collection('questionBank').aggregate([
            { $match: { level: lvl } },
            { $sample: { size: 1 } }
          ]).toArray();
          if (docs && docs.length > 0) qDoc = docs[0];
        } catch (_) { }
      }
      if (qDoc) {
        questions.push({
          question_id: `Q_L${lvl}_${qDoc.questionNumber || (questions.length + 1)}`,
          question: qDoc.questionText || qDoc.question || `Level ${lvl} Problem`,
          answer: String(qDoc.answer || '').trim(),
          answer_type: 'number',
          topic: qDoc.levelTitle || `Level ${lvl}`,
          subtopic: qDoc.section || `Section ${lvl}.0`,
          difficulty: 'medium',
          source_level: lvl,
          // Authoritative concept identity for this curriculum level. Metadata
          // only — it does not affect the question, its answer or its level.
          conceptId: CURRICULUM_MAPPING[lvl]?.conceptId
        });
      } else {
        // Deterministic fallback so the generated paper still has a valid answer key
        // even when questionBank has no docs for this level.
        const a = lvl;
        const b = (lvl % 7) + 2;
        questions.push({
          question_id: `Q_L${lvl}_${questions.length + 1}`,
          question: `Level ${lvl}: Calculate ${a} + ${b} = ?`,
          answer: String(a + b),
          answer_type: 'number',
          // Mirror the qDoc branch above: derive the topic string from the
          // canonical CURRICULUM_MAPPING entry (e.g. "Flexible
          // Classification" for level 22). Without this, the offline
          // fallback produced a misleading placeholder ("Level 22 Number
          // Operations") that the Python pipeline rendered verbatim,
          // making the narrative disagree with the paper's conceptId.
          topic: CURRICULUM_MAPPING[lvl]?.levelTitle || `Level ${lvl}`,
          subtopic: 'Addition',
          difficulty: 'medium',
          source_level: lvl,
          // Same authoritative concept identity on the offline fallback item.
          conceptId: CURRICULUM_MAPPING[lvl]?.conceptId
        });
      }
    }

    if (studentId && questions.length > 0) {
      await this.assignDiagnosticPaperToStudent(studentId, questions);
    }
    return questions;
  }

  /**
   * Back-compat: legacy callers (paperGenerator.ts line ~147) pass classNumber=2.
   * Routes through the new class-aware generator.
   */
  async generateClass2PaperFromAtlas(studentId?: string): Promise<Question[]> {
    return await this.generateClassPaperFromAtlas(studentId, 2);
  }
  async assignDiagnosticPaperToStudent(studentId: string, questions: Question[]) {
    if (this.mongoDb) {
      try {
        await this.mongoDb.collection('students').updateOne(
          { id: studentId },
          { $set: { assignedDiagnosticQuestions: questions } }
        );
      } catch (e) {
        console.warn('Failed to persist assigned paper to MongoDB student:', e);
      }
    }
    if (this.data && this.data.students) {
      const st = this.data.students.find(s => s.id === studentId);
      if (st) st.assignedDiagnosticQuestions = questions;
    }
  }

  async getStudentAssignedQuestions(studentId: string, classNumber: number = 2): Promise<Question[]> {
      let student: Student | null = null;
      if (this.mongoDb) {
        student = await this.mongoDb.collection<Student>('students').findOne({ id: studentId });
      }
      if (!student && this.data && this.data.students) {
        student = this.data.students.find(s => s.id === studentId) || null;
      }
      // Only reuse a cached paper that still carries the curriculum identity
      // (conceptId on every question). A paper cached before questions were
      // tagged, or written by a code path that produced conceptId-less
      // questions (e.g. bulk diagnostic masterJson items), cannot be matched
      // back to the 93-level framework, so the prerequisite resolver would
      // silently emit nothing. Treating such a paper as absent makes
      // generateClassPaperFromAtlas regenerate it on demand.
      const cached = student?.assignedDiagnosticQuestions;
      if (cached && cached.length > 0 && cached.every(q => q.conceptId)) {
        return dedupeQuestionsById(cached);
      }
      // Fall back to a class-correct generator (legacy = always L22-L31, wrong for all classes).
      return await this.generateClassPaperFromAtlas(studentId, classNumber);
    }

  async getAnswerSubmissions() {
    if (this.mongoDb) return await this.mongoDb.collection<AnswerSubmission>('answerSubmissions').find({}).toArray();
    return this.data?.answerSubmissions || [];
  }
  async getEvaluationReports(opts?: { studentIds?: string[] }) {
    if (this.mongoDb) {
      const filter: any = {};
      if (opts?.studentIds) filter.studentId = { $in: opts.studentIds };
      return await this.mongoDb.collection<EvaluationReport>('evaluationReports').find(filter).toArray();
    }
    let result = this.data?.evaluationReports || [];
    if (opts?.studentIds) result = result.filter(r => opts.studentIds!.includes(r.studentId));
    return result;
  }

  async getStudentsByIds(ids: string[]): Promise<Student[]> {
    if (this.mongoDb) {
      return await this.mongoDb.collection<Student>('students').find({ id: { $in: ids } }).toArray();
    }
    return (this.data?.students || []).filter(s => ids.includes(s.id));
  }

  async getAnalyticsForScope(schoolFilter?: any) {
    if (this.mongoDb) {
      let schoolIds: string[] | null = null;
      if (schoolFilter && Object.keys(schoolFilter).length > 0) {
        const schools = await this.mongoDb.collection('schools')
          .find(schoolFilter, { projection: { id: 1 } })
          .toArray();
        schoolIds = schools.map(s => s.id);
      }

      const studentFilter: any = {};
      if (schoolIds) {
        studentFilter.schoolId = { $in: schoolIds };
      }

      const statsPromise = this.mongoDb.collection('students').aggregate([
        { $match: studentFilter },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            sumLevel: { $sum: '$currentLevel' },
            certified: {
              $sum: {
                $cond: [{ $gte: ['$currentLevel', 5] }, 1, 0]
              }
            }
          }
        }
      ]).toArray();

      const distPromise = this.mongoDb.collection('students').aggregate([
        { $match: studentFilter },
        {
          $group: {
            _id: '$currentLevel',
            count: { $sum: 1 }
          }
        }
      ]).toArray();

      const [statsResult, distResult] = await Promise.all([statsPromise, distPromise]);

      const stats = statsResult[0] || { count: 0, sumLevel: 0, certified: 0 };
      const count = stats.count;
      const sumLevel = stats.sumLevel;
      const certified = stats.certified;

      const avgLevel = count > 0 ? Math.round((sumLevel / count) * 10) / 10 : 0;
      const certificationRate = count > 0 ? Math.round((certified / count) * 100) : 0;

      const topicMastery = {
        "Number Sense": Math.min(100, Math.round(55 + avgLevel * 8)),
        "Number Operations": Math.min(100, Math.round(45 + avgLevel * 9)),
        "Shapes": Math.min(100, Math.round(58 + avgLevel * 7)),
        "Fractions": Math.min(100, Math.round(20 + avgLevel * 11)),
        "Patterns": Math.min(100, Math.round(38 + avgLevel * 10)),
        "Measurement": Math.min(100, Math.round(32 + avgLevel * 10))
      };

      const levelDistribution: Record<string, number> = {};
      for (let i = 1; i <= 15; i++) {
        levelDistribution[`Level ${i}`] = 0;
      }
      levelDistribution["Level 16+"] = 0;

      distResult.forEach(r => {
        const lvl = r._id;
        if (lvl >= 16) {
          levelDistribution["Level 16+"] += r.count;
        } else if (lvl >= 1 && lvl <= 15) {
          levelDistribution[`Level ${lvl}`] = r.count;
        }
      });

      return {
        avgLevel,
        certificationRate,
        topicMastery,
        levelDistribution,
        count
      };
    }

    const schools = this.data?.schools || [];
    let schoolIds: string[] | null = null;
    if (schoolFilter && Object.keys(schoolFilter).length > 0) {
      schoolIds = schools.filter(s => {
        return Object.entries(schoolFilter).every(([k, v]) => (s as any)[k] === v);
      }).map(s => s.id);
    }

    let filteredStudents = this.data?.students || [];
    if (schoolIds) {
      filteredStudents = filteredStudents.filter(s => schoolIds!.includes(s.schoolId));
    }

    const count = filteredStudents.length;
    if (count === 0) {
      return {
        avgLevel: 0,
        certificationRate: 0,
        topicMastery: { "Number Sense": 0, "Number Operations": 0, "Shapes": 0, "Fractions": 0, "Patterns": 0, "Measurement": 0 },
        levelDistribution: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`Level ${i + 1}`, 0]).concat([["Level 16+", 0]])),
        count: 0
      };
    }

    const sumLevel = filteredStudents.reduce((acc, s) => acc + s.currentLevel, 0);
    const avgLevel = Math.round((sumLevel / count) * 10) / 10;
    const certified = filteredStudents.filter(s => s.currentLevel >= 5).length;
    const certificationRate = Math.round((certified / count) * 100);

    const topicMastery = {
      "Number Sense": Math.min(100, Math.round(55 + avgLevel * 8)),
      "Number Operations": Math.min(100, Math.round(45 + avgLevel * 9)),
      "Shapes": Math.min(100, Math.round(58 + avgLevel * 7)),
      "Fractions": Math.min(100, Math.round(20 + avgLevel * 11)),
      "Patterns": Math.min(100, Math.round(38 + avgLevel * 10)),
      "Measurement": Math.min(100, Math.round(32 + avgLevel * 10))
    };

    const levelDistribution: Record<string, number> = {};
    for (let i = 1; i <= 15; i++) {
      levelDistribution[`Level ${i}`] = filteredStudents.filter(s => s.currentLevel === i).length;
    }
    levelDistribution["Level 16+"] = filteredStudents.filter(s => s.currentLevel >= 16).length;

    return {
      avgLevel,
      certificationRate,
      topicMastery,
      levelDistribution,
      count
    };
  }

  async getTickets() {
    if (this.mongoDb) return await this.mongoDb.collection<Ticket>('tickets').find({}).toArray();
    return this.data?.tickets || [];
  }
  async getLogbook() {
    if (this.mongoDb) return await this.mongoDb.collection<LogEntry>('logbook').find({}).toArray();
    return this.data?.logbook || [];
  }
  async getAnnouncements() {
    if (this.mongoDb) return await this.mongoDb.collection<Announcement>('announcements').find({}).toArray();
    return this.data?.announcements || [];
  }

  /** Archetypes for one class, or every class when no class is named. */
  async getMisconceptionClusters(classGroup?: string) {
    const filter = classGroup ? { classGroup } : {};
    if (this.mongoDb) {
      return await this.mongoDb
        .collection<MisconceptionCluster>('misconception_clusters')
        .find(filter)
        .toArray();
    }
    const all = this.data?.misconceptionClusters || [];
    return classGroup ? all.filter(c => c.classGroup === classGroup) : all;
  }

  async createMisconceptionCluster(cluster: MisconceptionCluster) {
    if (this.mongoDb) await this.mongoDb.collection('misconception_clusters').insertOne(cluster);
    if (this.data) {
      if (!this.data.misconceptionClusters) this.data.misconceptionClusters = [];
      this.data.misconceptionClusters.push(cluster);
    }
    return cluster;
  }

  async updateMisconceptionCluster(cluster: MisconceptionCluster) {
    if (this.mongoDb) await this.mongoDb.collection('misconception_clusters').replaceOne({ id: cluster.id }, cluster, { upsert: true });
    if (this.data) {
      if (!this.data.misconceptionClusters) this.data.misconceptionClusters = [];
      const idx = this.data.misconceptionClusters.findIndex(x => x.id === cluster.id);
      if (idx !== -1) this.data.misconceptionClusters[idx] = cluster;
      else this.data.misconceptionClusters.push(cluster);
    }
    return cluster;
  }

  // --- Write / Update Helpers ---

  async addUser(user: User) {
    await this.mongoDb!.collection('users').insertOne(user);
    if (this.data) this.data.users.push(user);
    return user;
  }

  async updateUserPasswordHash(userId: string, passwordHash: string) {
    await this.mongoDb!.collection('users').updateOne({ id: userId }, { $set: { passwordHash } });
  }

  async getExistingAadhars(aadhars: string[]): Promise<Set<string>> {
    if (this.mongoDb) {
      const docs = await this.mongoDb.collection('students')
        .find({ aadharMasked: { $in: aadhars } }, { projection: { aadharMasked: 1 } })
        .toArray();
      return new Set(docs.map(d => d.aadharMasked));
    }
    const set = new Set<string>();
    (this.data?.students || []).forEach(s => {
      if (aadhars.includes(s.aadharMasked)) set.add(s.aadharMasked);
    });
    return set;
  }

  /**
   * School-scoped variant of `getExistingAadhars`. Used by the student
   * registration dup-check so a volunteer's submission is rejected only
   * when the same Aadhaar already exists at the *same* school — not when
   * it happens to share a 4-digit suffix with a student in some other
   * school (which is the common case against the 86,400-student seed,
   * since 1,440 schools × 60 students covers the 10,000 4-digit suffixes
   * ~8.6×). The cross-school "is this the same person?" question is
   * delegated to the vault `getExistingAadhaarIdentityIds` check, which
   * is deterministic on the input digits and only fires for students
   * that were actually tokenized through the vault (seed students carry
   * `aadhaarIdentityId: null`, so the check is a no-op for them).
   */
  async getExistingAadharsInSchool(schoolId: string, aadhars: string[]): Promise<Set<string>> {
    if (this.mongoDb) {
      const docs = await this.mongoDb.collection('students')
        .find({ schoolId, aadharMasked: { $in: aadhars } }, { projection: { aadharMasked: 1 } })
        .toArray();
      return new Set(docs.map(d => d.aadharMasked));
    }
    const set = new Set<string>();
    (this.data?.students || []).forEach(s => {
      if (s.schoolId === schoolId && aadhars.includes(s.aadharMasked)) set.add(s.aadharMasked);
    });
    return set;
  }

  async getExistingAadhaarIdentityIds(identityIds: string[]): Promise<Set<string>> {
    const cleanIds = identityIds.filter(Boolean);
    if (cleanIds.length === 0) return new Set<string>();
    if (this.mongoDb) {
      const docs = await this.mongoDb.collection('students')
        .find({ aadhaarIdentityId: { $in: cleanIds } }, { projection: { aadhaarIdentityId: 1 } })
        .toArray();
      return new Set(docs.map(d => d.aadhaarIdentityId).filter(Boolean));
    }
    const set = new Set<string>();
    (this.data?.students || []).forEach(s => {
      if (s.aadhaarIdentityId && cleanIds.includes(s.aadhaarIdentityId)) set.add(s.aadhaarIdentityId);
    });
    return set;
  }

  async addStudent(student: Student) {
    if (this.mongoDb) {
      await this.mongoDb.collection('students').insertOne(student);
    }
    if (this.data) {
      this.data.students.push(student);
      if (!this.mongoDb) await this.save();
    }
    return student;
  }

  // Only the original seed data ever populated the `classes` collection —
  // registering a student (single or bulk-import) creates a Student record
  // tagged with a classGroup/section, but nothing was ever creating the
  // matching ClassGroup document those classGroup/section strings imply.
  // Several features key off ClassGroup existing for a teacher/school (the
  // Teacher Dashboard's class-tab bar, and — the bug this was found from —
  // bulk diagnostic generation's authorization check), so a teacher whose
  // whole roster was registered live (not seeded) could end up "not
  // authorized" for a class she demonstrably has real students in.
  // Called after every successful student creation; idempotent — does
  // nothing if a ClassGroup already exists for this school+class+section.
  async ensureClassExists(schoolId: string, className: string, section: string, teacherId: string) {
    const existing = await this.getClasses();
    if (existing.some(c => c.schoolId === schoolId && c.className === className && c.section === section)) {
      return;
    }
    const newClass: ClassGroup = {
      id: 'c_' + schoolId + '_' + className.replace(/\s+/g, '') + '_' + section,
      schoolId,
      className,
      section,
      teacherId,
    };
    if (this.mongoDb) {
      // Race-safe: two near-simultaneous registrations into a brand-new
      // class both pass the `existing.some(...)` check above before either
      // has inserted. upsert on the same deterministic `id` means the
      // second one updates rather than duplicate-inserts.
      await this.mongoDb.collection('classes').updateOne(
        { id: newClass.id },
        { $setOnInsert: newClass },
        { upsert: true }
      );
    }
    if (this.data) {
      if (!this.data.classes.some(c => c.id === newClass.id)) {
        this.data.classes.push(newClass);
      }
      if (!this.mongoDb) await this.save();
    }
  }

  async updateStudent(studentId: string, updates: Partial<Student>) {
    // Defense-in-depth (Phase 2 hardening): routes whitelist their fields
    // today, but this mutator accepts any Partial<Student>. Aadhaar identity
    // fields are owned exclusively by the tokenized creation path; refuse
    // them here so no future caller can overwrite vault references or
    // reintroduce plaintext through $set. addStudent() is intentionally NOT
    // restricted — it needs these fields at creation time.
    const blocked = Object.keys(updates).filter(k => AADHAAR_PROTECTED_UPDATE_FIELDS.includes(k));
    if (blocked.length > 0) {
      throw new Error(
        `updateStudent: refusing to write Aadhaar-sensitive field(s): ${blocked.join(', ')}. `
        + 'These are owned by the Aadhaar Vault tokenization path (createStudentFromData).',
      );
    }
    // Phase 2 hardening fix: support the local file-fallback store the same
    // way addStudent() does. The previous unconditional `this.mongoDb!`
    // crashed every level/profile PATCH when MongoDB was absent.
    if (!this.mongoDb) {
      const list = this.data?.students;
      if (!list) return undefined;
      const idx = list.findIndex(x => x.id === studentId);
      if (idx === -1) return undefined;
      list[idx] = { ...list[idx], ...updates };
      await this.save();
      return list[idx];
    }
    await this.mongoDb.collection('students').updateOne({ id: studentId }, { $set: updates });
    const s = await this.mongoDb.collection<Student>('students').findOne({ id: studentId });
    if (s && this.data) {
      const idx = this.data.students.findIndex(x => x.id === studentId);
      if (idx !== -1) this.data.students[idx] = s;
    }
    return s || undefined;
  }

  async addWorksheet(ws: Worksheet) {
    await this.mongoDb!.collection('worksheets').insertOne(ws);
    if (this.data) this.data.worksheets.push(ws);
    return ws;
  }

  async addStudentCycleLock(lock: StudentCycleLock) {
    if (this.mongoDb) await this.mongoDb.collection('studentCycleLocks').insertOne(lock as any);
    if (this.data) this.data.studentCycleLocks.push(lock);
    return lock;
  }

  async addTestHistoryEntry(entry: TestHistoryEntry) {
    if (this.mongoDb) {
      await this.mongoDb.collection('testHistory').insertOne(entry);
    }
    if (this.data) this.data.testHistory.push(entry);
    return entry;
  }

  async updateWorksheet(worksheetId: string, updates: Partial<Worksheet>) {
    await this.mongoDb!.collection('worksheets').updateOne({ id: worksheetId }, { $set: updates });
    const ws = await this.mongoDb!.collection<Worksheet>('worksheets').findOne({ id: worksheetId });
    if (ws && this.data) {
      const idx = this.data.worksheets.findIndex(x => x.id === worksheetId);
      if (idx !== -1) this.data.worksheets[idx] = ws;
    }
    return ws || undefined;
  }

  async addLevelWorksheet(ws: LevelWorksheet) {
    await this.mongoDb!.collection('levelWorksheets').insertOne(ws);
    if (this.data) this.data.levelWorksheets.push(ws);
    return ws;
  }

  async addAnswerSubmission(sub: AnswerSubmission) {
    await this.mongoDb!.collection('answerSubmissions').insertOne(sub);
    if (this.data) this.data.answerSubmissions.push(sub);
    return sub;
  }

  async addEvaluationReport(rep: EvaluationReport) {
    await this.mongoDb!.collection('evaluationReports').insertOne(rep);
    if (this.data) this.data.evaluationReports.push(rep);
    return rep;
  }

  async getEvaluationReportById(id: string) {
    if (this.mongoDb) return await this.mongoDb.collection<EvaluationReport>('evaluationReports').findOne({ id });
    return (this.data?.evaluationReports || []).find(r => r.id === id);
  }

  async updateEvaluationReport(id: string, updates: Partial<EvaluationReport>) {
    if (this.mongoDb) {
      await this.mongoDb.collection('evaluationReports').updateOne({ id }, { $set: updates });
      return await this.mongoDb.collection<EvaluationReport>('evaluationReports').findOne({ id });
    }
    if (this.data) {
      const idx = this.data.evaluationReports.findIndex(r => r.id === id);
      if (idx !== -1) {
        this.data.evaluationReports[idx] = { ...this.data.evaluationReports[idx], ...updates };
        return this.data.evaluationReports[idx];
      }
    }
    return undefined;
  }

  async addTicket(t: Ticket) {
    await this.mongoDb!.collection('tickets').insertOne(t);
    if (this.data) this.data.tickets.push(t);
    return t;
  }

  async updateTicket(id: string, updates: Partial<Ticket>) {
    await this.mongoDb!.collection('tickets').updateOne({ id }, { $set: updates });
    const t = await this.mongoDb!.collection<Ticket>('tickets').findOne({ id });
    if (t && this.data) {
      const idx = this.data.tickets.findIndex(x => x.id === id);
      if (idx !== -1) this.data.tickets[idx] = t;
    }
    return t || undefined;
  }

  async updateUser(userId: string, updates: Partial<User>) {
    await this.mongoDb!.collection('users').updateOne({ id: userId }, { $set: updates });
    const u = await this.mongoDb!.collection<User>('users').findOne({ id: userId });
    if (u && this.data) {
      const idx = this.data.users.findIndex(x => x.id === userId);
      if (idx !== -1) this.data.users[idx] = u;
    }
    return u || undefined;
  }

  async updateSchool(schoolId: string, updates: Partial<School>) {
    await this.mongoDb!.collection('schools').updateOne({ id: schoolId }, { $set: updates });
    const s = await this.mongoDb!.collection<School>('schools').findOne({ id: schoolId });
    if (s && this.data) {
      const idx = this.data.schools.findIndex(x => x.id === schoolId);
      if (idx !== -1) this.data.schools[idx] = s;
    }
    return s || undefined;
  }

  async addSchool(school: School) {
    await this.mongoDb!.collection('schools').insertOne(school);
    if (this.data) this.data.schools.push(school);
    return school;
  }

  async addLog(log: LogEntry) {
    // Phase 2 hardening fix: guard the Mongo write like addStudent() does.
    // Previously `this.mongoDb!` crashed here whenever MongoDB was absent
    // (local file fallback), which threw INSIDE the student-registration
    // handlers right after addStudent() had already persisted — the student
    // was saved but the HTTP response was lost (express 4 cannot catch
    // async handler throws), hanging every file-mode registration.
    if (this.mongoDb) {
      await this.mongoDb.collection('logbook').insertOne(log);
    }
    if (this.data) {
      this.data.logbook.unshift(log);
      if (!this.mongoDb) await this.save();
    }
    return log;
  }

  /**
   * Transactional sibling of {@link addLog}. Writes the entry to
   * the `logbook` collection **inside the supplied MongoDB
   * session**, so the audit row commits or rolls back atomically
   * with the caller's other writes (e.g. the `vault_identities`
   * and `vault_tokens` inserts in the tokenize command).
   *
   * **Why this exists.** Issue #406's review asked that the
   * vault's audit sink be the existing `logbook` collection, not
   * a separate `vault_audit_log` table. The naive refactor
   * ("call `addLog()` after the transaction commits") breaks the
   * identity+token+audit atomicity invariant — a tokenize that
   * fails after the identity insert would still leave an audit
   * row, and vice versa. This method carries the session so the
   * Mongo driver ties the logbook insert to the same
   * `withTransaction` block as the rest of the unit-of-work.
   *
   * **File-fallback path.** The `data.logbook` array is also
   * updated best-effort. There is no real transaction in the
   * file mode, so the audit row is NOT atomic with the rest of
   * the vault write — a crash between the two would leave a
   * token row without a paired audit row. This matches the
   * wider pre-existing posture (the file mode has no
   * cross-collection atomicity at all). Operators running the
   * vault in production are expected to use a real Mongo
   * replica set; the JSON file is a dev convenience, not a
   * secure store.
   */
  async addLogInSession(session: ClientSession, log: LogEntry): Promise<LogEntry> {
    if (this.mongoDb) {
      await this.mongoDb.collection('logbook').insertOne(log, { session });
    }
    if (this.data) {
      this.data.logbook.unshift(log);
      if (!this.mongoDb) await this.save();
    }
    return log;
  }

  /**
   * Read-side counterpart of {@link addLog}. Returns logbook rows
   * whose `details` field starts with the given prefix, sorted
   * newest-first, capped at `opts.limit` (default 100, max 1000).
   *
   * Used by the vault's read-audit-history command to filter
   * the `logbook` collection down to vault audit rows (the
   * `details` prefix is `vault:`, set by the mapping helper at
   * `backend/src/modules/vault/audit/logbook-entry.ts`).
   *
   * The query is a prefix match, not an exact match: the
   * `details` string is `vault:<action> identity=<id> ...`, so
   * the same `vault:` prefix covers every vault row regardless
   * of action. Callers that need to filter further (e.g. by
   * identityId) do so in application code, parsing the `details`
   * field — see `parseVaultLogbookEntry` in the audit-log
   * helper.
   *
   * Regex special characters in the prefix are escaped so a
   * caller passing arbitrary text cannot inject a regex
   * pattern. The file-fallback path does a plain
   * `String.prototype.startsWith` check.
   */
  async listLogsByDetailsPrefix(
    prefix: string,
    opts: { limit?: number } = {},
  ): Promise<LogEntry[]> {
    const limit = Math.max(1, Math.min(opts.limit ?? 100, 1000));
    if (this.mongoDb) {
      const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return await this.mongoDb
        .collection<LogEntry>('logbook')
        .find({ details: { $regex: '^' + escaped } })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
    }
    const rows = (this.data?.logbook ?? []).filter((l) =>
      typeof l.details === 'string' && l.details.startsWith(prefix),
    );
    rows.sort((a, b) =>
      a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0,
    );
    return rows.slice(0, limit);
  }

  async addAnnouncement(ann: Announcement) {
    await this.mongoDb!.collection('announcements').insertOne(ann);
    if (this.data) this.data.announcements.unshift(ann);
    return ann;
  }

  // --- Intervention & Best Practice Methods ---

  async getInterventions() {
    return await this.mongoDb!.collection<Intervention>('interventions').find({}).toArray();
  }

  async addIntervention(intervention: Intervention) {
    await this.mongoDb!.collection('interventions').insertOne(intervention);
    if (this.data) this.data.interventions.push(intervention);
    return intervention;
  }

  async updateIntervention(id: string, updates: Partial<Intervention>) {
    await this.mongoDb!.collection('interventions').updateOne({ id }, { $set: updates });
    const i = await this.mongoDb!.collection<Intervention>('interventions').findOne({ id });
    if (i && this.data) {
      const idx = this.data.interventions.findIndex(x => x.id === id);
      if (idx !== -1) this.data.interventions[idx] = i;
    }
    return i || undefined;
  }

  async getBestPractices() {
    return await this.mongoDb!.collection<BestPractice>('bestPractices').find({}).toArray();
  }

  async addBestPractice(bp: BestPractice) {
    await this.mongoDb!.collection('bestPractices').insertOne(bp);
    if (this.data) this.data.bestPractices.push(bp);
    return bp;
  }

  async updateBestPractice(id: string, updates: Partial<BestPractice>) {
    await this.mongoDb!.collection('bestPractices').updateOne({ id }, { $set: updates });
    const bp = await this.mongoDb!.collection<BestPractice>('bestPractices').findOne({ id });
    if (bp && this.data) {
      const idx = this.data.bestPractices.findIndex(x => x.id === id);
      if (idx !== -1) this.data.bestPractices[idx] = bp;
    }
    return bp || undefined;
  }

  // --- Question Logic Methods ---

  /** Live logics only unless `includeDeleted`, since soft-deleted rows exist purely for audit. */
  async getQuestionLogics(includeDeleted = false) {
    const filter = includeDeleted ? {} : { deletedAt: null };
    return await this.mongoDb!.collection<QuestionLogic>('questionLogics')
      .find(filter).sort({ createdAt: -1 }).toArray();
  }

  async getQuestionLogicById(id: string) {
    return (await this.mongoDb!.collection<QuestionLogic>('questionLogics').findOne({ id })) || undefined;
  }

  async addQuestionLogic(logic: QuestionLogic) {
    await this.mongoDb!.collection('questionLogics').insertOne(logic);
    if (this.data) this.data.questionLogics.push(logic);
    return logic;
  }

  async updateQuestionLogic(id: string, updates: Partial<QuestionLogic>) {
    await this.mongoDb!.collection('questionLogics').updateOne({ id }, { $set: updates });
    const l = await this.mongoDb!.collection<QuestionLogic>('questionLogics').findOne({ id });
    if (l && this.data) {
      const idx = this.data.questionLogics.findIndex(x => x.id === id);
      if (idx !== -1) this.data.questionLogics[idx] = l;
    }
    return l || undefined;
  }

  /**
   * Counts for the header cards. `levelsWithLogic` is a distinct count over live
   * rows — authoring five logics for one level still covers exactly one level.
   */
  async getQuestionLogicStats(totalLevels: number) {
    const live = await this.mongoDb!.collection<QuestionLogic>('questionLogics')
      .find({ deletedAt: null }).toArray();
    return {
      totalLogics: live.length,
      totalLevels,
      levelsWithLogic: new Set(live.map(l => l.level)).size,
    };
  }

  // --- Question Template Methods ----------------------------------------
  //
  // Templates are addressed by `conceptId`. Nothing here takes a level number:
  // levels are insertable and re-orderable, so a stored level number would be
  // a reference that quietly stops meaning what it meant when it was written.

  async getQuestionTemplates(includeDeleted = false) {
    const filter = includeDeleted ? {} : { deletedAt: null };
    return await this.mongoDb!.collection<QuestionTemplate>('questionTemplates')
      .find(filter).sort({ createdAt: -1 }).toArray();
  }

  async getQuestionTemplateById(id: string) {
    return (await this.mongoDb!.collection<QuestionTemplate>('questionTemplates').findOne({ id })) || undefined;
  }

  /** Live templates sharing a variant fingerprint. Drives the duplicate warning. */
  async getQuestionTemplatesByVariantKey(variantKey: string) {
    return await this.mongoDb!.collection<QuestionTemplate>('questionTemplates')
      .find({ variantKey, deletedAt: null }).toArray();
  }

  async addQuestionTemplate(template: QuestionTemplate) {
    await this.mongoDb!.collection('questionTemplates').insertOne(template);
    if (this.data) this.data.questionTemplates.push(template);
    return template;
  }

  /**
   * Insert a validated batch in one round trip.
   *
   * Callers validate every row before calling: a CSV import that writes half a
   * file and then rejects the rest leaves the author reconciling two states by
   * hand, which is worse than importing nothing.
   */
  async addQuestionTemplates(templates: QuestionTemplate[]) {
    if (templates.length === 0) return [];
    await this.mongoDb!.collection('questionTemplates').insertMany(templates as any[]);
    if (this.data) this.data.questionTemplates.push(...templates);
    return templates;
  }

  async updateQuestionTemplate(id: string, updates: Partial<QuestionTemplate>) {
    await this.mongoDb!.collection('questionTemplates').updateOne({ id }, { $set: updates });
    const t = await this.mongoDb!.collection<QuestionTemplate>('questionTemplates').findOne({ id });
    if (t && this.data) {
      const idx = this.data.questionTemplates.findIndex(x => x.id === id);
      if (idx !== -1) this.data.questionTemplates[idx] = t;
    }
    return t || undefined;
  }

  // --- Question Option Methods -------------------------------------------
  //
  // The catalogue of selectable values. Reads are hot (every form render) and
  // the set is tiny, so these deliberately do no caching: correctness after a
  // Superadmin adds a value matters more than saving a small query.

  async getQuestionOptions(includeInactive = false) {
    const filter = includeInactive ? {} : { active: true };
    return await this.mongoDb!.collection<QuestionOption>('questionOptions')
      .find(filter).sort({ type: 1, key: 1 }).toArray();
  }

  async getQuestionOptionById(id: string) {
    return (await this.mongoDb!.collection<QuestionOption>('questionOptions').findOne({ id })) || undefined;
  }

  /** Active row with this (type, key), if any. Used to reject duplicate keys. */
  async getQuestionOptionByKey(type: QuestionOption['type'], key: string) {
    return (await this.mongoDb!.collection<QuestionOption>('questionOptions')
      .findOne({ type, key, active: true })) || undefined;
  }

  async addQuestionOption(option: QuestionOption) {
    await this.mongoDb!.collection('questionOptions').insertOne(option);
    if (this.data) this.data.questionOptions.push(option);
    return option;
  }

  async updateQuestionOption(id: string, updates: Partial<QuestionOption>) {
    await this.mongoDb!.collection('questionOptions').updateOne({ id }, { $set: updates });
    const o = await this.mongoDb!.collection<QuestionOption>('questionOptions').findOne({ id });
    if (o && this.data) {
      const idx = this.data.questionOptions.findIndex(x => x.id === id);
      if (idx !== -1) this.data.questionOptions[idx] = o;
    }
    return o || undefined;
  }

  async getQuestionTemplateStats(totalLevels: number) {
    const live = await this.mongoDb!.collection<QuestionTemplate>('questionTemplates')
      .find({ deletedAt: null }).toArray();
    return {
      totalTemplates: live.length,
      totalLevels,
      levelsWithTemplate: new Set(live.map(t => t.conceptId)).size,
      distinctVariants: new Set(live.map(t => t.variantKey)).size,
    };
  }

  // --- Curriculum Level Methods ---
  //
  // The single accessor path for curriculum data. Anything that needs to reason
  // about levels goes through here rather than hand-authoring a lookup table —
  // a feature that cannot get what it needs from these is a signal the schema
  // is missing a field, not licence to start a seventh copy of the taxonomy.

  // --- Question bank review ---------------------------------------------
  //
  // The bank holds the concrete questions that already exist (levels 22-59 of
  // the retired numbering). Mapping each one to a 93-space level is what lets
  // the 59 space be retired WITHOUT a level-to-level crosswalk: content is
  // addressed by the question's own tag rather than by the level it came from.

  async getQuestionBank(opts: {
    level?: number;
    sectionType?: string;
    status?: 'untagged' | 'mapped' | 'retired';
    mappedLevel?: number;
    limit?: number;
    skip?: number;
  } = {}) {
    const filter: any = {};
    if (opts.level !== undefined) filter.level = opts.level;
    if (opts.sectionType) filter.sectionType = opts.sectionType;
    if (opts.status) filter.reviewStatus = opts.status;
    if (opts.mappedLevel !== undefined) filter.mappedLevel = opts.mappedLevel;
    const coll = this.mongoDb!.collection<QuestionBankEntry>('questionBank');
    const [items, total] = await Promise.all([
      coll.find(filter).sort({ level: 1, section: 1, questionNumber: 1 })
        .skip(opts.skip || 0).limit(opts.limit || 50).toArray(),
      coll.countDocuments(filter),
    ]);
    return { items, total };
  }

  async getQuestionBankEntry(questionId: string) {
    return (await this.mongoDb!.collection<QuestionBankEntry>('questionBank')
      .findOne({ questionId })) || undefined;
  }

  /** Apply a review decision to one question. Returns the updated row. */
  async reviewQuestion(questionId: string, patch: {
    mappedLevel?: number | null;
    conceptId?: string;
    reviewStatus: 'untagged' | 'mapped' | 'retired';
    reviewedBy: string;
    reviewNote?: string;
  }) {
    const coll = this.mongoDb!.collection<QuestionBankEntry>('questionBank');
    await coll.updateOne({ questionId }, {
      $set: { ...patch, reviewedAt: new Date().toISOString() } as any,
    });
    return await this.getQuestionBankEntry(questionId);
  }

  /** Apply one decision to every question in a (level, section). */
  async reviewQuestionsBulk(filter: { level: number; section?: string; sectionType?: string }, patch: {
    mappedLevel?: number | null;
    conceptId?: string;
    reviewStatus: 'untagged' | 'mapped' | 'retired';
    reviewedBy: string;
  }) {
    const q: any = { level: filter.level };
    if (filter.section) q.section = filter.section;
    if (filter.sectionType) q.sectionType = filter.sectionType;
    const res = await this.mongoDb!.collection<QuestionBankEntry>('questionBank').updateMany(q, {
      $set: { ...patch, reviewedAt: new Date().toISOString() } as any,
    });
    return { matched: res.matchedCount, modified: res.modifiedCount };
  }

  /**
   * Review progress, plus the shape of the work remaining.
   *
   * `legacyLevelsWithoutQuestions` is the honest other half: the bank only
   * covers levels 22-59, so those legacy levels have nothing to tag and must be
   * mapped level-to-level instead.
   */
  async getQuestionBankProgress() {
    const coll = this.mongoDb!.collection<QuestionBankEntry>('questionBank');
    const [total, mapped, retired, untagged, levels, targets] = await Promise.all([
      coll.countDocuments({}),
      coll.countDocuments({ reviewStatus: 'mapped' }),
      coll.countDocuments({ reviewStatus: 'retired' }),
      coll.countDocuments({ reviewStatus: 'untagged' }),
      coll.distinct('level'),
      coll.distinct('mappedLevel', { reviewStatus: 'mapped' }),
    ]);
    const byLevel = await coll.aggregate([
      { $group: {
          _id: '$level',
          total: { $sum: 1 },
          mapped: { $sum: { $cond: [{ $eq: ['$reviewStatus', 'mapped'] }, 1, 0] } },
          retired: { $sum: { $cond: [{ $eq: ['$reviewStatus', 'retired'] }, 1, 0] } },
      } },
      { $sort: { _id: 1 } },
    ]).toArray();
    return {
      total, mapped, retired, untagged,
      legacyLevelsInBank: levels.sort((a: number, b: number) => a - b),
      targetLevelsCovered: (targets as (number | null)[]).filter((n): n is number => typeof n === 'number').sort((a, b) => a - b),
      byLevel: byLevel.map((r: any) => ({ level: r._id, total: r.total, mapped: r.mapped, retired: r.retired })),
    };
  }

  async getCurriculumLevels() {
    return await this.mongoDb!.collection<CurriculumLevel>('curriculumLevels')
      .find({}).sort({ levelNumber: 1 }).toArray();
  }

  async getCurriculumLevel(levelNumber: number) {
    return (await this.mongoDb!.collection<CurriculumLevel>('curriculumLevels')
      .findOne({ levelNumber })) || undefined;
  }

  /** Look a level up by its permanent identity rather than by its position. */
  async getCurriculumLevelByConceptId(conceptId: string) {
    return (await this.mongoDb!.collection<CurriculumLevel>('curriculumLevels')
      .findOne({ conceptId })) || undefined;
  }

  /**
   * Resolve a retired 1..59 worksheet-engine id to its 93-space level.
   *
   * Exists only for the migration window: call sites that still hold a 59-space
   * number use this to translate rather than carrying their own mapping. When
   * the last such call site is gone, this method and `legacyLevel59` go with it.
   */
  async getCurriculumLevelByLegacy59(legacyLevel59: number) {
    return (await this.mongoDb!.collection<CurriculumLevel>('curriculumLevels')
      .findOne({ legacyLevel59 })) || undefined;
  }

  /**
   * Point a 93-space level at a retired 1-59 level, or clear the pointer.
   *
   * Passing `null` as the target clears whichever level currently claims
   * `legacyLevel59`, so a mis-mapping can be undone without knowing where it
   * landed.
   */
  async setCurriculumLegacyMapping(levelNumber: number | null, legacyLevel59: number) {
    const coll = this.mongoDb!.collection<CurriculumLevel>('curriculumLevels');
    // Only one 93-space level may claim a given legacy id.
    await coll.updateMany({ legacyLevel59 }, { $set: { legacyLevel59: null } });
    if (levelNumber !== null) {
      await coll.updateOne({ levelNumber }, {
        $set: { legacyLevel59, updatedAt: new Date().toISOString() },
      });
    }
  }

  /** Coverage summary — how much of the 93 can actually be rendered today. */
  async getCurriculumCoverage() {
    const levels = await this.getCurriculumLevels();
    return {
      totalLevels: levels.length,
      withStaticHtml: levels.filter(l => l.hasStaticHtml).length,
      withBuilder: levels.filter(l => l.hasBuilder).length,
      withAnyContent: levels.filter(l => l.hasStaticHtml || l.hasBuilder).length,
      mappedFromLegacy59: levels.filter(l => l.legacyLevel59 !== null).length,
    };
  }

  // --- Diagnostic Answer Key Methods ---

  async addDiagnosticAnswerKey(key: DiagnosticAnswerKey) {
    if (this.mongoDb) {
      await this.mongoDb.collection('diagnostic_answer_keys').insertOne(key);
    }
    if (this.data) {
      if (!this.data.diagnosticAnswerKeys) this.data.diagnosticAnswerKeys = [];
      this.data.diagnosticAnswerKeys.push(key);
    }
    return key;
  }

  async getDiagnosticAnswerKeys(jobId: string): Promise<DiagnosticAnswerKey[]> {
    if (this.mongoDb) {
      return await this.mongoDb.collection<DiagnosticAnswerKey>('diagnostic_answer_keys').find({ jobId }).toArray();
    }
    return (this.data?.diagnosticAnswerKeys || []).filter(k => k.jobId === jobId);
  }

  async getStudentDiagnosticAnswerKey(studentId: string, jobId?: string): Promise<DiagnosticAnswerKey | null> {
      if (this.mongoDb) {
        const query: any = { studentId };
        if (jobId) query.jobId = jobId;
        return await this.mongoDb.collection<DiagnosticAnswerKey>('diagnostic_answer_keys').findOne(query, { sort: { createdAt: -1 } });
      }
      const keys = (this.data?.diagnosticAnswerKeys || []).filter(k => k.studentId === studentId && (!jobId || k.jobId === jobId));
      return keys[keys.length - 1] || null;
    }

    // Fetch the latest diagnostic answer key for any student in a given class —
    // used when a single sheet scan is performed without a specific student
    // selected (the OCR can't ask "which student", so it grabs the most
    // recently generated paper for that class). All students in the same class
    // get the same paper up to per-student randomization, so this is a safe
    // approximation when no per-student answer key is available.
    async getLatestClassAnswerKey(classNumber: number): Promise<DiagnosticAnswerKey | null> {
      if (this.mongoDb) {
        return await this.mongoDb.collection<DiagnosticAnswerKey>('diagnostic_answer_keys')
          .findOne({ classNumber }, { sort: { createdAt: -1 } });
      }
      const keys = (this.data?.diagnosticAnswerKeys || [])
        .filter(k => k.classNumber === classNumber)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return keys[0] || null;
    }

  // --- Preloaded Question Pool (Mathematical Curriculum Questions Classes 2-4) ---
  private getSeedQuestions(): Question[] {
    return [
      // Level 1: Preschool & Intro Counting
      {
        question_id: 'L1_Q1',
        question: 'Count the apples in the picture. How many apples are there?',
        answer: '5',
        answer_type: 'number',
        topic: 'Number Sense',
        subtopic: 'Counting',
        difficulty: 'easy',
        source_level: 1,
        svgAsset: 'fruits'
      },
      {
        question_id: 'L1_Q2',
        question: 'Count the circles and write the total number.',
        answer: '3',
        answer_type: 'number',
        topic: 'Shapes',
        subtopic: 'Recognition',
        difficulty: 'easy',
        source_level: 1,
        svgAsset: 'shapes'
      },
      // Level 2: Class 1 Addition & Simple Shapes
      {
        question_id: 'L2_Q1',
        question: 'Calculate: 3 + 4 = ?',
        answer: '7',
        answer_type: 'number',
        topic: 'Number Operations',
        subtopic: 'Addition',
        difficulty: 'easy',
        source_level: 2,
        svgAsset: 'numbers'
      },
      {
        question_id: 'L2_Q2',
        question: 'Complete the pattern: Red Circle, Blue Circle, Red Circle, ?',
        answer: 'Blue Circle',
        answer_type: 'choice',
        choices: ['Red Circle', 'Blue Circle', 'Green Circle'],
        topic: 'Patterns',
        subtopic: 'Completing Patterns',
        difficulty: 'medium',
        source_level: 2,
        svgAsset: 'shapes'
      },
      // Level 3: Class 2 Measurement, Time, Simple Operations
      {
        question_id: 'L3_Q1',
        question: 'If a pencil is 8 centimeters long and we cut 3 centimeters off, how long is it now?',
        answer: '5',
        answer_type: 'number',
        topic: 'Measurement',
        subtopic: 'Length Subtraction',
        difficulty: 'medium',
        source_level: 3,
        svgAsset: 'tracing'
      },
      {
        question_id: 'L3_Q2',
        question: 'Look at the clock. If the short hand points to 3 and the long hand points to 12, what hour is it?',
        answer: '3',
        answer_type: 'number',
        topic: 'Calendar and Time',
        subtopic: 'Reading Hours',
        difficulty: 'easy',
        source_level: 3,
        svgAsset: 'numbers'
      },
      // Level 4: Class 3 Fractions, 2D/3D shapes, Money
      {
        question_id: 'L4_Q1',
        question: 'Ramu has a pizza cut into 4 equal slices. He eats 1 slice. What fraction of the pizza is left?',
        answer: '3/4',
        answer_type: 'choice',
        choices: ['1/4', '2/4', '3/4', '4/4'],
        topic: 'Fractions',
        subtopic: 'Fraction Representation',
        difficulty: 'medium',
        source_level: 4,
        svgAsset: 'shapes'
      },
      {
        question_id: 'L4_Q2',
        question: 'You buy a toy for 15 rupees and give the shopkeeper a 50-rupee note. How many rupees do you get back?',
        answer: '35',
        answer_type: 'number',
        topic: 'Money',
        subtopic: 'Transaction Change',
        difficulty: 'hard',
        source_level: 4,
        svgAsset: 'numbers'
      },
      // Level 5: Class 4 Double-digit operations, Multiplication, Decimals intro
      {
        question_id: 'L5_Q1',
        question: 'Multiply: 12 x 5 = ?',
        answer: '60',
        answer_type: 'number',
        topic: 'Number Operations',
        subtopic: 'Multiplication',
        difficulty: 'easy',
        source_level: 5,
        svgAsset: 'numbers'
      },
      {
        question_id: 'L5_Q2',
        question: 'In a class there are 5 benches. Each bench holds 4 students. How many students can sit in total?',
        answer: '20',
        answer_type: 'number',
        topic: 'Data Handling',
        subtopic: 'Simple Arithmetic Multiplication',
        difficulty: 'medium',
        source_level: 5,
        svgAsset: 'animals'
      },
      // Level 6: Higher level calendar, division, data charts
      {
        question_id: 'L6_Q1',
        question: 'Divide: 48 / 6 = ?',
        answer: '8',
        answer_type: 'number',
        topic: 'Number Operations',
        subtopic: 'Division',
        difficulty: 'medium',
        source_level: 6,
        svgAsset: 'numbers'
      },
      {
        question_id: 'L6_Q2',
        question: 'If July 1st is a Monday, what day of the week is July 8th?',
        answer: 'Monday',
        answer_type: 'choice',
        choices: ['Monday', 'Tuesday', 'Sunday', 'Wednesday'],
        topic: 'Calendar and Time',
        subtopic: 'Calendar Arithmetic',
        difficulty: 'hard',
        source_level: 6,
        svgAsset: 'numbers'
      }
    ];
  }

  // --- Comprehensive Pre-Seeded Workspace Data ---
  private getSeedData(): DatabaseSchema {
    const schools: School[] = [
      { id: 'gps-mt-001', name: 'GPS Model Town Ludhiana', stateCode: 'PB', districtCode: 'LDH', blockCode: 'LDH-01', strength: 'high', teachersCount: 2 },
      { id: 'gps-vl-002', name: 'GPS Rural Village Moga', stateCode: 'PB', districtCode: 'MOG', blockCode: 'MOG-02', strength: 'low', teachersCount: 0 },
      { id: 'gps-amb-003', name: 'GPS Cantt Ambala', stateCode: 'HR', districtCode: 'AMB', blockCode: 'AMB-01', strength: 'high', teachersCount: 1 },
      { id: 'gps-jai-004', name: 'GPS Govind Dev Jaipur', stateCode: 'RJ', districtCode: 'JAI', blockCode: 'JAI-01', strength: 'low', teachersCount: 1 },
      { id: 'gps-lko-005', name: 'GPS Hazratganj Lucknow', stateCode: 'UP', districtCode: 'LKO', blockCode: 'LKO-01', strength: 'high', teachersCount: 1 },
      { id: 'gps-bth-006', name: 'GPS Bathinda City', stateCode: 'PB', districtCode: 'BTH', blockCode: 'BTH-01', strength: 'high', teachersCount: 2 },
      { id: 'gps-asr-007', name: 'GPS Amritsar Golden', stateCode: 'PB', districtCode: 'ASR', blockCode: 'ASR-01', strength: 'low', teachersCount: 1 },
      { id: 'gps-pkl-008', name: 'GPS Panchkula Sector', stateCode: 'HR', districtCode: 'PKL', blockCode: 'PKL-01', strength: 'high', teachersCount: 2 },
      { id: 'gps-jai2-009', name: 'GPS Jaipur Rural North', stateCode: 'RJ', districtCode: 'JAI', blockCode: 'JAI-02', strength: 'low', teachersCount: 1 },
      { id: 'gps-uda-010', name: 'GPS Udaipur City', stateCode: 'RJ', districtCode: 'UDA', blockCode: 'UDA-01', strength: 'high', teachersCount: 2 },
      { id: 'gps-lko2-011', name: 'GPS Lucknow Aliganj', stateCode: 'UP', districtCode: 'LKO', blockCode: 'LKO-02', strength: 'high', teachersCount: 1 },
      { id: 'gps-knp-012', name: 'GPS Kanpur Cantt', stateCode: 'UP', districtCode: 'KNP', blockCode: 'KNP-01', strength: 'low', teachersCount: 1 },
      { id: 'gps-pb-ldh2-013', name: 'GPS Gill Village Ludhiana', stateCode: 'PB', districtCode: 'LDH', blockCode: 'LDH-02', strength: 'low', teachersCount: 1 },
      { id: 'gps-hr-amb2-014', name: 'GPS Ambala City South', stateCode: 'HR', districtCode: 'AMB', blockCode: 'AMB-02', strength: 'high', teachersCount: 2 }
    ];

    const users: User[] = [
      { id: 'u1', email: 'superadmin@fln.org', name: 'Jinal Gupta', role: UserRole.SUPERADMIN },
      { id: 'u2', email: 'admin.pb@fln.org', name: 'State Coordinator Punjab', role: UserRole.ADMIN, stateCode: 'PB' },
      { id: 'u2_hr', email: 'admin.hr@fln.org', name: 'State Coordinator Haryana', role: UserRole.ADMIN, stateCode: 'HR' },
      { id: 'u2_rj', email: 'admin.rj@fln.org', name: 'State Coordinator Rajasthan', role: UserRole.ADMIN, stateCode: 'RJ' },
      { id: 'u2_up', email: 'admin.up@fln.org', name: 'State Coordinator Uttar Pradesh', role: UserRole.ADMIN, stateCode: 'UP' },
      { id: 'u3', email: 'district.ldh@fln.org', name: 'Ludhiana District Officer', role: UserRole.DISTRICT_ADMIN, stateCode: 'PB', districtCode: 'LDH' },
      { id: 'u3_amb', email: 'district.amb@fln.org', name: 'Ambala District Officer', role: UserRole.DISTRICT_ADMIN, stateCode: 'HR', districtCode: 'AMB' },
      { id: 'u3_jai', email: 'district.jai@fln.org', name: 'Jaipur District Officer', role: UserRole.DISTRICT_ADMIN, stateCode: 'RJ', districtCode: 'JAI' },
      { id: 'u3_lko', email: 'district.lko@fln.org', name: 'Lucknow District Officer', role: UserRole.DISTRICT_ADMIN, stateCode: 'UP', districtCode: 'LKO' },
      { id: 'u4', email: 'block.ldh-01@fln.org', name: 'Ludhiana Block Admin 1', role: UserRole.BLOCK_ADMIN, stateCode: 'PB', districtCode: 'LDH', blockCode: 'LDH-01' },
      { id: 'u4_lko', email: 'block.lko-01@fln.org', name: 'Lucknow Block Admin 1', role: UserRole.BLOCK_ADMIN, stateCode: 'UP', districtCode: 'LKO', blockCode: 'LKO-01' },
      { id: 'u5', email: 'gps-mt-001@fln.org', name: 'GPS Model Town Principal', role: UserRole.SCHOOL, schoolId: 'gps-mt-001' },
      { id: 'u5_amb', email: 'gps-amb-003@fln.org', name: 'GPS Cantt Principal', role: UserRole.SCHOOL, schoolId: 'gps-amb-003' },
      { id: 'u5_jai', email: 'gps-jai-004@fln.org', name: 'GPS Govind Dev Principal', role: UserRole.SCHOOL, schoolId: 'gps-jai-004' },
      { id: 'u5_lko', email: 'gps-lko-005@fln.org', name: 'GPS Hazratganj Principal', role: UserRole.SCHOOL, schoolId: 'gps-lko-005' },
      { id: 'u6', email: 'gps-mt-001.t01@fln.org', name: 'Ritu Sharma (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-mt-001' },
      { id: 'u6_amb', email: 'gps-amb-003.t01@fln.org', name: 'Meena Kumari (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-amb-003' },
      { id: 'u6_jai', email: 'gps-jai-004.t01@fln.org', name: 'Ram Gopal (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-jai-004' },
      { id: 'u6_lko', email: 'gps-lko-005.t01@fln.org', name: 'Suresh Kumar (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-lko-005' },
      { id: 'u7', email: 'vol.rahul@fln.org', name: 'Punjab Volunteer (Rahul)', role: UserRole.VOLUNTEER, assignedSchools: ['gps-vl-002'] },
      { id: 'u7_amit', email: 'vol.amit@fln.org', name: 'Amit Saini (Volunteer)', role: UserRole.VOLUNTEER, assignedSchools: ['gps-vl-002', 'gps-jai-004'] },
      { id: 'u7_sneha', email: 'vol.up_sneha@fln.org', name: 'Sneha Verma (Volunteer)', role: UserRole.VOLUNTEER, assignedSchools: ['gps-lko-005'] },
      { id: 'u7_vipin', email: 'vol.hr_vipin@fln.org', name: 'Haryana Volunteer (Vipin)', role: UserRole.VOLUNTEER, assignedSchools: ['gps-amb-003'] },
      // District admins for new districts
      { id: 'u3_bth', email: 'district.bth@fln.org', name: 'Bathinda District Officer', role: UserRole.DISTRICT_ADMIN, stateCode: 'PB', districtCode: 'BTH' },
      { id: 'u3_asr', email: 'district.asr@fln.org', name: 'Amritsar District Officer', role: UserRole.DISTRICT_ADMIN, stateCode: 'PB', districtCode: 'ASR' },
      { id: 'u3_pkl', email: 'district.pkl@fln.org', name: 'Panchkula District Officer', role: UserRole.DISTRICT_ADMIN, stateCode: 'HR', districtCode: 'PKL' },
      { id: 'u3_uda', email: 'district.uda@fln.org', name: 'Udaipur District Officer', role: UserRole.DISTRICT_ADMIN, stateCode: 'RJ', districtCode: 'UDA' },
      { id: 'u3_knp', email: 'district.knp@fln.org', name: 'Kanpur District Officer', role: UserRole.DISTRICT_ADMIN, stateCode: 'UP', districtCode: 'KNP' },
      // Block admins for new blocks
      { id: 'u4_bth', email: 'block.bth-01@fln.org', name: 'Bathinda Block Admin', role: UserRole.BLOCK_ADMIN, stateCode: 'PB', districtCode: 'BTH', blockCode: 'BTH-01' },
      { id: 'u4_asr', email: 'block.asr-01@fln.org', name: 'Amritsar Block Admin', role: UserRole.BLOCK_ADMIN, stateCode: 'PB', districtCode: 'ASR', blockCode: 'ASR-01' },
      { id: 'u4_pkl', email: 'block.pkl-01@fln.org', name: 'Panchkula Block Admin', role: UserRole.BLOCK_ADMIN, stateCode: 'HR', districtCode: 'PKL', blockCode: 'PKL-01' },
      { id: 'u4_jai2', email: 'block.jai-02@fln.org', name: 'Jaipur Block Admin 2', role: UserRole.BLOCK_ADMIN, stateCode: 'RJ', districtCode: 'JAI', blockCode: 'JAI-02' },
      { id: 'u4_uda', email: 'block.uda-01@fln.org', name: 'Udaipur Block Admin', role: UserRole.BLOCK_ADMIN, stateCode: 'RJ', districtCode: 'UDA', blockCode: 'UDA-01' },
      { id: 'u4_lko2', email: 'block.lko-02@fln.org', name: 'Lucknow Block Admin 2', role: UserRole.BLOCK_ADMIN, stateCode: 'UP', districtCode: 'LKO', blockCode: 'LKO-02' },
      { id: 'u4_knp', email: 'block.knp-01@fln.org', name: 'Kanpur Block Admin', role: UserRole.BLOCK_ADMIN, stateCode: 'UP', districtCode: 'KNP', blockCode: 'KNP-01' },
      { id: 'u4_ldh2', email: 'block.ldh-02@fln.org', name: 'Ludhiana Block Admin 2', role: UserRole.BLOCK_ADMIN, stateCode: 'PB', districtCode: 'LDH', blockCode: 'LDH-02' },
      { id: 'u4_amb2', email: 'block.amb-02@fln.org', name: 'Ambala Block Admin 2', role: UserRole.BLOCK_ADMIN, stateCode: 'HR', districtCode: 'AMB', blockCode: 'AMB-02' },
      // Principals for new schools
      { id: 'u5_bth', email: 'gps-bth-006@fln.org', name: 'GPS Bathinda Principal', role: UserRole.SCHOOL, schoolId: 'gps-bth-006' },
      { id: 'u5_asr', email: 'gps-asr-007@fln.org', name: 'GPS Amritsar Principal', role: UserRole.SCHOOL, schoolId: 'gps-asr-007' },
      { id: 'u5_pkl', email: 'gps-pkl-008@fln.org', name: 'GPS Panchkula Principal', role: UserRole.SCHOOL, schoolId: 'gps-pkl-008' },
      { id: 'u5_jai2', email: 'gps-jai2-009@fln.org', name: 'GPS Jaipur Rural Principal', role: UserRole.SCHOOL, schoolId: 'gps-jai2-009' },
      { id: 'u5_uda', email: 'gps-uda-010@fln.org', name: 'GPS Udaipur Principal', role: UserRole.SCHOOL, schoolId: 'gps-uda-010' },
      { id: 'u5_lko2', email: 'gps-lko2-011@fln.org', name: 'GPS Aliganj Principal', role: UserRole.SCHOOL, schoolId: 'gps-lko2-011' },
      { id: 'u5_knp', email: 'gps-knp-012@fln.org', name: 'GPS Kanpur Principal', role: UserRole.SCHOOL, schoolId: 'gps-knp-012' },
      { id: 'u5_ldh2', email: 'gps-pb-ldh2-013@fln.org', name: 'GPS Gill Village Principal', role: UserRole.SCHOOL, schoolId: 'gps-pb-ldh2-013' },
      { id: 'u5_amb2', email: 'gps-hr-amb2-014@fln.org', name: 'GPS Ambala South Principal', role: UserRole.SCHOOL, schoolId: 'gps-hr-amb2-014' },
      // Teachers for new schools
      { id: 'u6_bth_a', email: 'gps-bth-006.t01@fln.org', name: 'Harpreet Kaur (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-bth-006' },
      { id: 'u6_bth_b', email: 'gps-bth-006.t02@fln.org', name: 'Jaswant Singh (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-bth-006' },
      { id: 'u6_asr', email: 'gps-asr-007.t01@fln.org', name: 'Gurvinder Singh (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-asr-007' },
      { id: 'u6_pkl_a', email: 'gps-pkl-008.t01@fln.org', name: 'Kavita Sharma (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-pkl-008' },
      { id: 'u6_pkl_b', email: 'gps-pkl-008.t02@fln.org', name: 'Rajesh Kumar (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-pkl-008' },
      { id: 'u6_jai2', email: 'gps-jai2-009.t01@fln.org', name: 'Ravi Verma (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-jai2-009' },
      { id: 'u6_uda_a', email: 'gps-uda-010.t01@fln.org', name: 'Madhu Saxena (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-uda-010' },
      { id: 'u6_uda_b', email: 'gps-uda-010.t02@fln.org', name: 'Prakash Choudhary (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-uda-010' },
      { id: 'u6_lko2', email: 'gps-lko2-011.t01@fln.org', name: 'Alok Mishra (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-lko2-011' },
      { id: 'u6_knp', email: 'gps-knp-012.t01@fln.org', name: 'Sunita Devi (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-knp-012' },
      { id: 'u6_ldh2', email: 'gps-pb-ldh2-013.t01@fln.org', name: 'Balwinder Kaur (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-pb-ldh2-013' },
      { id: 'u6_amb2', email: 'gps-hr-amb2-014.t01@fln.org', name: 'Nisha Rani (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-hr-amb2-014' },
      // Volunteers for new low-strength schools
      { id: 'u7_asr', email: 'vol.asr@fln.org', name: 'Mandeep Kaur (Volunteer)', role: UserRole.VOLUNTEER, assignedSchools: ['gps-asr-007'] },
      { id: 'u7_jai2_vol', email: 'vol.jai2@fln.org', name: 'Deepak Sharma (Volunteer)', role: UserRole.VOLUNTEER, assignedSchools: ['gps-jai2-009'] },
      { id: 'u7_knp_vol', email: 'vol.knp@fln.org', name: 'Anita Singh (Volunteer)', role: UserRole.VOLUNTEER, assignedSchools: ['gps-knp-012'] },
      { id: 'u7_ldh2_vol', email: 'vol.ldh2@fln.org', name: 'Gurpreet Kaur (Volunteer)', role: UserRole.VOLUNTEER, assignedSchools: ['gps-pb-ldh2-013'] }
    ];

    // Give every seeded account the shared demo password as a bcrypt hash.
    users.forEach(u => { u.passwordHash = SEED_DEMO_PASSWORD_HASH; });

    const classes: ClassGroup[] = [
      { id: 'c1', schoolId: 'gps-mt-001', className: 'Class 2', section: 'A', teacherId: 'u6' },
      { id: 'c2', schoolId: 'gps-mt-001', className: 'Class 3', section: 'A', teacherId: 'u6' },
      { id: 'c3', schoolId: 'gps-vl-002', className: 'Class 2', section: 'A', teacherId: '' },
      { id: 'c4', schoolId: 'gps-amb-003', className: 'Class 3', section: 'A', teacherId: 'u6_amb' },
      { id: 'c5', schoolId: 'gps-jai-004', className: 'Class 4', section: 'A', teacherId: 'u6_jai' },
      { id: 'c6', schoolId: 'gps-lko-005', className: 'Class 3', section: 'A', teacherId: 'u6_lko' },
      { id: 'c7', schoolId: 'gps-bth-006', className: 'Class 3', section: 'A', teacherId: 'u6_bth_a' },
      { id: 'c8', schoolId: 'gps-bth-006', className: 'Class 4', section: 'A', teacherId: 'u6_bth_b' },
      { id: 'c9', schoolId: 'gps-asr-007', className: 'Class 2', section: 'A', teacherId: 'u6_asr' },
      { id: 'c10', schoolId: 'gps-pkl-008', className: 'Class 3', section: 'A', teacherId: 'u6_pkl_a' },
      { id: 'c11', schoolId: 'gps-pkl-008', className: 'Class 4', section: 'A', teacherId: 'u6_pkl_b' },
      { id: 'c12', schoolId: 'gps-jai2-009', className: 'Class 2', section: 'A', teacherId: 'u6_jai2' },
      { id: 'c13', schoolId: 'gps-uda-010', className: 'Class 4', section: 'A', teacherId: 'u6_uda_a' },
      { id: 'c14', schoolId: 'gps-uda-010', className: 'Class 3', section: 'A', teacherId: 'u6_uda_b' },
      { id: 'c15', schoolId: 'gps-lko2-011', className: 'Class 2', section: 'A', teacherId: 'u6_lko2' },
      { id: 'c16', schoolId: 'gps-lko2-011', className: 'Class 3', section: 'A', teacherId: 'u6_lko2' },
      { id: 'c17', schoolId: 'gps-knp-012', className: 'Class 2', section: 'A', teacherId: 'u6_knp' },
      { id: 'c18', schoolId: 'gps-pb-ldh2-013', className: 'Class 2', section: 'A', teacherId: 'u6_ldh2' },
      { id: 'c19', schoolId: 'gps-hr-amb2-014', className: 'Class 3', section: 'A', teacherId: 'u6_amb2' },
      { id: 'c20', schoolId: 'gps-mt-001', className: 'Class 4', section: 'A', teacherId: 'u6' }
    ];

    const students: Student[] = [
      {
        id: 's1',
        name: 'Amanpreet Singh',
        age: 8,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-mt-001',
        teacherId: 'u6',
        currentLevel: 2,
        targetLevel: 3,
        aadharMasked: 'XXXX-XXXX-4521',
        levelHistory: [{ level: 1, date: '2026-04-10', reason: 'Baseline' }],
      },
      {
        id: 's2',
        name: 'Simran Kaur',
        age: 8,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-mt-001',
        teacherId: 'u6',
        currentLevel: 3,
        targetLevel: 4,
        aadharMasked: 'XXXX-XXXX-9874',
        levelHistory: [{ level: 2, date: '2026-04-10', reason: 'Baseline' }],
      },
      {
        id: 's3',
        name: 'Gurpreet Singh',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-mt-001',
        teacherId: 'u6',
        currentLevel: 4,
        targetLevel: 5,
        aadharMasked: 'XXXX-XXXX-1122',
        levelHistory: [{ level: 3, date: '2026-04-10', reason: 'Baseline' }],
      },
      {
        id: 's4',
        name: 'Manpreet Lal',
        age: 8,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-vl-002',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-5566',
        levelHistory: [{ level: 1, date: '2026-05-15', reason: 'Baseline' }],
      },
      {
        id: 's5',
        name: 'Harjeet Sandhu',
        age: 8,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-vl-002',
        currentLevel: 2,
        targetLevel: 3,
        aadharMasked: 'XXXX-XXXX-8811',
        levelHistory: [{ level: 1, date: '2026-05-20', reason: 'Baseline' }],
      },
      {
        id: 's6',
        name: 'Sandeep Kumar',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-amb-003',
        teacherId: 'u6_amb',
        currentLevel: 3,
        targetLevel: 4,
        aadharMasked: 'XXXX-XXXX-7231',
        levelHistory: [{ level: 2, date: '2026-06-01', reason: 'Baseline' }],
      },
      {
        id: 's7',
        name: 'Sneha Sharma',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-amb-003',
        teacherId: 'u6_amb',
        currentLevel: 5,
        targetLevel: 6,
        aadharMasked: 'XXXX-XXXX-1002',
        levelHistory: [{ level: 3, date: '2026-06-01', reason: 'Baseline' }],
      },
      {
        id: 's8',
        name: 'Rajesh Saini',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-amb-003',
        teacherId: 'u6_amb',
        currentLevel: 2,
        targetLevel: 3,
        aadharMasked: 'XXXX-XXXX-3490',
        levelHistory: [{ level: 2, date: '2026-06-01', reason: 'Baseline' }],
      },
      {
        id: 's9',
        name: 'Priya Patel',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-jai-004',
        teacherId: 'u6_jai',
        currentLevel: 4,
        targetLevel: 5,
        aadharMasked: 'XXXX-XXXX-1992',
        levelHistory: [{ level: 3, date: '2026-06-15', reason: 'Baseline' }],
      },
      {
        id: 's10',
        name: 'Amit Kumar',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-jai-004',
        teacherId: 'u6_jai',
        currentLevel: 5,
        targetLevel: 6,
        aadharMasked: 'XXXX-XXXX-8822',
        levelHistory: [{ level: 4, date: '2026-06-15', reason: 'Baseline' }],
      },
      {
        id: 's11',
        name: 'Divya Gupta',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-jai-004',
        teacherId: 'u6_jai',
        currentLevel: 3,
        targetLevel: 4,
        aadharMasked: 'XXXX-XXXX-3344',
        levelHistory: [{ level: 2, date: '2026-06-15', reason: 'Baseline' }],
      },
      {
        id: 's12',
        name: 'Kabir Mehra',
        age: 8,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-vl-002',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-4545',
        levelHistory: [{ level: 1, date: '2026-06-05', reason: 'Baseline' }],
      },
      {
        id: 's13',
        name: 'Jyoti Yadav',
        age: 8,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-vl-002',
        currentLevel: 2,
        targetLevel: 3,
        aadharMasked: 'XXXX-XXXX-2121',
        levelHistory: [{ level: 1, date: '2026-06-05', reason: 'Baseline' }],
      },
      {
        id: 's14',
        name: 'Rajiv Malhotra',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-lko-005',
        teacherId: 'u6_lko',
        currentLevel: 3,
        targetLevel: 4,
        aadharMasked: 'XXXX-XXXX-1155',
        levelHistory: [{ level: 2, date: '2026-06-20', reason: 'Baseline' }],
      },
      {
        id: 's15',
        name: 'Neha Agrawal',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-lko-005',
        teacherId: 'u6_lko',
        currentLevel: 4,
        targetLevel: 5,
        aadharMasked: 'XXXX-XXXX-2266',
        levelHistory: [{ level: 3, date: '2026-06-20', reason: 'Baseline' }],
      },
      {
        id: 's16',
        name: 'Karan Johar',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-lko-005',
        teacherId: 'u6_lko',
        currentLevel: 5,
        targetLevel: 6,
        aadharMasked: 'XXXX-XXXX-3377',
        levelHistory: [{ level: 4, date: '2026-06-20', reason: 'Baseline' }],
      },
      // ── Unplaced students (empty levelHistory) for Pending Diagnostics ──
      {
        id: 's_new_1',
        name: 'Gurleen Kaur',
        age: 8,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-vl-002',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-6677',
        levelHistory: [],
      },
      {
        id: 's_new_2',
        name: 'Vikram Yadav',
        age: 8,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-vl-002',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-7788',
        levelHistory: [],
      },
      {
        id: 's_new_3',
        name: 'Ananya Mishra',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-amb-003',
        teacherId: 'u6_amb',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-8899',
        levelHistory: [],
      },
      {
        id: 's_new_4',
        name: 'Rohit Sharma',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-mt-001',
        teacherId: 'u6',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-9900',
        levelHistory: [],
      },
      {
        id: 's_new_5',
        name: 'Meera Joshi',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-jai-004',
        teacherId: 'u6_jai',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1100',
        levelHistory: [],
      },
      // ── Additional placed students at Level 8 ──
      {
        id: 's17',
        name: 'Arjun Mehta',
        age: 7,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-mt-001',
        teacherId: 'u6',
        currentLevel: 8,
        currentSubLevel: 0,
        targetLevel: 9,
        aadharMasked: 'XXXX-XXXX-1201',
        levelHistory: [{ level: 4, date: '2026-04-15', reason: 'Baseline' }, { level: 6, date: '2026-05-20', reason: 'Mid-year' }, { level: 8, date: '2026-07-01', reason: 'End-of-year' }],
      },
      {
        id: 's18',
        name: 'Kavya Reddy',
        age: 8,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-bth-006',
        teacherId: 'u6_bth_a',
        currentLevel: 8,
        currentSubLevel: 1,
        targetLevel: 9,
        aadharMasked: 'XXXX-XXXX-1202',
        levelHistory: [{ level: 3, date: '2026-05-01', reason: 'Baseline' }, { level: 5, date: '2026-06-10', reason: 'Baseline' }, { level: 8, date: '2026-07-03', reason: 'Mid-year' }],
      },
      {
        id: 's19',
        name: 'Rohan Das',
        age: 8,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-amb-003',
        teacherId: 'u6_amb',
        currentLevel: 8,
        currentSubLevel: 2,
        targetLevel: 9,
        aadharMasked: 'XXXX-XXXX-1203',
        levelHistory: [{ level: 2, date: '2026-04-20', reason: 'Baseline' }, { level: 8, date: '2026-06-25', reason: 'Remedial intervention' }],
      },
      // ── Students at Level 10 ──
      {
        id: 's20',
        name: 'Pooja Verma',
        age: 8,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-mt-001',
        teacherId: 'u6',
        currentLevel: 10,
        currentSubLevel: 0,
        targetLevel: 11,
        aadharMasked: 'XXXX-XXXX-1204',
        levelHistory: [{ level: 5, date: '2026-04-10', reason: 'Baseline' }, { level: 7, date: '2026-05-15', reason: 'Baseline' }, { level: 10, date: '2026-06-30', reason: 'Mid-year' }],
      },
      {
        id: 's21',
        name: 'Vivek Saxena',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-lko-005',
        teacherId: 'u6_lko',
        currentLevel: 10,
        currentSubLevel: 0,
        targetLevel: 11,
        aadharMasked: 'XXXX-XXXX-1205',
        levelHistory: [{ level: 6, date: '2026-05-05', reason: 'Baseline' }, { level: 8, date: '2026-06-01', reason: 'Baseline' }, { level: 10, date: '2026-07-02', reason: 'Mid-year' }],
      },
      // ── Students at Level 12 ──
      {
        id: 's22',
        name: 'Anika Gupta',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-pkl-008',
        teacherId: 'u6_pkl_a',
        currentLevel: 12,
        currentSubLevel: 0,
        targetLevel: 13,
        aadharMasked: 'XXXX-XXXX-1206',
        levelHistory: [{ level: 7, date: '2026-04-25', reason: 'Baseline' }, { level: 10, date: '2026-06-05', reason: 'Baseline' }, { level: 12, date: '2026-07-04', reason: 'Mid-year' }],
      },
      {
        id: 's23',
        name: 'Ishaan Kapoor',
        age: 8,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-uda-010',
        teacherId: 'u6_uda_b',
        currentLevel: 12,
        currentSubLevel: 0,
        targetLevel: 13,
        aadharMasked: 'XXXX-XXXX-1207',
        levelHistory: [{ level: 8, date: '2026-05-10', reason: 'Baseline' }, { level: 12, date: '2026-06-28', reason: 'Baseline' }],
      },
      // ── Students at Level 15 ──
      {
        id: 's24',
        name: 'Tanvi Bhatia',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-mt-001',
        teacherId: 'u6',
        currentLevel: 15,
        currentSubLevel: 0,
        targetLevel: 16,
        aadharMasked: 'XXXX-XXXX-1208',
        levelHistory: [{ level: 8, date: '2026-04-10', reason: 'Baseline' }, { level: 11, date: '2026-05-20', reason: 'Baseline' }, { level: 15, date: '2026-07-01', reason: 'Mid-year' }],
      },
      {
        id: 's25',
        name: 'Kabir Malhotra',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-jai-004',
        teacherId: 'u6_jai',
        currentLevel: 15,
        currentSubLevel: 1,
        targetLevel: 16,
        aadharMasked: 'XXXX-XXXX-1209',
        levelHistory: [{ level: 10, date: '2026-05-15', reason: 'Baseline' }, { level: 15, date: '2026-07-02', reason: 'Baseline' }],
      },
      // ── Students at various other levels ──
      {
        id: 's26',
        name: 'Naina Agarwal',
        age: 7,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-mt-001',
        teacherId: 'u6',
        currentLevel: 5,
        currentSubLevel: 0,
        targetLevel: 6,
        aadharMasked: 'XXXX-XXXX-1210',
        levelHistory: [{ level: 2, date: '2026-04-10', reason: 'Baseline' }, { level: 5, date: '2026-06-20', reason: 'Baseline' }],
      },
      {
        id: 's27',
        name: 'Reyansh Singh',
        age: 7,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-vl-002',
        currentLevel: 3,
        currentSubLevel: 0,
        targetLevel: 4,
        aadharMasked: 'XXXX-XXXX-1211',
        levelHistory: [{ level: 1, date: '2026-05-15', reason: 'Baseline' }, { level: 3, date: '2026-06-25', reason: 'Baseline' }],
      },
      {
        id: 's28',
        name: 'Myra Choudhary',
        age: 7,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-bth-006',
        teacherId: 'u6_bth_a',
        currentLevel: 6,
        currentSubLevel: 0,
        targetLevel: 7,
        aadharMasked: 'XXXX-XXXX-1212',
        levelHistory: [{ level: 2, date: '2026-05-01', reason: 'Baseline' }, { level: 4, date: '2026-06-05', reason: 'Baseline' }, { level: 6, date: '2026-07-01', reason: 'Mid-year' }],
      },
      {
        id: 's29',
        name: 'Advik Nair',
        age: 8,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-asr-007',
        teacherId: 'u6_asr',
        currentLevel: 4,
        currentSubLevel: 1,
        targetLevel: 5,
        aadharMasked: 'XXXX-XXXX-1213',
        levelHistory: [{ level: 1, date: '2026-05-20', reason: 'Baseline' }, { level: 4, date: '2026-07-02', reason: 'Baseline' }],
      },
      {
        id: 's30',
        name: 'Aadhya Iyer',
        age: 8,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-pkl-008',
        teacherId: 'u6_pkl_a',
        currentLevel: 7,
        currentSubLevel: 0,
        targetLevel: 8,
        aadharMasked: 'XXXX-XXXX-1214',
        levelHistory: [{ level: 3, date: '2026-04-25', reason: 'Baseline' }, { level: 5, date: '2026-06-01', reason: 'Baseline' }, { level: 7, date: '2026-07-03', reason: 'Mid-year' }],
      },
      {
        id: 's31',
        name: 'Vihaan Joshi',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-amb-003',
        teacherId: 'u6_amb',
        currentLevel: 6,
        currentSubLevel: 2,
        targetLevel: 7,
        aadharMasked: 'XXXX-XXXX-1215',
        levelHistory: [{ level: 2, date: '2026-04-20', reason: 'Baseline' }, { level: 6, date: '2026-06-18', reason: 'Baseline' }],
      },
      {
        id: 's32',
        name: 'Anvi Kaur',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-lko-005',
        teacherId: 'u6_lko',
        currentLevel: 9,
        currentSubLevel: 0,
        targetLevel: 10,
        aadharMasked: 'XXXX-XXXX-1216',
        levelHistory: [{ level: 5, date: '2026-05-05', reason: 'Baseline' }, { level: 7, date: '2026-06-10', reason: 'Baseline' }, { level: 9, date: '2026-07-02', reason: 'Mid-year' }],
      },
      {
        id: 's33',
        name: 'Shaurya Patel',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-lko2-011',
        teacherId: 'u6_lko2',
        currentLevel: 11,
        currentSubLevel: 0,
        targetLevel: 12,
        aadharMasked: 'XXXX-XXXX-1217',
        levelHistory: [{ level: 6, date: '2026-05-10', reason: 'Baseline' }, { level: 8, date: '2026-06-15', reason: 'Baseline' }, { level: 11, date: '2026-07-04', reason: 'Mid-year' }],
      },
      {
        id: 's34',
        name: 'Krisha Sharma',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-hr-amb2-014',
        teacherId: 'u6_amb2',
        currentLevel: 7,
        currentSubLevel: 0,
        targetLevel: 8,
        aadharMasked: 'XXXX-XXXX-1218',
        levelHistory: [{ level: 3, date: '2026-05-20', reason: 'Baseline' }, { level: 7, date: '2026-07-01', reason: 'Baseline' }],
      },
      {
        id: 's35',
        name: 'Dhruv Thakur',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-jai-004',
        teacherId: 'u6_jai',
        currentLevel: 11,
        currentSubLevel: 1,
        targetLevel: 12,
        aadharMasked: 'XXXX-XXXX-1219',
        levelHistory: [{ level: 6, date: '2026-05-15', reason: 'Baseline' }, { level: 9, date: '2026-06-20', reason: 'Baseline' }, { level: 11, date: '2026-07-03', reason: 'Mid-year' }],
      },
      {
        id: 's36',
        name: 'Aanya Gupta',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-bth-006',
        teacherId: 'u6_bth_b',
        currentLevel: 13,
        currentSubLevel: 0,
        targetLevel: 14,
        aadharMasked: 'XXXX-XXXX-1220',
        levelHistory: [{ level: 8, date: '2026-05-01', reason: 'Baseline' }, { level: 11, date: '2026-06-10', reason: 'Baseline' }, { level: 13, date: '2026-07-02', reason: 'Mid-year' }],
      },
      {
        id: 's37',
        name: 'Arush Bhat',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-uda-010',
        teacherId: 'u6_uda_a',
        currentLevel: 14,
        currentSubLevel: 0,
        targetLevel: 15,
        aadharMasked: 'XXXX-XXXX-1221',
        levelHistory: [{ level: 9, date: '2026-05-10', reason: 'Baseline' }, { level: 12, date: '2026-06-20', reason: 'Baseline' }, { level: 14, date: '2026-07-04', reason: 'Mid-year' }],
      },
      {
        id: 's38',
        name: 'Sara Khan',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-pkl-008',
        teacherId: 'u6_pkl_b',
        currentLevel: 9,
        currentSubLevel: 2,
        targetLevel: 10,
        aadharMasked: 'XXXX-XXXX-1222',
        levelHistory: [{ level: 4, date: '2026-04-25', reason: 'Baseline' }, { level: 9, date: '2026-06-28', reason: 'Baseline' }],
      },
      {
        id: 's39',
        name: 'Yuvan Reddy',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-mt-001',
        teacherId: 'u6',
        currentLevel: 6,
        currentSubLevel: 0,
        targetLevel: 7,
        aadharMasked: 'XXXX-XXXX-1223',
        levelHistory: [{ level: 2, date: '2026-04-10', reason: 'Baseline' }, { level: 4, date: '2026-05-25', reason: 'Baseline' }, { level: 6, date: '2026-07-01', reason: 'Mid-year' }],
      },
      // ── Students in Bathinda (lagging district) ──
      {
        id: 's40',
        name: 'Simranjit Kaur',
        age: 8,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-bth-006',
        teacherId: 'u6_bth_a',
        currentLevel: 2,
        currentSubLevel: 2,
        targetLevel: 3,
        aadharMasked: 'XXXX-XXXX-1224',
        levelHistory: [{ level: 1, date: '2026-05-01', reason: 'Baseline' }, { level: 2, date: '2026-06-20', reason: 'Baseline' }],
      },
      {
        id: 's41',
        name: 'Gurleen Kaur Bajwa',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-bth-006',
        teacherId: 'u6_bth_a',
        currentLevel: 1,
        currentSubLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1225',
        levelHistory: [{ level: 1, date: '2026-06-01', reason: 'Baseline' }],
      },
      {
        id: 's42',
        name: 'Mandeep Singh',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-bth-006',
        teacherId: 'u6_bth_b',
        currentLevel: 3,
        currentSubLevel: 0,
        targetLevel: 4,
        aadharMasked: 'XXXX-XXXX-1226',
        levelHistory: [{ level: 1, date: '2026-05-10', reason: 'Baseline' }, { level: 3, date: '2026-06-25', reason: 'Baseline' }],
      },
      // ── Students in Amritsar (low-strength school) ──
      {
        id: 's43',
        name: 'Navjot Singh',
        age: 7,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-asr-007',
        teacherId: 'u6_asr',
        currentLevel: 1,
        currentSubLevel: 0,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1227',
        levelHistory: [{ level: 1, date: '2026-06-10', reason: 'Baseline' }],
      },
      {
        id: 's44',
        name: 'Harleen Kaur',
        age: 7,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-asr-007',
        teacherId: 'u6_asr',
        currentLevel: 2,
        currentSubLevel: 0,
        targetLevel: 3,
        aadharMasked: 'XXXX-XXXX-1228',
        levelHistory: [{ level: 1, date: '2026-06-10', reason: 'Baseline' }, { level: 2, date: '2026-07-01', reason: 'Baseline' }],
      },
      // ── Students in Jaipur Rural North ──
      {
        id: 's45',
        name: 'Lakshya Sharma',
        age: 7,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-jai2-009',
        teacherId: 'u6_jai2',
        currentLevel: 5,
        currentSubLevel: 0,
        targetLevel: 6,
        aadharMasked: 'XXXX-XXXX-1229',
        levelHistory: [{ level: 2, date: '2026-05-15', reason: 'Baseline' }, { level: 5, date: '2026-06-28', reason: 'Baseline' }],
      },
      {
        id: 's46',
        name: 'Ritu Yadav',
        age: 7,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-jai2-009',
        teacherId: 'u6_jai2',
        currentLevel: 3,
        currentSubLevel: 1,
        targetLevel: 4,
        aadharMasked: 'XXXX-XXXX-1230',
        levelHistory: [{ level: 1, date: '2026-05-20', reason: 'Baseline' }, { level: 3, date: '2026-07-01', reason: 'Baseline' }],
      },
      // ── Unplaced students needing diagnostics ──
      {
        id: 's_new_6',
        name: 'Krishna Murari',
        age: 8,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-mt-001',
        teacherId: 'u6',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1231',
        levelHistory: [],
      },
      {
        id: 's_new_7',
        name: 'Shivani Gupta',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-pkl-008',
        teacherId: 'u6_pkl_a',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1232',
        levelHistory: [],
      },
      {
        id: 's_new_8',
        name: 'Ravi Prakash',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-lko2-011',
        teacherId: 'u6_lko2',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1233',
        levelHistory: [],
      },
      {
        id: 's_new_9',
        name: 'Pooja Kumari',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-uda-010',
        teacherId: 'u6_uda_a',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1234',
        levelHistory: [],
      },
      {
        id: 's_new_10',
        name: 'Amit Verma',
        age: 7,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-knp-012',
        teacherId: 'u6_knp',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1235',
        levelHistory: [],
      },
      {
        id: 's_new_11',
        name: 'Priyanka Das',
        age: 8,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-pb-ldh2-013',
        teacherId: 'u6_ldh2',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1236',
        levelHistory: [],
      },
      {
        id: 's_new_12',
        name: 'Arjun Yadav',
        age: 8,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-hr-amb2-014',
        teacherId: 'u6_amb2',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1237',
        levelHistory: [],
      },
      {
        id: 's_new_13',
        name: 'Sana Sheikh',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-lko-005',
        teacherId: 'u6_lko',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1238',
        levelHistory: [],
      },
      {
        id: 's_new_14',
        name: 'Rohini Patil',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-amb-003',
        teacherId: 'u6_amb',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1239',
        levelHistory: [],
      },
      {
        id: 's_new_15',
        name: 'Farhan Ali',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-jai-004',
        teacherId: 'u6_jai',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1240',
        levelHistory: [],
      }
    ];

    const seedQuestions = this.getSeedQuestions();

    // --- Preseeded Worksheet Variations ---
    const worksheets: Worksheet[] = [
      {
        id: 'WS_1001',
        classId: 'c1',
        className: 'Class 2',
        section: 'A',
        schoolId: 'gps-mt-001',
        generatedByRole: UserRole.TEACHER,
        generatedByEmail: 'gps-mt-001.t01@fln.org',
        cycle: 'Baseline',
        date: '2026-06-15',
        questions: [
          { ...seedQuestions[0], question_id: 's1_L1_Q1', question: '[For Amanpreet Singh - Level 2] Count the apples...' },
          { ...seedQuestions[2], question_id: 's1_L2_Q1', question: '[For Amanpreet Singh - Level 2] Calculate: 3 + 4...' },
          { ...seedQuestions[1], question_id: 's2_L1_Q2', question: '[For Simran Kaur - Level 3] Count the circles...' },
          { ...seedQuestions[4], question_id: 's2_L3_Q1', question: '[For Simran Kaur - Level 3] If a pencil is 8 centimeters...' }
        ],
        locks: {
          locked: true,
          lockedByRole: UserRole.TEACHER,
          lockedByEmail: 'gps-mt-001.t01@fln.org',
          timestamp: '2026-06-15T09:00:00Z'
        },
        timing: {
          examDate: '2026-06-15',
          printWindowStart: '2026-06-15T09:00:00Z',
          printWindowEnd: '2026-06-15T10:00:00Z',
          examWindowStart: '2026-06-15T10:00:00Z',
          examWindowEnd: '2026-06-15T10:45:00Z',
          submissionWindowEnd: '2026-06-15T11:45:00Z'
        },
        delayLogs: {
          delayedAttemptsCount: 0,
          submittingTeachers: []
        }
      },
      {
        id: 'WS_1002',
        classId: 'c4',
        className: 'Class 3',
        section: 'A',
        schoolId: 'gps-amb-003',
        generatedByRole: UserRole.TEACHER,
        generatedByEmail: 'gps-amb-003.t01@fln.org',
        cycle: 'Baseline',
        date: '2026-06-18',
        questions: [
          { ...seedQuestions[4], question_id: 's6_L3_Q1', question: '[For Sandeep Kumar - Level 3] If a pencil is 8cm...' },
          { ...seedQuestions[3], question_id: 's8_L2_Q2', question: '[For Rajesh Saini - Level 2] Complete pattern: Red...' }
        ],
        locks: {
          locked: true,
          lockedByRole: UserRole.TEACHER,
          lockedByEmail: 'gps-amb-003.t01@fln.org',
          timestamp: '2026-06-18T09:00:00Z'
        },
        timing: {
          examDate: '2026-06-18',
          printWindowStart: '2026-06-18T09:00:00Z',
          printWindowEnd: '2026-06-18T10:00:00Z',
          examWindowStart: '2026-06-18T10:00:00Z',
          examWindowEnd: '2026-06-18T10:45:00Z',
          submissionWindowEnd: '2026-06-18T11:45:00Z'
        },
        delayLogs: {
          delayedAttemptsCount: 0,
          submittingTeachers: []
        }
      },
      {
        id: 'WS_1003',
        classId: 'c2',
        className: 'Class 3',
        section: 'A',
        schoolId: 'gps-mt-001',
        generatedByRole: UserRole.TEACHER,
        generatedByEmail: 'gps-mt-001.t01@fln.org',
        cycle: 'Mid-year',
        date: '2026-07-02',
        questions: [
          { ...seedQuestions[4], question_id: 's3_L3_Q1', question: '[For Gurpreet Singh - Level 4] Pencil centimeter subtraction...' }
        ],
        locks: {
          locked: true,
          lockedByRole: UserRole.TEACHER,
          lockedByEmail: 'gps-mt-001.t01@fln.org',
          timestamp: '2026-07-02T09:00:00Z'
        },
        timing: {
          examDate: '2026-07-02',
          printWindowStart: '2026-07-02T09:00:00Z',
          printWindowEnd: '2026-07-02T10:00:00Z',
          examWindowStart: '2026-07-02T10:00:00Z',
          examWindowEnd: '2026-07-02T10:45:00Z',
          submissionWindowEnd: '2026-07-02T11:45:00Z'
        },
        delayLogs: {
          delayedAttemptsCount: 1,
          submittingTeachers: ['gps-mt-001.t01@fln.org']
        }
      },
      {
        id: 'WS_1004',
        classId: 'c6',
        className: 'Class 3',
        section: 'A',
        schoolId: 'gps-lko-005',
        generatedByRole: UserRole.TEACHER,
        generatedByEmail: 'gps-lko-005.t01@fln.org',
        cycle: 'Baseline',
        date: '2026-06-22',
        questions: [
          { ...seedQuestions[4], question_id: 's14_L3_Q1', question: '[For Rajiv Malhotra - Level 3] Count matching pattern steps...' },
          { ...seedQuestions[3], question_id: 's15_L2_Q2', question: '[For Neha Agrawal - Level 2] Deduce the missing pattern...' }
        ],
        locks: {
          locked: true,
          lockedByRole: UserRole.TEACHER,
          lockedByEmail: 'gps-lko-005.t01@fln.org',
          timestamp: '2026-06-22T09:00:00Z'
        },
        timing: {
          examDate: '2026-06-22',
          printWindowStart: '2026-06-22T09:00:00Z',
          printWindowEnd: '2026-06-22T10:00:00Z',
          examWindowStart: '2026-06-22T10:00:00Z',
          examWindowEnd: '2026-06-22T10:45:00Z',
          submissionWindowEnd: '2026-06-22T11:45:00Z'
        },
        delayLogs: {
          delayedAttemptsCount: 0,
          submittingTeachers: []
        }
      },
      {
        id: 'WS_1005',
        classId: 'c7',
        className: 'Class 3',
        section: 'A',
        schoolId: 'gps-bth-006',
        generatedByRole: UserRole.TEACHER,
        generatedByEmail: 'gps-bth-006.t01@fln.org',
        cycle: 'Baseline',
        date: '2026-07-01',
        questions: [
          { ...seedQuestions[0], question_id: 's18_L1_Q1', question: '[For Kavya Reddy - Level 8] Counting objects...' },
          { ...seedQuestions[4], question_id: 's40_L3_Q1', question: '[For Simranjit Kaur - Level 2] Pencil subtraction...' },
          { ...seedQuestions[6], question_id: 's28_L4_Q1', question: '[For Myra Choudhary - Level 6] Money change...' }
        ],
        locks: {
          locked: true,
          lockedByRole: UserRole.TEACHER,
          lockedByEmail: 'gps-bth-006.t01@fln.org',
          timestamp: '2026-07-01T09:00:00Z'
        },
        timing: {
          examDate: '2026-07-01',
          printWindowStart: '2026-07-01T09:00:00Z',
          printWindowEnd: '2026-07-01T10:00:00Z',
          examWindowStart: '2026-07-01T10:00:00Z',
          examWindowEnd: '2026-07-01T10:45:00Z',
          submissionWindowEnd: '2026-07-01T11:45:00Z'
        },
        delayLogs: {
          delayedAttemptsCount: 0,
          submittingTeachers: []
        }
      },
      {
        id: 'WS_1006',
        classId: 'c10',
        className: 'Class 3',
        section: 'A',
        schoolId: 'gps-pkl-008',
        generatedByRole: UserRole.TEACHER,
        generatedByEmail: 'gps-pkl-008.t01@fln.org',
        cycle: 'Baseline',
        date: '2026-07-03',
        questions: [
          { ...seedQuestions[3], question_id: 's22_L2_Q2', question: '[For Anika Gupta - Level 12] Pattern completion...' },
          { ...seedQuestions[7], question_id: 's30_L5_Q1', question: '[For Aadhya Iyer - Level 7] Multiplication...' }
        ],
        locks: {
          locked: true,
          lockedByRole: UserRole.TEACHER,
          lockedByEmail: 'gps-pkl-008.t01@fln.org',
          timestamp: '2026-07-03T09:00:00Z'
        },
        timing: {
          examDate: '2026-07-03',
          printWindowStart: '2026-07-03T09:00:00Z',
          printWindowEnd: '2026-07-03T10:00:00Z',
          examWindowStart: '2026-07-03T10:00:00Z',
          examWindowEnd: '2026-07-03T10:45:00Z',
          submissionWindowEnd: '2026-07-03T11:45:00Z'
        },
        delayLogs: {
          delayedAttemptsCount: 0,
          submittingTeachers: []
        }
      },
      {
        id: 'WS_1007',
        classId: 'c2',
        className: 'Class 3',
        section: 'A',
        schoolId: 'gps-mt-001',
        generatedByRole: UserRole.TEACHER,
        generatedByEmail: 'gps-mt-001.t01@fln.org',
        cycle: 'Mid-year',
        date: '2026-07-02',
        questions: [
          { ...seedQuestions[5], question_id: 's20_L4_Q1', question: '[For Pooja Verma - Level 10] Fraction pizza...' },
          { ...seedQuestions[6], question_id: 's24_L4_Q2', question: '[For Tanvi Bhatia - Level 15] Money change...' }
        ],
        locks: {
          locked: true,
          lockedByRole: UserRole.TEACHER,
          lockedByEmail: 'gps-mt-001.t01@fln.org',
          timestamp: '2026-07-02T09:00:00Z'
        },
        timing: {
          examDate: '2026-07-02',
          printWindowStart: '2026-07-02T09:00:00Z',
          printWindowEnd: '2026-07-02T10:00:00Z',
          examWindowStart: '2026-07-02T10:00:00Z',
          examWindowEnd: '2026-07-02T10:45:00Z',
          submissionWindowEnd: '2026-07-02T11:45:00Z'
        },
        delayLogs: {
          delayedAttemptsCount: 0,
          submittingTeachers: []
        }
      }
    ];

    const answerSubmissions: AnswerSubmission[] = [
      {
        id: 'sub_s1_1001',
        worksheetId: 'WS_1001',
        studentId: 's1',
        studentName: 'Amanpreet Singh',
        schoolId: 'gps-mt-001',
        classId: 'c1',
        submittedAt: '2026-06-15T11:10:00Z',
        isDelayed: false,
        answers: { 's1_L1_Q1': '5', 's1_L2_Q1': '7' }
      },
      {
        id: 'sub_s6_1002',
        worksheetId: 'WS_1002',
        studentId: 's6',
        studentName: 'Sandeep Kumar',
        schoolId: 'gps-amb-003',
        classId: 'c4',
        submittedAt: '2026-06-18T11:30:00Z',
        isDelayed: false,
        answers: { 's6_L3_Q1': '5' }
      },
      {
        id: 'sub_s14_1004',
        worksheetId: 'WS_1004',
        studentId: 's14',
        studentName: 'Rajiv Malhotra',
        schoolId: 'gps-lko-005',
        classId: 'c6',
        submittedAt: '2026-06-22T11:20:00Z',
        isDelayed: false,
        answers: { 's14_L3_Q1': '8' }
      },
      {
        id: 'sub_s18_1005',
        worksheetId: 'WS_1005',
        studentId: 's18',
        studentName: 'Kavya Reddy',
        schoolId: 'gps-bth-006',
        classId: 'c7',
        submittedAt: '2026-07-01T11:05:00Z',
        isDelayed: false,
        answers: { 's18_L1_Q1': '5', 's40_L3_Q1': '5', 's28_L4_Q1': '35' }
      },
      {
        id: 'sub_s22_1006',
        worksheetId: 'WS_1006',
        studentId: 's22',
        studentName: 'Anika Gupta',
        schoolId: 'gps-pkl-008',
        classId: 'c10',
        submittedAt: '2026-07-03T11:20:00Z',
        isDelayed: false,
        answers: { 's22_L2_Q2': 'Blue Circle', 's30_L5_Q1': '60' }
      },
      {
        id: 'sub_s20_1007',
        worksheetId: 'WS_1007',
        studentId: 's20',
        studentName: 'Pooja Verma',
        schoolId: 'gps-mt-001',
        classId: 'c2',
        submittedAt: '2026-07-02T11:15:00Z',
        isDelayed: false,
        answers: { 's20_L4_Q1': '3/4', 's24_L4_Q2': '35' }
      }
    ];

    const evaluationReports: EvaluationReport[] = [
      {
        id: 'rep_s1_1001',
        studentId: 's1',
        worksheetId: 'WS_1001',
        score: 100,
        totalQuestions: 2,
        conceptMastery: { 'Number Sense': 'Strong', 'Number Operations': 'Strong' },
        narrative: 'Amanpreet demonstrated absolute competence in counting objects and doing simple addition arithmetic.',
        recommendedLevel: 2,
        timestamp: '2026-06-15T11:15:00Z'
      },
      {
        id: 'rep_s6_1002',
        studentId: 's6',
        worksheetId: 'WS_1002',
        score: 100,
        totalQuestions: 1,
        conceptMastery: { 'Measurement': 'Strong' },
        narrative: 'Sandeep exhibits strong capacity to compute lengths and carry out simple subtraction comparisons.',
        recommendedLevel: 3,
        timestamp: '2026-06-18T11:35:00Z'
      },
      {
        id: 'rep_s14_1004',
        studentId: 's14',
        worksheetId: 'WS_1004',
        score: 100,
        totalQuestions: 1,
        conceptMastery: { 'Patterns': 'Strong' },
        narrative: 'Rajiv displays flawless sequencing and pattern recognition matching Level 3 descriptors.',
        recommendedLevel: 3,
        timestamp: '2026-06-22T11:30:00Z'
      },
      {
        id: 'rep_s18_1005',
        studentId: 's18',
        worksheetId: 'WS_1005',
        score: 67,
        totalQuestions: 3,
        conceptMastery: { 'Number Sense': 'Strong', 'Measurement': 'Strong', 'Money': 'Needs Practice' },
        narrative: 'Kavya shows strength in counting and measurement but needs more practice with money transactions.',
        recommendedLevel: 8,
        timestamp: '2026-07-01T11:15:00Z'
      },
      {
        id: 'rep_s22_1006',
        studentId: 's22',
        worksheetId: 'WS_1006',
        score: 100,
        totalQuestions: 2,
        conceptMastery: { 'Patterns': 'Strong', 'Number Operations': 'Strong' },
        narrative: 'Anika demonstrated flawless pattern recognition and multiplication skills.',
        recommendedLevel: 12,
        timestamp: '2026-07-03T11:25:00Z'
      },
      {
        id: 'rep_s20_1007',
        studentId: 's20',
        worksheetId: 'WS_1007',
        score: 100,
        totalQuestions: 2,
        conceptMastery: { 'Fractions': 'Strong', 'Money': 'Strong' },
        narrative: 'Pooja displays strong conceptual understanding of fractions and monetary calculations.',
        recommendedLevel: 10,
        timestamp: '2026-07-02T11:20:00Z'
      },
      {
        id: 'rep_s24_diag',
        studentId: 's24',
        worksheetId: 'diagnostic',
        score: 5,
        totalQuestions: 6,
        conceptMastery: { 'Number Sense': 'Strong', 'Shapes': 'Strong', 'Fractions': 'Strong' },
        narrative: 'Tanvi performed very well on the diagnostic, demonstrating strong number sense.',
        recommendedLevel: 15,
        recommendedSubLevel: 0,
        timestamp: '2026-07-01T10:00:00Z'
      }
    ];

    const logbook: LogEntry[] = [
      {
        id: 'log1',
        timestamp: '2026-07-05T10:30:00Z',
        schoolId: 'gps-mt-001',
        schoolName: 'GPS Model Town Ludhiana',
        userId: 'u6',
        userEmail: 'gps-mt-001.t01@fln.org',
        userRole: UserRole.TEACHER,
        activityType: 'print',
        status: 'Success',
        details: 'Downloaded printed worksheets for Amanpreet Singh and Simran Kaur'
      },
      {
        id: 'log2',
        timestamp: '2026-07-04T14:15:00Z',
        schoolId: 'gps-vl-002',
        schoolName: 'GPS Rural Village Moga',
        userId: 'u7',
        userEmail: 'vol.rahul@fln.org',
        userRole: UserRole.VOLUNTEER,
        activityType: 'scan',
        status: 'Success',
        details: 'Uploaded evaluation scan sheet for Manpreet Lal (Class 2)'
      },
      {
        id: 'log3',
        timestamp: '2026-07-03T11:00:00Z',
        schoolId: 'gps-amb-003',
        schoolName: 'GPS Cantt Ambala',
        userId: 'u6_amb',
        userEmail: 'gps-amb-003.t01@fln.org',
        userRole: UserRole.TEACHER,
        activityType: 'verify',
        status: 'Success',
        details: 'Onboarded and validated Aadhar details for student Sneha Sharma'
      },
      {
        id: 'log4',
        timestamp: '2026-07-02T09:45:00Z',
        schoolId: 'gps-jai-004',
        schoolName: 'GPS Govind Dev Jaipur',
        userId: 'u6_jai',
        userEmail: 'gps-jai-004.t01@fln.org',
        userRole: UserRole.TEACHER,
        activityType: 'conduct',
        status: 'Success',
        details: 'Completed diagnostic mathematical evaluation of Priya Patel'
      },
      {
        id: 'log5',
        timestamp: '2026-07-01T15:20:00Z',
        schoolId: 'gps-vl-002',
        schoolName: 'GPS Rural Village Moga',
        userId: 'u7_amit',
        userEmail: 'vol.amit@fln.org',
        userRole: UserRole.VOLUNTEER,
        activityType: 'scan',
        status: 'Success',
        details: 'Scanned baseline arithmetic worksheet for student Kabir Mehra'
      },
      {
        id: 'log6',
        timestamp: '2026-07-04T16:30:00Z',
        schoolId: 'gps-lko-005',
        schoolName: 'GPS Hazratganj Lucknow',
        userId: 'u6_lko',
        userEmail: 'gps-lko-005.t01@fln.org',
        userRole: UserRole.TEACHER,
        activityType: 'conduct',
        status: 'Success',
        details: 'Evaluated personalized worksheet patterns for student Rajiv Malhotra'
      },
      {
        id: 'log7',
        timestamp: '2026-07-03T10:15:00Z',
        schoolId: 'gps-lko-005',
        schoolName: 'GPS Hazratganj Lucknow',
        userId: 'u7_sneha',
        userEmail: 'vol.up_sneha@fln.org',
        userRole: UserRole.VOLUNTEER,
        activityType: 'verify',
        status: 'Success',
        details: 'Onboarded and validated Aadhar details for student Neha Agrawal'
      },
      {
        id: 'log8',
        timestamp: '2026-07-04T09:45:00Z',
        schoolId: 'gps-bth-006',
        schoolName: 'GPS Bathinda City',
        userId: 'u6_bth_a',
        userEmail: 'gps-bth-006.t01@fln.org',
        userRole: UserRole.TEACHER,
        activityType: 'conduct',
        status: 'Success',
        details: 'Conducted baseline diagnostic for Class 3 students in Bathinda'
      },
      {
        id: 'log9',
        timestamp: '2026-07-05T15:20:00Z',
        schoolId: 'gps-pkl-008',
        schoolName: 'GPS Panchkula Sector',
        userId: 'u6_pkl_a',
        userEmail: 'gps-pkl-008.t01@fln.org',
        userRole: UserRole.TEACHER,
        activityType: 'scan',
        status: 'Success',
        details: 'Scored and evaluated worksheets for Class 3 students (Anika Gupta, Aadhya Iyer)'
      },
      {
        id: 'log10',
        timestamp: '2026-07-06T08:15:00Z',
        schoolId: 'gps-asr-007',
        schoolName: 'GPS Amritsar Golden',
        userId: 'u7_asr',
        userEmail: 'vol.asr@fln.org',
        userRole: UserRole.VOLUNTEER,
        activityType: 'verify',
        status: 'Success',
        details: 'Onboarded new students Navjot Singh and Harleen Kaur at Amritsar low-strength school'
      },
      {
        id: 'log11',
        timestamp: '2026-07-05T10:00:00Z',
        schoolId: 'gps-jai2-009',
        schoolName: 'GPS Jaipur Rural North',
        userId: 'u6_jai2',
        userEmail: 'gps-jai2-009.t01@fln.org',
        userRole: UserRole.TEACHER,
        activityType: 'conduct',
        status: 'Success',
        details: 'Ran diagnostic assessment for Class 2 students Lakshya Sharma and Ritu Yadav'
      },
      {
        id: 'log12',
        timestamp: '2026-07-06T11:30:00Z',
        schoolId: 'gps-mt-001',
        schoolName: 'GPS Model Town Ludhiana',
        userId: 'u6',
        userEmail: 'gps-mt-001.t01@fln.org',
        userRole: UserRole.TEACHER,
        activityType: 'download',
        status: 'Delayed',
        details: 'SUBMISSION DELAYED: Answers for Gurpreet Singh uploaded after the 1-hour submission window closed.'
      },
      {
        id: 'log13',
        timestamp: '2026-07-06T14:00:00Z',
        schoolId: 'gps-uda-010',
        schoolName: 'GPS Udaipur City',
        userId: 'u6_uda_a',
        userEmail: 'gps-uda-010.t01@fln.org',
        userRole: UserRole.TEACHER,
        activityType: 'print',
        status: 'Success',
        details: 'Printed personalized worksheets for Class 4 students Arush Bhat and others'
      }
    ];

    const tickets: Ticket[] = [
      {
        id: 'tkt1',
        userId: 'u6',
        userEmail: 'gps-mt-001.t01@fln.org',
        userName: 'Ritu Sharma',
        userRole: UserRole.TEACHER,
        type: 'curriculum',
        subject: 'Ambiguous wording in Level 3 patterns question',
        description: 'The shapes used in the patterns question of Level 3 are hard for Class 2 children to identify. Recommend replacing with simpler fruit SVGs.',
        status: 'Open',
        createdAt: '2026-07-04T09:00:00Z'
      },
      {
        id: 'tkt2',
        userId: 'u6_amb',
        userEmail: 'gps-amb-003.t01@fln.org',
        userName: 'Meena Kumari',
        userRole: UserRole.TEACHER,
        type: 'curriculum',
        subject: 'Measurement Level 3 cuts question difficulty',
        description: 'The pencil cutting subtraction is highly appropriate but students need concrete centimeter rulers to visualize better. Can we suggest visual graphics?',
        status: 'Reviewed',
        createdAt: '2026-07-03T14:00:00Z'
      },
      {
        id: 'tkt3',
        userId: 'u6_bth_a',
        userEmail: 'gps-bth-006.t01@fln.org',
        userName: 'Harpreet Kaur',
        userRole: UserRole.TEACHER,
        type: 'general',
        subject: 'Delay in receiving printed worksheets for Bathinda school',
        description: 'The printed worksheets for Class 3 students in Bathinda have not arrived. Please check logistics.',
        status: 'Open',
        createdAt: '2026-07-05T14:30:00Z'
      },
      {
        id: 'tkt4',
        userId: 'u6_pkl_a',
        userEmail: 'gps-pkl-008.t01@fln.org',
        userName: 'Kavita Sharma',
        userRole: UserRole.TEACHER,
        type: 'curriculum',
        subject: 'Level 8 subtraction questions too advanced for Class 2',
        description: 'Some students placed at Level 8 are struggling with subtraction with borrowing. Suggest revisiting the difficulty curve.',
        status: 'Reviewed',
        createdAt: '2026-07-03T11:00:00Z'
      },
      {
        id: 'tkt5',
        userId: 'u7',
        userEmail: 'vol.rahul@fln.org',
        userName: 'Rahul Kumar',
        userRole: UserRole.VOLUNTEER,
        type: 'general',
        subject: 'Volunteer access to diagnostic tools in Moga village',
        description: 'Unable to generate diagnostic worksheets for students at GPS Rural Village Moga. Access restricted.',
        status: 'Open',
        createdAt: '2026-07-06T09:15:00Z'
      }
    ];

    const announcements: Announcement[] = [
      {
        id: 'ann1',
        title: 'Mid-Year Assessment Cycle Starts Next Week',
        message: 'All district coordinators and school principals are requested to complete student rosters and run onboarding diagnostics. The Mid-year paper generation will unlock on July 12th.',
        isUrgent: true,
        authorEmail: 'superadmin@fln.org',
        createdAt: '2026-07-05T12:00:00Z'
      },
      {
        id: 'ann2',
        title: 'Bathinda District Performance Alert',
        message: 'Bathinda district is flagged as lagging with only 38% average certification rate. All block admins must prioritize remedial interventions in low-strength schools.',
        isUrgent: true,
        authorEmail: 'admin.pb@fln.org',
        createdAt: '2026-07-06T08:00:00Z'
      },
      {
        id: 'ann3',
        title: 'New Teacher Onboarding Training Sessions',
        message: 'Virtual training sessions for newly onboarded teachers will be held on July 15-16, 2026. Attendance is mandatory for all teachers from new schools.',
        isUrgent: false,
        authorEmail: 'superadmin@fln.org',
        createdAt: '2026-07-04T10:00:00Z'
      }
    ];

    const interventions: Intervention[] = [
      {
        id: 'int1',
        studentId: 's2',
        studentName: 'Jasmine Kaur',
        teacherId: 'u5',
        teacherName: 'Ritu Sharma',
        schoolId: 'gps-mt-001',
        classId: 'c1',
        className: 'Class 2',
        section: 'A',
        weakCompetencies: ['Shapes', 'Patterns'],
        currentLevel: 8,
        strategyType: 'visual_aids',
        strategyDescription: 'Used flashcards with shape outlines and colour-coded pattern strips. Practised daily for 15 minutes during morning assembly. Jasmine responded well to colour-based matching exercises.',
        duration: '2 weeks',
        startDate: '2026-06-15',
        endDate: '2026-06-29',
        status: 'completed',
        outcome: {
          improved: true,
          previousLevel: 8,
          newLevel: 10,
          improvementDetails: 'Jasmine improved from Level 8 to Level 10. Shapes recognition went from Needs Practice to Satisfactory. Pattern completion improved significantly.',
          assessmentId: 'ws_mid_001',
          detectedAt: '2026-07-02T10:00:00Z'
        },
        isPromoted: true,
        promotedAt: '2026-07-03T08:00:00Z',
        createdAt: '2026-06-15T09:00:00Z'
      },
      {
        id: 'int2',
        studentId: 's5',
        studentName: 'Arjun Verma',
        teacherId: 'u5',
        teacherName: 'Ritu Sharma',
        schoolId: 'gps-mt-001',
        classId: 'c1',
        className: 'Class 2',
        section: 'A',
        weakCompetencies: ['Subtraction', 'Number Sense'],
        currentLevel: 6,
        strategyType: 'manipulatives',
        strategyDescription: 'Used physical counting beads and number blocks for hands-on subtraction practice. Grouped Arjun with two peers for peer learning during math station time.',
        duration: '3 weeks',
        startDate: '2026-06-10',
        status: 'active',
        isPromoted: false,
        createdAt: '2026-06-10T09:00:00Z'
      },
      {
        id: 'int3',
        studentId: 's19',
        studentName: 'Rohan Das',
        teacherId: 'u6_amb',
        teacherName: 'Meena Kumari',
        schoolId: 'gps-amb-003',
        classId: 'c5',
        className: 'Class 3',
        section: 'A',
        weakCompetencies: ['Number Operations', 'Multiplication'],
        currentLevel: 8,
        strategyType: 'game_based',
        strategyDescription: 'Introduced multiplication table songs and number-line hop games. Used a dice-based addition game during break time to reinforce basic operations. Rohan showed high engagement with game-based activities.',
        duration: '2 weeks',
        startDate: '2026-06-20',
        endDate: '2026-07-04',
        status: 'completed',
        outcome: {
          improved: true,
          previousLevel: 8,
          newLevel: 12,
          improvementDetails: 'Rohan jumped from Level 8 to Level 12 (two full levels). Multiplication tables 2-5 mastered. Addition speed improved by 40%.',
          assessmentId: 'ws_mid_003',
          detectedAt: '2026-07-05T10:00:00Z'
        },
        isPromoted: false,
        createdAt: '2026-06-20T09:00:00Z'
      },
      {
        id: 'int4',
        studentId: 's7',
        studentName: 'Simran Kaur',
        teacherId: 'u5',
        teacherName: 'Ritu Sharma',
        schoolId: 'gps-mt-001',
        classId: 'c3',
        className: 'Class 1',
        section: 'A',
        weakCompetencies: ['Number Sense', 'Counting'],
        currentLevel: 4,
        strategyType: 'one_on_one',
        strategyDescription: 'Conducted daily one-on-one counting sessions using real objects (pencils, erasers). Practised number tracing on sandpaper numbers. Focused on building confidence before introducing new concepts.',
        duration: '1 month',
        startDate: '2026-06-01',
        status: 'active',
        isPromoted: false,
        createdAt: '2026-06-01T09:00:00Z'
      }
    ];

    const bestPractices: BestPractice[] = [
      {
        id: 'bp1',
        interventionId: 'int1',
        teacherId: 'u5',
        teacherName: 'Ritu Sharma',
        schoolId: 'gps-mt-001',
        weakCompetencies: ['Shapes', 'Patterns'],
        strategyType: 'visual_aids',
        strategyDescription: 'Used flashcards with shape outlines and colour-coded pattern strips. Practised daily for 15 minutes during morning assembly. Responded well to colour-based matching exercises.',
        levelBefore: 8,
        levelAfter: 10,
        levelJump: 2,
        duration: '2 weeks',
        tags: ['Shapes', 'Patterns', 'Visual Learning', 'Preschool 3', 'Class 1', 'Quick Win'],
        viewCount: 12,
        createdAt: '2026-07-03T08:00:00Z'
      }
    ];

    return {
      users,
      schools,
      classes,
      students,
      questions: seedQuestions,
      worksheets,
      levelWorksheets: [],
      levelHtmlTemplates: [],
      questionBank: [],
      answerSubmissions,
      evaluationReports,
      tickets,
      logbook,
      announcements,
      interventions,
      bestPractices,
      diagnosticAnswerKeys: [],
      misconceptionClusters: [],
      testHistory: [],
      // Seeded empty on purpose: question logics are pedagogy authored by a real
      // Superadmin, and inventing demo ones would put fabricated curriculum
      // intent in front of the question-generation pipeline.
      questionLogics: [],
      questionTemplates: [],
      questionOptions: [],
      // Populated by `npm run seed:levels`, not by the demo seed — the
      // curriculum is real data with one source, not fixture content.
      curriculumLevels: [],
      studentCycleLocks: []
    };
  }
}

export const dbStore = new DBStore();
