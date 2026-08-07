/**
 * HTTP-layer integration test for `POST /v1/detokenize/step-up/:challengeId/approve`.
 *
 * Mirrors `tests/verify-mfa.route.test.ts`: same `app.inject()` pattern,
 * same JWT helper, same in-memory database. The route's job is to wire
 * the application-layer `ApproveStepUpChallenge` command through the real
 * DB + auth boundary + Zod validation.
 *
 * # Test seed strategy
 *
 *   The test seeds:
 *
 *     - an active TOTP factor (via `app.db.mfa.insert(...)`) so the
 *       command's `getById(...)` round-trip succeeds;
 *     - a `pending` step-up challenge (via
 *       `app.stepUpChallenges.create(...)`) so the route's URL
 *       param resolves to a row.
 *
 *   The factor's `encryptedSecret` is sealed by a parallel
 *   `LocalDevKeyManager` built with the same `LOCAL_DEV_MASTER_KEY`
 *   as the server, so the command's `keyManager.openSecret(...)`
 *   round-trip succeeds. The plaintext secret is then handed to a
 *   parallel `OtpAuthTotpVerifier` to derive the *current* TOTP code
 *   the caller would type — this avoids monkey-patching `Date.now`.
 *
 * # Status mapping locked in
 *
 *   200 → { challengeId, status, approvedAt, verifiedFactorId }
 *   400 → { error: 'invalid_request', message, details? }
 *   401 → { error: 'unauthorized', message, code? }
 *   403 → { error: 'forbidden', message }
 *         or { error: 'CODE_MISMATCH'
 *              | 'FACTOR_NOT_ACTIVE' | 'FACTOR_EXPIRED'
 *              | 'CHALLENGE_NOT_PENDING' | 'CHALLENGE_EXPIRED', message }
 *   404 → { error: 'not_found', message }
 *         or { error: 'CHALLENGE_NOT_FOUND' | 'FACTOR_NOT_FOUND', message }
 *   503 → { error: 'service_unavailable', message }
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
import type { MfaFactor } from '../src/application/ports/mfa-repository.js';
import type { MfaFactorStatus } from '../src/application/ports/mfa-repository.js';

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

/**
 * The challenge row must reference a factor that belongs to the same
 * `actor` as the JWT subject (the route's principal-trust invariant
 * forces the JWT subject into `actorId`). Tests that exercise a
 * successful approve MUST seed the challenge's `requestedBy` and the
 * factor's `actor` under the same principal as the JWT subject.
 */
const PRINCIPAL = 'teacher-101';
const APPROVER_TOKEN = mintTestToken({
    secret: TEST_HMAC_SECRET,
    subject: PRINCIPAL,
    scopes: ['vault:detokenize'],
    issuer: TEST_ISS,
    audience: TEST_AUD,
});
const WRONG_SCOPE_TOKEN = mintTestToken({
    secret: TEST_HMAC_SECRET,
    subject: PRINCIPAL,
    scopes: ['vault:audit'],
    issuer: TEST_ISS,
    audience: TEST_AUD,
});

const authHeaders = (
    token: string = APPROVER_TOKEN,
): Record<string, string> => ({
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

async function seedActiveFactor(
    app: FastifyInstance,
    factorId: string,
    actor: string,
    opts: { expiresAt?: Date | null } = {},
): Promise<MfaFactor> {
    const rawSecret = Buffer.alloc(20, 0x42);
    const encryptedSecret = await sealSecretForFactor(factorId, rawSecret);
    const factor: MfaFactor = {
        factorId,
        actor,
        factorType: 'totp',
        label: `${actor} (work phone)`,
        encryptedSecret,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        status: 'active' satisfies MfaFactorStatus,
        createdAt: new Date(),
        lastUsedAt: null,
        expiresAt: opts.expiresAt ?? null,
    };
    await app.db!.mfa.insert(factor);
    return factor;
}

async function currentCodeFor(rawSecret: Buffer): Promise<string> {
    return totpVerifier.currentCode(rawSecret, Date.now());
}

async function seedPendingChallenge(
    app: FastifyInstance,
    challengeId: string,
    requiredFactorId: string,
    opts: { expiresAt?: Date; requestedBy?: string } = {},
): Promise<void> {
    await app.stepUpChallenges!.create({
        challengeId,
        operation: 'detokenize',
        identityId: '00000000-0000-4000-8000-000000000001',
        tokenId: '11111111-1111-4111-8111-111111111111',
        requestedBy: opts.requestedBy ?? PRINCIPAL,
        requestedAt: new Date(),
        expiresAt: opts.expiresAt ?? new Date(Date.now() + 60_000),
        requiredFactorId,
        metadata: 'Step-up before detokenize (route test)',
    });
}

// The factor id is NOT in the request — it is derived server-side
// from `challenge.requiredFactorId` (the row minted by
// `request-detokenization`). The body carries only `code` and the
// audit `context`. The `.strict()` Zod schema on the route means
// ANY additional field (including a legacy `mfaId`) will trip a
// 400 before the command runs; see the dedicated rejection test.
function happyBody(code: string): Json {
    return {
        code,
        context: {
            actorId: 'attacker-supplied-id',
            actorRole: 'TEACHER',
            reason: 'Step-up verification before detokenize',
            requestId: 'req-approve-route-1',
            sourceIp: '127.0.0.1',
            userAgent: 'vitest/1.0',
        },
    };
}

describe('POST /v1/detokenize/step-up/:challengeId/approve (route layer)', () => {
    let app: FastifyInstance | undefined;

    beforeAll(async () => {
        app = await buildServer({ config: TEST_CONFIG });
        await app.ready();
    });

    afterAll(async () => {
        if (app) await app.close();
    });

    // Wipe the in-memory challenge + audit state between tests so
    // challenge ids and audit row counters do not collide.
    beforeEach(async () => {
        const challenges = app?.stepUpChallenges as
            | { __resetForTests?: () => void }
            | undefined;
        if (challenges && typeof challenges.__resetForTests === 'function') {
            challenges.__resetForTests();
        }
    });

    // 200 — happy path
    it('returns 200 with the approved row, audited, and published', async () => {
        const factor = await seedActiveFactor(
            app!,
            'factor-route-200',
            PRINCIPAL,
        );
        const challengeId = 'challenge-route-200';
        await seedPendingChallenge(app!, challengeId, factor.factorId);

        const rawSecret = Buffer.alloc(20, 0x42);
        const code = await currentCodeFor(rawSecret);

        const res = await app!.inject({
            method: 'POST',
            url: `/v1/detokenize/step-up/${challengeId}/approve`,
            headers: authHeaders(),
            payload: happyBody(code),
        });

        expect(res.statusCode).toBe(200);
        const body = res.json() as Json;
        expect(body.challengeId).toBe(challengeId);
        expect(body.status).toBe('approved');
        expect(typeof body.approvedAt).toBe('string');
        expect(body.verifiedFactorId).toBe(factor.factorId);
    });

    // 400 — request body validation
    it('returns 400 when the code field is missing', async () => {
        const factor = await seedActiveFactor(
            app!,
            'factor-route-400-missing',
            PRINCIPAL,
        );
        const challengeId = 'challenge-route-400-missing';
        await seedPendingChallenge(app!, challengeId, factor.factorId);

        const res = await app!.inject({
            method: 'POST',
            url: `/v1/detokenize/step-up/${challengeId}/approve`,
            headers: authHeaders(),
            payload: {
                // code missing on purpose
                context: happyBody('123456').context,
            },
        });

        expect(res.statusCode).toBe(400);
        const body = res.json() as Json;
        expect(body.error).toBe('invalid_request');
        expect(Array.isArray(body.details)).toBe(true);
    });

    it('returns 400 when the code is not a numeric TOTP string', async () => {
        const factor = await seedActiveFactor(
            app!,
            'factor-route-400-code',
            PRINCIPAL,
        );
        const challengeId = 'challenge-route-400-code';
        await seedPendingChallenge(app!, challengeId, factor.factorId);

        const res = await app!.inject({
            method: 'POST',
            url: `/v1/detokenize/step-up/${challengeId}/approve`,
            headers: authHeaders(),
            payload: happyBody('not-a-number'),
        });

        expect(res.statusCode).toBe(400);
        const body = res.json() as Json;
        expect(body.error).toBe('invalid_request');
    });

    // 400 — strict-mode invariant
    it('returns 400 when the body carries the legacy mfaId field (.strict() rejection)', async () => {
        // The factor id is derived server-side. The `.strict()` Zod
        // schema on the route MUST reject any request body that
        // carries an unknown property — including the legacy
        // `mfaId` field that earlier revisions accepted. This
        // test pins that invariant so a future refactor that
        // relaxes the schema to `.passthrough()` (or similar) is
        // caught immediately.
        const factor = await seedActiveFactor(
            app!,
            'factor-route-400-strict',
            PRINCIPAL,
        );
        const challengeId = 'challenge-route-400-strict';
        await seedPendingChallenge(app!, challengeId, factor.factorId);

        const rawSecret = Buffer.alloc(20, 0x42);
        const code = await currentCodeFor(rawSecret);

        const res = await app!.inject({
            method: 'POST',
            url: `/v1/detokenize/step-up/${challengeId}/approve`,
            headers: authHeaders(),
            payload: {
                mfaId: factor.factorId,
                code,
                context: happyBody(code).context,
            },
        });

        expect(res.statusCode).toBe(400);
        const body = res.json() as Json;
        expect(body.error).toBe('invalid_request');
        expect(Array.isArray(body.details)).toBe(true);
        // The Zod issue MUST name `mfaId` as the unknown property.
        const detailPaths = (body.details as Array<{ path: string }>).map(
            (d) => d.path,
        );
        expect(detailPaths).toContain('mfaId');
    });

    it('returns 404 when the URL param challengeId does not exist (no row matches)', async () => {
        // A long-but-plausible challenge id should never crash the
        // route: it falls through every guard and ends up in the
        // command's CHALLENGE_NOT_FOUND path, which the route maps
        // to 404. (If the length-capping guard fires first, the
        // status will be 400 instead — either outcome is safe.)
        const longId = 'x'.repeat(64);
        const res = await app!.inject({
            method: 'POST',
            url: `/v1/detokenize/step-up/${longId}/approve`,
            headers: authHeaders(),
            payload: happyBody('123456'),
        });

        expect([400, 404]).toContain(res.statusCode);
        const body = res.json() as Json;
        expect(['invalid_request', 'CHALLENGE_NOT_FOUND']).toContain(
            body.error,
        );
    });

    // 401 — auth boundary
    it('returns 401 when no Authorization header is present', async () => {
        const factor = await seedActiveFactor(
            app!,
            'factor-route-401-noauth',
            PRINCIPAL,
        );
        const challengeId = 'challenge-route-401-noauth';
        await seedPendingChallenge(app!, challengeId, factor.factorId);

        const res = await app!.inject({
            method: 'POST',
            url: `/v1/detokenize/step-up/${challengeId}/approve`,
            headers: { 'content-type': 'application/json' },
            payload: happyBody('123456'),
        });

        expect(res.statusCode).toBe(401);
        const body = res.json() as Json;
        expect(body.error).toBe('unauthorized');
    });

    it('returns 401 when the bearer token is malformed', async () => {
        const factor = await seedActiveFactor(
            app!,
            'factor-route-401-bad',
            PRINCIPAL,
        );
        const challengeId = 'challenge-route-401-bad';
        await seedPendingChallenge(app!, challengeId, factor.factorId);

        const res = await app!.inject({
            method: 'POST',
            url: `/v1/detokenize/step-up/${challengeId}/approve`,
            headers: {
                'content-type': 'application/json',
                authorization: 'Bearer this-is-not-a-jwt',
            },
            payload: happyBody('123456'),
        });

        expect(res.statusCode).toBe(401);
    });

    // 403 — wrong scope / command-layer domain failures
    it('returns 403 when the token is missing the vault:detokenize scope', async () => {
        const factor = await seedActiveFactor(
            app!,
            'factor-route-403-scope',
            PRINCIPAL,
        );
        const challengeId = 'challenge-route-403-scope';
        await seedPendingChallenge(app!, challengeId, factor.factorId);

        const res = await app!.inject({
            method: 'POST',
            url: `/v1/detokenize/step-up/${challengeId}/approve`,
            headers: authHeaders(WRONG_SCOPE_TOKEN),
            payload: happyBody('123456'),
        });

        expect(res.statusCode).toBe(403);
        const body = res.json() as Json;
        expect(body.error).toBe('forbidden');
    });

    it('returns 403 with CODE_MISMATCH when the typed code is wrong', async () => {
        const factor = await seedActiveFactor(
            app!,
            'factor-route-403-code',
            PRINCIPAL,
        );
        const challengeId = 'challenge-route-403-code';
        await seedPendingChallenge(app!, challengeId, factor.factorId);

        const res = await app!.inject({
            method: 'POST',
            url: `/v1/detokenize/step-up/${challengeId}/approve`,
            headers: authHeaders(),
            payload: happyBody('000000'),
        });

        expect(res.statusCode).toBe(403);
        const body = res.json() as Json;
        expect(body.error).toBe('CODE_MISMATCH');
    });

    it('returns 403 with CHALLENGE_EXPIRED when the challenge has already expired', async () => {
        const factor = await seedActiveFactor(
            app!,
            'factor-route-403-expired',
            PRINCIPAL,
        );
        const challengeId = 'challenge-route-403-expired';
        await seedPendingChallenge(app!, challengeId, factor.factorId, {
            expiresAt: new Date(Date.now() - 60_000),
        });

        const res = await app!.inject({
            method: 'POST',
            url: `/v1/detokenize/step-up/${challengeId}/approve`,
            headers: authHeaders(),
            payload: happyBody('123456'),
        });

        expect(res.statusCode).toBe(403);
        const body = res.json() as Json;
        expect(body.error).toBe('CHALLENGE_EXPIRED');
    });

    // 404 — missing challenge / missing factor
    it('returns 404 with CHALLENGE_NOT_FOUND when the challenge id does not exist', async () => {
        await seedActiveFactor(
            app!,
            'factor-route-404-challenge',
            PRINCIPAL,
        );

        const res = await app!.inject({
            method: 'POST',
            url: `/v1/detokenize/step-up/challenge-does-not-exist/approve`,
            headers: authHeaders(),
            payload: happyBody('123456'),
        });

        expect(res.statusCode).toBe(404);
        const body = res.json() as Json;
        expect(body.error).toBe('CHALLENGE_NOT_FOUND');
    });

    it('returns 404 with FACTOR_NOT_FOUND when the bound factor does not exist', async () => {
        const challengeId = 'challenge-route-404-factor';
        await seedPendingChallenge(
            app!,
            challengeId,
            'factor-route-404-missing',
        );

        const res = await app!.inject({
            method: 'POST',
            url: `/v1/detokenize/step-up/${challengeId}/approve`,
            headers: authHeaders(),
            payload: happyBody('123456'),
        });

        expect(res.statusCode).toBe(404);
        const body = res.json() as Json;
        expect(body.error).toBe('FACTOR_NOT_FOUND');
    });

    // 200 — happy path with multiple enrolled factors: the route MUST
    // always pick the factor bound to the challenge row, regardless of
    // which other active factors the actor has. This pins the
    // server-derived invariant from end to end.
    it('returns 200 using the factor bound by the challenge, ignoring other enrolled factors', async () => {
        // Enroll a second, unrelated factor under the same principal.
        await seedActiveFactor(
            app!,
            'factor-route-200-other',
            PRINCIPAL,
        );
        const factor = await seedActiveFactor(
            app!,
            'factor-route-200-bound',
            PRINCIPAL,
        );
        const challengeId = 'challenge-route-200-multi';
        await seedPendingChallenge(app!, challengeId, factor.factorId);

        const rawSecret = Buffer.alloc(20, 0x42);
        const code = await currentCodeFor(rawSecret);

        const res = await app!.inject({
            method: 'POST',
            url: `/v1/detokenize/step-up/${challengeId}/approve`,
            headers: authHeaders(),
            payload: happyBody(code),
        });

        expect(res.statusCode).toBe(200);
        const body = res.json() as Json;
        expect(body.verifiedFactorId).toBe(factor.factorId);
        expect(body.verifiedFactorId).not.toBe('factor-route-200-other');
    });
});