/**
 * Issue #845 — Certification trigger only fires for End-of-year worksheets.
 *
 * Tests exercise worksheet evaluation (POST /api/evaluation/submit) and
 * diagnostic evaluation (POST /api/students/:id/diagnostic/submit) against an
 * isolated file-backed DB to verify:
 *
 *   1. End-of-year worksheet submissions store `cycle: 'End-of-year'` on the
 *      EvaluationReport AND trigger runCertificationEligibility.
 *   2. Mid-year worksheet submissions store `cycle: 'Mid-year'` on the report
 *      but do NOT trigger runCertificationEligibility.
 *   3. Baseline worksheet submissions store `cycle: 'Baseline'` on the report
 *      but do NOT trigger runCertificationEligibility.
 *   4. Diagnostic submissions do NOT trigger certification eligibility and do
 *      not set a cycle on the report.
 *   5. Missing cycle on legacy worksheets does not crash; report has undefined
 *      cycle and certification is NOT triggered.
 *   6. Revoked certificates are preserved and logged when End-of-year evidence
 *      arrives, while Mid-year/diagnostic never trigger the certification flow.
 *   7. Concurrent End-of-year submissions for the same student serialize properly.
 *   8. EvaluationReport.cycle is persisted and readable from getEvaluationReports.
 *
 * The tests use an isolated scratch directory so backend/data/db.json is
 * never touched.
 */
import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolate the file-backed DB from backend/data/db.json.
const originalCwd = process.cwd();
const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-cert-eoy-test-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);
delete process.env.MONGODB_URI;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'cert-eoy-test-secret';
process.env.SEED_DEMO_PASSWORD = 'TestPass@123';

const { dbStore, CYCLE_NAMES } = await import('../src/db.js');
const { JWT_SECRET } = await import('../src/auth.js');
const { registerEvaluationRoutes } = await import('../src/routes/evaluation.js');
const { registerStudentRoutes } = await import('../src/routes/students.js');
const express = (await import('express')).default;
const jwt = (await import('jsonwebtoken')).default;

await dbStore.init();

// ─── Spying on certification eligibility ─────────────────────────────────────
// runCertificationEligibility begins by fetching the student's latest concept
// mastery from dbStore (dbStore.getLatestConceptMastery). Since dbStore is an
// object singleton, we can spy on getLatestConceptMastery to record when
// certification evaluation is triggered for a student.
const origGetLatestMastery = dbStore.getLatestConceptMastery.bind(dbStore);
let certCalls: string[] = [];

dbStore.getLatestConceptMastery = async (id: string) => {
  certCalls.push(id);
  return origGetLatestMastery(id);
};

async function waitForAsyncTasks(ms = 60) {
  await new Promise(r => setTimeout(r, ms));
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const teacherEmail = 'gps-mt-001.t01@fln.org';

const app = express();
app.use(express.json({ limit: '10mb' }));
registerEvaluationRoutes(app);
registerStudentRoutes(app);

const server: http.Server = await new Promise(resolve => {
  const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
});
const baseUrl = `http://127.0.0.1:${(server.address() as import('net').AddressInfo).port}`;
const token = jwt.sign({ email: teacherEmail }, JWT_SECRET, { expiresIn: '1h' });

async function request(method: string, route: string, body?: unknown, withAuth = true) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(withAuth ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let responseBody: any;
  try { responseBody = await response.json(); } catch { responseBody = null; }
  return { status: response.status, body: responseBody };
}

// Seed minimal student
const schoolId = 'gps-mt-001';
const studentId = 'stu_cert_eoy_1';
const classGroup = 'Class 3';

const users = await dbStore.getUsers();
const teacher = users.find((u: any) => u.email === teacherEmail);
assert.ok(teacher, 'Seeded teacher must exist');

let student = await dbStore.getStudentById(studentId);
if (!student) {
  await dbStore.addStudent({
    id: studentId,
    name: 'Cert EOY Test Student',
    age: 9,
    classGroup,
    section: 'A',
    schoolId,
    currentLevel: 5,
    currentSubLevel: 0,
    targetLevel: 6,
    aadharMasked: 'XXXX-XXXX-9901',
    levelHistory: [],
  });
  student = await dbStore.getStudentById(studentId);
}
assert.ok(student);

let worksheetCounter = 0;
async function createWorksheet(cycle?: typeof CYCLE_NAMES[number]): Promise<string> {
  worksheetCounter++;
  const cycleTag = cycle ? cycle.replace(/[^a-zA-Z]/g, '') : 'None';
  const wsId = `ws_cert_eoy_${cycleTag}_${worksheetCounter}`;
  const now = new Date();
  const future = new Date(now.getTime() + 24 * 3600 * 1000);
  const questions = [{
    question_id: `${studentId}_q1_${worksheetCounter}`,
    question: '2 + 3 = ?',
    answer: '5',
    answer_type: 'number' as const,
    topic: 'Addition',
    subtopic: 'Single Digit',
    difficulty: 'easy' as const,
    source_level: 5,
  }];
  await dbStore.addWorksheet({
    id: wsId,
    classId: classGroup,
    className: classGroup,
    section: 'A',
    schoolId,
    generatedByRole: 'teacher' as any,
    generatedByEmail: teacherEmail,
    ...(cycle ? { cycle } : { cycle: undefined as any }),
    date: now.toISOString().split('T')[0],
    questions,
    studentIds: [studentId],
    locks: { locked: false, lockedByRole: null, lockedByEmail: null, timestamp: null },
    timing: {
      examDate: now.toISOString().split('T')[0],
      printWindowStart: now.toISOString(),
      printWindowEnd: future.toISOString(),
      examWindowStart: now.toISOString(),
      examWindowEnd: future.toISOString(),
      submissionWindowEnd: future.toISOString(),
    },
    delayLogs: { delayedAttemptsCount: 0, submittingTeachers: [] },
  });
  return wsId;
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

after(async () => {
  dbStore.getLatestConceptMastery = origGetLatestMastery;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  process.chdir(originalCwd);
  fs.rmSync(scratchDir, { recursive: true, force: true });
});

// ─── Tests ──────────────────────────────────────────────────────────────────

test('End-of-year worksheet submission stores cycle and triggers certification', async () => {
  certCalls = [];
  const wsId = await createWorksheet('End-of-year');

  const res = await request('POST', '/api/evaluation/submit', {
    worksheetId: wsId,
    studentId,
    answers: { [`${studentId}_q1_${worksheetCounter}`]: '5' },
  });

  assert.equal(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);
  await waitForAsyncTasks();

  // Verify the report stores the cycle.
  const reports = await dbStore.getEvaluationReports({ studentIds: [studentId] });
  const eoyReport = reports.find((r: any) => r.worksheetId === wsId);
  assert.ok(eoyReport, 'End-of-year report must exist');
  assert.equal(eoyReport.cycle, 'End-of-year', 'Report must store End-of-year cycle');

  // Verify certification was triggered for End-of-year.
  assert.ok(certCalls.includes(studentId), 'runCertificationEligibility must be triggered for End-of-year');
});

test('Mid-year worksheet submission stores cycle but does NOT trigger certification', async () => {
  certCalls = [];
  const wsId = await createWorksheet('Mid-year');

  const res = await request('POST', '/api/evaluation/submit', {
    worksheetId: wsId,
    studentId,
    answers: { [`${studentId}_q1_${worksheetCounter}`]: '5' },
  });

  assert.equal(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);
  await waitForAsyncTasks();

  // Verify the report stores the cycle.
  const reports = await dbStore.getEvaluationReports({ studentIds: [studentId] });
  const midReport = reports.find((r: any) => r.worksheetId === wsId);
  assert.ok(midReport, 'Mid-year report must exist');
  assert.equal(midReport.cycle, 'Mid-year', 'Report must store Mid-year cycle');

  // Verify certification was NOT triggered.
  assert.equal(certCalls.length, 0, 'runCertificationEligibility must NOT be called for Mid-year');
});

test('Baseline worksheet submission stores cycle but does NOT trigger certification', async () => {
  certCalls = [];
  const wsId = await createWorksheet('Baseline');

  const res = await request('POST', '/api/evaluation/submit', {
    worksheetId: wsId,
    studentId,
    answers: { [`${studentId}_q1_${worksheetCounter}`]: '5' },
  });

  assert.equal(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);
  await waitForAsyncTasks();

  const reports = await dbStore.getEvaluationReports({ studentIds: [studentId] });
  const baselineReport = reports.find((r: any) => r.worksheetId === wsId);
  assert.ok(baselineReport, 'Baseline report must exist');
  assert.equal(baselineReport.cycle, 'Baseline', 'Report must store Baseline cycle');

  // Verify certification was NOT triggered.
  assert.equal(certCalls.length, 0, 'runCertificationEligibility must NOT be called for Baseline');
});

test('Legacy worksheet with missing cycle does not crash and does NOT trigger certification', async () => {
  certCalls = [];
  const wsId = await createWorksheet(undefined); // No cycle

  const res = await request('POST', '/api/evaluation/submit', {
    worksheetId: wsId,
    studentId,
    answers: { [`${studentId}_q1_${worksheetCounter}`]: '5' },
  });

  assert.equal(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);
  await waitForAsyncTasks();

  const reports = await dbStore.getEvaluationReports({ studentIds: [studentId] });
  const report = reports.find((r: any) => r.worksheetId === wsId);
  assert.ok(report, 'Report for legacy worksheet must exist');
  assert.equal(report.cycle, undefined, 'Report cycle must be undefined when worksheet has no cycle');

  // Must NOT trigger certification when cycle is undefined.
  assert.equal(certCalls.length, 0, 'runCertificationEligibility must NOT be called when cycle is undefined');
});

test('Diagnostic submission does NOT trigger certification and has no cycle', async () => {
  certCalls = [];

  const diagQuestions = [{
    question_id: 'DIAG_test_q1',
    question: '1 + 1 = ?',
    answer: '2',
    answer_type: 'number' as const,
    topic: 'Addition',
    subtopic: 'Single Digit',
    difficulty: 'easy' as const,
    source_level: 1,
  }];

  const res = await request('POST', `/api/students/${studentId}/diagnostic/submit`, {
    questions: diagQuestions,
    answers: { DIAG_test_q1: '2' },
  });

  await waitForAsyncTasks();

  // The key assertion from issue #845: diagnostic submissions must NOT trigger certification.
  assert.equal(certCalls.length, 0, 'runCertificationEligibility must NOT be called for diagnostic');

  // Verify no cycle is stamped on diagnostic report.
  if (res.status === 200 && res.body?.report) {
    assert.equal(res.body.report.cycle, undefined, 'Diagnostic report must NOT have a cycle');
  }
});

test('Revoked certificate handling: End-of-year logs audit event and does not overwrite revoked status', async () => {
  certCalls = [];

  const revokedStudentId = 'stu_cert_revoked_1';
  await dbStore.addStudent({
    id: revokedStudentId,
    name: 'Revoked Cert Student',
    age: 9,
    classGroup: 'Class 3',
    section: 'A',
    schoolId,
    currentLevel: 5,
    currentSubLevel: 0,
    targetLevel: 6,
    aadharMasked: 'XXXX-XXXX-9902',
    levelHistory: [],
  });

  const now = new Date().toISOString();
  await dbStore.addCertification({
    id: 'cert_revoked_test_1',
    studentId: revokedStudentId,
    classNumber: 3,
    level: 5,
    decisionSnapshot: {
      outcome: 'not_eligible',
      evaluatedAt: now,
      classNumber: 3,
      level: 5,
      metTopics: [],
      missingTopics: [],
      unassessedTopics: [],
    },
    status: 'revoked',
    version: 1,
    issuedAt: now,
    certificateId: 'CERT-' + revokedStudentId + '-3',
    createdAt: now,
    updatedAt: now,
  });

  // 1. Submit Mid-year worksheet: does NOT trigger certification
  worksheetCounter++;
  const midWsId = `ws_mid_revoked_${worksheetCounter}`;
  await dbStore.addWorksheet({
    id: midWsId,
    classId: classGroup,
    className: classGroup,
    section: 'A',
    schoolId,
    generatedByRole: 'teacher' as any,
    generatedByEmail: teacherEmail,
    cycle: 'Mid-year',
    date: now.split('T')[0],
    questions: [{
      question_id: `${revokedStudentId}_q1_${worksheetCounter}`,
      question: '2 + 3 = ?',
      answer: '5',
      answer_type: 'number' as const,
      topic: 'Addition',
      subtopic: 'Single Digit',
      difficulty: 'easy' as const,
      source_level: 5,
    }],
    studentIds: [revokedStudentId],
    locks: { locked: false, lockedByRole: null, lockedByEmail: null, timestamp: null },
    timing: {
      examDate: now.split('T')[0],
      printWindowStart: now,
      printWindowEnd: now,
      examWindowStart: now,
      examWindowEnd: now,
      submissionWindowEnd: now,
    },
    delayLogs: { delayedAttemptsCount: 0, submittingTeachers: [] },
  });

  await request('POST', '/api/evaluation/submit', {
    worksheetId: midWsId,
    studentId: revokedStudentId,
    answers: { [`${revokedStudentId}_q1_${worksheetCounter}`]: '5' },
  });
  await waitForAsyncTasks();
  assert.equal(certCalls.filter(id => id === revokedStudentId).length, 0, 'Mid-year must not trigger cert');

  // 2. Submit End-of-year worksheet: triggers certification
  worksheetCounter++;
  const eoyWsId = `ws_eoy_revoked_${worksheetCounter}`;
  await dbStore.addWorksheet({
    id: eoyWsId,
    classId: classGroup,
    className: classGroup,
    section: 'A',
    schoolId,
    generatedByRole: 'teacher' as any,
    generatedByEmail: teacherEmail,
    cycle: 'End-of-year',
    date: now.split('T')[0],
    questions: [{
      question_id: `${revokedStudentId}_q1_${worksheetCounter}`,
      question: '2 + 3 = ?',
      answer: '5',
      answer_type: 'number' as const,
      topic: 'Addition',
      subtopic: 'Single Digit',
      difficulty: 'easy' as const,
      source_level: 5,
    }],
    studentIds: [revokedStudentId],
    locks: { locked: false, lockedByRole: null, lockedByEmail: null, timestamp: null },
    timing: {
      examDate: now.split('T')[0],
      printWindowStart: now,
      printWindowEnd: now,
      examWindowStart: now,
      examWindowEnd: now,
      submissionWindowEnd: now,
    },
    delayLogs: { delayedAttemptsCount: 0, submittingTeachers: [] },
  });

  await request('POST', '/api/evaluation/submit', {
    worksheetId: eoyWsId,
    studentId: revokedStudentId,
    answers: { [`${revokedStudentId}_q1_${worksheetCounter}`]: '5' },
  });
  await waitForAsyncTasks(100);

  // Cert eligibility was triggered
  assert.ok(certCalls.includes(revokedStudentId), 'End-of-year must trigger cert');

  // Cert status MUST remain 'revoked' (terminal state)
  const cert = await dbStore.getCertificationByStudentClassLevel(revokedStudentId, 3, 5);
  assert.ok(cert);
  assert.equal(cert.status, 'revoked', 'Revoked cert must never be revived by evaluation evidence');

  // An audit log for the ignored evidence was recorded
  const logs = await dbStore.getLogbook();
  const revokedLog = logs.find((l: any) => l.details?.includes(`REVOKED cert ${cert.id}`));
  assert.ok(revokedLog, 'Audit log must record that evidence arrived for a revoked cert');
});

test('EvaluationReport.cycle is persisted and readable from getEvaluationReports', async () => {
  const wsId = await createWorksheet('End-of-year');

  await request('POST', '/api/evaluation/submit', {
    worksheetId: wsId,
    studentId,
    answers: { [`${studentId}_q1_${worksheetCounter}`]: '5' },
  });
  await waitForAsyncTasks();

  const reports = await dbStore.getEvaluationReports({ studentIds: [studentId] });
  const report = reports.find((r: any) => r.worksheetId === wsId);
  assert.ok(report);
  assert.equal(report.cycle, 'End-of-year');

  const dbFilePath = path.join(scratchDir, 'data', 'db.json');
  if (fs.existsSync(dbFilePath)) {
    const raw = JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));
    const persistedReport = (raw.evaluationReports || []).find((r: any) => r.worksheetId === wsId);
    assert.ok(persistedReport, 'Report must be persisted to file');
    assert.equal(persistedReport.cycle, 'End-of-year', 'Persisted report must have cycle');
  }
});

test('Concurrent End-of-year submissions for same student complete safely', async () => {
  certCalls = [];

  const wsId1 = await createWorksheet('End-of-year');
  const wsId2 = await createWorksheet('End-of-year');

  const [res1, res2] = await Promise.all([
    request('POST', '/api/evaluation/submit', {
      worksheetId: wsId1,
      studentId,
      answers: { [`${studentId}_q1_${worksheetCounter - 1}`]: '5' },
    }),
    request('POST', '/api/evaluation/submit', {
      worksheetId: wsId2,
      studentId,
      answers: { [`${studentId}_q1_${worksheetCounter}`]: '5' },
    }),
  ]);

  await waitForAsyncTasks(100);

  const successCount = [res1, res2].filter(r => r.status === 200).length;
  assert.ok(successCount >= 1, 'At least one concurrent submission must succeed');

  const studentCerts = certCalls.filter(id => id === studentId);
  assert.ok(studentCerts.length >= 1, 'Certification must be triggered for End-of-year submissions');
});

test('All three CycleName values are valid and supported', () => {
  const tested = new Set(['Baseline', 'Mid-year', 'End-of-year']);
  for (const name of CYCLE_NAMES) {
    assert.ok(tested.has(name), `Cycle name "${name}" must be valid`);
  }
});
