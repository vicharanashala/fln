/**
 * Tests for the question-template renderer (issue #486).
 *
 * Plain-script convention (node:assert, no runner). Run with:
 *   npm run test:template-renderer --workspace @fln/backend
 *
 * Pure functions under test — no DB / network. `generateQuestionsFromTemplates`
 * is the only async/db-touching export and is deliberately not covered here;
 * it is exercised by running the app against the real backend.
 */
import assert from 'node:assert';
import { QuestionTemplate } from '../db';
import {
  renderTemplateQuestion,
  filterEligibleTemplates,
  isApprovedForGeneration,
  answerHint,
  instanceSeed,
} from './questionTemplateRenderer';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (error: any) {
    failed++;
    console.error(`  FAIL  ${name}\n        ${error?.message || error}`);
  }
}

/** Silence the renderer's expected warnings around a single assertion. */
function quiet<T>(fn: () => T): T {
  const original = console.warn;
  console.warn = () => {};
  try { return fn(); } finally { console.warn = original; }
}

function makeTemplate(overrides: Partial<QuestionTemplate> = {}): QuestionTemplate {
  return {
    id: 'qtpl_test01',
    conceptId: 'S3.1',
    levelNumber: 19,
    levelName: 'Numeral Recognition (1-10)',
    skills: ['SK08'],
    subskills: ['SK08.01'],
    assessmentMode: 'written',
    generationIntent: 'Show a set of counted objects beside a blank box. The child writes the numeral matching the count of objects shown.',
    questionFamily: 'counting',
    paramMode: 'structured',
    svgThemeIds: [],
    stem: '',
    answerSpec: '',
    numeralRange: '0-20',
    digitCount: null,
    operations: [],
    maxOperandCount: null,
    carryBehavior: null,
    borrowBehavior: null,
    maxSumOrDifference: null,
    answerType: null,
    blankCount: null,
    questionCount: 1,
    subjectCategory: null,
    name: 'Test row',
    variantKey: 'testkey',
    tags: [],
    source: 'form',
    createdBy: 'test',
    createdByEmail: 'test@fln.internal',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    updatedBy: 'test',
    updatedByEmail: 'test@fln.internal',
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  };
}

// --- paramMode: both models, neither overriding the other --------------------

test('legacy stem + answerSpec is printed verbatim, with no hint appended', () => {
  const t = makeTemplate({
    stem: 'Count the stars: * * *. How many stars are there?',
    answerSpec: '3',
    generationIntent: '',
    paramMode: 'legacy-free-text',
  });
  const rendered = renderTemplateQuestion(t, instanceSeed(t));
  assert.ok(rendered, 'expected a render');
  assert.strictEqual(rendered!.question, t.stem);
  assert.strictEqual(rendered!.answer, '3');
  assert.strictEqual(rendered!.answer_type, 'number');
});

test('legacy row with no answerSpec is skipped, not guessed at', () => {
  const t = makeTemplate({ stem: 'Count the stars.', answerSpec: '', generationIntent: '' });
  const rendered = quiet(() => renderTemplateQuestion(t, instanceSeed(t)));
  assert.strictEqual(rendered, null);
});

test('row with neither legacy pair nor intent is skipped with a warning', () => {
  const t = makeTemplate({ stem: '', answerSpec: '', generationIntent: '   ' });
  const rendered = quiet(() => renderTemplateQuestion(t, instanceSeed(t)));
  assert.strictEqual(rendered, null);
});

// --- intent rendering --------------------------------------------------------

test('a counting intent renders concrete wording, numbers and an answer', () => {
  const t = makeTemplate();
  const rendered = renderTemplateQuestion(t, instanceSeed(t));
  assert.ok(rendered, 'expected a render');
  assert.match(rendered!.question, /^Count the /);
  assert.match(rendered!.question, /\(Write the answer\)$/);
  const answer = Number(rendered!.answer);
  assert.ok(Number.isInteger(answer) && answer >= 1 && answer <= 12, `answer ${rendered!.answer} out of range`);
});

test('the answer instruction is taken from the intent', () => {
  assert.strictEqual(
    answerHint('The child circles the set whose count matches the numeral.'),
    'Circle your answer'
  );
  assert.strictEqual(
    answerHint('The child draws or colours what comes next in the pattern.'),
    'Draw your answer'
  );
  assert.strictEqual(answerHint('Something unspecified about quantities.'), 'Write the answer');
});

test('the same template + seed renders identically every time', () => {
  const t = makeTemplate({ questionFamily: 'operation', operations: ['add'], subjectCategory: 'mixed' });
  const first = renderTemplateQuestion(t, 'seed-abc');
  const second = renderTemplateQuestion(t, 'seed-abc');
  assert.deepStrictEqual(first, second);
});

test('every family renders a question with an answer', () => {
  const intents: Record<string, string> = {
    counting: 'Show a set of counted objects beside a blank box. The child writes the numeral matching the count.',
    operation: "Show two small groups of objects whose combined total is 9 or fewer, with no plus symbol shown. The child counts the total and writes it.",
    comparison: 'Show two sets of objects with different counts, with a numeral beneath each. The child circles the numeral that is more.',
    pattern: 'Show a repeating pattern with the next item left blank. The child draws what comes next.',
    sequencing: 'Show a sequence of numerals with one numeral missing. The child writes the missing numeral.',
    classification: 'Show a mixed set of objects varying by shape and colour. The child circles the objects sharing one property.',
    shape: 'Ask the child to identify the named 2D shape shown.',
    vocabulary: 'Show three objects differing in length. The child circles the comparative word describing them.',
    calendar: 'Ask the child which day of the week comes after a given day.',
    reasoning: "Pose a simple oral number riddle: I am more than 3 and less than 5 -- what number am I?",
  };

  for (const [family, intent] of Object.entries(intents)) {
    const t = makeTemplate({
      questionFamily: family as QuestionTemplate['questionFamily'],
      generationIntent: intent,
      operations: family === 'operation' ? ['add'] : [],
      subjectCategory: family === 'operation' ? 'mixed' : null,
    });
    const rendered = renderTemplateQuestion(t, instanceSeed(t));
    assert.ok(rendered, `family ${family} did not render`);
    assert.ok(rendered!.question.length > 0, `family ${family} rendered an empty question`);
    assert.ok(rendered!.answer.length > 0, `family ${family} rendered an empty answer`);
  }
});

test('mcq-4 turns a numeral answer into exactly four choices including the answer', () => {
  const t = makeTemplate({ answerType: 'mcq-4' });
  const rendered = renderTemplateQuestion(t, instanceSeed(t));
  assert.ok(rendered, 'expected a render');
  assert.strictEqual(rendered!.answer_type, 'choice');
  assert.strictEqual(rendered!.choices?.length, 4);
  assert.ok(rendered!.choices!.includes(rendered!.answer), 'choices must contain the correct answer');
  assert.strictEqual(new Set(rendered!.choices).size, 4, 'choices must be distinct');
});

test('true-false operation renders a checkable equation with both options', () => {
  const t = makeTemplate({
    questionFamily: 'operation',
    operations: ['add'],
    answerType: 'true-false',
    subjectCategory: null,
    generationIntent: 'Show an addition equation and ask whether it is true or false.',
  });
  const rendered = renderTemplateQuestion(t, instanceSeed(t));
  assert.ok(rendered, 'expected a render');
  assert.ok(['true', 'false'].includes(rendered!.answer));
  assert.deepStrictEqual(rendered!.choices, ['true', 'false']);
  assert.match(rendered!.question, /True or false/);
});

test('an operation with a subject category reads as a word problem, not an equation', () => {
  const t = makeTemplate({
    questionFamily: 'operation',
    operations: ['add'],
    subjectCategory: 'fruits',
    generationIntent: 'Show two small groups of objects whose combined total is 9 or fewer.',
  });
  const rendered = renderTemplateQuestion(t, instanceSeed(t));
  assert.ok(rendered, 'expected a render');
  assert.ok(!rendered!.question.includes('+'), `expected no operator symbol: ${rendered!.question}`);
});

test('svgThemeIds resolve to one of the named themes on the generated question', () => {
  const t = makeTemplate({ svgThemeIds: ['fruits', 'animals'] });
  const rendered = renderTemplateQuestion(t, instanceSeed(t));
  assert.ok(rendered, 'expected a render');
  assert.ok(rendered!.svgAsset === 'fruits' || rendered!.svgAsset === 'animals');
});

// --- eligibility -------------------------------------------------------------

test('only approved rows are eligible (absent status counts as approved)', () => {
  assert.ok(isApprovedForGeneration(makeTemplate()));
  assert.ok(isApprovedForGeneration(makeTemplate({ status: 'approved' })));
  assert.ok(!isApprovedForGeneration(makeTemplate({ status: 'pendingApproval' })));
  assert.ok(!isApprovedForGeneration(makeTemplate({ status: 'draft' })));
  assert.ok(!isApprovedForGeneration(makeTemplate({ status: 'rejected' })));
});

test('observed-only and soft-deleted rows never reach a worksheet', () => {
  const eligible = filterEligibleTemplates([
    makeTemplate({ id: 'a', status: 'approved', assessmentMode: 'observed' }),
    makeTemplate({ id: 'b', status: 'approved', assessmentMode: 'written' }),
    makeTemplate({ id: 'c', status: 'approved', assessmentMode: 'both' }),
    makeTemplate({ id: 'd', status: 'rejected', assessmentMode: 'written' }),
    makeTemplate({ id: 'e', status: 'approved', assessmentMode: 'written', deletedAt: '2026-10-01T00:00:00.000Z' }),
  ]);
  assert.deepStrictEqual(eligible.map(t => t.id), ['b', 'c']);
});

test('eligibility order is stable across calls', () => {
  const rows = [makeTemplate({ id: 'z' }), makeTemplate({ id: 'a' }), makeTemplate({ id: 'm' })];
  assert.deepStrictEqual(
    filterEligibleTemplates(rows).map(t => t.id),
    filterEligibleTemplates([...rows].reverse()).map(t => t.id)
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
