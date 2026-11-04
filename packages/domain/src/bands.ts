/**
 * Result bands for one concept, decided with the curriculum reviewer (Oct 2026):
 * five questions per concept, one mark each (1 correct, 0 not), score 0 to 5.
 * Emerging 0-1, Developing 2-3, Secure 4-5; the same for every concept.
 * Prompts and support are recorded separately from the mark (see ObservationCode).
 */
export const QUESTIONS_PER_CONCEPT = 5;
export const BAND_RULE_VERSION = 'v2-five-item-bands';

export type Band = 'Emerging' | 'Developing' | 'Secure';
export type ConceptStatus = Band | 'Not yet assessed';

/** How a child answered an observed item, separate from the 1/0 mark. */
export const OBSERVATION_CODES = ['Independent', 'Prompted', 'Supported', 'Strategy'] as const;
export type ObservationCode = (typeof OBSERVATION_CODES)[number];

/** Strategy a child used when the code is Strategy. */
export const STRATEGY_USED = ['counts all', 'counts on', 'fingers', 'guess'] as const;
export type StrategyUsed = (typeof STRATEGY_USED)[number];

export function bandFromScore(score: number): Band {
  if (!Number.isInteger(score) || score < 0 || score > QUESTIONS_PER_CONCEPT) {
    throw new RangeError(`score must be a whole number from 0 to ${QUESTIONS_PER_CONCEPT}, got ${score}`);
  }
  if (score <= 1) return 'Emerging';
  if (score <= 3) return 'Developing';
  return 'Secure';
}

export interface ConceptResult {
  status: ConceptStatus;
  score: number | null;
  evidenceCount: number;
  ruleVersion: string | null;
}

/**
 * Summarise the marks for one concept. Fewer than five marks is still a result
 * (the evidence count says how many), but no marks at all is "Not yet assessed",
 * never Emerging. More than five marks is refused rather than quietly trimmed.
 */
export function summariseConcept(marks: readonly boolean[]): ConceptResult {
  if (marks.length > QUESTIONS_PER_CONCEPT) {
    throw new RangeError(`a concept has at most ${QUESTIONS_PER_CONCEPT} marks, got ${marks.length}`);
  }
  if (marks.length === 0) {
    return { status: 'Not yet assessed', score: null, evidenceCount: 0, ruleVersion: null };
  }
  const score = marks.filter(Boolean).length;
  return { status: bandFromScore(score), score, evidenceCount: marks.length, ruleVersion: BAND_RULE_VERSION };
}
