/**
 * The structured parameters a Superadmin sets when authoring a question
 * template, plus their validators and the naming derived from them.
 *
 * These describe the *shape* of a question — how big the numbers get, which
 * operations appear, how the child records an answer — as opposed to the stem
 * and answer, which say what the question actually asks. Both live on
 * `QuestionTemplate`; they are separated here because only this half is a
 * closed set of legal values, and only this half drives the derived name.
 *
 * Hand-rolled validators rather than a schema library: the backend ships as a
 * single esbuild bundle and this is the only place in it that validates a
 * closed value set, so a dependency would carry more weight than the checks.
 */

import { createHash } from 'crypto';

/**
 * Built-in ranges. `0-100` and `0-1000` are kept because rows already reference
 * them: persisted data is never silently rewritten. They are reported as
 * deprecated so the form can push authors toward the canonical set without the
 * old values suddenly failing validation.
 *
 * Further ranges are added by a Superadmin at runtime and live in the
 * `questionOptions` collection, not here.
 */
export const NUMERAL_RANGES = ['0-9', '0-20', '0-50', '0-100', '0-200', '0-1000', '0-2000', '0-10000'] as const;
export const DEPRECATED_NUMERAL_RANGES: readonly string[] = ['0-100', '0-1000'];
export const DIGIT_COUNTS = ['1-digit', '2-digit', '3-digit', '4-digit'] as const;
export const OPERATIONS = ['add', 'subtract', 'multiply', 'divide'] as const;
export const CARRY_BEHAVIORS = ['none', 'allowed', 'required'] as const;
export const BORROW_BEHAVIORS = ['none', 'allowed', 'required'] as const;
/**
 * Result caps, kept in step with NUMERAL_RANGES.
 *
 * `<=200` and `<=2000` exist because the ranges do: an author who can choose
 * "0 to 200" for the operands and then finds the largest answer jumps from 100
 * straight to 1,000 has been given a form that cannot express what they meant.
 */
export const MAX_SUM_OR_DIFFERENCES = ['<=10', '<=20', '<=50', '<=100', '<=200', '<=1000', '<=2000', '<=10000'] as const;
export const MAX_OPERAND_COUNTS = [2, 3, 4] as const;
export const ANSWER_TYPES = ['single-number', 'mcq-4', 'fill-blanks', 'true-false', 'matching', 'trace'] as const;
export const QUESTION_FAMILIES = ['counting', 'operation'] as const;
export const PARAM_MODES = ['structured', 'legacy-free-text', 'hybrid'] as const;

export const SUBJECT_CATEGORIES = [
  'fruits', 'vegetables', 'animals', 'pets', 'vehicles', 'street-furniture',
  'buildings', 'clothing', 'flowers-trees', 'classroom-objects', 'mixed',
] as const;

export type NumeralRange = (typeof NUMERAL_RANGES)[number];
export type DigitCount = (typeof DIGIT_COUNTS)[number];
export type Operation = (typeof OPERATIONS)[number];
export type CarryBehavior = (typeof CARRY_BEHAVIORS)[number];
export type BorrowBehavior = (typeof BORROW_BEHAVIORS)[number];
export type MaxSumOrDifference = (typeof MAX_SUM_OR_DIFFERENCES)[number];
export type MaxOperandCount = (typeof MAX_OPERAND_COUNTS)[number];
export type AnswerType = (typeof ANSWER_TYPES)[number];
export type SubjectCategory = (typeof SUBJECT_CATEGORIES)[number];
export type QuestionFamily = (typeof QUESTION_FAMILIES)[number];
export type ParamMode = (typeof PARAM_MODES)[number];

/** An intent has to say something. Short enough to be a label is not an instruction. */
export const INTENT_MIN_CHARS = 20;
export const INTENT_MAX_CHARS = 2000;
export const MAX_SVG_THEMES = 12;

export const BLANK_COUNT_MIN = 1;
export const BLANK_COUNT_MAX = 6;
export const QUESTION_COUNT_MIN = 1;
export const QUESTION_COUNT_MAX = 50;
export const QUESTION_COUNT_DEFAULT = 10;

/**
 * Every parameter is nullable, and `operations` empty, because an author may
 * legitimately not have decided yet. Empty `operations` therefore means "not
 * specified", NOT "any operation is allowed" — the two readings conflict once
 * the context rules below reject `carryBehavior` without an explicit `add`.
 */
export interface QuestionTemplateParams {
  numeralRange: NumeralRange | null;
  digitCount: DigitCount | null;
  operations: Operation[];
  maxOperandCount: MaxOperandCount | null;
  carryBehavior: CarryBehavior | null;
  borrowBehavior: BorrowBehavior | null;
  maxSumOrDifference: MaxSumOrDifference | null;
  answerType: AnswerType | null;
  blankCount: number | null;
  questionCount: number | null;
  subjectCategory: SubjectCategory | null;
}

export const EMPTY_PARAMS: QuestionTemplateParams = {
  numeralRange: null,
  digitCount: null,
  operations: [],
  maxOperandCount: null,
  carryBehavior: null,
  borrowBehavior: null,
  maxSumOrDifference: null,
  answerType: null,
  blankCount: null,
  questionCount: null,
  subjectCategory: null,
};

/** True when the author has set at least one parameter. Drives the "is this row structured?" stat. */
export function hasAnyParam(p: QuestionTemplateParams): boolean {
  return (
    p.operations.length > 0 ||
    p.numeralRange !== null ||
    p.digitCount !== null ||
    p.maxOperandCount !== null ||
    p.carryBehavior !== null ||
    p.borrowBehavior !== null ||
    p.maxSumOrDifference !== null ||
    p.answerType !== null ||
    p.blankCount !== null ||
    p.questionCount !== null ||
    p.subjectCategory !== null
  );
}

function oneOf<T extends readonly unknown[]>(allowed: T, value: unknown): boolean {
  return (allowed as readonly unknown[]).includes(value);
}

/**
 * Normalise whatever arrived on the request body into a full params object.
 *
 * Absent and explicitly-null are treated the same, so a PATCH that omits a
 * parameter and one that clears it both end up null. Unknown values are left
 * as-is for `validateParams` to reject, rather than being silently dropped —
 * a typo in a CSV column should fail loudly, not import as null.
 */
export function coerceParams(body: any): QuestionTemplateParams {
  const ops = body?.operations;
  return {
    numeralRange: body?.numeralRange ?? null,
    digitCount: body?.digitCount ?? null,
    operations: Array.isArray(ops) ? ops : [],
    // Cast rather than narrow: an out-of-range value has to survive as far as
    // `validateParams` so the author is told what was wrong with it.
    maxOperandCount: body?.maxOperandCount != null ? (Number(body.maxOperandCount) as MaxOperandCount) : null,
    carryBehavior: body?.carryBehavior ?? null,
    borrowBehavior: body?.borrowBehavior ?? null,
    maxSumOrDifference: body?.maxSumOrDifference ?? null,
    answerType: body?.answerType ?? null,
    blankCount: body?.blankCount != null ? Number(body.blankCount) : null,
    questionCount: body?.questionCount != null ? Number(body.questionCount) : null,
    subjectCategory: body?.subjectCategory ?? null,
  };
}

/**
 * Returns an error string, or null when every parameter is legal.
 *
 * Three kinds of check, in order: the value is in its enum, numbers are in
 * range, and a parameter is only set when the thing it qualifies is also set.
 * The last one is what stops "carry required" being stored against a
 * multiplication-only template, where it would silently mean nothing.
 */
export function validateParams(p: QuestionTemplateParams): string | null {
  if (p.numeralRange !== null && !oneOf(NUMERAL_RANGES, p.numeralRange)) {
    return `numeralRange must be one of ${NUMERAL_RANGES.join(', ')}.`;
  }
  if (p.digitCount !== null && !oneOf(DIGIT_COUNTS, p.digitCount)) {
    return `digitCount must be one of ${DIGIT_COUNTS.join(', ')}.`;
  }

  if (!Array.isArray(p.operations)) return 'operations must be an array.';
  for (const op of p.operations) {
    if (!oneOf(OPERATIONS, op)) return `operations may only contain ${OPERATIONS.join(', ')}.`;
  }
  if (new Set(p.operations).size !== p.operations.length) {
    return 'operations must not repeat a value.';
  }

  if (p.maxOperandCount !== null && !oneOf(MAX_OPERAND_COUNTS, p.maxOperandCount)) {
    return 'maxOperandCount must be 2, 3 or 4.';
  }
  if (p.carryBehavior !== null && !oneOf(CARRY_BEHAVIORS, p.carryBehavior)) {
    return `carryBehavior must be one of ${CARRY_BEHAVIORS.join(', ')}.`;
  }
  if (p.borrowBehavior !== null && !oneOf(BORROW_BEHAVIORS, p.borrowBehavior)) {
    return `borrowBehavior must be one of ${BORROW_BEHAVIORS.join(', ')}.`;
  }
  if (p.maxSumOrDifference !== null && !oneOf(MAX_SUM_OR_DIFFERENCES, p.maxSumOrDifference)) {
    return `maxSumOrDifference must be one of ${MAX_SUM_OR_DIFFERENCES.join(', ')}.`;
  }
  if (p.answerType !== null && !oneOf(ANSWER_TYPES, p.answerType)) {
    return `answerType must be one of ${ANSWER_TYPES.join(', ')}.`;
  }
  if (p.subjectCategory !== null && !oneOf(SUBJECT_CATEGORIES, p.subjectCategory)) {
    return `subjectCategory must be one of ${SUBJECT_CATEGORIES.join(', ')}.`;
  }

  if (p.blankCount !== null) {
    if (!Number.isInteger(p.blankCount) || p.blankCount < BLANK_COUNT_MIN || p.blankCount > BLANK_COUNT_MAX) {
      return `blankCount must be an integer in [${BLANK_COUNT_MIN}, ${BLANK_COUNT_MAX}].`;
    }
  }
  if (p.questionCount !== null) {
    if (!Number.isInteger(p.questionCount) || p.questionCount < QUESTION_COUNT_MIN || p.questionCount > QUESTION_COUNT_MAX) {
      return `questionCount must be an integer in [${QUESTION_COUNT_MIN}, ${QUESTION_COUNT_MAX}].`;
    }
  }

  const hasAdd = p.operations.includes('add');
  const hasSubtract = p.operations.includes('subtract');

  if (p.carryBehavior !== null && !hasAdd) {
    return "carryBehavior requires 'add' in operations.";
  }
  if (p.borrowBehavior !== null && !hasSubtract) {
    return "borrowBehavior requires 'subtract' in operations.";
  }
  if (p.maxOperandCount !== null && !hasAdd && !hasSubtract) {
    return "maxOperandCount requires 'add' or 'subtract' in operations.";
  }
  if (p.maxSumOrDifference !== null && !hasAdd && !hasSubtract) {
    return "maxSumOrDifference requires 'add' or 'subtract' in operations.";
  }
  if (p.blankCount !== null && p.answerType !== 'fill-blanks') {
    return "blankCount requires answerType 'fill-blanks'.";
  }

  return null;
}

const RANGE_LABELS: Record<NumeralRange, string> = {
  '0-9': '0 to 9',
  '0-20': '0 to 20',
  '0-50': '0 to 50',
  '0-100': '0 to 100',
  '0-200': '0 to 200',
  '0-1000': '0 to 1,000',
  '0-2000': '0 to 2,000',
  '0-10000': '0 to 10,000',
};

const ANSWER_LABELS: Record<AnswerType, string> = {
  'single-number': 'single number',
  'mcq-4': 'MCQ',
  'fill-blanks': 'fill in the blanks',
  'true-false': 'true or false',
  matching: 'matching',
  trace: 'trace',
};

/**
 * The human-readable name for a template, built from its parameters.
 *
 * Authors get this instead of naming every variation by hand, which is what
 * keeps two templates with the same constraints from acquiring two different
 * names. Stored rather than computed at read time so that an author who edits
 * the name keeps their edit; regenerating it is an explicit action.
 */
export function deriveTemplateName(p: QuestionTemplateParams): string {
  const parts: string[] = [];

  if (p.operations.length > 0) {
    parts.push(p.operations.join(' and '));
  }
  if (p.digitCount) parts.push(p.digitCount);
  if (p.numeralRange) parts.push(RANGE_LABELS[p.numeralRange]);
  if (p.maxOperandCount) parts.push(`${p.maxOperandCount} operands`);
  if (p.carryBehavior) parts.push(`carry ${p.carryBehavior}`);
  if (p.borrowBehavior) parts.push(`borrow ${p.borrowBehavior}`);
  if (p.maxSumOrDifference) parts.push(`result ${p.maxSumOrDifference}`);
  if (p.answerType) parts.push(ANSWER_LABELS[p.answerType]);
  if (p.blankCount) parts.push(`${p.blankCount} blanks`);
  if (p.subjectCategory) parts.push(p.subjectCategory);

  if (parts.length === 0) return 'Unspecified variation';

  const name = parts.join(', ');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * A stable fingerprint of the parameters, scoped to a concept.
 *
 * Two templates that constrain the same thing at the same level produce the
 * same key, which is how duplicate variations are found. Order-insensitive on
 * `operations` so that ['add','subtract'] and ['subtract','add'] do not read as
 * two different variations.
 */
export function variantKeyFor(conceptId: string, p: QuestionTemplateParams): string {
  const canonical = JSON.stringify([
    conceptId,
    [...p.operations].sort(),
    p.numeralRange,
    p.digitCount,
    p.maxOperandCount,
    p.carryBehavior,
    p.borrowBehavior,
    p.maxSumOrDifference,
    p.answerType,
    p.blankCount,
    p.subjectCategory,
  ]);
  return createHash('sha1').update(canonical).digest('hex').slice(0, 16);
}

/** Everything the authoring form needs to render its controls, in one call. */
/**
 * Validate the intent text on its own.
 *
 * Deliberately checks only length and that it is not a bare question. We
 * cannot tell from text whether an intent is pedagogically good, and pretending
 * to would give false confidence; the length floor just stops "counting" being
 * submitted as a generation instruction.
 */
export function validateGenerationIntent(intent: string): string | null {
  const text = (intent ?? '').trim();
  if (text.length === 0) return 'A generation intent is required.';
  if (text.length < INTENT_MIN_CHARS) {
    return `The generation intent must be at least ${INTENT_MIN_CHARS} characters. Describe what the child does, not just the topic.`;
  }
  if (text.length > INTENT_MAX_CHARS) {
    return `The generation intent must be ${INTENT_MAX_CHARS} characters or fewer.`;
  }
  return null;
}

export function getParamCatalog() {
  return {
    numeralRange: NUMERAL_RANGES,
    deprecatedNumeralRange: DEPRECATED_NUMERAL_RANGES,
    questionFamily: QUESTION_FAMILIES,
    digitCount: DIGIT_COUNTS,
    operations: OPERATIONS,
    carryBehavior: CARRY_BEHAVIORS,
    borrowBehavior: BORROW_BEHAVIORS,
    maxSumOrDifference: MAX_SUM_OR_DIFFERENCES,
    maxOperandCount: MAX_OPERAND_COUNTS,
    answerType: ANSWER_TYPES,
    subjectCategory: SUBJECT_CATEGORIES,
    blankCount: { min: BLANK_COUNT_MIN, max: BLANK_COUNT_MAX },
    questionCount: { min: QUESTION_COUNT_MIN, max: QUESTION_COUNT_MAX, default: QUESTION_COUNT_DEFAULT },
    generationIntent: { minChars: INTENT_MIN_CHARS, maxChars: INTENT_MAX_CHARS },
    maxSvgThemes: MAX_SVG_THEMES,
    contextRules: {
      carryBehavior: { requiresOperation: 'add' },
      borrowBehavior: { requiresOperation: 'subtract' },
      maxOperandCount: { requiresAnyOperation: ['add', 'subtract'] },
      maxSumOrDifference: { requiresAnyOperation: ['add', 'subtract'] },
      blankCount: { requiresAnswerType: 'fill-blanks' },
    },
  };
}
