import assert from 'node:assert';
import { dbStore, TeacherObservationRecord } from './db';

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
}

testStrategyUsedField().catch(err => {
  console.error(err);
  process.exit(1);
});
