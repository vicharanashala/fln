import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import express from 'express';
import jwt from 'jsonwebtoken';
import { PDFDocument } from 'pdf-lib';
import { registerEvaluationRoutes } from '../src/routes/evaluation.js';
import { dbStore, UserRole } from '../src/db.js';
import { JWT_SECRET } from '../src/auth.js';

const app = express();
app.use(express.json({ limit: '100mb' }));
registerEvaluationRoutes(app);

const server = app.listen(0, '127.0.0.1');
let baseUrl: string;

const origApiKey = process.env.OLLAMA_API_KEY;
const origApiUrl = process.env.OLLAMA_API_URL;

before(async () => {
  // Point OCR text-reading step at an address where nothing is listening so no external service is called (#746)
  process.env.OLLAMA_API_KEY = 'placeholder-test-key';
  process.env.OLLAMA_API_URL = 'http://127.0.0.1:49999';

  await new Promise<void>(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await dbStore.init();

  // Stub setConfig if not using MongoDB
  dbStore.setConfig = async () => {};

  await dbStore.addUser({
    id: 'test-teacher',
    email: 'teacher@fln.org',
    name: 'School Teacher',
    role: UserRole.TEACHER,
  });
});

after(async () => {
  if (origApiKey !== undefined) {
    process.env.OLLAMA_API_KEY = origApiKey;
  } else {
    delete process.env.OLLAMA_API_KEY;
  }

  if (origApiUrl !== undefined) {
    process.env.OLLAMA_API_URL = origApiUrl;
  } else {
    delete process.env.OLLAMA_API_URL;
  }

  await new Promise<void>(resolve => server.close(() => resolve()));
});

function tokenFor(email: string) {
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: '1h' });
}

async function createSamplePdfDataUrl(pageCount: number): Promise<string> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([200, 200]);
  }
  const bytes = await doc.save();
  return `data:application/pdf;base64,${Buffer.from(bytes).toString('base64')}`;
}

test('a PDF of 9 pages, with no pagesPerStudent, gives 3 children and no warning', async () => {
  const pdfDataUrl = await createSamplePdfDataUrl(9);
  const res = await fetch(`${baseUrl}/api/icr/evaluate-bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenFor('teacher@fln.org')}`,
    },
    body: JSON.stringify({
      provider: 'ollama-gemma4',
      fileDataUrl: pdfDataUrl,
    }),
  });

  const json = (await res.json()) as any;
  assert.equal(res.status, 200);
  assert.equal(json.totalPages, 9);
  assert.equal(json.pagesPerStudent, 3);
  assert.equal(json.totalStudents, 3);
  assert.equal(json.pageCountWarning, undefined);
});

test('a PDF of 7 pages, with pagesPerStudent: 3, gives a pageCountWarning that says the last student gets 1 page', async () => {
  const pdfDataUrl = await createSamplePdfDataUrl(7);
  const res = await fetch(`${baseUrl}/api/icr/evaluate-bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenFor('teacher@fln.org')}`,
    },
    body: JSON.stringify({
      provider: 'ollama-gemma4',
      fileDataUrl: pdfDataUrl,
      pagesPerStudent: 3,
    }),
  });

  const json = (await res.json()) as any;
  assert.equal(res.status, 200);
  assert.equal(json.totalPages, 7);
  assert.equal(json.pagesPerStudent, 3);
  assert.equal(json.totalStudents, 3);
  assert.equal(typeof json.pageCountWarning, 'string');
  assert.match(json.pageCountWarning, /last student gets 1 page/);
});

test('a PDF that cannot be read gives a 400 and does not hang', async () => {
  const corruptDataUrl = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4 corrupt header and no page tree').toString('base64');
  const res = await fetch(`${baseUrl}/api/icr/evaluate-bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenFor('teacher@fln.org')}`,
    },
    body: JSON.stringify({
      provider: 'ollama-gemma4',
      fileDataUrl: corruptDataUrl,
    }),
  });

  const json = (await res.json()) as any;
  assert.equal(res.status, 400);
  assert.ok(json.error);
  // The teacher sees a plain sentence, never the internal reason.
  assert.match(json.error, /could not be read/);
  assert.doesNotMatch(json.error, /undefined|Cannot read|reading '/);
});

async function bulkWarning(pageCount: number, pagesPerStudent?: number): Promise<string | undefined> {
  const res = await fetch(`${baseUrl}/api/icr/evaluate-bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor('teacher@fln.org')}` },
    body: JSON.stringify({ provider: 'ollama-gemma4', fileDataUrl: await createSamplePdfDataUrl(pageCount), pagesPerStudent }),
  });
  assert.equal(res.status, 200);
  return ((await res.json()) as any).pageCountWarning;
}

test('the page-count warning uses the singular for one page and the plural for more', async () => {
  assert.equal(
    await bulkWarning(1, 3),
    '1 page does not divide evenly into 3-page papers; the last student gets 1 page. Check "Pages Per Student".',
  );
  assert.equal(
    await bulkWarning(5, 3),
    '5 pages do not divide evenly into 3-page papers; the last student gets 2 pages. Check "Pages Per Student".',
  );
  assert.equal(
    await bulkWarning(7, 3),
    '7 pages do not divide evenly into 3-page papers; the last student gets 1 page. Check "Pages Per Student".',
  );
});

test('pagesPerStudent: 2 on 9 pages gives 5 children and the warning', async () => {
  const pdfDataUrl = await createSamplePdfDataUrl(9);
  const res = await fetch(`${baseUrl}/api/icr/evaluate-bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenFor('teacher@fln.org')}`,
    },
    body: JSON.stringify({
      provider: 'ollama-gemma4',
      fileDataUrl: pdfDataUrl,
      pagesPerStudent: 2,
    }),
  });

  const json = (await res.json()) as any;
  assert.equal(res.status, 200);
  assert.equal(json.totalPages, 9);
  assert.equal(json.pagesPerStudent, 2);
  assert.equal(json.totalStudents, 5);
  assert.equal(typeof json.pageCountWarning, 'string');
  assert.match(json.pageCountWarning, /last student gets 1 page/);
});
