import { Question } from './db';
import { pickVariant, SvgThemeVariant } from './svgAssetCatalog';

/** Lowercase, collapse whitespace, tidy list separators, drop a trailing full stop. */
export function normalizeAnswer(value: unknown): string {
  let s = String(value ?? '').trim().toLowerCase();
  s = s.replace(/\s+/g, ' ');        // "12   apples" -> "12 apples"
  s = s.replace(/\s*,\s*/g, ',');    // "2, 3" -> "2,3"  (multi-blank rows are comma-joined)
  s = s.replace(/\.$/, '');          // "7." -> "7"      (a full stop the child wrote as punctuation)
  return s.trim();
}

/**
 * A plain number, written the way a child writes one. Deliberately narrow:
 * optional sign, digits with optional thousands separators, optional decimal
 * part. No exponents, no fractions, no units — those must not be silently
 * treated as numbers.
 */
const PLAIN_NUMBER = /^[+-]?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/;

export function asNumber(normalized: string): number | null {
  if (!PLAIN_NUMBER.test(normalized)) return null;
  const n = Number(normalized.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Whether a submitted answer should be graded correct against the expected one.
 *
 * A blank submission is never correct, even against a blank expected answer —
 * an unanswered question is missing evidence, not a demonstrated skill.
 */
export function answersMatch(submitted: unknown, expected: unknown): boolean {
  const s = normalizeAnswer(submitted);
  const e = normalizeAnswer(expected);
  if (s === '') return false;
  if (s === e) return true;

  // Same number, different notation: "07" vs "7", "2.0" vs "2", "1,000" vs "1000".
  const sn = asNumber(s);
  const en = asNumber(e);
  if (sn !== null && en !== null) return sn === en;

  // Multi-blank rows arrive comma-joined ("2,3"). Compare element-wise so one
  // blank written as "03" does not fail the whole row. Order is significant:
  // the blanks are positional on the printed sheet.
  if (s.includes(',') && e.includes(',')) {
    const sParts = s.split(',');
    const eParts = e.split(',');
    if (sParts.length !== eParts.length) return false;
    return sParts.every((part, i) => {
      if (part === eParts[i]) return part !== '';
      const pn = asNumber(part);
      const qn = asNumber(eParts[i]);
      return pn !== null && qn !== null && pn === qn;
    });
  }

  return false;
}

/**
 * Extract authoritative expected answer for a concrete question instance.
 *
 * Prefers explicitly persisted expectedAnswer/answer or generatedParams answer,
 * ensuring evaluation uses the instance's concrete answer instead of a generic template default.
 */
export function getExpectedAnswerForQuestionInstance(instance: Partial<Question> | any): string {
  if (!instance || typeof instance !== 'object') return '';

  if (typeof instance.expectedAnswer === 'string' && instance.expectedAnswer.trim() !== '') {
    return instance.expectedAnswer.trim();
  }
  if (typeof instance.answer === 'string' && instance.answer.trim() !== '') {
    return instance.answer.trim();
  }
  if (instance.generatedParams && typeof instance.generatedParams === 'object') {
    if (typeof instance.generatedParams.expectedAnswer === 'string' && instance.generatedParams.expectedAnswer.trim() !== '') {
      return instance.generatedParams.expectedAnswer.trim();
    }
    if (typeof instance.generatedParams.answer === 'string' && instance.generatedParams.answer.trim() !== '') {
      return instance.generatedParams.answer.trim();
    }
  }
  return '';
}

/**
 * Resolve the SVG theme/variant for a question instance.
 *
 * If already persisted on the question instance, use the persisted value.
 * Only call pickVariant if not persisted and deterministic seed is available.
 */
export function getSvgVariantForQuestionInstance(
  instance: Partial<Question> | any,
  seed?: string
): SvgThemeVariant | string | undefined {
  if (!instance || typeof instance !== 'object') return undefined;

  if (instance.svgVariantId) return instance.svgVariantId;
  if (instance.svgAsset) return instance.svgAsset;
  if (instance.svgThemeId) {
    if (seed) {
      const picked = pickVariant(instance.svgThemeId, seed);
      if (picked) return picked;
    }
    return instance.svgThemeId;
  }
  return undefined;
}

/**
 * Evaluate a student's response against a specific question instance.
 *
 * Supports answer types:
 * - single-number / number
 * - fill-blanks
 * - mcq-4 / choice
 * - true-false
 * - matching
 * - trace / text
 *
 * Fails safely if required answer metadata is missing or malformed for a templated question.
 */
export function evaluateAnswerAgainstQuestion(
  submitted: unknown,
  questionInstance: Partial<Question> | any
): {
  isCorrect: boolean;
  expectedAnswer: string;
  submittedAnswer: string;
  error?: string;
} {
  const sStr = String(submitted ?? '').trim();

  if (!questionInstance || typeof questionInstance !== 'object') {
    return {
      isCorrect: false,
      expectedAnswer: '',
      submittedAnswer: sStr,
      error: 'MISSING_METADATA',
    };
  }

  const expected = getExpectedAnswerForQuestionInstance(questionInstance);
  const isTemplated = !!(
    questionInstance.templateId ||
    questionInstance.generationIntent ||
    questionInstance.generatedParams ||
    questionInstance.questionFamily
  );

  if (expected === '') {
    if (isTemplated) {
      return {
        isCorrect: false,
        expectedAnswer: '',
        submittedAnswer: sStr,
        error: 'MISSING_EXPECTED_ANSWER',
      };
    }
    return {
      isCorrect: false,
      expectedAnswer: '',
      submittedAnswer: sStr,
    };
  }

  const answerType = String(
    questionInstance.answer_type || questionInstance.answerType || ''
  ).toLowerCase();

  let isCorrect = false;

  if (answerType === 'true-false') {
    isCorrect = evaluateTrueFalse(sStr, expected);
  } else if (answerType === 'matching') {
    isCorrect = evaluateMatching(sStr, expected);
  } else if (answerType === 'mcq-4' || answerType === 'choice') {
    isCorrect = evaluateMcq(sStr, expected, questionInstance.choices);
  } else if (answerType === 'fill-blanks') {
    isCorrect = answersMatch(sStr, expected);
  } else {
    isCorrect = answersMatch(sStr, expected);
  }

  return {
    isCorrect,
    expectedAnswer: expected,
    submittedAnswer: sStr,
  };
}

export const evaluateQuestionInstance = evaluateAnswerAgainstQuestion;

function normalizeTrueFalse(val: string): 'true' | 'false' | null {
  const norm = normalizeAnswer(val);
  if (['true', 't', 'yes', '1', 'correct', 'right'].includes(norm)) return 'true';
  if (['false', 'f', 'no', '0', 'incorrect', 'wrong'].includes(norm)) return 'false';
  return null;
}

function evaluateTrueFalse(submitted: string, expected: string): boolean {
  const normSub = normalizeTrueFalse(submitted);
  const normExp = normalizeTrueFalse(expected);
  if (normSub && normExp) {
    return normSub === normExp;
  }
  return answersMatch(submitted, expected);
}

function evaluateMcq(submitted: string, expected: string, choices?: string[]): boolean {
  if (answersMatch(submitted, expected)) return true;
  const normSub = normalizeAnswer(submitted);
  const normExp = normalizeAnswer(expected);
  if (normSub === normExp) return true;

  if (Array.isArray(choices) && choices.length > 0) {
    const letters = ['a', 'b', 'c', 'd', 'e', 'f'];
    const expIdx = letters.indexOf(normExp);
    if (expIdx >= 0 && expIdx < choices.length) {
      if (answersMatch(normSub, choices[expIdx])) return true;
    }
    const subIdx = letters.indexOf(normSub);
    if (subIdx >= 0 && subIdx < choices.length) {
      if (answersMatch(choices[subIdx], expected)) return true;
    }
  }

  return false;
}

function evaluateMatching(submitted: string, expected: string): boolean {
  if (answersMatch(submitted, expected)) return true;
  const parsePairs = (raw: string): string[] => {
    return normalizeAnswer(raw)
      .split(',')
      .map(p => p.replace(/->|:|=/g, '→').trim())
      .filter(Boolean)
      .sort();
  };

  const subPairs = parsePairs(submitted);
  const expPairs = parsePairs(expected);

  if (subPairs.length > 0 && subPairs.length === expPairs.length) {
    return subPairs.every((pair, idx) => answersMatch(pair, expPairs[idx]));
  }

  return false;
}
