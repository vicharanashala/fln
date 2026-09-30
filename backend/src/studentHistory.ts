/**
 * Issue #613: getAttemptHistoryForStudent -- resolve a student's full
 * submission history into a flat list of attempts, each tagged with the
 * full `Question` object (resolved via the source Worksheet).
 *
 * Why this file exists:
 *   `EvaluationReport.questionResults` (db.ts) stores each attempt as
 *   `{ questionId, question?, submittedAnswer, isCorrect }` -- `question`
 *   is the plain question TEXT, not a full `Question` object, and there's
 *   NO `conceptId` on the result. The full `Question` (with `conceptId`)
 *   lives on `Worksheet.questions` (db.ts:301). This function does the
 *   join -- by worksheetId -> Worksheet -> Map<question_id, Question> --
 *   so downstream consumers (#614's distinct-concept-ids helper, #615's
 *   per-concept-attempts helper, #621's mastery computation, #624's error
 *   classification) can read `attempt.conceptId` without having to
 *   re-implement the join themselves.
 *
 * Mirrors the exact `byId` pattern misconceptionFingerprint.ts:671-672
 * already uses for live (non-historical) cohort analysis.
 */

import { dbStore } from './db';
import type { Question, Worksheet, EvaluationReport } from './db';

/**
 * One attempt at one question by one student, flattened across all the
 * student's evaluator reports. The shape is what #614 / #615 / #621 /
 * #624 consume -- the contract is set here and they read off it.
 */
export interface AttemptRecord {
  /**
   * The `worksheetId` of the EvaluationReport this attempt came from.
   * Treated as the de-facto "sitting" identifier -- one value per
   * submission event. Used by #615's `sameSitting` filter.
   */
  sitting: string;
  /** ISO timestamp from the parent EvaluationReport. */
  timestamp: string;
  /**
   * conceptId from the resolved `Question` object. May be undefined:
   *   (a) the source Worksheet couldn't be found (worksheetId doesn't
   *       resolve -- e.g. the literal 'diagnostic' id in some seed data),
   *   (b) the question itself predates `Question.conceptId` (db.ts:170
   *       makes it optional),
   *   (c) the questionId in questionResults didn't match any question
   *       on the Worksheet.
   * Downstream consumers must filter these out (see #614's `.filter(Boolean)`)
   * or surface them as a separate diagnostic -- they must not crash.
   */
  conceptId?: string;
  /** The attempt's question_id as recorded in EvaluationReport.questionResults. */
  questionId: string;
  /**
   * The full Question object resolved via the source Worksheet's
   * `questions` array. May be undefined (see `conceptId` note above).
   * Always undefined when `conceptId` is undefined -- they're correlated.
   */
  question: Question | undefined;
  /** What the student submitted for this question. */
  submittedAnswer: string;
  /** Whether the grading code marked this attempt as correct. */
  isCorrect: boolean;
}

/**
 * Returns every question attempt across all of the given student's
 * EvaluationReports, flattened into a single AttemptRecord[].
 *
 * Order: outer loop is reports in the order `getEvaluationReportsForStudent`
 * returns them (Mongo natural order, JSON-file array order). Inner loop is
 * `report.questionResults` in the order it was stored. Same sitting == same
 * `worksheetId`, so #615's sameSitting filter can group by it.
 *
 * Edge cases:
 *   - Report with no `questionResults` array (older reports) -> contributes
 *     zero attempts.
 *   - Worksheet not found (e.g. 'diagnostic' literal) -> all attempts on
 *     that report come back with `question: undefined`, `conceptId: undefined`.
 *   - Question on the report not found on the Worksheet (data drift) ->
 *     same: `question: undefined`, `conceptId: undefined`.
 *   - Student with zero reports -> returns `[]`.
 *
 * The function never throws on missing data -- it returns attempts with
 * `question: undefined` so callers can decide whether to skip them
 * (recommended, see #614) or surface them as a diagnostic.
 */
export async function getAttemptHistoryForStudent(studentId: string): Promise<AttemptRecord[]> {
  const reports: EvaluationReport[] = await dbStore.getEvaluationReportsForStudent(studentId);

  const attempts: AttemptRecord[] = [];
  for (const report of reports) {
    const worksheet: Worksheet | undefined = await dbStore.getWorksheet(report.worksheetId);
    const byId = new Map<string, Question>(
      (worksheet?.questions ?? []).map(q => [q.question_id, q]),
    );
    for (const qr of report.questionResults ?? []) {
      const question = byId.get(qr.questionId);
      attempts.push({
        sitting: report.worksheetId,
        timestamp: report.timestamp,
        conceptId: question?.conceptId,
        questionId: qr.questionId,
        question,
        submittedAnswer: qr.submittedAnswer,
        isCorrect: qr.isCorrect,
      });
    }
  }
  return attempts;
}