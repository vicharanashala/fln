import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  paginateQuestions,
  getQuestionHeightMm,
  paginateDOMBlocks,
  MAX_QUESTIONS_PER_PAGE,
  QuestionLayoutInput,
} from '../src/worksheetPagination.js';
import { getPaperTypeConfig } from '../src/config/paperTypeConfig.js';

test('TEST 1: 4 compact questions -> 1 page', () => {
  const questions: QuestionLayoutInput[] = [
    { id: 'q1', answerType: 'single-number' },
    { id: 'q2', answerType: 'single-number' },
    { id: 'q3', answerType: 'single-number' },
    { id: 'q4', answerType: 'single-number' },
  ];

  const result = paginateQuestions(questions);
  assert.equal(result.totalPages, 1);
  assert.equal(result.pages.length, 1);
  assert.equal(result.pages[0].questions.length, 4);
  assert.deepEqual(result.pages[0].questionIds, ['q1', 'q2', 'q3', 'q4']);
});

test('TEST 2: 5 questions -> at least 2 pages', () => {
  const questions: QuestionLayoutInput[] = Array.from({ length: 5 }, (_, i) => ({
    id: `q${i + 1}`,
    answerType: 'single-number',
  }));

  const result = paginateQuestions(questions);
  assert.ok(result.totalPages >= 2, `Expected at least 2 pages, got ${result.totalPages}`);
  assert.equal(result.pages[0].questions.length, 4);
  assert.equal(result.pages[1].questions.length, 1);
});

test('TEST 3: 8 questions -> at least 2 pages', () => {
  const questions: QuestionLayoutInput[] = Array.from({ length: 8 }, (_, i) => ({
    id: `q${i + 1}`,
    answerType: 'single-number',
  }));

  const result = paginateQuestions(questions);
  assert.ok(result.totalPages >= 2, `Expected at least 2 pages, got ${result.totalPages}`);
  for (const page of result.pages) {
    assert.ok(page.questions.length <= MAX_QUESTIONS_PER_PAGE, 'Page contains > 4 questions');
  }
  assert.equal(result.pages[0].questions.length, 4);
  assert.equal(result.pages[1].questions.length, 4);
});

test('TEST 4: 9 questions -> at least 3 pages', () => {
  const questions: QuestionLayoutInput[] = Array.from({ length: 9 }, (_, i) => ({
    id: `q${i + 1}`,
    answerType: 'single-number',
  }));

  const result = paginateQuestions(questions);
  assert.ok(result.totalPages >= 3, `Expected at least 3 pages, got ${result.totalPages}`);
  for (const page of result.pages) {
    assert.ok(page.questions.length <= MAX_QUESTIONS_PER_PAGE, 'Page contains > 4 questions');
  }
  assert.equal(result.pages[0].questions.length, 4);
  assert.equal(result.pages[1].questions.length, 4);
  assert.equal(result.pages[2].questions.length, 1);
});

test('TEST 5: 10 questions -> at least 3 pages', () => {
  const questions: QuestionLayoutInput[] = Array.from({ length: 10 }, (_, i) => ({
    id: `q${i + 1}`,
    answerType: 'single-number',
  }));

  const result = paginateQuestions(questions);
  assert.ok(result.totalPages >= 3, `Expected at least 3 pages, got ${result.totalPages}`);
  for (const page of result.pages) {
    assert.ok(page.questions.length <= MAX_QUESTIONS_PER_PAGE, 'Page contains > 4 questions');
  }
  assert.equal(result.pages[0].questions.length, 4);
  assert.equal(result.pages[1].questions.length, 4);
  assert.equal(result.pages[2].questions.length, 2);
});

test('TEST 6: A question with large answer-space requirements causes an earlier page break', () => {
  // Matching questions consume ~75mm each (content + box 48mm + margin 8mm + padding 4mm).
  // Usable height on page 1 is 297 - 14 - 14 - 35 - 10 = 224mm.
  // 3 matching questions = ~225mm > 224mm.
  // Therefore Page 1 gets 2 matching questions, and Q3 breaks early to Page 2.
  const questions: QuestionLayoutInput[] = [
    { id: 'q1', answerType: 'matching' },
    { id: 'q2', answerType: 'matching' },
    { id: 'q3', answerType: 'matching' },
    { id: 'q4', answerType: 'matching' },
  ];

  const result = paginateQuestions(questions);
  assert.ok(result.totalPages > 1, 'Large answer-space questions should cause an earlier page break');
  assert.ok(result.pages[0].questions.length < 4, 'Page 1 should break before 4 questions due to height');
  assert.equal(result.pages[0].questionIds[0], 'q1');
  assert.equal(result.pages[0].questionIds[1], 'q2');
});

test('TEST 7: A trace question is never split between pages', () => {
  // 2 large questions + 1 trace question
  const questions: QuestionLayoutInput[] = [
    { id: 'q1', answerType: 'matching' },
    { id: 'q2', answerType: 'matching' },
    { id: 'q3_trace', answerType: 'trace' },
  ];

  const result = paginateQuestions(questions);
  // q3_trace must be assigned atomically to a page
  const pageForTrace = result.questionPageMap['q3_trace'];
  assert.ok(pageForTrace !== undefined, 'Trace question must be assigned to a page');
  assert.equal(
    result.pages[pageForTrace - 1].questionIds.includes('q3_trace'),
    true,
    'Trace question must exist as a full atomic question in page'
  );
});

test('TEST 8: No page ever contains more than 4 questions', () => {
  for (let count = 1; count <= 20; count++) {
    const questions: QuestionLayoutInput[] = Array.from({ length: count }, (_, i) => ({
      id: `q${i + 1}`,
      answerType: i % 2 === 0 ? 'single-number' : 'fill-blanks',
    }));

    const result = paginateQuestions(questions);
    for (const page of result.pages) {
      assert.ok(
        page.questions.length <= MAX_QUESTIONS_PER_PAGE,
        `Page ${page.pageNumber} contained ${page.questions.length} questions, expected <= ${MAX_QUESTIONS_PER_PAGE}`
      );
    }
  }
});

test('TEST 9: Question ordering is preserved', () => {
  const questions: QuestionLayoutInput[] = Array.from({ length: 12 }, (_, i) => ({
    id: `item_${String(i + 1).padStart(2, '0')}`,
    answerType: i % 3 === 0 ? 'mcq-4' : 'single-number',
  }));

  const result = paginateQuestions(questions);
  const reassembledIds = result.pages.flatMap(p => p.questionIds);
  const originalIds = questions.map(q => q.id);

  assert.deepEqual(reassembledIds, originalIds, 'Question order must be preserved across pages');
});

test('TEST 10: No questions are lost or duplicated', () => {
  const questions: QuestionLayoutInput[] = Array.from({ length: 10 }, (_, i) => ({
    id: `q_${i + 1}`,
    answerType: i % 4 === 0 ? 'trace' : 'true-false',
  }));

  const result = paginateQuestions(questions);
  const reassembledIds = result.pages.flatMap(p => p.questionIds);

  assert.equal(reassembledIds.length, questions.length);
  assert.equal(new Set(reassembledIds).size, questions.length);
});

test('TEST 11: A question whose height exceeds remaining page space is moved entirely to next page', () => {
  // q1 (compact), q2 (compact), q3 (large matching question that cannot fit in remaining space)
  const q1H = getQuestionHeightMm({ id: 'q1', answerType: 'single-number' });
  const q2H = getQuestionHeightMm({ id: 'q2', answerType: 'single-number' });
  const q3H = getQuestionHeightMm({ id: 'q3', answerType: 'matching' });

  // Usable height 100mm. q1H+q2H = ~70mm. Adding q3H (75mm) = 145mm > 100mm.
  const result = paginateQuestions(
    [
      { id: 'q1', answerType: 'single-number' },
      { id: 'q2', answerType: 'single-number' },
      { id: 'q3', answerType: 'matching' },
    ],
    {
      pageHeightMm: 200,
      marginTopMm: 10,
      marginBottomMm: 10,
      headerHeightPage1Mm: 40,
      footerHeightMm: 40, // usable height = 200 - 10 - 10 - 40 - 40 = 100mm
    }
  );

  assert.equal(result.pages[0].questionIds.length, 2);
  assert.deepEqual(result.pages[0].questionIds, ['q1', 'q2']);
  assert.equal(result.pages[1].questionIds.length, 1);
  assert.deepEqual(result.pages[1].questionIds, ['q3']);
});

test('TEST 12: Paper-type totals remain controlled by paperTypeConfig', () => {
  const diagConfig = getPaperTypeConfig('diagnostic');
  const practiceConfig = getPaperTypeConfig('practice');

  assert.equal(diagConfig.questionCount, 10);
  assert.equal(practiceConfig.questionCount, 8);

  const diagQuestions = Array.from({ length: diagConfig.questionCount }, (_, i) => ({
    id: `diag_q${i + 1}`,
    answerType: 'single-number',
  }));

  const practiceQuestions = Array.from({ length: practiceConfig.questionCount }, (_, i) => ({
    id: `prac_q${i + 1}`,
    answerType: 'single-number',
  }));

  const diagResult = paginateQuestions(diagQuestions, { paperType: 'diagnostic' });
  const practiceResult = paginateQuestions(practiceQuestions, { paperType: 'practice' });

  assert.equal(diagResult.pages.flatMap(p => p.questions).length, 10);
  assert.equal(diagResult.totalPages, 3); // 4 + 4 + 2

  assert.equal(practiceResult.pages.flatMap(p => p.questions).length, 8);
  assert.equal(practiceResult.totalPages, 2); // 4 + 4
});

test('EDGE CASES: zero, one, missing/unknown answerType, circle shape, DOM blocks', () => {
  // Zero questions
  const zeroRes = paginateQuestions([]);
  assert.equal(zeroRes.totalPages, 0);
  assert.equal(zeroRes.pages.length, 0);

  // One question
  const oneRes = paginateQuestions([{ id: 'q1' }]);
  assert.equal(oneRes.totalPages, 1);
  assert.equal(oneRes.pages[0].questions.length, 1);

  // Missing / unknown answerType
  const unknownRes = paginateQuestions([
    { id: 'q1', answerType: undefined },
    { id: 'q2', answerType: 'unknown-custom-type' },
  ]);
  assert.equal(unknownRes.totalPages, 1);
  assert.equal(unknownRes.pages[0].questions.length, 2);

  // Circle shape expansion
  const normalH = getQuestionHeightMm({ id: 'q1', answerType: 'single-number' });
  const circleH = getQuestionHeightMm({ id: 'q2', answerType: 'circle' });
  assert.ok(circleH > normalH, 'Circle answer shape should increase layout height');

  // DOM blocks slicing helper
  const domBlocks = [
    { top: 0, bottom: 50, isQuestion: false }, // header
    { top: 50, bottom: 150, isQuestion: true }, // q1
    { top: 150, bottom: 250, isQuestion: true }, // q2
    { top: 250, bottom: 350, isQuestion: true }, // q3
    { top: 350, bottom: 450, isQuestion: true }, // q4
    { top: 450, bottom: 550, isQuestion: true }, // q5 (5th question -> must trigger new page)
    { top: 550, bottom: 600, isQuestion: false }, // footer
  ];

  const slicedPages = paginateDOMBlocks(domBlocks, 1000, 4);
  assert.equal(slicedPages.length, 2);
  assert.equal(slicedPages[0].questionCount, 4);
  assert.equal(slicedPages[1].questionCount, 1);
});
