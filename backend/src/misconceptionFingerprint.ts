/**
 * Misconception Fingerprinting — "same score, different mind".
 *
 * Every assessment product in this space reduces a child to a scalar: a score,
 * and a level derived from it. Two children on 40% get the same worksheet next
 * week. This module reads the raw material we already persist and throw away —
 * `AnswerSubmission.answers` joined against `Worksheet.questions` — and builds
 * a per-child *error-signature vector* describing HOW the child fails rather
 * than HOW MUCH.
 *
 * The cohort is then clustered on that vector, and each cluster is named from
 * its own most distinctive features. The archetypes are therefore *discovered*,
 * not drawn from a predefined taxonomy: a cohort with no place-value problem
 * will not produce a place-value archetype.
 *
 * Design rules:
 *  - No new runtime dependencies. The clustering is implemented here in ~200
 *    lines of plain TS rather than pulling in an ML library.
 *  - Nothing in this module throws. It is a read-only analysis layer over
 *    already-graded data; a defect here must never affect grading or levels.
 *  - The naming pass degrades to a deterministic label when Gemini is
 *    unavailable.
 *
 * THE LOAD-BEARING DESIGN DECISION: overall accuracy is deliberately NOT a
 * feature. Every dimension below is conditioned on the child's *incorrect*
 * answers only. That is what makes two children on an identical score land in
 * different clusters — if score leaked into the vector, it would dominate the
 * distance metric and we would have rebuilt the thing we are trying to replace.
 */

import { Type } from "@google/genai";
import { generateContentWithRetry, DEFAULT_GEMINI_MODEL } from "./gemini";
import type {
  Student,
  Question,
  Worksheet,
  AnswerSubmission,
  EvaluationReport
} from "./db";
import { dbStore, type MisconceptionCluster } from "./db";

/* ------------------------------------------------------------------ *
 * Feature space
 * ------------------------------------------------------------------ */

/**
 * Error morphology: what a wrong answer *looks like* relative to the right one.
 *
 * Each incorrect response is classified into exactly one bucket by the priority
 * cascade in `classifyError`, so these nine features form a proper distribution
 * summing to 1. Mutually exclusive buckets keep the cluster centroids readable
 * ("62% place-value") instead of a soup of overlapping indicators.
 */
export const MORPHOLOGY_KEYS = [
  "offByOne",
  "placeValueTenfold",
  "digitConcatenation",
  "digitReversal",
  "digitPermutation",
  "operationSubstitution",
  "nearMiss",
  "grossMagnitude",
  "omission"
] as const;

/** Where the errors cluster, independent of what they look like. */
export const DISTRIBUTION_KEYS = [
  "topicConcentration",
  "carryBorrowSpecific",
  "multiDigitSpecific",
  "belowLevelFailure",
  "hardOnlyFailure"
] as const;

/**
 * Is the child's failure *reliable*?
 *
 * Everything in the two blocks above is conditioned on the child's errors, and
 * so answers "what do the mistakes look like". None of it can answer "does this
 * child fail this skill every time, or only sometimes" — and that distinction is
 * the whole difference between a misconception and carelessness. A child who
 * writes 27+15 as 312 *every* time holds a wrong rule. A child who gets three
 * regrouping questions right and slips on the fourth holds the right rule and
 * lost attention.
 *
 * These three are therefore conditioned on OPPORTUNITIES, not on errors: they
 * need to know about the questions the child got right. They remain score-blind
 * because each is symmetric or shape-based rather than a raw failure rate — see
 * the note on `skillInconsistency` below.
 */
export const CONSISTENCY_KEYS = [
  "errorDispersion",
  "skillInconsistency",
  "contextSpecificity"
] as const;

export const FEATURE_KEYS = [
  ...MORPHOLOGY_KEYS,
  ...DISTRIBUTION_KEYS,
  ...CONSISTENCY_KEYS
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type FeatureVector = Record<FeatureKey, number>;

/**
 * Relative weight of each block when measuring distance between two children.
 *
 * Morphology is the strongest signal about the underlying mental model, so it
 * carries the most weight; where the errors land is corroborating evidence and
 * is damped accordingly.
 */
const BLOCK_WEIGHTS: Record<FeatureKey, number> = {
  offByOne: 1.0,
  placeValueTenfold: 1.0,
  digitConcatenation: 1.0,
  digitReversal: 1.0,
  digitPermutation: 1.0,
  operationSubstitution: 1.0,
  nearMiss: 1.0,
  grossMagnitude: 1.0,
  omission: 1.0,
  topicConcentration: 0.7,
  carryBorrowSpecific: 0.7,
  multiDigitSpecific: 0.7,
  belowLevelFailure: 0.7,
  hardOnlyFailure: 0.7,
  // Reliability is as diagnostic as morphology — "sometimes" versus "always" is
  // a different child, not a different amount of the same child — so dispersion
  // and inconsistency carry near-full weight. Specificity is corroborating.
  errorDispersion: 1.0,
  skillInconsistency: 0.85,
  contextSpecificity: 0.5
};

/** Human-facing labels; used for cluster naming and the dossier UI. */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  offByOne: "off-by-one answers",
  placeValueTenfold: "answers wrong by a factor of ten",
  digitConcatenation: "column digits written side by side instead of regrouped",
  digitReversal: "digits written in reverse order",
  digitPermutation: "right digits, wrong order",
  operationSubstitution: "the wrong operation applied",
  nearMiss: "answers just short of correct",
  grossMagnitude: "answers of wildly wrong size",
  omission: "questions left blank",
  topicConcentration: "errors concentrated in one topic",
  carryBorrowSpecific: "errors only where carrying or borrowing is needed",
  multiDigitSpecific: "errors only on multi-digit numbers",
  belowLevelFailure: "failures on work below their own level",
  hardOnlyFailure: "failures confined to the hardest questions",
  errorDispersion: "mistakes with no consistent shape",
  skillInconsistency: "the same kind of question right once and wrong the next",
  contextSpecificity: "failures confined to one kind of question"
};

/**
 * The child's *own* strongest dimensions.
 *
 * Distinct from an archetype's `distinctiveFeatures`, which describe the group's
 * average. Showing the group's profile under an individual's name is right only
 * for a child who sits exactly on the centroid; for anyone else it reports
 * numbers that are not theirs.
 */
export function topFeatures(
  vector: FeatureVector,
  limit = 4
): Array<{ key: FeatureKey; label: string; value: number }> {
  // Morphology leads. "Errors concentrated in one topic" sits at 1.0 for nearly
  // every child on a single-topic worksheet, so ranking on raw value alone would
  // hand the top row to the least informative dimension in the vector.
  const rank = (key: FeatureKey) =>
    (MORPHOLOGY_KEYS as readonly string[]).includes(key) ? 0 : 1;

  return FEATURE_KEYS.map(key => ({ key, label: FEATURE_LABELS[key], value: vector[key] }))
    .filter(f => f.value > 0.05)
    .sort((a, b) => rank(a.key) - rank(b.key) || b.value - a.value)
    .slice(0, limit);
}

function emptyVector(): FeatureVector {
  return FEATURE_KEYS.reduce((acc, k) => {
    acc[k] = 0;
    return acc;
  }, {} as FeatureVector);
}

/* ------------------------------------------------------------------ *
 * Numeric / textual helpers
 * ------------------------------------------------------------------ */

/** Parse a response into a number, tolerating stray spaces, commas and units. */
function toNumber(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  const cleaned = String(raw).replace(/[,\s]/g, "");
  if (cleaned === "") return null;
  const m = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * The prompt text of a question, or null when the stored record carries none.
 *
 * `Question.question` is typed as a string, but some diagnostic banks persist
 * the item's ordinal there instead of its wording (`q.question === 1`). Handing
 * that to the text parsers below is what produced `prompt.match is not a
 * function`. A number is not a malformed prompt — it is the absence of one — so
 * it is excluded rather than stringified: "1" would parse as the operand 1 and
 * yield a confident wrong reading, which is worse than no reading at all.
 */
function questionText(question: Question): string | null {
  const raw: unknown = question?.question;
  if (typeof raw !== "string") return null;
  return raw.trim() === "" ? null : raw;
}

/** Every integer appearing in a question prompt, in order — the operands. */
function parseOperands(prompt: string): number[] {
  const matches = prompt.match(/\d+(?:\.\d+)?/g);
  if (!matches) return [];
  return matches.map(Number).filter(Number.isFinite);
}

/** Which arithmetic operation a prompt is asking for, if it can be told. */
function detectOperation(prompt: string): "+" | "-" | "*" | "/" | null {
  const p = prompt.toLowerCase();
  if (/[+]|\bplus\b|\badd(ed|ition)?\b|\baltogether\b|\bsum\b|\btotal\b/.test(p)) return "+";
  if (/[-−]|\bminus\b|\bsubtract\b|\bless\b|\bdifference\b|\bleft\b|\bfewer\b/.test(p)) return "-";
  if (/[*×x]\b|\btimes\b|\bmultipl(y|ied)\b|\bproduct\b|\beach\b/.test(p)) return "*";
  if (/[/÷]|\bdivide[d]?\b|\bshared?\b|\bquotient\b|\bper\b/.test(p)) return "/";
  return null;
}

function digitsOf(n: number): string {
  return String(Math.abs(Math.trunc(n)));
}

/**
 * Does this pair of operands require carrying (addition) or borrowing
 * (subtraction)? This is the single most diagnostic property of a question for
 * place-value faults — a child with a regrouping fault is correct on 23+41 and
 * wrong on 27+15, and no score-based system can see the difference.
 */
function requiresRegrouping(a: number, b: number, op: "+" | "-" | "*" | "/"): boolean {
  const x = Math.abs(Math.trunc(a));
  const y = Math.abs(Math.trunc(b));
  if (op === "+") {
    let carry = 0;
    let p = x;
    let q = y;
    while (p > 0 || q > 0) {
      const sum = (p % 10) + (q % 10) + carry;
      if (sum >= 10) return true;
      carry = 0;
      p = Math.floor(p / 10);
      q = Math.floor(q / 10);
    }
    return false;
  }
  if (op === "-") {
    const hi = Math.max(x, y);
    const lo = Math.min(x, y);
    let p = hi;
    let q = lo;
    while (q > 0) {
      if (p % 10 < q % 10) return true;
      p = Math.floor(p / 10);
      q = Math.floor(q / 10);
    }
    return false;
  }
  // Multiplication/division regrouping is a different skill; treat any
  // multi-digit operand as the analogous load.
  return x > 9 || y > 9;
}

/**
 * The answer a child produces when they add each column independently and write
 * the results side by side instead of regrouping: 27 + 15 -> "3" and "12" -> 312.
 * This is the classic concatenation error and it is worth detecting exactly,
 * because it is invisible to scoring but predicts total collapse later on.
 */
function concatenationAnswer(a: number, b: number, op: "+" | "-" | "*" | "/"): string | null {
  if (op !== "+" && op !== "-") return null;
  const x = digitsOf(a).split("").reverse();
  const y = digitsOf(b).split("").reverse();
  const width = Math.max(x.length, y.length);
  const cols: string[] = [];
  for (let i = 0; i < width; i++) {
    const p = Number(x[i] ?? "0");
    const q = Number(y[i] ?? "0");
    cols.push(String(op === "+" ? p + q : Math.abs(p - q)));
  }
  return cols.reverse().join("");
}

function isPowerOfTenRatio(sub: number, exp: number): boolean {
  if (exp === 0 || sub === 0) return false;
  const ratio = Math.abs(sub) / Math.abs(exp);
  for (const r of [10, 100, 1000, 0.1, 0.01, 0.001]) {
    if (Math.abs(ratio - r) < 1e-9) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ *
 * Error classification
 * ------------------------------------------------------------------ */

export type ErrorMorphology = (typeof MORPHOLOGY_KEYS)[number];

/**
 * Can the classifier actually read this question well enough to judge the shape
 * of a wrong answer?
 *
 * The decisive test is whether the operands we pulled out of the prompt actually
 * reproduce the known correct answer. If they do not, we have misread the
 * question — "Ram has 5 boxes of 27 pens and buys 15 more" parses as 5 and 27,
 * which is a confident wrong reading rather than an obvious failure. That case
 * is more dangerous than an unreadable prompt, because everything downstream
 * still looks well-formed.
 */
function isReadable(question: Question, submitted: string): boolean {
  const expected = toNumber(question.answer);
  const actual = toNumber(submitted);
  if (expected === null || actual === null) return false;

  const text = questionText(question);
  if (!text) return false;

  const operands = parseOperands(text);
  const op = detectOperation(text);
  if (operands.length < 2 || !op) return false;

  const [a, b] = operands;
  const computed =
    op === "+" ? a + b : op === "-" ? Math.abs(a - b) : op === "*" ? a * b : b !== 0 ? a / b : NaN;
  return Number.isFinite(computed) && Math.abs(computed - expected) < 1e-9;
}

/**
 * Assign one incorrect response to exactly one morphology bucket.
 *
 * Order matters: the more *specific* and diagnostic a pattern is, the earlier
 * it is tested. A concatenation error is also technically a "gross magnitude"
 * error, but calling it gross magnitude would throw away the entire diagnosis.
 */
export function classifyError(
  question: Question,
  submitted: string | undefined
): ErrorMorphology {
  const raw = (submitted ?? "").trim();
  if (raw === "") return "omission";

  const expected = toNumber(question.answer);
  const actual = toNumber(raw);

  // Non-numeric answers (choice/text questions): compare as strings and fall
  // back to a coarse bucket, since digit-level morphology is meaningless.
  if (expected === null || actual === null) {
    return "grossMagnitude";
  }

  // Without prompt text there are no operands to reason about; the digit-level
  // and magnitude rules below still apply, since they need only the two numbers.
  const text = questionText(question);
  const operands = text ? parseOperands(text) : [];
  const op = text ? detectOperation(text) : null;

  if (operands.length >= 2 && op) {
    const [a, b] = operands;

    const concat = concatenationAnswer(a, b, op);
    if (concat !== null && concat === digitsOf(actual) && actual !== expected) {
      return "digitConcatenation";
    }

    // Did they run a different operation than the one asked for?
    const alternatives: Record<string, number> = {
      "+": a + b,
      "-": Math.abs(a - b),
      "*": a * b,
      "/": b !== 0 ? a / b : NaN
    };
    for (const [altOp, altVal] of Object.entries(alternatives)) {
      if (altOp === op) continue;
      if (Number.isFinite(altVal) && Math.abs(altVal - actual) < 1e-9) {
        return "operationSubstitution";
      }
    }
  }

  const expDigits = digitsOf(expected);
  const actDigits = digitsOf(actual);

  if (expDigits.length > 1) {
    if (actDigits === expDigits.split("").reverse().join("")) return "digitReversal";
    const sortedEq =
      expDigits.split("").sort().join("") === actDigits.split("").sort().join("");
    if (sortedEq && actDigits !== expDigits) return "digitPermutation";
  }

  if (isPowerOfTenRatio(actual, expected)) return "placeValueTenfold";

  const diff = Math.abs(actual - expected);
  if (Math.abs(diff - 1) < 1e-9) return "offByOne";

  // A bare difference of exactly 10/100 is a place-value slip too.
  if ([10, 100, 1000].some(d => Math.abs(diff - d) < 1e-9)) return "placeValueTenfold";

  const rel = diff / Math.max(Math.abs(expected), 1);
  if (rel <= 0.15) return "nearMiss";
  return "grossMagnitude";
}

/* ------------------------------------------------------------------ *
 * Signature construction
 * ------------------------------------------------------------------ */

export interface ErrorInstance {
  questionId: string;
  prompt: string;
  expected: string;
  submitted: string;
  morphology: ErrorMorphology;
  topic: string;
  sourceLevel: number;
  difficulty: Question["difficulty"];
  requiredRegrouping: boolean;
  multiDigit: boolean;
  /**
   * The classifier could not read this question or answer well enough to judge
   * the mistake's shape, so its bucket is a fallback rather than a finding.
   *
   * Tracked separately because the catch-all bucket otherwise conflates "an
   * answer of wildly wrong size" (a real diagnosis) with "we could not parse
   * this" (no diagnosis at all) — and a rising pile of the latter is the only
   * signal that the nine rules have stopped covering the material.
   */
  unparsed: boolean;
}

/**
 * Where a child is weak, expressed in the platform's own vocabulary.
 *
 * This is the Python pipeline's contribution, computed deterministically. That
 * pipeline maps each wrong answer to an FLN level and applies a
 * "minimum failure level" rule — if a child fails at Level 3 and Level 12, they
 * are placed at 3, because the higher skill stands on the lower one. The rule is
 * sound and needs no model: the level and topic of every question are already on
 * the worksheet, so the only inputs are facts we hold.
 *
 * Fingerprinting says HOW a child fails; this says WHERE. Together they are the
 * sentence a teacher can act on: "loses the tens when carrying — and it starts
 * at Level 12, in Number Operations."
 */
export interface ChildWeakness {
  /** Lowest level at which anything was got wrong. Null when nothing was. */
  weakestLevel: number | null;
  /** Every distinct level with at least one wrong answer, ascending. */
  levelsFailed: number[];
  /**
   * Per-topic failure rate over questions actually attempted — a rate, not a
   * count, so a topic with two questions is not ranked below one with twenty.
   */
  topics: Array<{ topic: string; wrong: number; attempted: number; rate: number }>;
}

/** A topic counts as a weakness for a child at or above this failure rate. */
const WEAK_TOPIC_RATE = 0.5;

function buildWeakness(attempts: Attempt[], errors: ErrorInstance[]): ChildWeakness {
  const levels = Array.from(new Set(errors.map(e => e.sourceLevel)))
    .filter(n => Number.isFinite(n))
    .sort((a, b) => a - b);

  const attemptedByTopic = new Map<string, number>();
  for (const a of attempts) {
    attemptedByTopic.set(a.topic, (attemptedByTopic.get(a.topic) ?? 0) + 1);
  }
  const wrongByTopic = new Map<string, number>();
  for (const e of errors) {
    wrongByTopic.set(e.topic, (wrongByTopic.get(e.topic) ?? 0) + 1);
  }

  const topics = Array.from(wrongByTopic.entries())
    .map(([topic, wrong]) => {
      const attempted = attemptedByTopic.get(topic) ?? wrong;
      return { topic, wrong, attempted, rate: Number((wrong / attempted).toFixed(3)) };
    })
    .sort((a, b) => b.rate - a.rate || b.wrong - a.wrong);

  return { weakestLevel: levels.length > 0 ? levels[0] : null, levelsFailed: levels, topics };
}

export interface StudentFingerprint {
  studentId: string;
  studentName: string;
  classGroup: string;
  currentLevel: number;
  /** Included for the UI headline only — never fed into the vector. */
  score: number;
  totalAnswered: number;
  totalIncorrect: number;
  vector: FeatureVector;
  /** This child's own strongest dimensions — never the archetype's average. */
  signature: Array<{ key: FeatureKey; label: string; value: number }>;
  /** Where this child is weak: lowest failing level and per-topic failure rates. */
  weakness: ChildWeakness;
  /** The individual errors behind the vector, for the evidence drawer. */
  errors: ErrorInstance[];
  clusterId?: number;
  /** Distance to its own centroid — how typical of the archetype this child is. */
  clusterDistance?: number;
  /**
   * This child fails in two substantially different ways at once.
   *
   * k-means gives every child exactly one label, but children mix. Saying so is
   * what stops a hard assignment from reading as a firm single diagnosis.
   */
  mixedProfile?: boolean;
  /** Nearest archetype other than their own — the "also shows signs of" line. */
  secondaryClusterId?: number;
  secondaryDistance?: number;
  /**
   * Set when the child was left out of the clustering for lack of evidence.
   * They are still reported — a real cohort is mostly children with one or two
   * wrong answers, and silently dropping them was how this feature came to look
   * like it only worked on a fixture.
   */
  insufficientEvidence?: boolean;
  evidenceReason?: "TOO_FEW_ERRORS";
  glyph: GlyphSpec;
}

/**
 * One question the child actually attempted — right or wrong.
 *
 * The error-only view cannot see these. Retaining the correct answers with their
 * properties is what makes "fails this every time" distinguishable from "fails
 * this half the time".
 */
interface Attempt {
  correct: boolean;
  topic: string;
  difficulty: Question["difficulty"];
  requiredRegrouping: boolean;
  sourceLevel: number;
}

/**
 * Group questions that make near-equivalent demands of the child.
 *
 * Topic alone is too coarse — "Number Operations" mixes 23+41 with 55+38, and a
 * child with a clean regrouping fault would look erratic inside it. Keying on
 * topic AND difficulty AND whether regrouping is required gives cells whose
 * members a child should succeed or fail on together if their behaviour is
 * rule-governed.
 *
 * The FLN level is part of the key because real question banks label whole
 * papers with one topic: a live diagnostic put ten questions spanning levels 2
 * to 10 into a single "Number Sense / easy" cell, and the child read as
 * maximally erratic purely because unrelated skills had been pooled. Questions
 * at different levels are different skills whatever the topic label says.
 */
function contextKey(a: Attempt): string {
  return `${a.topic}|${a.difficulty}|${a.requiredRegrouping ? "regroup" : "plain"}|L${a.sourceLevel}`;
}

/** A cell needs at least this many attempts before within-cell variation means anything. */
const MIN_CELL_SIZE = 2;

/**
 * Normalised Shannon entropy over the morphology distribution.
 *
 * 0 when every mistake has the same shape (a rule being misapplied); 1 when the
 * mistakes are as scattered as they could be (no rule at all).
 *
 * Normalised by the entropy actually *achievable* on this many errors, not by
 * log(9). Four mistakes cannot occupy nine buckets, so scoring them against nine
 * would cap a completely erratic child at 0.63 and make any fixed threshold a
 * measure of how many questions they answered. The floor of 3 errors before a
 * child is clustered is what stops this reading 1.0 off a single pair of slips.
 */
function morphologyEntropy(vector: FeatureVector, errorCount: number): number {
  const ps = MORPHOLOGY_KEYS.map(k => vector[k]).filter(p => p > 0);
  if (ps.length <= 1) return 0;
  const maxBuckets = Math.min(MORPHOLOGY_KEYS.length, Math.max(2, errorCount));
  const h = -ps.reduce((acc, p) => acc + p * Math.log(p), 0);
  return Math.max(0, Math.min(1, h / Math.log(maxBuckets)));
}

/**
 * Reliability of failure, measured over equivalent-question cells.
 *
 * `inconsistency` is the opportunity-weighted mean of 4·r·(1−r) where r is the
 * cell's failure rate. That peaks at r = 0.5 and is zero at both r = 0 and
 * r = 1 — reliably right and reliably wrong score the same. That symmetry is
 * what keeps it out of the score's reach: it measures whether behaviour is
 * rule-governed, not how much of it succeeded.
 *
 * `specificity` is the spread of failure rates across cells. A structural fault
 * ruins one cell and spares another (wide spread); inattention and wholesale
 * collapse are both flat (narrow spread). Pairing the two separates the three
 * cases that a failure rate alone confuses.
 */
function consistencyStats(attempts: Attempt[]): { inconsistency: number; specificity: number } {
  const cells = new Map<string, { n: number; wrong: number }>();
  for (const a of attempts) {
    const key = contextKey(a);
    const cell = cells.get(key) ?? { n: 0, wrong: 0 };
    cell.n++;
    if (!a.correct) cell.wrong++;
    cells.set(key, cell);
  }

  const usable = Array.from(cells.values()).filter(c => c.n >= MIN_CELL_SIZE);
  if (usable.length === 0) return { inconsistency: 0, specificity: 0 };

  const totalN = usable.reduce((acc, c) => acc + c.n, 0);
  const inconsistency =
    usable.reduce((acc, c) => {
      const r = c.wrong / c.n;
      return acc + c.n * 4 * r * (1 - r);
    }, 0) / totalN;

  const rates = usable.map(c => c.wrong / c.n);
  const specificity = usable.length > 1 ? Math.max(...rates) - Math.min(...rates) : 0;

  return {
    inconsistency: Math.max(0, Math.min(1, inconsistency)),
    specificity: Math.max(0, Math.min(1, specificity))
  };
}

/** Herfindahl concentration of a count map, normalised to [0,1]. */
function concentration(counts: Map<string, number>): number {
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const k = counts.size;
  if (k <= 1) return 1;
  const h = Array.from(counts.values()).reduce((acc, c) => acc + (c / total) ** 2, 0);
  // Rescale so an even spread across k topics maps to 0 and total focus to 1.
  const min = 1 / k;
  return Math.max(0, Math.min(1, (h - min) / (1 - min)));
}

/** Build one child's signature from every submission they have made. */
export function buildFingerprint(
  student: Student,
  submissions: AnswerSubmission[],
  worksheetsById: Map<string, Worksheet>
): StudentFingerprint | null {
  const errors: ErrorInstance[] = [];
  const attempts: Attempt[] = [];
  let totalAnswered = 0;
  let totalCorrect = 0;

  for (const sub of submissions) {
    // The worksheet is the usual source of the questions, but a diagnostic and
    // an ICR scan are generated per child and never stored as one — they carry
    // their paper on the submission instead. Either way what is needed is the
    // same: the questions these answers were written against.
    const ws = worksheetsById.get(sub.worksheetId);
    const questions = ws?.questions ?? sub.questions;
    if (!questions || questions.length === 0) continue;
    const byId = new Map(questions.map(q => [q.question_id, q]));

    for (const [qid, submitted] of Object.entries(sub.answers ?? {})) {
      const q = byId.get(qid);
      if (!q) continue;
      totalAnswered++;

      const text = questionText(q);
      const operands = text ? parseOperands(text) : [];
      const op = text ? detectOperation(text) : null;
      const requiredRegrouping =
        operands.length >= 2 && op ? requiresRegrouping(operands[0], operands[1], op) : false;

      const isCorrect =
        String(submitted).trim().toLowerCase() === String(q.answer).trim().toLowerCase();

      // Recorded for correct answers too — the consistency block is defined over
      // opportunities, so the successes are the half of the evidence that the
      // error-only features structurally cannot see.
      attempts.push({
        correct: isCorrect,
        topic: q.topic || "Unclassified",
        difficulty: q.difficulty,
        requiredRegrouping,
        sourceLevel: q.source_level
      });

      if (isCorrect) {
        totalCorrect++;
        continue;
      }

      const answer = String(submitted);
      const morphology = classifyError(q, submitted);

      // "No diagnosis at all" means we could not line the child's answer up
      // against the expected one — a non-numeric response where a number was
      // wanted. A specific shape (off-by-one, reversal) or a numeric answer of
      // wildly wrong size IS a diagnosis, whether or not the prompt happens to
      // be two-operand arithmetic.
      //
      // Gating this on the prompt instead, as it was, made the count report on
      // the questions rather than the mistakes: a class whose answers were all
      // cleanly classified as offByOne and nearMiss still read "89% did not
      // match any of the nine known error patterns", because "Identify the
      // place value of the underlined digit" has no operands to verify.
      const comparable = toNumber(q.answer) !== null && toNumber(answer) !== null;

      // The two operand-derived readings are only as good as our parse of the
      // prompt. If the operands do not reproduce the known answer we misread the
      // question, and a confident "they subtracted instead of adding" is worse
      // than admitting we have nothing.
      const operandDerived =
        morphology === "digitConcatenation" || morphology === "operationSubstitution";

      errors.push({
        questionId: qid,
        prompt: text ?? "",
        expected: q.answer,
        submitted: answer,
        morphology,
        topic: q.topic || "Unclassified",
        sourceLevel: q.source_level,
        difficulty: q.difficulty,
        requiredRegrouping,
        multiDigit: operands.some(n => Math.abs(n) > 9),
        // A blank is a genuine finding (omission), not a parse failure.
        unparsed:
          answer.trim() !== "" && (!comparable || (operandDerived && !isReadable(q, answer)))
      });
    }
  }

  if (totalAnswered === 0) return null;

  const vector = emptyVector();
  const nErr = errors.length;

  if (nErr > 0) {
    for (const key of MORPHOLOGY_KEYS) {
      vector[key] = errors.filter(e => e.morphology === key).length / nErr;
    }

    const topicCounts = new Map<string, number>();
    for (const e of errors) topicCounts.set(e.topic, (topicCounts.get(e.topic) ?? 0) + 1);
    vector.topicConcentration = concentration(topicCounts);

    // Conditional rates: of the errors made, how many sat on questions with the
    // relevant property. A child who only breaks when regrouping is required
    // scores ~1 here regardless of how many questions they got right.
    vector.carryBorrowSpecific = errors.filter(e => e.requiredRegrouping).length / nErr;
    vector.multiDigitSpecific = errors.filter(e => e.multiDigit).length / nErr;
    vector.belowLevelFailure =
      errors.filter(e => e.sourceLevel < student.currentLevel).length / nErr;
    vector.hardOnlyFailure = errors.filter(e => e.difficulty === "hard").length / nErr;

    vector.errorDispersion = morphologyEntropy(vector, nErr);
  }

  // Computed over every attempt, so it is defined even for a child with no
  // errors at all (who scores 0 on both, correctly: nothing is erratic).
  const consistency = consistencyStats(attempts);
  vector.skillInconsistency = consistency.inconsistency;
  vector.contextSpecificity = consistency.specificity;

  const score = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  return {
    studentId: student.id,
    studentName: student.name,
    classGroup: student.classGroup,
    currentLevel: student.currentLevel,
    score,
    totalAnswered,
    totalIncorrect: nErr,
    vector,
    signature: topFeatures(vector),
    weakness: buildWeakness(attempts, errors),
    errors,
    glyph: buildGlyph(vector, student.id)
  };
}

/**
 * Build one child's signature from a completed EvaluationReport.
 *
 * The submission-based path above needs `AnswerSubmission.answers` joined to
 * `Worksheet.questions`. Several diagnostics — the 36-question paper among them
 * — are persisted only as an `EvaluationReport`, so those children had no
 * fingerprint at all and were silently dropped from clustering.
 *
 * A report records what the child got wrong and where, but never what they
 * wrote. The nine morphology dimensions are therefore structurally unavailable
 * here and are left at zero rather than guessed at — a fabricated morphology
 * would be indistinguishable from a real one downstream. What a report *does*
 * carry (per-error topic, FLN level and error type; per-difficulty attempt
 * counts; the per-topic mastery verdicts) drives the distribution and
 * consistency blocks, which is what the archetype decision reads.
 */
export function buildFingerprintFromEvaluationReport(
  student: Student,
  report: EvaluationReport
): StudentFingerprint | null {
  const totalAnswered = Math.trunc(Number(report.totalQuestions));
  if (!Number.isFinite(totalAnswered) || totalAnswered <= 0) return null;

  const rawScore = Math.trunc(Number(report.score));
  const totalCorrect = Number.isFinite(rawScore)
    ? Math.max(0, Math.min(totalAnswered, rawScore))
    : 0;
  const totalIncorrect = totalAnswered - totalCorrect;

  const rootCauses = report.rootCauses ?? [];
  const vector = emptyVector();

  /* --- Distribution block ------------------------------------------------ */

  if (rootCauses.length > 0) {
    const topicCounts = new Map<string, number>();
    for (const rc of rootCauses) {
      const topic = rc.topic || "Unclassified";
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    }
    vector.topicConcentration = concentration(topicCounts);

    const referenceLevel = Number.isFinite(student.currentLevel)
      ? student.currentLevel
      : report.recommendedLevel;
    vector.belowLevelFailure =
      rootCauses.filter(rc => Number(rc.flnLevel) < referenceLevel).length / rootCauses.length;

    // `errorType` is the only account of error *shape* a report keeps. An even
    // spread across conceptual/careless/prerequisite is the report-level
    // equivalent of mistakes with no consistent shape; total focus on one type
    // is a child applying one wrong rule.
    const typeCounts = new Map<string, number>();
    for (const rc of rootCauses) {
      const errorType = rc.errorType || "unclassified";
      typeCounts.set(errorType, (typeCounts.get(errorType) ?? 0) + 1);
    }
    vector.errorDispersion = 1 - concentration(typeCounts);
  } else {
    // No per-error records. The mastery verdicts are the only account of where
    // the failures sit, so concentration is measured over those instead.
    const masteryWeights = new Map<string, number>();
    for (const [topic, mastery] of Object.entries(report.conceptMastery ?? {})) {
      if (mastery === "Strong") continue;
      masteryWeights.set(topic, mastery === "Needs Practice" ? 2 : 1);
    }
    if (masteryWeights.size > 0) vector.topicConcentration = concentration(masteryWeights);
  }

  /* --- Consistency block ------------------------------------------------- */

  // `performanceByDifficulty` is a genuine cell structure — attempts grouped by
  // a property of the question — which is exactly what the consistency features
  // are defined over. Topic and regrouping are unknown per attempt and so are
  // held constant; they drop out of the cell key rather than distorting it.
  const attempts: Attempt[] = [];
  for (const [difficulty, performance] of Object.entries(report.performanceByDifficulty ?? {})) {
    const attempted = Math.max(0, Math.trunc(Number(performance?.attempted)) || 0);
    const correct = Math.max(0, Math.min(attempted, Math.trunc(Number(performance?.correct)) || 0));
    for (let i = 0; i < attempted; i++) {
      attempts.push({
        correct: i < correct,
        topic: "Unclassified",
        difficulty: difficulty as Question["difficulty"],
        requiredRegrouping: false,
        sourceLevel: report.recommendedLevel
      });
    }
  }

  const wrongByDifficulty = attempts.filter(a => !a.correct).length;
  if (wrongByDifficulty > 0) {
    vector.hardOnlyFailure =
      attempts.filter(a => !a.correct && a.difficulty === "hard").length / wrongByDifficulty;
  }

  const consistency = consistencyStats(attempts);
  vector.skillInconsistency = consistency.inconsistency;
  vector.contextSpecificity = consistency.specificity;

  /* --- Weakness ---------------------------------------------------------- */

  const failedLevels = Array.from(
    new Set(
      (report.levelsFailed ?? rootCauses.map(rc => Number(rc.flnLevel)))
        .map(Number)
        .filter(Number.isFinite)
    )
  ).sort((a, b) => a - b);

  let weakTopics: ChildWeakness["topics"];
  if (rootCauses.length > 0) {
    const wrongByTopic = new Map<string, number>();
    for (const rc of rootCauses) {
      const topic = rc.topic || "Unclassified";
      wrongByTopic.set(topic, (wrongByTopic.get(topic) ?? 0) + 1);
    }
    // Attempts per topic are not recorded on a report, so `wrong` stands in for
    // `attempted` — the same convention `buildWeakness` uses when a topic has
    // errors but no matching attempt records.
    weakTopics = Array.from(wrongByTopic.entries())
      .map(([topic, wrong]) => ({ topic, wrong, attempted: wrong, rate: 1 }))
      .sort((a, b) => b.wrong - a.wrong);
  } else {
    // Counts are genuinely unknown here, so they are reported as zero and only
    // the rate carries meaning — translated from the mastery verdict.
    weakTopics = Object.entries(report.conceptMastery ?? {})
      .filter(([, mastery]) => mastery !== "Strong")
      .map(([topic, mastery]) => ({
        topic,
        wrong: 0,
        attempted: 0,
        rate: mastery === "Needs Practice" ? 1 : 0.5
      }))
      .sort((a, b) => b.rate - a.rate);
  }

  return {
    studentId: student.id,
    studentName: student.name,
    classGroup: student.classGroup,
    currentLevel: student.currentLevel,
    score: Math.round((totalCorrect / totalAnswered) * 100),
    totalAnswered,
    totalIncorrect,
    vector,
    signature: topFeatures(vector),
    weakness: {
      weakestLevel: failedLevels.length > 0 ? failedLevels[0] : null,
      levelsFailed: failedLevels,
      topics: weakTopics
    },
    // The report does not retain the child's own responses, so there is no
    // per-error evidence to show. Left empty rather than reconstructed.
    errors: [],
    glyph: buildGlyph(vector, student.id)
  };
}

/* ------------------------------------------------------------------ *
 * Clustering — k-means++ with silhouette-selected k
 * ------------------------------------------------------------------ */

/** Deterministic PRNG so the same cohort always yields the same archetypes. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toArray(v: FeatureVector): number[] {
  return FEATURE_KEYS.map(k => v[k] * BLOCK_WEIGHTS[k]);
}

function distance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

function meanPoint(points: number[][]): number[] {
  const dim = points[0].length;
  const out = new Array(dim).fill(0);
  for (const p of points) for (let i = 0; i < dim; i++) out[i] += p[i];
  return out.map(v => v / points.length);
}

function kmeans(points: number[][], k: number, seed: number): number[] {
  const rand = mulberry32(seed);
  const n = points.length;

  // k-means++ seeding: first centroid at random, each subsequent one chosen
  // with probability proportional to squared distance from the nearest chosen
  // centroid. Far better separation than uniform seeding on small cohorts.
  const centroids: number[][] = [points[Math.floor(rand() * n)].slice()];
  while (centroids.length < k) {
    const d2 = points.map(p => Math.min(...centroids.map(c => distance(p, c))) ** 2);
    const total = d2.reduce((a, b) => a + b, 0);
    if (total === 0) {
      centroids.push(points[Math.floor(rand() * n)].slice());
      continue;
    }
    let r = rand() * total;
    let idx = 0;
    for (let i = 0; i < n; i++) {
      r -= d2[i];
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    centroids.push(points[idx].slice());
  }

  let assignment = new Array(n).fill(0);
  for (let iter = 0; iter < 100; iter++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = distance(points[i], centroids[c]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (assignment[i] !== best) {
        assignment[i] = best;
        moved = true;
      }
    }
    for (let c = 0; c < centroids.length; c++) {
      const members = points.filter((_, i) => assignment[i] === c);
      if (members.length > 0) centroids[c] = meanPoint(members);
    }
    if (!moved) break;
  }
  return assignment;
}

/** Mean silhouette across all points — used to pick k without hardcoding it. */
function silhouette(points: number[][], assignment: number[], k: number): number {
  if (k < 2) return -1;
  const n = points.length;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const own = assignment[i];
    const sameIdx = points.filter((_, j) => assignment[j] === own && j !== i);
    if (sameIdx.length === 0) continue;
    const a = sameIdx.reduce((acc, p) => acc + distance(points[i], p), 0) / sameIdx.length;
    let b = Infinity;
    for (let c = 0; c < k; c++) {
      if (c === own) continue;
      const other = points.filter((_, j) => assignment[j] === c);
      if (other.length === 0) continue;
      const d = other.reduce((acc, p) => acc + distance(points[i], p), 0) / other.length;
      b = Math.min(b, d);
    }
    if (!Number.isFinite(b)) continue;
    total += (b - a) / Math.max(a, b);
  }
  return total / n;
}

/* ------------------------------------------------------------------ *
 * Archetypes
 * ------------------------------------------------------------------ */

export interface Archetype {
  clusterId: number;
  /**
   * Stable identity for this group, derived from its own statistics and never
   * from the model.
   *
   * `name` is written by Gemini and comes out differently on every run — the
   * same seven children have been "The Non-Regroupers", "The Column Stuffer"
   * and "Side-By-Side Regrouper" in one day. A teacher cannot organise a
   * remedial group around a label that changes overnight, and nothing can be
   * tracked across time or rolled up a hierarchy on one either. These two are
   * the durable handle; the model's wording sits on top as description.
   */
  slug: string;
  stableName: string;
  /** Discovered name — from Gemini, or a deterministic descriptive fallback. */
  name: string;
  description: string;
  /** What breaks later if this goes unaddressed. Drives the forward-risk line. */
  forwardRisk: string;
  teacherAction: string;
  memberCount: number;
  memberIds: string[];
  /** Feature keys most over-represented in this cluster vs the cohort mean. */
  distinctiveFeatures: Array<{ key: FeatureKey; label: string; value: number; lift: number }>;
  centroid: FeatureVector;
  /** True when the name came from the deterministic fallback, not the LLM. */
  namedByFallback: boolean;
  /**
   * This group has no stable error shape — its members fail erratically rather
   * than by a rule. Named deterministically and never sent to the LLM: asked to
   * infer a mental model from noise, a model will confidently supply one.
   */
  incoherent: boolean;
}

/**
 * Stable slug per dominant feature. Kept separate from the display names so
 * rewording the copy can never change a group's identity.
 */
const FEATURE_SLUGS: Partial<Record<FeatureKey, string>> = {
  offByOne: "off-by-one",
  placeValueTenfold: "place-value",
  digitConcatenation: "non-regrouping",
  digitReversal: "digit-reversal",
  digitPermutation: "digit-scramble",
  operationSubstitution: "wrong-operation",
  nearMiss: "near-miss",
  grossMagnitude: "magnitude",
  omission: "non-attempt",
  topicConcentration: "single-topic",
  carryBorrowSpecific: "regrouping",
  multiDigitSpecific: "multi-digit",
  belowLevelFailure: "below-level",
  hardOnlyFailure: "ceiling",
  errorDispersion: "no-pattern",
  skillInconsistency: "inconsistent",
  contextSpecificity: "specific"
};

/**
 * Give every archetype a slug that depends only on its own statistics.
 *
 * Two clusters in one cohort can share a dominant feature, so a collision is
 * broken with the next distinctive feature and finally with the cluster id —
 * never left ambiguous, because the slug is what membership is tracked by.
 */
function assignStableIdentity(archetypes: Archetype[]): void {
  const taken = new Set<string>();
  for (const a of archetypes) {
    const keys = a.distinctiveFeatures.map(f => f.key);
    let slug = (keys[0] && FEATURE_SLUGS[keys[0]]) || "mixed";
    if (taken.has(slug)) {
      const second = keys[1] && FEATURE_SLUGS[keys[1]];
      slug = second ? `${slug}-${second}` : `${slug}-${a.clusterId}`;
    }
    while (taken.has(slug)) slug = `${slug}-${a.clusterId}`;
    taken.add(slug);
    a.slug = slug;
    a.stableName = fallbackName(a.distinctiveFeatures);
  }
}

/** Descriptive, deterministic name used when Gemini is unavailable. */
/**
 * The name each dominant dimension earns. One home for the vocabulary: both the
 * cohort-level naming fallback and the per-archetype namer read this map, so a
 * pattern cannot end up called two different things depending on which path
 * happened to name it.
 */
const ARCHETYPE_NAMES: Partial<Record<FeatureKey, string>> = {
  offByOne: "The Off-By-One Counters",
  placeValueTenfold: "The Place-Value Slippers",
  digitConcatenation: "The Non-Regroupers",
  digitReversal: "The Digit Reversers",
  digitPermutation: "The Digit Scramblers",
  operationSubstitution: "The Operation Confusers",
  nearMiss: "The Near Missers",
  grossMagnitude: "The Magnitude-Blind",
  omission: "The Non-Attempters",
  topicConcentration: "The Single-Topic Blockers",
  carryBorrowSpecific: "The Regrouping Breakers",
  multiDigitSpecific: "The Multi-Digit Breakers",
  belowLevelFailure: "The Shaky Foundations",
  hardOnlyFailure: "The Ceiling Hitters"
};

/**
 * *When* the pattern shows, appended to the name.
 *
 * The morphology map alone yields fourteen possible names, so two archetypes
 * that fail the same way for different reasons — reversal everywhere versus
 * reversal only when regrouping — collide on one label and a teacher cannot
 * tell the resulting groups apart. The qualifier is drawn from the strongest
 * distribution/consistency dimension, which is exactly the axis the morphology
 * name does not carry.
 */
const ARCHETYPE_QUALIFIERS: Partial<Record<FeatureKey, string>> = {
  topicConcentration: "in one topic",
  carryBorrowSpecific: "when regrouping",
  multiDigitSpecific: "on multi-digit numbers",
  belowLevelFailure: "below their level",
  hardOnlyFailure: "at the ceiling",
  errorDispersion: "with no fixed shape",
  skillInconsistency: "intermittently",
  contextSpecificity: "in one kind of question"
};

/** What a teacher should do about it — the field Gemini would otherwise write. */
const ARCHETYPE_ACTIONS: Partial<Record<FeatureKey, string>> = {
  offByOne:
    "Move the child off counting-on: build number bonds to ten so sums are recalled, not stepped out.",
  placeValueTenfold:
    "Rebuild place value with bundled tens before any further column work.",
  digitConcatenation:
    "Teach regrouping explicitly with base-ten material; the child is writing columns side by side.",
  digitReversal:
    "Check for reversal when reading as well as writing before treating this as an arithmetic fault.",
  digitPermutation:
    "Practise reading and writing multi-digit numbers in order; the arithmetic itself may be sound.",
  operationSubstitution:
    "Drill symbol recognition — the method is intact but the wrong operation is being selected.",
  nearMiss:
    "Target the final step; the approach is right and the error is arriving late in the working.",
  grossMagnitude:
    "Build estimation and answer-size checking before accuracy work — answers are not being sanity-checked.",
  omission:
    "Find out whether these are unattempted from difficulty or from time; the score understates the child either way.",
  topicConcentration: "Reteach the single blocking topic rather than reviewing broadly.",
  carryBorrowSpecific: "Target carrying and borrowing directly; everything else is holding.",
  multiDigitSpecific: "Extend from single- to multi-digit gradually; the base skill is present.",
  belowLevelFailure: "Re-check the level assignment — it is running ahead of real mastery.",
  hardOnlyFailure: "The child is at their ceiling, not misconceiving; extend rather than remediate.",
  errorDispersion: "No single wrong rule to fix — check attention, pace and question comprehension.",
  skillInconsistency: "The rule is known but not secure; practise for reliability, not for concept.",
  contextSpecificity: "Vary the presentation — the skill may be tied to one question format."
};

/**
 * The strongest supporting dimension, used to qualify a morphology name.
 *
 * Deliberately ignores whichever key already supplied the primary name, so a
 * cluster led by `topicConcentration` is not called "The Single-Topic Blockers
 * · in one topic".
 */
function qualifierFor(vector: FeatureVector, primaryKey: FeatureKey | null): string | null {
  let best: { key: FeatureKey; value: number } | null = null;
  for (const key of [...DISTRIBUTION_KEYS, ...CONSISTENCY_KEYS] as readonly FeatureKey[]) {
    if (key === primaryKey) continue;
    if (!ARCHETYPE_QUALIFIERS[key]) continue;
    const value = vector[key];
    // Half the range: a qualifier that fires on a weak dimension reads as a
    // claim about the group that its own evidence does not support.
    if (value < 0.5) continue;
    if (!best || value > best.value) best = { key, value };
  }
  return best ? ARCHETYPE_QUALIFIERS[best.key]! : null;
}

/**
 * The order feature keys are flattened into a stored `centroid` array.
 *
 * A centroid is a bare `number[]` in the database with no key names attached, so
 * the writer's order and every later reader's order have to be the same list or
 * the dimensions silently transpose. Exported so they cannot drift apart.
 */
export const CENTROID_KEY_ORDER: readonly FeatureKey[] = [...FEATURE_KEYS].sort((a, b) =>
  a.localeCompare(b)
);

/** Flatten a vector for storage as a centroid. */
export function toCentroid(vector: FeatureVector): number[] {
  return CENTROID_KEY_ORDER.map(key => vector[key]);
}

/** Rebuild a vector from a stored centroid; missing components read as zero. */
export function vectorFromCentroid(centroid: readonly number[]): FeatureVector {
  const vector = emptyVector();
  CENTROID_KEY_ORDER.forEach((key, index) => {
    const value = centroid[index];
    vector[key] = Number.isFinite(value) ? value : 0;
  });
  return vector;
}

export interface DeterministicArchetypeProfile {
  name: string;
  description: string;
  teacherAction: string;
  forwardRisk: string;
}

/**
 * Name and describe an archetype from its vector alone — no model, no network.
 *
 * This is the whole naming pass when AI naming is off, and the fallback when it
 * is on but unreachable. It reads the centroid rather than any one child's
 * `signature`, which is what makes it total: a founding child whose signature
 * array came back empty previously produced the bare "Unnamed error pattern",
 * because `signature` is filtered to values above 0.05 and can legitimately be
 * empty. A vector always has a largest component.
 */
export function deterministicArchetypeProfile(
  vector: FeatureVector
): DeterministicArchetypeProfile {
  const ranked = FEATURE_KEYS
    .map(key => ({ key, value: vector[key] }))
    .filter(f => f.value > 0)
    .sort(
      (a, b) =>
        ((MORPHOLOGY_KEYS as readonly string[]).includes(a.key) ? 0 : 1) -
          ((MORPHOLOGY_KEYS as readonly string[]).includes(b.key) ? 0 : 1) ||
        b.value - a.value
    );

  const primary = ranked.find(f => ARCHETYPE_NAMES[f.key]) ?? null;
  const primaryKey = primary?.key ?? null;
  const base = primaryKey ? ARCHETYPE_NAMES[primaryKey]! : "Mixed profile";
  const qualifier = primaryKey ? qualifierFor(vector, primaryKey) : null;

  const described = ranked
    .slice(0, 3)
    .map(f => FEATURE_LABELS[f.key])
    .join(", ");

  return {
    name: qualifier ? `${base} · ${qualifier}` : base,
    description: described ? `Defined by ${described}.` : "No dominant failure mode detected.",
    teacherAction: primaryKey
      ? ARCHETYPE_ACTIONS[primaryKey]!
      : "Review the evidence below and target the dominant error pattern.",
    forwardRisk: primaryKey
      ? riskForKey(primaryKey, FEATURE_LABELS[primaryKey])
      : "No single dominant failure mode detected."
  };
}

function fallbackName(features: Archetype["distinctiveFeatures"]): string {
  if (features.length === 0) return "Mixed profile";
  return ARCHETYPE_NAMES[features[0].key] ?? "Mixed profile";
}

/** Shared by the cohort fallback and the deterministic namer — one vocabulary. */
const ARCHETYPE_RISKS: Partial<Record<FeatureKey, string>> = {
  placeValueTenfold:
    "Place-value faults stay invisible while numbers are small and break everything from multi-digit multiplication onward.",
  digitConcatenation:
    "Without regrouping, every future column algorithm — addition, subtraction, long multiplication — inherits the same fault.",
  carryBorrowSpecific:
    "Carrying and borrowing underpin all later column arithmetic; this blocks progress well before the ceiling shows in scores.",
  offByOne:
    "Counting-based arithmetic stays accurate but does not scale; it becomes the speed ceiling once numbers grow.",
  omission:
    "Non-attempts hide the actual skill level, so the assigned level may be wrong in either direction.",
  belowLevelFailure:
    "Failures below the child's own level mean the level assignment is running ahead of real mastery."
};

function riskForKey(key: FeatureKey, label: string): string {
  return (
    ARCHETYPE_RISKS[key] ??
    `Errors concentrate in ${label}, which will compound as question complexity rises.`
  );
}

function fallbackRisk(features: Archetype["distinctiveFeatures"]): string {
  if (features.length === 0) return "No single dominant failure mode detected.";
  return riskForKey(features[0].key, features[0].label);
}

/**
 * A cluster counts as incoherent when its members' mistakes have neither a
 * consistent shape nor a consistent trigger.
 *
 * Both conditions are required. A child can be erratic about *where* they fail
 * while being perfectly consistent about *how* — the counting child gets 27+15
 * right and 36+27 wrong, but every slip is off by exactly one, and that is a
 * real strategy, not inattention.
 */
const INCOHERENCE_THRESHOLDS = { dispersion: 0.55, inconsistency: 0.4 };

function isIncoherent(centroid: FeatureVector): boolean {
  return (
    centroid.errorDispersion >= INCOHERENCE_THRESHOLDS.dispersion &&
    centroid.skillInconsistency >= INCOHERENCE_THRESHOLDS.inconsistency
  );
}

function fromArray(point: number[]): FeatureVector {
  const vector = emptyVector();
  for (let i = 0; i < FEATURE_KEYS.length; i++) {
    vector[FEATURE_KEYS[i]] = point[i] ?? 0;
  }
  return vector;
}

/**
 * Fixed copy for the incoherent group.
 *
 * Hard-coded on purpose, and it is the one place this module names something in
 * advance. Everywhere else the archetype comes from the data; here the finding
 * *is* that there is no archetype, and the failure mode we are guarding against
 * is a fluent model inventing one. Detection is still statistical — only the
 * words are fixed.
 */
function carelessNaming(): Pick<
  Archetype,
  "name" | "description" | "forwardRisk" | "teacherAction"
> {
  return {
    name: "Careless, Not Confused",
    description:
      "These children get the same kind of question right one moment and wrong the next, and their mistakes have no shared shape. That pattern is inattention rather than a wrong rule — the method is there when they use it.",
    forwardRisk:
      "Nothing conceptual breaks later, but the score understates what they know, so a level assigned from it will place them below their real ability and the gap widens as work is set from the wrong level.",
    teacherAction:
      "Do not reteach the topic. Have them redo three questions they already got wrong, out loud, and check whether the answer changes — if it does, the issue is checking and pace, not understanding."
  };
}

/**
 * Ask Gemini to name the discovered clusters.
 *
 * The model is given only the statistical profile of each cluster — never a
 * predefined list of misconceptions — so the names describe what the data
 * actually contains. Any failure resolves to the deterministic fallback; this
 * function never throws and never leaves an archetype unnamed.
 *
 * Incoherent clusters are withheld from the model entirely and named above.
 */
/**
 * Exported for the re-naming pass over archetypes that were created while the
 * model was unreachable. Mutates in place and sets `namedByFallback`, which is
 * how a caller tells a real name from a deterministic stand-in.
 */
/**
 * Is AI naming allowed to run at all?
 *
 * Naming is the only step in this feature that ever calls a model — membership
 * is decided by distance, in `kmeans` here and by the same-pattern radius in
 * `studentArchetypeService` — so turning this off makes the whole feature
 * network-free without changing which children group together. Set
 * `MISCONCEPTION_AI_NAMING=off` to name deterministically from the centroid.
 *
 * A missing key counts as off rather than on-and-broken: it produced an
 * identical result via a failed call caught one frame below, but paid a network
 * round trip and a stack trace for every archetype to get there.
 *
 * Lives here, beside the deterministic namer, because BOTH naming paths have to
 * read the same switch. It was previously private to `studentArchetypeService`,
 * so `MISCONCEPTION_AI_NAMING=off` silenced the per-submission path while the
 * cohort pass below carried on calling Gemini — the flag appeared to work while
 * half the feature ignored it.
 */
export function aiNamingEnabled(): boolean {
  if ((process.env.MISCONCEPTION_AI_NAMING ?? "").trim().toLowerCase() === "off") return false;
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function nameArchetypes(allArchetypes: Archetype[], classGroup: string): Promise<void> {
  // Incoherent groups are settled here and excluded from everything below.
  for (const a of allArchetypes) {
    if (!a.incoherent) continue;
    Object.assign(a, carelessNaming());
    a.namedByFallback = true;
  }

  const archetypes = allArchetypes.filter(a => !a.incoherent);
  if (archetypes.length === 0) return;

  // Named from the centroid, by the same function the per-submission path uses.
  //
  // This deliberately does NOT read `distinctiveFeatures`: that list is filtered
  // to components above 0.08 with lift over 1.1, so a real cluster whose members
  // agree closely with the cohort average empties it and lands on the bare
  // "Mixed profile" — no qualifier, no teacher action, no forward risk. A
  // centroid always has a largest component. Sharing one namer also means an
  // archetype cannot be called one thing by the cohort pass and another by the
  // submit path.
  const applyFallback = () => {
    for (const a of archetypes) {
      const named = deterministicArchetypeProfile(a.centroid);
      a.name = named.name;
      a.description = named.description;
      a.teacherAction = named.teacherAction;
      a.forwardRisk = named.forwardRisk;
      a.namedByFallback = true;
    }
  };

  if (!aiNamingEnabled()) {
    applyFallback();
    return;
  }

  const profile = archetypes.map(a => ({
    clusterId: a.clusterId,
    childrenInGroup: a.memberCount,
    definingCharacteristics: a.distinctiveFeatures.slice(0, 5).map(f => ({
      characteristic: f.label,
      shareOfTheirErrors: Number(f.value.toFixed(2)),
      timesMoreCommonThanCohortAverage: Number(f.lift.toFixed(2))
    }))
  }));

  const prompt = `You are analysing groups of ${classGroup} children (ages 7-10) learning foundational mathematics in India.

Each group below was discovered by clustering children on HOW they get questions wrong — never on how many they got wrong. Two children in different groups may have identical test scores.

For each group, infer the underlying mental model from its statistics and name it.

Groups:
${JSON.stringify(profile, null, 2)}

For each group return:
- name: a short, vivid, teacher-facing archetype name (2-4 words). Describe the MIND, not the score. Do not use the word "cluster" or "group". Do not use the words "careless", "inattentive" or "erratic" — every group shown to you fails by a consistent rule, and those words are reserved for a separate group of children whose errors have no pattern at all.
- description: one sentence on what this child is actually doing when they work.
- forwardRisk: one sentence on what breaks LATER if this is not addressed. Be specific about which future skill fails.
- teacherAction: one concrete thing a teacher can do on Monday morning.

Base everything strictly on the statistics given. Do not invent characteristics that are not in the data.`;

  try {
    const raw = await generateContentWithRetry({
      model: DEFAULT_GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            archetypes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  clusterId: { type: Type.NUMBER },
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  forwardRisk: { type: Type.STRING },
                  teacherAction: { type: Type.STRING }
                },
                required: ["clusterId", "name", "description", "forwardRisk", "teacherAction"]
              }
            }
          },
          required: ["archetypes"]
        }
      }
    });

    const text = typeof raw === "string" ? raw : (raw as any)?.text;
    const parsed = JSON.parse(text);
    const named: any[] = parsed?.archetypes ?? [];

    let matchedAny = false;
    for (const a of archetypes) {
      const hit = named.find(n => Number(n.clusterId) === a.clusterId);
      if (hit && typeof hit.name === "string" && hit.name.trim()) {
        a.name = hit.name.trim();
        a.description = String(hit.description ?? "").trim();
        a.forwardRisk = String(hit.forwardRisk ?? "").trim() || fallbackRisk(a.distinctiveFeatures);
        a.teacherAction = String(hit.teacherAction ?? "").trim();
        a.namedByFallback = false;
        matchedAny = true;
      } else {
        a.name = fallbackName(a.distinctiveFeatures);
        a.description = `Defined by ${a.distinctiveFeatures.slice(0, 3).map(f => f.label).join(", ")}.`;
        a.forwardRisk = fallbackRisk(a.distinctiveFeatures);
        a.teacherAction = "Review the evidence below and target the dominant error pattern.";
        a.namedByFallback = true;
      }
    }
    if (!matchedAny) applyFallback();
  } catch (error: any) {
    console.error(
      "[MisconceptionFingerprint] Archetype naming failed; using deterministic labels:",
      error?.message || error
    );
    applyFallback();
  }
}

/* ------------------------------------------------------------------ *
 * Glyphs
 * ------------------------------------------------------------------ */

export interface GlyphSpec {
  /** SVG path for the outer signature contour. */
  path: string;
  /** Inner contour, echoing the distribution block. */
  innerPath: string;
  hue: number;
  accentHue: number;
  /** Radial spokes marking the child's most extreme features. */
  spikes: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  size: number;
  /** Stable short hash of the vector — identical shapes share it. */
  signatureHash: string;
}

/**
 * Render a signature vector as an organic closed curve.
 *
 * This is deliberately NOT a labelled radar chart: it carries no axes and is not
 * meant to be read quantitatively. Its whole job is to make "same score,
 * different mind" *visible at a glance* — two children on 40% produce two
 * obviously different shapes. The mapping is a pure, deterministic function of
 * the vector, so the same signature always yields the same glyph and two
 * children with the same profile are visibly twins.
 */
export function buildGlyph(vector: FeatureVector, seedKey: string): GlyphSpec {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const baseR = 34;
  const maxR = 88;

  const values = FEATURE_KEYS.map(k => vector[k]);
  const n = values.length;

  // Radius per feature, smoothed by its neighbours so the contour reads as one
  // organism rather than a spiky star.
  const radii = values.map((v, i) => {
    const prev = values[(i - 1 + n) % n];
    const next = values[(i + 1) % n];
    const smoothed = v * 0.62 + prev * 0.19 + next * 0.19;
    return baseR + smoothed * (maxR - baseR);
  });

  const pointAt = (i: number, r: number) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  };

  // Closed Catmull-Rom spline converted to cubic beziers.
  const closedSpline = (rs: number[]): string => {
    const pts = rs.map((r, i) => pointAt(i, r));
    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[(i - 1 + pts.length) % pts.length];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      const p3 = pts[(i + 2) % pts.length];
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return d + " Z";
  };

  const innerRadii = radii.map(r => baseR * 0.55 + (r - baseR) * 0.34);

  // Hue is driven by which *block* dominates, so families of minds share a
  // colour temperature: morphology-led = warm, distribution-led = green.
  const morphMass = MORPHOLOGY_KEYS.reduce((a, k) => a + vector[k], 0);
  const distMass = DISTRIBUTION_KEYS.reduce((a, k) => a + vector[k], 0);
  const totalMass = morphMass + distMass || 1;

  // Weight the dominant morphology so different faults read as different hues.
  let dominantIdx = 0;
  let dominantVal = -1;
  MORPHOLOGY_KEYS.forEach((k, i) => {
    if (vector[k] > dominantVal) {
      dominantVal = vector[k];
      dominantIdx = i;
    }
  });

  const hue = Math.round(
    (dominantIdx / MORPHOLOGY_KEYS.length) * 300 + (distMass / totalMass) * 40
  ) % 360;
  const accentHue = (hue + 45) % 360;

  // Spikes mark the three most extreme features — the "tells".
  const ranked = FEATURE_KEYS.map((k, i) => ({ k, i, v: vector[k] }))
    .sort((a, b) => b.v - a.v)
    .filter(f => f.v > 0.18)
    .slice(0, 3);

  const spikes = ranked.map(f => {
    const inner = pointAt(f.i, radii[f.i] * 0.55);
    const outer = pointAt(f.i, radii[f.i] + 9);
    return { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y };
  });

  const hashSource = values.map(v => Math.round(v * 100)).join(",");
  let h = 2166136261;
  for (let i = 0; i < hashSource.length; i++) {
    h ^= hashSource.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return {
    path: closedSpline(radii),
    innerPath: closedSpline(innerRadii),
    hue,
    accentHue,
    spikes,
    size,
    signatureHash: (h >>> 0).toString(16).padStart(8, "0")
  };
}

/* ------------------------------------------------------------------ *
 * Reconciliation with the Python pipeline's root causes
 * ------------------------------------------------------------------ */

/**
 * The pipeline (`ai-services`, step 2) labels each wrong answer conceptual,
 * careless or prerequisite. It does so from a single answer in isolation — and
 * carelessness cannot be established that way. "Careless" means the child can do
 * this and slipped, which is only visible by comparing the answer against
 * equivalent questions they got right. The pipeline never sees those.
 *
 * This module does. `skillInconsistency` is exactly that comparison, so it can
 * confirm or dispute the pipeline's call rather than duplicate it.
 */
export type ReconciliationVerdict =
  | "agrees"
  | "disputes-careless"
  | "suggests-careless"
  | "insufficient-evidence";

export interface RootCauseReconciliation {
  verdict: ReconciliationVerdict;
  /** How many of the child's wrong answers the pipeline called careless. */
  pipelineCarelessCount: number;
  pipelineTotal: number;
  /** The measured evidence behind this module's opinion. */
  skillInconsistency: number;
  errorDispersion: number;
  explanation: string;
}

const RELIABLE_INCONSISTENCY = 0.15;

export function reconcileRootCauses(
  fingerprint: StudentFingerprint,
  rootCauses: Array<{ errorType: string }> | undefined | null
): RootCauseReconciliation | null {
  if (!rootCauses || rootCauses.length === 0) return null;

  const pipelineTotal = rootCauses.length;
  const pipelineCarelessCount = rootCauses.filter(
    r => String(r.errorType).toLowerCase() === "careless"
  ).length;

  const inconsistency = fingerprint.vector.skillInconsistency;
  const dispersion = fingerprint.vector.errorDispersion;

  const base = {
    pipelineCarelessCount,
    pipelineTotal,
    skillInconsistency: Number(inconsistency.toFixed(3)),
    errorDispersion: Number(dispersion.toFixed(3))
  };

  if (fingerprint.totalIncorrect < MIN_ERRORS_FOR_CLUSTERING) {
    return {
      ...base,
      verdict: "insufficient-evidence",
      explanation:
        `Too few wrong answers (${fingerprint.totalIncorrect}) to judge whether these mistakes are ` +
        `slips or a settled pattern. The pipeline's labels stand unchallenged.`
    };
  }

  const callsCareless = pipelineCarelessCount > 0;
  const erratic = inconsistency >= INCOHERENCE_THRESHOLDS.inconsistency;
  const reliable = inconsistency <= RELIABLE_INCONSISTENCY;

  if (callsCareless && reliable) {
    return {
      ...base,
      verdict: "disputes-careless",
      explanation:
        `The pipeline called ${pipelineCarelessCount} of ${pipelineTotal} mistakes careless, but this ` +
        `child fails these questions reliably — they did not get equivalent questions right. That is a ` +
        `settled wrong method, not inattention, and practice alone will not fix it.`
    };
  }

  if (!callsCareless && erratic && dispersion >= INCOHERENCE_THRESHOLDS.dispersion) {
    return {
      ...base,
      verdict: "suggests-careless",
      explanation:
        `The pipeline found no careless mistakes, but this child gets equivalent questions right and ` +
        `wrong by turns and their errors share no common shape. Re-teaching the topic may miss the ` +
        `real problem, which looks like attention rather than understanding.`
    };
  }

  return {
    ...base,
    verdict: "agrees",
    explanation: callsCareless
      ? `The pipeline's careless call is consistent with the evidence: this child does get equivalent ` +
        `questions right at times.`
      : `No careless mistakes flagged, and this child fails consistently enough for that to hold.`
  };
}

/* ------------------------------------------------------------------ *
 * Cohort analysis entry point
 * ------------------------------------------------------------------ */

export interface CohortAnalysis {
  classGroup: string;
  studentCount: number;
  analysedCount: number;
  archetypes: Archetype[];
  fingerprints: StudentFingerprint[];
  /** Pairs with near-identical scores but different archetypes — the demo money shot. */
  collisions: Array<{
    a: string;
    b: string;
    score: number;
    level: number;
    archetypeA: string;
    archetypeB: string;
  }>;
  generatedAt: string;
  /** True when archetype names came from the deterministic fallback. */
  usedFallbackNaming: boolean;
  /** How many children actually entered the clustering. */
  clusteredCount: number;
  /** Children who submitted but got everything right — nothing to signature. */
  noErrorCount: number;
  /** Children in the cohort with no usable submission at all. */
  noSubmissionCount: number;
  /**
   * Mean silhouette of the chosen partition. Reported rather than hidden: on a
   * real cohort this is the number that says whether the archetypes below mean
   * anything, and the module will always produce *some* partition.
   */
  silhouette: number;
  /** Silhouette too low for the archetypes to be presented as settled fact. */
  lowSeparation: boolean;
  /**
   * Wrong answers the nine rules could not read. Watching this is how a tenth
   * category becomes discoverable rather than hypothetical — the rules cannot
   * report a pattern they have no name for, but they can report their own
   * blind spot.
   */
  /**
   * The class-wide answer to "who is weak where".
   *
   * Per-child weakness is only half a teacher's question; the other half is
   * whether it is one child or eleven. Grouping the same weakness across the
   * cohort is what turns individual diagnoses into a teaching decision.
   */
  weaknessByTopic: Array<{
    topic: string;
    childrenWeak: number;
    childrenAttempted: number;
    studentIds: string[];
  }>;
  /** Children grouped by the lowest level they failed at — where to start. */
  weaknessByLevel: Array<{ level: number; childrenWeak: number; studentIds: string[] }>;
  unclassifiedCount: number;
  unclassifiedRate: number;
  /** Distinct unreadable (question, answer) pairs, commonest first. */
  residue: Array<{
    questionId: string;
    prompt: string;
    expected: string;
    submitted: string;
    count: number;
  }>;
}

/**
 * Full pipeline: fingerprint every child, cluster the cohort, name the clusters
 * from their own statistics, and surface score-collisions.
 */
/**
 * Below this many wrong answers a signature is noise, not a profile: with two
 * errors the morphology vector is one-hot and the child would be handed an
 * archetype on the evidence of one slip.
 *
 * Exported because the persistent-archetype path in `studentArchetypeService`
 * has to hold the same line. When only the cohort view enforced it, a child
 * could be a member of a saved archetype and simultaneously be listed under
 * "Not enough evidence yet" on the screen that shows it.
 */
export const MIN_ERRORS_FOR_CLUSTERING = 3;

/**
 * Silhouette below this and the partition is not describing real groups.
 *
 * The archetypes are still returned — refusing outright would leave a teacher
 * with nothing — but the caller is told, because k-means always partitions and
 * the LLM will always write fluent copy about whatever it is handed.
 */
const MIN_SILHOUETTE = 0.25;

/**
 * A child counts as mixed when their second-commonest error shape is at least
 * this fraction of their commonest — "the other pattern is at least half as
 * common as the main one".
 *
 * Defined on the child's own vector rather than on distance to centroids,
 * because centroid geometry cannot express it: a distinctly mixed child tends to
 * be given a cluster of their own, where the distance to their own centroid is
 * zero and every ratio degenerates.
 */
const MIXED_PROFILE_RATIO = 0.5;

/** The child's two commonest error shapes, and how close they are in size. */
function morphologyMix(vector: FeatureVector): { top: number; second: number } {
  const sorted = MORPHOLOGY_KEYS.map(k => vector[k]).sort((a, b) => b - a);
  return { top: sorted[0] ?? 0, second: sorted[1] ?? 0 };
}

/**
 * Tally the wrong answers the classifier could not read.
 *
 * Deduplicated by (question, answer): children share a worksheet, so the same
 * unreadable pair recurs across the cohort and the distinct list is short.
 */
/**
 * Roll per-child weaknesses up to the class.
 *
 * A child counts toward a topic only if they were actually asked about it, so
 * "4 of 7" never silently includes children who never saw the questions.
 */
function summariseWeakness(
  fingerprints: StudentFingerprint[]
): Pick<CohortAnalysis, "weaknessByTopic" | "weaknessByLevel"> {
  const byTopic = new Map<string, { weak: string[]; attempted: number }>();
  const byLevel = new Map<number, string[]>();

  for (const f of fingerprints) {
    for (const t of f.weakness.topics) {
      const entry = byTopic.get(t.topic) ?? { weak: [], attempted: 0 };
      entry.attempted++;
      if (t.rate >= WEAK_TOPIC_RATE) entry.weak.push(f.studentId);
      byTopic.set(t.topic, entry);
    }
    if (f.weakness.weakestLevel !== null) {
      const list = byLevel.get(f.weakness.weakestLevel) ?? [];
      list.push(f.studentId);
      byLevel.set(f.weakness.weakestLevel, list);
    }
  }

  return {
    weaknessByTopic: Array.from(byTopic.entries())
      .map(([topic, e]) => ({
        topic,
        childrenWeak: e.weak.length,
        childrenAttempted: e.attempted,
        studentIds: e.weak
      }))
      .sort((a, b) => b.childrenWeak - a.childrenWeak || a.topic.localeCompare(b.topic)),
    weaknessByLevel: Array.from(byLevel.entries())
      .map(([level, studentIds]) => ({ level, childrenWeak: studentIds.length, studentIds }))
      .sort((a, b) => a.level - b.level)
  };
}

function summariseResidue(
  fingerprints: StudentFingerprint[]
): Pick<CohortAnalysis, "unclassifiedCount" | "unclassifiedRate" | "residue"> {
  const byPair = new Map<string, CohortAnalysis["residue"][number]>();
  let unclassifiedCount = 0;
  let totalErrors = 0;

  for (const f of fingerprints) {
    for (const e of f.errors) {
      totalErrors++;
      if (!e.unparsed) continue;
      unclassifiedCount++;
      const key = `${e.questionId}||${e.submitted}`;
      const hit = byPair.get(key);
      if (hit) hit.count++;
      else
        byPair.set(key, {
          questionId: e.questionId,
          prompt: e.prompt,
          expected: e.expected,
          submitted: e.submitted,
          count: 1
        });
    }
  }

  return {
    unclassifiedCount,
    unclassifiedRate: totalErrors > 0 ? Number((unclassifiedCount / totalErrors).toFixed(4)) : 0,
    residue: Array.from(byPair.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 40)
  };
}

/**
 * Ask Gemini what the unreadable answers might have in common.
 *
 * Deliberately NOT a classifier. It never assigns a child to anything and its
 * output never reaches the feature vector — it reads the residue and proposes
 * candidate categories for a human to accept or reject. If one is accepted it
 * gets written into `classifyError` as an ordinary deterministic rule, so the
 * labelling itself stays reproducible and testable.
 *
 * Returns an empty list rather than throwing, on any failure or without a key.
 */
export interface ProposedCategory {
  name: string;
  description: string;
  examples: string[];
  affectedAnswers: number;
}

export async function proposeErrorCategories(
  residue: CohortAnalysis["residue"],
  classGroup: string
): Promise<ProposedCategory[]> {
  if (!process.env.GEMINI_API_KEY || residue.length === 0) return [];

  const known = MORPHOLOGY_KEYS.map(k => FEATURE_LABELS[k]).join("; ");
  const prompt = `Children in ${classGroup} (ages 7-10) learning foundational mathematics wrote the answers below. An automated classifier could not match any of them to the error patterns it already knows.

Error patterns already covered — do NOT propose these again:
${known}

Unexplained answers:
${JSON.stringify(residue, null, 2)}

Look for RECURRING patterns across these answers. Propose at most three new error categories that a teacher would recognise, and only where several answers genuinely share a cause.

Rules:
- If the answers have nothing in common, return an empty list. Random mistakes are the expected case and "no pattern" is a correct and useful answer.
- Never propose a category supported by only one answer.
- Base every claim strictly on the answers shown. Do not speculate about children.

For each proposal return: name (2-4 words), description (one sentence on what the child is doing), examples (the submitted answers that support it), affectedAnswers (how many).`;

  try {
    const raw = await generateContentWithRetry({
      model: DEFAULT_GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            proposals: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  examples: { type: Type.ARRAY, items: { type: Type.STRING } },
                  affectedAnswers: { type: Type.NUMBER }
                },
                required: ["name", "description", "examples", "affectedAnswers"]
              }
            }
          },
          required: ["proposals"]
        }
      }
    });

    const text = typeof raw === "string" ? raw : (raw as any)?.text;
    const parsed = JSON.parse(text);
    const proposals: any[] = parsed?.proposals ?? [];
    return proposals
      .filter(p => p && typeof p.name === "string" && Number(p.affectedAnswers) > 1)
      .map(p => ({
        name: String(p.name).trim(),
        description: String(p.description ?? "").trim(),
        examples: Array.isArray(p.examples) ? p.examples.map(String).slice(0, 8) : [],
        affectedAnswers: Number(p.affectedAnswers)
      }));
  } catch (error: any) {
    console.error(
      "[MisconceptionFingerprint] category proposal failed:",
      error?.message || error
    );
    return [];
  }
}

export async function analyseCohort(
  students: Student[],
  submissions: AnswerSubmission[],
  worksheets: Worksheet[],
  options: { classGroup?: string; reports?: EvaluationReport[] } = {}
): Promise<CohortAnalysis> {
  const worksheetsById = new Map(worksheets.map(w => [w.id, w]));
  const subsByStudent = new Map<string, AnswerSubmission[]>();
  for (const s of submissions) {
    const list = subsByStudent.get(s.studentId) ?? [];
    list.push(s);
    subsByStudent.set(s.studentId, list);
  }

  // Latest report per child, for the diagnostic-only fallback below. A
  // diagnostic is persisted as an EvaluationReport and nothing else, so these
  // children have no `answers` to join against a worksheet.
  const latestReportByStudent = new Map<string, EvaluationReport>();
  for (const report of options.reports ?? []) {
    const parsed = Date.parse(report.timestamp);
    const at = Number.isFinite(parsed) ? parsed : 0;
    const held = latestReportByStudent.get(report.studentId);
    if (!held) {
      latestReportByStudent.set(report.studentId, report);
      continue;
    }
    const heldParsed = Date.parse(held.timestamp);
    if (at >= (Number.isFinite(heldParsed) ? heldParsed : 0)) {
      latestReportByStudent.set(report.studentId, report);
    }
  }
  const fingerprints: StudentFingerprint[] = [];
  let noErrorCount = 0;
  let noSubmissionCount = 0;
  for (const student of students) {
    const subs = subsByStudent.get(student.id) ?? [];
    // Submissions stay the primary source: they carry what the child actually
    // wrote, which is the only input the nine morphology rules can read.
    let fp = subs.length > 0 ? buildFingerprint(student, subs, worksheetsById) : null;

    // A child assessed only by diagnostic has no submission at all. Their
    // report still records how many they missed, where, and at which level, so
    // read that rather than dropping them — this is the same precedence
    // `studentArchetypeService` already applies when it assigns an archetype
    // on submit. Without it a child could be a listed member of an archetype
    // while the cohort pass reported no signature for them.
    if (!fp) {
      const report = latestReportByStudent.get(student.id);
      if (report) fp = buildFingerprintFromEvaluationReport(student, report);
    }

    if (!fp) {
      noSubmissionCount++;
      continue;
    }
    // A child with no errors has no failure signature to cluster. Counted rather
    // than silently dropped: on a real class this is most of the room, and a
    // cohort that reports "0 analysed" with no explanation reads as a bug.
    if (fp.totalIncorrect > 0) fingerprints.push(fp);
    else noErrorCount++;
  }

  // A child with one or two wrong answers has a vector that is essentially
  // one-hot: it would be assigned an archetype on the strength of a single
  // slip. They stay in the report, flagged, but out of the clustering.
  const clusterable: StudentFingerprint[] = [];
  for (const f of fingerprints) {
    if (f.totalIncorrect >= MIN_ERRORS_FOR_CLUSTERING) {
      clusterable.push(f);
    } else {
      f.insufficientEvidence = true;
      f.evidenceReason = "TOO_FEW_ERRORS";
    }
  }

  const analysis: CohortAnalysis = {
    classGroup: options.classGroup ?? "All classes",
    studentCount: students.length,
    analysedCount: fingerprints.length,
    archetypes: [],
    fingerprints,
    collisions: [],
    generatedAt: new Date().toISOString(),
    usedFallbackNaming: false,
    clusteredCount: clusterable.length,
    noErrorCount,
    noSubmissionCount,
    silhouette: 0,
    lowSeparation: false,
    ...summariseWeakness(fingerprints),
    ...summariseResidue(fingerprints)
  };

  // Only this class's archetypes. Without the filter a cohort screen renders
  // groups founded by children it does not contain, and the class-less clusters
  // written before archetypes were scoped would reappear in every class at once.
  const persistentClusters = await dbStore.getMisconceptionClusters(options.classGroup);
  if (persistentClusters.length > 0) {
    const clusters = [...persistentClusters].sort(
      (a, b) =>
        String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")) ||
        String(a.id).localeCompare(String(b.id))
    );

    const clusterIndexById = new Map<string, number>();
    clusters.forEach((cluster, index) => clusterIndexById.set(cluster.id, index));

    const clusterAssignments = new Map<string, number>();
    for (const fingerprint of clusterable) {
      const clusterIndex = clusters.findIndex(cluster => cluster.studentIds.includes(fingerprint.studentId));
      if (clusterIndex !== -1) {
        fingerprint.clusterId = clusterIndex;
        clusterAssignments.set(fingerprint.studentId, clusterIndex);
      }
    }

    const assignedFingerprints = clusterable.filter(f => f.clusterId !== undefined);
    analysis.clusteredCount = assignedFingerprints.length;

    const persistentArchetypes: Archetype[] = [];
    if (assignedFingerprints.length > 0) {
      const cohortMean = emptyVector();
      for (const key of FEATURE_KEYS) {
        cohortMean[key] = assignedFingerprints.reduce((a, f) => a + f.vector[key], 0) / assignedFingerprints.length;
      }

      for (const cluster of clusters) {
        const clusterId = clusterIndexById.get(cluster.id);
        if (clusterId === undefined) continue;
        const members = assignedFingerprints.filter(f => f.clusterId === clusterId);
        if (members.length === 0) continue;

        const centroidPoint = meanPoint(members.map(m => toArray(m.vector)));
        const centroid = fromArray(centroidPoint);

        const distinctiveFeatures = FEATURE_KEYS.map(key => {
          const value = centroid[key];
          const base = cohortMean[key];
          const lift = base > 0.001 ? value / base : value > 0.001 ? 3 : 0;
          return { key, label: FEATURE_LABELS[key], value, lift };
        })
          .filter(f => f.value > 0.08 && f.lift > 1.1)
          .sort((a, b) => b.lift * b.value - a.lift * a.value)
          .slice(0, 6);

        persistentArchetypes.push({
          clusterId,
          slug: cluster.id,
          stableName: cluster.name,
          name: cluster.name,
          description: cluster.description,
          forwardRisk: cluster.forwardRisk,
          teacherAction: cluster.teacherAction,
          memberCount: members.length,
          memberIds: members.map(m => m.studentId),
          distinctiveFeatures,
          centroid,
          namedByFallback: false,
          incoherent: isIncoherent(centroid)
        });
      }

      const centroidPoints = persistentArchetypes.map(a => ({ clusterId: a.clusterId, point: toArray(a.centroid) }));
      for (const f of assignedFingerprints) {
        if (f.clusterId === undefined) continue;
        const ranked = centroidPoints
          .map(c => ({ clusterId: c.clusterId, d: distance(toArray(f.vector), c.point) }))
          .sort((x, y) => x.d - y.d);
        const own = ranked.find(r => r.clusterId === f.clusterId);
        if (own) f.clusterDistance = Number(own.d.toFixed(4));

        const { top, second } = morphologyMix(f.vector);
        if (top > 0 && second / top >= MIXED_PROFILE_RATIO) {
          f.mixedProfile = true;
          const runnerUp = ranked.find(r => r.clusterId !== f.clusterId);
          if (runnerUp) {
            f.secondaryClusterId = runnerUp.clusterId;
            f.secondaryDistance = Number(runnerUp.d.toFixed(4));
          }
        }
      }

      assignStableIdentity(persistentArchetypes);
      analysis.archetypes = persistentArchetypes;
      analysis.silhouette = Number.isFinite(persistentArchetypes.length)
        ? Number(
            silhouette(
              assignedFingerprints.map(f => toArray(f.vector)),
              assignedFingerprints.map(f => f.clusterId ?? 0),
              Math.max(1, persistentArchetypes.length)
            ).toFixed(4)
          )
        : 0;
      analysis.lowSeparation = analysis.silhouette < MIN_SILHOUETTE;
      analysis.usedFallbackNaming = false;

      const nameFor = new Map(persistentArchetypes.map(a => [a.clusterId, a.name]));
      for (let i = 0; i < assignedFingerprints.length; i++) {
        for (let j = i + 1; j < assignedFingerprints.length; j++) {
          const a = assignedFingerprints[i];
          const b = assignedFingerprints[j];
          if (a.clusterId === undefined || b.clusterId === undefined) continue;
          if (a.clusterId === b.clusterId) continue;
          if (a.currentLevel !== b.currentLevel) continue;
          if (Math.abs(a.score - b.score) > 2) continue;
          analysis.collisions.push({
            a: a.studentId,
            b: b.studentId,
            score: a.score,
            level: a.currentLevel,
            archetypeA: nameFor.get(a.clusterId) ?? "",
            archetypeB: nameFor.get(b.clusterId) ?? ""
          });
        }
      }
      analysis.collisions.sort((x, y) => Math.abs(x.score - y.score) - Math.abs(x.score - y.score));
    }

    return analysis;
  }

  // Clustering needs enough distinct children to be meaningful at all.
  if (clusterable.length < 4) return analysis;

  const points = clusterable.map(f => toArray(f.vector));

  // Choose k by silhouette rather than hardcoding the number of archetypes —
  // the cohort decides how many distinct minds it contains.
  const maxK = Math.min(6, clusterable.length - 1);
  let bestK = 2;
  let bestScore = -Infinity;
  let bestAssignment: number[] = new Array(clusterable.length).fill(0);

  for (let k = 2; k <= maxK; k++) {
    const assignment = kmeans(points, k, 0x5eed + k);
    const used = new Set(assignment).size;
    if (used < k) continue;
    const s = silhouette(points, assignment, k);
    if (s > bestScore) {
      bestScore = s;
      bestK = k;
      bestAssignment = assignment;
    }
  }

  clusterable.forEach((f, i) => {
    f.clusterId = bestAssignment[i];
  });

  analysis.silhouette = Number.isFinite(bestScore) ? Number(bestScore.toFixed(4)) : 0;
  analysis.lowSeparation = analysis.silhouette < MIN_SILHOUETTE;

  // Cohort mean, for lift.
  const cohortMean = emptyVector();
  for (const key of FEATURE_KEYS) {
    cohortMean[key] = clusterable.reduce((a, f) => a + f.vector[key], 0) / clusterable.length;
  }

  const archetypes: Archetype[] = [];
  for (let c = 0; c < bestK; c++) {
    const members = clusterable.filter(f => f.clusterId === c);
    if (members.length === 0) continue;

    const centroid = emptyVector();
    for (const key of FEATURE_KEYS) {
      centroid[key] = members.reduce((a, f) => a + f.vector[key], 0) / members.length;
    }

    // Distinctive = high absolute presence AND over-represented vs the cohort.
    const distinctiveFeatures = FEATURE_KEYS.map(key => {
      const value = centroid[key];
      const base = cohortMean[key];
      const lift = base > 0.001 ? value / base : value > 0.001 ? 3 : 0;
      return { key, label: FEATURE_LABELS[key], value, lift };
    })
      .filter(f => f.value > 0.08 && f.lift > 1.1)
      .sort((a, b) => b.lift * b.value - a.lift * a.value)
      .slice(0, 6);

    archetypes.push({
      clusterId: c,
      slug: "",
      stableName: "",
      name: "",
      description: "",
      forwardRisk: "",
      teacherAction: "",
      memberCount: members.length,
      memberIds: members.map(m => m.studentId),
      distinctiveFeatures,
      centroid,
      namedByFallback: true,
      incoherent: isIncoherent(centroid)
    });
  }

  // How typical each child is of its own archetype, and which other archetype it
  // nearly belongs to. Computed against every centroid rather than just its own,
  // because the interesting fact is the gap between first and second place.
  const centroidPoints = archetypes.map(a => ({ clusterId: a.clusterId, point: toArray(a.centroid) }));
  for (const f of clusterable) {
    if (f.clusterId === undefined) continue;
    const ranked = centroidPoints
      .map(c => ({ clusterId: c.clusterId, d: distance(toArray(f.vector), c.point) }))
      .sort((x, y) => x.d - y.d);
    const own = ranked.find(r => r.clusterId === f.clusterId);
    if (own) f.clusterDistance = Number(own.d.toFixed(4));

    const { top, second } = morphologyMix(f.vector);
    if (top > 0 && second / top >= MIXED_PROFILE_RATIO) {
      f.mixedProfile = true;
      // Best-effort label for the other half. May be absent when the child's own
      // mixture is distinctive enough that no other archetype resembles it.
      const runnerUp = ranked.find(r => r.clusterId !== f.clusterId);
      if (runnerUp) {
        f.secondaryClusterId = runnerUp.clusterId;
        f.secondaryDistance = Number(runnerUp.d.toFixed(4));
      }
    }
  }

  // Identity first, wording second: the slug must not depend on whether the
  // model answered, or on what it happened to say.
  assignStableIdentity(archetypes);
  await nameArchetypes(archetypes, options.classGroup ?? "primary school");
  analysis.archetypes = archetypes;
  // The incoherent group is always named deterministically by design, so it must
  // not make the whole analysis report itself as having run without the LLM.
  analysis.usedFallbackNaming = archetypes.some(a => a.namedByFallback && !a.incoherent);

  // Score collisions: same score, same level, different archetype. This is the
  // claim of the whole feature, computed rather than asserted.
  const nameFor = new Map(archetypes.map(a => [a.clusterId, a.name]));
  for (let i = 0; i < clusterable.length; i++) {
    for (let j = i + 1; j < clusterable.length; j++) {
      const a = clusterable[i];
      const b = clusterable[j];
      if (a.clusterId === undefined || b.clusterId === undefined) continue;
      if (a.clusterId === b.clusterId) continue;
      if (a.currentLevel !== b.currentLevel) continue;
      if (Math.abs(a.score - b.score) > 2) continue;
      analysis.collisions.push({
        a: a.studentId,
        b: b.studentId,
        score: a.score,
        level: a.currentLevel,
        archetypeA: nameFor.get(a.clusterId!) ?? "",
        archetypeB: nameFor.get(b.clusterId!) ?? ""
      });
    }
  }
  // Strongest collisions first: identical score beats near-identical.
  analysis.collisions.sort((x, y) => Math.abs(x.score - y.score) - Math.abs(x.score - y.score));

  return analysis;
}
