/**
 * POST /api/worksheets/generate when a student is on a level with no written
 * questions (#760, #359).
 *
 * Before: the generator printed "[Concept S3.11] Level 28 Practice Question #1"
 * for that student. Now it raises NoApprovedContentError, and the route turns
 * that into one clear 422 that names every affected student, writes nothing,
 * and does not touch the other students' papers.
 *
 * Hermetic: every database call is mocked. Run with:
 *   npm run test:worksheet-no-content --workspace @fln/backend
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { TestContext } from 'node:test';
import type { AddressInfo } from 'node:net';
import { randomBytes } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { registerWorksheetRoutes } = await import('../src/routes/worksheets');
const { dbStore, UserRole } = await import('../src/db');
const { JWT_SECRET } = await import('../src/auth');

const app = express();
app.use(express.json());
registerWorksheetRoutes(app);

const server = app.listen(0, '127.0.0.1');
let base: string;

before(async () => {
  if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve()))));

const HOUR = 60 * 60 * 1000;

function student(id: string, name: string, currentLevel: number): any {
  return { id, name, classGroup: 'Class 3', section: 'A', schoolId: 's1', currentLevel, currentSubLevel: 0 };
}

/** A written counting template, the kind a Balvatika level with content has. */
function countingTemplate(conceptId: string): any {
  return {
    id: `qtpl_${conceptId}`, conceptId, levelNumber: 19, levelName: 'Test level',
    skills: ['SK08'], subskills: ['SK08.01'], assessmentMode: 'written',
    generationIntent: 'Show a set of counted objects beside a blank box. The child writes the numeral matching the count of objects shown.',
    questionFamily: 'counting', paramMode: 'structured', svgThemeIds: [], stem: '', answerSpec: '',
    numeralRange: '0-20', digitCount: null, operations: [], maxOperandCount: null, carryBehavior: null,
    borrowBehavior: null, maxSumOrDifference: null, answerType: null, blankCount: null, questionCount: 1,
    subjectCategory: null, name: 'Test row', variantKey: `key_${conceptId}`, tags: [], source: 'form',
    createdBy: 'test', createdByEmail: 'test@fln.internal', createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z', updatedBy: 'test', updatedByEmail: 'test@fln.internal',
    deletedAt: null, deletedBy: null,
  };
}

/** Mocks everything the route reads, and records what it writes. */
function mockClass(t: TestContext, students: any[]) {
  const now = Date.now();
  const user = { id: 'teacher-1', email: 'teacher.generate@example.test', name: 'Test Teacher', role: UserRole.TEACHER };
  t.mock.method(dbStore, 'getUserSync', () => user);
  t.mock.method(dbStore, 'getClasses', async () => [{ id: 'c1', className: 'Class 3', section: 'A', schoolId: 's1' }]);
  t.mock.method(dbStore, 'getSchools', async () => [{ id: 's1', name: 'Test School', isAccessLocked: false }]);
  t.mock.method(dbStore, 'getGenerationWindows', async () => [{
    id: 'gw1', classId: 'c1', cycle: 'Baseline', closed: false,
    start: new Date(now - HOUR).toISOString(),
    teacherPriorityEnd: new Date(now + HOUR).toISOString(),
    end: new Date(now + 2 * HOUR).toISOString(),
  }]);
  t.mock.method(dbStore, 'getWorksheets', async () => []);
  t.mock.method(dbStore, 'getStudents', async () => students);
  t.mock.method(dbStore, 'getQuestionTemplatesByConcept', async (conceptId: string) =>
    conceptId === 'S3.1' ? [countingTemplate(conceptId)] : []);
  const addWorksheet = t.mock.method(dbStore, 'addWorksheet', async () => {});
  t.mock.method(dbStore, 'updateGenerationWindow', async () => {});
  t.mock.method(dbStore, 'addLog', async () => {});
  return { addWorksheet, token: jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '1m' }) };
}

async function generate(token: string) {
  const res = await fetch(`${base}/api/worksheets/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ classId: 'c1', cycle: 'Baseline' }),
  });
  return { status: res.status, body: await res.json() as any };
}

test('a student on level 28 (no written questions) gives one clear 422 and writes nothing', async t => {
  const { addWorksheet, token } = mockClass(t, [student('st1', 'Asha', 19), student('st2', 'Ravi', 28), student('st3', 'Meena', 28)]);
  const { status, body } = await generate(token);
  assert.equal(status, 422);
  assert.match(body.error, /No worksheet was generated/);
  assert.match(body.error, /Ravi \(Level 28/);
  assert.match(body.error, /Meena \(Level 28/);
  assert.doesNotMatch(body.error, /Asha/, 'a student with content is not blamed');
  assert.deepEqual(body.studentsWithoutContent.map((s: any) => [s.studentName, s.level, s.conceptId]), [
    ['Ravi', 28, 'S3.11'],
    ['Meena', 28, 'S3.11'],
  ]);
  assert.equal(addWorksheet.mock.callCount(), 0, 'nothing is saved when any student has no content');
});

test('a class where every student has content still generates, with 5 questions for a Balvatika level', async t => {
  const { addWorksheet, token } = mockClass(t, [student('st1', 'Asha', 19)]);
  const { status, body } = await generate(token);
  assert.equal(status, 200);
  assert.equal(addWorksheet.mock.callCount(), 1);
  assert.equal(body.questions.length, 5);
  for (const q of body.questions) assert.doesNotMatch(q.question, /Practice Question #|\[Concept /);
});
