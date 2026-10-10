import assert from 'node:assert';
import { dbStore, Student, EvaluationReport } from '../db';
import { getRecurringErrorForConcept } from '../services/recurringError';

async function runCheck() {
  console.log('--- Running Check: Recurring Error Type for Flagged Concept (#624) ---');
  await dbStore.init();

  const student: Student = {
    id: 'stud_rec_624_chk',
    name: 'Recurring Error Student',
    schoolId: 'gps-mt-001',
    classGroup: 'Class 2',
    section: 'A',
    gender: 'Male',
    age: 7,
    currentLevel: 25,
    targetLevel: 26,
    levelHistory: [],
    aadharMasked: 'XXXX-XXXX-4444'
  };
  (dbStore as any).data.students.push(student);

  // Add 2 evaluation reports with digit reversal errors (e.g. submitted 21 for 12) on concept S3.1
  const report1: EvaluationReport = {
    id: 'rep_rec_01',
    studentId: 'stud_rec_624_chk',
    worksheetId: 'ws_01',
    score: 0,
    totalQuestions: 1,
    conceptMastery: {},
    narrative: '',
    recommendedLevel: 25,
    recommendedSubLevel: 0,
    timestamp: new Date().toISOString(),
    questionResults: [
      { questionId: 'S3.1_q1', question: 'Concept S3.1', correctAnswer: '12', submittedAnswer: '21', isCorrect: false }
    ]
  };

  const report2: EvaluationReport = {
    id: 'rep_rec_02',
    studentId: 'stud_rec_624_chk',
    worksheetId: 'ws_02',
    score: 0,
    totalQuestions: 1,
    conceptMastery: {},
    narrative: '',
    recommendedLevel: 25,
    recommendedSubLevel: 0,
    timestamp: new Date().toISOString(),
    questionResults: [
      { questionId: 'S3.1_q2', question: 'Concept S3.1', correctAnswer: '34', submittedAnswer: '43', isCorrect: false }
    ]
  };

  (dbStore as any).data.evaluationReports.push(report1);
  (dbStore as any).data.evaluationReports.push(report2);

  const res = await getRecurringErrorForConcept('stud_rec_624_chk', 'S3.1');
  assert.strictEqual(res.conceptId, 'S3.1');
  assert.strictEqual(res.hasRecurringPattern, true);
  assert.strictEqual(res.recurringErrorType, 'digit_reversal');
  assert.strictEqual(res.errorCounts['digit_reversal'], 2);

  console.log('✓ All checks passed for #624 Recurring Error Type!');
}

runCheck().catch(err => {
  console.error('Check failed:', err);
  process.exit(1);
});
