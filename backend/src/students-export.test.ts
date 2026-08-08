import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { isolateTestDb } from './test-helpers';

// Must run before any (static or dynamic) import that transitively pulls in
// db.ts — including the ./index import below, which is why that one is
// dynamic rather than a top-level `import` (top-level imports are hoisted
// and would evaluate before this call regardless of source order).
isolateTestDb();

const { createApp, resolveStudentsQueryLimit } = await import('./index');
const { default: jwt } = await import('jsonwebtoken');
const { JWT_SECRET } = await import('./auth');
const dbModule = await import('./db');

// resolveStudentsQueryLimit is a pure function, so the actual 10,000-row
// ceiling is provable directly against its real value — no need to seed
// 10,000+ students into a database just to observe the same number back.
test('resolveStudentsQueryLimit: all=1 is capped at 10,000, not unlimited', () => {
  assert.equal(resolveStudentsQueryLimit({ all: '1' }), 10000);
  assert.equal(resolveStudentsQueryLimit({ all: 'true' }), 10000);
});

test('resolveStudentsQueryLimit: explicit limit is capped at 5x the default page size', () => {
  assert.equal(resolveStudentsQueryLimit({ limit: '999999' }), 5000);
  assert.equal(resolveStudentsQueryLimit({ limit: '50' }), 50);
});

test('resolveStudentsQueryLimit: no query params defaults to the 1000-row page size', () => {
  assert.equal(resolveStudentsQueryLimit({}), 1000);
});

async function startTestServer() {
  const app = await createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

// Isolated-DB integration smoke test: for a small, realistic dataset,
// ?all=1 must still return every row (proving the ceiling didn't regress
// all=1 into returning less than what's actually there).
test('/api/students?all=1 still returns the full (small) dataset, not truncated', async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const seededStudents = await dbModule.dbStore.getStudents({});
    assert.ok(seededStudents.length > 0, 'expected the seed data to include at least one student');

    const token = jwt.sign({ email: 'superadmin@fln.org' }, JWT_SECRET, { expiresIn: '1h' });
    const res = await fetch(`${baseUrl}/api/students?all=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.length, seededStudents.length);
  } finally {
    server.close();
  }
});
