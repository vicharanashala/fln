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
  reinforcementLevelsCompleted?: number;
  reinforcementStartLevel?: number;
  needsTeacherIntervention?: boolean;
  /**
   * Tracks whether reinforcement was skipped on the last worksheet for
   * this concept. Used to implement "alternate worksheet" frequency
   * for the 40–69% mastery band.
   */
  lastReinforcementSkipped?: boolean;
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
 * Mastery stop threshold for reinforcement.
 * When a concept's mastery reaches ≥80%, reinforcement stops.
 */
export const REINFORCEMENT_MASTERY_THRESHOLD = 80;

/** Maximum consecutive reinforcement cycles allowed for a weak concept (max 3) */
export const MAX_REINFORCEMENT_LEVELS = 3;

/**
 * How many consecutive assessments a concept must remain "Strong"
 * before reinforcement questions are permanently dropped.
 */
export const MASTERY_CONSECUTIVE_THRESHOLD = 2;

// ── Reinforcement frequency bands ───────────────────────────────────

/** Below this mastery percentage → reinforce EVERY worksheet */
export const REINF_EVERY_WORKSHEET_THRESHOLD = 40;

/** Below this mastery percentage (but ≥ REINF_EVERY_WORKSHEET_THRESHOLD) → reinforce every ALTERNATE worksheet. Score ≥ 80% is Mastered (Stop). */
export const REINF_ALTERNATE_WORKSHEET_THRESHOLD = 80;

// ── Worksheet composition ───────────────────────────────────────────

/** Total questions per worksheet (normal + reinforcement always sums to 5) */
export const WORKSHEET_TOTAL_QUESTIONS = 5;

/** Maximum reinforcement questions per worksheet (top 3 weakest concepts) */
export const MAX_REINFORCEMENT_PER_WORKSHEET = 3;

// ── Legacy aliases (kept for backward compatibility) ────────────────

/** @deprecated Use dynamic composition rules instead */
export const REINF_COUNT_WEAK = 1;

/** @deprecated Use dynamic composition rules instead */
export const REINF_COUNT_MODERATE = 1;

/** @deprecated Use WORKSHEET_TOTAL_QUESTIONS instead */
export const WORKSHEET_QUESTION_COUNT = 5;

/**
 * Weight given to the latest assessment when computing the rolling
 * mastery percentage.  The remaining weight goes to the lifetime
 * average.  A value of 0.6 means 60 % latest, 40 % historical.
 */
export const ROLLING_WEIGHT_LATEST = 0.6;
