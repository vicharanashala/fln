import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalCwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-strategyused-'));
fs.mkdirSync(path.join(scratch, 'data'));
process.chdir(scratch);
delete process.env.MONGODB_URI;

const { dbStore } = await import('./db');
import type { TeacherObservationRecord } from './db';

async function testStrategyUsedField() {
  console.log('Running strategyUsed.test.ts...');
  await dbStore.init();

  const record: TeacherObservationRecord = {
    id: 'obs_test_620_1',
    studentId: 'student_620_1',
    conceptId: 'S3.12',
    teacherId: 'teacher_1',
    teacherEmail: 'teacher@test.com',
    schoolId: 'school_1',
    classId: 'class_1',
    cycle: 'Baseline',
    rating: 'Proficient',
    notYetAssessed: false,
    strategyUsed: 'counters',
    observedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Test upserting
  await dbStore.upsertObservationRecord(record);

  // Test fetching for student
  const studentRecords = await dbStore.getObservationRecordsForStudent('student_620_1', 'Baseline');
  assert.strictEqual(studentRecords.length, 1);
  assert.strictEqual(studentRecords[0].strategyUsed, 'counters', 'strategyUsed field round-trips as counters');

  // Test updating strategyUsed to mental
  const updatedRecord: TeacherObservationRecord = {
    ...record,
    strategyUsed: 'mental'
  };
  await dbStore.upsertObservationRecord(updatedRecord);

  const updatedStudentRecords = await dbStore.getObservationRecordsForStudent('student_620_1', 'Baseline');
  assert.strictEqual(updatedStudentRecords.length, 1);
  assert.strictEqual(updatedStudentRecords[0].strategyUsed, 'mental', 'strategyUsed field updates to mental');

  // Test class level fetching
  const classRecords = await dbStore.getObservationRecordsForClass('class_1', 'Baseline');
  assert.strictEqual(classRecords.length, 1);
  assert.strictEqual(classRecords[0].strategyUsed, 'mental');

  console.log('strategyUsed.test.ts passed successfully!');
  process.chdir(originalCwd);
  fs.rmSync(scratch, { recursive: true, force: true });
}

testStrategyUsedField().catch(err => {
  console.error(err);
  try {
    process.chdir(originalCwd);
    fs.rmSync(scratch, { recursive: true, force: true });
  } catch {}
  process.exit(1);
});
