import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authRateLimiter } from '../src/config';
import { registerMfaEnrollmentRoutes } from '../src/routes/mfaEnrollment';
import { registerAadhaarDetokenizeRoutes } from '../src/routes/aadhaarDetokenize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('authRateLimiter is attached to MFA and Aadhaar secret-checking routes (#753)', () => {
  const app = express();
  registerMfaEnrollmentRoutes(app);
  registerAadhaarDetokenizeRoutes(app);

  const expectedRoutesWithRateLimiter = [
    '/api/me/mfa/enroll',
    '/api/me/mfa/verify',
    '/api/students/:id/aadhaar/step-up/request',
    '/api/students/:id/aadhaar/step-up/approve',
    '/api/students/:id/aadhaar/detokenize',
  ];

  const routesWithoutRateLimiter = [
    '/api/me/mfa/factors',
    '/api/me/mfa/factors/:factorId',
    '/api/students/:id/aadhaar/mfa/me',
    '/api/students/:id/aadhaar/mfa/enroll',
  ];

  const routeMap = new Map<string, boolean>();

  for (const layer of app._router.stack) {
    if (layer.route && layer.route.path) {
      const hasLimiter = layer.route.stack.some(
        (s: any) => s.handle === authRateLimiter,
      );
      routeMap.set(layer.route.path, hasLimiter);
    }
  }

  for (const routePath of expectedRoutesWithRateLimiter) {
    assert.strictEqual(
      routeMap.get(routePath),
      true,
      `Expected ${routePath} to have authRateLimiter attached`,
    );
  }

  for (const routePath of routesWithoutRateLimiter) {
    assert.strictEqual(
      routeMap.get(routePath),
      false,
      `Expected ${routePath} NOT to have authRateLimiter attached`,
    );
  }
});

test('backend/src/index.ts sets trust proxy for reverse proxies (#753)', () => {
  const indexSource = fs.readFileSync(
    path.resolve(__dirname, '../src/index.ts'),
    'utf-8',
  );
  assert.match(
    indexSource,
    /app\.set\(\s*['"]trust proxy['"]\s*,\s*1\s*\)/,
    "index.ts must configure app.set('trust proxy', 1)",
  );
});

import type { AddressInfo } from 'node:net';

async function startApp(): Promise<{ base: string; close: () => void }> {
  const app = express();
  app.set('trust proxy', 1); // same setting as backend/src/index.ts
  app.use(express.json());
  registerMfaEnrollmentRoutes(app);
  registerAadhaarDetokenizeRoutes(app);
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  return { base: `http://127.0.0.1:${port}`, close: () => server.close() };
}

// No login token is sent, so the route answers 401/403. The limiter runs
// BEFORE the handler, so those answers still count towards the limit.
function post(base: string, route: string, ip: string): Promise<number> {
  return fetch(base + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
    body: '{}',
  }).then((r) => r.status);
}

const LIMITED_ROUTES = [
  '/api/me/mfa/enroll',
  '/api/me/mfa/verify',
  '/api/students/s1/aadhaar/step-up/request',
  '/api/students/s1/aadhaar/step-up/approve',
  '/api/students/s1/aadhaar/detokenize',
];

test('every secret-checking route returns 429 once one address passes the limit (#753)', async () => {
  const { base, close } = await startApp();
  try {
    for (const [i, route] of LIMITED_ROUTES.entries()) {
      const ip = `10.1.0.${i + 1}`; // a fresh address per route, so the counters do not mix
      let status = 0;
      for (let n = 0; n < 50; n++) status = await post(base, route, ip);
      assert.notEqual(status, 429, `${route}: the 50th request must still be answered`);
      assert.equal(await post(base, route, ip), 429, `${route}: the 51st request must be blocked`);
    }
  } finally {
    close();
  }
});

test('one blocked address does not block another address (#753)', async () => {
  const { base, close } = await startApp();
  try {
    for (let n = 0; n < 51; n++) await post(base, '/api/me/mfa/verify', '10.2.0.1');
    assert.equal(await post(base, '/api/me/mfa/verify', '10.2.0.1'), 429);
    assert.notEqual(await post(base, '/api/me/mfa/verify', '10.2.0.2'), 429);
  } finally {
    close();
  }
});

test('index.ts really calls app.set("trust proxy", 1) (not only in a comment) (#753)', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../src/index.ts'), 'utf-8');
  assert.match(src, /^\s*app\.set\(\s*['"]trust proxy['"]\s*,\s*1\s*\)\s*;/m);
});

