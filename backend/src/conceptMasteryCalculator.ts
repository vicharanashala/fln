/**
 * conceptMasteryCalculator.ts
 *
 * Deterministic concept-mastery calculation.
 *
 * This module is intentionally independent of:
 * - Gemini / AI
 * - Express routes
 * - Database operations
 *
 * Gemini is responsible for evaluating individual question correctness.
 * This module converts those results into a standardized mastery level
 * for each concept/topic.
 */

export type ConceptMastery =
  | 'Strong'
  | 'Satisfactory'
  | 'Needs Practice';

export interface ConceptQuestionResult {
  topic: string;
  isCorrect: boolean;
}

/**
 * Calculate mastery for a single concept.
 *
 * Mastery thresholds:
 * - 95%–100%  -> Strong
 * - 60%–<95%  -> Satisfactory
 * - <60%      -> Needs Practice
 */
export function calculateConceptMastery(
  correctQuestions: number,
  totalQuestions: number
): ConceptMastery {
  if (totalQuestions <= 0) {
    return 'Needs Practice';
  }

  const safeCorrectQuestions = Math.max(
    0,
    Math.min(correctQuestions, totalQuestions)
  );

  const score =
    (safeCorrectQuestions / totalQuestions) * 100;

  if (score >= 95) {
    return 'Strong';
  }

  if (score >= 60) {
    return 'Satisfactory';
  }

  return 'Needs Practice';
}

/**
 * Calculate concept mastery for all topics represented in
 * the evaluated question results.
 *
 * Questions are grouped by topic and evaluated independently.
 *
 * The result is deterministic and does not depend on:
 * - question ordering
 * - Gemini-generated mastery labels
 * - database state
 */
export function calculateConceptMastery(
  evaluatedQuestions: ConceptQuestionResult[]
): Record<string, ConceptMastery> {
  const topicResults: Record<
    string,
    { correct: number; total: number }
  > = {};

  for (const question of evaluatedQuestions) {
    const topic = question.topic.trim() || 'General Mathematics';

    if (!topicResults[topic]) {
      topicResults[topic] = {
        correct: 0,
        total: 0,
      };
    }

    topicResults[topic].total += 1;

    if (question.isCorrect) {
      topicResults[topic].correct += 1;
    }
  }

  const conceptMastery: Record<string, ConceptMastery> = {};

  for (const [topic, result] of Object.entries(topicResults)) {
    conceptMastery[topic] = calculateConceptMastery(
      result.correct,
      result.total
    );
  }

  return conceptMastery;
}