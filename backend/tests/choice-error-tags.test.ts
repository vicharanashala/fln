import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'choice-error-tags-test-secret';

const { dbStore, UserRole } = await import('../src/db');
const { JWT_SECRET } = await import('../src/auth');
const { registerWorksheetRoutes } = await import('../src/routes/worksheets');
const express = (await import('express')).default;
const jwt = (await import('jsonwebtoken')).default;

const questionWithTags = {
  question_id: 'q-choice-tags',
  question: 'Choose the correct number',
  answer: '12',
  answer_type: 'choice' as const,
  choices: ['11', '12'],
  choiceErrorTags: { '11': 'counting-error' },
  topic: 'Number Sense',
  subtopic: 'Counting',
  difficulty: 'easy' as const,
  source_level: 1,
};

const legacyQuestion = {
  question_id: 'q-legacy',
  question: 'Choose the matching letter',
  answer: 'A',
  answer_type: 'choice' as const,
  choices: ['A', 'B'],
  topic: 'Literacy',
  subtopic: 'Letters',
  difficulty: 'easy' as const,
  source_level: 1,
};

const worksheet = {
  id: 'WS_CHOICE_ERROR_TAGS_TEST',
  classId: 'class-test',
  className: 'Class 1',
  section: 'A',
  schoolId: 'school-test',
  generatedByRole: UserRole.SUPERADMIN,
  generatedByEmail: 'superadmin@fln.org',
  cycle: 'Baseline',
  date: '2026-10-01',
  questions: [questionWithTags, legacyQuestion],
};

const originalGetUserSync = dbStore.getUserSync.bind(dbStore);
const originalGetWorksheets = dbStore.getWorksheets.bind(dbStore);
dbStore.getUserSync = (email: string) => email === 'superadmin@fln.org'
  ? { email, role: UserRole.SUPERADMIN } as any
  : null;
dbStore.getWorksheets = async () => [worksheet] as any;

const app = express();
registerWorksheetRoutes(app);
const server: http.Server = await new Promise(resolve => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});
const address = server.address() as import('net').AddressInfo;
const url = `http://127.0.0.1:${address.port}/api/worksheets`;
const token = jwt.sign({ email: 'superadmin@fln.org' }, JWT_SECRET, { expiresIn: '1h' });

after(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  (server as any).closeAllConnections?.();
  dbStore.getUserSync = originalGetUserSync;
  dbStore.getWorksheets = originalGetWorksheets;
});

test('GET /api/worksheets preserves choiceErrorTags and legacy questions', async () => {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(response.status, 200);

  const body = await response.json() as typeof worksheet[];
  assert.deepEqual(body[0].questions[0], questionWithTags);
  assert.deepEqual(body[0].questions[0].choices, ['11', '12']);
  assert.deepEqual(body[0].questions[1].choices, ['A', 'B']);
  assert.equal((body[0].questions[1] as any).choiceErrorTags, undefined);
});
