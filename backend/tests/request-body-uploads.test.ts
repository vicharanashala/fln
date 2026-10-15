import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import jwt from 'jsonwebtoken';
import { PNG } from 'pngjs';
import { registerRequestBodyParsers } from '../src/requestBodyParsers';

// Real routes/auth/persistence, isolated from developer data and credentials.
// Only the vault and external OCR provider are controlled test implementations;
// these checks do not establish live OCR accuracy or production vault readiness.
const originalCwd = process.cwd();
const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-body-uploads-'));
fs.mkdirSync(path.join(scratchDir, 'data'));
process.chdir(scratchDir);
delete process.env.MONGODB_URI;
delete process.env.LOCAL_DEV_MASTER_KEY;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.SEED_DEMO_PASSWORD = randomBytes(24).toString('hex');
process.env.OLLAMA_API_KEY = 'local-test-provider-only';
process.env['ICR_CLOUD_API_KEY_OLLAMA-GEMMA4'] = 'local-test-provider-only';

const { dbStore } = await import('../src/db');
const { JWT_SECRET } = await import('../src/auth');
const { registerStudentRoutes } = await import('../src/routes/students');
const { registerEvaluationRoutes } = await import('../src/routes/evaluation');
const { __setTokenizeAadhaarImpl } = await import('../src/aadhaarVault');

const servers: Server[] = [];
let base: string;
let vaultCalls = 0;
const receivedImages: string[] = [];
const authorization = `Bearer ${jwt.sign({ email: 'gps-mt-001.t01@fln.org' }, JWT_SECRET, { expiresIn: '10m' })}`;

async function listen(app: express.Express) {
  const server = await new Promise<Server>(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

// An actual PNG whose encoded upload exceeds the ordinary 1 MiB limit.
const png = new PNG({ width: 600, height: 800 });
png.data = randomBytes(png.width * png.height * 4);
for (let i = 3; i < png.data.length; i += 4) png.data[i] = 255;
const imageBase64 = PNG.sync.write(png).toString('base64');
const imageDataUrl = `data:image/png;base64,${imageBase64}`;

before(async () => {
  __setTokenizeAadhaarImpl(async (raw, ctx) => {
    vaultCalls += 1;
    return {
      token: randomUUID(), last4: raw.slice(-4), tokenType: 'AADHAAR',
      identityId: randomUUID(), auditId: ctx.requestId ?? 'test-audit', keyVersion: 'test-v1',
    };
  });
  await dbStore.init();
  const provider = express();
  provider.use(express.json({ limit: '100mb' }));
  provider.post('/api/chat', (req, res) => {
    receivedImages.push(...(req.body.messages?.[0]?.images ?? []));
    res.json({ message: { content: JSON.stringify({ row_1: { question: '1 + 1', answer: '2' } }) } });
  });
  process.env.OLLAMA_API_URL = `${await listen(provider)}/api/chat`;
  const app = express();
  registerRequestBodyParsers(app);
  registerStudentRoutes(app);
  registerEvaluationRoutes(app);
  base = await listen(app);
});

after(async () => {
  __setTokenizeAadhaarImpl(null);
  for (const server of servers) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  process.chdir(originalCwd);
  // Only remove the unique temporary directory created by this test.
  assert.equal(path.dirname(scratchDir), path.resolve(os.tmpdir()));
  assert.ok(path.basename(scratchDir).startsWith('fln-body-uploads-'));
  fs.rmSync(scratchDir, { recursive: true, force: true });
});

async function post(route: string, payload: unknown, authenticated = true) {
  const body = JSON.stringify(payload);
  assert.ok(Buffer.byteLength(body) > 1024 * 1024, 'must exercise the upload allowance');
  const response = await fetch(`${base}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: authorization } : {}) },
    body,
  });
  return { status: response.status, body: await response.json() };
}

test('authenticated bulk import above 1 MiB creates a student using the vault contract', async () => {
  // Synthetic identity only. Padding exercises the parser without generating
  // thousands of unnecessary student records or oversized domain fields.
  const result = await post('/api/students/bulk-import', {
    rows: [{ name: 'Body limit test student', classGroup: 'Class 1', section: 'A', age: 7, aadharNumber: '111122223333' }],
    padding: 'x'.repeat(5 * 1024 * 1024),
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.created, 1);
  assert.equal(result.body.failed, 0);
  assert.equal(vaultCalls, 1);
  const student = (await dbStore.getStudents({ schoolId: 'gps-mt-001' })).find(s => s.name === 'Body limit test student');
  assert.ok(student);
  assert.ok(student.aadhaarTokenId);
  assert.ok(!JSON.stringify(student).includes('111122223333'));
});

test('authenticated scan-quality route decodes an image upload above 1 MiB', async () => {
  const result = await post('/api/icr/check-quality', { imageDataUrl, mimeType: 'image/png' });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.notEqual(result.body.qualityResult.status, 'reject');
});

test('authenticated OCR route forwards the full image and parses the local provider response', async () => {
  const result = await post('/api/icr/evaluate-cloud', {
    imageDataUrl, provider: 'ollama-gemma4', expectedCount: 1, proceedDespiteQualityWarning: true,
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.deepEqual(result.body.answers, ['2']);
  assert.equal(result.body.structured, true);
  assert.equal(result.body.countMismatch, false);
  assert.deepEqual(receivedImages, [imageBase64]);
});

test('large unauthenticated uploads cannot reach the vault or OCR provider', async () => {
  const vaultBefore = vaultCalls;
  const imagesBefore = receivedImages.length;
  for (const route of ['/api/students/bulk-import', '/api/icr/check-quality', '/api/icr/evaluate-cloud']) {
    const result = await post(route, { imageDataUrl }, false);
    assert.equal(result.status, 401, `${route}: ${JSON.stringify(result.body)}`);
  }
  assert.equal(vaultCalls, vaultBefore);
  assert.equal(receivedImages.length, imagesBefore);
});
