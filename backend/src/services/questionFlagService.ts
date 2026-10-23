// ---------------------------------------------------------------------------
// Question-level auto-flag detection (SRS R-15)
//
// "If 50%+ of students consistently fail an 'easy'-tagged question, the
// system flags it for core-team review."
//
// Detection aggregates per-question failure rates across ALL evaluation
// reports. The failure rate is computed over DISTINCT STUDENTS, not raw
// attempts, per SRS R-15 ("50%+ of students fail"). A student who retries
// an evaluation counts only once.
//
// This module is intentionally a plain function library (no DB, no Express)
// so the same logic runs both:
//   a) live, inside POST /api/evaluation/submit after a report is saved,
//   b) on demand, via POST /api/question-flags/detect (backfill).
// ---------------------------------------------------------------------------

import type { EvaluationReport, Question, QuestionBankEntry } from '../db';
import { PASS_SCORE } from '../config/constants';

/**
 * Threshold: fraction of students who must fail an easy question before it
 * is auto-flagged. 0.5 = 50%. Matches SRS R-15 exactly.
 */
export const QUESTION_AUTOFLAG_THRESHOLD = 0.5;

/**
 * Minimum number of DISTINCT STUDENTS who must have attempted a question
 * before its failure rate is considered statistically meaningful.
 * Prevents flagging a question after just one or two students happened to
 * get it wrong.
 */
export const QUESTION_AUTOFLAG_MIN_STUDENTS = 3;

/**
 * Run auto-flag detection across all evaluation reports.
 *
 * For every question_id that appears in any report's questionResults:
 *   - Join with the worksheet's questions to get difficulty
 *   - Track distinct attempting students and distinct failing students
 *   - If difficulty === 'easy', attemptingStudents >= minStudents, and
 *     failingStudents / attemptingStudents >= threshold → flag the question
 *     (unless already flagged and reviewed)
 *
 * Returns { scanned, flaggedCount, clearedCount, flaggedQuestionIds }.
 *
 * `questionBank` is the canonical source of question metadata (difficulty,
 * questionText) — used to enrich flag reasons.
 *
 * `worksheetsById` maps worksheetId → Worksheet so we can resolve each
 * report's questionResults against the actual questions asked (which carry
 * difficulty and the canonical question text).
 */
export function detectQuestionFlags({
  reports,
  worksheetsById,
  questionBank,
  minStudents = QUESTION_AUTOFLAG_MIN_STUDENTS,
  threshold = QUESTION_AUTOFLAG_THRESHOLD,
}: {
  reports: EvaluationReport[];
  worksheetsById: Map<string, any>;
  questionBank: Map<string, QuestionBankEntry>;
  minStudents?: number;
  threshold?: number;
}): {
  scanned: number;
  flaggedCount: number;
  clearedCount: number;
  flaggedQuestionIds: Array<{
    questionId: string;
    questionText?: string;
    difficulty?: string;
    attemptingStudents: number;
    failingStudents: number;
    failRate: number;
    reason: string;
  }>;
} {
  // Aggregate per-question stats across all reports.
  // Key = question_id. Value = { attemptingStudents (set of studentIds),
  // failingStudents (set of studentIds), questionText, difficulty }.
  const questionStats = new Map<
    string,
    {
      attemptingStudents: Set<string>;
      failingStudents: Set<string>;
      questionText?: string;
      difficulty?: string;
    }
  >();

  for (const report of reports) {
    const results = report.questionResults ?? [];
    const worksheet = worksheetsById.get(report.worksheetId);
    const wsQuestions: Question[] = worksheet?.questions ?? [];

    for (const r of results) {
      // Resolve difficulty from the worksheet question (canonical source).
      const wsQ = wsQuestions.find(q => q.question_id === r.questionId);
      const difficulty = wsQ?.difficulty;
      const questionText = wsQ?.question;

      // Also enrich from questionBank if worksheet doesn't have it.
      let finalText = questionText;
      let finalDifficulty = difficulty;
      if (!finalText || !finalDifficulty) {
        const bankEntry = questionBank.get(r.questionId);
        if (bankEntry) {
          if (!finalText) finalText = bankEntry.questionText;
          // questionBank doesn't carry difficulty; only worksheets do.
        }
      }

      const key = r.questionId;
      if (!questionStats.has(key)) {
        questionStats.set(key, {
          attemptingStudents: new Set<string>(),
          failingStudents: new Set<string>(),
          questionText: finalText,
          difficulty: finalDifficulty,
        });
      }
      const stat = questionStats.get(key)!;

      // Track distinct students only (SRS R-15: "50%+ of students").
      stat.attemptingStudents.add(report.studentId);

      // A failed attempt: isCorrect === false, or submitted answer is blank
      // when a correct answer exists (unanswered easy question counts as fail).
      const isCorrect = r.isCorrect ?? false;
      const correctAnswer = (r.correctAnswer ?? '').trim();
      const submittedAnswer = (r.submittedAnswer ?? '').trim();
      const isBlankButRequired =
        !submittedAnswer && correctAnswer && correctAnswer.length > 0;

      if (!isCorrect || isBlankButRequired) {
        stat.failingStudents.add(report.studentId);
      }
    }
  }

  let flaggedCount = 0;
  let clearedCount = 0;
  const flaggedQuestionIds: Array<{
    questionId: string;
    questionText?: string;
    difficulty?: string;
    attemptingStudents: number;
    failingStudents: number;
    failRate: number;
    reason: string;
  }> = [];

  for (const [questionId, stat] of questionStats) {
    // Only flag easy questions with enough distinct students.
    if (stat.difficulty !== 'easy') continue;
    if (stat.attemptingStudents.size < minStudents) continue;

    const attemptingCount = stat.attemptingStudents.size;
    const failingCount = stat.failingStudents.size;
    const failRate = failingCount / attemptingCount;
    const shouldFlag = failRate >= threshold;

    const reason = `Failed ${Math.round(failRate * 100)}% of ${attemptingCount} student(s) (${failingCount} failing) on easy question`;

    flaggedQuestionIds.push({
      questionId,
      questionText: stat.questionText,
      difficulty: stat.difficulty,
      attemptingStudents: attemptingCount,
      failingStudents: failingCount,
      failRate,
      reason,
    });

    if (shouldFlag) flaggedCount++;
    else clearedCount++;
  }

  return {
    scanned: reports.length,
    flaggedCount,
    clearedCount,
    flaggedQuestionIds,
  };
}
