import assert from 'node:assert/strict';
import { unlink } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { basename, resolve } from 'node:path';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../src/auth.js';
import { dbStore, Student, UserRole } from '../src/db.js';
import { generateQuestionsForLevel } from '../src/levelGenerator.js';
import { registerDiagnosticBulkRoutes } from '../src/routes/diagnosticBulk.js';
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

const observedBalvatikaStudent = {
  id: 'student-balvatika-observed',
  name: 'Observed Balvatika Student',
  currentLevel: 28,
  currentSubLevel: 0,
  classGroup: 'Class 1',
  section: 'A',
  schoolId: teacher.schoolId,
} as Student;

const standardStudent = {
  id: 'student-standard',
  name: 'Standard Student',
  currentLevel: 1,
  currentSubLevel: 0,
  classGroup: 'Class 1',
  section: 'A',
  schoolId: teacher.schoolId,
} as Student;

function fixedQuestionTemplates(
  mode: 'written' | 'observed' | 'both',
  conceptId = 'S3.1',
) {
  return Array.from({ length: 4 }, (_, index) => ({
    id: `qtpl_${conceptId.replace('.', '_').toLowerCase()}_${index + 1}`,
    conceptId,
    assessmentMode: mode,
    status: 'approved',
    deletedAt: null,
    stem: `Identify numeral ${index + 1}.`,
    answerSpec: String(index + 1),
    svgThemeIds: [],
    name: `Numeral recognition ${index + 1}`,
    questionFamily: 'numeral-recognition',
  }));
}

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
  // Keep the level 19 student observation-only while level 1 retains its
  // unchanged legacy question objects.
  stub('getQuestionTemplates', async () => [{
    conceptId: 'S3.1',
    assessmentMode: 'observed',
  }]);
  stub('getQuestionTemplatesByConcept', async () => []);
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
      reason: 'No printable question is available for this Balvatika level.',
    }]);

    const expectedStandardQuestions = (await generateQuestionsForLevel(
      standardStudent.currentLevel,
      standardStudent.currentSubLevel || 0,
    )).map(question => ({
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

test('Balvatika worksheet route prints written and both questions, never observed', async (t) => {
  const cases = [
    { mode: 'observed', expectedStatus: 400, expectedQuestionCount: 0 },
    { mode: 'written', expectedStatus: 200, expectedQuestionCount: 4 },
    { mode: 'both', expectedStatus: 200, expectedQuestionCount: 4 },
  ] as const;

  for (const testCase of cases) {
    await t.test(testCase.mode, async () => {
      const app = express();
      app.use(express.json());
      registerWorksheetRoutes(app);

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
      stub('getStudents', async () => [balvatikaStudent]);
      stub('getQuestionTemplates', async () => [{
        conceptId: 'S3.1',
        assessmentMode: testCase.mode,
      }]);
      stub('getQuestionTemplatesByConcept', async () => fixedQuestionTemplates(testCase.mode));
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
        const response = await fetch(`http://127.0.0.1:${port}/api/worksheets/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ classId: 'class-route-test', cycle: 'Baseline' }),
        });
        const body = await response.json() as any;

        assert.equal(response.status, testCase.expectedStatus, JSON.stringify(body));
        assert.equal(storedWorksheets.length, testCase.expectedStatus === 200 ? 1 : 0);
        if (testCase.expectedStatus === 200) {
          assert.equal(body.questions.length, testCase.expectedQuestionCount);
          assert.equal(storedWorksheets[0].questions.length, testCase.expectedQuestionCount);
        }
      } finally {
        await new Promise<void>(resolve => server.close(() => resolve()));
        for (const [name, implementation] of originals) {
          (dbStore as any)[name] = implementation;
        }
      }
    });
  }
});

test('mixed Balvatika routes print written questions and skip observed-only levels', async () => {
  const app = express();
  app.use(express.json());
  registerDiagnosticBulkRoutes(app);
  registerWorksheetRoutes(app);

  const students = [balvatikaStudent, observedBalvatikaStudent];
  const assignedStudentIds: string[] = [];
  const outputUrls = new Set<string>();
  const originals = new Map<string, unknown>();
  const stub = (name: string, implementation: unknown) => {
    originals.set(name, (dbStore as any)[name]);
    (dbStore as any)[name] = implementation;
  };
  let markDiagnosticFinished!: () => void;
  const diagnosticFinished = new Promise<void>(resolve => {
    markDiagnosticFinished = resolve;
  });

  stub('getUserSync', () => teacher);
  stub('getStudents', async () => students);
  stub('getQuestionTemplates', async () => [
    { conceptId: 'S3.1', assessmentMode: 'written' },
    { conceptId: 'S3.11', assessmentMode: 'observed' },
  ]);
  stub('getQuestionTemplatesByConcept', async (conceptId: string) => {
    if (conceptId === 'S3.1') return fixedQuestionTemplates('written', conceptId);
    if (conceptId === 'S3.11') return fixedQuestionTemplates('observed', conceptId);
    return [];
  });
  stub('getStudentCycleLocks', async () => []);
  stub('addStudentCycleLock', async (lock: any) => lock);
  stub('getClasses', async () => [{
    id: 'class-route-test',
    className: 'Class 1',
    section: 'A',
    schoolId: teacher.schoolId,
    teacherId: teacher.id,
  }]);
  stub('assignDiagnosticPaperToStudent', async (studentId: string) => {
    assignedStudentIds.push(studentId);
  });
  stub('addWorksheet', async (worksheet: any) => worksheet);
  stub('addTestHistoryEntry', async (entry: any) => entry);
  stub('addLog', async (entry: any) => {
    markDiagnosticFinished();
    return entry;
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const token = jwt.sign({ email: teacher.email }, JWT_SECRET, { expiresIn: '1h' });
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  try {
    const diagnosticStart = Date.now();
    const diagnosticResponse = await fetch(`${baseUrl}/api/diagnostic/bulk`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(1_000),
      body: JSON.stringify({
        classNumber: 1,
        students: students.map(student => ({
          name: student.name,
          studentId: student.id,
        })),
      }),
    });
    const diagnosticElapsed = Date.now() - diagnosticStart;
    const diagnosticBody = await diagnosticResponse.json() as any;

    assert.equal(diagnosticResponse.status, 202, JSON.stringify(diagnosticBody));
    assert.ok(diagnosticElapsed < 1_000, `diagnostic bulk took ${diagnosticElapsed}ms`);
    assert.equal(diagnosticBody.totalStudents, 1);
    assert.deepEqual(
      diagnosticBody.skippedStudents.map((student: any) => student.studentId),
      [observedBalvatikaStudent.id],
    );
    assert.doesNotMatch(JSON.stringify(diagnosticBody), /NoApprovedContentError|No question generator or authored template/i);

    let progressBody: any = null;
    const progressDeadline = Date.now() + 5_000;
    while (Date.now() < progressDeadline) {
      const progressResponse = await fetch(`${baseUrl}${diagnosticBody.progressUrl}`);
      progressBody = await progressResponse.json();
      if (progressBody.status === 'completed' || progressBody.status === 'failed') break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(progressBody?.status, 'completed', JSON.stringify(progressBody));
    assert.doesNotMatch(JSON.stringify(progressBody), /NoApprovedContentError|No question generator or authored template/i);
    assert.ok(assignedStudentIds.includes(balvatikaStudent.id));
    assert.ok(!assignedStudentIds.includes(observedBalvatikaStudent.id));
    if (progressBody.pdfUrl) outputUrls.add(progressBody.pdfUrl);
    await Promise.race([
      diagnosticFinished,
      new Promise((_, reject) => setTimeout(() => reject(new Error('diagnostic persistence timed out')), 5_000)),
    ]);

    const batchStart = Date.now();
    const batchResponse = await fetch(`${baseUrl}/api/worksheets/generate-level-batch`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(1_000),
      body: JSON.stringify({ studentIds: students.map(student => student.id) }),
    });
    const batchElapsed = Date.now() - batchStart;
    const batchBody = await batchResponse.json() as any;

    assert.equal(batchResponse.status, 200, JSON.stringify(batchBody));
    assert.ok(batchElapsed < 1_000, `level batch took ${batchElapsed}ms`);
    assert.equal(batchBody.studentsProcessed, 1);
    assert.deepEqual(
      batchBody.results.map((result: any) => result.studentId),
      [balvatikaStudent.id],
    );
    assert.deepEqual(
      batchBody.skippedStudents.map((student: any) => student.studentId),
      [observedBalvatikaStudent.id],
    );
    assert.doesNotMatch(JSON.stringify(batchBody), /NoApprovedContentError|No question generator or authored template/i);
    for (const result of batchBody.results) outputUrls.add(result.pdfUrl);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    for (const [name, implementation] of originals) {
      (dbStore as any)[name] = implementation;
    }
    await Promise.allSettled(
      Array.from(outputUrls, pdfUrl => unlink(resolve('output', basename(pdfUrl)))),
    );
  }
});
