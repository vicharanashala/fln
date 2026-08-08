import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { isolateTestDb } from './test-helpers';

// Must run before any import that transitively pulls in db.ts (its DB_DIR
// is a top-level const computed from process.cwd() at import time).
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

const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('/api/icr/evaluate-cloud rate-limits after the configured request count', async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    // Seeded demo teacher account (backend/src/db.ts::getSeedData) — any
    // authenticated role should be able to trip this, not just admins.
    const token = mintToken('gps-mt-001.t01@fln.org');

    let sawRateLimited = false;
    // icrRateLimiter allows 20 requests/15min; loop well past that so the
    // assertion doesn't depend on an exact remaining-quota assumption if
    // another test in this file has already used a couple of slots.
    for (let i = 0; i < 30 && !sawRateLimited; i++) {
      const res = await fetch(`${baseUrl}/api/icr/evaluate-cloud`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider: 'google', imageDataUrl: TINY_PNG_DATA_URL }),
      });
      if (res.status === 429) sawRateLimited = true;
    }
    assert.ok(sawRateLimited, 'expected a 429 after exceeding the ICR rate limit');
  } finally {
    server.close();
  }
});
