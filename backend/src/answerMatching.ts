/**
 * Deciding whether a child's written answer matches the expected one.
 *
 * This is the single most consequential comparison in the diagnostic path:
 * its result feeds `recommendedLevel`, so a false negative here does not just
 * lose a mark — it places the child at a lower level and hands them the wrong
 * worksheets. The inputs are OCR'd handwriting, so surface-level variation is
 * the norm rather than the exception.
 *
 * The rule followed here: normalise only differences that are unambiguously
 * *notation*, never differences that could be a genuine misconception. "07"
 * and "7" are the same number written two ways. "2/3" and "0.67" are not
 * obviously the same claim by a seven-year-old, and treating them as equal
 * would erase exactly the evidence the misconception work needs. So numeric
 * equality is applied only when BOTH sides parse as plain numbers, and
 * anything else falls back to a normalised string compare.
 */

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

function asNumber(normalized: string): number | null {
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
