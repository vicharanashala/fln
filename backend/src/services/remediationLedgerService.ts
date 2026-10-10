import { randomUUID } from 'crypto';
import { dbStore, EvaluationReport, RemediationLedger } from '../db';

/**
 * Automatically triggers creation of a remediation ledger when an evaluation report
 * contains failed questions, as required by Issue #678.
 */
export async function triggerAutoRemediation(report: EvaluationReport): Promise<RemediationLedger | null> {
  const failedQuestions = report.questionResults ? report.questionResults.filter(q => !q.isCorrect) : [];
  if (failedQuestions.length === 0) {
    return null; // No remediation needed for 100% score
  }

  const existingLedgers = await dbStore.getRemediationLedgers();
  const existingLedger = existingLedgers.find(
    l => l.studentId === report.studentId && l.worksheetId === report.worksheetId
  );

  if (existingLedger) {
    return existingLedger; // Prevent duplicate ledgers for repeat reports
  }

  const ledger: RemediationLedger = {
    id: 'ledger_' + randomUUID(),
    studentId: report.studentId,
    worksheetId: report.worksheetId,
    evaluationReportId: report.id,
    failedQuestionIds: failedQuestions.map(q => q.questionId),
    status: 'completed',
    triggeredAutomatically: true,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString()
  };

  await dbStore.addRemediationLedger(ledger);
  return ledger;
}

/**
 * Allows a teacher to manually trigger or retry a remediation ledger.
 */
export async function startOrRetryRemediation(
  studentId: string,
  worksheetId: string,
  forceRetry = false
): Promise<RemediationLedger> {
  const existingLedgers = await dbStore.getRemediationLedgers();
  const existing = existingLedgers.find(
    l => l.studentId === studentId && l.worksheetId === worksheetId
  );

  if (existing && !forceRetry && existing.status === 'completed') {
    return existing;
  }

  if (existing && forceRetry) {
    const updated = await dbStore.updateRemediationLedger(existing.id, {
      status: 'completed',
      completedAt: new Date().toISOString()
    });
    return updated || existing;
  }

  // Find latest evaluation report for student & worksheet
  const reports = await dbStore.getEvaluationReports();
  const report = reports.find(r => r.studentId === studentId && r.worksheetId === worksheetId);
  const failedQuestions = report?.questionResults ? report.questionResults.filter(q => !q.isCorrect) : [];

  const ledger: RemediationLedger = {
    id: 'ledger_' + randomUUID(),
    studentId,
    worksheetId,
    evaluationReportId: report?.id || 'manual_trigger',
    failedQuestionIds: failedQuestions.map(q => q.questionId),
    status: 'completed',
    triggeredAutomatically: false,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString()
  };

  await dbStore.addRemediationLedger(ledger);
  return ledger;
}
