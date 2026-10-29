import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import jwt from 'jsonwebtoken';
import { PDFDocument } from 'pdf-lib';
import { dbStore, DBStore, UserRole, type Question, type ScanPaperTemplate } from '../src/db';
import { JWT_SECRET } from '../src/auth';
import { registerScanRoutes } from '../src/routes/scan';
import { generateScanTemplatePaper } from '../src/scanTemplatePaper';

const questions: Question[] = Array.from({ length: 4 }, (_, index) => ({
  question_id: `merge_q_${index}`, question: `${index} + 1 = ?`,
  answer: String(index + 1), answer_type: 'number', question_format: 'text',
  topic: 'Addition', subtopic: 'Addition', difficulty: 'easy', source_level: 1,
}));

test('scan PDF and stored templates retain separate student identities and answer regions', async () => {
  const outputDir = await mkdtemp(path.join(tmpdir(), 'fln-merge-scan-'));
  try {
    const result = await generateScanTemplatePaper({ classNumber: 2, outputDir,
      students: ['student-a', 'student-b'].map(studentId => ({ studentId, name: studentId, questions })) });
    const pdf = await PDFDocument.load(await readFile(result.filePath));
    assert.equal(pdf.getPageCount(), 2);
    assert.equal(result.paperTemplates.length, 2);
    for (const template of result.paperTemplates) {
      assert.ok(template.qrPayload.includes(template.studentId));
      assert.equal(template.questions.length, questions.length);
      assert.deepEqual(template.questions.map(q => q.answerKey), questions.map(q => q.answer));
      assert.ok(template.questions.every(q => q.answerBoxes.length > 0));
    }
    assert.notEqual(result.paperTemplates[0].paperId, result.paperTemplates[1].paperId);
    assert.ok(JSON.parse(await readFile(result.templatePath, 'utf8')));
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test('retained scan endpoints enforce upstream authentication, school scope and QR identity', async t => {
  const student = { id: 'student-a', name: 'A', schoolId: 'school-a', currentLevel: 1 };
  const template = { paperId: 'paper-a', testId: 'test-a', studentId: student.id,
    pageNumber: 1, questions: [], page: { width: 595, height: 842 } } as unknown as ScanPaperTemplate;
  t.mock.method(dbStore, 'getStudents', async () => [student]);
  t.mock.method(dbStore, 'getScanPaperTemplate', async () => template);
  t.mock.method(dbStore, 'getUserSync', (email: string) => ({
    id: email, email, name: email, role: UserRole.TEACHER,
    schoolId: email === 'own@example.test' ? 'school-a' : 'school-b',
  }));
  const app = express();
  app.use(express.json());
  registerScanRoutes(app);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as { port: number };
  const send = (email?: string, qrText = 'student-a|paper-a|test-a|1') => fetch(
    `http://127.0.0.1:${address.port}/api/ocr/scan/template`, {
      method: 'POST', headers: { 'Content-Type': 'application/json',
        ...(email ? { Authorization: `Bearer ${jwt.sign({ email }, JWT_SECRET)}` } : {}) },
      body: JSON.stringify({ qrText }),
    });
  try {
    assert.equal((await send()).status, 401);
    assert.equal((await send('other@example.test')).status, 403);
    assert.equal((await send('own@example.test', 'student-a|paper-a|wrong-test|1')).status, 409);
    const allowed = await send('own@example.test');
    assert.equal(allowed.status, 200);
    assert.equal((await allowed.json()).student.id, student.id);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});

test('Mongo scan templates use per-paper page upserts and read the same collection', async () => {
  const rows = new Map<string, any>();
  const collection = {
    async updateOne(filter: any, update: any, options: any) {
      assert.equal(options.upsert, true);
      rows.set(`${filter.paperId}:${filter.pageNumber}`, update.$set);
    },
    async findOne(filter: any) { return rows.get(`${filter.paperId}:${filter.pageNumber}`) || null; },
    find() { return { async toArray() { return [...rows.values()]; } }; },
  };
  const store = new DBStore();
  (store as any).mongoDb = { collection(name: string) { assert.equal(name, 'scanPaperTemplates'); return collection; } };
  await store.upsertScanPaperTemplates([{ paperId: 'p', pageNumber: 1, studentId: 'a' },
    { paperId: 'p', pageNumber: 2, studentId: 'a' }] as ScanPaperTemplate[]);
  await store.upsertScanPaperTemplates([{ paperId: 'p', pageNumber: 1, studentId: 'b' }] as ScanPaperTemplate[]);
  assert.equal((await store.getScanPaperTemplates()).length, 2);
  assert.equal((await store.getScanPaperTemplate('p', 1))?.studentId, 'b');
  assert.equal((await store.getScanPaperTemplate('p', 2))?.studentId, 'a');
});
