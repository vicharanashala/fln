/**
 * Deterministic error-type classification for a wrong answer.
 *
 * FLN #459: `errorType` was always `'unclassified'` because nothing wired the
 * (never-invoked) Python pipeline's `error_type` field into a real value. The
 * platform's own roadmap already names the target patterns (see #413,
 * "cluster recurring error patterns" — 5+6 -> 56 suggests operand
 * concatenation) — this implements the handful of them that are verifiable
 * from the submitted/expected pair alone, without needing pedagogy judgement
 * or the 200-answer human-diagnosed corpus first.
 *
 * Every rule here is a FACT about the two strings (same digits reversed,
 * off by a power of ten, blank) — never an inferred cause. A pair that
 * matches no rule stays `'unclassified'` rather than being guessed at, same
 * principle as `answerMatching.ts`: a fabricated cause is indistinguishable
 * from a measured one once it's downstream.
 */

import { normalizeAnswer, asNumber } from './answerMatching';

export type ErrorType =
  | 'unanswered'
  | 'digit_reversal'
  | 'decimal_place_shift'
  | 'off_by_one'
  | 'unclassified';

/** Same digits, different order — e.g. submitted "21" for expected "12". */
function isDigitReversal(submittedDigits: string, expectedDigits: string): boolean {
  if (submittedDigits.length < 2 || submittedDigits.length !== expectedDigits.length) return false;
  if (submittedDigits === expectedDigits) return false;
  return submittedDigits.split('').reverse().join('') === expectedDigits;
}

/** Digits-only representation for reversal comparison (drops sign/decimal point). */
function digitsOnly(n: number): string {
  return Math.abs(n).toString().replace('.', '');
}

/**
 * Classify a single wrong answer. `submitted`/`expected` are the raw values
 * exactly as `answersMatch` receives them elsewhere — this function does its
 * own normalizing rather than assuming the caller already did.
 */
export function classifyErrorType(submitted: unknown, expected: unknown): ErrorType {
  const s = normalizeAnswer(submitted);
  const e = normalizeAnswer(expected);

  if (s === '') return 'unanswered';

  const sn = asNumber(s);
  const en = asNumber(e);
  if (sn === null || en === null) return 'unclassified';

  // Off by exactly one — classic carry/borrow slip. Checked before the
  // power-of-ten check since e.g. 9 vs 10 would otherwise also look close
  // to a decimal shift on some ratios; off-by-one is the more specific,
  // higher-confidence read when it applies.
  if (Math.abs(sn - en) === 1) return 'off_by_one';

  // Off by a power of ten (10x or 100x, either direction) — a decimal point
  // or place value slip, not a reversal or a random miss. Floating-point
  // division (e.g. 0.7 / 7) rarely lands on an exact power of ten, so this
  // compares within a small relative tolerance rather than by equality.
  if (sn !== 0 && en !== 0) {
    const ratio = sn / en;
    const closeTo = (target: number) => Math.abs(ratio - target) < target * 1e-9;
    if (closeTo(10) || closeTo(0.1) || closeTo(100) || closeTo(0.01)) {
      return 'decimal_place_shift';
    }
  }

  // Same digits, reversed — "12" written for "21".
  if (isDigitReversal(digitsOnly(sn), digitsOnly(en))) return 'digit_reversal';

  return 'unclassified';
}
