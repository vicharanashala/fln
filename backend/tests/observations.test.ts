import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Keep the file-backed DB isolated from backend/data/db.json and import the
// singleton only after the environment and working directory are configured.
const originalCwd = process.cwd();
const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-observations-test-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);
delete process.env.MONGODB_URI;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'observations-test-secret';
process.env.SEED_DEMO_PASSWORD = 'TestPass@123';

const { dbStore } = await import('../src/db');
const { JWT_SECRET } = await import('../src/auth');
const { registerObservationRoutes } = await import('../src/routes/observations');
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

test('observation records save, read by student/class, and upsert by student-concept-cycle', async () => {
  const recordInput = {
    studentId: 's1',
    conceptId: 'S3.12',
    classId: 'c1',
    cycle: 'Baseline',
    rating: 'Progressive',
    notYetAssessed: false
  };

  const firstSave = await request('POST', '/api/observations', recordInput);
  assert.equal(firstSave.status, 200);
  assert.equal(firstSave.body.teacherId, 'u6');
  assert.equal(firstSave.body.teacherEmail, teacherEmail);

  const studentRead = await request('GET', '/api/observations/student/s1?cycle=Baseline');
  assert.equal(studentRead.status, 200);
  assert.equal(studentRead.body.length, 1);
  assert.equal(studentRead.body[0].rating, 'Progressive');

  const classRead = await request('GET', '/api/observations/class/c1?cycle=Baseline');
  assert.equal(classRead.status, 200);
  assert.equal(classRead.body.length, 1);
  assert.equal(classRead.body[0].id, firstSave.body.id);

  const persisted = JSON.parse(fs.readFileSync(path.join(scratchDir, 'data', 'db.json'), 'utf8'));
  assert.equal(persisted.teacherObservationRecords.length, 1);

  const secondSave = await request('POST', '/api/observations', { ...recordInput, rating: 'Proficient' });
  assert.equal(secondSave.status, 200);
  assert.equal(secondSave.body.id, firstSave.body.id);
  assert.equal(secondSave.body.createdAt, firstSave.body.createdAt);

  const afterUpdate = await request('GET', '/api/observations/student/s1?cycle=Baseline');
  assert.equal(afterUpdate.status, 200);
  assert.equal(afterUpdate.body.length, 1);
  assert.equal(afterUpdate.body[0].rating, 'Proficient');
});

test('observation routes require authentication and validate the cycle', async () => {
  const unauthenticated = await request('GET', '/api/observations/class/c1?cycle=Baseline', undefined, false);
  assert.equal(unauthenticated.status, 401);

  const invalidCycle = await request('GET', '/api/observations/student/s1?cycle=Invalid');
  assert.equal(invalidCycle.status, 400);
});

test('banned teachers receive 403 from all observation routes', async () => {
  await dbStore.updateUser('u6', { isBanned: true });
  try {
    const studentRead = await request('GET', '/api/observations/student/s1?cycle=Baseline');
    const classRead = await request('GET', '/api/observations/class/c1?cycle=Baseline');
    const write = await request('POST', '/api/observations', {
      studentId: 's1',
      conceptId: 'S3.12',
      classId: 'c1',
      cycle: 'Baseline',
      rating: 'Progressive',
      notYetAssessed: false
    });

    assert.equal(studentRead.status, 403);
    assert.equal(classRead.status, 403);
    assert.equal(write.status, 403);
  } finally {
    await dbStore.updateUser('u6', { isBanned: false });
  }
});
