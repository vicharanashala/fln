import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import {
  MIN_ANSWER_BOX_HEIGHT_PT,
  MIN_FONT_SIZE_PT,
  OVERFLOW_POLICY,
  QUESTIONS_PER_PAGE_MAX,
  planQuestionPages,
} from '../src/config/worksheetLayoutRules';
import { renderWorksheetPdf } from '../src/paperGenerator';

test('the fixed Balvatika minimums: 18 pt text, a 58 pt answer box a young child can write in, 4 questions a page', () => {
  assert.equal(MIN_FONT_SIZE_PT, 18);
  assert.equal(MIN_ANSWER_BOX_HEIGHT_PT, 58);
  assert.equal(QUESTIONS_PER_PAGE_MAX, 4);
});

test('OVERFLOW_POLICY: minimums win, pages flex, nothing is shrunk or cut', () => {
  assert.deepEqual(OVERFLOW_POLICY, {
    minimumsWin: true,
    pageCountFlexes: true,
    shrinkToFit: false,
    truncateContent: false,
  });
});

const opts = { maxPerPage: 4, availableHeight: 500, gap: 30 };

test('planQuestionPages: short questions fill pages up to the maximum', () => {
  const pages = planQuestionPages(Array(10).fill(60), opts);
  assert.deepEqual(pages.map(p => p.length), [4, 4, 2]);
});

test('planQuestionPages: tall questions move to the next page instead of overflowing', () => {
  // 150 pt blocks with a 30 pt gap: three fit in 500 pt (3*150 + 2*30 = 510 is too much, two fit).
  const pages = planQuestionPages(Array(6).fill(150), opts);
  assert.deepEqual(pages.map(p => p.length), [2, 2, 2]);
  for (const page of pages) {
    const used = page.reduce((sum, _i, k) => sum + 150 + (k > 0 ? 30 : 0), 0);
    assert.ok(used <= opts.availableHeight, `page uses ${used} pt of ${opts.availableHeight}`);
  }
});

test('planQuestionPages: every question is kept, in order, exactly once', () => {
  const heights = [60, 200, 90, 400, 60, 60, 300, 60];
  const flat = planQuestionPages(heights, opts).flat();
  assert.deepEqual(flat, heights.map((_h, i) => i));
});

test('planQuestionPages: one block taller than a page is placed alone, not dropped', () => {
  const pages = planQuestionPages([60, 900, 60], opts);
  assert.deepEqual(pages, [[0], [1], [2]]);
});

test('planQuestionPages: no questions gives no pages', () => {
  assert.deepEqual(planQuestionPages([], opts), []);
});

test('a Balvatika paper of long questions flexes to more pages and keeps all of them', async () => {
  const long =
    'Look carefully at the collection of colourful classroom objects on the table, count every single object only once, think about the answer, and then write the matching numeral in the box below.';
  const questions = Array.from({ length: 8 }, (_, i) => ({
    question_id: `long-${i + 1}`,
    question: `${long} ${long} Question ${i + 1}.`,
    answer: `${i + 1}`,
    answer_type: 'number' as const,
    topic: 'Numbers',
    subtopic: 'Counting',
    difficulty: 'easy' as const,
    source_level: 19,
  }));
  const result = await renderWorksheetPdf({
    worksheetId: 'test-603',
    className: 'Balvatika',
    section: 'A',
    cycle: 'Test',
    studentsWithQuestions: [
      { studentId: 's-603', name: 'Layout Student', currentLevel: 19, currentSubLevel: 0, questions },
    ],
  });
  try {
    const pdf = await PDFDocument.load(fs.readFileSync(result.filePath));
    // Each of these questions needs 7 lines at 18 pt (about 200 pt with its box), so 4 per page
    // would not fit: the page count must be larger than the 2 pages a plain 4-per-page split gives.
    assert.ok(pdf.getPageCount() > 2, `expected more than 2 pages, got ${pdf.getPageCount()}`);
    assert.ok(pdf.getPageCount() <= 8, 'never more than one page per question');
  } finally {
    if (fs.existsSync(result.filePath)) fs.unlinkSync(result.filePath);
  }
});
