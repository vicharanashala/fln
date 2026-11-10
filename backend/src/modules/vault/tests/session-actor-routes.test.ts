/**
 * /v1 vault routes — caller identity and access.
 *
 * Covers, over real HTTP against the real route handlers (with a stub vault
 * context that records what the commands receive):
 *   - only SUPERADMIN may use any vault scope: other roles get 403, a missing
 *     or invalid token gets 401, and the commands are never invoked;
 *   - `actorId` / `actorRole` always come from the authenticated session; any
 *     values in the request body (including the `actor` field of
 *     /v1/mfa/enroll) are ignored;
 *   - the approve route ignores any `window` in the body.
 *
 * Run:  npx tsx --test src/modules/vault/tests/session-actor-routes.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

// ─── Bootstrap: isolate env + cwd BEFORE importing application modules ─────
const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-vault-routes-test-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);
delete process.env.MONGODB_URI;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'dev-insecure-secret-change-me';

const { dbStore } = await import('../../../db');
const { JWT_SECRET } = await import('../../../auth');
const express = (await import('express')).default;
const jwt = (await import('jsonwebtoken')).default;
const { makeTokenizeRouter } = await import('../routes/tokenize.routes');
const { makeDetokenizeRouter } = await import('../routes/detokenize.routes');
const { makeStepUpRequestRouter } = await import('../routes/step-up-request.routes');
const { makeStepUpApproveRouter } = await import('../routes/step-up-approve.routes');
const { makeMfaEnrollRouter } = await import('../routes/mfa-enroll.routes');
const { makeAuditRouter } = await import('../routes/audit.routes');

await dbStore.init();

const SUPERADMIN = 'superadmin@fln.org';
const NON_SUPERADMINS = [
  'admin.pb@fln.org',          // ADMIN
  'district.ldh@fln.org',      // DISTRICT_ADMIN
  'block.ldh-01@fln.org',      // BLOCK_ADMIN
  'gps-mt-001.t01@fln.org',    // TEACHER
];

// ─── Stub vault context: records the command each route passes in ─────────
const calls: Record<string, any[]> = {};
function record(name: string, result: unknown) {
  return async (cmd: unknown) => {
    (calls[name] ??= []).push(cmd);
    return result;
  };
}
const now = new Date();
const stubCtx: any = {
  tokenize: record('tokenize', { token: 't', last4: '9012', tokenType: 'AADHAAR', identityId: 'i', auditId: 'a', keyVersion: 'kv-1' }),
  detokenize: record('detokenize', { token: 't', identityId: 'i', aadhaar: '000000000000', last4: '0000', auditId: 'a' }),
  readAuditHistory: record('readAuditHistory', { identityId: 'i', entries: [] }),
  enrollMfa: record('enrollMfa', { factorId: 'f', otpauthUri: 'otpauth://x', factor: {} }),
  requestDetokenization: record('requestDetokenization', { challengeId: 'c', expiresAt: now, requiredFactor: {} }),
  approveStepUpChallenge: record('approveStepUpChallenge', { challengeId: 'c', status: 'approved', approvedAt: now, verifiedFactorId: 'f' }),
  keyManagerInfo: { provider: 'test', currentVersion: 'kv-1', algorithm: 'aes-256-gcm' },
};

const app = express();
app.use(express.json());
for (const make of [
  makeTokenizeRouter, makeDetokenizeRouter, makeStepUpRequestRouter,
  makeStepUpApproveRouter, makeMfaEnrollRouter, makeAuditRouter,
]) {
  app.use(make(stubCtx));
}

let server: http.Server;
let BASE = '';
before(async () => {
  server = await new Promise<http.Server>(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  BASE = `http://127.0.0.1:${(server.address() as import('net').AddressInfo).port}`;
});
after(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

function bearer(email: string): string {
  return `Bearer ${jwt.sign({ email }, JWT_SECRET, { expiresIn: '1h' })}`;
}
async function call(method: string, route: string, authorization: string | null, body?: unknown) {
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, json };
}

// Every route, with a valid body. `context` claims a different actor on purpose.
const FORGED_CONTEXT = { actorId: 'attacker@evil.test', actorRole: 'TEACHER', reason: 'forged actor' };
const ROUTES: Array<{ name: string; method: string; route: string; command: string; body: any; ok: number }> = [
  { name: 'tokenize', method: 'POST', route: '/v1/tokenize', command: 'tokenize',
    body: { raw: '123456789012', type: 'AADHAAR', context: FORGED_CONTEXT }, ok: 201 },
  { name: 'detokenize', method: 'POST', route: '/v1/detokenize', command: 'detokenize',
    body: { challengeId: 'c', context: FORGED_CONTEXT }, ok: 200 },
  { name: 'step-up request', method: 'POST', route: '/v1/detokenize/request', command: 'requestDetokenization',
    body: { tokenId: 't', factorId: 'f', context: FORGED_CONTEXT }, ok: 201 },
  { name: 'step-up approve', method: 'POST', route: '/v1/detokenize/step-up/c/approve', command: 'approveStepUpChallenge',
    body: { code: '123456', context: FORGED_CONTEXT }, ok: 200 },
  { name: 'mfa enroll', method: 'POST', route: '/v1/mfa/enroll', command: 'enrollMfa',
    body: { actor: 'victim@fln.org', context: FORGED_CONTEXT }, ok: 201 },
  { name: 'audit', method: 'POST', route: '/v1/audit', command: 'readAuditHistory',
    body: { identityId: 'i', context: FORGED_CONTEXT }, ok: 200 },
];

for (const r of ROUTES) {
  test(`${r.name}: a missing or invalid token gets 401 and the command is not called`, async () => {
    calls[r.command] = [];
    assert.equal((await call(r.method, r.route, null, r.body)).status, 401);
    assert.equal((await call(r.method, r.route, 'Bearer not-a-real-token', r.body)).status, 401);
    assert.equal(calls[r.command].length, 0);
  });

  test(`${r.name}: a wrong role gets 403 and the command is not called`, async () => {
    calls[r.command] = [];
    for (const email of NON_SUPERADMINS) {
      const res = await call(r.method, r.route, bearer(email), r.body);
      assert.equal(res.status, 403, `${email} should be forbidden`);
      assert.equal(res.json.error, 'FORBIDDEN');
    }
    assert.equal(calls[r.command].length, 0);
  });

  test(`${r.name}: actorId and actorRole come from the session, not the body`, async () => {
    calls[r.command] = [];
    const res = await call(r.method, r.route, bearer(SUPERADMIN), r.body);
    assert.equal(res.status, r.ok, JSON.stringify(res.json));
    assert.equal(calls[r.command].length, 1);
    const ctx = calls[r.command][0].context;
    assert.equal(ctx.actorId, SUPERADMIN);
    assert.equal(ctx.actorRole, 'SUPER_ADMIN');
    assert.equal(ctx.reason, 'forged actor'); // free-text reason still comes from the body
  });
}

test('mfa enroll: a body-supplied actor is ignored and the factor is enrolled for the caller', async () => {
  calls.enrollMfa = [];
  const res = await call('POST', '/v1/mfa/enroll', bearer(SUPERADMIN), {
    actor: 'victim@fln.org',
    context: { reason: 'enroll' },
  });
  assert.equal(res.status, 201);
  assert.equal(calls.enrollMfa[0].actor, SUPERADMIN);
});

test('a body without a reason is still rejected with 400', async () => {
  calls.approveStepUpChallenge = [];
  const res = await call('POST', '/v1/detokenize/step-up/c/approve', bearer(SUPERADMIN), {
    code: '123456',
    context: { actorId: SUPERADMIN, actorRole: 'SUPER_ADMIN' },
  });
  assert.equal(res.status, 400);
  assert.equal(res.json.error, 'INVALID_INPUT');
  assert.equal(calls.approveStepUpChallenge.length, 0);
});

test('step-up approve: a window in the body is ignored', async () => {
  for (const window of [0, 1000, -3, 'abc', null]) {
    calls.approveStepUpChallenge = [];
    const res = await call('POST', '/v1/detokenize/step-up/c/approve', bearer(SUPERADMIN), {
      code: '123456',
      window,
      context: { reason: 'window test' },
    });
    assert.equal(res.status, 200, `window=${JSON.stringify(window)} should not be rejected: ${JSON.stringify(res.json)}`);
    assert.equal(calls.approveStepUpChallenge.length, 1);
    assert.equal('window' in calls.approveStepUpChallenge[0], false, 'no window reaches the command');
  }
});
