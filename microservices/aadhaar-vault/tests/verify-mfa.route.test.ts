/**
 * HTTP-layer integration test for `POST /v1/mfa/verify`.
 *
 * Mirrors `tests/enroll-mfa.route.test.ts`: same `app.inject()`
 * pattern, same JWT helper, same in-memory database. The route's
 * job is to wire the application-layer `VerifyMfa` command through
 * the real DB + auth boundary + Zod validation. The command-level
 * failure-mode coverage (FACTOR_REVOKED, FACTOR_EXPIRED,
 * ACTOR_MISMATCH, CODE_MISMATCH, FACTOR_NOT_FOUND) lives in
 * `tests/verify-mfa.test.ts`; here we assert the HTTP envelope and
 * the 401-mapping discipline.
 *
 * # Test seed strategy
 *
 *   The test seeds factors directly via `app.db.mfa.insert(...)` so
 *   the suite is independent of the enroll route. The factor's
 *   `encryptedSecret` is sealed by a parallel `LocalDevKeyManager`
 *   built with the same `LOCAL_DEV_MASTER_KEY` as the server, so
 *   the command's `keyManager.openSecret(...)` round-trip succeeds.
 *   The plaintext secret is then handed to a parallel
 *   `OtpAuthTotpVerifier` to derive the *current* TOTP code the
 *   caller would type — this avoids monkey-patching `Date.now`.
 *
 * # Status mapping locked in
 *
 *   200 → { valid: true, factorId, actor, delta, factor: { … } }
 *   400 → { error: 'invalid_request' | 'INVALID_INPUT', message, details? }
 *   401 → { valid: false, factorId, error: <reason>, message }
 *         (reasons: FACTOR_NOT_FOUND, FACTOR_REVOKED, FACTOR_EXPIRED,
 *         ACTOR_MISMATCH, CODE_MISMATCH — all collapse to 401)
 *   401 → { error: 'unauthorized', message, code? }      (no token / bad token)
 *   403 → { error: 'forbidden', message }                (wrong scope)
 *   500 → { error: 'internal_error', message }
 *   503 → { error: 'service_unavailable', message }      (deps unwired)
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
  PORT: 4104,
  HOST: '127.0.0.1',
  LOG_LEVEL: 'silent',
  KEY_PROVIDER: 'local-dev',
  LOCAL_DEV_MASTER_KEY: Buffer.alloc(32, 0x42).toString('base64'),
  KEY_VERSION: 'kv-1',
  SERVICE_JWT_HMAC_SECRET: TEST_HMAC_SECRET,
  SERVICE_JWT_ISSUER: TEST_ISS,
  SERVICE_JWT_AUDIENCE: TEST_AUD,
} as const;

/**
 * The route enforces `actorId === factor.actor` via the principal-trust
 * invariant: the JWT subject is the trusted principal attempting the
 * step-up. Tests that exercise a successful verify MUST seed the factor
 * under the same `actor` as the JWT subject.
 */
const PRINCIPAL = 'teacher-101';
const OTHER_PRINCIPAL = 'teacher-202';
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

/**
 * Per-factor context. The keyManager + totp verifier are the same
 * configuration the server uses (same master key, same TOTP params),
 * so the command's `openSecret` succeeds and the test can derive
 * the *current* TOTP code the user would type.
 */
const keyManager = new LocalDevKeyManager({
  keyVersion: 'kv-1',
  masterKey: Buffer.alloc(32, 0x42),
  acknowledgedUnsafe: false,
});
const totpVerifier = new OtpAuthTotpVerifier();

/**
 * Seal a raw TOTP shared secret under the per-factor context the
 * `VerifyMfa` command expects (`mfa-factor:<factorId>`).
 */
async function sealSecretForFactor(
  factorId: string,
  rawSecret: Buffer,
): Promise<Buffer> {
  const ctx = Buffer.from(`mfa-factor:${factorId}`, 'utf8');
  const wrapped = await keyManager.sealSecret(rawSecret, ctx);
  return Buffer.from(wrapped.bytes);
}

/**
 * Seed an `active` factor for the principal under test. Returns the
 * factorId so the test can refer to it in the verify request.
 */
async function seedActiveFactor(
  app: FastifyInstance,
  factorId: string,
  actor: string,
  opts: { expiresAt?: Date | null } = {},
): Promise<void> {
  const rawSecret = Buffer.alloc(20, 0x42);
  const encryptedSecret = await sealSecretForFactor(factorId, rawSecret);
  await app.db!.mfa.insert({
    factorId,
    actor,
    factorType: 'totp',
    label: `${actor} (work phone)`,
    encryptedSecret,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    expiresAt: opts.expiresAt ?? null,
  });
}

/**
 * Derive the *current* TOTP code the user would type at "now" for a
 * given raw secret. The verifier's `currentCode` honors the same
 * algorithm/digits the factor was seeded with (SHA-1, 6 digits).
 */
async function currentCodeFor(rawSecret: Buffer): Promise<string> {
  return totpVerifier.currentCode(rawSecret, Date.now());
}

/**
 * Body matching `VerifyMfaRequestSchema`. `factorId` / `code` are
 * test-specific so each scenario supplies its own.
 */
function happyBody(factorId: string, code: string): Json {
  return {
    factorId,
    code,
    context: {
      actorRole: 'TEACHER',
      reason: 'Step-up verification before detokenize',
      requestId: 'req-verify-1',
      sourceIp: '127.0.0.1',
      userAgent: 'vitest/1.0',
    },
  };
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

  // Reset the in-memory MFA repo between tests so factor ids do not
  // collide. The enroll route tests share the same boot; here we own
  // the seed lifecycle.
  beforeEach(async () => {
    if (app?.db?.mfa) {
      const ids = await app.db.mfa.listByActor(PRINCIPAL);
      for (const f of ids) {
        // The repository does not expose `delete`; revocation is the
        // closest available signal. We rely on unique factor ids per
        // test to avoid cross-test interference.
        await app.db.mfa.revoke(f.factorId);
      }
      const others = await app.db.mfa.listByActor(OTHER_PRINCIPAL);
      for (const f of others) {
        await app.db.mfa.revoke(f.factorId);
      }
    }
  });

  // ---------------- happy path ----------------

  it('returns 200 with valid:true and a sanitized factor envelope on a correct code', async () => {
    const factorId = `factor-happy-${Date.now()}`;
    const rawSecret = Buffer.alloc(20, 0x11);
    const encryptedSecret = await sealSecretForFactor(factorId, rawSecret);
    await app!.db!.mfa.insert({
      factorId,
      actor: PRINCIPAL,
      factorType: 'totp',
      label: 'happy path',
      encryptedSecret,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      expiresAt: null,
    });
    const code = await currentCodeFor(rawSecret);

    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/verify',
      payload: happyBody(factorId, code),
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as Json;
    expect(body.valid).toBe(true);
    expect(body.factorId).toBe(factorId);
    expect(body.actor).toBe(PRINCIPAL);
    expect(typeof body.delta).toBe('number');

    const factor = body.factor as Json;
    expect(factor.factorId).toBe(factorId);
    expect(factor.actor).toBe(PRINCIPAL);
    expect(factor.factorType).toBe('totp');
    expect(factor.status).toBe('active');
    expect(factor.algorithm).toBe('SHA1');
    expect(factor.digits).toBe(6);
    expect(factor.period).toBe(30);
    expect(typeof factor.lastUsedAt).toBe('string');
    expect(factor.expiresAt).toBeNull();
    expect(typeof factor.createdAt).toBe('string');
    // Plaintext hygiene: encryptedSecret MUST NOT be echoed.
    expect(factor.encryptedSecret).toBeUndefined();
  });

  it('enforces the principal-trust invariant: a foreign JWT subject yields ACTOR_MISMATCH → 401', async () => {
    const factorId = `factor-trust-${Date.now()}`;
    await seedActiveFactor(app!, factorId, PRINCIPAL);
    const code = '123456';

    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/verify',
      payload: happyBody(factorId, code),
      headers: authHeaders(OTHER_VERIFIER_TOKEN),
    });

    expect(res.statusCode).toBe(401);
    const body = res.json() as Json;
    expect(body.valid).toBe(false);
    expect(body.factorId).toBe(factorId);
    expect(body.error).toBe('ACTOR_MISMATCH');
    expect(typeof body.message).toBe('string');
  });

  // ---------------- verification failure modes ----------------

  it('returns 401 with FACTOR_NOT_FOUND when the factor does not exist', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/verify',
      payload: happyBody(`ghost-${Date.now()}`, '123456'),
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(401);
    const body = res.json() as Json;
    expect(body.valid).toBe(false);
    expect(body.error).toBe('FACTOR_NOT_FOUND');
    expect(body.factorId).toMatch(/^ghost-/);
  });

  it('returns 401 with FACTOR_REVOKED when the factor is revoked', async () => {
    const factorId = `factor-revoked-${Date.now()}`;
    await seedActiveFactor(app!, factorId, PRINCIPAL);
    await app!.db!.mfa.revoke(factorId);

    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/verify',
      payload: happyBody(factorId, '123456'),
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(401);
    const body = res.json() as Json;
    expect(body.valid).toBe(false);
    expect(body.error).toBe('FACTOR_REVOKED');
  });

  it('returns 401 with FACTOR_EXPIRED when the factor is past its expiresAt', async () => {
    const factorId = `factor-expired-${Date.now()}`;
    await seedActiveFactor(app!, factorId, PRINCIPAL, {
      expiresAt: new Date('2025-01-01T00:00:00.000Z'),
    });

    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/verify',
      payload: happyBody(factorId, '123456'),
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(401);
    const body = res.json() as Json;
    expect(body.valid).toBe(false);
    expect(body.error).toBe('FACTOR_EXPIRED');
  });

  it('returns 401 with CODE_MISMATCH when the typed code is wrong', async () => {
    const factorId = `factor-wrong-code-${Date.now()}`;
    await seedActiveFactor(app!, factorId, PRINCIPAL);

    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/verify',
      payload: happyBody(factorId, '000000'),
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(401);
    const body = res.json() as Json;
    expect(body.valid).toBe(false);
    expect(body.error).toBe('CODE_MISMATCH');
  });

  // ---------------- request validation ----------------

  it('returns 400 invalid_request when the body is missing required fields', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/verify',
      payload: {},
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(400);
    const body = res.json() as Json;
    expect(body.error).toBe('invalid_request');
    expect(typeof body.message).toBe('string');
    expect(Array.isArray(body.details)).toBe(true);
  });

  it('returns 400 invalid_request when factorId is missing', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/verify',
      payload: { code: '123456', context: happyBody('x', '123456').context },
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(400);
    expect((res.json() as Json).error).toBe('invalid_request');
  });

  it('returns 400 invalid_request when the code has the wrong shape', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/verify',
      payload: { ...happyBody('x', '12345'), code: 'abc123' },
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(400);
    expect((res.json() as Json).error).toBe('invalid_request');
  });

  it('returns 400 invalid_request when window is out of range', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/verify',
      payload: { ...happyBody('x', '123456'), window: 99 },
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(400);
    expect((res.json() as Json).error).toBe('invalid_request');
  });

  it('returns 400 invalid_request when an unknown top-level key is sent', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/verify',
      payload: { ...happyBody('x', '123456'), surprise: true },
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(400);
    expect((res.json() as Json).error).toBe('invalid_request');
  });

  it('returns 400 invalid_request when reason is too short', async () => {
    const body = happyBody('x', '123456');
    const ctx = body.context as Json;
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/verify',
      payload: { ...body, context: { ...ctx, reason: 'too short' } },
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(400);
    expect((res.json() as Json).error).toBe('invalid_request');
  });

  // ---------------- auth boundary ----------------

  it('returns 401 when no bearer token is supplied', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/verify',
      payload: happyBody('x', '123456'),
      headers: { 'content-type': 'application/json' },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json() as Json;
    expect(body.error).toBe('unauthorized');
    expect(typeof body.message).toBe('string');
  });

  it('returns 401 when the bearer token is malformed', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/verify',
      payload: happyBody('x', '123456'),
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer not-a-jwt',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json() as Json;
    expect(body.error).toBe('unauthorized');
    expect(body.code).toBe('token_malformed');
  });

  it('returns 401 when the bearer token is expired', async () => {
    const expired = mintTestToken({
      secret: TEST_HMAC_SECRET,
      subject: PRINCIPAL,
      scopes: ['vault:mfa:verify'],
      issuer: TEST_ISS,
      audience: TEST_AUD,
      expiresInSec: -60,
    });
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/verify',
      payload: happyBody('x', '123456'),
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${expired}`,
      },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json() as Json;
    expect(body.error).toBe('unauthorized');
    expect(body.code).toBe('token_expired');
  });

  it('returns 403 when the token lacks the required scope', async () => {
    const wrongScopeToken = mintTestToken({
      secret: TEST_HMAC_SECRET,
      subject: PRINCIPAL,
      scopes: ['vault:tokenize'], // present but wrong scope
      issuer: TEST_ISS,
      audience: TEST_AUD,
    });
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/verify',
      payload: happyBody('x', '123456'),
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${wrongScopeToken}`,
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json() as Json;
    expect(body.error).toBe('forbidden');
    expect(typeof body.message).toBe('string');
    expect(body.message).toMatch(/scope/);
  });

  // ---------------- content-type discipline ----------------

  it('returns JSON even on error (not HTML)', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/verify',
      payload: {},
      headers: authHeaders(),
    });

    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

// Sanity guard: the route MUST exist and be reachable, otherwise all of
// the above pass vacuously because inject returns 404 with the JSON
// 404 handler. This top-level guard makes that drift loud.
describe('POST /v1/mfa/verify registration', () => {
  it('route is registered (not silently shadowed)', async () => {
    const probeApp = await buildServer({ config: TEST_CONFIG });
    try {
      await probeApp.ready();
      const res = await probeApp.inject({
        method: 'POST',
        url: '/v1/mfa/verify',
        payload: {},
        headers: authHeaders(),
      });
      // We hit it with an empty body — that hits the route, which
      // returns 400 invalid_request. A shadowed route would 404.
      expect(res.statusCode).toBe(400);
    } finally {
      await probeApp.close();
    }
  });
});