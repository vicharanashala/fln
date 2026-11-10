/**
 * A Balvatika paper carries 5 questions, never a placeholder, never a repeat (#760, #359).
 *
 * Hermetic: the one database read (`dbStore.getQuestionTemplatesByConcept`) is
 * mocked, so no MongoDB is needed. Run with:
 *   npm run test:balvatika-levels --workspace @fln/backend
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';

const { dbStore } = await import('../src/db');
const { generateQuestionsFromTemplates } = await import('../src/services/questionTemplateRenderer');
const { generateQuestionsByConcept, NoApprovedContentError } = await import('../src/utils/conceptQuestionGenerator');
const {
  generateQuestionsForLevel,
  questionsPerLevel,
  QUESTIONS_PER_LEVEL,
  QUESTIONS_PER_BALVATIKA_LEVEL,
} = await import('../src/levelGenerator');

const PLACEHOLDER = /Practice Question #|\[Concept /;

/** One approved, written counting template: enough to render many distinct questions. */
function countingTemplate(conceptId: string, numeralRange: '0-9' | '0-20' = '0-20'): any {
  return {
    id: `qtpl_${conceptId}`,
    conceptId,
    levelNumber: 19,
    levelName: 'Test level',
    skills: ['SK08'],
    subskills: ['SK08.01'],
    assessmentMode: 'written',
    generationIntent: 'Show a set of counted objects beside a blank box. The child writes the numeral matching the count of objects shown.',
    questionFamily: 'counting',
    paramMode: 'structured',
    svgThemeIds: [],
    stem: '',
    answerSpec: '',
    numeralRange,
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
    variantKey: `key_${conceptId}`,
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
  };
}

function templatesFor(t: TestContext, make: (conceptId: string) => any[]) {
  t.mock.method(dbStore, 'getQuestionTemplatesByConcept', async (conceptId: string) => make(conceptId));
}

function assertDistinct(questions: Array<{ question: string }>) {
  const texts = questions.map(q => q.question);
  assert.equal(new Set(texts).size, texts.length, 'a paper must not carry the same question twice');
}

test('a Balvatika level (19-46) carries 5 questions, every other level 4', () => {
  assert.equal(QUESTIONS_PER_BALVATIKA_LEVEL, 5);
  for (const level of [19, 28, 46]) assert.equal(questionsPerLevel(level), 5, `level ${level}`);
  for (const level of [1, 18, 47, 109]) assert.equal(questionsPerLevel(level), QUESTIONS_PER_LEVEL, `level ${level}`);
});

test('generateQuestionsFromTemplates returns `count` distinct questions', async t => {
  templatesFor(t, id => [countingTemplate(id)]);
  const questions = await generateQuestionsFromTemplates('S3.1', { count: 10, levelNumber: 19, subLevel: 0 });
  assert.equal(questions.length, 10);
  assertDistinct(questions);
});

test('when a template cannot make `count` distinct questions it returns fewer, never a repeat', async t => {
  templatesFor(t, id => [countingTemplate(id, '0-9')]);
  const warn = t.mock.method(console, 'warn', () => {});
  const questions = await generateQuestionsFromTemplates('S3.1', { count: 60, levelNumber: 19, subLevel: 0 });
  assert.ok(questions.length > 0 && questions.length < 60, `got ${questions.length}`);
  assertDistinct(questions);
  assert.ok(warn.mock.calls.some(c => String(c.arguments[0]).includes('S3.1')), 'the shortfall names the concept');
});

test('a concept with no generator and no template fails loudly instead of printing a placeholder', () => {
  assert.throws(
    () => generateQuestionsByConcept('S3.11', 0, 10),
    (error: unknown) => {
      assert.ok(error instanceof NoApprovedContentError);
      assert.equal(error.conceptId, 'S3.11');
      assert.equal(error.levelNumber, 28);
      return true;
    },
  );
});

test('generateQuestionsByConcept honours `count` and keeps the default of 4', () => {
  assert.equal(generateQuestionsByConcept('S1.1', 0).length, 4);
  const six = generateQuestionsByConcept('S1.1', 0, 6);
  assert.equal(six.length, 6);
  assertDistinct(six);
});

test('generateQuestionsForLevel: a Balvatika level with templates gives 5 distinct, non-placeholder questions', async t => {
  templatesFor(t, id => [countingTemplate(id)]);
  const questions = await generateQuestionsForLevel(19, 0);
  assert.equal(questions.length, QUESTIONS_PER_BALVATIKA_LEVEL);
  assertDistinct(questions);
  for (const q of questions) assert.doesNotMatch(q.question, PLACEHOLDER);
});

test('generateQuestionsForLevel: an observation-only Balvatika level (28) raises NoApprovedContentError', async t => {
  templatesFor(t, () => []);
  await assert.rejects(generateQuestionsForLevel(28, 0), (error: unknown) => {
    assert.ok(error instanceof NoApprovedContentError);
    assert.equal(error.conceptId, 'S3.11');
    return true;
  });
});

test('generateQuestionsForLevel: a non-Balvatika level still gives 4 questions', async t => {
  templatesFor(t, () => []);
  const questions = await generateQuestionsForLevel(1, 0);
  assert.equal(questions.length, QUESTIONS_PER_LEVEL);
  assertDistinct(questions);
});
