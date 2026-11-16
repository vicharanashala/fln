/**
 * The QR code, the box map and the saved print record of the observation sheet (#913).
 *
 * Every page of every sheet carries a QR code with the sheet id and the page. Every box is
 * recorded where it was drawn, and the sheet is saved when it is printed, so a scan can be matched
 * to the children, the concepts and the boxes.
 *
 * Hermetic: the database is a scratch file store. Run with:
 *   npm run test:observation-sheet-qr --workspace @fln/backend
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { PDFArray, PDFDocument, decodePDFRawStream } from 'pdf-lib';
import type { PDFRawStream } from 'pdf-lib';

const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-sheet-qr-test-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);
delete process.env.MONGODB_URI;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'dev-insecure-secret-change-me';

const { GRID_CONCEPTS_PER_PAGE, QR_SIZE, parseQrPayload, qrPayload, renderObservationSheet } = await import('../src/observationSheet');
const { qrModules } = await import('../src/qrCode');
const { dbStore, UserRole } = await import('../src/db');
const { buildObservationSheets } = await import('../src/services/observationSheetBuilder');
type Layout = 'class-grid' | 'per-child';

const OUTPUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'output');
const students = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i + 1}`, name: `Child ${String(i + 1).padStart(3, '0')}` }));
const concepts = (n: number) => Array.from({ length: n }, (_, i) => ({ conceptId: `S3.${i + 1}`, levelNumber: 20 + i, title: `Concept ${i + 1}` }));

async function render(layout: Layout, s = students(3), c = concepts(3), sheetId = 'OBS_test0001') {
  const result = await renderObservationSheet({ sheetId, layout, className: 'Balvatika', section: 'A', cycle: 'Baseline', students: s, concepts: c });
  const pdf = await PDFDocument.load(fs.readFileSync(result.filePath));
  return { result, pdf, cleanup: () => fs.rmSync(result.filePath, { force: true }) };
}

// ---- reading the drawn rectangles back out of a page ------------------------------------------
function pageContent(pdf: PDFDocument, pageIndex: number): string {
  const contents: any = pdf.getPage(pageIndex).node.Contents();
  const streams = contents instanceof PDFArray ? contents.asArray().map(r => pdf.context.lookup(r)) : [contents];
  return streams.map(s => Buffer.from(decodePDFRawStream(s as PDFRawStream).decode()).toString('latin1')).join('\n');
}
interface Rect { x: number; y: number; w: number; h: number; fill: string }
/** pdf-lib draws a rectangle as a translation followed by a four-point path inside q ... Q. */
function rectsOf(content: string): Rect[] {
  const out: Rect[] = [];
  for (const block of content.split(/\nQ\n?/)) {
    const path = /0 0 m\n0 ([\d.]+) l\n([\d.]+) \1 l\n\2 0 l\nh/.exec(block);
    if (!path) continue;
    let x = 0, y = 0;
    for (const m of block.matchAll(/1 0 0 1 (-?[\d.]+) (-?[\d.]+) cm/g)) { x += Number(m[1]); y += Number(m[2]); }
    const fill = /([\d.]+ [\d.]+ [\d.]+) rg/.exec(block)?.[1] ?? '';
    out.push({ x, y, w: Number(path[2]), h: Number(path[1]), fill });
  }
  return out;
}
const near = (a: number, b: number, tol = 0.06) => Math.abs(a - b) <= tol;

// ---- the QR code ------------------------------------------------------------------------------
test('every page of both layouts carries a QR code that names the sheet and the page', async () => {
  for (const [layout, s, c] of [['class-grid', students(40), concepts(7)], ['per-child', students(9), concepts(6)]] as const) {
    const { result, pdf, cleanup } = await render(layout, s, c, 'OBS_abcd1234');
    try {
      assert.equal(result.pages.length, result.pageCount);
      assert.ok(result.pageCount >= 3, `${layout} spans several pages`);
      result.pages.forEach((p, i) => {
        assert.equal(p.page, i + 1);
        assert.equal(p.qr.payload, qrPayload('OBS_abcd1234', i + 1, result.pageCount));
        assert.deepEqual(parseQrPayload(p.qr.payload), { sheetId: 'OBS_abcd1234', page: i + 1, pages: result.pageCount });
        assert.equal(p.qr.size, QR_SIZE);
        assert.ok(p.qr.x >= 20 && p.qr.x + p.qr.size <= p.width - 20 && p.qr.y >= 8 && p.qr.y + p.qr.size <= p.height - 20, `QR of page ${p.page} sits well inside the page`);
        assert.deepEqual([pdf.getPage(i).getWidth(), pdf.getPage(i).getHeight()].map(Math.round), [Math.round(p.width), Math.round(p.height)]);
      });
    } finally { cleanup(); }
  }
});

test('the QR code is really drawn: the dark squares in the PDF are exactly the dark modules of the payload', async () => {
  const { result, pdf, cleanup } = await render('per-child', students(5), concepts(5), 'OBS_drawn001');
  try {
    for (let i = 0; i < pdf.getPageCount(); i++) {
      const { qr } = result.pages[i];
      const modules = qrModules(qr.payload);
      const n = modules.length;
      const ms = QR_SIZE / n;
      const dark = rectsOf(pageContent(pdf, i)).filter(r => r.fill === '0 0 0' && near(r.w, ms, 0.01) && near(r.h, ms, 0.01));
      const seen = new Set(dark.map(r => `${Math.round((r.x - qr.x) / ms)},${n - 1 - Math.round((r.y - qr.y) / ms)}`));
      const expected = new Set<string>();
      modules.forEach((row, r) => row.forEach((on, c) => { if (on) expected.add(`${c},${r}`); }));
      assert.equal(dark.length, expected.size, `page ${i + 1}: number of dark squares`);
      assert.deepEqual([...seen].sort(), [...expected].sort(), `page ${i + 1}: positions of the dark squares`);
      assert.ok(n <= 29, `the code stays small (${n} modules) so it reads well from a phone photo`);
    }
  } finally { cleanup(); }
});

test('parseQrPayload accepts what a scanner decodes and refuses everything else', () => {
  assert.deepEqual(parseQrPayload('OBS_1a2b3c4d|2|13'), { sheetId: 'OBS_1a2b3c4d', page: 2, pages: 13 });
  assert.deepEqual(parseQrPayload('"OBS_1a2b3c4d|1|1"'), { sheetId: 'OBS_1a2b3c4d', page: 1, pages: 1 }, 'the drawn code holds the text in JSON quotes');
  assert.deepEqual(parseQrPayload('  OBS_1a2b3c4d|3|3  '), { sheetId: 'OBS_1a2b3c4d', page: 3, pages: 3 });
  for (const bad of [
    '', ' ', 'hello', 'OBS_1a2b3c4d', 'OBS_1a2b3c4d|0|3', 'OBS_1a2b3c4d|4|3', 'OBS_1a2b3c4d|a|3', 'OBS_1a2b3c4d|1|3|9',
    'obs_1a2b3c4d|1|3', 'XYZ_1a2b3c4d|1|3', 'OBS_|1|3', 'OBS_../etc|1|3', '{"studentId":"s1","worksheetId":"w1"}',
    'OBS_1a2b3c4d|99999|99999', 'OBS_1a2b3c4d|-1|3', null, undefined, 42, {}, [],
  ]) assert.equal(parseQrPayload(bad as any), null, JSON.stringify(bad));
});

// ---- the box map ------------------------------------------------------------------------------
test('class grid: a rating box is recorded for every child and concept, and the maths vocabulary column repeats on each group of columns', async () => {
  const s = students(17), c = concepts(7);
  const { result, cleanup } = await render('class-grid', s, c);
  try {
    const groups = Math.ceil(7 / GRID_CONCEPTS_PER_PAGE); // the vocabulary column is on every group of concept columns
    assert.equal(groups, 2);
    assert.equal(result.boxes.length, 17 * (7 + groups) * 4);
    assert.ok(result.boxes.every(b => b.kind === 'rating'));
    const rating = ['Proficient', 'Progressive', 'Beginner', 'Not yet assessed'];
    for (const child of s) {
      for (const concept of c) {
        const mine = result.boxes.filter(b => b.studentId === child.id && b.conceptId === concept.conceptId);
        assert.deepEqual(mine.map(b => b.value), rating, `${child.id} ${concept.conceptId}`);
        assert.equal(new Set(mine.map(b => b.page)).size, 1, 'one child and concept sit on one page');
      }
      // The check is printed once per group of columns, so a child has it on two pages here. A reader must reconcile them.
      const vocab = result.boxes.filter(b => b.studentId === child.id && b.conceptId === null);
      assert.deepEqual(vocab.map(b => b.value), [...rating, ...rating], `${child.id} vocabulary`);
      assert.equal(new Set(vocab.map(b => b.page)).size, groups);
    }
  } finally { cleanup(); }
});

test('per child: ratings, the self-correction box and six strategy circles for each concept, and the vocabulary check once per child', async () => {
  const s = students(4), c = concepts(5);
  const { result, cleanup } = await render('per-child', s, c);
  try {
    assert.equal(result.boxes.length, 4 * (5 * (4 + 1 + 6) + 4));
    for (const child of s) {
      for (const concept of c) {
        const mine = result.boxes.filter(b => b.studentId === child.id && b.conceptId === concept.conceptId);
        assert.deepEqual(mine.filter(b => b.kind === 'rating').map(b => b.value), ['Proficient', 'Progressive', 'Beginner', 'Not yet assessed']);
        assert.equal(mine.filter(b => b.kind === 'selfCorrected').length, 1);
        assert.deepEqual(mine.filter(b => b.kind === 'strategy').map(b => b.value), ['fingers', 'counters', 'mental', 'written', 'guessed', 'remembered']);
      }
      assert.equal(result.boxes.filter(b => b.studentId === child.id && b.conceptId === null).length, 4, 'one vocabulary row per child');
    }
  } finally { cleanup(); }
});

test('every recorded box was really drawn there: a square of that size at that spot exists on that page', async () => {
  for (const layout of ['class-grid', 'per-child'] as Layout[]) {
    const { result, pdf, cleanup } = await render(layout, students(16), concepts(6));
    try {
      const drawn = Array.from({ length: pdf.getPageCount() }, (_, i) => rectsOf(pageContent(pdf, i)));
      for (const b of result.boxes.filter(x => x.kind !== 'strategy')) {
        assert.ok(drawn[b.page - 1].some(r => near(r.x, b.x) && near(r.y, b.y) && near(r.w, b.size) && near(r.h, b.size) && r.fill === '1 1 1'), `${layout} ${b.kind} ${b.studentId} ${b.conceptId} ${b.value} on page ${b.page}`);
      }
    } finally { cleanup(); }
  }
});

test('boxes sit inside their page, never overlap each other and never touch the QR code, even on the fullest sheet', async () => {
  for (const layout of ['class-grid', 'per-child'] as Layout[]) {
    const { result, cleanup } = await render(layout, students(120), concepts(20));
    try {
      for (const p of result.pages) {
        const mine = result.boxes.filter(b => b.page === p.page);
        assert.ok(mine.length > 0);
        const qr = { x: p.qr.x - 6, y: p.qr.y - 6, s: p.qr.size + 12 };
        mine.forEach((b, i) => {
          assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.size <= p.width && b.y + b.size <= p.height, `box ${i} on page ${p.page} is on the page`);
          const hitsQr = b.x < qr.x + qr.s && b.x + b.size > qr.x && b.y < qr.y + qr.s && b.y + b.size > qr.y;
          assert.ok(!hitsQr, `${layout} page ${p.page}: a ${b.kind} box touches the QR code`);
        });
        // Sort by x, then compare each box with the ones that start before it ends.
        const sorted = [...mine].sort((a, b) => a.x - b.x);
        for (let i = 0; i < sorted.length; i++) {
          for (let j = i + 1; j < sorted.length && sorted[j].x < sorted[i].x + sorted[i].size - 0.01; j++) {
            const a = sorted[i], b = sorted[j];
            const overlap = a.y < b.y + b.size - 0.01 && a.y + a.size > b.y + 0.01;
            assert.ok(!overlap, `${layout} page ${p.page}: two boxes overlap`);
          }
        }
      }
    } finally { cleanup(); }
  }
});

test('a Hindi-named child and a long name still get a QR code and their boxes', async () => {
  const kids = [{ id: 'h1', name: 'प्रिया कुमारी' }, { id: 'h2', name: 'श्रीमती द्रौपदी क्ष्त्र ज्ञान '.repeat(3).trim() }, { id: 'h3', name: 'Aarav' }];
  for (const layout of ['class-grid', 'per-child'] as Layout[]) {
    const { result, cleanup } = await render(layout, kids, concepts(2));
    try {
      assert.ok(result.pages.every(p => parseQrPayload(p.qr.payload)));
      assert.ok(kids.every(k => result.boxes.some(b => b.studentId === k.id)));
    } finally { cleanup(); }
  }
});

// ---- the saved print record -------------------------------------------------------------------
const teacher = { id: 't1', email: 'teacher.qr@example.test', name: 'Teacher', role: UserRole.TEACHER, schoolId: 's1' } as any;
const classGroup = { id: 'cls1', schoolId: 's1', className: 'Balvatika', section: 'A', teacherId: 't1' };
function mockClass(t: any, n = 6) {
  t.mock.method(dbStore, 'getClasses', async () => [classGroup]);
  t.mock.method(dbStore, 'getStudents', async () => students(n).map(s => ({ ...s, schoolId: 's1', classGroup: 'Balvatika', section: 'A' })));
  t.mock.method(dbStore, 'getQuestionTemplates', async () => ['S3.7', 'S3.12', 'S3.14'].map(id => ({ id: `t_${id}`, conceptId: id, assessmentMode: 'observed', deletedAt: null })));
}

test('printing saves one record per sheet: the QR sheet id, class, cycle, layout, children, concepts, pages and boxes', async t => {
  mockClass(t);
  const saved: any[] = [];
  t.mock.method(dbStore, 'addObservationSheet', async (r: any) => { saved.push(r); return r; });
  const built = await buildObservationSheets(teacher, { classId: 'cls1', cycle: 'Mid-year', layouts: ['class-grid', 'per-child'], strict: true });
  assert.equal(built.ok, true, JSON.stringify(built));
  const files: string[] = [];
  try {
    assert.equal(saved.length, 2);
    assert.notEqual(saved[0].id, saved[1].id);
    assert.deepEqual(saved.map(r => r.layout), ['class-grid', 'per-child']);
    for (const r of saved) {
      files.push(path.join(OUTPUT_DIR, r.pdfFile));
      assert.match(r.id, /^OBS_[0-9a-f]{8}$/);
      assert.ok(fs.existsSync(path.join(OUTPUT_DIR, r.pdfFile)), 'the PDF is on disk');
      assert.deepEqual([r.classId, r.schoolId, r.className, r.section, r.cycle], ['cls1', 's1', 'Balvatika', 'A', 'Mid-year']);
      assert.deepEqual(r.students.map((s: any) => s.id), students(6).map(s => s.id));
      assert.deepEqual(r.concepts.map((c: any) => c.conceptId), ['S3.7', 'S3.12', 'S3.14']);
      assert.deepEqual([r.createdByEmail, r.createdByRole], ['teacher.qr@example.test', UserRole.TEACHER]);
      assert.ok(!Number.isNaN(Date.parse(r.createdAt)));
      assert.ok(r.pages.length >= 1 && r.pages.every((p: any) => parseQrPayload(p.qr.payload)?.sheetId === r.id), 'every page QR names this record');
      assert.ok(r.boxes.length > 0 && r.boxes.every((b: any) => b.page >= 1 && b.page <= r.pages.length));
    }
    const grid = saved[0], child = saved[1];
    assert.equal(grid.boxes.length, 6 * (3 + 1) * 4);
    assert.equal(child.boxes.length, 6 * (3 * 11 + 4));
    assert.deepEqual(built.ok && built.sheets.map(s => s.pageCount), saved.map(r => r.pages.length));
  } finally { files.forEach(f => fs.rmSync(f, { force: true })); }
});

test('if the record cannot be saved nothing printed in that request is kept, and the teacher is told', async t => {
  mockClass(t);
  let calls = 0;
  t.mock.method(dbStore, 'addObservationSheet', async (r: any) => { if (++calls === 2) throw new Error('disk full'); return r; });
  const before = new Set(fs.existsSync(OUTPUT_DIR) ? fs.readdirSync(OUTPUT_DIR) : []);
  const built = await buildObservationSheets(teacher, { classId: 'cls1', cycle: 'Baseline', layouts: ['class-grid', 'per-child'], strict: true });
  assert.deepEqual(built, { ok: false, status: 500, error: 'Could not save the sheet record, so no sheet was printed. Please try again.' });
  const left = fs.readdirSync(OUTPUT_DIR).filter(f => !before.has(f) && f.startsWith('observation_sheet_'));
  assert.deepEqual(left, [], 'no PDF from the failed request stays on disk');
});

test('the record round-trips through the database, a repeated id is refused and an unknown id gives null', async () => {
  await dbStore.init();
  const record: any = {
    id: 'OBS_roundtrip', classId: 'c', schoolId: 's', className: 'Balvatika', section: 'A', cycle: 'Baseline', layout: 'per-child',
    students: [{ id: 's1', name: 'Aarav' }], concepts: [{ conceptId: 'S3.7', levelNumber: 25, title: 'T' }],
    pages: [{ page: 1, width: 595.28, height: 841.89, qr: { payload: 'OBS_roundtrip|1|1', x: 507.3, y: 14, size: 48 } }],
    boxes: [{ page: 1, kind: 'rating', studentId: 's1', conceptId: 'S3.7', value: 'Proficient', x: 40, y: 700, size: 11 }],
    pdfFile: 'x.pdf', createdAt: new Date().toISOString(), createdByEmail: 'a@b.test', createdByRole: 'teacher',
  };
  await dbStore.addObservationSheet(record);
  assert.deepEqual(await dbStore.getObservationSheet('OBS_roundtrip'), record);
  await assert.rejects(() => dbStore.addObservationSheet(record), /already exists/);
  assert.equal(await dbStore.getObservationSheet('OBS_nope'), null);
});
