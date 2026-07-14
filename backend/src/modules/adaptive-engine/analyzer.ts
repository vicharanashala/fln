/**
 * Adaptive Engine — Student Profile Analyzer
 *
 * Aggregates a student's existing evaluation reports into a per-topic
 * competency profile, then classifies topics into weak / strong buckets.
 *
 * Pure function: no I/O, no LLM. The deterministic engine and any future
 * LLM-backed engine both call this to get a structured starting point.
 */

import type {
  CompetencyScore,
  CompetencyStatus,
  CompetencyProfile,
  StudentContext
} from './types';

const STRONG_ACCURACY_THRESHOLD = 0.8;
const NEEDS_PRACTICE_ACCURACY_THRESHOLD = 0.5;

function deriveStatus(accuracy: number, attempts: number): CompetencyStatus {
  if (attempts === 0) return 'Satisfactory';
  if (accuracy >= STRONG_ACCURACY_THRESHOLD) return 'Strong';
  if (accuracy < NEEDS_PRACTICE_ACCURACY_THRESHOLD) return 'Needs Practice';
  return 'Satisfactory';
}

/**
 * Merge all evaluation reports into per-topic accuracy stats.
 * Reports are processed newest-first so the most recent evidence
 * carries more weight when status is derived.
 */
function aggregateCompetencies(reports: StudentContext['evaluationReports']): CompetencyScore[] {
  if (reports.length === 0) return [];

  type Accum = { topic: string; attempts: number; correct: number; latestStatus?: CompetencyStatus };
  const byTopic = new Map<string, Accum>();

  const sorted = [...reports].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  for (const report of sorted) {
    for (const [topic, status] of Object.entries(report.conceptMastery || {})) {
      if (!byTopic.has(topic)) {
        byTopic.set(topic, { topic, attempts: 0, correct: 0 });
      }
      const acc = byTopic.get(topic)!;
      acc.attempts += 1;
      if (status === 'Strong') acc.correct += 1;
      else if (status === 'Satisfactory') acc.correct += 0.5;
      // 'Needs Practice' contributes 0
      acc.latestStatus = status;
    }
  }

  const scores: CompetencyScore[] = [];
  for (const acc of byTopic.values()) {
    const accuracy = acc.attempts === 0 ? 0 : acc.correct / acc.attempts;
    scores.push({
      topic: acc.topic,
      status: deriveStatus(accuracy, acc.attempts),
      attempts: acc.attempts,
      correct: acc.correct,
      accuracy: Math.round(accuracy * 100) / 100
    });
  }

  return scores.sort((a, b) => a.accuracy - b.accuracy);
}

function partitionCompetencies(scores: CompetencyScore[]) {
  const weak: string[] = [];
  const strong: string[] = [];
  const neutral: string[] = [];

  for (const c of scores) {
    if (c.status === 'Needs Practice') weak.push(c.topic);
    else if (c.status === 'Strong') strong.push(c.topic);
    else neutral.push(c.topic);
  }

  return { weak, strong, neutral };
}

function buildRationale(
  ctx: StudentContext,
  scores: CompetencyScore[],
  partition: { weak: string[]; strong: string[]; neutral: string[] }
): string {
  if (!ctx.hasHistory) {
    return `No prior evaluation history for ${ctx.student.name}. Falling back to grade-level default worksheet at Level ${ctx.student.currentLevel}.`;
  }
  const parts: string[] = [];
  parts.push(
    `${ctx.student.name} has ${ctx.evaluationReports.length} evaluation report(s) on record.`
  );
  if (partition.weak.length > 0) {
    parts.push(`Weak competencies: ${partition.weak.join(', ')}.`);
  }
  if (partition.strong.length > 0) {
    parts.push(`Strong competencies: ${partition.strong.join(', ')}.`);
  }
  if (partition.neutral.length > 0) {
    parts.push(`Steady: ${partition.neutral.join(', ')}.`);
  }
  parts.push(
    `Targeting 60% remediation on weak topics, 20% reinforcement at current level, 20% challenge above current level.`
  );
  return parts.join(' ');
}

export function analyzeStudent(
  ctx: StudentContext,
  generatedBy: CompetencyProfile['generatedBy'] = 'deterministic'
): CompetencyProfile {
  const scores = aggregateCompetencies(ctx.evaluationReports);
  const partition = partitionCompetencies(scores);

  if (!ctx.hasHistory) {
    return {
      studentId: ctx.student.id,
      studentName: ctx.student.name,
      classNumber: ctx.classNumber,
      currentLevel: ctx.student.currentLevel ?? 1,
      currentSubLevel: ctx.student.currentSubLevel ?? 0,
      hasHistory: false,
      competencies: [],
      weakCompetencies: [],
      strongCompetencies: [],
      focusDistribution: { weak: 1.0, reinforcement: 0, challenge: 0 },
      rationale: buildRationale(ctx, scores, partition),
      generatedBy
    };
  }

  return {
    studentId: ctx.student.id,
    studentName: ctx.student.name,
    classNumber: ctx.classNumber,
    currentLevel: ctx.student.currentLevel ?? 1,
    currentSubLevel: ctx.student.currentSubLevel ?? 0,
    hasHistory: true,
    competencies: scores,
    weakCompetencies: partition.weak,
    strongCompetencies: partition.strong,
    focusDistribution: { weak: 0.6, reinforcement: 0.2, challenge: 0.2 },
    rationale: buildRationale(ctx, scores, partition),
    generatedBy
  };
}
