import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Regression test for #577: conceptMastery must come from how the student did
// in each strand, not from comparing their level against fixed thresholds.
// Calls the real POST /api/students/:id/diagnostic/submit route.

// Keep the file-backed DB isolated from backend/data/db.json and import the
// singleton only after the environment and working directory are configured.
const originalCwd = process.cwd();
const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-concept-mastery-test-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);
delete process.env.MONGODB_URI;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'concept-mastery-test-secret';
process.env.SEED_DEMO_PASSWORD = 'TestPass@123';

const { dbStore } = await import('../src/db');
const { JWT_SECRET } = await import('../src/auth');
const { registerStudentRoutes } = await import('../src/routes/students');
const express = (await import('express')).default;
const jwt = (await import('jsonwebtoken')).default;

await dbStore.init();

const app = express();
app.use(express.json());
registerStudentRoutes(app);
const server: http.Server = await new Promise(resolve => {
  const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
});
const baseUrl = `http://127.0.0.1:${(server.address() as import('net').AddressInfo).port}`;
// Seeded Class 2 teacher (u6) and one of their Class 2 students (s1).
const teacherEmail = 'gps-mt-001.t01@fln.org';
const studentId = 's1';
const token = jwt.sign({ email: teacherEmail }, JWT_SECRET, { expiresIn: '1h' });

after(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  process.chdir(originalCwd);
  fs.rmSync(scratchDir, { recursive: true, force: true });
});

// A Class 2 paper, one question per level 60-69. Strands (curriculumMap.ts):
// 60 Shapes & Spatial; 61-63 Number Sense; 64-68 Number Operations; 69 Fractions.
const question = (level: number, conceptId: string, topic: string, answer: string) => ({
  question_id: `Q${level}_1`,
  question: `Level ${level} question`,
  answer,
  answer_type: 'number',
  topic,
  subtopic: topic,
  difficulty: 'medium',
  source_level: level,
  conceptId,
});
const questions = [
  question(60, 'S4.15', 'Shapes & Spatial', '4'),
  question(61, 'S5.1', 'Number Sense', '345'),
  question(62, 'S5.2', 'Number Sense', '10'),
  question(63, 'S5.3', 'Number Sense', '25'),
  question(64, 'S5.4', 'Number Operations', '50'),
  question(65, 'S5.5', 'Number Operations', '15'),
  question(66, 'S5.6', 'Number Operations', '12'),
  question(67, 'S5.7', 'Number Operations', '4'),
  question(68, 'S5.8', 'Number Operations', '20'),
  question(69, 'S5.10', 'Fractions', '1/2'),
];

test('diagnostic conceptMastery reflects per-strand performance, not the placement level (#577)', async () => {
  // 8 wrong, 2 right: Shapes & Spatial 0/1, Number Sense 0/3,
  // Number Operations 1/5 (20%), Fractions 1/1 (100%).
  const right = new Set(['Q67_1', 'Q69_1']);
  const answers = Object.fromEntries(
    questions.map(q => [q.question_id, right.has(q.question_id) ? q.answer : '999'])
  );

  const response = await fetch(`${baseUrl}/api/students/${studentId}/diagnostic/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ questions, answers }),
  });
  assert.equal(response.status, 200);
  const body = await response.json() as any;

  assert.equal(body.report.score, 2);
  assert.equal(body.report.conceptMastery['Shapes & Spatial'], 'Needs Practice');
  assert.equal(body.report.conceptMastery['Number Sense'], 'Needs Practice');
  assert.equal(body.report.conceptMastery['Number Operations'], 'Needs Practice');
  assert.equal(body.report.conceptMastery['Fractions'], 'Strong');
});
