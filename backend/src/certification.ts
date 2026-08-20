/**
 * Pure eligibility-decision engine for SRS R-7 — LEGACY backend mirror.
 *
 * Kept behaviorally identical to
 * backend/src/modules/certification/services/eligibility.service.ts so the
 * two backends cannot drift in their certification verdicts.
 *
 * See that file for the full spec on outcome precedence and mastery ranking.
 */
import {
  CompetencyRequirement,
  MasteryLevel,
} from './db';

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
  requirements: CompetencyRequirement[],
  conceptMastery: Record<string, MasteryLevel>,
  evaluatedAt: string
): EligibilityDecision {
  const metTopics: string[] = [];
  const missingTopics: string[] = [];
  const unassessedTopics: string[] = [];

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