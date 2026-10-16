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
