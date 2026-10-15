import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import express from 'express';
import jwt from 'jsonwebtoken';
import { registerEvaluationRoutes } from '../src/routes/evaluation.js';
import { dbStore, UserRole } from '../src/db.js';
import { JWT_SECRET } from '../src/auth.js';

const app = express();
app.use(express.json());
registerEvaluationRoutes(app);

const server = app.listen(0, '127.0.0.1');
let baseUrl: string;

before(async () => {
  await new Promise<void>(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await dbStore.init();

  // In test environment without MongoDB, stub setConfig
  dbStore.setConfig = async () => {};

  await dbStore.addUser({
    id: 'test-admin',
    email: 'admin@fln.org',
    name: 'State Admin',
    role: UserRole.ADMIN,
  });

  await dbStore.addUser({
    id: 'test-superadmin',
    email: 'superadmin@fln.org',
    name: 'National Superadmin',
    role: UserRole.SUPERADMIN,
  });

  await dbStore.addUser({
    id: 'test-teacher',
    email: 'teacher@fln.org',
    name: 'School Teacher',
    role: UserRole.TEACHER,
  });
});

after(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

function tokenFor(email: string) {
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: '1h' });
}

test('POST /api/icr/cloud-config rejects unauthenticated requests', async () => {
  const res = await fetch(`${baseUrl}/api/icr/cloud-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'ollama-gemma4', apiKey: 'test-key' }),
  });
  assert.equal(res.status, 401);
});

test('POST /api/icr/cloud-config rejects admin (state admin) with 403', async () => {
  const res = await fetch(`${baseUrl}/api/icr/cloud-config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenFor('admin@fln.org')}`,
    },
    body: JSON.stringify({ provider: 'ollama-gemma4', apiKey: 'test-key' }),
  });
  assert.equal(res.status, 403);
  const data = await res.json() as { error?: string };
  assert.equal(data.error, 'Superadmin role required.');
});

test('POST /api/icr/cloud-config rejects teacher with 403', async () => {
  const res = await fetch(`${baseUrl}/api/icr/cloud-config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenFor('teacher@fln.org')}`,
    },
    body: JSON.stringify({ provider: 'ollama-gemma4', apiKey: 'test-key' }),
  });
  assert.equal(res.status, 403);
  const data = await res.json() as { error?: string };
  assert.equal(data.error, 'Superadmin role required.');
});

test('POST /api/icr/cloud-config accepts superadmin and sets key', async () => {
  const res = await fetch(`${baseUrl}/api/icr/cloud-config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenFor('superadmin@fln.org')}`,
    },
    body: JSON.stringify({ provider: 'ollama-gemma4', apiKey: 'test-key-123' }),
  });
  assert.equal(res.status, 200);
  const data = await res.json() as { success?: boolean; provider?: string; configured?: boolean };
  assert.equal(data.success, true);
  assert.equal(data.provider, 'ollama-gemma4');
  assert.equal(data.configured, true);
});

test('GET /api/icr/cloud-config remains accessible to logged-in users', async () => {
  const res = await fetch(`${baseUrl}/api/icr/cloud-config`, {
    headers: {
      Authorization: `Bearer ${tokenFor('teacher@fln.org')}`,
    },
  });
  assert.equal(res.status, 200);
  const data = await res.json() as { success: boolean; providers: Record<string, boolean> };
  assert.equal(data.providers['ollama-gemma4'], true);
});
