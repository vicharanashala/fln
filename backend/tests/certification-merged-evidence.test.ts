import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Certification evidence is merged across a student's reports (most recent
// verdict per topic) instead of read from the single latest report. Drives the
// real diagnostic-submit and worksheet-evaluation routes, then reads the
// outcome through GET /api/certifications.

// Keep the file-backed DB isolated from backend/data/db.json and import the
// singleton only after the environment and working directory are configured.
const originalCwd = process.cwd();
const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-cert-evidence-test-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);
delete process.env.MONGODB_URI;
delete process.env.GEMINI_API_KEY; // worksheet grading uses its deterministic fallback
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'cert-evidence-test-secret';
process.env.SEED_DEMO_PASSWORD = 'TestPass@123';

const { dbStore } = await import('../src/db');
const { JWT_SECRET } = await import('../src/auth');
const { registerStudentRoutes } = await import('../src/routes/students');
const { registerEvaluationRoutes } = await import('../src/routes/evaluation');
const { registerCertificationRoutes } = await import('../src/routes/certification');
const { generateQuestionsForLevel } = await import('../src/levelGenerator');
const express = (await import('express')).default;
const jwt = (await import('jsonwebtoken')).default;

await dbStore.init();

const app = express();
app.use(express.json());
registerStudentRoutes(app);
registerEvaluationRoutes(app);
registerCertificationRoutes(app);
const server: http.Server = await new Promise(resolve => {
  const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
});
const baseUrl = `http://127.0.0.1:${(server.address() as import('net').AddressInfo).port}`;
// Seeded Class 2 teacher (u6) and one of their Class 2 students (s1).
const token = jwt.sign({ email: 'gps-mt-001.t01@fln.org' }, JWT_SECRET, { expiresIn: '1h' });
const studentId = 's1';

after(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  process.chdir(originalCwd);
  fs.rmSync(scratchDir, { recursive: true, force: true });
});

async function post(route: string, body: unknown) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() as any };
}

async function certifications() {
  const response = await fetch(`${baseUrl}/api/certifications?studentId=${studentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 200);
  return await response.json() as any[];
}

// Certification runs fire-and-forget after each report, so wait for it.
async function waitFor<T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> {
  const deadline = Date.now() + 5000;
  let value = await read();
  while (!done(value) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 50));
    value = await read();
  }
  return value;
}

// A worksheet as POST /api/worksheets/generate builds it: generator questions,
// ids prefixed with the student's id. Level 74 is Class 2's only Patterns level.
async function addPatternsWorksheet(id: string) {
  const questions = generateQuestionsForLevel(74, 0).map((q: any) => ({ ...q, question_id: `${studentId}_${q.question_id}` }));
  await dbStore.addWorksheet({
    id, classId: 'c1', className: 'Class 2', section: 'A', schoolId: 'gps-mt-001',
    generatedByRole: 'teacher', generatedByEmail: 'gps-mt-001.t01@fln.org',
    cycle: 'Baseline', date: new Date().toISOString().split('T')[0],
    questions,
    timing: { submissionWindowEnd: new Date(Date.now() + 3600_000).toISOString() },
  } as any);
  return questions;
}

// Class 2 diagnostic, levels 60-69: Shapes & Spatial, Number Sense, Number
// Operations and Fractions. Class 2 also requires Patterns (level 74), which a
// ten-question paper never reaches.
const diagnosticQuestions = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69].map(level => ({
  question_id: `Q${level}_1`, question: `Level ${level} question`, answer: String(level),
  answer_type: 'number', topic: 'Diagnostic', subtopic: 'Diagnostic', difficulty: 'medium', source_level: level,
}));

test('a graded worksheet no longer erases the diagnostic evidence, and topics across reports reach eligible', async () => {
  // 1. Diagnostic, all correct: every required topic except Patterns.
  const diagnostic = await post(`/api/students/${studentId}/diagnostic/submit`, {
    questions: diagnosticQuestions,
    answers: Object.fromEntries(diagnosticQuestions.map(q => [q.question_id, q.answer])),
  });
  assert.equal(diagnostic.status, 200);
  for (const topic of ['Number Sense', 'Number Operations', 'Shapes & Spatial']) {
    assert.equal(diagnostic.body.report.conceptMastery[topic], 'Strong', topic);
  }
  assert.equal(diagnostic.body.report.conceptMastery['Patterns'], undefined);
  await new Promise(resolve => setTimeout(resolve, 300)); // let the certification run settle
  assert.equal((await certifications()).length, 0, 'Patterns unassessed: not eligible yet');

  // 2. A Patterns worksheet graded later. Its report holds only Patterns.
  const worksheetQuestions = await addPatternsWorksheet('WS_PATTERNS_1');
  const graded = await post('/api/evaluation/submit', {
    worksheetId: 'WS_PATTERNS_1', studentId,
    answers: Object.fromEntries(worksheetQuestions.map(q => [q.question_id, q.answer])),
  });
  assert.equal(graded.status, 200);
  assert.deepEqual(Object.keys(graded.body.report.conceptMastery), ['Patterns']);

  // The diagnostic's topics survive the newer worksheet report.
  const merged = await dbStore.getMergedConceptMastery(studentId);
  for (const topic of ['Number Sense', 'Number Operations', 'Shapes & Spatial', 'Patterns']) {
    assert.equal(merged?.[topic], 'Strong', topic);
  }

  // With evidence from both reports, the student is now eligible.
  const certs = await waitFor(certifications, list => list.length > 0);
  assert.equal(certs.length, 1);
  assert.equal(certs[0].status, 'active');
  assert.equal(certs[0].decisionSnapshot.outcome, 'eligible');
  assert.deepEqual(
    [...certs[0].decisionSnapshot.metTopics].sort(),
    ['Number Operations', 'Number Sense', 'Patterns', 'Shapes & Spatial']
  );
});

test('the most recent assessment of a topic wins over an older one', async () => {
  // A later Patterns worksheet, all wrong, supersedes the earlier Strong.
  const worksheetQuestions = await addPatternsWorksheet('WS_PATTERNS_2');
  const graded = await post('/api/evaluation/submit', {
    worksheetId: 'WS_PATTERNS_2', studentId,
    answers: Object.fromEntries(worksheetQuestions.map(q => [q.question_id, '999'])),
  });
  assert.equal(graded.status, 200);

  const merged = await dbStore.getMergedConceptMastery(studentId);
  assert.equal(merged?.['Patterns'], 'Needs Practice');
  assert.equal(merged?.['Number Sense'], 'Strong', 'other topics still come from the diagnostic');

  // The active certificate is flagged for review rather than kept silently.
  const certs = await waitFor(certifications, list => list[0]?.status !== 'active');
  assert.equal(certs[0].status, 'review_needed');
});
