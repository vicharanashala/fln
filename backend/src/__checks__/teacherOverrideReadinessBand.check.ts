import assert from 'node:assert';
import { dbStore, Student, StudentReadinessRecord } from '../db';
import { computeClass1ReadinessBand } from '../services/readinessBand';

async function runCheck() {
  console.log('--- Running Check: Teacher Confirm/Override Readiness Band (#623) ---');
  await dbStore.init();

  const student: Student = {
    id: 'stud_balv_623_chk',
    name: 'Balvatika Override Child',
    schoolId: 'gps-mt-001',
    classGroup: 'Balvatika',
    section: 'A',
    gender: 'Female',
    age: 5,
    currentLevel: 19,
    targetLevel: 20,
    levelHistory: [],
    aadharMasked: 'XXXX-XXXX-1111'
  };
  (dbStore as any).data.students.push(student);

  // Initial computed band should be Incomplete (0 evidence)
  const computed = await computeClass1ReadinessBand('stud_balv_623_chk');
  assert.strictEqual(computed?.band, 'Incomplete');

  // 1. Save confirmed record (without override)
  const confirmedRecord: StudentReadinessRecord = {
    id: 'rec_623_1',
    studentId: 'stud_balv_623_chk',
    computedBand: computed!.band,
    finalBand: computed!.band,
    isOverridden: false,
    confirmedByTeacherId: 'tch_01',
    confirmedAt: new Date().toISOString()
  };
  await dbStore.saveReadinessRecord(confirmedRecord);

  const saved1 = await dbStore.getReadinessRecordForStudent('stud_balv_623_chk');
  assert.strictEqual(saved1?.finalBand, 'Incomplete');
  assert.strictEqual(saved1?.isOverridden, false);

  // 2. Save override record (teacher overrides to 'Almost ready')
  const overrideRecord: StudentReadinessRecord = {
    id: 'rec_623_2',
    studentId: 'stud_balv_623_chk',
    computedBand: computed!.band,
    finalBand: 'Almost ready',
    isOverridden: true,
    overrideReason: 'Demonstrated mastery in oral counting during class activity',
    confirmedByTeacherId: 'tch_01',
    confirmedAt: new Date().toISOString()
  };
  await dbStore.saveReadinessRecord(overrideRecord);

  const saved2 = await dbStore.getReadinessRecordForStudent('stud_balv_623_chk');
  assert.strictEqual(saved2?.finalBand, 'Almost ready');
  assert.strictEqual(saved2?.isOverridden, true);
  assert.strictEqual(saved2?.overrideReason, 'Demonstrated mastery in oral counting during class activity');

  console.log('✓ All checks passed for #623 Teacher Confirm/Override Readiness Band!');
}

runCheck().catch(err => {
  console.error('Check failed:', err);
  process.exit(1);
});
