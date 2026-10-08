/**
 * Attempt Record (Evidence Model, #479) — smoke test.
 *
 * Run:  cd backend && npm run test:attempts
 *
 * Saves one AttemptRecord, reads it back for its student, and confirms a
 * different student's read is unaffected. Exercises the real
 * addAttemptRecord/getAttemptRecordsForStudent methods against dbStore.
 *
 * dbStore's private save() is stubbed to a no-op for the duration of this
 * test (same monkey-patch-and-restore style tests/choice-error-tags.test.ts
 * already uses on other dbStore methods). Without this, running with no
 * MONGODB_URI set -- the local file-fallback mode every other `tsx --test`
 * test in this repo already runs under -- would write this test's record
 * into the real backend/data/db.json on every run.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const { dbStore } = await import('../src/db');

await dbStore.init();

const originalSave = (dbStore as any).save?.bind(dbStore);
(dbStore as any).save = async () => {};
after(() => {
  if (originalSave) (dbStore as any).save = originalSave;
});

const studentId = 'attempt-record-test-student';
const otherStudentId = 'attempt-record-test-other-student';

const record = {
  id: 'att_test_' + Date.now(),
  studentId,
  questionId: 'q-test',
  answer: '12',
  isCorrect: false,
  hintsUsed: 1,
  attemptsBeforeSuccess: 2,
  scaffoldingLevel: 2 as const,
  errorType: 'off_by_one' as const,
  recordedAt: new Date().toISOString(),
  recordedBy: 'teacher-test',
};

test('addAttemptRecord + getAttemptRecordsForStudent round-trips a saved record', async () => {
  const saved = await dbStore.addAttemptRecord(record);
  assert.equal(saved.id, record.id);

  const fetched = await dbStore.getAttemptRecordsForStudent(studentId);
  const found = fetched.find(a => a.id === record.id);
  assert.ok(found, 'saved record should be readable back for its student');
  assert.equal(found!.errorType, 'off_by_one');
  assert.equal(found!.scaffoldingLevel, 2);
});

test('a different student gets an empty list', async () => {
  const fetched = await dbStore.getAttemptRecordsForStudent(otherStudentId);
  assert.deepEqual(fetched, []);
});
