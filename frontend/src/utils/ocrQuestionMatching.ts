import { normalizeQuestionText } from './questionBankAudit';

const QUESTION_MATCH_THRESHOLD = 0.65;
const MIN_CONTAINMENT_LENGTH = 12;
const NUMERIC_WEIGHT = 0.4;

const NUMBER_PATTERN = /\d+(?:\.\d+)?/g;
const MATH_OPERATOR_PATTERN = /[<>=+×÷/%]/g;

function normalizeForComparison(text: string): string {
  return normalizeQuestionText(text.normalize('NFKC'))
    .replace(/(\d),(?=\d)/g, '$1')
    .replace(/^(?:(?:question|item|row|q)(?:\s+no\.?)?\s*\d+\s*[.):-]?|\d+\s*[.)])\s*/i, '')
    .replace(/\s*([<>=+×÷%/\-])\s*/g, '$1')
    .replace(/[^\p{L}\p{N}<>=+×÷%/\-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function numbersIn(text: string): string[] {
  return text.match(NUMBER_PATTERN) || [];
}

function operatorSignature(text: string): string {
  return (text.match(MATH_OPERATOR_PATTERN) || []).join('|');
}

function tokenSimilarity(left: string, right: string): number {
  const leftTokens = new Set(left.split(' '));
  const rightTokens = new Set(right.split(' '));
  const intersection = [...leftTokens].filter(token => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 1 : intersection / union;
}

function editDistance<T>(left: T[], right: T[]): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function levenshteinSimilarity(left: string, right: string): number {
  if (left === right) return 1;
  if (left.length === 0 || right.length === 0) return 0;
  return 1 - editDistance(left.split(''), right.split('')) / Math.max(left.length, right.length);
}

function numericSimilarity(extracted: string[], known: string[]): number {
  if (extracted.length === 0 && known.length === 0) return 1;
  return 1 - editDistance(extracted, known) / Math.max(extracted.length, known.length);
}

export function questionsLikelyMatch(extracted: string, known: string): boolean {
  const normalizedExtracted = normalizeForComparison(extracted);
  const normalizedKnown = normalizeForComparison(known);

  if (normalizedExtracted.length === 0 || normalizedKnown.length === 0) return true;
  if (normalizedExtracted === normalizedKnown) return true;
  if (operatorSignature(normalizedExtracted) !== operatorSignature(normalizedKnown)) return false;

  const shorter = normalizedExtracted.length <= normalizedKnown.length
    ? normalizedExtracted
    : normalizedKnown;
  const longer = shorter === normalizedExtracted ? normalizedKnown : normalizedExtracted;
  const textSimilarity = shorter.length >= MIN_CONTAINMENT_LENGTH && longer.includes(shorter)
    ? 1
    : Math.max(
      tokenSimilarity(normalizedExtracted, normalizedKnown),
      levenshteinSimilarity(normalizedExtracted, normalizedKnown)
    );

  const numericFactor = (1 - NUMERIC_WEIGHT)
    + NUMERIC_WEIGHT * numericSimilarity(numbersIn(normalizedExtracted), numbersIn(normalizedKnown));

  return textSimilarity * numericFactor >= QUESTION_MATCH_THRESHOLD;
}

/**
 * Key each OCR-transcribed question by the id of the authoritative question it
 * was paired with, so the verify table can never re-align them by whatever
 * order the question array happens to be in. Both input arrays come from the
 * same scan and are paired positionally once, here; every later lookup is by id.
 * A missing `extractedQuestions` (older backend) yields an empty map, which
 * means "nothing to flag" rather than "everything mismatched".
 */
export function alignExtractedQuestions<T extends { id: string }>(
  questions: ReadonlyArray<T>,
  extractedQuestions?: ReadonlyArray<string> | null
): Record<string, string> {
  const aligned: Record<string, string> = {};
  const transcribed = extractedQuestions ?? [];
  questions.forEach((question, index) => {
    const id = question?.id;
    if (!id) return;
    aligned[id] = String(transcribed[index] ?? '');
  });
  return aligned;
}
