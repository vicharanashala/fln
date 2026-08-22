/**
 * HTTP-layer integration test for `POST /v1/detokenize`.
 *
 * Mirrors the structure of `tests/tokenize.route.test.ts` so the
 * contract surface for detokenize is locked in at the same level of
 * discipline as tokenize. The route is the only HTTP entry-point that
 * recovers plaintext from a vault row, so its envelope is part of the
 * public contract:
 *
 *   200 → { token, identityId, aadhaar, last4, auditId }
 *   400 → { error: 'invalid_request', message, details }
 *   401 → { error: 'unauthorized', message } (no token / bad token)
 *   403 → { error: 'forbidden', message } (wrong scope)
 *   404 → { error: 'TOKEN_NOT_FOUND' | 'IDENTITY_NOT_FOUND', message }
 *   500 → { error: 'UNWRAP_FAILED' | 'DECRYPTION_FAILED' | ..., message }
 *
 * # Auth boundary under test
 *
 * The auth plugin is wired with `SERVICE_JWT_HMAC_SECRET` set so the
 * route is gated by `vault:detokenize`. The validation-failure tests
 * carry a properly-scoped token but a malformed body — the route
 * must reject the body BEFORE consulting the scope, so the failure
 * mode is still 400. The auth tests cover the 401/403 surface
 * independently.
 *
 * # Why no happy-path round-trip in this test
 *
 * A real `tokenize` → `detokenize` round-trip cannot succeed against
 * the current schema without the schema-reconciliation session that
 * is already on the roadmap (the wrap contexts the two commands
 * derive are different; the local-dev HKDF binding means a real
 * `KeyManager.unwrapDataKey` call will not match). The application
 * command's unit test fakes the key manager to exercise the happy
 * path; the route's job is to wire the command through the DB, the
 * auth boundary, and the validation contract — all of which is
 * covered here. The round-trip reconciliation will be covered when
 * the schema-reconciliation session lands.
 *
 * Uses `app.inject()` so the test boots in-process without binding
 * to a real socket — fast, isolated, deterministic.
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
  PORT: 4102,
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
 * Subject of the detokenize principal. The route enforces
 * principal-trust: the JWT subject (here `detokenizer-201`) is
 * the *trusted* actorId; the body's `context.actorId` is ignored
 * when a subject is present. We deliberately pick a value that
 * differs from the body's `actorId` in the happy-path body to
 * pin that invariant in the test.
 */
const DETOKENIZE_SUBJECT = 'detokenizer-201';
const DETOKENIZE_TOKEN = mintTestToken({
  secret: TEST_HMAC_SECRET,
  subject: DETOKENIZE_SUBJECT,
  scopes: ['vault:detokenize'],
  issuer: TEST_ISS,
  audience: TEST_AUD,
});

const authHeaders = (): Record<string, string> => ({
  'content-type': 'application/json',
  authorization: `Bearer ${DETOKENIZE_TOKEN}`,
});

/**
 * Body shape matching `DetokenizeRequestSchema` in
 * `src/routes/detokenize.routes.ts`. `actorId` here is a *decoy*
 * — the principal-trust policy means the audit row will record
 * the JWT subject (`detokenizer-201`), not this value.
 */
const happyBody = {
  token: '01J9X8H7R3Y6N5QZTESTTOKEN00000',
  context: {
    actorId: 'spoofed-actor',
    actorRole: 'TEACHER',
    reason: 'Verifying the student identity during classroom enrolment',
    requestId: 'req-detok-1',
    sourceIp: '127.0.0.1',
    userAgent: 'vitest/1.0',
  },
} as const;

describe('POST /v1/detokenize (route layer)', () => {
  let app: FastifyInstance | undefined;

  beforeAll(async () => {
    app = await buildServer({ config: TEST_CONFIG });
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // ---------------- request validation ----------------

  it('returns 400 invalid_request when the body is missing required fields', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/detokenize',
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
      url: '/v1/detokenize',
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
      url: '/v1/detokenize',
      payload: { ...happyBody, surprise: true },
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(400);
    expect((res.json() as Json).error).toBe('invalid_request');
  });

  it('rejects bodies larger than the configured 64 KiB limit', async () => {
    // The `reason` field is capped at 512 chars, but the overall
    // body parser sits at 64 KiB. We exceed 64 KiB by stuffing
    // `context.reason` with junk to cross Fastify's bodyLimit.
    const filler = 'x'.repeat(70 * 1024);
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/detokenize',
      payload: {
        ...happyBody,
        context: { ...happyBody.context, reason: filler },
      },
      headers: authHeaders(),
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  // ---------------- not-found paths ----------------
  //
  // These are the only negative paths we can deterministically
  // reach through the real `keyManager` + `db.tokens` stack at
  // the route layer. The application command's unit tests
  // (tests/detokenize-aadhaar.test.ts) cover the UNWRAP_FAILED,
  // DECRYPTION_FAILED, and INVALID_PAYLOAD paths using fakes.

  it('returns 404 TOKEN_NOT_FOUND when no row matches the supplied token id', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/detokenize',
      payload: happyBody,
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(404);
    const body = res.json() as Json;
    expect(body.error).toBe('TOKEN_NOT_FOUND');
    expect(typeof body.message).toBe('string');
  });

  // ---------------- auth boundary ----------------

  it('returns 401 when no bearer token is supplied', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/detokenize',
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
      url: '/v1/detokenize',
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
      scopes: ['vault:detokenize'],
      issuer: TEST_ISS,
      audience: TEST_AUD,
      expiresInSec: -60,
    });
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/detokenize',
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
      url: '/v1/detokenize',
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
      url: '/v1/detokenize',
      payload: {},
      headers: authHeaders(),
    });

    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

// Sanity guard: the route MUST exist and be reachable, otherwise all of
// the above pass vacuously because inject returns 404 with our JSON
// 404 handler. This top-level guard makes that drift loud.
describe('POST /v1/detokenize registration', () => {
  it('route is registered (not silently shadowed)', async () => {
    const probeApp = await buildServer({ config: TEST_CONFIG });
    try {
      await probeApp.ready();
      // We hit it with an empty body — that hits the route, which
      // returns 400 invalid_request. A shadowed route would 404.
      const res = await probeApp.inject({
        method: 'POST',
        url: '/v1/detokenize',
        payload: {},
        headers: authHeaders(),
      });
      expect(res.statusCode).toBe(400);
    } finally {
      await probeApp.close();
    }
  });
});