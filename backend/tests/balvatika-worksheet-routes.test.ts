import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import express from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../src/auth.js';
import { dbStore, Student, UserRole } from '../src/db.js';
import { generateQuestionsForLevel } from '../src/levelGenerator.js';
import { registerWorksheetRoutes } from '../src/routes/worksheets.js';

const teacher = {
  id: 'teacher-route-test',
  email: 'teacher-route-test@fln.org',
  name: 'Route Test Teacher',
  role: UserRole.TEACHER,
  schoolId: 'school-route-test',
  isBanned: false,
};

const balvatikaStudent = {
  id: 'student-balvatika',
  name: 'Balvatika Student',
  currentLevel: 19,
  currentSubLevel: 0,
  classGroup: 'Class 1',
  section: 'A',
  schoolId: teacher.schoolId,
} as Student;

const standardStudent = {
  id: 'student-standard',
  name: 'Standard Student',
  currentLevel: 59,
  currentSubLevel: 0,
  classGroup: 'Class 1',
  section: 'A',
  schoolId: teacher.schoolId,
} as Student;

const now = Date.now();
const generationWindow = {
  id: 'window-route-test',
  classId: 'class-route-test',
  cycle: 'Baseline' as const,
  schoolId: teacher.schoolId,
  start: new Date(now - 60_000).toISOString(),
  teacherPriorityEnd: new Date(now + 60 * 60_000).toISOString(),
  end: new Date(now + 2 * 60 * 60_000).toISOString(),
  generatedByRole: null,
  generatedByEmail: null,
  closed: false,
};

test('worksheet route skips empty Balvatika papers without changing a standard paper', async () => {
  const app = express();
  app.use(express.json());
  registerWorksheetRoutes(app);

  let currentStudents: Student[] = [balvatikaStudent, standardStudent];
  const storedWorksheets: any[] = [];
  const originals = new Map<string, unknown>();
  const stub = (name: string, implementation: unknown) => {
    originals.set(name, (dbStore as any)[name]);
    (dbStore as any)[name] = implementation;
  };

  stub('getUserSync', () => teacher);
  stub('getClasses', async () => [{
    id: 'class-route-test',
    className: 'Class 1',
    section: 'A',
    schoolId: teacher.schoolId,
    teacherId: teacher.id,
  }]);
  stub('getSchools', async () => [{
    id: teacher.schoolId,
    name: 'Route Test School',
    strength: 'high',
    isAccessLocked: false,
  }]);
  stub('getGenerationWindows', async () => [generationWindow]);
  stub('getWorksheets', async () => []);
  stub('getStudents', async () => currentStudents);
  // No authored mode means legacy "written". Level 19 is therefore empty after
  // the Balvatika gate, while level 40 must keep its legacy question objects.
  stub('getQuestionTemplates', async () => []);
  stub('addWorksheet', async (worksheet: any) => {
    storedWorksheets.push(worksheet);
    return worksheet;
  });
  stub('updateGenerationWindow', async () => generationWindow);
  stub('addLog', async (entry: any) => entry);

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const port = (server.address() as AddressInfo).port;
  const token = jwt.sign({ email: teacher.email }, JWT_SECRET, { expiresIn: '1h' });

  try {
    const mixedResponse = await fetch(`http://127.0.0.1:${port}/api/worksheets/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ classId: 'class-route-test', cycle: 'Baseline' }),
    });
    const mixedBody = await mixedResponse.json() as any;

    assert.equal(mixedResponse.status, 200, JSON.stringify(mixedBody));
    assert.deepEqual(mixedBody.skippedStudents, [{
      studentId: balvatikaStudent.id,
      studentName: balvatikaStudent.name,
      level: balvatikaStudent.currentLevel,
      reason: 'No observed or both-mode question is available for this Balvatika level.',
    }]);

    const expectedStandardQuestions = generateQuestionsForLevel(
      standardStudent.currentLevel,
      standardStudent.currentSubLevel || 0,
    ).map(question => ({
      ...question,
      question_id: `${standardStudent.id}_${question.question_id}`,
      question: `[For ${standardStudent.name} - L${standardStudent.currentLevel}.${standardStudent.currentSubLevel || 0}] ${question.question}`,
    }));

    assert.deepEqual(
      mixedBody.questions,
      JSON.parse(JSON.stringify(expectedStandardQuestions)),
      'the serialized non-Balvatika paper must keep its legacy question shape',
    );
    assert.deepEqual(storedWorksheets[0].questions, expectedStandardQuestions);

    currentStudents = [balvatikaStudent];
    const emptyResponse = await fetch(`http://127.0.0.1:${port}/api/worksheets/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ classId: 'class-route-test', cycle: 'Baseline' }),
    });
    const emptyBody = await emptyResponse.json() as any;

    assert.equal(emptyResponse.status, 400);
    assert.match(emptyBody.error, /No worksheet generated/);
    assert.equal(emptyBody.skippedStudents[0].studentName, balvatikaStudent.name);
    assert.equal(emptyBody.skippedStudents[0].level, balvatikaStudent.currentLevel);
    assert.equal(storedWorksheets.length, 1, 'an empty worksheet must not be persisted');
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    for (const [name, implementation] of originals) {
      (dbStore as any)[name] = implementation;
    }
  }
});
