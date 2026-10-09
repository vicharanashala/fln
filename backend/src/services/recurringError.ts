import { dbStore } from '../db';
import { classifyErrorType, ErrorType } from '../errorClassification';

/**
 * Recurring Error Type Service (Issue #624)
 *
 * Identifies recurring error patterns (e.g. digit_reversal, off_by_one, decimal_place_shift)
 * for a flagged concept by analyzing incorrect question attempts across evaluation reports.
 */

export interface RecurringErrorResult {
  conceptId: string;
  recurringErrorType: ErrorType | null;
  errorCounts: Record<string, number>;
  totalAttempts: number;
  wrongAttempts: number;
  hasRecurringPattern: boolean;
}

export async function getRecurringErrorForConcept(
  studentId: string,
  conceptId: string
): Promise<RecurringErrorResult> {
  const reports = await dbStore.getEvaluationReports();
  const studentReports = reports.filter(r => r.studentId === studentId);

  const errorCounts: Record<string, number> = {};
  let totalAttempts = 0;
  let wrongAttempts = 0;

  for (const report of studentReports) {
    if (!report.questionResults || !Array.isArray(report.questionResults)) continue;

    for (const qr of report.questionResults) {
      const qAny = qr as any;
      // Match conceptId from questionId, question text, or qr.conceptId
      const matchedConcept =
        qAny.conceptId ||
        qr.questionId?.match(/S\d+\.\d+/)?.[0] ||
        qr.question?.match(/S\d+\.\d+/)?.[0];

      if (matchedConcept === conceptId || qr.questionId?.startsWith(conceptId)) {
        totalAttempts++;

        if (!qr.isCorrect) {
          wrongAttempts++;
          const errorType: ErrorType =
            qAny.errorType ?? classifyErrorType(qr.submittedAnswer, qr.correctAnswer);

          errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
        }
      }
    }
  }

  // Find recurring pattern: wrong attempt error type occurring >= 2 times (excluding unanswered/unclassified)
  let topErrorType: ErrorType | null = null;
  let maxCount = 0;

  for (const [errType, count] of Object.entries(errorCounts)) {
    if (errType === 'unanswered' || errType === 'unclassified') continue;
    if (count >= 2 && count > maxCount) {
      maxCount = count;
      topErrorType = errType as ErrorType;
    }
  }

  return {
    conceptId,
    recurringErrorType: topErrorType,
    errorCounts,
    totalAttempts,
    wrongAttempts,
    hasRecurringPattern: topErrorType !== null
  };
}

export async function getRecurringErrorsForStudent(
  studentId: string
): Promise<Record<string, RecurringErrorResult>> {
  const reports = await dbStore.getEvaluationReports();
  const studentReports = reports.filter(r => r.studentId === studentId);

  const conceptIds = new Set<string>();
  for (const report of studentReports) {
    if (!report.questionResults) continue;
    for (const qr of report.questionResults) {
      const qAny = qr as any;
      const cid =
        qAny.conceptId ||
        qr.questionId?.match(/S\d+\.\d+/)?.[0] ||
        qr.question?.match(/S\d+\.\d+/)?.[0];
      if (cid) conceptIds.add(cid);
    }
  }

  const results: Record<string, RecurringErrorResult> = {};
  for (const cid of conceptIds) {
    results[cid] = await getRecurringErrorForConcept(studentId, cid);
  }

  return results;
}
