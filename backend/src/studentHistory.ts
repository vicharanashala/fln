/**
 * Student attempt history services.
 *
 * Contains:
 * - Issue #613: `getAttemptHistoryForStudent` — resolves student's full submission
 *   history into a flat list of AttemptRecords tagged with full Question objects.
 * - Issue #615: `getQuestionAttempts` — retrieves attempt history filtered to a single
 *   conceptId, optionally restricted to the most recent sitting (worksheetId).
 */

import { dbStore } from './db';
import type { Question, Worksheet, EvaluationReport } from './db';

/**
 * One attempt at one question by one student, flattened across all the
 * student's evaluator reports.
 */
export interface AttemptRecord {
  /**
   * The `worksheetId` of the EvaluationReport this attempt came from.
   * Treated as the de-facto "sitting" identifier — one value per submission event.
   */
  sitting: string;
  /** ISO timestamp from the parent EvaluationReport. */
  timestamp: string;
  /**
   * conceptId from the resolved `Question` object. May be undefined if
   * source worksheet or question is missing/unlinked.
   */
  conceptId?: string;
  /** The attempt's question_id as recorded in EvaluationReport.questionResults. */
  questionId: string;
  /**
   * The full Question object resolved via the source Worksheet's
   * `questions` array. May be undefined if missing/unlinked.
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

/**
 * Issue #615: Retrieves attempt history for a specific student filtered by conceptId.
 *
 * @param studentId The student ID whose attempts to fetch
 * @param conceptId The exact conceptId to filter by (e.g. "S3.4")
 * @param sameSitting When true, returns only attempts belonging to the most recent
 *                    sitting (worksheetId) containing attempts for this concept.
 *                    When false, returns all attempts for this concept across all sittings.
 * @returns Array of AttemptRecord matching the conceptId (and sitting if sameSitting=true).
 *          Returns `[]` if no attempts match.
 */
export async function getQuestionAttempts(
  studentId: string,
  conceptId: string,
  sameSitting: boolean
): Promise<AttemptRecord[]> {
  const allHistory = await getAttemptHistoryForStudent(studentId);
  const conceptAttempts = allHistory.filter(a => a.conceptId === conceptId);
  if (!sameSitting || conceptAttempts.length === 0) {
    return conceptAttempts;
  }
  const mostRecentSitting = conceptAttempts[conceptAttempts.length - 1].sitting;
  return conceptAttempts.filter(a => a.sitting === mostRecentSitting);
}
