/**
 * Pure eligibility-decision engine for SRS R-7.
 *
 * No I/O. No database access. No logging. Just: given a list of mandatory
 * competency requirements and the latest conceptMastery verdict for a student,
 * return one of three outcomes.
 *
 * OUTCOME PRECEDENCE (load-bearing — do not reorder):
 *   1. insufficient_evidence — at least one mandatory topic has no verdict at all.
 *      The system has not tested the student on that topic; reporting it as
 *      "missing" would be a false negative schools can do nothing about.
 *   2. not_eligible — at least one mandatory topic was tested and is below
 *      the `meetsThreshold` declared on its requirement.
 *   3. eligible — every mandatory topic was tested AND meets its threshold.
 *
 * MASTERY COMPARISON:
 *   Strong > Satisfactory > Needs Practice
 *   A requirement with meetsThreshold='Satisfactory' is met by either
 *   'Satisfactory' or 'Strong'. A requirement with meetsThreshold='Strong'
 *   is met ONLY by 'Strong'.
 *
 * The caller MUST pre-filter to isMandatory=true; this engine does not.
 */
import {
  ICompetencyRequirement,
  MasteryLevel,
} from '../../../interfaces/competency/competency.interface';

export type EligibilityOutcome =
  | 'eligible'
  | 'not_eligible'
  | 'insufficient_evidence';

export interface EligibilityDecision {
  outcome: EligibilityOutcome;
  evaluatedAt: string;
  classNumber: number;
  level: number;
  metTopics: string[];
  missingTopics: string[];
  unassessedTopics: string[];
}

const MASTERY_RANK: Record<MasteryLevel, number> = {
  Strong: 2,
  Satisfactory: 1,
  'Needs Practice': 0,
};

function meetsThreshold(observed: MasteryLevel, required: MasteryLevel): boolean {
  return MASTERY_RANK[observed] >= MASTERY_RANK[required];
}

export function decideEligibility(
  requirements: ICompetencyRequirement[],
  conceptMastery: Record<string, MasteryLevel>,
  evaluatedAt: string
): EligibilityDecision {
  const metTopics: string[] = [];
  const missingTopics: string[] = [];
  const unassessedTopics: string[] = [];

  // Assume single (classNumber, level) bucket — caller should pre-filter.
  const classNumber = requirements[0]?.classNumber ?? 0;
  const level = requirements[0]?.level ?? 0;

  for (const req of requirements) {
    const observed = conceptMastery[req.topic];
    if (observed === undefined) {
      unassessedTopics.push(req.topic);
    } else if (meetsThreshold(observed, req.meetsThreshold)) {
      metTopics.push(req.topic);
    } else {
      missingTopics.push(req.topic);
    }
  }

  let outcome: EligibilityOutcome;
  if (unassessedTopics.length > 0) {
    outcome = 'insufficient_evidence';
  } else if (missingTopics.length > 0) {
    outcome = 'not_eligible';
  } else {
    outcome = 'eligible';
  }

  return {
    outcome,
    evaluatedAt,
    classNumber,
    level,
    metTopics,
    missingTopics,
    unassessedTopics,
  };
}