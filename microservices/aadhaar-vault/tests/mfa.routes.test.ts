/**
 * HTTP-layer coverage for `POST /v1/mfa/verify` after the Session 7C
 * extension: the route must continue to support the legacy
 * (factorId+code only) envelope, and additionally accept an optional
 * `challengeId`. When a challengeId is supplied, the route must
 * approve the matching step-up challenge AFTER the TOTP verification
 * succeeds. The route stays a thin orchestration layer; all
 * decision-making lives in `VerifyMfa` / `ApproveStepUpChallenge`.
 *
 * Contract pinned here:
 *   200 (legacy)  → { valid: true, factorId, ... }
 *   200 (challenge) → { verified: true, challengeApproved: true, factorId, challengeId }
 *   400  → INVALID_INPUT  (Zod failure)
 *   401  → unauthorized   (no / bad token)
 *   401  → invalid_token  (command refused, e.g. CODE_MISMATCH,
 *                          ACTOR_MISMATCH, FACTOR_NOT_FOUND, ...)
 *   403  → forbidden      (wrong scope)
 *   404  → challenge not found
 *   410  → challenge expired
 *   422  → challenge already approved / pending / factor mismatch
 *   500  → internal_error
 *
 * Test seed strategy mirrors `tests/verify-mfa.route.test.ts`:
 *   * factor is seeded directly through `app.db.mfa.insert(...)`
 *     with a TOTP secret sealed by a parallel `LocalDevKeyManager`
 *     configured with the same master key as the server;
 *   * the current TOTP code is derived via a parallel
 *     `OtpAuthTotpVerifier` so we don't monkey-patch `Date.now`;
 *   * for the challenge-mode tests, the challenge row is seeded
 *     directly via `app.db.challenges.create(...)` so we don't
 *     depend on `/v1/detokenize/request` to set the scene.
 */
import {
  describe,
  expect,
  it,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildServer } from '../src/server.js';
import { mintTestToken } from './helpers/mint-test-token.js';
import { LocalDevKeyManager } from '../src/infrastructure/key-providers/local-dev-key-manager.js';
import { OtpAuthTotpVerifier } from '../src/infrastructure/mfa/totp-verifier.js';

type Json = Record<string, unknown>;

const TEST_HMAC_SECRET = 'a-test-hmac-secret-min-32-bytes-string-bytes';
const TEST_ISS = 'aadhaar-vault-test';
const TEST_AUD = 'aadhaar-vault';

const TEST_CONFIG = {
  NODE_ENV: 'test',
  PORT: 4105,
  HOST: '127.0.0.1',
  LOG_LEVEL: 'silent',
  KEY_PROVIDER: 'local-dev',
  LOCAL_DEV_MASTER_KEY: Buffer.alloc(32, 0x42).toString('base64'),
  KEY_VERSION: 'kv-1',
  SERVICE_JWT_HMAC_SECRET: TEST_HMAC_SECRET,
  SERVICE_JWT_ISSUER: TEST_ISS,
  SERVICE_JWT_AUDIENCE: TEST_AUD,
} as const;

const PRINCIPAL = 'teacher-101';
const OTHER_PRINCIPAL = 'teacher-202';
const IDENTITY_ID = '01HIDENTITYMFA0000000000000';

const VERIFIER_TOKEN = mintTestToken({
  secret: TEST_HMAC_SECRET,
  subject: PRINCIPAL,
  scopes: ['vault:mfa:verify'],
  issuer: TEST_ISS,
  audience: TEST_AUD,
});
const OTHER_VERIFIER_TOKEN = mintTestToken({
  secret: TEST_HMAC_SECRET,
  subject: OTHER_PRINCIPAL,
  scopes: ['vault:mfa:verify'],
  issuer: TEST_ISS,
  audience: TEST_AUD,
});

const authHeaders = (token = VERIFIER_TOKEN): Record<string, string> => ({
  'content-type': 'application/json',
  authorization: `Bearer ${token}`,
});

const keyManager = new LocalDevKeyManager({
  keyVersion: 'kv-1',
  masterKey: Buffer.alloc(32, 0x42),
  acknowledgedUnsafe: false,
});
const totpVerifier = new OtpAuthTotpVerifier();

async function sealSecretForFactor(
  factorId: string,
  rawSecret: Buffer,
): Promise<Buffer> {
  const ctx = Buffer.from(`mfa-factor:${factorId}`, 'utf8');
  const wrapped = await keyManager.sealSecret(rawSecret, ctx);
  return Buffer.from(wrapped.bytes);
}

async function uniqueFactorId(label: string): Promise<string> {
  return `01HFACTOR${label}-${Date.now().toString(36).padStart(15, '0')}`.slice(
    0,
    26,
  );
}

async function uniqueChallengeId(label: string): Promise<string> {
  return `01HCHALL${label}-${Date.now().toString(36).padStart(15, '0')}`.slice(
    0,
    26,
  );
}

async function uniqueTokenId(label: string): Promise<string> {
  return `01JTOKEN${label}-${Date.now().toString(36).padStart(15, '0')}`.slice(
    0,
    26,
  );
}

async function seedActiveFactor(
  app: FastifyInstance,
  factorId: string,
  actor: string,
): Promise<{ secret: Buffer; currentCode: string }> {
  // 20-byte secret → standard TOTP strength.
  const secret = Buffer.from('12345678901234567890', 'utf8');
  const encryptedSecret = await sealSecretForFactor(factorId, secret);
  await app.db!.mfa.insert({
    factorId,
    actor,
    factorType: 'totp',
    label: 'route-test',
    encryptedSecret,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    expiresAt: null,
  });
  const currentCode = await totpVerifier.currentCode(secret, Date.now());
  return { secret, currentCode };
}

async function seedIdentity(app: FastifyInstance, identityId: string) {
  await app.db!.identities.insert({
    identityId,
    ciphertext: Buffer.from([0x01, 0x02, 0x03]),
    aad: Buffer.from(`identity:${identityId}`, 'utf8'),
    pepperVersion: 1,
    keyVersion: 1,
  });
}

async function seedPendingChallenge(
  app: FastifyInstance,
  challengeId: string,
  requiredFactorId: string,
  options: { expiresInMs?: number; requestedBy?: string; tokenId?: string | null } = {},
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (options.expiresInMs ?? 60_000));
  await app.db!.challenges.create({
    challengeId,
    operation: 'detokenize',
    identityId: IDENTITY_ID,
    tokenId: options.tokenId ?? null,
    requestedBy: options.requestedBy ?? PRINCIPAL,
    requestedAt: now,
    expiresAt,
    requiredFactorId,
    metadata: null,
  });
}

describe('POST /v1/mfa/verify (route layer)', () => {
  let app: FastifyInstance | undefined;

  beforeAll(async () => {
    app = await buildServer({ config: TEST_CONFIG });
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(async () => {
    if (!app) throw new Error('app not built');
    if (!app.db) throw new Error('db not wired');
    await seedIdentity(app, IDENTITY_ID);
  });

  // -----------------------------------------------------------
  // Legacy envelope — factorId + code, no challengeId
  // -----------------------------------------------------------
  describe('legacy path (no challengeId)', () => {
    it('happy path: valid TOTP returns 200 with valid=true', async () => {
      if (!app) throw new Error('app not built');
      const factorId = await uniqueFactorId('LEGACYHAPPY');
      const { currentCode } = await seedActiveFactor(app, factorId, PRINCIPAL);
      const res = await app.inject({
        method: 'POST',
        url: '/v1/mfa/verify',
        headers: authHeaders(),
        payload: { factorId, code: currentCode },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as Json;
      expect(body.valid).toBe(true);
      expect(body.factorId).toBe(factorId);
      expect(body.challengeApproved).toBeUndefined();
    });

    it('wrong code returns 401 with INVALID_TOKEN envelope', async () => {
      if (!app) throw new Error('app not built');
      const factorId = await uniqueFactorId('LEGACYWRONG');
      await seedActiveFactor(app, factorId, PRINCIPAL);
      const res = await app.inject({
        method: 'POST',
        url: '/v1/mfa/verify',
        headers: authHeaders(),
        payload: { factorId, code: '000000' },
      });
      expect(res.statusCode).toBe(401);
      const body = res.json() as Json;
      expect(body.valid).toBe(false);
      expect(['INVALID_TOKEN', 'CODE_MISMATCH']).toContain(body.error);
    });

    it('actor mismatch returns 401 ACTOR_MISMATCH', async () => {
      if (!app) throw new Error('app not built');
      const factorId = await uniqueFactorId('LEGACYACTOR');
      await seedActiveFactor(app, factorId, PRINCIPAL); // owned by PRINCIPAL, not OTHER
      // Use a parallel LocalDevKeyManager + OtpAuthTotpVerifier to derive a real code:
      const rawSecret = Buffer.from('12345678901234567890', 'utf8');
      const wrapped = await keyManager.sealSecret(
        rawSecret,
        Buffer.from(`mfa-factor:${factorId}`, 'utf8'),
      );
      // Re-insert with the new secret so verify can open it
      await app.db!.mfa.insert({
        factorId,
        actor: PRINCIPAL,
        factorType: 'totp',
        label: 'actor-mismatch-test',
        encryptedSecret: Buffer.from(wrapped.bytes),
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        expiresAt: null,
      });
      const currentCode = await totpVerifier.currentCode(
        rawSecret,
        Date.now(),
      );
      const res = await app.inject({
        method: 'POST',
        url: '/v1/mfa/verify',
        headers: authHeaders(OTHER_VERIFIER_TOKEN),
        payload: { factorId, code: currentCode },
      });
      expect(res.statusCode).toBe(401);
      const body = res.json() as Json;
      expect(body.valid).toBe(false);
      expect(body.error).toBe('ACTOR_MISMATCH');
    });

    it('invalid body (missing code) returns 400 INVALID_INPUT', async () => {
      if (!app) throw new Error('app not built');
      const factorId = await uniqueFactorId('LEGACYINVALID');
      await seedActiveFactor(app, factorId, PRINCIPAL);
      const res = await app.inject({
        method: 'POST',
        url: '/v1/mfa/verify',
        headers: authHeaders(),
        payload: { factorId },
      });
      expect(res.statusCode).toBe(400);
      const body = res.json() as Json;
      expect(body.code).toBe('INVALID_INPUT');
    });

    it('missing Authorization header returns 401 unauthorized', async () => {
      if (!app) throw new Error('app not built');
      const res = await app.inject({
        method: 'POST',
        url: '/v1/mfa/verify',
        headers: { 'content-type': 'application/json' },
        payload: { factorId: '01HFACTORANY000000000000000', code: '123456' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('wrong scope returns 403 forbidden', async () => {
      if (!app) throw new Error('app not built');
      const wrongScope = mintTestToken({
        secret: TEST_HMAC_SECRET,
        subject: PRINCIPAL,
        scopes: ['vault:tokenize'],
        issuer: TEST_ISS,
        audience: TEST_AUD,
      });
      const res = await app.inject({
        method: 'POST',
        url: '/v1/mfa/verify',
        headers: authHeaders(wrongScope),
        payload: { factorId: '01HFACTORANY000000000000000', code: '123456' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // -----------------------------------------------------------
  // Challenge-aware path — factorId + code + challengeId
  // -----------------------------------------------------------
  describe('challenge path (challengeId supplied)', () => {
    it('happy path: verifies TOTP then approves challenge', async () => {
      if (!app) throw new Error('app not built');
      const factorId = await uniqueFactorId('CHAPHAPPY');
      const { currentCode } = await seedActiveFactor(app, factorId, PRINCIPAL);
      const challengeId = await uniqueChallengeId('HAPPY');
      const tokenId = await uniqueTokenId('CHAPHAPPY');
      await seedPendingChallenge(app, challengeId, factorId, { tokenId });

      const res = await app.inject({
        method: 'POST',
        url: '/v1/mfa/verify',
        headers: authHeaders(),
        payload: {
          factorId,
          code: currentCode,
          challengeId,
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as Json;
      expect(body.verified).toBe(true);
      expect(body.challengeApproved).toBe(true);
      expect(body.factorId).toBe(factorId);
      expect(body.challengeId).toBe(challengeId);

      // The challenge row must now be `approved` (visible to
      // DetokenizeAadhaar later).
      const reloaded = await app.db!.challenges.findById(challengeId);
      expect(reloaded?.status).toBe('approved');
    });

    it('wrong TOTP code: challenge stays pending and 401 returned', async () => {
      if (!app) throw new Error('app not built');
      const factorId = await uniqueFactorId('CHAPBADCODE');
      await seedActiveFactor(app, factorId, PRINCIPAL);
      const challengeId = await uniqueChallengeId('BADCODE');
      await seedPendingChallenge(app, challengeId, factorId);

      const res = await app.inject({
        method: 'POST',
        url: '/v1/mfa/verify',
        headers: authHeaders(),
        payload: { factorId, code: '000000', challengeId },
      });
      expect(res.statusCode).toBe(401);

      // Approval MUST NOT have happened — challenge still pending.
      const reloaded = await app.db!.challenges.findById(challengeId);
      expect(reloaded?.status).toBe('pending');
    });

    it('challenge missing: returns 404 CHALLENGE_NOT_FOUND', async () => {
      if (!app) throw new Error('app not built');
      const factorId = await uniqueFactorId('CHAPMISSING');
      const { currentCode } = await seedActiveFactor(app, factorId, PRINCIPAL);
      const res = await app.inject({
        method: 'POST',
        url: '/v1/mfa/verify',
        headers: authHeaders(),
        payload: {
          factorId,
          code: currentCode,
          challengeId: '01HCHALLMISSING00000000000000',
        },
      });
      expect(res.statusCode).toBe(404);
      const body = res.json() as Json;
      expect(body.code).toBe('CHALLENGE_NOT_FOUND');
    });

    it('challenge expired: returns 410 CHALLENGE_EXPIRED', async () => {
      if (!app) throw new Error('app not built');
      const factorId = await uniqueFactorId('CHAPEXPIRED');
      const { currentCode } = await seedActiveFactor(app, factorId, PRINCIPAL);
      const challengeId = await uniqueChallengeId('EXPIRED');
      await seedPendingChallenge(app, challengeId, factorId, {
        expiresInMs: -60_000,
      });
      const res = await app.inject({
        method: 'POST',
        url: '/v1/mfa/verify',
        headers: authHeaders(),
        payload: {
          factorId,
          code: currentCode,
          challengeId,
        },
      });
      expect(res.statusCode).toBe(410);
      const body = res.json() as Json;
      expect(body.code).toBe('CHALLENGE_EXPIRED');
    });

    it('factor mismatch on challenge: returns 422 CHALLENGE_FACTOR_MISMATCH', async () => {
      if (!app) throw new Error('app not built');
      const factorId = await uniqueFactorId('CHAPFACTMIS');
      const { currentCode } = await seedActiveFactor(app, factorId, PRINCIPAL);
      // Challenge pinned to a *different* factor than the one we verify.
      const otherFactorId = await uniqueFactorId('OTHERR');
      const challengeId = await uniqueChallengeId('FACTORMIS');
      await seedPendingChallenge(app, challengeId, otherFactorId);

      const res = await app.inject({
        method: 'POST',
        url: '/v1/mfa/verify',
        headers: authHeaders(),
        payload: {
          factorId,
          code: currentCode,
          challengeId,
        },
      });
      expect(res.statusCode).toBe(422);
      const body = res.json() as Json;
      expect(body.code).toBe('CHALLENGE_FACTOR_MISMATCH');
    });
  });
});