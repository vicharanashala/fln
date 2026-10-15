import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import express from 'express';

const app = express();
const LARGE_BODY_PATHS = ['/api/icr/check-quality', '/api/icr/evaluate-cloud', '/api/icr/evaluate-bulk', '/api/students/bulk-import'];
app.use(LARGE_BODY_PATHS, express.json({ limit: '100mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

app.post('/api/auth/login', (req, res) => {
  res.json({ ok: true, size: JSON.stringify(req.body).length });
});

app.post('/api/students/bulk-import', (req, res) => {
  res.json({ ok: true, size: JSON.stringify(req.body).length });
});

app.post('/api/icr/evaluate-cloud', (req, res) => {
  res.json({ ok: true, size: JSON.stringify(req.body).length });
});

const server = app.listen(0, '127.0.0.1');
let base: string;

before(async () => {
  if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve()))));

test('POST /api/auth/login with >1MB payload returns 413 Payload Too Large', async () => {
  const largeData = 'x'.repeat(2 * 1024 * 1024); // 2 MB string
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', data: largeData }),
  });
  assert.equal(res.status, 413);
});

test('POST /api/auth/login with normal payload succeeds (< 1MB)', async () => {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
  });
  assert.equal(res.status, 200);
});

test('POST /api/students/bulk-import with >1MB payload succeeds (under 100MB limit)', async () => {
  const largeData = 'x'.repeat(2 * 1024 * 1024); // 2 MB string
  const res = await fetch(`${base}/api/students/bulk-import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows: [largeData] }),
  });
  assert.equal(res.status, 200);
});

test('POST /api/icr/evaluate-cloud with >1MB payload succeeds (under 100MB limit)', async () => {
  const largeData = 'x'.repeat(2 * 1024 * 1024); // 2 MB string
  const res = await fetch(`${base}/api/icr/evaluate-cloud`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl: largeData }),
  });
  assert.equal(res.status, 200);
});
