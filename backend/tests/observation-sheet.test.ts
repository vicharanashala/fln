/**
 * The printed teacher observation sheet (#618): the page plans, and the PDFs they draw.
 *
 * Hermetic: no database. Run with:
 *   npm run test:observation-sheet --workspace @fln/backend
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { PDFArray, PDFDocument, decodePDFRawStream } from 'pdf-lib';
import type { PDFRawStream } from 'pdf-lib';
import {
  CHILD_BLOCKS_PER_PAGE,
  CHILD_CONCEPTS_PER_BLOCK,
  GRID_CONCEPTS_PER_PAGE,
  GRID_STUDENTS_PER_PAGE,
  MATHS_VOCABULARY_LABEL,
  MATHS_VOCABULARY_TEXT,
  listLabel,
  planChildPages,
  planGridPages,
  renderObservationSheet,
} from '../src/observationSheet';
import type { ObservationLayout } from '../src/observationSheet';

const concept = (n: number) => ({ conceptId: `S3.${n}`, levelNumber: 19 + n, title: `Concept number ${n}` });
const student = (n: number, name = `Child ${n}`) => ({ id: `s${n}`, name });
const concepts = (count: number) => Array.from({ length: count }, (_, i) => concept(i + 1));
const students = (count: number) => Array.from({ length: count }, (_, i) => student(i + 1));

// --- page plans -----------------------------------------------------------------

test('class grid: every child appears under every concept exactly once', () => {
  for (const [s, c] of [[1, 1], [14, 5], [15, 6], [17, 7], [40, 12]]) {
    const seen = new Map<string, number>();
    for (const p of planGridPages(s, c)) {
      assert.ok(p.studentTo - p.studentFrom <= GRID_STUDENTS_PER_PAGE, 'children per page');
      assert.ok(p.conceptTo - p.conceptFrom <= GRID_CONCEPTS_PER_PAGE, 'concepts per page');
      for (let i = p.studentFrom; i < p.studentTo; i++) {
        for (let j = p.conceptFrom; j < p.conceptTo; j++) seen.set(`${i}:${j}`, (seen.get(`${i}:${j}`) ?? 0) + 1);
      }
    }
    assert.equal(seen.size, s * c, `${s} children x ${c} concepts`);
    assert.ok([...seen.values()].every(n => n === 1), 'no pair is printed twice');
  }
});

test('class grid: a small class and one concept is one page; a larger one is split', () => {
  assert.equal(planGridPages(1, 1).length, 1);
  assert.equal(planGridPages(17, 7).length, 4); // 2 pages of children x 2 groups of concepts
});

test('per child: each child gets every concept once, two half pages to a sheet, and one vocabulary check', () => {
  for (const [s, c] of [[1, 1], [3, 4], [3, 5], [17, 7]]) {
    const pages = planChildPages(s, c);
    const blocks = pages.flat();
    assert.ok(pages.every(p => p.length >= 1 && p.length <= CHILD_BLOCKS_PER_PAGE));
    for (let child = 0; child < s; child++) {
      const mine = blocks.filter(b => b.studentIndex === child);
      const covered = mine.flatMap(b => Array.from({ length: b.conceptTo - b.conceptFrom }, (_, k) => b.conceptFrom + k));
      assert.deepEqual(covered, Array.from({ length: c }, (_, k) => k), `child ${child} sees every concept in order`);
      assert.ok(mine.every(b => b.conceptTo - b.conceptFrom <= CHILD_CONCEPTS_PER_BLOCK));
      assert.equal(mine.filter(b => b.isLast).length, 1, 'the vocabulary check is printed once per child');
      assert.equal(mine[mine.length - 1].isLast, true, 'and on their last block');
    }
  }
});

test('a Hindi name gets a Latin word first, so the font library does not take its Indic path', () => {
  assert.equal(listLabel(3, 'Aarav Sharma'), '3. Aarav Sharma');
  assert.match(listLabel(3, 'प्रिया कुमारी'), /^No\. 3 /);
});

// --- the PDFs ---------------------------------------------------------------------

function pageContent(pdf: PDFDocument, pageIndex: number): string {
  const contents: any = pdf.getPage(pageIndex).node.Contents();
  const streams = contents instanceof PDFArray ? contents.asArray().map(r => pdf.context.lookup(r)) : [contents];
  return streams.map(s => Buffer.from(decodePDFRawStream(s as PDFRawStream).decode()).toString('latin1')).join('\n');
}

/** Every Latin string drawn on a page (a Devanagari run is stored as glyph ids, so it is not listed here). */
function pageStrings(pdf: PDFDocument, pageIndex: number): string[] {
  return [...pageContent(pdf, pageIndex).matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)].map(m => Buffer.from(m[1], 'hex').toString('latin1'));
}

async function render(layout: ObservationLayout, s = students(3), c = concepts(3)) {
  const result = await renderObservationSheet({ sheetId: 'OBS_TEST', layout, className: 'Balvatika', section: 'A', cycle: 'Baseline', students: s, concepts: c });
  const pdf = await PDFDocument.load(fs.readFileSync(result.filePath));
  return { result, pdf, cleanup: () => fs.rmSync(result.filePath, { force: true }) };
}

test('class grid PDF: one page per plan page, with the legend, a column per concept and the maths vocabulary column on every page', async () => {
  const { result, pdf, cleanup } = await render('class-grid', students(17), concepts(7));
  try {
    assert.equal(result.pageCount, planGridPages(17, 7).length);
    assert.equal(pdf.getPageCount(), result.pageCount);
    for (let p = 0; p < pdf.getPageCount(); p++) {
      const strings = pageStrings(pdf, p);
      assert.ok(strings.some(t => t.startsWith('Tick one box for each child')), `page ${p + 1} has the legend`);
      assert.ok(strings.includes(MATHS_VOCABULARY_LABEL), `page ${p + 1} has the maths vocabulary column`);
    }
    const first = pageStrings(pdf, 0);
    assert.ok(first.includes('L20 S3.1') && first.includes('L24 S3.5'), 'the first five concepts are columns');
    assert.ok(!first.includes('L25 S3.6'), 'the sixth concept waits for the next group of columns');
    assert.ok(first.some(t => t.startsWith('1. Child 1')) && first.some(t => t.startsWith('14. Child 14')));
    assert.ok(!first.some(t => t.startsWith('15. Child 15')), 'the 15th child is on the next page');
  } finally { cleanup(); }
});

test('per-child PDF: every child has a half page, every concept has its boxes, and the vocabulary check is printed once per child', async () => {
  const { result, pdf, cleanup } = await render('per-child', students(3), concepts(5));
  try {
    assert.equal(pdf.getPageCount(), result.pageCount);
    const all = Array.from({ length: pdf.getPageCount() }, (_, p) => pageStrings(pdf, p)).flat();
    for (const n of [1, 2, 3]) assert.ok(all.includes(`Name: Child ${n}`), `child ${n} has a block`);
    assert.equal(all.filter(t => t === MATHS_VOCABULARY_TEXT).length, 3, 'one vocabulary check per child');
    assert.equal(all.filter(t => t === 'Noticed and fixed their own mistake').length, 3 * 5, 'a self-correction box for every child and concept');
    for (const label of ['fingers', 'counters', 'in head', 'written']) {
      assert.equal(all.filter(t => t === label).length, 3 * 5, `the "${label}" choice for every child and concept`);
    }
    assert.equal(all.filter(t => t === 'Proficient (on their own)').length, 3 * 5 + 3, 'rating boxes: every concept plus the vocabulary check');
  } finally { cleanup(); }
});

test('a Hindi name prints on both layouts without an error', async () => {
  for (const layout of ['class-grid', 'per-child'] as ObservationLayout[]) {
    const { pdf, cleanup } = await render(layout, [student(1, 'प्रिया कुमारी'), student(2, 'Aarav')], concepts(2));
    try {
      assert.ok(pdf.getPageCount() >= 1, layout);
    } finally { cleanup(); }
  }
});

test('an observation sheet needs children, concepts and a known layout', async () => {
  await assert.rejects(() => render('class-grid', [], concepts(1)), RangeError);
  await assert.rejects(() => render('class-grid', students(1), []), RangeError);
  await assert.rejects(() => render('wall-chart' as ObservationLayout), RangeError);
});
