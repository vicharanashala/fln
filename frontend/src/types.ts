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

