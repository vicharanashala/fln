/**
 * Adaptive Engine — Deterministic Rule-Based Implementation
 *
 * This is the default engine. It needs no API keys, no LLM calls, and no
 * external services. Its job is to:
 *
 *  1. Read the student's profile + evaluation history (via the analyzer).
 *  2. Compose a worksheet that targets weak competencies primarily, with
 *     reinforcement at the current level and a few challenge questions
 *     above the current level.
 *
 * An LLM-backed engine can later satisfy the same AdaptiveEngine
 * interface; the rest of the system does not need to change.
 */

import { generateQuestionsForLevel } from '../../levelGenerator';
import type { Question } from '../../db';
import type {
  AdaptiveEngine,
  AdaptiveQuestionMeta,
  AdaptiveWorksheet,
  CompetencyProfile,
  StudentContext
} from './types';
import { analyzeStudent } from './analyzer';

const MIN_LEVEL = 1;
const MAX_LEVEL = 59;
const DEFAULT_TOTAL_QUESTIONS = 12;

function clampLevel(level: number, baseline: number): number {
  const candidate = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, level));
  // Never let challenge questions go more than +6 levels above the student's
  // current baseline — keeps the worksheet in their ZPD.
  return Math.min(candidate, baseline + 6);
}

function pickQuestionsForLevel(
  level: number,
  subLevel: number,
  topic: string | undefined,
  count: number
): Question[] {
  const pool = generateQuestionsForLevel(level, subLevel);
  if (!topic) return pool.slice(0, count);
  const matched = pool.filter(q => q.topic === topic);
  const rest = pool.filter(q => q.topic !== topic);
  return [...matched, ...rest].slice(0, count);
}

/**
 * Build a varied pool by spanning several levels below / above the
 * baseline so we don't get 12 copies of the same question. Levels are
 * walked in order, and within each level questions are rotated by index.
 */
function buildRotatedPool(
  startLevel: number,
  endLevel: number,
  step: 1 | -1,
  subLevel: number,
  topic: string | undefined,
  count: number
): Question[] {
  const collected: Question[] = [];
  const levels: number[] = [];
  if (step === -1) {
    for (let l = startLevel; l >= endLevel; l--) levels.push(l);
  } else {
    for (let l = startLevel; l <= endLevel; l++) levels.push(l);
  }
  for (const lvl of levels) {
    if (collected.length >= count) break;
    const pool = generateQuestionsForLevel(lvl, subLevel);
    if (pool.length === 0) continue;
    const rotationOffset = collected.length % pool.length;
    const ordered = pool.slice(rotationOffset).concat(pool.slice(0, rotationOffset));
    const filtered = topic ? ordered.filter(q => q.topic === topic) : ordered;
    for (const q of filtered) {
      if (collected.length >= count) break;
      collected.push({ ...q, source_level: lvl });
    }
  }
  return collected.slice(0, count);
}

function distributeCount(total: number, profile: CompetencyProfile) {
  const { weak, reinforcement, challenge } = profile.focusDistribution;
  const weakCount = Math.round(total * weak);
  const reinforceCount = Math.round(total * reinforcement);
  const challengeCount = total - weakCount - reinforceCount;
  return {
    remediation: weakCount,
    reinforcement: reinforceCount,
    challenge: Math.max(0, challengeCount)
  };
}

export class DeterministicAdaptiveEngine implements AdaptiveEngine {
  readonly kind = 'deterministic' as const;

  async analyze(ctx: StudentContext): Promise<CompetencyProfile> {
    return analyzeStudent(ctx, 'deterministic');
  }

  async composeWorksheet(
    ctx: StudentContext,
    profile: CompetencyProfile,
    options: { totalQuestions?: number } = {}
  ): Promise<AdaptiveWorksheet> {
    const student = ctx.student;
    const baseLevel = profile.currentLevel || student.currentLevel || 1;
    const baseSubLevel = profile.currentSubLevel || student.currentSubLevel || 0;
    const total = Math.max(4, Math.min(40, options.totalQuestions ?? DEFAULT_TOTAL_QUESTIONS));

    const distribution = distributeCount(total, profile);

    let remediationQuestions: Array<Question & { adaptive: AdaptiveQuestionMeta }> = [];
    let reinforcementQuestions: Array<Question & { adaptive: AdaptiveQuestionMeta }> = [];
    let challengeQuestions: Array<Question & { adaptive: AdaptiveQuestionMeta }> = [];

    if (!profile.hasHistory || profile.weakCompetencies.length === 0) {
      // Fallback: grade-aligned worksheet at current level + remediation below
      const remedialCount = Math.round(total * 0.5);
      const currentCount = total - remedialCount;
      const remedialTarget = clampLevel(baseLevel - 1, baseLevel);
      const remedialQs = buildRotatedPool(
        remedialTarget,
        clampLevel(baseLevel - 3, baseLevel),
        -1,
        2,
        undefined,
        remedialCount
      );
      const currentQs = buildRotatedPool(
        baseLevel,
        baseLevel,
        1,
        baseSubLevel,
        undefined,
        currentCount
      );
      remediationQuestions = remedialQs.map((q, i) => ({
        ...q,
        question_id: `ADAPTIVE_${student.id}_remediation_${i}_${q.question_id}`,
        adaptive: {
          purpose: 'remediation' as const,
          competency: q.topic,
          targetLevel: q.source_level,
          targetSubLevel: 2
        }
      }));
      reinforcementQuestions = currentQs.map((q, i) => ({
        ...q,
        question_id: `ADAPTIVE_${student.id}_reinforcement_${i}_${q.question_id}`,
        adaptive: {
          purpose: 'reinforcement' as const,
          competency: q.topic,
          targetLevel: q.source_level,
          targetSubLevel: baseSubLevel
        }
      }));
    } else {
      // 60% weak: walk several levels below baseline. Start with subLevel 2
      // (remedial); if we still need more, fall back to subLevel 1 (easier)
      // at the same levels. Rotation per level avoids the Q1-twelve-times
      // problem. Each picked question is tagged with one of the weak
      // competencies in round-robin so the worksheet surface area shows
      // *which* gap it targets.
      const weakTopics = profile.weakCompetencies;
      const lowestRemedial = clampLevel(baseLevel - 5, baseLevel);
      const highestRemedial = clampLevel(baseLevel - 1, baseLevel);
      let remediationPool: Question[] = buildRotatedPool(
        highestRemedial,
        lowestRemedial,
        -1,
        2,
        undefined,
        distribution.remediation
      );
      if (remediationPool.length < distribution.remediation) {
        const extra = buildRotatedPool(
          highestRemedial,
          lowestRemedial,
          -1,
          1,
          undefined,
          distribution.remediation - remediationPool.length
        );
        remediationPool = remediationPool.concat(extra);
      }
      remediationQuestions = remediationPool.map((q, i) => ({
        ...q,
        question_id: `ADAPTIVE_${student.id}_remediation_${i}_${q.question_id}`,
        adaptive: {
          purpose: 'remediation' as const,
          competency: weakTopics[i % Math.max(1, weakTopics.length)] || q.topic,
          targetLevel: q.source_level,
          targetSubLevel: 2
        }
      }));

      // 20% reinforcement: current level + the next level up at the
      // student's current subLevel so we get a varied set.
      const reinforcePool: Question[] = buildRotatedPool(
        baseLevel,
        clampLevel(baseLevel + 1, baseLevel),
        1,
        baseSubLevel,
        undefined,
        distribution.reinforcement
      );
      reinforcementQuestions = reinforcePool.map((q, i) => ({
        ...q,
        question_id: `ADAPTIVE_${student.id}_reinforcement_${i}_${q.question_id}`,
        adaptive: {
          purpose: 'reinforcement' as const,
          competency: q.topic,
          targetLevel: q.source_level,
          targetSubLevel: baseSubLevel
        }
      }));

      // 20% challenge: span current level + 1..+2, mastery subLevel
      const challengeTarget = clampLevel(baseLevel + 2, baseLevel);
      const challengePool: Question[] = buildRotatedPool(
        clampLevel(baseLevel + 1, baseLevel),
        challengeTarget,
        1,
        0,
        undefined,
        distribution.challenge
      );
      const strongTopics = profile.strongCompetencies.length > 0
        ? profile.strongCompetencies
        : ['Number Sense'];
      challengeQuestions = challengePool.map((q, i) => ({
        ...q,
        question_id: `ADAPTIVE_${student.id}_challenge_${i}_${q.question_id}`,
        adaptive: {
          purpose: 'challenge' as const,
          competency: strongTopics[i % Math.max(1, strongTopics.length)] || q.topic,
          targetLevel: q.source_level,
          targetSubLevel: 0
        }
      }));
    }

    const allQuestions = [
      ...remediationQuestions,
      ...reinforcementQuestions,
      ...challengeQuestions
    ].slice(0, total);

    const narrative = buildNarrative(student.name, profile, distribution, allQuestions.length);

    return {
      id: 'ADAPTIVE_' + Date.now(),
      studentId: student.id,
      studentName: student.name,
      classNumber: ctx.classNumber,
      generatedBy: 'deterministic',
      generatedAt: new Date().toISOString(),
      baseLevel,
      totalQuestions: allQuestions.length,
      distribution: {
        remediation: remediationQuestions.length,
        reinforcement: reinforcementQuestions.length,
        challenge: challengeQuestions.length
      },
      weakCompetencies: profile.weakCompetencies,
      strongCompetencies: profile.strongCompetencies,
      profile,
      questions: allQuestions,
      narrative,
      fallbackUsed: !profile.hasHistory
    };
  }
}

function buildNarrative(
  studentName: string,
  profile: CompetencyProfile,
  dist: { remediation: number; reinforcement: number; challenge: number },
  total: number
): string {
  if (!profile.hasHistory) {
    return `Adaptive worksheet for ${studentName}: no prior evaluation history on record. Generated a grade-aligned default worksheet at Level ${profile.currentLevel} (${total} questions).`;
  }
  const weak = profile.weakCompetencies.length > 0 ? profile.weakCompetencies.join(', ') : 'none detected';
  const strong = profile.strongCompetencies.length > 0 ? profile.strongCompetencies.join(', ') : 'none yet';
  return [
    `Adaptive worksheet for ${studentName} (Level ${profile.currentLevel}.${profile.currentSubLevel}).`,
    `Focus on weak competencies (${weak}) — ${dist.remediation} remediation question(s).`,
    `Reinforcement at current level — ${dist.reinforcement} question(s).`,
    `Stretch challenge — ${dist.challenge} question(s).`,
    `Strong competencies preserved: ${strong}.`
  ].join(' ');
}
