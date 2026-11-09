import { QUESTIONS_PER_CONCEPT, answersMatch, bandFromScore } from '@fln/domain';
import { HttpError } from '../http';
import type { Attempt, AttemptAnswer } from '../types';

const MAX_ANSWER_CHARS = 100;

export interface PaperEntry { studentId?: unknown; answers?: unknown; marks?: unknown; source?: unknown }
export interface Graded { answers: AttemptAnswer[]; score: number; band: Attempt['band']; source: Attempt['source'] }

/**
 * Turns one paper from the teacher into marks. A paper is either the child's answers (graded against the key here,
 * so the browser never decides what is correct) or the teacher's own right/wrong marks, never both.
 */
export function gradePaper(entry: PaperEntry, key: readonly string[]): Graded {
  const hasAnswers = entry.answers !== undefined, hasMarks = entry.marks !== undefined;
  if (hasAnswers === hasMarks) throw new HttpError(400, 'Send either answers or marks for each paper, not both.');
  let answers: AttemptAnswer[];
  if (hasAnswers) {
    const given = entry.answers;
    const ok = Array.isArray(given) && given.length === QUESTIONS_PER_CONCEPT
      && given.every(g => g === null || (typeof g === 'string' && g.length <= MAX_ANSWER_CHARS));
    if (!ok) throw new HttpError(400, `answers must be ${QUESTIONS_PER_CONCEPT} answers (or null for blank).`);
    answers = (given as (string | null)[]).map((g, i) => ({ n: i + 1, given: g, correct: g !== null && answersMatch(g, key[i]) }));
  } else {
    const marks = entry.marks;
    if (!Array.isArray(marks) || marks.length !== QUESTIONS_PER_CONCEPT || marks.some(m => typeof m !== 'boolean')) {
      throw new HttpError(400, `marks must be ${QUESTIONS_PER_CONCEPT} true/false values.`);
    }
    answers = (marks as boolean[]).map((m, i) => ({ n: i + 1, given: null, correct: m }));
  }
  const score = answers.filter(a => a.correct).length;
  return { answers, score, band: bandFromScore(score), source: hasMarks ? 'marks' : entry.source === 'scan' ? 'scan' : 'typed' };
}

/** Which of the answers a reader returned look right, for the teacher to confirm or fix. */
export function suggestMarks(read: readonly (string | null)[], key: readonly string[]): boolean[] {
  return read.map((g, i) => g !== null && answersMatch(g, key[i]));
}
