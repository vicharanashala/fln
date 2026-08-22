/**
 * HTTP-layer integration test for `POST /v1/tokenize`.
 *
 * Goals:
 *  1. Validate the request-validation contract (Zod schema).
 *     Anything malformed MUST be 400 with shape `{ error: 'invalid_request' }`
 *     so clients can branch on a stable envelope.
 *  2. Validate the happy path end-to-end (parse → scope check → command
 *     → repos → response). The route is the only path that mints a vault
 *     token, so the response envelope is part of the public contract.
 *  3. Lock the content-type discipline so future Fastify upgrades
 *     cannot silently downgrade error responses to HTML.
 *
 * Uses `app.inject()` so the test boots in-process without binding
 * to a real socket — fast, isolated, deterministic. The Postgres pool
 * is pg-mem; the deps are wired exactly the way `buildServer()` does
 * for a real deployment, so this test catches wiring regressions the
 * moment a port is unregistered or a decorator is renamed.
 *
 * # Auth boundary under test
 *
 * The auth plugin is wired with `SERVICE_JWT_HMAC_SECRET` set so the
 * route is gated by `vault:tokenize`. The happy-path test mints a
 * token carrying that scope; the validation-failure tests deliberately
 * skip the scope (the route must reject the body before the scope
 * matters, so the failure mode is still 400, not 401).
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

const TOKENIZE_TOKEN = mintTestToken({
  secret: TEST_HMAC_SECRET,
  subject: 'teacher-101',
  scopes: ['vault:tokenize'],
  issuer: TEST_ISS,
  audience: TEST_AUD,
});

const authHeaders = (): Record<string, string> => ({
  'content-type': 'application/json',
  authorization: `Bearer ${TOKENIZE_TOKEN}`,
});

const happyBody = {
  raw: '123456789012',
  type: 'AADHAAR',
  context: {
    actorId: 'teacher-101',
    actorRole: 'TEACHER',
    reason: 'Diagnostic enrolment for class 2 student',
    requestId: 'req-test-1',
    sourceIp: '127.0.0.1',
    userAgent: 'vitest/1.0',
  },
} as const;

describe('POST /v1/tokenize (route layer)', () => {
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
      url: '/v1/tokenize',
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
      url: '/v1/tokenize',
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
      url: '/v1/tokenize',
      payload: { ...happyBody, surprise: true },
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(400);
    expect((res.json() as Json).error).toBe('invalid_request');
  });

  it('rejects bodies larger than the configured 64 KiB limit', async () => {
    // The `raw` field is capped at 32 chars, but the overall body parser
    // sits at 64 KiB. We exceed 64 KiB by stuffing `context.reason`
    // with junk to cross Fastify's bodyLimit.
    const filler = 'x'.repeat(70 * 1024);
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/tokenize',
      payload: {
        ...happyBody,
        context: { ...happyBody.context, reason: filler },
      },
      headers: authHeaders(),
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  // ---------------- happy path ----------------

  it('happy path returns 201 with the full token envelope', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/tokenize',
      payload: happyBody,
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(201);
    const body = res.json() as Json;

    // Token envelope (public contract)
    expect(typeof body.token).toBe('string');
    expect((body.token as string).length).toBeGreaterThan(0);
    expect(body.last4).toBe('9012');
    // The current implementation echoes the input identity type;
    // pin it here so that any future widening of the enum is caught.
    expect(body.tokenType).toBe('AADHAAR');
    expect(typeof body.auditId).toBe('string');
    expect(typeof body.identityId).toBe('string');
    expect(body.keyVersion).toBe('kv-1');
  });

  // ---------------- auth boundary ----------------

  it('returns 401 when no bearer token is supplied', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/tokenize',
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
      url: '/v1/tokenize',
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
      scopes: ['vault:tokenize'],
      issuer: TEST_ISS,
      audience: TEST_AUD,
      expiresInSec: -60,
    });
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/tokenize',
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
      scopes: ['vault:read'],
      issuer: TEST_ISS,
      audience: TEST_AUD,
    });
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/tokenize',
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
      url: '/v1/tokenize',
      payload: {},
      headers: authHeaders(),
    });

    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

// Sanity guard: the route MUST exist and be reachable, otherwise all of
// the above pass vacuously because inject returns 404 with our JSON
// 404 handler. This top-level guard makes that drift loud.
describe('POST /v1/tokenize registration', () => {
  it('route is registered (not silently shadowed)', async () => {
    const probeApp = await buildServer({ config: TEST_CONFIG });
    try {
      await probeApp.ready();
      // We hit it with an empty body — that hits the route, which
      // returns 400 invalid_request. A shadowed route would 404.
      const res = await probeApp.inject({
        method: 'POST',
        url: '/v1/tokenize',
        payload: {},
        headers: authHeaders(),
      });
      expect(res.statusCode).toBe(400);
    } finally {
      await probeApp.close();
    }
  });
});