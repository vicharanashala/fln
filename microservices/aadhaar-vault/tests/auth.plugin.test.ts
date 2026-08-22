/**
 * Integration test for the auth plugin (`src/auth/plugin.ts`).
 *
 * The plugin is exercised through the only authenticated route we
 * currently have (`POST /v1/tokenize`) and through the only public
 * route (`GET /health`). This test exists to lock in the boundary
 * contract — the things future contributors are most likely to break
 * when touching the plugin:
 *
 *   1. Public routes must NEVER require a bearer token. They must
 *      also NOT treat an absent principal as authenticated.
 *   2. Missing/malformed bearer header returns a stable JSON 401.
 *   3. Verification failures return 401 with a machine-readable `code`
 *      so callers can branch (retry vs. re-auth vs. surface to user).
 *   4. Successful verification populates `request.principal` and a
 *      working `request.requireScope(scope)`.
 *   5. `requireScope` rejects with 403 (not 500) when the principal
 *      lacks the scope. This is the regression guard for the central
 *      error handler — without it, scope failures would surface as 500
 *      and look identical to backend outages.
 *
 * Uses `app.inject()` to avoid binding to a real socket.
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

describe('auth plugin: public vs. authenticated boundary', () => {
  let app: FastifyInstance | undefined;

  beforeAll(async () => {
    app = await buildServer({ config: TEST_CONFIG });
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // --- public: must NOT require a token ---

  it('GET /health is reachable without a bearer token (200)', async () => {
    const res = await app!.inject({ method: 'GET', url: '/health' });
    // /health returns liveness; readiness may fail in test (no DB
    // override) and surface as 503. Both are acceptable — what we
    // care about is "not 401".
    expect(res.statusCode).not.toBe(401);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('GET /health ignores an Authorization header entirely', async () => {
    const garbage = 'Bearer obviously-not-a-jwt';
    const res = await app!.inject({
      method: 'GET',
      url: '/health',
      headers: { authorization: garbage },
    });
    expect(res.statusCode).not.toBe(401);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  // --- authenticated: missing token ---

  it('returns 401 unauthorized when Authorization header is absent', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/tokenize',
      payload: {},
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json() as Json;
    expect(body.error).toBe('unauthorized');
    expect(typeof body.message).toBe('string');
    expect((body.message as string).toLowerCase()).toContain('authorization');
  });

  it('returns 401 when Authorization header is not Bearer', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/tokenize',
      payload: {},
      headers: {
        'content-type': 'application/json',
        authorization: 'Basic dXNlcjpwYXNz',
      },
    });
    expect(res.statusCode).toBe(401);
    expect((res.json() as Json).error).toBe('unauthorized');
  });

  // --- authenticated: malformed / expired / wrong signature ---

  it('returns 401 with code=token_malformed for a non-JWT Bearer value', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/tokenize',
      payload: {},
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

  it('returns 401 with code=token_expired for a JWT in the past', async () => {
    const expired = mintTestToken({
      secret: TEST_HMAC_SECRET,
      subject: 'user-1',
      scopes: ['vault:tokenize'],
      issuer: TEST_ISS,
      audience: TEST_AUD,
      expiresInSec: -120,
    });
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/tokenize',
      payload: {},
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

  it('returns 401 with code=signature_invalid when the secret does not match', async () => {
    const wrongSecret = mintTestToken({
      secret: 'this-is-a-different-secret-of-32-bytes-or-more-pad',
      subject: 'user-1',
      scopes: ['vault:tokenize'],
      issuer: TEST_ISS,
      audience: TEST_AUD,
    });
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/tokenize',
      payload: {},
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${wrongSecret}`,
      },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json() as Json;
    expect(body.error).toBe('unauthorized');
    expect(body.code).toBe('signature_invalid');
  });

  it('returns 401 with code=issuer_mismatch when iss is wrong', async () => {
    const wrongIss = mintTestToken({
      secret: TEST_HMAC_SECRET,
      subject: 'user-1',
      scopes: ['vault:tokenize'],
      issuer: 'some-other-issuer',
      audience: TEST_AUD,
    });
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/tokenize',
      payload: {},
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${wrongIss}`,
      },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json() as Json;
    expect(body.code).toBe('issuer_mismatch');
  });

  // --- authenticated: scope enforcement ---

  it('returns 403 forbidden (NOT 500) when the token lacks the scope', async () => {
    const wrongScope = mintTestToken({
      secret: TEST_HMAC_SECRET,
      subject: 'user-1',
      scopes: ['vault:read'],
      issuer: TEST_ISS,
      audience: TEST_AUD,
    });
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/tokenize',
      payload: {},
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${wrongScope}`,
      },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json() as Json;
    expect(body.error).toBe('forbidden');
    expect(typeof body.message).toBe('string');
    expect((body.message as string)).toMatch(/vault:tokenize/);
  });
});