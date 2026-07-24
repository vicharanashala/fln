/**
 * Concept Mastery Profile — cumulative per-student, per-concept tracking.
 *
 * Unlike the one-shot `EvaluationReport.conceptMastery`, this structure
 * evolves over time and is used by the reinforcement engine to decide
 * which concepts need extra practice.
 */

export interface ConceptScore {
  /** Math topic (e.g. "Number Sense", "Shapes", "Fractions") */
  topic: string;
  /** Total questions attempted on this topic across all assessments */
  totalAttempts: number;
  /** Total correct answers across all assessments */
  correctCount: number;
  /** Rolling mastery percentage (0-100), weighted toward recent results */
  masteryPct: number;
  /** Derived status from masteryPct */
  status: 'Strong' | 'Satisfactory' | 'Needs Practice';
  /** ISO date of last assessment that included this topic */
  lastAssessedAt: string;
  /**
   * How many consecutive assessments the status has been 'Strong'.
   * Once this reaches MASTERY_CONSECUTIVE_THRESHOLD (2), the concept
   * is considered fully mastered and reinforcement stops.
   */
  consecutiveMasteryCount: number;
  // --- Adaptive Reinforcement Fields ---
  recentAnswers?: { level: number; correct: boolean }[];
  reinforcementTriggeredAtLevel?: number;
  isReinforcementActive?: boolean;
  consecutiveReinforcementMasteryCount?: number;
  reinforcedQuestionIds?: string[];
  reinforcementCyclesCompleted?: number;
}

export interface ConceptMasteryProfile {
  id: string;
  studentId: string;
  concepts: ConceptScore[];
  updatedAt: string;
}

// ── Thresholds ──────────────────────────────────────────────────────

/** Percentage at or above which a concept is considered "Strong" */
export const STRONG_THRESHOLD = 80;

/** Percentage at or above which a concept is "Satisfactory" (below Strong) */
export const SATISFACTORY_THRESHOLD = 50;

/**
 * How many consecutive assessments a concept must remain "Strong"
 * before reinforcement questions are permanently dropped.
 */
export const MASTERY_CONSECUTIVE_THRESHOLD = 2;

// ── Reinforcement question counts per weakness tier ─────────────────

/** Reinforcement questions for concepts with mastery ≤50%. */
export const REINF_COUNT_WEAK = 2;

/** Reinforcement questions for concepts with mastery 51-75%. */
export const REINF_COUNT_MODERATE = 1;

/** Fixed worksheet size — total questions per worksheet, never more. */
export const WORKSHEET_QUESTION_COUNT = 4;

/** Maximum reinforcement questions that can replace normal questions in one worksheet. */
export const MAX_REINFORCEMENT_PER_WORKSHEET = 2;

/**
 * Weight given to the latest assessment when computing the rolling
 * mastery percentage.  The remaining weight goes to the lifetime
 * average.  A value of 0.6 means 60 % latest, 40 % historical.
 */
export const ROLLING_WEIGHT_LATEST = 0.6;
