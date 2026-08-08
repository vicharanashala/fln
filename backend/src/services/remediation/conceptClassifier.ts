/**
 * Lightweight Concept & Intent Classifier for FLN Remediation Blueprint Engine.
 * Predicts mathematical & educational concepts from scanned question text
 * when keyword dictionaries do not match directly.
 */

export interface ClassifierPattern {
  concept: string;
  pattern: RegExp;
  weight?: number;
}

const CLASSIFIER_PATTERNS: ClassifierPattern[] = [
  // ── SPECIFIC FLN SLUGS & INTERACTIVE EXERCISES ──────────────────────────────
  { concept: 'Match the Tallies', pattern: /\b(match the tallies|tallies|tally marks?|tally chart|tally count|count-and-tally|count and tally|tally-number-match|tally)\b/i },
  { concept: 'Time', pattern: /\b(clock|read the clock|clock-read-grid|clock-time-match|time|o'clock|half past)\b/i },
  { concept: 'Ordinal Numbers', pattern: /\b(ordinal|ordinal-circle-write|ordinal-position|stairs-position|race-position|queue-position|1st|2nd|3rd|4th|5th|position|queue)\b/i },
  { concept: 'MatchFingersToFruits', pattern: /\b(match fingers|fingers? to fruits?|finger matching|hand-object-match|count-hand-match)\b/i },
  { concept: 'Add and Match', pattern: /\b(add and match|addition and match|match addition)\b/i },

  // ── ALGEBRA & EQUATIONS ───────────────────────────────────────────────────
  { concept: 'Algebra', pattern: /\b\d*x\b|\bsolve for\b|\bequation\b|\bvariable\b|[a-z]\s*=\s*\d+/i },
  
  // ── GEOMETRY & MEASUREMENT ────────────────────────────────────────────────
  { concept: 'Geometry', pattern: /\b(area|perimeter|circumference|radius|diameter|angle|right angle|hypotenuse|triangle|quadrilateral|polygon|pentagon|hexagon)\b/i },
  { concept: 'Measurement', pattern: /\b(meters?|centimeters?|millimeters?|kilometers?|grams?|kilograms?|liters?|milliliters?|length|height|weight|volume|capacity|ruler-measure|paperclip-measure)\b/i },

  // ── PERCENTAGES & RATIOS ──────────────────────────────────────────────────
  { concept: 'Percentages', pattern: /%|\bpercent(age)?\b|\bout of 100\b/i },
  { concept: 'Ratios', pattern: /\bratio\b|\b\d+\s*:\s*\d+\b|\bproportions?\b/i },

  // ── PROBABILITY & STATISTICS ─────────────────────────────────────────────
  { concept: 'Probability', pattern: /\b(probability|chance|likelihood|spinners?|dice|die|coin toss|outcomes?)\b/i },
  { concept: 'Statistics', pattern: /\b(mean|median|mode|average|range|frequency|histogram)\b/i },

  // ── FRACTIONS & DECIMALS ─────────────────────────────────────────────────
  { concept: 'Fractions', pattern: /\b\d+\/\d+\b|\bnumerator\b|\bdenominator\b|\bhalf\b|\bquarter\b|\bthird\b/i },
  { concept: 'Decimals', pattern: /\b0\.\d+|\bdecimal(s)?\b|\btenths\b|\bhundredths\b/i },

  // ── ARITHMETIC & NUMBER SENSE ────────────────────────────────────────────
  { concept: 'Multiplication', pattern: /\b(multiply|times|product|multiplied by|x\s*\d+=)\b/i },
  { concept: 'Division', pattern: /\b(divide|quotient|divided by|equal sharing|equal groups|÷)\b/i },
  { concept: 'Addition', pattern: /\b(add|addition|sum|total|altogether|plus)\b|\+/i },
  { concept: 'Subtraction', pattern: /\b(subtract|subtraction|minus|difference|take away|remaining|left)\b|-(?!\d)/i },
  { concept: 'Place Value', pattern: /\b(place value|expanded form|hundreds|tens|ones|units|tens-ones|tens-units)\b/i }
];

/**
 * Classifies question text using pattern matching heuristics / NLP rules.
 * Returns the predicted concept name or empty string if no pattern matches.
 */
export function aiClassifyConcept(questionText: string): string {
  if (!questionText || typeof questionText !== 'string') return '';
  
  const text = questionText.trim();
  
  for (const { concept, pattern } of CLASSIFIER_PATTERNS) {
    if (pattern.test(text)) {
      return concept;
    }
  }

  return '';
}
