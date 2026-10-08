import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalCwd = process.cwd();
const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-observations-test-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);
delete process.env.MONGODB_URI;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'observations-test-secret';
process.env.SEED_DEMO_PASSWORD = 'TestPass@123';

const { dbStore } = await import('../src/db.js');
const { JWT_SECRET } = await import('../src/auth.js');
const { registerObservationRoutes } = await import('../src/routes/observations.js');
const express = (await import('express')).default;
const jwt = (await import('jsonwebtoken')).default;

await dbStore.init();

const app = express();
app.use(express.json());
registerObservationRoutes(app);
const server: http.Server = await new Promise(resolve => {
  const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
});
const baseUrl = `http://127.0.0.1:${(server.address() as import('net').AddressInfo).port}`;
const teacherEmail = 'gps-mt-001.t01@fln.org';
const token = jwt.sign({ email: teacherEmail }, JWT_SECRET, { expiresIn: '1h' });

async function request(method: string, route: string, body?: unknown, withAuth = true) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(withAuth ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() as any };
}

after(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  process.chdir(originalCwd);
  fs.rmSync(scratchDir, { recursive: true, force: true });
});

test('POST /api/observations accepts selfCorrected and strategyUsed and GET endpoints return them', async () => {
  const recordInput = {
    studentId: 's1',
    conceptId: 'S3.12',
    classId: 'c1',
    cycle: 'Baseline',
    rating: 'Progressive',
    notYetAssessed: false,
    selfCorrected: true,
    strategyUsed: 'fingers'
  };

  const saveRes = await request('POST', '/api/observations', recordInput);
  assert.equal(saveRes.status, 200);
  assert.equal(saveRes.body.selfCorrected, true);
  assert.equal(saveRes.body.strategyUsed, 'fingers');

  const studentRead = await request('GET', '/api/observations/student/s1?cycle=Baseline');
  assert.equal(studentRead.status, 200);
  assert.equal(studentRead.body[0].selfCorrected, true);
  assert.equal(studentRead.body[0].strategyUsed, 'fingers');

  const classRead = await request('GET', '/api/observations/class/c1?cycle=Baseline');
  assert.equal(classRead.status, 200);
  assert.equal(classRead.body[0].selfCorrected, true);
  assert.equal(classRead.body[0].strategyUsed, 'fingers');
});

test('POST /api/observations returns 400 for invalid selfCorrected or strategyUsed', async () => {
  const baseInput = {
    studentId: 's1',
    conceptId: 'S3.12',
    classId: 'c1',
    cycle: 'Baseline',
    rating: 'Progressive',
    notYetAssessed: false
  };

  const badSelfCorrected = await request('POST', '/api/observations', {
    ...baseInput,
    selfCorrected: 'yes'
  });
  assert.equal(badSelfCorrected.status, 400);

  const badStrategy = await request('POST', '/api/observations', {
    ...baseInput,
    strategyUsed: 'guessing'
  });
  assert.equal(badStrategy.status, 400);
});

test('POST /api/observations preserves previous selfCorrected/strategyUsed when omitted in update', async () => {
  const baseInput = {
    studentId: 's1',
    conceptId: 'S3.12',
    classId: 'c1',
    cycle: 'Baseline',
    rating: 'Progressive',
    notYetAssessed: false
  };

  const initialSave = await request('POST', '/api/observations', {
    ...baseInput,
    selfCorrected: true,
    strategyUsed: 'mental'
  });
  assert.equal(initialSave.status, 200);

  const updateNoFields = await request('POST', '/api/observations', {
    ...baseInput,
    rating: 'Proficient'
  });
  assert.equal(updateNoFields.status, 200);
  assert.equal(updateNoFields.body.rating, 'Proficient');
  assert.equal(updateNoFields.body.selfCorrected, true);
  assert.equal(updateNoFields.body.strategyUsed, 'mental');
});

test('POST /api/observations works without selfCorrected and strategyUsed for legacy requests', async () => {
  const legacyInput = {
    studentId: 's2',
    conceptId: 'S3.15',
    classId: 'c1',
    cycle: 'Baseline',
    rating: 'Beginner',
    notYetAssessed: false
  };

  const saveRes = await request('POST', '/api/observations', legacyInput);
  assert.equal(saveRes.status, 200);
  assert.equal(saveRes.body.selfCorrected, undefined);
  assert.equal(saveRes.body.strategyUsed, undefined);
});
