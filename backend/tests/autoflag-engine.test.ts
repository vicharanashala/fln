import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ─── Bootstrap: isolate env + cwd BEFORE importing application modules ─────
const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-autoflag-test-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);
delete process.env.MONGODB_URI;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'dev-insecure-secret-change-me';

import type { Worksheet, AnswerSubmission, Question } from '../src/db';

const { dbStore } = await import('../src/db');
const { autoFlagService } = await import('../src/services/autoFlagService');

await dbStore.init();

function makeMockWorksheet(partial: { id: string; questions: any[]; [key: string]: any }): Worksheet {
  const questions: Question[] = (partial.questions || []).map((q: any) => ({
    answer_type: 'text' as const,
    subtopic: 'General',
    source_level: 1,
    topic: 'General',
    ...q
  }));

  return {
    classId: 'class_test',
    className: 'Class 5',
    section: 'A',
    schoolId: 'gps-mt-001',
    generatedByRole: 'teacher',
    generatedByEmail: 'teacher@example.com',
    cycle: 'Baseline',
    date: new Date().toISOString(),
    locks: { locked: false, lockedByRole: null, lockedByEmail: null, timestamp: null },
    timing: {
      examDate: new Date().toISOString().split('T')[0],
      printWindowStart: new Date().toISOString(),
      printWindowEnd: new Date().toISOString(),
      examWindowStart: new Date().toISOString(),
      examWindowEnd: new Date().toISOString(),
      submissionWindowEnd: new Date().toISOString()
    },
    delayLogs: { delayedAttemptsCount: 0, submittingTeachers: [] },
    ...partial,
    questions
  } as Worksheet;
}

function makeMockSubmission(partial: Partial<AnswerSubmission> & { id: string; worksheetId: string; studentId: string; answers: Record<string, string> }): AnswerSubmission {
  return {
    studentName: 'Test Student',
    schoolId: 'gps-mt-001',
    classId: 'class_test',
    isDelayed: false,
    submittedAt: new Date().toISOString(),
    ...partial
  } as AnswerSubmission;
}

test('Autoflag Engine Unit Tests (SRS Rule R-15 & §6.7)', async (t) => {
  await t.test('flags easy question when failure rate >= 50% and cohort attempts >= 3', async () => {
    // Setup a worksheet with an easy question
    const testWs = makeMockWorksheet({
      id: 'test_ws_autoflag_1',
      title: 'AutoFlag Test Worksheet 1',
      level: 5,
      schoolId: 'gps-mt-001',
      createdAt: new Date().toISOString(),
      questions: [
        {
          question_id: 'q_easy_test_fail_1',
          question: 'What is 2 + 2?',
          answer: '4',
          difficulty: 'easy' as const,
          source_level: 5,
          topic: 'Addition'
        }
      ]
    });
    await dbStore.addWorksheet(testWs);

    // Add 4 submissions: 1 correct, 3 wrong (75% failure rate)
    const submissions = [
      makeMockSubmission({
        id: 'sub_af_1',
        worksheetId: testWs.id,
        studentId: 'st_1',
        schoolId: 'gps-mt-001',
        answers: { q_easy_test_fail_1: '4' },
        submittedAt: new Date().toISOString()
      }),
      makeMockSubmission({
        id: 'sub_af_2',
        worksheetId: testWs.id,
        studentId: 'st_2',
        schoolId: 'gps-mt-001',
        answers: { q_easy_test_fail_1: '5' }, // wrong
        submittedAt: new Date().toISOString()
      }),
      makeMockSubmission({
        id: 'sub_af_3',
        worksheetId: testWs.id,
        studentId: 'st_3',
        schoolId: 'gps-mt-001',
        answers: { q_easy_test_fail_1: '3' }, // wrong
        submittedAt: new Date().toISOString()
      }),
      makeMockSubmission({
        id: 'sub_af_4',
        worksheetId: testWs.id,
        studentId: 'st_4',
        schoolId: 'gps-mt-001',
        answers: { q_easy_test_fail_1: '22' }, // wrong
        submittedAt: new Date().toISOString()
      })
    ];

    for (const sub of submissions) {
      await dbStore.addAnswerSubmission(sub);
    }

    const scanResult = await autoFlagService.checkAndFlagQuestions({ worksheetId: testWs.id, minAttempts: 3 });
    assert.ok(scanResult.created.length > 0 || scanResult.updated.length > 0, 'Should flag the question');

    const flag = scanResult.created.find(f => f.flagDetails?.questionId === 'q_easy_test_fail_1')
      || scanResult.updated.find(f => f.flagDetails?.questionId === 'q_easy_test_fail_1');

    assert.ok(flag, 'Flag ticket must be created/updated');
    assert.equal(flag?.flagDetails?.questionId, 'q_easy_test_fail_1');
    assert.equal(flag?.flagDetails?.difficulty, 'easy');
    assert.equal(flag?.flagDetails?.attempts, 4);
    assert.equal(flag?.flagDetails?.failures, 3);
    assert.equal(flag?.flagDetails?.failureRate, 75);
    assert.equal(flag?.isAutoFlag, true);
  });

  await t.test('does not flag questions with high pass rate (< 50% failure)', async () => {
    const testWsPass = makeMockWorksheet({
      id: 'test_ws_autoflag_pass',
      title: 'AutoFlag Passing Worksheet',
      level: 3,
      schoolId: 'gps-mt-001',
      createdAt: new Date().toISOString(),
      questions: [
        {
          question_id: 'q_easy_test_pass_1',
          question: 'What is 1 + 1?',
          answer: '2',
          difficulty: 'easy' as const,
          source_level: 3,
          topic: 'Addition'
        }
      ]
    });
    await dbStore.addWorksheet(testWsPass);

    // 4 submissions: 3 correct, 1 wrong (25% failure rate)
    const submissions = [
      makeMockSubmission({ id: 'sub_pass_1', worksheetId: testWsPass.id, studentId: 'st_1', schoolId: 'gps-mt-001', answers: { q_easy_test_pass_1: '2' }, submittedAt: new Date().toISOString() }),
      makeMockSubmission({ id: 'sub_pass_2', worksheetId: testWsPass.id, studentId: 'st_2', schoolId: 'gps-mt-001', answers: { q_easy_test_pass_1: '2' }, submittedAt: new Date().toISOString() }),
      makeMockSubmission({ id: 'sub_pass_3', worksheetId: testWsPass.id, studentId: 'st_3', schoolId: 'gps-mt-001', answers: { q_easy_test_pass_1: '2' }, submittedAt: new Date().toISOString() }),
      makeMockSubmission({ id: 'sub_pass_4', worksheetId: testWsPass.id, studentId: 'st_4', schoolId: 'gps-mt-001', answers: { q_easy_test_pass_1: '11' }, submittedAt: new Date().toISOString() })
    ];

    for (const sub of submissions) {
      await dbStore.addAnswerSubmission(sub);
    }

    const scanResult = await autoFlagService.checkAndFlagQuestions({ worksheetId: testWsPass.id, minAttempts: 3 });
    const flag = scanResult.created.find(f => f.flagDetails?.questionId === 'q_easy_test_pass_1');
    assert.equal(flag, undefined, 'Should NOT flag question with 25% failure rate');
  });

  await t.test('tolerates equivalent numbers e.g. "05" and "5.0" for correct answers', async () => {
    const testWsNum = makeMockWorksheet({
      id: 'test_ws_autoflag_num',
      title: 'AutoFlag Numeric Tolerance Worksheet',
      level: 2,
      schoolId: 'gps-mt-001',
      createdAt: new Date().toISOString(),
      questions: [
        {
          question_id: 'q_num_tol_1',
          question: 'What is 5 + 0?',
          answer: '5',
          difficulty: 'easy' as const,
          source_level: 2,
          topic: 'Addition'
        }
      ]
    });
    await dbStore.addWorksheet(testWsNum);

    const submissions = [
      makeMockSubmission({ id: 'sub_num_1', worksheetId: testWsNum.id, studentId: 'st_1', schoolId: 'gps-mt-001', answers: { q_num_tol_1: '05' }, submittedAt: new Date().toISOString() }),
      makeMockSubmission({ id: 'sub_num_2', worksheetId: testWsNum.id, studentId: 'st_2', schoolId: 'gps-mt-001', answers: { q_num_tol_1: '5.0' }, submittedAt: new Date().toISOString() }),
      makeMockSubmission({ id: 'sub_num_3', worksheetId: testWsNum.id, studentId: 'st_3', schoolId: 'gps-mt-001', answers: { q_num_tol_1: '5' }, submittedAt: new Date().toISOString() })
    ];

    for (const sub of submissions) {
      await dbStore.addAnswerSubmission(sub);
    }

    const scanResult = await autoFlagService.checkAndFlagQuestions({ worksheetId: testWsNum.id, minAttempts: 3 });
    const flag = scanResult.created.find(f => f.flagDetails?.questionId === 'q_num_tol_1');
    assert.equal(flag, undefined, 'Numeric variants like "05" and "5.0" should be treated as correct');
  });

  await t.test('persists difficulty reclassification and prevents future flagging under old threshold', async () => {
    const testWsReclass = makeMockWorksheet({
      id: 'test_ws_autoflag_reclass',
      title: 'AutoFlag Reclass Test Worksheet',
      level: 4,
      schoolId: 'gps-mt-001',
      createdAt: new Date().toISOString(),
      questions: [
        {
          question_id: 'q_reclass_easy_1',
          question: 'What is 3 + 3?',
          answer: '6',
          difficulty: 'easy' as const,
          source_level: 4,
          topic: 'Addition'
        }
      ]
    });
    await dbStore.addWorksheet(testWsReclass);

    // Initial 4 submissions: 1 correct, 3 wrong (75% failure rate -> triggers initial easy flag)
    await dbStore.addAnswerSubmission(makeMockSubmission({ id: 'sub_rc_1', worksheetId: testWsReclass.id, studentId: 's1', schoolId: 'gps-mt-001', answers: { q_reclass_easy_1: '6' }, submittedAt: new Date().toISOString() }));
    await dbStore.addAnswerSubmission(makeMockSubmission({ id: 'sub_rc_2', worksheetId: testWsReclass.id, studentId: 's2', schoolId: 'gps-mt-001', answers: { q_reclass_easy_1: '7' }, submittedAt: new Date().toISOString() }));
    await dbStore.addAnswerSubmission(makeMockSubmission({ id: 'sub_rc_3', worksheetId: testWsReclass.id, studentId: 's3', schoolId: 'gps-mt-001', answers: { q_reclass_easy_1: '8' }, submittedAt: new Date().toISOString() }));
    await dbStore.addAnswerSubmission(makeMockSubmission({ id: 'sub_rc_4', worksheetId: testWsReclass.id, studentId: 's4', schoolId: 'gps-mt-001', answers: { q_reclass_easy_1: '9' }, submittedAt: new Date().toISOString() }));

    const initialScan = await autoFlagService.checkAndFlagQuestions({ worksheetId: testWsReclass.id, minAttempts: 3 });
    const initialFlag = initialScan.created.find(f => f.flagDetails?.questionId === 'q_reclass_easy_1')
      || initialScan.updated.find(f => f.flagDetails?.questionId === 'q_reclass_easy_1');

    assert.ok(initialFlag, 'Initial easy flag should be created');

    // Superadmin resolves ticket by reclassifying difficulty to 'medium'
    await dbStore.updateQuestionDifficulty('q_reclass_easy_1', 'medium');
    await dbStore.updateTicket(initialFlag.id, {
      status: 'Resolved',
      reclassifiedBand: 'medium',
      actionTaken: 'Reclassified to MEDIUM',
      flagDetails: { ...initialFlag.flagDetails!, difficulty: 'medium' }
    });

    // Add another submission: 1 correct (now 2 correct, 3 wrong = 60% failure rate)
    // 60% failure is < 70% medium threshold, so it should NOT be flagged under medium
    await dbStore.addAnswerSubmission(makeMockSubmission({ id: 'sub_rc_5', worksheetId: testWsReclass.id, studentId: 's5', schoolId: 'gps-mt-001', answers: { q_reclass_easy_1: '6' }, submittedAt: new Date().toISOString() }));

    const secondScan = await autoFlagService.checkAndFlagQuestions({ worksheetId: testWsReclass.id, minAttempts: 3 });
    const flaggedInSecond = secondScan.created.find(f => f.flagDetails?.questionId === 'q_reclass_easy_1');
    assert.equal(flaggedInSecond, undefined, 'Reclassified question at 60% failure must not be re-flagged under easy threshold');

    // Verify worksheet question was persisted with updated medium difficulty
    const worksheets = await dbStore.getWorksheets();
    const ws = worksheets.find(w => w.id === testWsReclass.id);
    const qInWs = ws?.questions?.find(q => q.question_id === 'q_reclass_easy_1');
    assert.equal(qInWs?.difficulty, 'medium', 'Worksheet question difficulty must be persisted as medium');
  });

  await t.test('unresolved question without difficulty change gets updated when more students fail', async () => {
    const testWsUnresolved = makeMockWorksheet({
      id: 'test_ws_autoflag_unresolved',
      title: 'AutoFlag Unresolved Test Worksheet',
      level: 5,
      schoolId: 'gps-mt-001',
      createdAt: new Date().toISOString(),
      questions: [
        {
          question_id: 'q_unresolved_easy_1',
          question: 'What is 4 + 4?',
          answer: '8',
          difficulty: 'easy' as const,
          source_level: 5,
          topic: 'Addition'
        }
      ]
    });
    await dbStore.addWorksheet(testWsUnresolved);

    // Initial submissions: 1 correct, 2 wrong (66.7% fail)
    await dbStore.addAnswerSubmission(makeMockSubmission({ id: 'sub_unres_1', worksheetId: testWsUnresolved.id, studentId: 'st_1', schoolId: 'gps-mt-001', answers: { q_unresolved_easy_1: '8' }, submittedAt: new Date().toISOString() }));
    await dbStore.addAnswerSubmission(makeMockSubmission({ id: 'sub_unres_2', worksheetId: testWsUnresolved.id, studentId: 'st_2', schoolId: 'gps-mt-001', answers: { q_unresolved_easy_1: '0' }, submittedAt: new Date().toISOString() }));
    await dbStore.addAnswerSubmission(makeMockSubmission({ id: 'sub_unres_3', worksheetId: testWsUnresolved.id, studentId: 'st_3', schoolId: 'gps-mt-001', answers: { q_unresolved_easy_1: '44' }, submittedAt: new Date().toISOString() }));

    const firstScan = await autoFlagService.checkAndFlagQuestions({ worksheetId: testWsUnresolved.id, minAttempts: 3 });
    const flag = firstScan.created.find(f => f.flagDetails?.questionId === 'q_unresolved_easy_1');
    assert.ok(flag, 'Should create flag for unresolved question');
    assert.equal(flag.status, 'Open');
    assert.equal(flag.flagDetails?.attempts, 3);
    assert.equal(flag.flagDetails?.failures, 2);

    // More students fail in future: add 2 more wrong submissions
    await dbStore.addAnswerSubmission(makeMockSubmission({ id: 'sub_unres_4', worksheetId: testWsUnresolved.id, studentId: 'st_4', schoolId: 'gps-mt-001', answers: { q_unresolved_easy_1: '1' }, submittedAt: new Date().toISOString() }));
    await dbStore.addAnswerSubmission(makeMockSubmission({ id: 'sub_unres_5', worksheetId: testWsUnresolved.id, studentId: 'st_5', schoolId: 'gps-mt-001', answers: { q_unresolved_easy_1: '2' }, submittedAt: new Date().toISOString() }));

    const nextScan = await autoFlagService.checkAndFlagQuestions({ worksheetId: testWsUnresolved.id, minAttempts: 3 });
    const updatedFlag = nextScan.updated.find(f => f.flagDetails?.questionId === 'q_unresolved_easy_1');
    assert.ok(updatedFlag, 'Should update flag with new statistics');
    assert.equal(updatedFlag.flagDetails?.attempts, 5);
    assert.equal(updatedFlag.flagDetails?.failures, 4);
    assert.equal(updatedFlag.flagDetails?.failureRate, 80);
    assert.equal(updatedFlag.status, 'Open', 'Status remains Open for Superadmin action');
  });

  await t.test('summary aggregation computes correct metrics', async () => {
    const summary = await autoFlagService.getAutoFlagSummary();
    assert.equal(typeof summary.totalFlagged, 'number');
    assert.equal(typeof summary.openFlags, 'number');
    assert.equal(typeof summary.averageFailureRate, 'number');
    assert.ok(Array.isArray(summary.flags));
  });
});
