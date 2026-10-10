/**
 * Issue #402: Teacher override endpoint regression tests.
 *
 * Verifies that PATCH /api/evaluation/:reportId/override:
 *   1. Excludes questions marked correct from rootCauses even if their
 *      submitted text unchanged.
 *   2. Recomputes rootCauses when an answer is corrected via correctedAnswer.
 *   3. Clears rootCauses to an empty array when all wrong answers are corrected.
 *
 * Run:  cd backend && npm run test:evaluation-override
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Worksheet, EvaluationReport } from '../src/db';

// Bootstrap: isolate env + cwd BEFORE importing application modules
const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-eval-override-test-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);
delete process.env.MONGODB_URI;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'dev-insecure-secret-change-me';
process.env.SEED_DEMO_PASSWORD = 'Fln@2026';

const { dbStore } = await import('../src/db');
const { JWT_SECRET } = await import('../src/auth');
const { registerEvaluationRoutes } = await import('../src/routes/evaluation');
const { computeRootCauseAnalysis } = await import('../src/rootCauseAnalysis');
const express = (await import('express')).default;
const jwtLib = (await import('jsonwebtoken')).default;

await dbStore.init();

const storeData = (dbStore as any).data;

const app = express();
app.use(express.json());
registerEvaluationRoutes(app);

const apiServer: http.Server = await new Promise(resolve => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s as http.Server));
});
const apiPort = (apiServer.address() as import('net').AddressInfo).port;
const BASE = `http://127.0.0.1:${apiPort}`;

const TEACHER = 'gps-mt-001.t01@fln.org';

function authHeaderFor(email: string): string {
  return `Bearer ${jwtLib.sign({ email }, JWT_SECRET, { expiresIn: '1h' })}`;
}

async function api(method: string, reqPath: string, email: string, body?: unknown) {
  const res = await fetch(`${BASE}${reqPath}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: authHeaderFor(email) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

after(async () => {
  await new Promise<void>(resolve => apiServer.close(() => resolve()));
  (apiServer as any).closeAllConnections?.();
  try { fs.rmSync(scratchDir, { recursive: true, force: true }); } catch {}
});

const sampleWorksheet: Worksheet = {
  id: 'ws-override-test',
  classId: 'c1',
  className: 'Class 2',
  section: 'A',
  schoolId: 'gps-mt-001',
  generatedByRole: 'teacher' as any,
  generatedByEmail: TEACHER,
  cycle: 'Baseline' as any,
  date: '2026-10-09',
  questions: [
    {
      question_id: 'q1',
      question: 'What is 3 + 4?',
      answer: '7',
      answer_type: 'number',
      topic: 'Addition',
      subtopic: 'Single Digit',
      difficulty: 'easy',
      source_level: 2,
    },
    {
      question_id: 'q2',
      question: 'What is 5 + 5?',
      answer: '10',
      answer_type: 'number',
      topic: 'Addition',
      subtopic: 'Single Digit',
      difficulty: 'easy',
      source_level: 2,
    },
    {
      question_id: 'q3',
      question: 'What is 6 + 3?',
      answer: '9',
      answer_type: 'number',
      topic: 'Addition',
      subtopic: 'Single Digit',
      difficulty: 'easy',
      source_level: 2,
    },
  ],
  locks: {
    locked: false,
    lockedByRole: null,
    lockedByEmail: null,
    timestamp: null,
  },
  timing: {
    examDate: '2026-10-09',
    printWindowStart: '2026-10-09T00:00:00.000Z',
    printWindowEnd: '2026-10-09T23:59:59.000Z',
    examWindowStart: '2026-10-09T00:00:00.000Z',
    examWindowEnd: '2026-10-09T23:59:59.000Z',
    submissionWindowEnd: '2026-10-09T23:59:59.000Z',
  },
  delayLogs: {
    delayedAttemptsCount: 0,
    submittingTeachers: [],
  },
};

if (storeData) {
  storeData.worksheets.push(sampleWorksheet);
}

function createReport(id: string): EvaluationReport {
  return {
    id,
    studentId: 's1',
    worksheetId: 'ws-override-test',
    score: 1,
    totalQuestions: 3,
    conceptMastery: { Addition: 'Needs Practice' },
    narrative: 'Needs practice with addition',
    recommendedLevel: 2,
    timestamp: new Date().toISOString(),
    questionResults: [
      { questionId: 'q1', question: 'What is 3 + 4?', correctAnswer: '7', submittedAnswer: 'five', isCorrect: false },
      { questionId: 'q2', question: 'What is 5 + 5?', correctAnswer: '10', submittedAnswer: '10', isCorrect: true },
      { questionId: 'q3', question: 'What is 6 + 3?', correctAnswer: '9', submittedAnswer: '8', isCorrect: false },
    ],
    rootCauses: [
      {
        questionId: 'q1',
        error: 'five',
        topic: 'Addition',
        flnLevel: 2,
        errorType: 'unclassified',
        analysis: 'Incorrect value',
      },
      {
        questionId: 'q3',
        error: '8',
        topic: 'Addition',
        flnLevel: 2,
        errorType: 'off_by_one',
        analysis: 'Off by one',
      },
    ],
  };
}

test('Case 1: marking a wrong answer correct without changing text excludes it from rootCauses', async () => {
  const reportId = 'rep-override-1';
  const report = createReport(reportId);
  storeData?.evaluationReports.push(report);

  const res = await api('PATCH', `/api/evaluation/${reportId}/override`, TEACHER, {
    corrections: [{ questionId: 'q1', isCorrect: true }],
  });

  assert.equal(res.status, 200);
  assert.equal(res.json.report.score, 2, 'Score should increase from 1 to 2');

  const rootCauses = res.json.report.rootCauses;
  assert.ok(Array.isArray(rootCauses), 'rootCauses should be an array');
  assert.equal(rootCauses.length, 1, 'rootCauses should only contain the remaining wrong question');
  assert.equal(rootCauses[0].questionId, 'q3', 'rootCauses should only list q3');
});

test('Case 2: correcting an answer via correctedAnswer updates rootCauses', async () => {
  const reportId = 'rep-override-2';
  const report = createReport(reportId);
  storeData?.evaluationReports.push(report);

  const res = await api('PATCH', `/api/evaluation/${reportId}/override`, TEACHER, {
    corrections: [{ questionId: 'q3', isCorrect: true, correctedAnswer: '9' }],
  });

  assert.equal(res.status, 200);
  assert.equal(res.json.report.score, 2, 'Score should increase from 1 to 2');

  const rootCauses = res.json.report.rootCauses;
  assert.ok(Array.isArray(rootCauses), 'rootCauses should be an array');
  assert.equal(rootCauses.length, 1, 'rootCauses should only contain q1');
  assert.equal(rootCauses[0].questionId, 'q1', 'rootCauses should only list q1');
});

test('Case 3: correcting all wrong answers sets rootCauses to an empty array', async () => {
  const reportId = 'rep-override-3';
  const report = createReport(reportId);
  storeData?.evaluationReports.push(report);

  const res = await api('PATCH', `/api/evaluation/${reportId}/override`, TEACHER, {
    corrections: [
      { questionId: 'q1', isCorrect: true },
      { questionId: 'q3', isCorrect: true, correctedAnswer: '9' },
    ],
  });

  assert.equal(res.status, 200);
  assert.equal(res.json.report.score, 3, 'Score should be 3/3');

  const rootCauses = res.json.report.rootCauses;
  assert.ok(Array.isArray(rootCauses), 'rootCauses should be an array');
  assert.equal(rootCauses.length, 0, 'rootCauses should be empty when no errors remain');
});

test('Case 4: choiceErrorTags lookup on wrong choices sets tagged errorType (#627, #693)', () => {
  const result = computeRootCauseAnalysis(
    {},
    [
      {
        question_id: 'q1',
        answer: 'Option A',
        topic: 'shapes',
        source_level: 20,
        choiceErrorTags: { 'Option B': 'under-inclusion' },
      } as any,
    ],
    { q1: 'Option B' }
  );

  assert.ok(result.rootCauses && result.rootCauses.length > 0, 'rootCauses should not be empty');
  assert.equal(result.rootCauses[0].errorType, 'under-inclusion', 'errorType should match tagged choice');
});
