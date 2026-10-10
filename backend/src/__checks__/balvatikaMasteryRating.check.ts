import assert from 'node:assert';
import { dbStore, Student, EvaluationReport } from '../db';
import { computeConceptMastery, MASTERY_RULE_VERSION } from '../services/skillStatus';

async function runCheck() {
  console.log('--- Running Check: Balvatika Per-Concept Mastery Rating (#621) ---');
  await dbStore.init();

  // 1. Create Balvatika student (Level 19 = Stage 3 Balvatika per curriculum map)
  const balvatikaStudent: Student = {
    id: 'stud_balv_621_chk',
    name: 'Balvatika Child',
    schoolId: 'gps-mt-001',
    classGroup: 'Balvatika',
    section: 'A',
    gender: 'Female',
    age: 5,
    currentLevel: 19,
    targetLevel: 20,
    levelHistory: [],
    aadharMasked: 'XXXX-XXXX-1234'
  };
  (dbStore as any).data.students.push(balvatikaStudent);

  // 2. Create Non-Balvatika student (Level 15 = Stage 2 / Preschool 2)
  const nonBalvatikaStudent: Student = {
    id: 'stud_c1_621_chk',
    name: 'Class 1 Child',
    schoolId: 'gps-mt-001',
    classGroup: 'Class 1',
    section: 'A',
    gender: 'Male',
    age: 6,
    currentLevel: 15,
    targetLevel: 16,
    levelHistory: [],
    aadharMasked: 'XXXX-XXXX-5678'
  };
  (dbStore as any).data.students.push(nonBalvatikaStudent);

  // Non-Balvatika check: MUST return null
  const nonBalvResult = await computeConceptMastery('stud_c1_621_chk');
  assert.strictEqual(nonBalvResult, null, 'Non-Balvatika student must return null from computeConceptMastery');

  // Add evaluation report for Balvatika student with 3 attempts on S3.1 (2 correct -> Proficient)
  const report: EvaluationReport = {
    id: 'rep_balv_621_chk',
    studentId: 'stud_balv_621_chk',
    worksheetId: 'ws_balv_01',
    score: 2,
    totalQuestions: 3,
    conceptMastery: {},
    narrative: '',
    recommendedLevel: 19,
    recommendedSubLevel: 0,
    timestamp: new Date().toISOString(),
    questionResults: [
      { questionId: 'S3.1_q1', question: 'Count S3.1', correctAnswer: '3', submittedAnswer: '3', isCorrect: true },
      { questionId: 'S3.1_q2', question: 'Count S3.1', correctAnswer: '4', submittedAnswer: '4', isCorrect: true },
      { questionId: 'S3.1_q3', question: 'Count S3.1', correctAnswer: '5', submittedAnswer: '2', isCorrect: false },
      { questionId: 'S3.2_q1', question: 'Match S3.2', correctAnswer: 'A', submittedAnswer: 'B', isCorrect: false }
    ]
  };
  (dbStore as any).data.evaluationReports.push(report);

  // Compute mastery for Balvatika student
  const balvResult = await computeConceptMastery('stud_balv_621_chk');
  assert.notStrictEqual(balvResult, null, 'Balvatika student result should not be null');

  if (balvResult) {
    // S3.1: 2 of 3 correct = Proficient
    assert.strictEqual(balvResult['S3.1'].rating, 'Proficient', '2 of 3 correct must equal Proficient');
    assert.strictEqual(balvResult['S3.1'].ruleVersion, MASTERY_RULE_VERSION, 'Rule version must be tagged');

    // S3.2: 0 of 1 correct = Beginner
    assert.strictEqual(balvResult['S3.2'].rating, 'Beginner', '0 correct must equal Beginner');

    // S3.3: 0 attempts = not_yet_assessed
    assert.strictEqual(balvResult['S3.3'].rating, 'not_yet_assessed', 'Unassessed concept must equal not_yet_assessed');
  }

  console.log('✓ All checks passed for #621 Balvatika Per-Concept Mastery Rating!');
}

runCheck().catch(err => {
  console.error('Check failed:', err);
  process.exit(1);
});
