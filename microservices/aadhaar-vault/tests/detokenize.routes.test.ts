/**
 * HTTP-layer coverage for the Session 7C step-up routes:
 *
 *   POST /v1/detokenize/request   — issue a step-up challenge
 *   POST /v1/mfa/verify           — verify TOTP + (optionally) approve challenge
 *   POST /v1/detokenize           — detokenize once the challenge is approved
 *
 * # Why this file injects fake `KeyManager` + `CryptoService`
 *
 * The tokenize ↔ detokenize chain walks three checks that the
 * production adapters (LocalDevKeyManager, NodeCryptoService) bind to
 * specific AAD / wrap-context strings:
 *
 *   - tokenize:    `wrapContext = "wrap:" + identityId`
 *   - detokenize:  `unwrapContext = "detokenize:" + identityId`
 *   - crypto:      `aad = "identity:" + identityId` on both sides
 *
 * Session 7A deliberately binds every wrap-context to the
 * originating actor so a stolen envelope cannot be replayed across
 * operations; Session 8 will reconcile the asymmetry in the
 * application layer. Until that lands, a real round-trip through
 * `POST /v1/tokenize` followed by `POST /v1/detokenize` always
 * raises `UNWRAP_FAILED` (different wrap context) or
 * `DECRYPTION_FAILED` (different AAD).
 *
 * The application-layer unit tests (`tests/detokenize-aadhaar.test.ts`,
 * `tests/request-detokenization.test.ts`) verify the crypto chain
 * with in-test fakes that mirror the chosen `unwrapContext` /
 * `aad` strings. The route tests here focus on **routing +
 * mapping**: Zod validation, scope check, command delegation, and
 * status-code mapping. We therefore inject a *route-test fake* via
 * `buildServer({ keyManager, crypto })` so the route never has to
 * care about the production wrap / AAD binding. The same fake is
 * used to seal the TOTP shared secret during `seedActiveFactor`,
 * so verify-mfa's `openSecret` succeeds end-to-end.
 *
 * Contract pinned here:
 *
 *   request:
 *     200 → { challengeId, expiresAt, requiredFactor }
 *     400 → INVALID_INPUT  (Zod failure)
 *     401 → unauthorized   (no / bad token)
 *     403 → forbidden      (wrong scope)
 *     404 → TOKEN_NOT_FOUND / IDENTITY_NOT_FOUND / FACTOR_NOT_FOUND
 *     422 → CHALLENGE_INVALID / CHALLENGE_OPERATION_MISMATCH
 *     500 → internal_error
 *
 *   detokenize:
 *     200 → { aadhaar }
 *     400 → INVALID_INPUT
 *     401 → unauthorized
 *     403 → forbidden / FACTOR_ACTOR_MISMATCH
 *     404 → TOKEN_NOT_FOUND / IDENTITY_NOT_FOUND / FACTOR_NOT_FOUND /
 *           CHALLENGE_NOT_FOUND
 *     409 → CHALLENGE_NOT_PENDING / CHALLENGE_CONSUMED / CHALLENGE_RACE
 *     410 → CHALLENGE_EXPIRED
 *     422 → CHALLENGE_INVALID / CHALLENGE_OPERATION_MISMATCH /
 *           CHALLENGE_FACTOR_MISMATCH
 *     500 → internal_error
 *
 * Cleanup strategy:
 *   Each test builds and tears down its own Fastify app (and therefore
 *   its own MemoryPool) via beforeEach / afterEach. No cross-test
 *   contamination is possible, so we never have to issue TRUNCATE or
 *   bulk DELETE statements against the in-memory pool.
 */
import {
  describe,
  expect,
  it,
  beforeEach,
  afterEach,
} from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { StepUpOperation } from '../src/application/ports/step-up-challenge.repository.js';
import type { CryptoService } from '../src/application/ports/crypto.service.js';
import type { KeyManager } from '../src/application/ports/key-manager.js';
import type {
    DomainEvent,
    EventPublisher,
} from '../src/application/ports/event-publisher.js';

import { buildServer } from '../src/server.js';
import { mintTestToken } from './helpers/mint-test-token.js';
import { OtpAuthTotpVerifier } from '../src/infrastructure/mfa/totp-verifier.js';
import { InProcessEventPublisher } from '../src/infrastructure/events/in-process-event-publisher.js';

type Json = Record<string, unknown>;

const TEST_HMAC_SECRET = 'a-test-hmac-secret-min-32-bytes-string-bytes';
const TEST_ISS = 'aadhaar-vault-test';
const TEST_AUD = 'aadhaar-vault';

const TEST_CONFIG = {
  NODE_ENV: 'test',
  PORT: 4106,
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
const IDENTITY_ID = '01HIDENTDETOK00000000000000';
const DEFAULT_OPERATION: StepUpOperation = 'detokenize';

const REQUEST_TOKEN = mintTestToken({
  secret: TEST_HMAC_SECRET,
  subject: PRINCIPAL,
  scopes: ['vault:detokenize'],
  issuer: TEST_ISS,
  audience: TEST_AUD,
});
const OTHER_REQUEST_TOKEN = mintTestToken({
  secret: TEST_HMAC_SECRET,
  subject: OTHER_PRINCIPAL,
  scopes: ['vault:detokenize'],
  issuer: TEST_ISS,
  audience: TEST_AUD,
});
const MFA_VERIFY_TOKEN = mintTestToken({
  secret: TEST_HMAC_SECRET,
  subject: PRINCIPAL,
  scopes: ['vault:mfa:verify'],
  issuer: TEST_ISS,
  audience: TEST_AUD,
});
const TOKENIZE_TOKEN = mintTestToken({
  secret: TEST_HMAC_SECRET,
  subject: PRINCIPAL,
  scopes: ['vault:tokenize'],
  issuer: TEST_ISS,
  audience: TEST_AUD,
});

const reqHeaders = (token = REQUEST_TOKEN): Record<string, string> => ({
  'content-type': 'application/json',
  authorization: `Bearer ${token}`,
});
const mfaHeaders = (): Record<string, string> => ({
  'content-type': 'application/json',
  authorization: `Bearer ${MFA_VERIFY_TOKEN}`,
});

/**
 * Valid `context` body for detokenize / request-detokenize endpoints.
 * Mirrors the contract documented on `request-detokenization.routes.ts`
 * and `detokenize.routes.ts`. The actorId is pinned to `PRINCIPAL` so
 * the principal-trust policy (JWT subject overrides body's actorId)
 * resolves to a stable test identity.
 */
const validContext = (actorId: string = PRINCIPAL): Json => ({
  actorId,
  actorRole: 'TEACHER',
  reason: 'route-test detokenize fixture',
  requestId: 'req-route-test-detok',
  sourceIp: '127.0.0.1',
  userAgent: 'vitest/1.0',
});

// ---------------------------------------------------------------------------
// Fake KeyManager
//
// The production `LocalDevKeyManager` binds every wrap to a specific
// context string (`"wrap:<id>"` on the tokenize side, `"detokenize:<id>"`
// on the detokenize side) so a stolen envelope cannot be replayed
// across operations. Session 8 reconciles the asymmetry; until then
// the route tests inject this context-free fake to focus on routing
// & status mapping rather than the cryptographic bindings.
// ---------------------------------------------------------------------------
function makeFakeKeyManager(): KeyManager {
  const CONSTANT_DEK = Buffer.alloc(32, 0xab);
  const CONSTANT_WRAPPED = Buffer.from('cafebabe'.repeat(8), 'hex');
  return {
    async generateDataKey(_ctx: Buffer) {
      return {
        plaintext: Buffer.from(CONSTANT_DEK),
        wrapped: { bytes: Buffer.from(CONSTANT_WRAPPED) },
        keyVersion: 'kv-fake-1',
      };
    },
    async sealSecret(raw: Buffer, _ctx: Buffer) {
      return { bytes: Buffer.from(raw) };
    },
    async openSecret(envelope: { bytes: Buffer }, _ctx: Buffer) {
      return Buffer.from(envelope.bytes);
    },
    async wrapDataKey(_dek: Buffer, _ctx: Buffer) {
      return { bytes: Buffer.from(CONSTANT_WRAPPED) };
    },
    async unwrapDataKey(_wrapped: { bytes: Buffer }, _ctx: Buffer) {
      return Buffer.from(CONSTANT_DEK);
    },
    info() {
      return {
        provider: 'route-test-fake',
        currentVersion: 'kv-fake-1',
        algorithm: 'identity',
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Fake CryptoService
//
// `encrypt` returns the plaintext unchanged as its `ciphertext`, and
// `decrypt` returns the ciphertext unchanged as its plaintext. AAD is
// ignored. This collapses the AES-GCM chain into the identity
// function, which is exactly what route-level tests want — they care
// that the route delegates to `crypto.decrypt`, not that the AES-GCM
// tag verifies (the application unit tests cover that under tight
// AAD contracts via `NodeCryptoService`).
// ---------------------------------------------------------------------------
function makeFakeCrypto(): CryptoService {
  return {
    algorithm: 'identity',
    async encrypt(_key: Buffer, plaintext: Buffer, _aad: Buffer) {
      return {
        ciphertext: Buffer.from(plaintext),
        iv: Buffer.alloc(12, 0x01),
        authTag: Buffer.alloc(16, 0x02),
      };
    },
    async decrypt(_key: Buffer, envelope: { ciphertext: Buffer }, _aad: Buffer) {
      return Buffer.from(envelope.ciphertext);
    },
  };
}

const fakeKeyManager = makeFakeKeyManager();
const fakeCrypto = makeFakeCrypto();
const totpVerifier = new OtpAuthTotpVerifier();

let counter = 0;
function uniqueSuffix(label: string): string {
  counter += 1;
  return `${label}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

async function uniqueFactorId(label: string): Promise<string> {
  return `01HFACTOR${uniqueSuffix(label)}`.slice(0, 26).padEnd(26, '0');
}

async function uniqueTokenId(label: string): Promise<string> {
  return `01JTOKEN${uniqueSuffix(label)}`.slice(0, 26).padEnd(26, '0');
}

async function uniqueChallengeId(label: string): Promise<string> {
  return `01HCHALL${uniqueSuffix(label)}`.slice(0, 26).padEnd(26, '0');
}

/**
 * Seal the raw TOTP shared secret with the **same fake KeyManager**
 * the server is wired with, so `VerifyMfa.openSecret` round-trips
 * it cleanly during `/v1/mfa/verify`. Using the real
 * `LocalDevKeyManager` here would mean verify-mfa's openSecret
 * succeeds but the server's openSecret (also fake) would refuse to
 * open, since the fake keys `bytes` of the envelope verbatim and
 * the real one AES-GCM-sealed them.
 */
async function sealSecretForFactor(
  factorId: string,
  rawSecret: Buffer,
): Promise<Buffer> {
  const ctx = Buffer.from(`mfa-factor:${factorId}`, 'utf8');
  const wrapped = await fakeKeyManager.sealSecret(rawSecret, ctx);
  return Buffer.from(wrapped.bytes);
}

async function seedActiveFactor(
  app: FastifyInstance,
  factorId: string,
  actor: string,
): Promise<{ secret: Buffer; currentCode: string }> {
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

/**
 * Seed a vault_tokens row directly. The route tests do not need a
 * real envelope: the fake CryptoService returns plaintext=ciphertext,
 * and the fake KeyManager returns a constant DEK regardless of the
 * row's `wrappedDek`. The row is round-tripped via `tokenizeOnce`
 * when an end-to-end happy path is required, otherwise this helper
 * is enough.
 */
async function seedTokenRow(
  app: FastifyInstance,
  tokenId: string,
  identityId: string,
): Promise<void> {
  await app.db!.tokens.insert({
    id: tokenId,
    identityId,
    algorithm: 'AES-256-GCM',
    ciphertext: Buffer.from([0x10, 0x20, 0x30]),
    iv: Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]),
    authTag: Buffer.from([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11,
                          0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99]),
    wrappedDek: Buffer.from('12345678901234567890', 'utf8'),
  });
}

interface SeedChallengeArgs {
  challengeId: string;
  requiredFactorId: string;
  identityId?: string | null;
  tokenId?: string | null;
  requestedBy?: string;
  expiresInMs?: number;
  operation?: StepUpOperation;
}

async function seedPendingChallenge(
  app: FastifyInstance,
  args: SeedChallengeArgs,
): Promise<void> {
  const now = new Date();
  await app.stepUpChallenges!.create({
    challengeId: args.challengeId,
    operation: args.operation ?? DEFAULT_OPERATION,
    identityId: args.identityId ?? IDENTITY_ID,
    tokenId: args.tokenId ?? null,
    requestedBy: args.requestedBy ?? PRINCIPAL,
    requestedAt: now,
    expiresAt: new Date(now.getTime() + (args.expiresInMs ?? 60_000)),
    requiredFactorId: args.requiredFactorId,
    metadata: null,
  });
}

async function seedApprovedChallenge(
  app: FastifyInstance,
  args: {
    challengeId: string;
    requiredFactorId: string;
    tokenId: string | null;
    identityId?: string | null;
    approvedAt?: Date;
    expiresInMs?: number;
  },
): Promise<void> {
  await seedPendingChallenge(app, {
    challengeId: args.challengeId,
    requiredFactorId: args.requiredFactorId,
    tokenId: args.tokenId,
    identityId: args.identityId ?? undefined,
    expiresInMs: args.expiresInMs,
  });
  await app.stepUpChallenges!.approve({
    challengeId: args.challengeId,
    verifiedFactorId: args.requiredFactorId,
    approvedAt: args.approvedAt ?? new Date(),
    auditId: null,
  });
}

async function seedActiveTokenAndIdentity(
  app: FastifyInstance,
  tokenId: string,
): Promise<void> {
  await seedIdentity(app, IDENTITY_ID);
  await seedTokenRow(app, tokenId, IDENTITY_ID);
}

/**
 * Round-trip through the real `POST /v1/tokenize` route so the
 * token row is produced by the production code path. Because the
 * server is wired with the fake `KeyManager` + fake `CryptoService`,
 * the resulting envelope round-trips cleanly through
 * `POST /v1/detokenize`: the fake `unwrapDek` ignores the wrap
 * context and the fake `decrypt` ignores AAD.
 */
async function tokenizeOnce(
  app: FastifyInstance,
  raw: string = '123456789012',
): Promise<{ token: string; identityId: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/tokenize',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${TOKENIZE_TOKEN}`,
    },
    payload: {
      raw,
      type: 'AADHAAR',
      context: {
        actorId: PRINCIPAL,
        actorRole: 'TEACHER',
        reason: 'route-test setup round-trip',
        requestId: 'req-route-test-setup',
        sourceIp: '127.0.0.1',
        userAgent: 'vitest/1.0',
      },
    },
  });
  expect(res.statusCode).toBe(201);
  const body = res.json() as Json;
    if (typeof body.token !== 'string' || typeof body.identityId !== 'string') {
      throw new Error(
        `tokenizeOnce: expected token + identityId in response, got ${JSON.stringify(body)}`,
      );
    }
    return { token: body.token, identityId: body.identityId };
}

// ---------------------------------------------------------------------------
// Recording EventPublisher
//
// Wraps a real EventPublisher and pushes every `publish()` invocation
// onto a local FIFO buffer for test inspection. Used by the concurrent
// race test to (a) count emitted events before / after a window and
// (b) confirm that a one-shot `consume` gate produces exactly one
// domain event — never two — under contention.
//
// `reset()` empties the buffer between `it` blocks but does NOT
// re-instantiate the underlying delegate, so the in-process adapter
// can keep doing its debug-log pass-through.
// ---------------------------------------------------------------------------
class RecordingEventPublisher implements EventPublisher {
    public readonly events: Array<Record<string, unknown>> = [];
    public constructor(private readonly delegate: EventPublisher) {}
    public async publish(event: DomainEvent): Promise<void> {
        this.events.push({ ...event });
        await this.delegate.publish(event);
    }
    public reset(): void {
        this.events.length = 0;
    }
}

const recorder = new RecordingEventPublisher(
    new InProcessEventPublisher({
        logger: { info: (): void => {} },
    }),
);

describe('POST /v1/detokenize/request (route layer)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildServer({
      config: TEST_CONFIG,
      keyManager: fakeKeyManager,
      crypto: fakeCrypto,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('happy path: returns challengeId, expiresAt, requiredFactor { factorId, ... }', async () => {
    const factorId = await uniqueFactorId('REQHAPPY');
    const tokenId = await uniqueTokenId('REQHAPPY');
    await seedActiveTokenAndIdentity(app, tokenId);
    await seedActiveFactor(app, factorId, PRINCIPAL);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/detokenize/request',
      headers: reqHeaders(),
      payload: {
        tokenId,
        factorId,
        context: validContext(),
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as Json;
    expect(typeof body.challengeId).toBe('string');
    expect(typeof body.expiresAt).toBe('string');
    // The request-detokenize contract returns `requiredFactor` as a
    // structured object (`{ factorId, actor, label, factorType }`),
    // NOT a scalar id. Read through the nested field so the
    // assertion matches the wire contract documented on
    // `request-detokenization.routes.ts`.
    expect(body.requiredFactor).toBeTruthy();
    expect((body.requiredFactor as Json).factorId).toBe(factorId);
  });

  it('invalid body (missing factorId) returns 400 invalid_request', async () => {
    const tokenId = await uniqueTokenId('REQBAD');
    await seedActiveTokenAndIdentity(app, tokenId);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/detokenize/request',
      headers: reqHeaders(),
      payload: {
        tokenId,
        context: validContext(),
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as Json;
    // The route's Zod short-circuit surfaces `error: 'invalid_request'`
    // (the Session 5 generic envelope). Application-layer errors that
    // raise `INVALID_INPUT` from inside the command keep the original
    // upper-case code via `replyForCommandError`.
    expect(body.error).toBe('invalid_request');
  });

  it('missing Authorization header returns 401 unauthorized', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/detokenize/request',
      headers: { 'content-type': 'application/json' },
      payload: {
        tokenId: '01JTOKENX0000000000000000000',
        factorId: '01HF0000000000000000000000',
        context: validContext(),
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('wrong scope (no vault:detokenize) returns 403 forbidden', async () => {
    const wrongScope = mintTestToken({
      secret: TEST_HMAC_SECRET,
      subject: PRINCIPAL,
      scopes: ['vault:tokenize'],
      issuer: TEST_ISS,
      audience: TEST_AUD,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/detokenize/request',
      headers: reqHeaders(wrongScope),
      payload: {
        tokenId: '01JTOKENX0000000000000000000',
        factorId: '01HF0000000000000000000000',
        context: validContext(),
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('unknown token returns 404 TOKEN_NOT_FOUND', async () => {
    const factorId = await uniqueFactorId('REQNOTOK');
    await seedActiveFactor(app, factorId, PRINCIPAL);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/detokenize/request',
      headers: reqHeaders(),
      payload: {
        tokenId: '01JTOKENMISSING00000000000000',
        factorId,
        context: validContext(),
      },
    });
    expect(res.statusCode).toBe(404);
    const body = res.json() as Json;
    expect(body.error).toBe('TOKEN_NOT_FOUND');
  });

  it('unknown factor returns 404 FACTOR_NOT_FOUND', async () => {
    const tokenId = await uniqueTokenId('REQNOFACT');
    await seedActiveTokenAndIdentity(app, tokenId);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/detokenize/request',
      headers: reqHeaders(),
      payload: {
        tokenId,
        factorId: '01HFACTORMISSING00000000000',
        context: validContext(),
      },
    });
    expect(res.statusCode).toBe(404);
    const body = res.json() as Json;
    expect(body.error).toBe('FACTOR_NOT_FOUND');
  });
});

describe('POST /v1/detokenize (route layer)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildServer({
      config: TEST_CONFIG,
      keyManager: fakeKeyManager,
      crypto: fakeCrypto,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('happy path: challenge approved → returns plaintext aadhaar', async () => {
    const factorId = await uniqueFactorId('DHAPPY');
    const challengeId = await uniqueChallengeId('DHAPPY');
    const { token: tokenId, identityId } = await tokenizeOnce(app);
    await seedActiveFactor(app, factorId, PRINCIPAL);
    await seedApprovedChallenge(app, {
      challengeId,
      requiredFactorId: factorId,
      tokenId,
      identityId,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/detokenize',
      headers: reqHeaders(),
      payload: { challengeId, context: validContext() },
    });
    if (res.statusCode !== 200) {
      // eslint-disable-next-line no-console
      console.error('DEBUG-DETOK-HAPPY', res.statusCode, res.body);
    }
    expect(res.statusCode).toBe(200);
    const body = res.json() as Json;
    expect(body).toHaveProperty('aadhaar');
    expect(typeof (body as Json)['aadhaar']).toBe('string');
  });

  it('replay: second detokenize with same challengeId returns 409 CHALLENGE_CONSUMED', async () => {
    const factorId = await uniqueFactorId('DREPLAY');
    const challengeId = await uniqueChallengeId('DREPLAY');
    const { token: tokenId, identityId } = await tokenizeOnce(app);
    await seedActiveFactor(app, factorId, PRINCIPAL);
    await seedApprovedChallenge(app, {
      challengeId,
      requiredFactorId: factorId,
      tokenId,
      identityId,
    });

    const first = await app.inject({
      method: 'POST',
      url: '/v1/detokenize',
      headers: reqHeaders(),
      payload: { challengeId, context: validContext() },
    });
    expect(first.statusCode).toBe(200);

    // Second call: after the first call consumed the row, its
    // status is `consumed`. The Session 7E lifecycle ordering
    // surfaces that exact state as CHALLENGE_CONSUMED (409)
    // BEFORE the generic status check runs, so a replay attempt
    // is observably distinct from a never-approved or expired
    // challenge. Only `CHALLENGE_CONSUMED` is accepted here
    // because that is the canonical replay error produced by
    // the Stage-One `status === 'consumed'` short-circuit (the
    // `consume()` CAS has already failed for the row by the
    // time the second caller reaches it; the Stage-One check
    // fires first).
    const second = await app.inject({
      method: 'POST',
      url: '/v1/detokenize',
      headers: reqHeaders(),
      payload: { challengeId, context: validContext() },
    });
    expect(second.statusCode).toBe(409);
    const body = second.json() as Json;
    expect(body.error).toBe('CHALLENGE_CONSUMED');
  });

  it('challenge missing returns 404 CHALLENGE_NOT_FOUND', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/detokenize',
      headers: reqHeaders(),
      payload: {
        challengeId: '01HCHALLMISS000000000000000',
        context: validContext(),
      },
    });
    expect(res.statusCode).toBe(404);
    const body = res.json() as Json;
    expect(body.error).toBe('CHALLENGE_NOT_FOUND');
  });

  it('challenge expired returns 410 CHALLENGE_EXPIRED', async () => {
    const factorId = await uniqueFactorId('DEXPIRED');
    const challengeId = await uniqueChallengeId('DEXPIRED');
    // Seed an APPROVED challenge whose `expiresAt` is in the past
    // so the expiry check (which runs after the status check in
    // `runChallengeMode`) fires. A `pending` + expired challenge
    // would short-circuit on the status check and surface as
    // CHALLENGE_NOT_APPROVED (422), not CHALLENGE_EXPIRED (410).
    const { token: tokenId, identityId } = await tokenizeOnce(app);
    await seedActiveFactor(app, factorId, PRINCIPAL);
    await seedApprovedChallenge(app, {
      challengeId,
      requiredFactorId: factorId,
      tokenId,
      identityId,
      expiresInMs: -60_000,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/detokenize',
      headers: reqHeaders(),
      payload: { challengeId, context: validContext() },
    });
    expect(res.statusCode).toBe(410);
    const body = res.json() as Json;
    expect(body.error).toBe('CHALLENGE_EXPIRED');
  });

  it('challenge not approved (still pending) returns 403 CHALLENGE_NOT_APPROVED', async () => {
    const factorId = await uniqueFactorId('DPENDING');
    const tokenId = await uniqueTokenId('DPENDING');
    const challengeId = await uniqueChallengeId('DPENDING');
    await seedActiveTokenAndIdentity(app, tokenId);
    await seedActiveFactor(app, factorId, PRINCIPAL);
    await seedPendingChallenge(app, {
      challengeId,
      requiredFactorId: factorId,
      tokenId,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/detokenize',
      headers: reqHeaders(),
      payload: { challengeId, context: validContext() },
    });
    // Session 7D binds `CHALLENGE_NOT_APPROVED` to 403 (a
    // *state* failure — the challenge has not been MFA-approved
    // yet). It is intentionally distinct from the consumption
    // surface (409 CHALLENGE_CONSUMED) and the actor surface
    // (403 ACTOR_MISMATCH). See `error-mapping.ts`.
    expect(res.statusCode).toBe(403);
    const body = res.json() as Json;
    expect(body.error).toBe('CHALLENGE_NOT_APPROVED');
  });

  it('strict schema rejects legacy { token, context } detokenize body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/detokenize',
      headers: reqHeaders(),
      // Legacy v1 contract — `token` is no longer accepted. The
      // `.strict()` Zod schema must reject unknown keys with
      // 400 invalid_request before any challenge lookup runs.
      payload: {
        token: '01JTOKENLEGACY000000000000000',
        context: {
          actorId: PRINCIPAL,
          actorRole: 'TEACHER',
          reason: 'legacy detokenize body',
          requestId: 'req-legacy-detok',
          sourceIp: '127.0.0.1',
          userAgent: 'vitest/1.0',
        },
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as Json;
    // Session 5 generic Zod-failure envelope surfaces here.
    expect(body.error).toBe('invalid_request');
  });

  it('wrong actor on challenge returns 403 ACTOR_MISMATCH', async () => {
    const factorId = await uniqueFactorId('DWRONGACTOR');
    const tokenId = await uniqueTokenId('DWRONGACTOR');
    const challengeId = await uniqueChallengeId('DWRONGACTOR');
    await seedActiveTokenAndIdentity(app, tokenId);
    await seedActiveFactor(app, factorId, PRINCIPAL);
    await seedApprovedChallenge(app, {
      challengeId,
      requiredFactorId: factorId,
      tokenId,
      approvedAt: new Date(),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/detokenize',
      headers: reqHeaders(OTHER_REQUEST_TOKEN),
      payload: { challengeId, context: validContext() },
    });
    // Session 7D binds detokenize to the challenge's `requestedBy`
    // (the actor who issued /v1/detokenize/request). The new contract
    // surfaces a wrong actor as 403 ACTOR_MISMATCH — distinct from
    // 403 CHALLENGE_NOT_APPROVED, which is reserved for the
    // lifecycle/state failure.
    expect(res.statusCode).toBe(403);
    const body = res.json() as Json;
    expect(body.error).toBe('ACTOR_MISMATCH');
  });

  it('invalid body (missing challengeId) returns 400 invalid_request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/detokenize',
      headers: reqHeaders(),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as Json;
    // Session 5 generic Zod-failure envelope surfaces here.
    expect(body.error).toBe('invalid_request');
  });

  it('missing Authorization header returns 401 unauthorized', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/detokenize',
      headers: { 'content-type': 'application/json' },
      payload: { challengeId: '01HCHALL00000000000000000000' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('Step-up end-to-end (request → verify → detokenize → replay)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildServer({
      config: TEST_CONFIG,
      keyManager: fakeKeyManager,
      crypto: fakeCrypto,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('full happy path through /v1/detokenize/request + /v1/mfa/verify + /v1/detokenize; replay rejected', async () => {
    const factorId = await uniqueFactorId('E2EHAPPY');
    // Round-trip through POST /v1/tokenize so the request → verify
    // → detokenize chain sees real envelopes (and the detokenize
    // command's unwrap + decrypt steps succeed via the fake crypto).
    const { token: tokenId } = await tokenizeOnce(app);
    const { currentCode } = await seedActiveFactor(app, factorId, PRINCIPAL);

    // 1) Request
    const reqRes = await app.inject({
      method: 'POST',
      url: '/v1/detokenize/request',
      headers: reqHeaders(),
      payload: {
        tokenId: tokenId,
        factorId,
        context: validContext(),
      },
    });
    expect(reqRes.statusCode).toBe(200);
    const reqBody = reqRes.json() as Json;
    const challengeId = reqBody.challengeId as string;
    expect(typeof challengeId).toBe('string');

    // 2) Approve the step-up challenge. Session 7E split this off
    //    from /v1/mfa/verify: the verify route is now a pure TOTP
    //    proof, and the challenge row flips `pending -> approved`
    //    on the dedicated /v1/detokenize/step-up/:challengeId/approve
    //    endpoint. The eventual /v1/detokenize consumes the
    //    approved challenge id.
    const approveRes = await app.inject({
      method: 'POST',
      url: `/v1/detokenize/step-up/${challengeId}/approve`,
      headers: reqHeaders(),
      payload: {
        code: currentCode,
        context: validContext(),
      },
    });
    expect(approveRes.statusCode).toBe(200);

    // 3) Detokenize (first time → plaintext)
    const det1 = await app.inject({
      method: 'POST',
      url: '/v1/detokenize',
      headers: reqHeaders(),
      payload: { challengeId, context: validContext() },
    });
    expect(det1.statusCode).toBe(200);
    const aadhaar1 = (det1.json() as Json)['aadhaar'] as string;
    expect(typeof aadhaar1).toBe('string');

    // 4) Replay → rejected. Session 7E binds this surface to
    //    exactly one code — `CHALLENGE_CONSUMED` (409) — because
    //    the row is already in `consumed` state from the first
    //    successful detokenize. Earlier sessions allowed
    //    `CHALLENGE_NOT_APPROVED` (422) as a forward-compatible
    //    alternative; that has been tightened now that the
    //    Stage-One `status === 'consumed'` short-circuit fires
    //    before the generic status check.
    const det2 = await app.inject({
      method: 'POST',
      url: '/v1/detokenize',
      headers: reqHeaders(),
      payload: { challengeId, context: validContext() },
    });
    expect(det2.statusCode).toBe(409);
    const det2Body = det2.json() as Json;
    expect(det2Body.error).toBe('CHALLENGE_CONSUMED');
  });
});

/**
 * Concurrency regression — the Session 7C `consume`-before-`crypto`
 * reorder moves the row-state transition (`approved → consumed`)
 * ahead of unwrap/decrypt so two concurrent detokenize calls race
 * on a single compare-and-set gate. One wins and gets plaintext;
 * the other MUST receive `CHALLENGE_CONSUMED` (409) without ever
 * unwrapping the DEK or decrypting the ciphertext.
 *
 * # Why this loop runs RACE_ITERATIONS times
 *
 * A single Promise.allSettled pair can pass even with a latent
 * race because (a) the `await` between the consume gate and the
 * plaintext release can interleave with the second call's read,
 * and (b) the in-memory pool's repository methods are synchronous
 * inside one tick, so two concurrent injects may not actually
 * interleave in JS's microtask order. Running the race 20 times
 * inside one Vitest case forces interleavings to vary: if a
 * regression ever reintroduces a double-plaintext or skip-consume
 * path, the failure surfaces inside the existing CI run (a
 * deterministic flake detector), not as a single intermittent
 * failure on a far-future branch.
 *
 * # Why we pre-seed an APPROVED challenge
 *
 * This test isolates the consume gate from the request + verify
 * flows so the race window only covers the detokenize command's
 * CAS transition. Pre-approving via the repository (no event
 * published, no audit row, no JWT round-trip) gives us a clean
 * before/after event-delta baseline.
 *
 * # Event-delta contract
 *
 * Per iteration, the recorder MUST observe:
 *   - 0 `DetokenizationRequested`   (request route not called)
 *   - 0 `DetokenizationApproved`    (verify route not called)
 *   - 1 `DetokenizationCompleted`   (winner only)
 *   - total event-delta = 1
 *
 * If the consume gate ever fails to fire (i.e. two completions
 * leak through) the test fails inside the same CI run with a
 * clear "expected afterCompleted - beforeCompleted to be 1,
 * received 2" assertion message.
 */
describe('POST /v1/detokenize — concurrent replay race (CAS protection)', () => {
  /**
   * Number of race iterations inside one `it` block. Bump if a
   * regression only surfaces intermittently; 20 has caught every
   * known CAS regression since Session 7B at ~3ms/iter. We
   * surface the constant in the test name so failures are
   * greppable.
   */
  const RACE_ITERATIONS = 20;

  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildServer({
      config: TEST_CONFIG,
      keyManager: fakeKeyManager,
      crypto: fakeCrypto,
      events: recorder,
    });
    await app.ready();
    recorder.reset();
  });

  afterEach(async () => {
    recorder.reset();
    await app.close();
  });

  it(
    `fires RACE_ITERATIONS=${RACE_ITERATIONS} simultaneous detokenize calls; every iteration: exactly one 200, exactly one 409 CHALLENGE_CONSUMED, exactly one DetokenizationCompleted event, no plaintext leak on the loser`,
    async () => {
      for (let iter = 0; iter < RACE_ITERATIONS; iter++) {
        // ---------------- SETUP ----------------
        const factorId = await uniqueFactorId(`RACE${iter}`);
        const challengeId = await uniqueChallengeId(`RACE${iter}`);
        const { token: tokenId, identityId } = await tokenizeOnce(app);
        await seedActiveFactor(app, factorId, PRINCIPAL);
        await seedApprovedChallenge(app, {
          challengeId,
          requiredFactorId: factorId,
          tokenId,
          identityId,
        });

        // ---------------- SNAPSHOT BEFORE ----------------
        const beforeTotal = recorder.events.length;
        const beforeRequested = recorder.events.filter(
          (e) => e.type === 'DetokenizationRequested',
        ).length;
        const beforeApproved = recorder.events.filter(
          (e) => e.type === 'DetokenizationApproved',
        ).length;
        const beforeCompleted = recorder.events.filter(
          (e) => e.type === 'DetokenizationCompleted',
        ).length;

        // ---------------- RACE ----------------
        // Promise.allSettled so we can inspect BOTH outcomes even if
        // one injection throws; the underlying route is sync-wrapped
        // in a Promise so a throw lands here as `reason`, not as
        // an unhandled rejection.
        const settled = await Promise.allSettled([
          app.inject({
            method: 'POST',
            url: '/v1/detokenize',
            headers: reqHeaders(),
            payload: { challengeId, context: validContext() },
          }),
          app.inject({
            method: 'POST',
            url: '/v1/detokenize',
            headers: reqHeaders(),
            payload: { challengeId, context: validContext() },
          }),
        ]);

        type InjectResp = Awaited<ReturnType<FastifyInstance['inject']>>;
        const responses: InjectResp[] = settled
          .filter(
            (r): r is PromiseFulfilledResult<InjectResp> =>
              r.status === 'fulfilled',
          )
          .map((r) => r.value);

        if (responses.length !== 2) {
          const rejected = settled
            .filter((r) => r.status === 'rejected')
            .map((r) => (r as PromiseRejectedResult).reason);
          throw new Error(
            `iter ${iter}: expected 2 fulfilled responses, got ${responses.length}; rejections: ${JSON.stringify(rejected, null, 2)}`,
          );
        }

        const winners = responses.filter((r) => r.statusCode === 200);
        // Session 7E tightens the loser surface to *exactly* 409
        // (the canonical CHALLENGE_CONSUMED status). Earlier
        // sessions accepted 422 alongside 409 to forward-protect
        // against implementations that surfaced the consumed row
        // through the generic `status !== 'approved'` branch.
        // The Stage-One short-circuit (`status === 'consumed'` →
        // CHALLENGE_CONSUMED) means the loser never falls through
        // to that generic branch, so we can assert 409 here
        // without flake.
        const losers = responses.filter((r) => r.statusCode === 409);

        // ---------------- INVARIANTS ----------------

        // (1) exactly one 200, exactly one 409
        expect(winners.length, `iter ${iter}: winners`).toBe(1);
        expect(losers.length, `iter ${iter}: losers`).toBe(1);

        // winners / losers each have length 1 by invariant (1), so
        // the index access is safe. Use non-null assertion to
        // satisfy `noUncheckedIndexedAccess` without disabling it
        // for the rest of the test file.
        const winner = winners[0]!;
        const loser = losers[0]!;

        // (2) winner body has a 12-digit aadhaar
        const winnerBody = JSON.parse(winner.body) as Json;
        const aadhaar = winnerBody['aadhaar'] as string | undefined;
        expect(aadhaar, `iter ${iter}: winner aadhaar present`).toMatch(
          /^\d{12}$/,
        );

        // (3) loser body has NO aadhaar field (defence-in-depth: no
        //     plaintext leak on the loser path)
        const loserBody = JSON.parse(loser.body) as Json;
        expect(
          loserBody['aadhaar'],
          `iter ${iter}: loser must NOT leak aadhaar`,
        ).toBeUndefined();

        // (4) the loser carries the canonical replay code. This is
        //     the contract: `consume()` raced, lost, the row was
        //     already in `consumed` state, and the command
        //     surfaced that as CHALLENGE_CONSUMED (409).
        //     `CHALLENGE_RACE` and `CHALLENGE_NOT_APPROVED` are
        //     intentionally NOT accepted here — earlier sessions
        //     used those as forward-compatible fallbacks; Session
        //     7E removes them.
        expect(
          loserBody.error,
          `iter ${iter}: loser error must be CHALLENGE_CONSUMED`,
        ).toBe('CHALLENGE_CONSUMED');

        // (5) exactly one DETOKENIZE audit row tied to THIS challengeId
        const auditRows = await app.db!.audit.listByIdentity(identityId);
        const detokForThis = auditRows.filter(
          (r) =>
            r.action === 'DETOKENIZE' &&
            (r.meta as { challenge_id?: string } | undefined)
              ?.challenge_id === challengeId,
        );
        expect(
          detokForThis.length,
          `iter ${iter}: exactly one DETOKENIZE audit row for ${challengeId}`,
        ).toBe(1);

        // (6) event-delta assertions: route under test is /v1/detokenize
        //     so the only legal emitted event during the race window
        //     is `DetokenizationCompleted` from the winner.
        const afterTotal = recorder.events.length;
        const afterRequested = recorder.events.filter(
          (e) => e.type === 'DetokenizationRequested',
        ).length;
        const afterApproved = recorder.events.filter(
          (e) => e.type === 'DetokenizationApproved',
        ).length;
        const afterCompleted = recorder.events.filter(
          (e) => e.type === 'DetokenizationCompleted',
        ).length;

        expect(
          afterTotal - beforeTotal,
          `iter ${iter}: total event delta during race window`,
        ).toBe(1);
        expect(
          afterRequested - beforeRequested,
          `iter ${iter}: no DetokenizationRequested emitted (route not called)`,
        ).toBe(0);
        expect(
          afterApproved - beforeApproved,
          `iter ${iter}: no DetokenizationApproved emitted (route not called)`,
        ).toBe(0);
        expect(
          afterCompleted - beforeCompleted,
          `iter ${iter}: exactly one DetokenizationCompleted from the winner`,
        ).toBe(1);

        // (7) challenge row is now in 'consumed' state
        const afterRow = await app.stepUpChallenges!.findById(challengeId);
        expect(
          afterRow?.status,
          `iter ${iter}: challenge row state after race`,
        ).toBe('consumed');

        // Reset recorder between iterations so per-iteration deltas
        // are computed against a clean baseline.
        recorder.reset();
      }
    },
    // 30s timeout: 20 iterations × ~tens-of-ms-each can exceed
    // Vitest's default 5s on slower CI runners.
    30_000,
  );
});
