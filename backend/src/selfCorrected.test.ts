import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalCwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-selfcorrected-'));
fs.mkdirSync(path.join(scratch, 'data'));
process.chdir(scratch);
delete process.env.MONGODB_URI;

const { dbStore } = await import('./db');
import type { TeacherObservationRecord } from './db';

async function testSelfCorrectedField() {
  console.log('Running selfCorrected.test.ts...');
  await dbStore.init();

  const record: TeacherObservationRecord = {
    id: 'obs_test_619_1',
    studentId: 'student_619_1',
    conceptId: 'S3.11',
    teacherId: 'teacher_1',
    teacherEmail: 'teacher@test.com',
    schoolId: 'school_1',
    classId: 'class_1',
    cycle: 'Baseline',
    rating: 'Proficient',
    notYetAssessed: false,
    selfCorrected: true,
    observedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Test upserting
  await dbStore.upsertObservationRecord(record);

  // Test fetching for student
  const studentRecords = await dbStore.getObservationRecordsForStudent('student_619_1', 'Baseline');
  assert.strictEqual(studentRecords.length, 1);
  assert.strictEqual(studentRecords[0].selfCorrected, true, 'selfCorrected field round-trips as true');

  // Test updating selfCorrected to false
  const updatedRecord: TeacherObservationRecord = {
    ...record,
    selfCorrected: false
  };
  await dbStore.upsertObservationRecord(updatedRecord);

  const updatedStudentRecords = await dbStore.getObservationRecordsForStudent('student_619_1', 'Baseline');
  assert.strictEqual(updatedStudentRecords.length, 1);
  assert.strictEqual(updatedStudentRecords[0].selfCorrected, false, 'selfCorrected field updates to false');

  // Test class level fetching
  const classRecords = await dbStore.getObservationRecordsForClass('class_1', 'Baseline');
  assert.strictEqual(classRecords.length, 1);
  assert.strictEqual(classRecords[0].selfCorrected, false);

  console.log('selfCorrected.test.ts passed successfully!');
  process.chdir(originalCwd);
  fs.rmSync(scratch, { recursive: true, force: true });
}

testSelfCorrectedField().catch(err => {
  console.error(err);
  try {
    process.chdir(originalCwd);
    fs.rmSync(scratch, { recursive: true, force: true });
  } catch {}
  process.exit(1);
});
