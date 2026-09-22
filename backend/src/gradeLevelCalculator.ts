/**
 * gradeLevelCalculator.ts
 *
 * Deterministic FLN progression logic.
 *
 * This module is intentionally independent of:
 * - Gemini / AI
 * - Express routes
 * - Database operations
 *
 * Gemini evaluates the student's answers.
 * This module determines the resulting FLN level/sub-level.
 */

export interface AdvancementResult {
  newLevel: number;
  newSubLevel: number;
}

export interface EvaluatedQuestion {
  id: string;
  level: number;
  isCorrect: boolean;
}

/**
 * Calculate the student's next level for a standard worksheet.
 *
 * Current progression rule:
 * - 80% or more  -> advance by one level
 * - below 80%    -> remain at current level
 *
 * Sub-level:
 * - all questions correct -> Mastery (0)
 * - some questions wrong  -> Easier (1)
 * - all questions wrong   -> Remedial (2)
 *
 * The level is capped at 59, matching the existing progression logic.
 */
export function calculateStandardAdvancement(
  currentLevel: number,
  totalQuestions: number,
  correctQuestions: number
): AdvancementResult {
  if (totalQuestions <= 0) {
    return {
      newLevel: currentLevel,
      newSubLevel: 2,
    };
  }

  const safeCorrectQuestions = Math.max(
    0,
    Math.min(correctQuestions, totalQuestions)
  );

  const score = safeCorrectQuestions / totalQuestions;

  let newLevel = currentLevel;

  if (score >= 0.8) {
    newLevel = Math.min(59, currentLevel + 1);
  }

  let newSubLevel: number;

  if (safeCorrectQuestions === totalQuestions) {
    // Mastery
    newSubLevel = 0;
  } else if (safeCorrectQuestions === 0) {
    // Remedial
    newSubLevel = 2;
  } else {
    // Easier
    newSubLevel = 1;
  }

  return {
    newLevel,
    newSubLevel,
  };
}

/**
 * Determine the diagnostic baseline level.
 *
 * Diagnostic worksheets contain questions from multiple FLN levels.
 *
 * The existing diagnostic approach uses the weakest-level mapping:
 * the baseline is determined from the lowest level at which the student
 * demonstrates a failure.
 *
 * If every diagnostic question is answered correctly, the baseline is
 * the highest tested level.
 */
export function calculateDiagnosticBaseline(
  evaluatedQuestions: EvaluatedQuestion[]
): number {
  if (evaluatedQuestions.length === 0) {
    return 1;
  }

  const sortedQuestions = [...evaluatedQuestions].sort(
    (a, b) => a.level - b.level
  );

  const failedQuestion = sortedQuestions.find(
    (question) => !question.isCorrect
  );

  if (failedQuestion) {
    return failedQuestion.level;
  }

  return sortedQuestions[sortedQuestions.length - 1].level;
}