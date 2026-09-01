/**
 * Wrong answers for the Simulation Controls.
 *
 * The simulator buttons used to write the literal strings "FAIL" and "WRONG"
 * into the answer map. That is enough for level placement, which only asks
 * whether an answer was right, but it is invisible to misconception
 * fingerprinting: `toNumber("FAIL")` is null, so `classifyError` cannot read the
 * shape of the mistake and every simulated error falls into the unclassified
 * residue. A cohort filled in by these buttons produced no archetypes at all —
 * "100% of this cohort's wrong answers did not match any of the nine known error
 * patterns".
 *
 * These generators produce wrong answers that carry a *shape* — a reversed pair
 * of digits, a dropped place value, an off-by-one — so the same buttons exercise
 * the whole pipeline. The value is still wrong, so placement behaves as before.
 *
 * Each child is given one primary way of failing, so a simulated cohort forms
 * the same kind of coherent groups a real one does. The morphology names mirror
 * `MORPHOLOGY_KEYS` in `backend/src/misconceptionFingerprint.ts`; this file only
 * generates values, it never classifies them — classification stays on the
 * backend.
 */

export type SimulatedMorphology =
  | 'digitReversal'
  | 'placeValueTenfold'
  | 'offByOne'
  | 'nearMiss'
  | 'grossMagnitude'
  | 'omission';

/**
 * The shapes a simulated child can fail in.
 *
 * Deliberately limited to morphologies derivable from the correct answer alone.
 * `digitConcatenation` and `operationSubstitution` need the question's operands,
 * which means parsing the prompt — that parser lives on the backend and is not
 * worth a second copy here.
 */
const PROFILES: SimulatedMorphology[] = [
  'digitReversal',
  'placeValueTenfold',
  'offByOne',
  'nearMiss',
  'grossMagnitude',
  'omission'
];

/**
 * FNV-1a plus an avalanche step — small, dependency-free, stable across runs.
 *
 * The finaliser is not decorative. Student ids differ in only a few digits
 * ("STD_39587" / "STD_44747"), and plain FNV-1a leaves that similarity in the
 * low bits: taking it mod 6 put four of one seven-child class on the same
 * morphology. Mixing the high bits down first spreads near-identical ids evenly.
 */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

function toNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).replace(/[,\s]/g, '');
  const m = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * The way this particular child fails.
 *
 * Keyed on the student alone, so one child's mistakes stay consistent across a
 * whole worksheet. That consistency is the point: clustering looks for a repeated
 * signature, and a child who fails a different way on every question is noise.
 */
export function morphologyForStudent(studentId: string): SimulatedMorphology {
  return PROFILES[hash(studentId) % PROFILES.length];
}

function applyMorphology(expected: number, morphology: SimulatedMorphology): number | null {
  const isInteger = Number.isInteger(expected);
  const digits = Math.abs(expected).toString();

  switch (morphology) {
    case 'digitReversal': {
      // Needs at least two differing digits, or the "reversal" is the answer.
      if (!isInteger || digits.length < 2) return null;
      const reversed = digits.split('').reverse().join('');
      const value = Number(reversed) * Math.sign(expected || 1);
      return value === expected ? null : value;
    }
    case 'placeValueTenfold':
      return expected === 0 ? null : expected * 10;
    case 'offByOne':
      return expected + 1;
    case 'nearMiss': {
      // Inside the 15% band the backend calls a near miss, while avoiding the
      // deltas that would read as a different pattern (1, and 10/100/1000).
      const delta = Math.max(2, Math.round(Math.abs(expected) * 0.08));
      const safe = [10, 100, 1000].includes(delta) ? delta + 1 : delta;
      // Below roughly 14 the band is narrower than the smallest delta that is
      // not an off-by-one, so no integer near miss exists. Say so rather than
      // emitting a gross error under a near-miss label.
      if (safe / Math.max(Math.abs(expected), 1) > 0.15) return null;
      return expected + safe;
    }
    case 'grossMagnitude':
      return expected * 7 + 3;
    default:
      return null;
  }
}

/**
 * A wrong answer for one question, shaped by how this child fails.
 *
 * Children on the `omission` profile leave the question blank, which the backend
 * reads as an omission — a real and common way to get one wrong. Where a child's
 * usual shape cannot apply to a particular answer (reversing a single digit,
 * scaling zero) the result falls back to an off-by-one, so the value is always
 * something the classifier can read.
 */
export function simulateWrongAnswer(correctAnswer: unknown, studentId: string): string {
  const expected = toNumber(
    correctAnswer && typeof correctAnswer === 'object' && 'number' in (correctAnswer as any)
      ? (correctAnswer as any).number
      : correctAnswer
  );

  // Choice and text questions carry no digit-level morphology, so there is no
  // shape to simulate — the backend files any non-numeric wrong answer under
  // gross magnitude, which is the honest "no digit-level diagnosis" bucket.
  //
  // Explicitly NOT a blank. A blank is a meaningful signal, recorded as a real
  // omission, and on a Class 2 paper nearly half the items are shape and colour
  // questions: blanking them made omission 46% of every child's signature and
  // buried the pattern the child actually has.
  if (expected === null) {
    const raw = String(correctAnswer ?? '').trim();
    if (raw === '') return '';

    // Comparison items are the one non-numeric question with a real and common
    // wrong answer: the child reads the inequality the other way round.
    const flipped: Record<string, string> = { '<': '>', '>': '<', '=': '<' };
    if (flipped[raw]) return flipped[raw];

    const words = raw.split(/\s+/);
    const reversed =
      words.length > 1 ? [...words].reverse().join(' ') : [...raw].reverse().join('');
    // Palindromes and single characters reverse to themselves, which would hand
    // back the correct answer as though it were wrong.
    return reversed === raw ? `${raw}${raw}` : reversed;
  }

  const morphology = morphologyForStudent(studentId);

  // Checked before `applyMorphology`, whose null return means "this shape does
  // not apply here" and falls through to an off-by-one. A blank is the intended
  // output for this child, not a failure to produce one.
  if (morphology === 'omission') return '';

  const value = applyMorphology(expected, morphology);
  if (value === null || value === expected) {
    // Fall back to a plain off-by-one rather than emitting the correct answer.
    const fallback = expected + 1;
    return fallback === expected ? '' : formatNumber(fallback);
  }
  return formatNumber(value);
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}
