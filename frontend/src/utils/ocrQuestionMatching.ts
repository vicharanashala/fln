import { normalizeQuestionText } from './questionBankAudit';

const QUESTION_MATCH_THRESHOLD = 0.65;
const MIN_CONTAINMENT_LENGTH = 12;

function normalizeForComparison(text: string): string {
  return normalizeQuestionText(text.normalize('NFKC'))
    .replace(/(\d),(?=\d)/g, '$1')
    .replace(/^(?:(?:question|item|row|q)(?:\s+no\.?)?\s*\d+\s*[.):-]?|\d+\s*[.)])\s*/i, '')
    .replace(/\s*([<>=+×÷%/\-])\s*/g, '$1')
    .replace(/[^\p{L}\p{N}<>=+×÷%/\-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSimilarity(left: string, right: string): number {
  const leftTokens = new Set(left.split(' '));
  const rightTokens = new Set(right.split(' '));
  const intersection = [...leftTokens].filter(token => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 1 : intersection / union;
}

function levenshteinSimilarity(left: string, right: string): number {
  if (left === right) return 1;
  if (left.length === 0 || right.length === 0) return 0;

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

  return 1 - previous[right.length] / Math.max(left.length, right.length);
}

function signature(text: string, pattern: RegExp): string {
  return (text.match(pattern) || []).join('|');
}

export function questionsLikelyMatch(extracted: string, known: string): boolean {
  const normalizedExtracted = normalizeForComparison(extracted);
  const normalizedKnown = normalizeForComparison(known);

  if (normalizedExtracted.length === 0 || normalizedKnown.length === 0) return true;
  if (normalizedExtracted === normalizedKnown) return true;

  const extractedNumbers = signature(normalizedExtracted, /\d+(?:\.\d+)?/g);
  const knownNumbers = signature(normalizedKnown, /\d+(?:\.\d+)?/g);
  if (extractedNumbers !== knownNumbers) return false;

  const extractedMath = signature(normalizedExtracted, /[<>=+×÷/%]/g);
  const knownMath = signature(normalizedKnown, /[<>=+×÷/%]/g);
  if (extractedMath !== knownMath) return false;

  const shorter = normalizedExtracted.length <= normalizedKnown.length
    ? normalizedExtracted
    : normalizedKnown;
  const longer = shorter === normalizedExtracted ? normalizedKnown : normalizedExtracted;
  if (shorter.length >= MIN_CONTAINMENT_LENGTH && longer.includes(shorter)) return true;

  return Math.max(
    tokenSimilarity(normalizedExtracted, normalizedKnown),
    levenshteinSimilarity(normalizedExtracted, normalizedKnown)
  ) >= QUESTION_MATCH_THRESHOLD;
}
