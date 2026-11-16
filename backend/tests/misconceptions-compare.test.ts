import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import crypto from 'node:crypto';
import express from 'express';
import jwtLib from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');

const { dbStore, UserRole } = await import('../src/db');
const { JWT_SECRET } = await import('../src/auth');
const { registerMisconceptionRoutes } = await import('../src/routes/misconceptions');

await dbStore.init();

const app = express();
app.use(express.json());
registerMisconceptionRoutes(app);

const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', () => resolve()));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Failed to start test server');
const BASE = `http://127.0.0.1:${address.port}`;

after(async () => {
  await new Promise<void>(r => server.close(() => r()));
});

const users = await dbStore.getUsers();
const teacher = users.find(u => u.role === UserRole.TEACHER) || {
  id: 'test-teacher',
  email: 'test.teacher@fln.org',
  role: UserRole.TEACHER,
  schoolId: 'gps-mt-001',
};
const token = `Bearer ${jwtLib.sign({ email: teacher.email }, JWT_SECRET, { expiresIn: '1h' })}`;

test('GET /api/misconceptions/compare rejects unauthenticated request with 401', async () => {
  const res = await fetch(`${BASE}/api/misconceptions/compare?classGroup=Preschool%201`);
  assert.equal(res.status, 401);
  const json = await res.json() as any;
  assert.equal(json.error, 'Unauthorized');
});

test('GET /api/misconceptions/compare returns HTTP 200 with NO_COLLISION when there are no collisions', async () => {
  const res = await fetch(`${BASE}/api/misconceptions/compare?classGroup=Preschool%201&schoolId=gps-mt-001`, {
    headers: { Authorization: token },
  });

  assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
  const json = await res.json() as any;
  assert.equal(json.reason, 'NO_COLLISION');
  assert.equal(json.left, null);
  assert.equal(json.right, null);
  assert.match(json.message, /No two children in this cohort share a score/i);
});

test('GET /api/misconceptions/compare returns 404 when requested students do not exist in cohort', async () => {
  const res = await fetch(`${BASE}/api/misconceptions/compare?classGroup=Preschool%201&schoolId=gps-mt-001&a=nonexistent_1&b=nonexistent_2`, {
    headers: { Authorization: token },
  });

  assert.equal(res.status, 404);
  const json = await res.json() as any;
  assert.equal(json.error, 'Student not found in this cohort.');
});
