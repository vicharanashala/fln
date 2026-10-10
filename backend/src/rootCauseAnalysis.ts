/**
 * Per-question root-cause analysis shared by every path that produces an
 * EvaluationReport.
 *
 * Extracted from `readPipelineDetail` (originally private to
 * `routes/students.ts`'s diagnostic submission path) so the ICR/worksheet-scan
 * path in `routes/evaluation.ts` — both its original submission handler and
 * its `/override` correction handler — can populate `rootCauses` the same
 * way, instead of never setting it at all (#402).
 *
 * The logic itself is unchanged from the diagnostic path: a real pipeline
 * verdict wins when one exists; otherwise this falls back to a fully
 * deterministic, no-AI-call computation from the submitted/expected answer
 * pair via `classifyErrorType` — which, per `#458`, is actually the only
 * branch that ever runs today, since nothing currently wires a verdict into
 * `evalData`.
 */

import type { Question, EvaluationReport } from './db';
import { classifyErrorType } from './errorClassification';

export function computeRootCauseAnalysis(
  evalData: any,
  questions: Question[],
  answers: { [questionId: string]: string }
): {
  rootCauses?: EvaluationReport['rootCauses'];
  levelsFailed?: number[];
  prerequisitesToCheck?: string[];
  performanceByDifficulty?: EvaluationReport['performanceByDifficulty'];
} {
  const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();
  const rawCauses: any[] = Array.isArray(evalData?.root_causes) ? evalData.root_causes : [];

  // Per-question causes, where the pipeline produced them.
  const keyed = rawCauses.filter(c => c && (c.question_id || c.questionId));
  let rootCauses: EvaluationReport['rootCauses'] = keyed.map(c => {
    const questionId = String(c.question_id ?? c.questionId);
    const question = questions.find(q => q.question_id === questionId);
    return {
      questionId,
      error: String(c.error ?? answers?.[questionId] ?? ''),
      topic: String(c.topic ?? question?.topic ?? 'Unclassified'),
      flnLevel: Number(c.fln_level ?? c.flnLevel ?? question?.source_level ?? 0),
      errorType: String(c.error_type ?? c.errorType ?? 'unclassified'),
      analysis: String(c.analysis ?? '')
    };
  });

  if (rootCauses.length === 0) {
    // A real pipeline verdict (when one exists) always wins over the local
    // classifier — this is the fallback for the case that's true today,
    // where evalData is always {} because nothing wires it in (FLN #458).
    const overallType = evalData?.error_type ? String(evalData.error_type) : null;
    const overallAnalysis = evalData?.root_cause ? String(evalData.root_cause) : '';
    rootCauses = questions
      .filter(q => norm(answers?.[q.question_id]) !== norm(q.answer))
      .map(q => ({
        questionId: q.question_id,
        error: String(answers?.[q.question_id] ?? ''),
        topic: q.topic || 'Unclassified',
        flnLevel: Number(q.source_level ?? 0),
        errorType: overallType ?? classifyErrorType(answers?.[q.question_id], q.answer, q),
        analysis: overallAnalysis
      }));
  }

  // Measured from the paper when the pipeline reported no breakdown of its own.
  let performanceByDifficulty: EvaluationReport['performanceByDifficulty'] =
    evalData?.performance_by_difficulty && typeof evalData.performance_by_difficulty === 'object'
      ? evalData.performance_by_difficulty
      : undefined;
  if (!performanceByDifficulty) {
    const tally: NonNullable<EvaluationReport['performanceByDifficulty']> = {};
    for (const q of questions) {
      const difficulty = q.difficulty || 'medium';
      const cell = tally[difficulty] ?? { attempted: 0, correct: 0 };
      cell.attempted++;
      if (norm(answers?.[q.question_id]) === norm(q.answer)) cell.correct++;
      tally[difficulty] = cell;
    }
    if (Object.keys(tally).length > 0) performanceByDifficulty = tally;
  }

  return {
    rootCauses: rootCauses.length > 0 ? rootCauses : undefined,
    levelsFailed: Array.isArray(evalData?.levels_failed)
      ? evalData.levels_failed.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
      : undefined,
    prerequisitesToCheck: Array.isArray(evalData?.prerequisites_to_check)
      ? evalData.prerequisites_to_check.map((p: any) => String(p))
      : undefined,
    performanceByDifficulty
  };
}
