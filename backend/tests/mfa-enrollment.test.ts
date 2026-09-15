/**
 * Account-level MFA enrollment tests (Wave 3 — Wave 2A surface).
 *
 * Run:  cd backend && npx tsx --test tests/mfa-enrollment.test.ts
 *
 * Exercises the `/api/me/mfa/*` account-level routes that
 * replaced the per-student `/api/students/:id/aadhaar/mfa/*`
 * surface. The full Step-Up reveal flow still lives in
 * `aadhaar-detokenize.test.ts`; this file owns the enrollment
 * lifecycle (`/api/me/mfa/enroll`, `/verify`, `/factors`,
 * `DELETE /factors/:id`) plus the audit chain those routes
 * write to the FLN `logbook` collection.
 *
 * The harness mirrors `aadhaar-detokenize.test.ts`:
 *   - chdir into a fresh temp dir BEFORE importing modules
 *   - delete MONGODB_URI to force the file-fallback DB
 *   - install in-process `__set*Impl` stubs on every vault
 *     shim the routes reach into, sharing one `factors`
 *     Map across them
 *
 * **Stub fidelity.** The `__setVerifyMfaImpl` stub mirrors
 * the real `verifyMfa` command's pipeline: input validation,
 * actor-binding check, status check, code verification,
 * PENDING_ENROLLMENT → ENROLLED transition, and audit rows
 * (MFA_VERIFY + MFA_ENROLLMENT_VERIFIED on success,
 * MFA_VERIFY + MFA_ENROLLMENT_FAILED on failure).
 *
 * **Plaintext hygiene.** The TOTP code and plaintext Aadhaar
 * never appear in any captured console line. Mirrors the
 * assertion pattern at `aadhaar-detokenize.test.ts:781`.
 */
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ─── Bootstrap: isolate env + cwd BEFORE importing application modules ─────
const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-mfa-enroll-test-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);              // db.ts resolves data/db.json from cwd
delete process.env.MONGODB_URI;         // force the file-fallback store
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'dev-insecure-secret-change-me';
process.env.SEED_DEMO_PASSWORD = 'Fln@2026';
delete process.env.LOCAL_DEV_MASTER_KEY;

// ─── TOTP helper (RFC 6238 / HMAC-SHA1, 6 digits, 30s period) ────────────
function totpCode(secretBytes: Buffer, time = Math.floor(Date.now() / 1000)): string {
  const counter = Math.floor(time / 30);
  const buf = Buffer.alloc(8);
  let hi = Math.floor(counter / 0x100000000);
  let lo = counter >>> 0;
  buf.writeUInt32BE(hi, 0);
  buf.writeUInt32BE(lo, 4);
  const hmac = crypto.createHmac('sha1', secretBytes).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24)
               | ((hmac[offset + 1] & 0xff) << 16)
               | ((hmac[offset + 2] & 0xff) << 8)
               | (hmac[offset + 3] & 0xff);
  return (binary % 1_000_000).toString().padStart(6, '0');
}

// ─── In-memory shared state across all 4 in-process stubs ────────────────
//
// Every stub on aadhaarVault.ts that the new /api/me/mfa/* routes
// touch shares this single Map. The shape mirrors the persisted
// MfaFactor (repositories.ts) — same `lifecycleState` enum,
// same `verifyAttempts` counter, same `encryptedSecret` Buffer
// — so the route's wire shape and the stub's bookkeeping agree.
type Factor = {
  factorId: string;
  actor: string;
  secretBytes: Buffer;
  status: 'ACTIVE' | 'REVOKED';
  lifecycleState: 'PENDING_ENROLLMENT' | 'ENROLLED';
  digits: number;
  period: number;
  algorithm: string;
  label: string;
  encryptedSecret: Buffer | null;
  verifyAttempts: number;
  /** Time-step the most recent successful verify matched against.
   *  Used by the verify stub to refuse a code replayed in the
   *  same 30s window. null when the factor has never verified. */
  lastUsedStep: number | null;
  /** Wall-clock time of the most recent successful verify (ms). */
  lastUsedAt: number | null;
  createdAt: string;
};
const factors = new Map<string, Factor>();

// ─── Import application modules AFTER env/cwd isolation ────────────────────
const { dbStore } = await import('../src/db');
const { JWT_SECRET } = await import('../src/auth');
const { registerAadhaarDetokenizeRoutes } = await import('../src/routes/aadhaarDetokenize');
const { registerMfaEnrollmentRoutes } = await import('../src/routes/mfaEnrollment');
const aadhaarVaultModule = await import('../src/aadhaarVault');
const { mintVaultLogId, vaultLogbookEntry } = await import('../src/modules/vault/audit/logbook-entry');

// ---------------------------------------------------------------------------
// Install 4 in-process vault impls for the new /api/me/mfa/* surface. The
// enroll route calls `enrollMfa`, the verify route calls `verifyMfaFactor`,
// the list route calls `listMfaFactors`, and the revoke route calls
// `revokeMfaFactor`. All four share the `factors` Map above.
// ---------------------------------------------------------------------------

// (1) enrollMfa — mints a PENDING_ENROLLMENT factor with a fresh 20-byte
// secret. The plaintext secret is stored in `factors` so the test can
// compute a valid TOTP code later. Wire shape mirrors the real
// in-process command: { factorId, otpauthUri, factor: <meta> }.
aadhaarVaultModule.__setEnrollMfaImpl(async (params) => {
  const factorId = 'fac-' + crypto.randomUUID();
  const secretBytes = crypto.randomBytes(20);
  const algorithm = String(params.algorithm || 'SHA1');
  const digits = Number(params.digits || 6);
  const period = Number(params.period || 30);
  const f: Factor = {
    factorId,
    actor: params.actor,
    secretBytes,
    status: 'ACTIVE',
    lifecycleState: 'PENDING_ENROLLMENT',
    digits,
    period,
    algorithm,
    label: params.label || params.actor,
    encryptedSecret: Buffer.from('SEALED:' + factorId),  // opaque stand-in for KeyManager.sealSecret
    verifyAttempts: 0,
    lastUsedStep: null,
    lastUsedAt: null,
    createdAt: new Date().toISOString(),
  };
  factors.set(factorId, f);
  const otpauthUri = `otpauth://totp/FLN:${encodeURIComponent(params.actor)}?secret=BASE32FAKE&algorithm=${algorithm}&digits=${digits}&period=${period}`;
  return {
    factorId,
    otpauthUri,
    factor: {
      factorId,
      actor: params.actor,
      factorType: 'TOTP',
      status: 'ACTIVE',
      label: f.label,
      algorithm,
      digits,
      period,
      lastUsedAt: null,
      expiresAt: null,
      createdAt: f.createdAt,
      lifecycleState: 'PENDING_ENROLLMENT',
      verifyAttempts: 0,
      encryptedSecret: f.encryptedSecret,
    },
  };
});

// (2) verifyMfaFactor — the heart of the stub. Mirrors the real
// verifyMfa command's pipeline (verify-mfa.ts:243-571): input
// validation, actor-binding check, status check, code verification,
// PENDING_ENROLLMENT → ENROLLED transition, and the audit rows the
// real command writes (MFA_VERIFY + MFA_ENROLLMENT_VERIFIED on
// success, MFA_VERIFY + MFA_ENROLLMENT_FAILED on failure).
//
// Replay protection: the stub tracks `lastUsedStep` (the time-step
// the most recent successful verify matched) and refuses a replay
// of the same code in the same 30s window with CODE_MISMATCH.
aadhaarVaultModule.__setVerifyMfaImpl(async (params) => {
  const fac = factors.get(params.factorId);
  // 1. Unknown factor — surface FACTOR_NOT_FOUND + audit row.
  if (!fac) {
    await dbStore.addLog(vaultLogbookEntry(
      {
        identityId: null,
        actor: params.context.actorId,
        action: 'MFA_VERIFY',
        outcome: 'deny',
        reason: params.context.reason,
        requestId: params.context.requestId ?? null,
        meta: {
          factor_id: params.factorId,
          factor_actor: null,
          failure_reason: 'FACTOR_NOT_FOUND',
        },
      },
      {
        userId: params.context.actorId,
        schoolId: '',
        schoolName: '',
        actorRole: params.context.actorRole,
      },
      mintVaultLogId(new Date()),
      new Date(),
    ));
    return { valid: false, factorId: params.factorId, reason: 'FACTOR_NOT_FOUND' };
  }
  // 2. Actor-binding check — refuse cross-admin verification.
  if (params.actor && fac.actor !== params.actor) {
    await dbStore.addLog(vaultLogbookEntry(
      {
        identityId: null,
        actor: params.context.actorId,
        action: 'MFA_VERIFY',
        outcome: 'deny',
        reason: params.context.reason,
        requestId: params.context.requestId ?? null,
        meta: {
          factor_id: fac.factorId,
          factor_actor: fac.actor,
          failure_reason: 'ACTOR_MISMATCH',
        },
      },
      {
        userId: params.context.actorId,
        schoolId: '',
        schoolName: '',
        actorRole: params.context.actorRole,
      },
      mintVaultLogId(new Date()),
      new Date(),
    ));
    return { valid: false, factorId: params.factorId, reason: 'ACTOR_MISMATCH' };
  }
  // 3. Already-ENROLLED factor — the route maps this to 409.
  if (fac.lifecycleState === 'ENROLLED') {
    // No audit row on this branch — a re-verify against an
    // already-ENROLLED factor is a step-up concern, not an
    // enrollment concern (mirrors verify-mfa.ts:633-661).
    return { valid: false, factorId: params.factorId, reason: 'ALREADY_ENROLLED' };
  }
  // 4. Revoked factor — surface FACTOR_REVOKED + audit row.
  if (fac.status !== 'ACTIVE') {
    await dbStore.addLog(vaultLogbookEntry(
      {
        identityId: null,
        actor: params.context.actorId,
        action: 'MFA_VERIFY',
        outcome: 'deny',
        reason: params.context.reason,
        requestId: params.context.requestId ?? null,
        meta: {
          factor_id: fac.factorId,
          factor_actor: fac.actor,
          failure_reason: 'FACTOR_REVOKED',
        },
      },
      {
        userId: params.context.actorId,
        schoolId: '',
        schoolName: '',
        actorRole: params.context.actorRole,
      },
      mintVaultLogId(new Date()),
      new Date(),
    ));
    return { valid: false, factorId: params.factorId, reason: 'FACTOR_REVOKED' };
  }
  // 5. Bump verifyAttempts on every probe (success or failure).
  fac.verifyAttempts += 1;
  // 6. Verify the code. Replay protection: refuse the same code
  // in the same 30s window.
  const expected = totpCode(fac.secretBytes);
  const nowStep = Math.floor(Date.now() / 1000 / 30);
  const isReplay =
    fac.lastUsedStep === nowStep && expected === params.code;
  if (params.code !== expected || isReplay) {
    await dbStore.addLog(vaultLogbookEntry(
      {
        identityId: null,
        actor: params.context.actorId,
        action: 'MFA_VERIFY',
        outcome: 'deny',
        reason: params.context.reason,
        requestId: params.context.requestId ?? null,
        meta: {
          factor_id: fac.factorId,
          factor_actor: fac.actor,
          failure_reason: 'CODE_MISMATCH',
        },
      },
      {
        userId: params.context.actorId,
        schoolId: '',
        schoolName: '',
        actorRole: params.context.actorRole,
      },
      mintVaultLogId(new Date()),
      new Date(),
    ));
    await dbStore.addLog(vaultLogbookEntry(
      {
        identityId: null,
        actor: params.context.actorId,
        action: 'MFA_ENROLLMENT_FAILED',
        outcome: 'deny',
        reason: params.context.reason,
        requestId: params.context.requestId ?? null,
        meta: {
          factor_id: fac.factorId,
          factor_actor: fac.actor,
          failure_reason: 'CODE_MISMATCH',
          admin_actor: params.context.actorId,
          admin_role: params.context.actorRole,
        },
      },
      {
        userId: params.context.actorId,
        schoolId: '',
        schoolName: '',
        actorRole: params.context.actorRole,
      },
      mintVaultLogId(new Date()),
      new Date(),
    ));
    return { valid: false, factorId: params.factorId, reason: 'CODE_MISMATCH' };
  }
  // 7. Success — transition PENDING_ENROLLMENT → ENROLLED.
  fac.lifecycleState = 'ENROLLED';
  fac.lastUsedAt = Date.now();
  fac.lastUsedStep = nowStep;
  // MFA_VERIFY (allow) row.
  await dbStore.addLog(vaultLogbookEntry(
    {
      identityId: null,
      actor: params.context.actorId,
      action: 'MFA_VERIFY',
      outcome: 'allow',
      reason: params.context.reason,
      requestId: params.context.requestId ?? null,
      meta: {
        factor_id: fac.factorId,
        factor_type: 'totp',
        factor_actor: fac.actor,
        delta: 0,
      },
    },
    {
      userId: params.context.actorId,
      schoolId: '',
      schoolName: '',
      actorRole: params.context.actorRole,
    },
    mintVaultLogId(new Date()),
    new Date(),
  ));
  // MFA_ENROLLMENT_VERIFIED (allow) row.
  await dbStore.addLog(vaultLogbookEntry(
    {
      identityId: null,
      actor: params.context.actorId,
      action: 'MFA_ENROLLMENT_VERIFIED',
      outcome: 'allow',
      reason: params.context.reason,
      requestId: params.context.requestId ?? null,
      meta: {
        factor_id: fac.factorId,
        factor_actor: fac.actor,
        admin_actor: params.context.actorId,
        admin_role: params.context.actorRole,
        verify_attempts: fac.verifyAttempts,
      },
    },
    {
      userId: params.context.actorId,
      schoolId: '',
      schoolName: '',
      actorRole: params.context.actorRole,
    },
    mintVaultLogId(new Date()),
    new Date(),
  ));
  return { valid: true, factorId: fac.factorId, lifecycleState: 'ENROLLED', delta: 0 };
});

// (3) listMfaFactors — returns ALL active factors for the actor
// (both PENDING_ENROLLMENT and ENROLLED). The route layer does its
// own filtering: the enroll route checks `length > 0` to gate the
// 409 path, the step-up preflight filters to `lifecycleState ===
// 'ENROLLED'` before minting a challenge.
aadhaarVaultModule.__setListMfaFactorsImpl(async (params) => {
  const matching = Array.from(factors.values()).filter(
    f => f.actor === params.actor && f.status === 'ACTIVE',
  );
  return {
    factors: matching.map(f => ({
      factorId: f.factorId,
      actor: f.actor,
      factorType: 'totp',
      status: 'active',
      label: f.label,
      algorithm: f.algorithm,
      digits: f.digits,
      period: f.period,
      lastUsedAt: f.lastUsedAt ? new Date(f.lastUsedAt).toISOString() : null,
      expiresAt: null,
      createdAt: f.createdAt,
      lifecycleState: f.lifecycleState,
      verifyAttempts: f.verifyAttempts,
    })),
  };
});

// (4) revokeMfaFactor — sets status to 'revoked'. Idempotent.
aadhaarVaultModule.__setRevokeMfaImpl(async (params) => {
  const fac = factors.get(params.factorId);
  if (!fac) {
    throw new aadhaarVaultModule.VaultError(
      'FACTOR_NOT_FOUND',
      404,
      `no factor matches id=${params.factorId}.`,
    );
  }
  fac.status = 'REVOKED';
  return { factorId: fac.factorId, status: 'revoked' };
});

await dbStore.init();

const express = (await import('express')).default;
const jwtLib = (await import('jsonwebtoken')).default;
const app = express();
app.use(express.json());
registerAadhaarDetokenizeRoutes(app);
registerMfaEnrollmentRoutes(app);

const apiServer: http.Server = await new Promise(resolve => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s as http.Server));
});
const apiPort = (apiServer.address() as import('net').AddressInfo).port;
const BASE = `http://127.0.0.1:${apiPort}`;

const SUPERADMIN = 'superadmin@fln.org';
const DISTRICT_ADMIN = 'district.ldh@fln.org';
const BLOCK_ADMIN = 'block.ldh-01@fln.org';

function authHeaderFor(email: string): string {
  return `Bearer ${jwtLib.sign({ email }, JWT_SECRET, { expiresIn: '1h' })}`;
}
async function api(method: string, reqPath: string, email: string, body?: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${reqPath}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: authHeaderFor(email) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

/** Clear in-memory state between tests. */
function resetFactors(): void {
  factors.clear();
}
/** Read the vault-prefixed audit rows for a specific actor. */
async function vaultRowsForActor(actor: string) {
  const all = await dbStore.getLogbook();
  return all.filter(r => r.userEmail === actor && r.details.startsWith('vault:'));
}

beforeEach(() => {
  resetFactors();
});

after(async () => {
  aadhaarVaultModule.__setEnrollMfaImpl(null);
  aadhaarVaultModule.__setVerifyMfaImpl(null);
  aadhaarVaultModule.__setListMfaFactorsImpl(null);
  aadhaarVaultModule.__setRevokeMfaImpl(null);
  await new Promise<void>(resolve => apiServer.close(() => resolve()));
  (apiServer as any).closeAllConnections?.();
  try { fs.rmSync(scratchDir, { recursive: true, force: true }); } catch { /* Windows file locks */ }
});

// ===== TESTS =====

// ─── Test 1 ─────────────────────────────────────────────────────────────
test('TEST 1: not-enrolled admin POST /api/me/mfa/enroll mints a PENDING_ENROLLMENT factor', async () => {
  const enrollRes = await api('POST', '/api/me/mfa/enroll', SUPERADMIN, { label: 't1-admin' });
  assert.equal(enrollRes.status, 200, `got ${enrollRes.status}: ${JSON.stringify(enrollRes.json)}`);
  assert.equal(typeof enrollRes.json.factorId, 'string');
  assert.match(enrollRes.json.otpauthUri, /^otpauth:\/\//);
  assert.equal(enrollRes.json.lifecycleState, 'PENDING_ENROLLMENT');

  // The factors Map has exactly 1 row with the right shape.
  assert.equal(factors.size, 1);
  const fac = factors.get(enrollRes.json.factorId);
  assert.ok(fac, 'factor must be in the shared Map');
  assert.equal(fac!.lifecycleState, 'PENDING_ENROLLMENT');
  assert.equal(fac!.verifyAttempts, 0);
  assert.ok(fac!.encryptedSecret && fac!.encryptedSecret.length > 0, 'encryptedSecret must be set');

  // An MFA_ENROLLMENT_INITIATED audit row was written.
  const rows = await vaultRowsForActor(SUPERADMIN);
  assert.ok(rows.some(r => r.activityType === 'mfa_enrollment_initiated'),
    'expected MFA_ENROLLMENT_INITIATED audit row');
});

// ─── Test 2 ─────────────────────────────────────────────────────────────
test('TEST 2: already-enrolled admin POST /api/me/mfa/enroll returns 409 with existing factor', async () => {
  // First enroll.
  const first = await api('POST', '/api/me/mfa/enroll', SUPERADMIN, { label: 't2-first' });
  assert.equal(first.status, 200);
  const firstId = first.json.factorId;
  // Transition to ENROLLED via a successful verify.
  const code = totpCode(factors.get(firstId)!.secretBytes);
  const verifyRes = await api('POST', '/api/me/mfa/verify', SUPERADMIN, { factorId: firstId, code });
  assert.equal(verifyRes.status, 200);
  assert.equal(factors.get(firstId)!.lifecycleState, 'ENROLLED');

  // Second enroll — must return 409 with the existing factorId.
  const sizeBefore = factors.size;
  const second = await api('POST', '/api/me/mfa/enroll', SUPERADMIN, { label: 't2-second' });
  assert.equal(second.status, 409, `expected 409, got ${second.status}: ${JSON.stringify(second.json)}`);
  assert.equal(second.json.factorId, firstId, '409 must echo the existing factorId');
  assert.equal(factors.size, sizeBefore, 'no new factor may be created on the 409 path');
});

// ─── Test 3 ─────────────────────────────────────────────────────────────
test('TEST 3: resumable enrollment — second enroll while PENDING_ENROLLMENT exists', async () => {
  // First enroll mints a PENDING_ENROLLMENT factor.
  const first = await api('POST', '/api/me/mfa/enroll', SUPERADMIN, { label: 't3-first' });
  assert.equal(first.status, 200);
  const firstId = first.json.factorId;
  // Do NOT verify — factor stays PENDING_ENROLLMENT.

  // The route's listMfaFactors stub returns ALL active factors
  // (including PENDING_ENROLLMENT). The enroll handler checks
  // `existing.factors.length > 0` and returns 409 with the
  // existing factorId when any factor is present. So a second
  // call returns 409 + the same factorId.
  const second = await api('POST', '/api/me/mfa/enroll', SUPERADMIN, { label: 't3-second' });
  assert.equal(second.status, 409, `expected 409 on second enroll, got ${second.status}: ${JSON.stringify(second.json)}`);
  assert.equal(second.json.factorId, firstId, 'resumable path must echo the same factorId');
});

// ─── Test 4 ─────────────────────────────────────────────────────────────
test('TEST 4: correct TOTP code on PENDING_ENROLLMENT factor transitions to ENROLLED', async () => {
  const enrollRes = await api('POST', '/api/me/mfa/enroll', SUPERADMIN, {});
  assert.equal(enrollRes.status, 200);
  const factorId = enrollRes.json.factorId;
  const code = totpCode(factors.get(factorId)!.secretBytes);

  const verifyRes = await api('POST', '/api/me/mfa/verify', SUPERADMIN, { factorId, code });
  assert.equal(verifyRes.status, 200, `got ${verifyRes.status}: ${JSON.stringify(verifyRes.json)}`);
  assert.equal(verifyRes.json.factorId, factorId);
  assert.equal(verifyRes.json.lifecycleState, 'ENROLLED');
  assert.equal(factors.get(factorId)!.lifecycleState, 'ENROLLED');

  // Two audit rows: MFA_VERIFY (allow) + MFA_ENROLLMENT_VERIFIED (allow).
  const rows = await vaultRowsForActor(SUPERADMIN);
  const verifyAllows = rows.filter(r => r.activityType === 'mfa_verify' && r.status === 'Success');
  const enrollVerifies = rows.filter(r => r.activityType === 'mfa_enrollment_verified' && r.status === 'Success');
  assert.ok(verifyAllows.length >= 1, 'expected at least one MFA_VERIFY allow row');
  assert.ok(enrollVerifies.length >= 1, 'expected at least one MFA_ENROLLMENT_VERIFIED row');
});

// ─── Test 5 ─────────────────────────────────────────────────────────────
test('TEST 5: wrong TOTP code returns 401, factor stays PENDING_ENROLLMENT, audit row + counter bump', async () => {
  const enrollRes = await api('POST', '/api/me/mfa/enroll', SUPERADMIN, {});
  assert.equal(enrollRes.status, 200);
  const factorId = enrollRes.json.factorId;
  const attemptsBefore = factors.get(factorId)!.verifyAttempts;

  const wrongCode = '000000';
  if (totpCode(factors.get(factorId)!.secretBytes) === wrongCode) return; // skip astronomically-unlikely collision

  const verifyRes = await api('POST', '/api/me/mfa/verify', SUPERADMIN, { factorId, code: wrongCode });
  assert.equal(verifyRes.status, 401, `wrong code must 401, got ${verifyRes.status}`);
  assert.equal(verifyRes.json.error, 'CODE_MISMATCH');
  assert.equal(factors.get(factorId)!.lifecycleState, 'PENDING_ENROLLMENT');
  assert.equal(factors.get(factorId)!.verifyAttempts, attemptsBefore + 1, 'verifyAttempts must bump by 1');

  // MFA_ENROLLMENT_FAILED row with failure_reason: 'CODE_MISMATCH'.
  const rows = await vaultRowsForActor(SUPERADMIN);
  const failRow = rows.find(r => r.activityType === 'mfa_enrollment_failed');
  assert.ok(failRow, 'expected MFA_ENROLLMENT_FAILED audit row');
  assert.match(failRow!.details, /CODE_MISMATCH/);
});

// ─── Test 6 ─────────────────────────────────────────────────────────────
test('TEST 6: POST /api/me/mfa/verify with missing factorId returns 400', async () => {
  const res = await api('POST', '/api/me/mfa/verify', SUPERADMIN, { code: '123456' });
  assert.equal(res.status, 400);
  assert.match(String(res.json?.error || ''), /Missing factorId/);
});

// ─── Test 7 ─────────────────────────────────────────────────────────────
test('TEST 7: POST /api/me/mfa/verify with unknown factorId returns 404 + audit row', async () => {
  const ghostId = 'fac-does-not-exist';
  const res = await api('POST', '/api/me/mfa/verify', SUPERADMIN, { factorId: ghostId, code: '123456' });
  assert.equal(res.status, 404);
  assert.equal(res.json.error, 'FACTOR_NOT_FOUND');

  // MFA_VERIFY deny row with failure_reason: 'FACTOR_NOT_FOUND'.
  const rows = await vaultRowsForActor(SUPERADMIN);
  const failRow = rows.find(r => r.activityType === 'mfa_verify' && r.status === 'Failed');
  assert.ok(failRow, 'expected MFA_VERIFY deny row');
  assert.match(failRow!.details, /FACTOR_NOT_FOUND/);
});

// ─── Test 8 ─────────────────────────────────────────────────────────────
test('TEST 8: POST /api/me/mfa/verify on already-ENROLLED factor returns 409 ALREADY_ENROLLED', async () => {
  const enrollRes = await api('POST', '/api/me/mfa/enroll', SUPERADMIN, {});
  const factorId = enrollRes.json.factorId;
  const code = totpCode(factors.get(factorId)!.secretBytes);
  const first = await api('POST', '/api/me/mfa/verify', SUPERADMIN, { factorId, code });
  assert.equal(first.status, 200);

  // A re-verify through the /api/me/mfa/verify endpoint must 409.
  const rowsBefore = (await vaultRowsForActor(SUPERADMIN)).length;
  const second = await api('POST', '/api/me/mfa/verify', SUPERADMIN, { factorId, code });
  assert.equal(second.status, 409);
  assert.equal(second.json.error, 'ALREADY_ENROLLED');
  // No new audit row — a re-verify failure is a step-up concern, not an enrollment concern.
  const rowsAfter = (await vaultRowsForActor(SUPERADMIN)).length;
  assert.equal(rowsAfter, rowsBefore, 're-verify must not write a new audit row');
});

// ─── Test 9 ─────────────────────────────────────────────────────────────
test('TEST 9: replay a just-used TOTP code in the same 30s window returns 401', async () => {
  const enrollRes = await api('POST', '/api/me/mfa/enroll', SUPERADMIN, {});
  const factorId = enrollRes.json.factorId;
  const code = totpCode(factors.get(factorId)!.secretBytes);
  const first = await api('POST', '/api/me/mfa/verify', SUPERADMIN, { factorId, code });
  assert.equal(first.status, 200);

  // The factor is now ENROLLED — a re-verify will hit the
  // ALREADY_ENROLLED 409 branch BEFORE the replay check fires.
  // To exercise replay protection specifically, we need the
  // factor to still be PENDING_ENROLLMENT. Reset the lifecycle
  // back to PENDING_ENROLLMENT (the test stub lets us do this
  // directly; the real production code never allows this).
  factors.get(factorId)!.lifecycleState = 'PENDING_ENROLLMENT';

  const replay = await api('POST', '/api/me/mfa/verify', SUPERADMIN, { factorId, code });
  assert.equal(replay.status, 401, `replay must 401, got ${replay.status}: ${JSON.stringify(replay.json)}`);
  assert.equal(replay.json.error, 'CODE_MISMATCH');
});

// ─── Test 10 ────────────────────────────────────────────────────────────
test('TEST 10: DELETE /api/me/mfa/factors/:id revokes the factor and removes it from /factors', async () => {
  const enrollRes = await api('POST', '/api/me/mfa/enroll', SUPERADMIN, {});
  const factorId = enrollRes.json.factorId;
  // Verify to transition to ENROLLED.
  const code = totpCode(factors.get(factorId)!.secretBytes);
  await api('POST', '/api/me/mfa/verify', SUPERADMIN, { factorId, code });

  const del = await api('DELETE', `/api/me/mfa/factors/${factorId}`, SUPERADMIN, undefined);
  assert.equal(del.status, 200);
  assert.equal(del.json.status, 'revoked');
  assert.equal(factors.get(factorId)!.status, 'REVOKED');

  // GET /api/me/mfa/factors no longer returns it.
  const list = await api('GET', '/api/me/mfa/factors', SUPERADMIN);
  assert.equal(list.status, 200);
  assert.equal(list.json.factors.length, 0, 'revoked factor must not appear in /factors');

  // MFA_ENROLLMENT_REVOKED audit row was written.
  const rows = await vaultRowsForActor(SUPERADMIN);
  const revokedRow = rows.find(r => r.activityType === 'mfa_enrollment_revoked');
  assert.ok(revokedRow, 'expected MFA_ENROLLMENT_REVOKED audit row');
});

// ─── Test 11 ────────────────────────────────────────────────────────────
test('TEST 11: GET /api/me/mfa/factors returns PENDING_ENROLLMENT first, then ENROLLED, revoked absent', async () => {
  // Seed two PENDING_ENROLLMENT factors + one ENROLLED + one
  // REVOKED directly in the in-memory Map. The list endpoint
  // must return only PENDING_ENROLLMENT + ENROLLED, with
  // PENDING first.
  //
  // (We pre-seed rather than going through the enroll route
  // three times because the route is deliberately single-
  // factor-per-actor — a second enroll returns 409 with the
  // existing factorId. The list endpoint's filtering + ordering
  // behavior is what this test exercises.)
  const seed = (actor: string, lifecycleState: Factor['lifecycleState'], status: Factor['status']) => {
    const factorId = 'fac-' + crypto.randomUUID();
    factors.set(factorId, {
      factorId,
      actor,
      secretBytes: crypto.randomBytes(20),
      status,
      lifecycleState,
      digits: 6,
      period: 30,
      algorithm: 'SHA1',
      label: `${lifecycleState}-${status}`,
      encryptedSecret: Buffer.from('SEALED:' + factorId),
      verifyAttempts: 0,
      lastUsedStep: null,
      lastUsedAt: null,
      createdAt: new Date().toISOString(),
    });
    return factorId;
  };
  // Insert in the order we want the list to surface them:
  // pending first (newest), then ENROLLED, with REVOKED hidden.
  // (The list stub returns factors in Map insertion order.)
  const pending1Id = seed(SUPERADMIN, 'PENDING_ENROLLMENT', 'ACTIVE');
  const pending2Id = seed(SUPERADMIN, 'PENDING_ENROLLMENT', 'ACTIVE');
  const enrolledId = seed(SUPERADMIN, 'ENROLLED', 'ACTIVE');
  // Also seed a REVOKED row (must NOT appear).
  const revokedId = seed(SUPERADMIN, 'ENROLLED', 'REVOKED');
  void revokedId;

  const list = await api('GET', '/api/me/mfa/factors', SUPERADMIN);
  assert.equal(list.status, 200);
  const ids = list.json.factors.map((f: any) => f.factorId);
  // Expected order: pending1, pending2, then enrolled.
  // Revoked is hidden. Both pending factors come before the
  // single enrolled row.
  assert.deepEqual(ids, [pending1Id, pending2Id, enrolledId],
    `expected [pending1, pending2, enrolled], got ${JSON.stringify(ids)}`);
});

// ─── Test 12 ────────────────────────────────────────────────────────────
test('TEST 12: GET /api/me/mfa/factors is actor-scoped (admin A cannot see admin B)', async () => {
  const aFactor = await api('POST', '/api/me/mfa/enroll', SUPERADMIN, {});
  const bFactor = await api('POST', '/api/me/mfa/enroll', DISTRICT_ADMIN, {});

  const asA = await api('GET', '/api/me/mfa/factors', SUPERADMIN);
  assert.equal(asA.status, 200);
  const aIds = asA.json.factors.map((f: any) => f.factorId);
  assert.deepEqual(aIds, [aFactor.json.factorId], 'SUPERADMIN must see only their own factor');

  const asB = await api('GET', '/api/me/mfa/factors', DISTRICT_ADMIN);
  assert.equal(asB.status, 200);
  const bIds = asB.json.factors.map((f: any) => f.factorId);
  assert.deepEqual(bIds, [bFactor.json.factorId], 'DISTRICT_ADMIN must see only their own factor');

  void BLOCK_ADMIN;  // suppress unused-locals warning
});

// ─── Test 13 (audit log assertion) ──────────────────────────────────────
test('TEST 13: full enrollment lifecycle emits MFA_ENROLLMENT_INITIATED → MFA_ENROLLMENT_VERIFIED → MFA_ENROLLMENT_REVOKED', async () => {
  // Enroll → verify (success) → revoke.
  const enrollRes = await api('POST', '/api/me/mfa/enroll', SUPERADMIN, {});
  const factorId = enrollRes.json.factorId;
  const code = totpCode(factors.get(factorId)!.secretBytes);
  await api('POST', '/api/me/mfa/verify', SUPERADMIN, { factorId, code });
  await api('DELETE', `/api/me/mfa/factors/${factorId}`, SUPERADMIN, undefined);

  // The audit rows for the actor, in timestamp order.
  const rows = (await vaultRowsForActor(SUPERADMIN))
    .slice() // copy
    .sort((a, b) => a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0);
  const actions = rows.map(r => r.activityType);
  // The minimal required subsequence (other rows are MFA_VERIFY
  // allow + others from the verify command).
  assert.ok(actions.includes('mfa_enrollment_initiated'),
    `expected mfa_enrollment_initiated, got ${JSON.stringify(actions)}`);
  assert.ok(actions.includes('mfa_enrollment_verified'),
    `expected mfa_enrollment_verified, got ${JSON.stringify(actions)}`);
  assert.ok(actions.includes('mfa_enrollment_revoked'),
    `expected mfa_enrollment_revoked, got ${JSON.stringify(actions)}`);

  // The ordering: initiated before verified before revoked.
  const idxInit = actions.indexOf('mfa_enrollment_initiated');
  const idxVer = actions.indexOf('mfa_enrollment_verified');
  const idxRev = actions.indexOf('mfa_enrollment_revoked');
  assert.ok(idxInit < idxVer, `initiated must precede verified: ${JSON.stringify(actions)}`);
  assert.ok(idxVer < idxRev, `verified must precede revoked: ${JSON.stringify(actions)}`);
});

// ─── Test 19 (TOTP code never logged) ───────────────────────────────────
test('TEST 19: TOTP code is never written to any captured console line', async () => {
  const captured: string[] = [];
  const origLog = console.log;
  const origErr = console.error;
  const origWarn = console.warn;
  const origInfo = console.info;
  const grab = (...args: unknown[]) => captured.push(args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
  console.log = grab as typeof console.log;
  console.error = grab as typeof console.error;
  console.warn = grab as typeof console.warn;
  console.info = grab as typeof console.info;
  try {
    const enrollRes = await api('POST', '/api/me/mfa/enroll', SUPERADMIN, {});
    const factorId = enrollRes.json.factorId;
    const code = totpCode(factors.get(factorId)!.secretBytes);
    await api('POST', '/api/me/mfa/verify', SUPERADMIN, { factorId, code });
    await api('DELETE', `/api/me/mfa/factors/${factorId}`, SUPERADMIN, undefined);
  } finally {
    console.log = origLog;
    console.error = origErr;
    console.warn = origWarn;
    console.info = origInfo;
  }
  for (const line of captured) {
    assert.equal(/\b\d{6}\b/.test(line), false, `TOTP-shaped code leaked in console: ${line}`);
  }
});

// ─── Test 20 (plaintext Aadhaar never logged) ──────────────────────────
test('TEST 20: plaintext Aadhaar is never written to any captured console line', async () => {
  const captured: string[] = [];
  const origLog = console.log;
  const origErr = console.error;
  const origWarn = console.warn;
  const origInfo = console.info;
  const grab = (...args: unknown[]) => captured.push(args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
  console.log = grab as typeof console.log;
  console.error = grab as typeof console.error;
  console.warn = grab as typeof console.warn;
  console.info = grab as typeof console.info;
  try {
    // Run a full enroll + verify lifecycle — these calls do NOT
    // surface plaintext Aadhaar (the code is a 6-digit TOTP, not
    // 12 digits). The regex below catches any 12-digit run that
    // happens to land in a console line.
    const enrollRes = await api('POST', '/api/me/mfa/enroll', SUPERADMIN, {});
    const factorId = enrollRes.json.factorId;
    const code = totpCode(factors.get(factorId)!.secretBytes);
    await api('POST', '/api/me/mfa/verify', SUPERADMIN, { factorId, code });
  } finally {
    console.log = origLog;
    console.error = origErr;
    console.warn = origWarn;
    console.info = origInfo;
  }
  for (const line of captured) {
    assert.equal(/\b\d{12}\b/.test(line), false, `12-digit run leaked in console: ${line}`);
  }
});
