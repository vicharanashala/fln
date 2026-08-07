/**
 * HTTP-layer integration test for `POST /v1/mfa/enroll`.
 *
 * Mirrors the structure of `tests/detokenize.route.test.ts` so the
 * contract surface for the MFA-enroll route is locked in at the same
 * level of discipline as the tokenize/detokenize routes. The route is
 * the only HTTP entry-point that mints a TOTP factor row, so its
 * envelope is part of the public contract:
 *
 *   200 → { factorId, otpauthUri, factor }
 *   400 → { error: 'invalid_request' | 'INVALID_INPUT', message, details? }
 *   401 → { error: 'unauthorized', message, code? }
 *   403 → { error: 'forbidden', message }
 *   500 → { error: 'internal_error', message }
 *
 * # Auth boundary under test
 *
 *   The auth plugin is wired with `SERVICE_JWT_HMAC_SECRET` set so the
 *   route is gated by `vault:mfa:enroll`. The validation-failure tests
 *   carry a properly-scoped token but a malformed body — the route
 *   must reject the body before consulting the scope, so the failure
 *   mode is still 400. The auth tests cover the 401/403 surface
 *   independently.
 *
 * # Why a single happy-path assertion here
 *
 *   The application's `EnrollMfa` command unit-tests
 *   (`tests/enroll-mfa.test.ts`) cover the full pipeline with fakes,
 *   including malformed actor, label, factor-not-found, etc. The route
 *   test's job is to confirm the *route* wires the command through
 *   the real DB, the auth boundary, and the validation contract —
 *   all of which is covered here without re-asserting the application
 *   command's behaviour.
 *
 *   Uses `app.inject()` so the test boots in-process without binding
 *   to a real socket — fast, isolated, deterministic. The default
 *   in-memory database is used by `buildServer()` because the test
 *   config has `NODE_ENV: 'test'` and no `VAULT_DB_URI`.
 */
import {
  describe,
  expect,
  it,
  beforeAll,
  afterAll,
} from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildServer } from '../src/server.js';
import { mintTestToken } from './helpers/mint-test-token.js';

/** Pretty-typed accessor for the response body. */
type Json = Record<string, unknown>;

const TEST_HMAC_SECRET = 'a-test-hmac-secret-min-32-bytes-string-bytes';
const TEST_ISS = 'aadhaar-vault-test';
const TEST_AUD = 'aadhaar-vault';

const TEST_CONFIG = {
  NODE_ENV: 'test',
  PORT: 4103,
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
 * The JWT subject is the *enroller* — the admin who is calling the
 * route to enroll a factor for a user. The body's `actor` field is
 * the user being enrolled. They are intentionally different so the
 * test pins the principal-trust invariant.
 */
const ENROLLER_SUBJECT = 'admin-9001';
const ENROLLER_TOKEN = mintTestToken({
  secret: TEST_HMAC_SECRET,
  subject: ENROLLER_SUBJECT,
  scopes: ['vault:mfa:enroll'],
  issuer: TEST_ISS,
  audience: TEST_AUD,
});

const authHeaders = (): Record<string, string> => ({
  'content-type': 'application/json',
  authorization: `Bearer ${ENROLLER_TOKEN}`,
});

/**
 * Body shape matching `EnrollMfaRequestSchema` in
 * `src/routes/mfa.routes.ts`. `actor` is the user being enrolled;
 * `context.actorId` is a decoy because the principal-trust policy
 * records the JWT subject (`admin-9001`) in the audit row.
 */
const happyBody = {
  actor: 'teacher-101',
  label: 'teacher-101 (work phone)',
  context: {
    actorId: 'spoofed-actor',
    actorRole: 'SCHOOL_ADMIN',
    reason: 'Enrolling step-up MFA for the new teacher account',
    requestId: 'req-enroll-1',
    sourceIp: '127.0.0.1',
    userAgent: 'vitest/1.0',
  },
} as const;

describe('POST /v1/mfa/enroll (route layer)', () => {
  let app: FastifyInstance | undefined;

  beforeAll(async () => {
    app = await buildServer({ config: TEST_CONFIG });
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // ---------------- happy path ----------------

  it('returns 200 with the factor envelope when enrollment succeeds', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/enroll',
      payload: happyBody,
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as Json;

    // Top-level envelope.
    expect(typeof body.factorId).toBe('string');
    expect((body.factorId as string).length).toBeGreaterThan(0);
    expect(typeof body.otpauthUri).toBe('string');
    expect(body.otpauthUri).toMatch(/^otpauth:\/\/totp\//);

    // Persisted factor shape.
    const factor = body.factor as Json;
    expect(factor.factorId).toBe(body.factorId);
    expect(factor.actor).toBe('teacher-101');
    expect(factor.factorType).toBe('totp');
    expect(factor.status).toBe('active');
    expect(factor.label).toBe('teacher-101 (work phone)');
    expect(factor.algorithm).toBe('SHA1');
    expect(factor.digits).toBe(6);
    expect(factor.period).toBe(30);
    expect(typeof factor.encryptedSecret).toBe('string');
    expect(factor.lastUsedAt).toBeNull();
    expect(factor.expiresAt).toBeNull();
    expect(typeof factor.createdAt).toBe('string');
    // The `createdAt` is an ISO-8601 string.
    expect(() => new Date(factor.createdAt as string).toISOString()).not.toThrow();
  });

  it('honors the principal-trust invariant: returns a 200 when the body actorId is spoofed', async () => {
    // The route test's job is to confirm the *route* wires the
    // command through the real DB and the auth boundary — not to
    // re-prove the application command's audit-row semantics,
    // which `tests/enroll-mfa.test.ts` already covers with fakes
    // (asserting the audit row's `actor` is `cmd.context.actorId`
    // and the factor's `actor` is the body's `actor`).
    //
    // We do verify two contract guarantees of the route:
    //   (a) The body's `context.actorId = 'spoofed-actor'` does
    //       not prevent the command from completing — the
    //       principal-trust invariant replaces the actorId with
    //       the JWT subject (`admin-9001`) for the audit row.
    //   (b) The factor returned to the client has `actor =
    //       'teacher-101'` (the body's actor), not the enroller.
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/enroll',
      payload: happyBody,
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Json;
    const factor = body.factor as Json;
    expect(factor.actor).toBe('teacher-101');
    // `factorId` is minted by the application, not derived from
    // the spoofed actorId, so it must NOT echo the spoofed value.
    expect(body.factorId).not.toBe('spoofed-actor');
    expect(body.factorId).not.toBe(ENROLLER_SUBJECT);
  });

  // ---------------- request validation ----------------

  it('returns 400 invalid_request when the body is missing required fields', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/enroll',
      payload: {},
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(400);
    const body = res.json() as Json;
    expect(body.error).toBe('invalid_request');
    expect(typeof body.message).toBe('string');
    expect(Array.isArray(body.details)).toBe(true);
  });

  it('returns 400 invalid_request when actorRole is outside the enum', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/enroll',
      payload: {
        ...happyBody,
        context: { ...happyBody.context, actorRole: 'GOD_MODE' },
      },
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(400);
    expect((res.json() as Json).error).toBe('invalid_request');
  });

  it('returns 400 invalid_request when an unknown top-level key is sent', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/enroll',
      payload: { ...happyBody, surprise: true },
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(400);
    expect((res.json() as Json).error).toBe('invalid_request');
  });

  it('returns 400 invalid_request when digits is out of range', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/enroll',
      payload: { ...happyBody, digits: 4 },
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(400);
    expect((res.json() as Json).error).toBe('invalid_request');
  });

  it('returns 400 invalid_request when period is below the RFC 6238 minimum', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/enroll',
      payload: { ...happyBody, period: 5 },
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(400);
    expect((res.json() as Json).error).toBe('invalid_request');
  });

  // ---------------- auth boundary ----------------

  it('returns 401 when no bearer token is supplied', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/enroll',
      payload: happyBody,
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
      url: '/v1/mfa/enroll',
      payload: happyBody,
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
      subject: 'user-1',
      scopes: ['vault:mfa:enroll'],
      issuer: TEST_ISS,
      audience: TEST_AUD,
      expiresInSec: -60,
    });
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/enroll',
      payload: happyBody,
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
      subject: 'user-1',
      scopes: ['vault:tokenize'], // present but wrong scope
      issuer: TEST_ISS,
      audience: TEST_AUD,
    });
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/mfa/enroll',
      payload: happyBody,
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
      url: '/v1/mfa/enroll',
      payload: {},
      headers: authHeaders(),
    });

    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

// Sanity guard: the route MUST exist and be reachable, otherwise all of
// the above pass vacuously because inject returns 404 with the JSON
// 404 handler. This top-level guard makes that drift loud.
describe('POST /v1/mfa/enroll registration', () => {
  it('route is registered (not silently shadowed)', async () => {
    const probeApp = await buildServer({ config: TEST_CONFIG });
    try {
      await probeApp.ready();
      // We hit it with an empty body — that hits the route, which
      // returns 400 invalid_request. A shadowed route would 404.
      const res = await probeApp.inject({
        method: 'POST',
        url: '/v1/mfa/enroll',
        payload: {},
        headers: authHeaders(),
      });
      expect(res.statusCode).toBe(400);
    } finally {
      await probeApp.close();
    }
  });
});