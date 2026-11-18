// #904 Part A: a printed concept worksheet leaves a worksheet record and an answer key, and every
// page of a child's copy carries a QR code that names the worksheet, the child and the page.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { fileURLToPath } from 'node:url';

// Isolate DB from the real repository data.
const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-concept-sheet-record-test-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);
delete process.env.MONGODB_URI;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'dev-insecure-secret-change-me';

const { dbStore } = await import('../src/db');
const { JWT_SECRET } = await import('../src/auth');
const { renderConceptWorksheet } = await import('../src/paperGenerator');
const { registerWorksheetRoutes } = await import('../src/routes/worksheets');
const rec = await import('../src/conceptSheetRecord');
const { describeAnswerKey, answerKeyProblem } = await import('../src/answerKeyCheck');
const { qrModules } = await import('../src/qrCode');
const express = (await import('express')).default;
const jwtLib = (await import('jsonwebtoken')).default;

const created: string[] = [];
const keep = (filePath: string) => { created.push(filePath); return filePath; };
const pagesOf = async (filePath: string) => (await PDFDocument.load(fs.readFileSync(filePath))).getPageCount();
const question = (i: number) => ({
  question: `Which group has more objects? Question ${i}.`, answer: 'left', answer_type: 'text',
  questionId: `S3.4_Q${i}`, conceptId: 'S3.4', templateId: 'tpl',
}) as any;

// ---- the QR text ---------------------------------------------------------------------------------
test('the QR text names the worksheet, the child and the page, and reads back', () => {
  const text = rec.conceptQrPayload('CW_ab12cd34', 's1', 2, 3);
  assert.equal(text, 'CW_ab12cd34|s1|2|3');
  assert.deepEqual(rec.parseConceptQrPayload(text), { worksheetId: 'CW_ab12cd34', studentId: 's1', page: 2, pages: 3 });
  // a scanner may hand back the text JSON-quoted
  assert.deepEqual(rec.parseConceptQrPayload(JSON.stringify(text)), { worksheetId: 'CW_ab12cd34', studentId: 's1', page: 2, pages: 3 });
  // ids with dots, dashes and underscores are real student ids
  assert.equal(rec.parseConceptQrPayload(rec.conceptQrPayload('CW_a1', 'ap_gnt-01.c2_007', 1, 1))?.studentId, 'ap_gnt-01.c2_007');
});

test('anything that is not one of our concept sheets is refused', () => {
  for (const bad of [null, undefined, 7, '', 'OBS_abc|1|2', 'CW_ab|s1|0|3', 'CW_ab|s1|4|3', 'CW_ab|s1|1', 'CW_ab|s 1|1|3', 'CW_ab|s1|x|3', 'CW_ab|s1|1|3|9', 'hello']) {
    assert.equal(rec.parseConceptQrPayload(bad as any), null, String(bad));
  }
});

// ---- the stored questions and records ---------------------------------------------------------------
test('every child gets the same questions under their own ids, the name the marking route looks for', () => {
  const resolved = [question(1), question(2)];
  const a = rec.questionsForStudent('s1', resolved, () => ({ levelNumber: 22, levelTitle: 'Comparison' }));
  const b = rec.questionsForStudent('s10', resolved, () => undefined);
  assert.deepEqual(a.map(q => q.question_id), ['s1_S3.4_Q1', 's1_S3.4_Q2']);
  assert.equal(a[0].source_level, 22);
  assert.equal(a[0].topic, 'Comparison');
  assert.equal(b[0].source_level, 0, 'a concept with no level is still stored');
  assert.equal(b[0].topic, 'S3.4');
  // the marking route takes a child's questions with startsWith(id + '_'): s1 must not pick up s10
  const all = [...a, ...b];
  assert.equal(all.filter(q => q.question_id.startsWith('s1_')).length, 2);
  assert.equal(all.filter(q => q.question_id.startsWith('s10_')).length, 2);
});

test('the worksheet record holds every child, the class, the cycle and a long submission window', () => {
  const now = new Date('2026-11-18T10:00:00Z');
  const students = [{ id: 's1', name: 'A' }, { id: 's2', name: 'B' }];
  const byStudent = new Map(students.map(s => [s.id, rec.questionsForStudent(s.id, [question(1), question(2)], () => undefined)]));
  const ws = rec.buildConceptWorksheetRecord({
    worksheetId: 'CW_ab12cd34', classObj: { id: 'c2', schoolId: 'gps-mt-001' }, className: 'Class 3', section: 'A',
    cycle: 'Baseline', user: { role: 'TEACHER' as any, email: 't@x.org' }, students, questionsByStudent: byStudent, now,
  });
  assert.equal(ws.id, 'CW_ab12cd34');
  assert.equal(ws.classId, 'c2');
  assert.equal(ws.schoolId, 'gps-mt-001');
  assert.equal(ws.cycle, 'Baseline');
  assert.deepEqual(ws.studentIds, ['s1', 's2']);
  assert.equal(ws.questions.length, 4);
  assert.equal(ws.date, '2026-11-18');
  assert.equal(ws.generatedByEmail, 't@x.org');
  const days = (Date.parse(ws.timing.submissionWindowEnd) - now.getTime()) / 86_400_000;
  assert.equal(days, rec.CONCEPT_SHEET_SUBMISSION_DAYS);
  assert.deepEqual(ws.delayLogs, { delayedAttemptsCount: 0, submittingTeachers: [] });
});

test('the answer key has one region per drawn answer box, in millimetres from the top left, and passes the existing key check', () => {
  const qs = rec.questionsForStudent('s1', [question(1), question(2), question(3)], () => undefined);
  const layout = {
    pagesPerCopy: 2, pageHeightPt: 841.89,
    boxes: [
      { questionId: 'S3.4_Q1', page: 1, xPt: 50, yBottomPt: 300, widthPt: 150, heightPt: 58 },
      { questionId: 'S3.4_Q2', page: 1, xPt: 50, yBottomPt: 200, widthPt: 150, heightPt: 58 },
      // question 3 has no drawn answer space (a choice question), so it has no box and no region
      { questionId: 'S9.9_Q1', page: 2, xPt: 50, yBottomPt: 200, widthPt: 150, heightPt: 58 }, // another student's question: ignored
    ],
  };
  const key = rec.buildConceptAnswerKey({ worksheetId: 'CW_ab12cd34', student: { id: 's1', name: 'A', classGroup: 'Class 3' }, questions: qs, layout, now: new Date('2026-11-18T10:00:00Z') });
  assert.equal(key.jobId, 'CW_ab12cd34');
  assert.equal(key.studentId, 's1');
  assert.equal(key.classNumber, 3);
  assert.equal(key.answerRegions!.length, 2);
  assert.deepEqual(key.answerRegions![0], { question_id: 's1_S3.4_Q1', page: 1, x_mm: 17.64, y_mm: 170.71, w_mm: 52.92, h_mm: 20.46 });
  assert.equal(key.answerKey.length, 3);
  assert.equal(answerKeyProblem(describeAnswerKey(key)), null, 'fewer regions than answers is the accepted case');
});

// ---- the printed copies ----------------------------------------------------------------------------
test('without children the sheet is the same one-copy sheet and reports no layout', async () => {
  const r = await renderConceptWorksheet({ worksheetId: 'T0', className: 'Balvatika', section: 'A', conceptIds: ['S3.4'], resolvedQuestions: Array.from({ length: 10 }, (_, i) => question(i + 1)) } as any);
  keep(r.filePath);
  assert.equal(await pagesOf(r.filePath), 3);
  assert.equal((r as any).layout, undefined);
});

test('whatever the answer boxes measure, no box on a per-child copy reaches down into the QR code', async () => {
  // Sweep the box height so that, for some value, a page is filled to the bottom: that is where the room kept for the QR code matters.
  const qs = Array.from({ length: 9 }, (_, i) => question(i + 1));
  const qrTop = 14 + rec.CONCEPT_SHEET_QR_SIZE_PT + 6;
  for (let h = 100; h <= 200; h += 4) {
    const r = await renderConceptWorksheet({
      worksheetId: 'T3', className: 'Class 3', section: 'A', conceptIds: ['S3.4'], resolvedQuestions: qs,
      layoutRules: { answerBoxHeightPt: h }, copies: [{ studentId: 's1', studentName: 'Asha' }],
    } as any);
    keep(r.filePath);
    for (const b of r.layout!.boxes) assert.ok(b.yBottomPt >= qrTop, `answer box height ${h}: box of ${b.questionId} ends at ${b.yBottomPt}, inside the QR pad (top ${qrTop})`);
  }
});

test('3 children get 3 copies of the same pages, each box is on its page and clear of the QR code', async () => {
  const qs = Array.from({ length: 10 }, (_, i) => question(i + 1));
  const base = await renderConceptWorksheet({ worksheetId: 'T1', className: 'Class 3', section: 'A', conceptIds: ['S3.4'], resolvedQuestions: qs } as any);
  keep(base.filePath);
  const r = await renderConceptWorksheet({
    worksheetId: 'T2', className: 'Class 3', section: 'A', conceptIds: ['S3.4'], resolvedQuestions: qs,
    copies: [{ studentId: 's1', studentName: 'Asha' }, { studentId: 's2', studentName: 'Bala' }, { studentId: 's3', studentName: 'Chitra' }],
  } as any);
  keep(r.filePath);
  const layout = r.layout!;
  assert.ok(layout.pagesPerCopy >= 3);
  assert.equal(await pagesOf(r.filePath), 3 * layout.pagesPerCopy);
  assert.equal(layout.boxes.length, 10, 'one box per question, recorded once, not once per copy');
  const qrTop = 14 + rec.CONCEPT_SHEET_QR_SIZE_PT + 6;
  for (const b of layout.boxes) {
    assert.ok(b.page >= 1 && b.page <= layout.pagesPerCopy);
    assert.ok(b.xPt >= 0 && b.xPt + b.widthPt <= 595.28, 'inside the page width');
    assert.ok(b.yBottomPt >= qrTop, `box of ${b.questionId} stays above the QR pad (${b.yBottomPt} >= ${qrTop})`);
    assert.ok(b.yBottomPt + b.heightPt <= layout.pageHeightPt);
  }
  // the QR code drawn is the one the text describes: its modules form a square matrix
  const modules = qrModules(rec.conceptQrPayload('T2', 's1', 1, layout.pagesPerCopy));
  assert.ok(modules.length >= 21 && modules.every(row => row.length === modules.length));
});

// ---- the route ---------------------------------------------------------------------------------------
const tpl = (id: string, conceptId: string, family: string) => ({
  id, conceptId, skills: ['SK03'], subskills: [], paramMode: 'structured',
  generationIntent: 'The child looks at the pictures and answers the question about them.',
  questionFamily: family, svgThemeIds: ['fruits'], assessmentMode: 'written', numeralRange: '1-10',
  tags: [], source: 'form', createdAt: '2026-10-12T00:00:00Z', deletedAt: null,
}) as any;

let baseUrl = '';
let server: any;
const token = (email: string) => `Bearer ${jwtLib.sign({ email }, JWT_SECRET, { expiresIn: '1h' })}`;
async function post(body: unknown, email: string | null = 'gps-mt-001.t01@fln.org') {
  const res = await fetch(`${baseUrl}/api/worksheets/generate-concept-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(email ? { Authorization: token(email) } : {}) },
    body: JSON.stringify(body),
  });
  let json: any = null; try { json = await res.json(); } catch { /* not json */ }
  if (json?.pdfUrl) {
    const paperGeneratorPath = fileURLToPath(new URL('../src/paperGenerator.ts', import.meta.url));
    keep(path.join(path.dirname(fs.realpathSync(paperGeneratorPath)), '..', json.pdfUrl.replace(/^\//, '')));
  }
  return { status: res.status, json };
}
const pdfPath = (pdfUrl: string) => {
  const paperGeneratorPath = fileURLToPath(new URL('../src/paperGenerator.ts', import.meta.url));
  return path.join(path.dirname(fs.realpathSync(paperGeneratorPath)), '..', pdfUrl.replace(/^\//, ''));
};
const good = { conceptIds: ['S3.4', 'S3.1'], questionsPerConcept: 3, className: 'Class 3', section: 'A' };
const perChild = { ...good, studentIds: ['s1', 's2', 's3'], classId: 'c2', cycle: 'Baseline' };

before(async () => {
  await dbStore.init();
  await dbStore.addQuestionTemplate(tpl('t_cmp', 'S3.4', 'comparison'));
  await dbStore.addQuestionTemplate(tpl('t_cnt', 'S3.1', 'counting'));
  const app = express(); app.use(express.json()); registerWorksheetRoutes(app);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', () => r()));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise<void>(r => server.close(() => r()));
  for (const f of created) { try { fs.unlinkSync(f); } catch { /* already gone */ } }
});

test('route: printing for 3 children saves one worksheet record and one answer key each', async () => {
  const before = (await dbStore.getWorksheets()).length;
  const r = await post(perChild);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.match(r.json.worksheetId, /^CW_[0-9a-f]{8}$/);
  assert.equal(r.json.questionCount, 6);
  assert.deepEqual(r.json.copies.map((c: any) => c.studentId), ['s1', 's2', 's3']);
  const pages = r.json.copies[0].pages;
  assert.equal(await pagesOf(pdfPath(r.json.pdfUrl)), 3 * pages, 'one copy per child, same pages each');

  const all = await dbStore.getWorksheets();
  assert.equal(all.length, before + 1);
  const ws = all.find(w => w.id === r.json.worksheetId)!;
  assert.equal(ws.classId, 'c2');
  assert.equal(ws.cycle, 'Baseline');
  assert.equal(ws.questions.length, 18, '6 questions for each of 3 children');
  for (const id of ['s1', 's2', 's3']) {
    // exactly what POST /api/evaluation/submit does to take a child's questions
    const mine = ws.questions.filter(q => q.question_id.startsWith(id + '_'));
    assert.equal(mine.length, 6, id);
    assert.ok(mine.every(q => q.answer !== undefined && q.answer !== ''), 'answers are stored');
  }
  const keys = await dbStore.getDiagnosticAnswerKeys(r.json.worksheetId);
  assert.deepEqual(keys.map(k => k.studentId).sort(), ['s1', 's2', 's3']);
  for (const k of keys) {
    assert.equal(k.questions.length, 6);
    assert.ok(k.answerRegions!.length > 0 && k.answerRegions!.length <= 6);
    assert.ok(k.answerRegions!.every(g => g.page >= 1 && g.page <= pages && g.w_mm > 0 && g.h_mm > 0));
    assert.equal(answerKeyProblem(describeAnswerKey(k)), null);
  }
});

test('route: a second print makes a new record and leaves the first one as it was', async () => {
  const a = await post(perChild); const b = await post(perChild);
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  assert.notEqual(a.json.worksheetId, b.json.worksheetId);
  const all = await dbStore.getWorksheets();
  const first = all.find(w => w.id === a.json.worksheetId)!;
  assert.equal(first.questions.length, 18);
  assert.equal((await dbStore.getDiagnosticAnswerKeys(a.json.worksheetId)).length, 3);
  assert.equal((await dbStore.getDiagnosticAnswerKeys(b.json.worksheetId)).length, 3);
});

test('route: without studentIds nothing is saved and the reply is as before', async () => {
  const worksheets = (await dbStore.getWorksheets()).length;
  const r = await post(good);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.worksheetId, undefined);
  assert.equal(r.json.copies, undefined);
  assert.equal((await dbStore.getWorksheets()).length, worksheets);
});

test('route: bad input is refused and saves nothing', async () => {
  const worksheets = (await dbStore.getWorksheets()).length;
  const cases: Array<[string, unknown, number]> = [
    ['no classId', { ...perChild, classId: undefined }, 400],
    ['no cycle', { ...perChild, cycle: undefined }, 400],
    ['a cycle that does not exist', { ...perChild, cycle: 'Weekly' }, 400],
    ['empty studentIds', { ...perChild, studentIds: [] }, 400],
    ['studentIds that is not a list', { ...perChild, studentIds: 's1' }, 400],
    ['a repeated student', { ...perChild, studentIds: ['s1', 's1'] }, 400],
    ['a blank id', { ...perChild, studentIds: ['s1', ' '] }, 400],
    ['more than the limit', { ...perChild, studentIds: Array.from({ length: rec.MAX_STUDENTS_PER_CONCEPT_BATCH + 1 }, (_, i) => `x${i}`) }, 400],
    ['a class that does not exist', { ...perChild, classId: 'nope' }, 404],
    ['a student that does not exist', { ...perChild, studentIds: ['s1', 'nope'] }, 404],
  ];
  for (const [label, body, status] of cases) {
    const r = await post(body);
    assert.equal(r.status, status, `${label}: ${JSON.stringify(r.json)}`);
  }
  assert.equal((await dbStore.getWorksheets()).length, worksheets, 'nothing was saved by any refused request');
});

test('route: a teacher cannot print for a child of another school, and a child must belong to the class\'s school', async () => {
  const worksheets = (await dbStore.getWorksheets()).length;
  const other = await post({ ...perChild, studentIds: ['s1', 's4'] });
  assert.equal(other.status, 403, JSON.stringify(other.json));
  assert.deepEqual(other.json.studentIds, ['s4']);
  // a superadmin may reach s4, but s4 is not in the school of class c2
  const mixed = await post({ ...perChild, studentIds: ['s1', 's4'] }, 'superadmin@fln.org');
  assert.equal(mixed.status, 400, JSON.stringify(mixed.json));
  assert.deepEqual(mixed.json.studentIds, ['s4']);
  assert.equal((await dbStore.getWorksheets()).length, worksheets);
});
