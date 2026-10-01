/**
 * Turns an authored `QuestionTemplate` into a concrete, gradable `Question`.
 *
 * Issue #486. Until this module existed, `levelGenerator.ts` assembled every
 * worksheet from the hand-written switch in `utils/conceptQuestionGenerator.ts`
 * (and the older level-numbered switch beneath it), so intent-based
 * `questionTemplates` — the format PR #428/#431 made the only accepted one —
 * had no path to a printed sheet. Authoring worked end to end and nothing read
 * it back.
 *
 * What this module does, in order:
 *
 *  1. **Eligibility.** Only `approved` rows are considered (`status` absent
 *     counts as approved: every row predating the field was Superadmin-authored
 *     and is live, and #451's vocabulary is reused here rather than invented a
 *     second time). `assessmentMode: 'observed'` rows are never eligible —
 *     NCF-FS rules those outcomes out of written tests, so a child must not be
 *     handed them as a worksheet item; they belong on the teacher's sheet.
 *
 *  2. **paramMode, respected both ways.** A row carrying a usable legacy
 *     `stem` + `answerSpec` pair is printed verbatim — a sentence a human wrote
 *     for children is never re-authored by a generator. A row with a
 *     `generationIntent` is rendered by its `questionFamily`. A row with
 *     neither is skipped with a warning rather than guessed at: #486 asks for
 *     the two models to be handled "without one silently overriding the
 *     other". `classify()` in `migrations/questionTemplateIntentV1.ts` is the
 *     reference for what each `paramMode` means.
 *
 *  3. **Deterministic rendering, no LLM.** Numbers and the answer are computed
 *     from a single seeded draw, so the printed sheet and the answer key that
 *     is stored beside it can never disagree — the key is what ICR evaluation
 *     marks against. A generated question is also expected to be reproducible
 *     for a reprint, which rules out calling Gemini here even where a key
 *     exists: generation has to work offline and identically on a second run.
 *     The trade-off is stated openly: these renderers are generic per-family
 *     wordings that satisfy the intent's shape, not a reading of every
 *     sentence of it. `fill-blanks`, `matching` and `trace` fall back to the
 *     family's default answer shape; only `single-number`, `mcq-4` and
 *     `true-false` are specialised.
 */

import { randomUUID } from 'crypto';
import { Question, QuestionTemplate, dbStore } from '../db';
import { getLevelForConcept } from '../config/curriculumMap';
import { QuestionFamily } from '../types/questionTemplateParams';

/** What one render produces, before it is stamped with ids/level metadata. */
export interface RenderedQuestion {
  question: string;
  answer: string;
  answer_type: 'text' | 'number' | 'choice';
  choices?: string[];
  /** Theme id from `svgThemeIds`, or undefined when the row names no theme. */
  svgAsset?: string;
}

/** Seed of a single rendered instance. Distinct per draw, stable per draw. */
export function instanceSeed(template: Pick<QuestionTemplate, 'id'>): string {
  return `${template.id}:${randomUUID()}`;
}

// --- Seeded randomness -------------------------------------------------------
//
// mulberry32 over an FNV-1a hash of the seed string: small, dependency-free,
// and identical across processes, which is what makes a regeneration produce
// the same numbers instead of a different paper for the same inputs.

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;

function randInt(rng: Rng, min: number, max: number): number {
  if (max <= min) return min;
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// --- Parameter helpers -------------------------------------------------------

/** `'0-20' -> [0, 20]`. Unspecified means "small whole numbers". */
function rangeBounds(numeralRange: string | null): [number, number] {
  const m = /^(\d+)-(\d+)$/.exec((numeralRange ?? '').trim());
  if (!m) return [0, 20];
  const lo = Number(m[1]);
  const hi = Number(m[2]);
  return hi > lo ? [lo, hi] : [0, 20];
}

/** `'<=20' -> 20`. Absent means no cap beyond the numeral range itself. */
function resultCap(maxSumOrDifference: string | null): number | null {
  const m = /^<=(\d+)$/.exec((maxSumOrDifference ?? '').trim());
  return m ? Number(m[1]) : null;
}

/**
 * Countable objects for a subject category.
 *
 * Plural nouns, because every renderer that uses one is asking about a set.
 * `mixed` deliberately spans categories — it is the "any set of objects"
 * choice most Balvatika intents actually specify.
 */
const SUBJECT_NOUNS: Record<string, string> = {
  fruits: 'mangoes',
  vegetables: 'carrots',
  animals: 'cats',
  pets: 'puppies',
  vehicles: 'cars',
  'street-furniture': 'lamp posts',
  buildings: 'houses',
  clothing: 'shirts',
  'flowers-trees': 'flowers',
  'classroom-objects': 'pencils',
  mixed: 'objects',
};

function nounFor(t: QuestionTemplate): string {
  return (t.subjectCategory && SUBJECT_NOUNS[t.subjectCategory]) || 'objects';
}

/** Above this a printed set of glyphs stops being countable by a 5-year-old. */
const MAX_PRINTED_COUNT = 12;

// --- Family renderers --------------------------------------------------------
//
// Each takes the row, its intent (used only as a keyword hint about which
// variant the author meant) and the seeded rng, and returns wording plus the
// answer that wording implies. Parenthesised answer instructions are NOT added
// here: `renderTemplateQuestion` appends one uniform hint so a family cannot
// grow its own house style.

function renderCounting(t: QuestionTemplate, intent: string, rng: Rng): RenderedQuestion {
  const noun = nounFor(t);
  const [lo, hi] = rangeBounds(t.numeralRange);
  const min = Math.max(1, lo);
  const max = Math.min(Math.max(min, hi), MAX_PRINTED_COUNT);
  const count = randInt(rng, min, max);
  const glyphs = Array.from({ length: count }, () => '*').join(' ');

  return {
    question: `Count the ${noun}: ${glyphs}. How many ${noun} are there?`,
    answer: String(count),
    answer_type: 'number',
  };
}

function renderOperation(t: QuestionTemplate, intent: string, rng: Rng): RenderedQuestion {
  const operations = t.operations.length > 0 ? t.operations : ['add'];
  const op = pick(rng, operations);
  const [rangeLo, rangeHi] = rangeBounds(t.numeralRange);
  const cap = resultCap(t.maxSumOrDifference);
  const noun = nounFor(t);
  // An object-based intent ("two small groups, no plus symbol shown") is the
  // Balvatika default; a row with no subject category is an abstract sum.
  const wordProblem = Boolean(t.subjectCategory);

  let a = 0;
  let b = 0;
  let answer = 0;

  if (op === 'multiply' || op === 'divide') {
    // Operands here are factors, not values constrained by the author's range
    // floor: "0 to 9" still has to be able to produce 3 x 4.
    const hiFactor = Math.max(2, Math.min(rangeHi, 9));
    if (op === 'multiply') {
      a = randInt(rng, 2, hiFactor);
      b = randInt(rng, 2, hiFactor);
      answer = a * b;
    } else {
      b = randInt(rng, 2, hiFactor);
      const quotient = randInt(rng, 2, hiFactor);
      a = b * quotient;
      answer = quotient;
    }
  } else if (op === 'subtract') {
    const hiA = Math.max(1, Math.min(rangeHi, 99));
    const loA = Math.min(Math.max(1, rangeLo), hiA);
    a = randInt(rng, loA, hiA);
    b = randInt(rng, 1, Math.max(1, a));
    answer = a - b;
  } else {
    // add
    const hiA = cap ? Math.max(1, Math.min(rangeHi, cap - 1)) : Math.max(1, Math.min(rangeHi, 99));
    const loA = Math.min(Math.max(1, rangeLo), hiA);
    a = randInt(rng, loA, hiA);
    const hiB = cap ? Math.max(1, cap - a) : Math.max(1, Math.min(rangeHi, 99));
    b = randInt(rng, 1, Math.max(1, hiB));
    answer = a + b;
  }

  const symbol: Record<string, string> = { add: '+', subtract: '-', multiply: '×', divide: '÷' };
  const bare = `Solve: ${a} ${symbol[op] ?? '+'} ${b} = ?`;

  // true-false is only meaningful against an equation: a statement about
  // mangoes needs a picture to be checkable, so it stays a numeral item.
  if (t.answerType === 'true-false' && !wordProblem) {
    const holds = rng() < 0.5;
    const stated = holds ? answer : answer + randInt(rng, 1, 3);
    return {
      question: `True or false: ${a} ${symbol[op] ?? '+'} ${b} = ${stated}?`,
      answer: holds ? 'true' : 'false',
      answer_type: 'choice',
      choices: ['true', 'false'],
    };
  }

  let question: string;
  if (wordProblem) {
    if (op === 'subtract') {
      question = `Riya had ${a} ${noun} and gave away ${b} of them. How many ${noun} are left?`;
    } else if (op === 'multiply') {
      question = `There are ${a} boxes and each box holds ${b} ${noun}. How many ${noun} are there altogether?`;
    } else if (op === 'divide') {
      question = `${a} ${noun} are shared equally among ${b} children. How many does each child get?`;
    } else {
      question = `Riya has ${a} ${noun} and gets ${b} more. How many ${noun} does she have now?`;
    }
  } else {
    question = bare;
  }

  return { question, answer: String(answer), answer_type: 'number' };
}

function renderComparison(t: QuestionTemplate, intent: string, rng: Rng): RenderedQuestion {
  const asksLess = /less|fewer|smaller|least|minimum/i.test(intent);
  let [lo, hi] = rangeBounds(t.numeralRange);
  if (hi - lo < 2) { lo = 0; hi = Math.max(9, hi); }

  let a = randInt(rng, lo, hi);
  let b = randInt(rng, lo, hi);
  if (b === a) {
    if (b + 1 <= hi) b = b + 1;
    else a = a - 1;
  }
  if (a < lo) { a = lo; b = Math.min(hi, lo + 1); }

  const winner = asksLess ? Math.min(a, b) : Math.max(a, b);
  return {
    question: `${asksLess ? 'Which number is fewer' : 'Which number is more'}: ${a} or ${b}?`,
    answer: String(winner),
    answer_type: 'number',
  };
}

function renderPattern(t: QuestionTemplate, intent: string, rng: Rng): RenderedQuestion {
  const shapes = ['circle', 'square', 'triangle', 'star'];
  const first = pick(rng, shapes);
  let second = pick(rng, shapes);
  while (second === first) second = pick(rng, shapes);

  const unit = [first, second];
  const seq = Array.from({ length: 4 }, (_, i) => unit[i % unit.length]);
  const next = unit[seq.length % unit.length];

  return {
    question: `Complete the pattern: ${seq.join(', ')}, ___`,
    answer: next,
    answer_type: 'choice',
    choices: shuffle(rng, unit),
  };
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}

function renderSequencing(t: QuestionTemplate, intent: string, rng: Rng): RenderedQuestion {
  // Two intents share this family: the missing-numeral one and the ordinal-
  // position one (S4.13). The intent text is the only thing that tells them
  // apart, so it is read as a keyword rather than guessed from the concept id.
  if (/\bordinal|position|in (a )?line|\d+(st|nd|rd|th)\b/i.test(intent)) {
    const animals = ['cat', 'dog', 'bird', 'rabbit', 'frog'];
    const line = shuffle(rng, animals);
    const pos = randInt(rng, 1, line.length);
    return {
      question: `Which animal is the ${ordinal(pos)} in this line: ${line.join(', ')}?`,
      answer: line[pos - 1],
      answer_type: 'text',
    };
  }

  const [lo, hi] = rangeBounds(t.numeralRange);
  const start = randInt(rng, Math.max(1, lo), Math.max(1, hi - 5));
  const seq = Array.from({ length: 5 }, (_, i) => start + i);
  const hidden = seq[2];
  const shown = seq.map((n, i) => (i === 2 ? '___' : String(n)));

  return {
    question: `What number is missing? ${shown.join(' ')}`,
    answer: String(hidden),
    answer_type: 'number',
  };
}

/** Item pools for odd-one-out: three that share a category, one that does not. */
const CLASSIFICATION_POOLS: string[][] = [
  ['apple', 'mango', 'banana', 'guava'],
  ['carrot', 'potato', 'brinjal', 'tomato'],
  ['cat', 'dog', 'goat', 'hen'],
  ['bus', 'car', 'bike', 'truck'],
  ['pencil', 'book', 'bag', 'chalk'],
  ['shirt', 'pants', 'sock', 'cap'],
  ['rose', 'lotus', 'sunflower', 'marigold'],
];

function renderClassification(t: QuestionTemplate, intent: string, rng: Rng): RenderedQuestion {
  const main = pick(rng, CLASSIFICATION_POOLS);
  let other = pick(rng, CLASSIFICATION_POOLS);
  while (other === main) other = pick(rng, CLASSIFICATION_POOLS);

  const shared = shuffle(rng, main).slice(0, 3);
  const odd = pick(rng, other);
  const items = [...shared];
  items.splice(randInt(rng, 0, items.length), 0, odd);

  return {
    question: `Which one does not belong: ${items.join(', ')}?`,
    answer: odd,
    answer_type: 'text',
  };
}

const SHAPES: Array<{ name: string; sides: number }> = [
  { name: 'triangle', sides: 3 },
  { name: 'square', sides: 4 },
  { name: 'rectangle', sides: 4 },
  { name: 'pentagon', sides: 5 },
  { name: 'circle', sides: 0 },
];

function renderShape(t: QuestionTemplate, intent: string, rng: Rng): RenderedQuestion {
  const shape = pick(rng, SHAPES);
  if (shape.sides === 0) {
    // "How many sides does a circle have" invites 0 / none / no sides — all
    // correct, none of them matchable against one stored answer.
    return {
      question: 'Which shape has no sides?',
      answer: 'circle',
      answer_type: 'text',
    };
  }
  return {
    question: `How many sides does a ${shape.name} have?`,
    answer: String(shape.sides),
    answer_type: 'number',
  };
}

/** True-false comparative statements: only one word makes the sentence true. */
const COMPARATIVE_STATEMENTS = [
  { sentence: 'A giraffe is ___ than a goat.', options: ['taller', 'shorter'], truth: 'taller' },
  { sentence: 'An elephant is ___ than a mouse.', options: ['heavier', 'lighter'], truth: 'heavier' },
  { sentence: 'A rope is ___ than a pencil.', options: ['longer', 'shorter'], truth: 'longer' },
];

const POSITION_WORDS = ['on', 'under', 'inside', 'beside'];
const POSITION_OBJECTS = ['cup', 'book', 'ball', 'box'];
const POSITION_SURFACES = ['table', 'shelf', 'bag', 'desk'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function renderVocabulary(t: QuestionTemplate, intent: string, rng: Rng): RenderedQuestion {
  const text = intent.toLowerCase();

  if (/currency|rupee|note|coin/.test(text)) {
    const notes = randInt(rng, 1, 6);
    return {
      question: `How many rupees do ${notes} ten-rupee notes make?`,
      answer: String(notes * 10),
      answer_type: 'number',
    };
  }

  if (/positional|position|inside|under|beside|relative/.test(text)) {
    const position = pick(rng, POSITION_WORDS);
    const object = pick(rng, POSITION_OBJECTS);
    const surface = pick(rng, POSITION_SURFACES);
    return {
      question: `The ${object} is ${position} the ${surface}. Where is the ${object}?`,
      answer: position,
      answer_type: 'text',
    };
  }

  const statement = pick(rng, COMPARATIVE_STATEMENTS);
  const truth = statement.truth;
  return {
    question: `Which word completes the sentence: "${statement.sentence}"`,
    answer: truth,
    answer_type: 'choice',
    choices: shuffle(rng, statement.options),
  };
}

function renderCalendar(t: QuestionTemplate, intent: string, rng: Rng): RenderedQuestion {
  const text = intent.toLowerCase();

  if (/month/.test(text)) {
    const idx = randInt(rng, 0, MONTHS.length - 1);
    return {
      question: `Which month comes after ${MONTHS[idx]}?`,
      answer: MONTHS[(idx + 1) % MONTHS.length],
      answer_type: 'text',
    };
  }

  if (rng() < 0.5 || /week|days/.test(text)) {
    return {
      question: 'How many days are there in a week?',
      answer: '7',
      answer_type: 'number',
    };
  }

  const idx = randInt(rng, 0, DAYS.length - 1);
  return {
    question: `Which day comes after ${DAYS[idx]}?`,
    answer: DAYS[(idx + 1) % DAYS.length],
    answer_type: 'text',
  };
}

function renderReasoning(t: QuestionTemplate, intent: string, rng: Rng): RenderedQuestion {
  const [lo, hi] = rangeBounds(t.numeralRange);
  const min = Math.max(1, lo);
  const max = Math.max(min, hi - 2);
  const low = randInt(rng, min, max);
  const high = low + 2;

  return {
    question: `I am more than ${low} and less than ${high}. What number am I?`,
    answer: String(low + 1),
    answer_type: 'number',
  };
}

const RENDERERS: Record<QuestionFamily, (t: QuestionTemplate, intent: string, rng: Rng) => RenderedQuestion> = {
  counting: renderCounting,
  operation: renderOperation,
  comparison: renderComparison,
  pattern: renderPattern,
  sequencing: renderSequencing,
  classification: renderClassification,
  shape: renderShape,
  vocabulary: renderVocabulary,
  calendar: renderCalendar,
  reasoning: renderReasoning,
};

/**
 * Apply the row's `answerType` on top of the family's default answer shape.
 *
 * Only two values specialise: `mcq-4` turns a numeral answer into four
 * options, `true-false` is handled inside the operation renderer (it needs the
 * equation to be true or false about). Everything else — `fill-blanks`,
 * `matching`, `trace`, `single-number`, null — keeps the family's own shape.
 */
function applyAnswerType(rendered: RenderedQuestion, t: QuestionTemplate, rng: Rng): RenderedQuestion {
  if (t.answerType !== 'mcq-4' || rendered.answer_type !== 'number') return rendered;

  const answer = Number(rendered.answer);
  if (!Number.isFinite(answer)) return rendered;

  const choices = new Set<string>([String(answer)]);
  let attempts = 0;
  while (choices.size < 4 && attempts++ < 40) {
    const candidate = answer + randInt(rng, 1, 9) * (rng() < 0.5 ? 1 : -1);
    if (candidate >= 0) choices.add(String(candidate));
  }
  let pad = 1;
  while (choices.size < 4) choices.add(String(answer + pad++));

  return { ...rendered, answer_type: 'choice', choices: shuffle(rng, [...choices]) };
}

/**
 * The single answer instruction appended to a rendered stem.
 *
 * Read off the intent rather than hard-coded, because the intent is what says
 * how the child records an answer ("circles", "draws", "writes"). One uniform
 * hint for every family, so wordings stay comparable across a sheet.
 */
export function answerHint(intent: string): string {
  const text = (intent ?? '').toLowerCase();
  if (/\bcircles?\b/.test(text)) return 'Circle your answer';
  if (/\bdraws?\b/.test(text)) return 'Draw your answer';
  if (/\bcolou?rs?\b/.test(text)) return 'Colour the correct answer';
  if (/\bpoints?\b|\bticks?\b|\bmarks?\b/.test(text)) return 'Point to the correct answer';
  if (/\bwrites?\b|\bnumerals?\b|\bnumbers?\b/.test(text)) return 'Write the answer';
  return 'Write the answer';
}

function pickTheme(svgThemeIds: string[] | undefined, seed: string): string | undefined {
  const themes = (svgThemeIds ?? []).filter(id => typeof id === 'string' && id.trim().length > 0);
  if (themes.length === 0) return undefined;
  return themes[hashString(seed) % themes.length];
}

/**
 * Render one template into one question.
 *
 * Returns null (with a warning) when the row carries neither a usable legacy
 * pair nor an intent — a row that cannot be rendered is reported, never
 * silently replaced by a guessed question.
 */
export function renderTemplateQuestion(t: QuestionTemplate, seed: string): RenderedQuestion | null {
  const stem = (t.stem ?? '').trim();
  const answerSpec = (t.answerSpec ?? '').trim();

  // Legacy half of paramMode: print what the author typed, verbatim. A stem
  // with no answer (or an answer with no stem) is not a usable question, so it
  // falls through to the warning rather than being half-invented.
  if (stem.length > 0 && answerSpec.length > 0) {
    return {
      question: stem,
      answer: answerSpec,
      answer_type: /^\d+$/.test(answerSpec) ? 'number' : 'text',
      svgAsset: pickTheme(t.svgThemeIds, seed),
    };
  }

  const intent = (t.generationIntent ?? '').trim();
  if (intent.length === 0) {
    console.warn(`[questionTemplateRenderer] ${t.id} (${t.conceptId}) has neither a stem+answerSpec pair nor a generationIntent; skipping.`);
    return null;
  }

  const renderer = RENDERERS[t.questionFamily];
  if (!renderer) {
    console.warn(`[questionTemplateRenderer] ${t.id} has unknown questionFamily "${t.questionFamily}"; skipping.`);
    return null;
  }

  const rng = mulberry32(hashString(seed));
  const rendered = applyAnswerType(renderer(t, intent, rng), t, rng);

  return {
    ...rendered,
    question: `${rendered.question} (${answerHint(intent)})`,
    svgAsset: pickTheme(t.svgThemeIds, seed),
  };
}

/**
 * The rows this generator may draw from, in a stable order.
 *
 * Sorted by id so a given set of rows always round-robins the same way; the
 * per-instance seed still varies (see `instanceSeed`), so the sort is about
 * which template is offered first, not about which numbers come out.
 */
export function filterEligibleTemplates(templates: QuestionTemplate[]): QuestionTemplate[] {
  return templates
    .filter(t => !t.deletedAt)
    .filter(isApprovedForGeneration)
    .filter(t => t.assessmentMode !== 'observed')
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Approval gate. `status` absent means approved: #451's propose/approve
 * workflow has not landed, every existing row was authored by a Superadmin,
 * and a workflow that silently treated all existing content as draft would
 * take the Balvatika seed out of circulation with no UI to put it back.
 */
export function isApprovedForGeneration(t: QuestionTemplate): boolean {
  return (t.status ?? 'approved') === 'approved';
}

/**
 * Build `count` questions for a concept from its approved templates.
 *
 * Returns `[]` when the concept has no eligible templates (or the store
 * cannot be read), which is the caller's signal to fall back to the legacy
 * generator — a concept nobody has authored for must still produce a paper.
 */
export async function generateQuestionsFromTemplates(
  conceptId: string,
  opts: { count: number; levelNumber: number; subLevel: number }
): Promise<Question[]> {
  let rows: QuestionTemplate[] = [];
  try {
    rows = await dbStore.getQuestionTemplatesByConcept(conceptId);
  } catch (err: any) {
    console.warn(`[questionTemplateRenderer] could not read questionTemplates for ${conceptId}: ${err?.message || err}`);
    return [];
  }

  const eligible = filterEligibleTemplates(rows);
  if (eligible.length === 0) return [];

  const concept = getLevelForConcept(conceptId);
  const strand = concept?.strand ?? 'Number Sense';
  const difficulty: Question['difficulty'] = opts.subLevel === 2 ? 'easy' : opts.subLevel === 1 ? 'medium' : 'hard';

  const questions: Question[] = [];
  let cursor = 0;
  let attempts = 0;
  const maxAttempts = Math.max(opts.count * 3, eligible.length * 2);

  while (questions.length < opts.count && attempts < maxAttempts) {
    const template = eligible[cursor % eligible.length];
    cursor++;
    attempts++;

    const seed = instanceSeed(template);
    const rendered = renderTemplateQuestion(template, seed);
    if (!rendered) continue;

    questions.push({
      question_id: `${conceptId}_Q${questions.length + 1}`,
      question: rendered.question,
      answer: rendered.answer,
      answer_type: rendered.answer_type,
      choices: rendered.choices,
      topic: strand,
      subtopic: (template.name ?? '').trim() || template.questionFamily,
      difficulty,
      source_level: opts.levelNumber,
      conceptId,
      svgAsset: rendered.svgAsset,
    });
  }

  return questions;
}
