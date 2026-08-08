import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { isolateTestDb } from './test-helpers';

isolateTestDb();

const { createApp } = await import('./index');
const { default: jwt } = await import('jsonwebtoken');
const { JWT_SECRET } = await import('./auth');

function mintToken(email: string): string {
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: '1h' });
}

async function startTestServer() {
  const app = await createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

// Decodes to just over the 8MB ICR_MAX_DECODED_BYTES ceiling.
const OVERSIZED_BASE64 = Buffer.alloc(8 * 1024 * 1024 + 1024, 1).toString('base64');

test('/api/icr/evaluate-cloud rejects a payload over the 8MB decoded cap with 413', async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const token = mintToken('gps-mt-001.t01@fln.org');
    const res = await fetch(`${baseUrl}/api/icr/evaluate-cloud`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ provider: 'google', imageDataUrl: `data:image/png;base64,${OVERSIZED_BASE64}` }),
    });
    assert.equal(res.status, 413);
  } finally {
    server.close();
  }
});

test('/api/icr/evaluate-pdf rejects an oversized payload with 413 (no-classId fast path)', async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const token = mintToken('gps-mt-001.t01@fln.org');
    const res = await fetch(`${baseUrl}/api/icr/evaluate-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fileBase64: OVERSIZED_BASE64, filename: 'scan.jpg' }),
    });
    assert.equal(res.status, 413);
  } finally {
    server.close();
  }
});

test('/api/icr/evaluate-pdf rejects an oversized payload with 413 (classId bulk path)', async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const token = mintToken('gps-mt-001.t01@fln.org');
    const res = await fetch(`${baseUrl}/api/icr/evaluate-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ classId: 'Class 2', fileBase64: OVERSIZED_BASE64, filename: 'scan.pdf' }),
    });
    assert.equal(res.status, 413);
  } finally {
    server.close();
  }
});
