/**
 * The observation sheet printed together with the concept worksheet (#618).
 *
 * POST /api/worksheets/generate-concept-batch takes an optional `observationSheet`
 * ({ classId, cycle, layouts? }). The worksheet is always returned; the sheet comes back in
 * `observationSheet`, either with its PDF links or with the reason it was not printed.
 *
 * Run with:
 *   npm run test:observation-sheet-with-worksheet --workspace @fln/backend
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import { PDFDocument } from 'pdf-lib';

// Isolate the database from the real repository data.
const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-sheet-with-worksheet-test-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);
delete process.env.MONGODB_URI;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'dev-insecure-secret-change-me';

const { dbStore, UserRole } = await import('../src/db');
const { JWT_SECRET } = await import('../src/auth');
const { registerWorksheetRoutes } = await import('../src/routes/worksheets');
const { buildObservationSheets, buildSheetsForWorksheet, parseWorksheetSheetRequest } = await import('../src/services/observationSheetBuilder');
const express = (await import('express')).default;
const jwtLib = (await import('jsonwebtoken')).default;

const OUTPUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'output');
const created: string[] = [];
const fileOf = (pdfUrl: string) => path.join(OUTPUT_DIR, path.basename(pdfUrl));
const keep = (pdfUrl: string) => { created.push(fileOf(pdfUrl)); return fileOf(pdfUrl); };
const pagesOf = async (pdfUrl: string) => (await PDFDocument.load(fs.readFileSync(fileOf(pdfUrl)))).getPageCount();

const tpl = (id: string, conceptId: string, family: string, over: Record<string, unknown> = {}) => ({
  id, conceptId, skills: ['SK03'], subskills: [], paramMode: 'structured',
  generationIntent: 'The child looks at the pictures and answers the question about them.',
  questionFamily: family, svgThemeIds: ['fruits'], assessmentMode: 'written', numeralRange: '1-10',
  tags: [], source: 'form', createdAt: '2026-10-12T00:00:00Z', deletedAt: null, ...over,
}) as any;

const TEACHER_EMAIL = 'gps-mt-001.t01@fln.org';
let teacher: any;
let base = '';
let server: any;
const token = `Bearer ${jwtLib.sign({ email: TEACHER_EMAIL }, JWT_SECRET, { expiresIn: '1h' })}`;

async function post(body: unknown) {
  const res = await fetch(`${base}/api/worksheets/generate-concept-batch`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token }, body: JSON.stringify(body),
  });
  let json: any = null; try { json = await res.json(); } catch { /* not json */ }
  if (json?.pdfUrl) keep(json.pdfUrl);
  for (const s of json?.observationSheet?.sheets ?? []) keep(s.pdfUrl);
  return { status: res.status, json };
}

const child = (n: number, over: Record<string, unknown> = {}) =>
  ({ id: `st${n}`, name: `Child ${String(n).padStart(3, '0')}`, schoolId: teacher.schoolId, classGroup: 'Balvatika', section: 'A', ...over }) as any;
const roster = (n: number) => Array.from({ length: n }, (_, i) => child(i + 1));
const myClass = () => ({ id: 'cls1', schoolId: teacher.schoolId, className: 'Balvatika', section: 'A', teacherId: teacher.id });

/** Replaces the class and roster the sheet reads. The worksheet content still comes from the real scratch database. */
function setClass(t: any, over: { classes?: any[]; students?: any[] } = {}) {
  t.mock.method(dbStore, 'getClasses', async () => over.classes ?? [myClass()]);
  t.mock.method(dbStore, 'getStudents', async () => over.students ?? roster(3));
}

// S3.4 and S3.1 are written, S3.7 is observed, S3.12 is both.
const mixed = { conceptIds: ['S3.4', 'S3.7'], questionsPerConcept: 3, className: 'Balvatika', section: 'A' };
const sheetFor = (over: Record<string, unknown> = {}) => ({ classId: 'cls1', cycle: 'Baseline', ...over });

before(async () => {
  await dbStore.init();
  await dbStore.addQuestionTemplate(tpl('t_w1', 'S3.4', 'comparison'));
  await dbStore.addQuestionTemplate(tpl('t_w2', 'S3.1', 'counting'));
  await dbStore.addQuestionTemplate(tpl('t_o1', 'S3.7', 'comparison', { assessmentMode: 'observed' }));
  await dbStore.addQuestionTemplate(tpl('t_b1', 'S3.12', 'comparison', { assessmentMode: 'both' }));
  teacher = dbStore.getUserSync(TEACHER_EMAIL);
  assert.ok(teacher, 'the seeded teacher exists');
  const app = express(); app.use(express.json()); registerWorksheetRoutes(app);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', () => r()));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise<void>(r => server.close(() => r()));
  for (const f of created) { try { fs.unlinkSync(f); } catch { /* already gone */ } }
});

test('the worksheet request with no observationSheet is unchanged: no sheet field, no sheet file', async () => {
  const r = await post(mixed);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.ok(r.json.pdfUrl);
  assert.equal('observationSheet' in r.json, false);
});

test('worksheet + sheet: both layouts are printed for the observed concepts only', async t => {
  setClass(t, { students: roster(3) });
  const r = await post({ ...mixed, observationSheet: sheetFor() });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.ok(r.json.pdfUrl, 'the worksheet itself is there');
  const o = r.json.observationSheet;
  assert.equal(o.success, true, JSON.stringify(o));
  assert.deepEqual(o.sheets.map((s: any) => s.layout), ['class-grid', 'per-child']);
  assert.equal(o.studentCount, 3);
  assert.deepEqual(o.concepts.map((c: any) => c.conceptId), ['S3.7'], 'S3.4 is written, so it is not a sheet row');
  for (const s of o.sheets) assert.equal(await pagesOf(s.pdfUrl), s.pageCount, `${s.layout} page count`);
  assert.notEqual(o.sheets[0].pdfUrl, o.sheets[1].pdfUrl);
  assert.notEqual(o.sheets[0].pdfUrl, r.json.pdfUrl);
});

test('a "both" concept is observed too, and a repeated concept id is printed once', async t => {
  setClass(t);
  const r = await post({ ...mixed, conceptIds: ['S3.12', 'S3.12', 'S3.4'], observationSheet: sheetFor() });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(r.json.observationSheet.concepts.map((c: any) => c.conceptId), ['S3.12']);
});

test('the teacher can ask for one layout', async t => {
  setClass(t);
  const r = await post({ ...mixed, observationSheet: sheetFor({ layouts: ['per-child'] }) });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(r.json.observationSheet.sheets.map((s: any) => s.layout), ['per-child']);
  const twice = await post({ ...mixed, observationSheet: sheetFor({ layouts: ['class-grid', 'class-grid'] }) });
  assert.deepEqual(twice.json.observationSheet.sheets.map((s: any) => s.layout), ['class-grid'], 'a layout named twice is printed once');
});

test('a class of one child and a class of 120 both print; 121 is refused with the reason, and the worksheet still comes back', async t => {
  setClass(t, { students: roster(1) });
  const one = await post({ ...mixed, observationSheet: sheetFor() });
  assert.equal(one.json.observationSheet.success, true);
  assert.equal(one.json.observationSheet.studentCount, 1);

  setClass(t, { students: roster(120) });
  const full = await post({ ...mixed, observationSheet: sheetFor() });
  assert.equal(full.json.observationSheet.success, true, JSON.stringify(full.json.observationSheet));
  assert.equal(full.json.observationSheet.studentCount, 120);
  for (const s of full.json.observationSheet.sheets) assert.ok(s.pageCount >= 1);

  setClass(t, { students: roster(121) });
  const over = await post({ ...mixed, observationSheet: sheetFor() });
  assert.equal(over.status, 200);
  assert.ok(over.json.pdfUrl, 'the worksheet is not lost');
  assert.equal(over.json.observationSheet.success, false);
  assert.match(over.json.observationSheet.error, /at most 120 children; this class has 121/);
});

test('children from another section, class or school are not on the sheet', async t => {
  const students = [
    child(3), child(1), child(2),
    child(4, { section: 'B' }), child(5, { classGroup: 'Class 1' }), child(6, { schoolId: 'another-school' }),
  ];
  setClass(t, { students });
  const r = await post({ ...mixed, observationSheet: sheetFor({ layouts: ['class-grid'] }) });
  assert.equal(r.json.observationSheet.studentCount, 3);
  assert.equal(await pagesOf(r.json.observationSheet.sheets[0].pdfUrl), 1, 'three children fit one grid page');
});

test('nothing observed among the chosen concepts: the worksheet comes back and the sheet says why it was not printed', async t => {
  setClass(t);
  const r = await post({ conceptIds: ['S3.4', 'S3.1'], questionsPerConcept: 2, className: 'Balvatika', section: 'A', observationSheet: sheetFor() });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.ok(r.json.pdfUrl);
  assert.equal(r.json.observationSheet.success, false);
  assert.match(r.json.observationSheet.error, /nothing to put on the sheet/);
  assert.equal('sheets' in r.json.observationSheet, false);
});

test('an unknown class, an empty roster and a class at another school each give a reason and keep the worksheet', async t => {
  setClass(t);
  const unknown = await post({ ...mixed, observationSheet: sheetFor({ classId: 'nope' }) });
  assert.equal(unknown.status, 200);
  assert.ok(unknown.json.pdfUrl);
  assert.deepEqual([unknown.json.observationSheet.success, unknown.json.observationSheet.error], [false, 'Class not found.']);

  setClass(t, { students: [] });
  const empty = await post({ ...mixed, observationSheet: sheetFor() });
  assert.equal(empty.json.observationSheet.error, 'No students found in this class roster.');

  setClass(t, { classes: [{ ...myClass(), schoolId: 'another-school', teacherId: 'someone-else' }], students: roster(2) });
  const other = await post({ ...mixed, observationSheet: sheetFor() });
  assert.ok(other.json.pdfUrl, 'the worksheet is still made');
  assert.deepEqual([other.json.observationSheet.success, other.json.observationSheet.error], [false, 'Forbidden.']);
});

test('a bad observationSheet request is refused before anything is printed', async t => {
  setClass(t);
  const before = fs.existsSync(OUTPUT_DIR) ? fs.readdirSync(OUTPUT_DIR).length : 0;
  const bad: unknown[] = [
    'yes', 5, [], { cycle: 'Baseline' }, { classId: '', cycle: 'Baseline' }, { classId: 123, cycle: 'Baseline' },
    { classId: 'cls1' }, { classId: 'cls1', cycle: 'Someday' }, { classId: 'cls1', cycle: 42 },
    { classId: 'cls1', cycle: 'Baseline', layouts: [] }, { classId: 'cls1', cycle: 'Baseline', layouts: 'per-child' },
    { classId: 'cls1', cycle: 'Baseline', layouts: ['poster'] }, { classId: 'x'.repeat(101), cycle: 'Baseline' },
  ];
  for (const observationSheet of bad) {
    const r = await post({ ...mixed, observationSheet });
    assert.equal(r.status, 400, `${JSON.stringify(observationSheet)} -> ${JSON.stringify(r.json)}`);
    assert.ok(r.json.error);
    assert.equal(r.json.pdfUrl, undefined);
  }
  const after = fs.existsSync(OUTPUT_DIR) ? fs.readdirSync(OUTPUT_DIR).length : 0;
  assert.equal(after, before, 'a refused request leaves no file behind');
});

test('observationSheet: null is treated as no sheet', async () => {
  const r = await post({ ...mixed, observationSheet: null });
  assert.equal(r.status, 200);
  assert.equal('observationSheet' in r.json, false);
});

test('a worksheet request that fails for its own reasons still fails the same way with a sheet requested', async t => {
  setClass(t);
  const noClass = await post({ conceptIds: ['S3.4'], questionsPerConcept: 3, observationSheet: sheetFor() });
  assert.equal(noClass.status, 400);
  const noContent = await post({ conceptIds: ['S3.99'], questionsPerConcept: 3, className: 'Balvatika', section: 'A', observationSheet: sheetFor() });
  assert.notEqual(noContent.status, 200);
  assert.equal(noContent.json.observationSheet, undefined, 'no sheet is printed for a worksheet that was not made');
});

// ---- the builder on its own ------------------------------------------------------------------
test('parseWorksheetSheetRequest: absent means no sheet, and a valid request defaults to both layouts and trims the class id', () => {
  assert.equal(parseWorksheetSheetRequest(undefined), undefined);
  assert.equal(parseWorksheetSheetRequest(null), undefined);
  assert.deepEqual(parseWorksheetSheetRequest({ classId: '  cls1 ', cycle: 'Baseline' }), { classId: 'cls1', cycle: 'Baseline', layouts: ['class-grid', 'per-child'] });
});

test('a suspended teacher gets no sheet, and nothing is read', async t => {
  const getClasses = t.mock.method(dbStore, 'getClasses', async () => [myClass()]);
  const user = { id: 'x', email: 'x@example.test', name: 'X', role: UserRole.TEACHER, isBanned: true } as any;
  const built = await buildObservationSheets(user, { classId: 'cls1', cycle: 'Baseline', layouts: ['class-grid'], requested: ['S3.7'], strict: false });
  assert.deepEqual(built, { ok: false, status: 403, error: 'Account suspended.' });
  assert.equal(getClasses.mock.callCount(), 0);
});

test('buildSheetsForWorksheet never throws: a database failure becomes a reason', async t => {
  t.mock.method(dbStore, 'getClasses', async () => { throw new Error('database down'); });
  const out = await buildSheetsForWorksheet({ id: 'x', role: UserRole.SUPERADMIN } as any, { classId: 'cls1', cycle: 'Baseline', layouts: ['per-child'] }, ['S3.7']);
  assert.deepEqual(out, { success: false, error: 'Could not create the observation sheet.' });
});

test('strict mode (the sheet route) still refuses a concept that is not observed; non-strict leaves it off', async t => {
  setClass(t);
  const user = { id: teacher.id, email: TEACHER_EMAIL, name: 'T', role: UserRole.TEACHER, schoolId: teacher.schoolId } as any;
  const strict = await buildObservationSheets(user, { classId: 'cls1', cycle: 'Baseline', layouts: ['class-grid'], requested: ['S3.4', 'S3.7'], strict: true });
  assert.equal(strict.ok, false);
  assert.match((strict as any).error, /S3\.4 is not observed by a teacher/);
  const loose = await buildObservationSheets(user, { classId: 'cls1', cycle: 'Baseline', layouts: ['class-grid'], requested: ['S3.4', 'S3.7'], strict: false });
  assert.equal(loose.ok, true);
  for (const s of (loose as any).sheets) keep(s.pdfUrl);
  assert.deepEqual((loose as any).concepts.map((c: any) => c.conceptId), ['S3.7']);
});

test('a concept the curriculum does not know is left off instead of crashing the sheet', async t => {
  setClass(t);
  await dbStore.addQuestionTemplate(tpl('t_ghost', 'ZZ9.9', 'comparison', { assessmentMode: 'observed' }));
  const user = { id: teacher.id, email: TEACHER_EMAIL, name: 'T', role: UserRole.TEACHER, schoolId: teacher.schoolId } as any;
  const built = await buildObservationSheets(user, { classId: 'cls1', cycle: 'Baseline', layouts: ['per-child'], requested: ['ZZ9.9', 'S3.7'], strict: false });
  assert.equal(built.ok, true);
  for (const s of (built as any).sheets) keep(s.pdfUrl);
  assert.deepEqual((built as any).concepts.map((c: any) => c.conceptId), ['S3.7']);
});
