/**
 * POST /api/observations/sheet (#618): who may print it, what it validates, which
 * concepts end up on it, and that it writes nothing.
 *
 * Hermetic: every database call is mocked. Run with:
 *   npm run test:observation-sheet-route --workspace @fln/backend
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import type { TestContext } from 'node:test';
import type { AddressInfo } from 'node:net';
import { randomBytes } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { PDFDocument } from 'pdf-lib';

process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { registerObservationRoutes } = await import('../src/routes/observations');
const { dbStore, UserRole } = await import('../src/db');
const { JWT_SECRET } = await import('../src/auth');

const OUTPUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'output');
const app = express();
app.use(express.json());
registerObservationRoutes(app);
const server = app.listen(0, '127.0.0.1');
let base: string;
const made: string[] = [];

before(async () => {
  if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
  for (const f of made) fs.rmSync(path.join(OUTPUT_DIR, f), { force: true });
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
});

const classGroup = { id: 'c1', schoolId: 's1', className: 'Balvatika', section: 'A', teacherId: 't1' };
const child = (n: number, over: Record<string, unknown> = {}) =>
  ({ id: `st${n}`, name: `Child ${n}`, schoolId: 's1', classGroup: 'Balvatika', section: 'A', ...over });
const template = (conceptId: string, assessmentMode: string) => ({ id: `tpl_${conceptId}_${assessmentMode}`, conceptId, assessmentMode, deletedAt: null });

/** S3.12 observed, S3.14 both, S3.1 written only: only the first two belong on an observation sheet. */
function setup(t: TestContext, over: { user?: any; classes?: any[]; students?: any[]; templates?: any[] } = {}) {
  const user = over.user ?? { id: 't1', email: 'teacher.sheet@example.test', name: 'Teacher', role: UserRole.TEACHER, schoolId: 's1' };
  t.mock.method(dbStore, 'getUserSync', () => user);
  t.mock.method(dbStore, 'getClasses', async () => over.classes ?? [classGroup]);
  t.mock.method(dbStore, 'getStudents', async () => over.students ?? [child(1), child(2), child(3)]);
  t.mock.method(dbStore, 'getQuestionTemplates', async () => over.templates ?? [
    template('S3.12', 'observed'), template('S3.14', 'both'), template('S3.1', 'written'),
  ]);
  const upsert = t.mock.method(dbStore, 'upsertObservationRecord', async (r: any) => r);
  return { upsert, token: jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '1m' }) };
}

async function post(token: string | null, body: unknown) {
  const res = await fetch(`${base}/api/observations/sheet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() as any };
}
const ok = { classId: 'c1', cycle: 'Baseline', layout: 'class-grid' };

test('401 without a login', async t => {
  setup(t);
  assert.equal((await post(null, ok)).status, 401);
});

test('400 for a missing class, a bad cycle, a bad layout, or a bad concept list', async t => {
  const { token } = setup(t);
  assert.equal((await post(token, { ...ok, classId: '' })).status, 400);
  assert.equal((await post(token, { ...ok, cycle: 'Someday' })).status, 400);
  assert.equal((await post(token, { ...ok, layout: 'poster' })).status, 400);
  assert.equal((await post(token, { ...ok, conceptIds: [] })).status, 400);
  assert.equal((await post(token, { ...ok, conceptIds: 'S3.12' })).status, 400);
  const unknown = await post(token, { ...ok, conceptIds: ['S9.99'] });
  assert.equal(unknown.status, 400);
  assert.match(unknown.body.error, /Unknown conceptId: S9\.99/);
});

test('404 for a class that does not exist; 403 for a teacher of another school who is not the class teacher', async t => {
  const { token } = setup(t);
  assert.equal((await post(token, { ...ok, classId: 'nope' })).status, 404);

  const outsider = setup(t, { user: { id: 'other', email: 'outsider@example.test', name: 'Other', role: UserRole.TEACHER, schoolId: 'other-school' } });
  assert.equal((await post(outsider.token, ok)).status, 403);
});

test('400 when the class has no children', async t => {
  const { token } = setup(t, { students: [child(1, { section: 'B' })] });
  const res = await post(token, ok);
  assert.equal(res.status, 400);
  assert.match(res.body.error, /No students/);
});

test('a concept a teacher does not observe, or one with no template, cannot be put on the sheet', async t => {
  const { token } = setup(t);
  const writtenOnly = await post(token, { ...ok, conceptIds: ['S3.1'] });
  assert.equal(writtenOnly.status, 400);
  assert.match(writtenOnly.body.error, /S3\.1 is not observed/);
  assert.equal((await post(token, { ...ok, conceptIds: ['S3.12', 'S3.2'] })).status, 400, 'S3.2 has no template here');

  const none = setup(t, { templates: [template('S3.1', 'written')] });
  assert.equal((await post(none.token, ok)).status, 404, 'nothing observed means nothing to print');
});

test('by default the sheet covers every observed or both concept, in level order, and writes nothing', async t => {
  const { token, upsert } = setup(t);
  const res = await post(token, ok);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.concepts, [{ conceptId: 'S3.12', level: 29 }, { conceptId: 'S3.14', level: 31 }]);
  assert.equal(res.body.studentCount, 3);
  assert.equal(res.body.layout, 'class-grid');
  assert.equal(upsert.mock.callCount(), 0, 'printing a sheet saves no observation');

  const file = res.body.pdfUrl.replace('/output/', '');
  made.push(file);
  const pdf = await PDFDocument.load(fs.readFileSync(path.join(OUTPUT_DIR, file)));
  assert.equal(pdf.getPageCount(), res.body.pageCount);
});

test('chosen concepts, the per-child layout, and only this class\'s children are used', async t => {
  const { token } = setup(t, { students: [child(1), child(2), child(3), child(4, { section: 'B' }), child(5, { classGroup: 'Class 1' })] });
  const res = await post(token, { classId: 'c1', cycle: 'Mid-year', layout: 'per-child', conceptIds: ['S3.14'] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.concepts, [{ conceptId: 'S3.14', level: 31 }]);
  assert.equal(res.body.studentCount, 3, 'other sections and classes are left off');
  assert.equal(res.body.pageCount, 2, 'three children, two half pages to a sheet');
  made.push(res.body.pdfUrl.replace('/output/', ''));
});

test('the class teacher, a school user and a wide-access admin may all print it', async t => {
  for (const user of [
    { id: 't1', email: 'classteacher@example.test', name: 'T', role: UserRole.TEACHER, schoolId: 'elsewhere' },
    { id: 'p9', email: 'principal@example.test', name: 'P', role: UserRole.SCHOOL, schoolId: 's1' },
    { id: 'sa', email: 'super@example.test', name: 'S', role: UserRole.SUPERADMIN },
  ]) {
    const { token } = setup(t, { user });
    const res = await post(token, ok);
    assert.equal(res.status, 200, `${user.email}: ${JSON.stringify(res.body)}`);
    made.push(res.body.pdfUrl.replace('/output/', ''));
  }
});
