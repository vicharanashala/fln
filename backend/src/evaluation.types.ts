// Domain types: evaluation, reasoning and grading reports.

import type { ScanQualityResult } from './scanQuality';

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
  scanQuality?: ScanQualityResult;
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
