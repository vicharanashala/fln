import assert from 'node:assert';
import { dbStore, EvaluationReport } from '../db';
import { triggerAutoRemediation, startOrRetryRemediation } from '../services/remediationLedgerService';

async function runCheck() {
  console.log('--- Running Check: Automatic Remediation Trigger (#678) ---');
  await dbStore.init();

  const report: EvaluationReport = {
    id: 'rep_check_001',
    studentId: 'student_remed_01',
    worksheetId: 'ws_remed_01',
    score: 2,
    totalQuestions: 5,
    conceptMastery: { Addition: 'Needs Practice' },
    narrative: 'Needs help with addition',
    recommendedLevel: 2,
    recommendedSubLevel: 1,
    timestamp: new Date().toISOString(),
    questionResults: [
      { questionId: 'q1', question: '2 + 2', correctAnswer: '4', submittedAnswer: '4', isCorrect: true },
      { questionId: 'q2', question: '5 + 3', correctAnswer: '8', submittedAnswer: '7', isCorrect: false },
      { questionId: 'q3', question: '3 + 4', correctAnswer: '7', submittedAnswer: '6', isCorrect: false },
    ]
  };

  // 1. Auto-trigger on evaluation report creation
  const ledger1 = await triggerAutoRemediation(report);
  assert.notStrictEqual(ledger1, null, 'Remediation ledger should be created for report with failed questions');
  assert.strictEqual(ledger1?.triggeredAutomatically, true, 'Ledger should be marked triggeredAutomatically: true');
  assert.deepStrictEqual(ledger1?.failedQuestionIds, ['q2', 'q3'], 'Failed questions should be stored in ledger');

  // 2. Repeat report for same student and worksheet should NOT create duplicate ledger
  const ledger2 = await triggerAutoRemediation(report);
  assert.strictEqual(ledger2?.id, ledger1?.id, 'Repeat of same report should return existing ledger without creating duplicate');

  // 3. Manual retry endpoint should be able to force retry
  const retriedLedger = await startOrRetryRemediation('student_remed_01', 'ws_remed_01', true);
  assert.strictEqual(retriedLedger.id, ledger1?.id, 'Manual retry should touch existing ledger');

  console.log('✓ All checks passed for #678 automatic remediation trigger!');
}

runCheck().catch((err) => {
  console.error('Check failed:', err);
  process.exit(1);
});
