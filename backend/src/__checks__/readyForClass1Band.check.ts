import assert from 'node:assert';
import { dbStore, Student, EvaluationReport } from '../db';
import { computeClass1ReadinessBand, calculateReadinessBandFromRatings } from '../services/readinessBand';

async function runCheck() {
  console.log('--- Running Check: Ready for Class 1 Readiness Band (#622) ---');
  await dbStore.init();

  // Test unit function directly
  const allProficient = calculateReadinessBandFromRatings({
    'S3.1': { rating: 'Proficient', ruleVersion: 'v1', evidenceCount: 3 },
    'S3.2': { rating: 'Proficient', ruleVersion: 'v1', evidenceCount: 3 },
    'S3.3': { rating: 'Proficient', ruleVersion: 'v1', evidenceCount: 3 },
    'S3.4': { rating: 'Proficient', ruleVersion: 'v1', evidenceCount: 3 },
    'S3.5': { rating: 'Proficient', ruleVersion: 'v1', evidenceCount: 3 },
    'S3.6': { rating: 'Proficient', ruleVersion: 'v1', evidenceCount: 3 },
    'S3.7': { rating: 'Proficient', ruleVersion: 'v1', evidenceCount: 3 },
  });
  assert.strictEqual(allProficient.band, 'Ready for Class 1');
  assert.strictEqual(allProficient.percentOnTrack, 100);

  const hasBeginner = calculateReadinessBandFromRatings({
    'S3.1': { rating: 'Proficient', ruleVersion: 'v1', evidenceCount: 3 },
    'S3.2': { rating: 'Beginner', ruleVersion: 'v1', evidenceCount: 3 },
    'S3.3': { rating: 'Proficient', ruleVersion: 'v1', evidenceCount: 3 },
    'S3.4': { rating: 'Proficient', ruleVersion: 'v1', evidenceCount: 3 },
    'S3.5': { rating: 'Proficient', ruleVersion: 'v1', evidenceCount: 3 },
    'S3.6': { rating: 'Proficient', ruleVersion: 'v1', evidenceCount: 3 },
    'S3.7': { rating: 'Proficient', ruleVersion: 'v1', evidenceCount: 3 },
  });
  assert.strictEqual(hasBeginner.band, 'Needs support before Class 1');
  assert.strictEqual(hasBeginner.areasToImprove.length, 1);

  const incomplete = calculateReadinessBandFromRatings({
    'S3.1': { rating: 'Proficient', ruleVersion: 'v1', evidenceCount: 3 },
    'S3.2': { rating: 'not_yet_assessed', ruleVersion: null, evidenceCount: 0 },
    'S3.3': { rating: 'Proficient', ruleVersion: 'v1', evidenceCount: 3 },
    'S3.4': { rating: 'Proficient', ruleVersion: 'v1', evidenceCount: 3 },
    'S3.5': { rating: 'Proficient', ruleVersion: 'v1', evidenceCount: 3 },
    'S3.6': { rating: 'Proficient', ruleVersion: 'v1', evidenceCount: 3 },
    'S3.7': { rating: 'Proficient', ruleVersion: 'v1', evidenceCount: 3 },
  });
  assert.strictEqual(incomplete.band, 'Incomplete');
  assert.deepStrictEqual(incomplete.unassessedConcepts, ['S3.2']);

  // Integration check with dbStore student
  const balvatikaStudent: Student = {
    id: 'stud_balv_622_chk',
    name: 'Balvatika Readiness Child',
    schoolId: 'gps-mt-001',
    classGroup: 'Balvatika',
    section: 'A',
    gender: 'Female',
    age: 5,
    currentLevel: 19,
    targetLevel: 20,
    levelHistory: [],
    aadharMasked: 'XXXX-XXXX-9999'
  };
  (dbStore as any).data.students.push(balvatikaStudent);

  const res = await computeClass1ReadinessBand('stud_balv_622_chk');
  assert.notStrictEqual(res, null);
  assert.strictEqual(res?.band, 'Incomplete');

  console.log('✓ All checks passed for #622 Ready for Class 1 Readiness Band!');
}

runCheck().catch(err => {
  console.error('Check failed:', err);
  process.exit(1);
});
