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
  stateCode?: string;
  districtCode?: string;
  blockCode?: string;
  schoolId?: string;
  assignedSchools?: string[];
  delayedAttemptsCount?: number;
  isBanned?: boolean;
}

export type MfaFactorLifecycleState = 'PENDING_ENROLLMENT' | 'ENROLLED';

export interface MfaFactor {
  factorId: string;
  label: string;
  algorithm: string;
  digits: number;
  period: number;
  status: 'active' | 'revoked';
  lifecycleState: MfaFactorLifecycleState;
  createdAt: string;
  lastUsedAt: string | null;
  verifyAttempts: number;
}

export interface School {
  id: string;
  name: string;
  stateCode: string;
  districtCode: string;
  blockCode: string;
  strength?: string;
  teachersCount: number;
  isAccessLocked?: boolean;
}

export interface ClassGroup {
  id: string;
  schoolId: string;
  className: string;
  section: string;
  teacherId: string;
}

export interface Student {
  id: string;
  name: string;
  age: number;
  classGroup: string;
  section: string;
  schoolId: string;
  teacherId?: string;
  currentLevel: number | null;
  currentSubLevel?: number | null;
  targetLevel: number | null;
  aadharMasked: string;
  // Clean numeric ID for teacher-facing display — use this instead of `id`
  // anywhere a teacher/principal/admin sees a student ID (roster, profile,
  // printed worksheets). Falls back to `id` only for older records that
  // predate this field.
  displayId?: string;
  levelHistory: { level: number; subLevel?: number; date: string; reason: string }[];
  streak: number;
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
  source_level: number;
  svgAsset?: string;
}

export interface Worksheet {
  id: string;
  classId: string;
  className: string;
  section: string;
  schoolId: string;
  generatedByRole: UserRole;
  generatedByEmail: string;
  cycle: 'Baseline' | 'Mid-year' | 'End-of-year';
  date: string;
  questions: Question[];
  studentIds?: string[];
  locks: {
    locked: boolean;
    lockedByRole: UserRole | null;
    lockedByEmail: string | null;
    timestamp: string | null;
  };
  timing: {
    examDate: string;
    printWindowStart: string;
    printWindowEnd: string;
    examWindowStart: string;
    examWindowEnd: string;
    submissionWindowEnd: string;
  };
  delayLogs: {
    delayedAttemptsCount: number;
    submittingTeachers: string[];
  };
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
  answers: { [questionId: string]: string };
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
  narrative: string;
  recommendedLevel: number;
  recommendedSubLevel?: number;
  timestamp: string;
  reasoning?: EvaluationReasoning;
  // Issue #180: per-question breakdown, present on reports created after
  // that feature landed. Optional — older reports predate it.
  questionResults?: { questionId: string; question?: string; correctAnswer?: string; submittedAnswer: string; isCorrect: boolean }[];
    teacherReviewed?: boolean;
    reviewedBy?: string;
    reviewedAt?: string;
    // Per-level pass/fail breakdown — populated by the diagnostic submit handler
    // (backend/src/routes/students.ts). Diagnostic does NOT assign a placement
    // level; the UI uses these to show which levels were demonstrated vs which
    // need remediation.
    passedLevels?: number[];
    failedLevels?: number[];
    // Skills the student is struggling with — conceptIds of the failed levels
    // plus any direct prerequisites, sourced from the cross-skill graph
    // (backend/src/competencyPrerequisites.ts). Drives the status text in the
    // diagnostic panel instead of the old hardcoded "Verified & Certified".
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
  activityType: 'download' | 'print' | 'conduct' | 'scan' | 'verify' | 'ticket';
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

export interface DashboardProps {
  user: User;
  token: string;
}

/**
 * A Superadmin-authored instruction describing what to ask at a given level.
 * Mirrors `QuestionLogic` in `backend/src/db.ts`.
 */
export interface QuestionLogic {
  id: string;
  level: number;
  levelName: string;
  skills: string[];
  subskills: string[];
  logicText: string;
  taxonomy: '3-type' | '4-type';
  createdBy: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  updatedByEmail: string;
  deletedAt: string | null;
  deletedBy: string | null;
}

export interface QuestionLogicStats {
  totalLogics: number;
  totalLevels: number;
  levelsWithLogic: number;
}

/**
 * A Superadmin-authored question: the stem a child reads, how the answer is
 * recorded, and the constraints governing the numbers inside it.
 * Mirrors `QuestionTemplate` in `backend/src/db.ts`.
 */
export interface QuestionTemplate {
  id: string;
  /** Canonical curriculum identity, e.g. "S3.4". Level number is a display alias. */
  conceptId: string;
  levelNumber: number;
  levelName: string;
  skills: string[];
  subskills: string[];
  /** What the question should make the child do. An instruction, not a finished question. */
  generationIntent: string;
  questionFamily: 'counting' | 'operation';
  paramMode: 'structured' | 'legacy-free-text' | 'hybrid';
  /** Ids into the SVG manifest. The artwork lives in files, not in the database. */
  svgThemeIds: string[];
  /** LEGACY, read-only. Present so pre-intent rows are not lost. */
  stem: string;
  /** LEGACY, read-only. Structured rows never carry an authored answer. */
  answerSpec: string;
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
  name: string;
  variantKey: string;
  tags: string[];
  source: 'form' | 'csv';
  createdBy: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  updatedByEmail: string;
  deletedAt: string | null;
  deletedBy: string | null;
}

/** The structured half of a template, as the form holds it before saving. */
export interface QuestionTemplateParams {
  numeralRange: string | null;
  digitCount: string | null;
  operations: string[];
  maxOperandCount: number | null;
  carryBehavior: string | null;
  borrowBehavior: string | null;
  maxSumOrDifference: string | null;
  answerType: string | null;
  blankCount: number | null;
  questionCount: number | null;
  subjectCategory: string | null;
}

export interface QuestionTemplateStats {
  totalTemplates: number;
  totalLevels: number;
  levelsWithTemplate: number;
  distinctVariants: number;
}

/**
 * Payload of `GET /api/question-templates/param-catalog`.
 *
 * The form renders its controls from this rather than from a hardcoded list,
 * so adding a legal value later is a backend-only change.
 */
export interface SvgTheme {
  id: string;
  label: string;
  variants: Array<{ variantId: string; file: string }>;
  supportedAnswerShapes: string[];
  printSafe: boolean;
  viewBox: string;
}

export interface QuestionOption {
  id: string;
  type: 'numeral-range' | 'operation' | 'svg-theme';
  key: string;
  label: string;
  min?: number;
  max?: number;
  implementationStatus: 'ready' | 'not-ready';
  active: boolean;
  deprecated?: boolean;
}

export interface ParamCatalog {
  numeralRange: string[];
  deprecatedNumeralRange?: string[];
  questionFamily?: string[];
  svgThemes?: SvgTheme[];
  generationIntent?: { minChars: number; maxChars: number };
  maxSvgThemes?: number;
  digitCount: string[];
  operations: string[];
  carryBehavior: string[];
  borrowBehavior: string[];
  maxSumOrDifference: string[];
  maxOperandCount: number[];
  answerType: string[];
  subjectCategory: string[];
  blankCount: { min: number; max: number };
  questionCount: { min: number; max: number; default: number };
  contextRules: Record<string, { requiresOperation?: string; requiresAnyOperation?: string[]; requiresAnswerType?: string }>;
}

/** Result of `POST /api/question-templates/import`, for both the dry run and the real one. */
export interface ImportResult {
  dryRun?: boolean;
  imported: number;
  rowsRead: number;
  wouldImport?: number;
  errors: Array<{ row: number; error: string }>;
  error?: string;
  repeatedInFile?: Array<{ variantKey: string; count: number }>;
  alreadyExists?: string[];
  preview?: Array<{ conceptId: string; name: string; stem: string }>;
}

/** Payload of `GET /api/question-logics/level-map` — drives the cascading dropdowns. */
export interface LevelMapPayload {
  levelCount: number;
  levels: Array<{
    levelId: string;
    levelNumber: number;
    capability: string;
    stage: string;
    sCode: string;
    skills: string[];
  }>;
  skills: Array<{
    id: string;
    name: string;
    domain: string;
    subskills: Array<{ id: string; name: string }>;
  }>;
}


/**
 * Whether a curriculum level's worksheets can be produced today.
 * Mirrors LevelContentStatus in backend/src/routes/curriculum.ts — three
 * states because "not yet mapped to the 59-space worksheet engine" is not the
 * same claim as "measured, and there is no content".
 */
export type LevelContentStatus = 'ready' | 'no-content' | 'unmapped';

/** One row of the 93-level curriculum, as served by /api/curriculum/levels. */
export interface CurriculumLevel {
  conceptId: string;
  levelNumber: number;
  sCode: string;
  legacyLevel59: number | null;
  stage: string;
  capability: string;
  strand: string;
  primarySkills: string[];
  supportingSkills: string[];
  subskills: string[];
  hasStaticHtml: boolean;
  hasBuilder: boolean;
  curriculumVersion: string;
  createdAt: string;
  updatedAt: string;
  contentStatus: LevelContentStatus;
}

/** Summary served by /api/curriculum/coverage. */
export interface CurriculumCoverage {
  totalLevels: number;
  withStaticHtml: number;
  withBuilder: number;
  withAnyContent: number;
  mappedFromLegacy59: number;
  byStatus: Record<LevelContentStatus, number>;
  /** False while no level has a legacyLevel59 — i.e. the crosswalk has not landed. */
  crosswalkLanded: boolean;
}

/** Review state of one question in the bank. */
export type QuestionReviewStatus = 'untagged' | 'mapped' | 'retired';

export interface QuestionBankEntry {
  questionId: string;
  level: number;
  levelTitle: string;
  section: string;
  sectionType: string;
  questionNumber: number;
  questionText: string;
  answer: string;
  svgHtml: string;
  mappedLevel?: number | null;
  conceptId?: string;
  reviewStatus?: QuestionReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface QuestionBankProgress {
  total: number;
  mapped: number;
  retired: number;
  untagged: number;
  legacyLevelsInBank: number[];
  targetLevelsCovered: number[];
  byLevel: Array<{ level: number; total: number; mapped: number; retired: number }>;
}

/** A retired-numbering level with no stored questions — mapped whole, not per question. */
export interface LegacyLevelRow {
  legacyId: number;
  hasQuestions: boolean;
  mappedLevel: number | null;
  mappedCapability: string | null;
}
