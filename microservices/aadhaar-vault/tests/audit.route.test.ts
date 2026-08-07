/**
 * HTTP-layer integration test for `GET /v1/audit`.
 *
 * Mirrors the structure of `tests/detokenize.route.test.ts` so the
 * audit-read contract surface is locked in at the same level of
 * discipline as the write-side routes. The route is the only HTTP
 * entry-point that exposes `ReadAuditHistory`'s output, so its
 * envelope is part of the public contract:
 *
 *   200 → { identityId, limit, pageSize, entries[] }
 *   400 → { error: 'invalid_request', message, details }
 *        or  { error: 'INVALID_INPUT',   message }
 *   401 → { error: 'unauthorized', message | code }
 *   403 → { error: 'forbidden',    message }
 *   500 → { error: 'internal_error', message }  (principal-trust invariant)
 *   503 → { error: 'service_unavailable', message }
 *
 * # Auth boundary under test
 *
 * The auth plugin is wired with `SERVICE_JWT_HMAC_SECRET` set so the
 * route is gated by `vault:audit`. The principal-trust policy from
 * Session 6A is exercised end-to-end here:
 *
 *   - The body of the request is a query string; there is no
 *     `actorId` field on the public schema. A query string that
 *     tries to inject `actorId=...` is rejected with 400 at the
 *     Zod layer (`.strict()`).
 *   - When the auth plugin is wired but the JWT subject is empty
 *     (a misconfiguration), the route must NOT fabricate an empty
 *     actor; it surfaces a 500 so the misconfiguration is loud.
 *
 * # Why a fake `AuditRepository`
 *
 * `createMemoryDatabase()` returns a real `Database` over the
 * in-process `MemoryPool`, so the route's dependency-resolution
 * guard passes. We then replace `db.audit` with a hand-built fake
 * so each test pins the exact records the command will receive,
 * with no seed inserts to maintain. The fake respects the
 * `listByIdentity(identityId, { limit })` contract from
 * `src/db/ports/audit.repository.ts` exactly.
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
import {
    createMemoryDatabase,
    type Database,
} from '../src/db/index.js';
import type {
    AuditRecord,
    AuditRepository,
} from '../src/db/ports/audit.repository.js';
import {
    ReadAuditHistoryCommandError,
} from '../src/application/commands/read-audit-history.js';

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
 * Subject of the audit-read principal. Picked distinctly from any
 * value the body could carry so a successful 200 response can be
 * cross-checked against the JWT subject in the test (the command
 * logs the actorId but does not echo it in the response — the
 * principal-trust invariant means the *only* source is the JWT).
 */
const AUDIT_SUBJECT = 'auditor-7';
const AUDIT_TOKEN = mintTestToken({
    secret: TEST_HMAC_SECRET,
    subject: AUDIT_SUBJECT,
    scopes: ['vault:audit'],
    issuer: TEST_ISS,
    audience: TEST_AUD,
});

const authHeaders = (): Record<string, string> => ({
    authorization: `Bearer ${AUDIT_TOKEN}`,
});

/**
 * Base query string values. `actorRole` and `reason` are required
 * by the route schema; `requestId`, `sourceIp`, `userAgent` are
 * optional overrides the route applies as fallbacks.
 */
const baseQuery = {
    identityId: '01J9X8H7R3Y6N5QZIDENTITY0000000',
    actorRole: 'STATE_ADMIN',
    reason: 'Routine quarterly compliance review',
} as const;

/**
 * Two-record sample. Order matters: the production adapter orders
 * by `occurred_at DESC` (most recent first), so we put 2026-01-02
 * first when seeding a listByIdentity that the command will project
 * verbatim. The route test cares about the projection shape, not
 * the order, so this is incidental.
 */
const FAKE_RECORDS: AuditRecord[] = [
    {
        auditId: 100,
        identityId: baseQuery.identityId,
        actor: 'teacher-12',
        action: 'tokenize',
        outcome: 'allow',
        reason: 'enrolment of new student',
        requestId: 'req-prev-1',
        meta: { ip: '127.0.0.1' },
        occurredAt: new Date('2026-01-01T10:00:00Z'),
    },
    {
        auditId: 101,
        identityId: baseQuery.identityId,
        actor: 'teacher-12',
        action: 'detokenize',
        outcome: 'allow',
        reason: 'review during parent-teacher meeting',
        requestId: 'req-prev-2',
        meta: undefined,
        occurredAt: new Date('2026-01-02T12:00:00Z'),
    },
];

/**
 * Build a fake `AuditRepository` that returns the given records
 * (truncated to `opts.limit` when supplied). The `append` method is
 * a no-op because `ReadAuditHistory` is read-only.
 */
function makeFakeAudit(records: AuditRecord[] = FAKE_RECORDS): AuditRepository {
    return {
        async append() {
            /* no-op: ReadAuditHistory never appends. */
        },
        async listByIdentity(
            _identityId: string,
            opts?: { limit?: number },
        ): Promise<AuditRecord[]> {
            if (opts?.limit !== undefined) {
                return records.slice(0, opts.limit);
            }
            return records;
        },
    };
}

/**
 * Build a fake `AuditRepository` whose `listByIdentity` throws a
 * `ReadAuditHistoryCommandError`. Used to drive the route's
 * error-mapping path (e.g. the `INVALID_INPUT` → 400 envelope).
 */
function makeThrowingFakeAudit(
    code: string,
    message: string,
): AuditRepository {
    return {
        async append() {
            /* no-op */
        },
        async listByIdentity(): Promise<AuditRecord[]> {
            throw new ReadAuditHistoryCommandError(code, message);
        },
    };
}

/**
 * Build a server with the audit route wired against a fake
 * repository. The real `Database` still provides the pool + other
 * repositories, but the route's only read seam — `db.audit` — is
 * the fake, so each test pins the exact input/output shape.
 */
async function buildAppWithAudit(
    fakeAudit: AuditRepository,
): Promise<FastifyInstance> {
    const db: Database = await createMemoryDatabase();
    (db as unknown as { audit: AuditRepository }).audit = fakeAudit;
    const app = await buildServer({ config: TEST_CONFIG, db });
    await app.ready();
    return app;
}

/** URL-encode every base field once so each test can re-use it. */
const buildQuery = (
    overrides: Partial<typeof baseQuery> = {},
    extras: Record<string, string> = {},
): string => {
    const q = { ...baseQuery, ...overrides, ...extras };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) {
        params.set(k, v);
    }
    return `/v1/audit?${params.toString()}`;
};

// ===========================================================================
// 1. Happy path + response projection
// ===========================================================================

describe('GET /v1/audit (route layer)', () => {
    let app: FastifyInstance | undefined;

    beforeAll(async () => {
        app = await buildAppWithAudit(makeFakeAudit());
    });

    afterAll(async () => {
        if (app) await app.close();
    });

    it('returns 200 with the expected response shape (default limit)', async () => {
        const res = await app!.inject({
            method: 'GET',
            url: buildQuery(),
            headers: authHeaders(),
        });

        expect(res.statusCode).toBe(200);
        const body = res.json() as Json;
        expect(body.identityId).toBe(baseQuery.identityId);
        // DEFAULT_LIMIT in read-audit-history is 50.
        expect(body.limit).toBe(50);
        expect(body.pageSize).toBe(2);
        expect(Array.isArray(body.entries)).toBe(true);
        const entries = body.entries as Json[];
        expect(entries).toHaveLength(2);

        // Per-entry projection. `occurredAt` MUST be an ISO-8601
        // string; this is the route's contract, distinct from the
        // internal `Date` in `AuditRecord`.
        const e0 = entries[0]!;
        expect(e0.auditId).toBe(100);
        expect(e0.actor).toBe('teacher-12');
        expect(e0.action).toBe('tokenize');
        expect(e0.outcome).toBe('allow');
        expect(e0.reason).toBe('enrolment of new student');
        expect(e0.requestId).toBe('req-prev-1');
        expect(typeof e0.occurredAt).toBe('string');
        expect(e0.occurredAt).toBe('2026-01-01T10:00:00.000Z');
    });

    it('echoes an explicit limit in the response', async () => {
        const res = await app!.inject({
            method: 'GET',
            url: buildQuery({}, { limit: '1' }),
            headers: authHeaders(),
        });

        expect(res.statusCode).toBe(200);
        const body = res.json() as Json;
        expect(body.limit).toBe(1);
        expect(body.pageSize).toBe(1);
        expect((body.entries as Json[])).toHaveLength(1);
    });

    it('does not include the principal in the response body', async () => {
        // Regression: the route must not echo `actorId` in the
        // response. The audit log is internal; the principal is
        // recovered server-side from the JWT, not surfaced back.
        const res = await app!.inject({
            method: 'GET',
            url: buildQuery(),
            headers: authHeaders(),
        });
        const body = res.json() as Json;
        expect(body.actorId).toBeUndefined();
        // The keys MUST be exactly the four documented in the §6
        // contract — no extras.
        const keys = Object.keys(body).sort();
        expect(keys).toEqual(['entries', 'identityId', 'limit', 'pageSize']);
    });

    it('returns 200 with an empty entries list when the chain is empty', async () => {
        // Override the fake for this test only.
        const localApp = await buildAppWithAudit(makeFakeAudit([]));
        try {
            const res = await localApp.inject({
                method: 'GET',
                url: buildQuery(),
                headers: authHeaders(),
            });
            expect(res.statusCode).toBe(200);
            const body = res.json() as Json;
            expect(body.pageSize).toBe(0);
            expect(body.entries).toEqual([]);
        } finally {
            await localApp.close();
        }
    });

    // -------------------------------------------------------------------
    // 2. Request validation
    // -------------------------------------------------------------------

    it('returns 400 invalid_request when identityId is missing', async () => {
        const res = await app!.inject({
            method: 'GET',
            url: `/v1/audit?actorRole=${baseQuery.actorRole}&reason=${encodeURIComponent(baseQuery.reason)}`,
            headers: authHeaders(),
        });
        expect(res.statusCode).toBe(400);
        const body = res.json() as Json;
        expect(body.error).toBe('invalid_request');
        expect(Array.isArray(body.details)).toBe(true);
    });

    it('returns 400 invalid_request when actorRole is outside the enum', async () => {
        const res = await app!.inject({
            method: 'GET',
            url: buildQuery({ actorRole: 'GOD_MODE' as unknown as 'STATE_ADMIN' }),
            headers: authHeaders(),
        });
        expect(res.statusCode).toBe(400);
        expect((res.json() as Json).error).toBe('invalid_request');
    });

    it('returns 400 invalid_request when limit < 1', async () => {
        const res = await app!.inject({
            method: 'GET',
            url: buildQuery({}, { limit: '0' }),
            headers: authHeaders(),
        });
        expect(res.statusCode).toBe(400);
        expect((res.json() as Json).error).toBe('invalid_request');
    });

    it('returns 400 invalid_request when limit > 200', async () => {
        const res = await app!.inject({
            method: 'GET',
            url: buildQuery({}, { limit: '201' }),
            headers: authHeaders(),
        });
        expect(res.statusCode).toBe(400);
        expect((res.json() as Json).error).toBe('invalid_request');
    });

    it('returns 400 invalid_request when limit is not an integer', async () => {
        const res = await app!.inject({
            method: 'GET',
            url: buildQuery({}, { limit: '3.5' }),
            headers: authHeaders(),
        });
        expect(res.statusCode).toBe(400);
        expect((res.json() as Json).error).toBe('invalid_request');
    });

    it('returns 400 invalid_request when reason is shorter than 10 chars', async () => {
        // Bypass the literal-typed `baseQuery` so we can pass a
        // sub-10-char value the Zod schema rejects with 400.
        const url =
            `/v1/audit?identityId=${baseQuery.identityId}` +
            `&actorRole=${baseQuery.actorRole}` +
            `&reason=short`;
        const res = await app!.inject({
            method: 'GET',
            url,
            headers: authHeaders(),
        });
        expect(res.statusCode).toBe(400);
        expect((res.json() as Json).error).toBe('invalid_request');
    });

    // -------------------------------------------------------------------
    // 3. Security regression: principal-trust
    // -------------------------------------------------------------------

    it('returns 400 invalid_request when actorId is injected via the query string', async () => {
        // The schema is `.strict()`; an unknown `actorId` query param
        // is rejected. This is the schema-level enforcement of the
        // principal-trust invariant: there is no public path that
        // lets a client rename the actor.
        const res = await app!.inject({
            method: 'GET',
            url: buildQuery({}, { actorId: 'spoofed-actor' }),
            headers: authHeaders(),
        });
        expect(res.statusCode).toBe(400);
        const body = res.json() as Json;
        expect(body.error).toBe('invalid_request');
        const details = body.details as Json[];
        const codes = details.map((d) => (d as { code: string }).code);
        expect(codes).toContain('unrecognized_keys');
    });

    // -------------------------------------------------------------------
    // 4. Auth boundary
    // -------------------------------------------------------------------

    it('returns 401 when no bearer token is supplied', async () => {
        const res = await app!.inject({
            method: 'GET',
            url: buildQuery(),
        });
        expect(res.statusCode).toBe(401);
        const body = res.json() as Json;
        expect(body.error).toBe('unauthorized');
        expect(typeof body.message).toBe('string');
    });

    it('returns 401 when the bearer token is malformed', async () => {
        const res = await app!.inject({
            method: 'GET',
            url: buildQuery(),
            headers: { authorization: 'Bearer not-a-jwt' },
        });
        expect(res.statusCode).toBe(401);
        const body = res.json() as Json;
        expect(body.error).toBe('unauthorized');
        expect(body.code).toBe('token_malformed');
    });

    it('returns 403 when the token lacks the vault:audit scope', async () => {
        const wrongScope = mintTestToken({
            secret: TEST_HMAC_SECRET,
            subject: 'user-1',
            scopes: ['vault:detokenize'],
            issuer: TEST_ISS,
            audience: TEST_AUD,
        });
        const res = await app!.inject({
            method: 'GET',
            url: buildQuery(),
            headers: { authorization: `Bearer ${wrongScope}` },
        });
        expect(res.statusCode).toBe(403);
        const body = res.json() as Json;
        expect(body.error).toBe('forbidden');
        expect(typeof body.message).toBe('string');
        expect(body.message).toMatch(/scope/);
    });
});

// ===========================================================================
// 5. Command-level error mapping — INVALID_INPUT → 400
// ===========================================================================

describe('GET /v1/audit — command error mapping', () => {
    let localApp: FastifyInstance | undefined;

    beforeAll(async () => {
        localApp = await buildAppWithAudit(
            makeThrowingFakeAudit(
                'INVALID_INPUT',
                'identityId must be a non-empty string.',
            ),
        );
    });

    afterAll(async () => {
        if (localApp) await localApp.close();
    });

    it('returns 400 INVALID_INPUT when the command rejects the request', async () => {
        const res = await localApp!.inject({
            method: 'GET',
            url: buildQuery(),
            headers: authHeaders(),
        });
        expect(res.statusCode).toBe(400);
        const body = res.json() as Json;
        expect(body.error).toBe('INVALID_INPUT');
        expect(typeof body.message).toBe('string');
    });
});

// ===========================================================================
// 6. 503 — vault dependencies not wired
// ===========================================================================

describe('GET /v1/audit — 503 when db is not wired', () => {
    it('returns 503 service_unavailable when app.db is undefined', async () => {
        // Production NODE_ENV + no VAULT_DB_URI + no db override means
        // the server boots with `app.db === undefined`. The auth
        // plugin is still wired (SERVICE_JWT_HMAC_SECRET is set), so
        // a valid token passes the auth boundary and reaches the
        // route. The route's lazy-dep guard short-circuits to 503.
        const noDbApp = await buildServer({
            config: {
            ...TEST_CONFIG,
            NODE_ENV: 'production',
            VAULT_ALLOW_UNSAFE_KEY_PROVIDER: true,
        },
        });
        try {
            await noDbApp.ready();
            const res = await noDbApp.inject({
                method: 'GET',
                url: buildQuery(),
                headers: authHeaders(),
            });
            expect(res.statusCode).toBe(503);
            const body = res.json() as Json;
            expect(body.error).toBe('service_unavailable');
            expect(typeof body.message).toBe('string');
        } finally {
            await noDbApp.close();
        }
    });
});

// ===========================================================================
// 7. 500 — principal-trust invariant tripped
// ===========================================================================

describe('GET /v1/audit — 500 when the authenticated principal has no subject', () => {
    it('returns 500 internal_error and does not fabricate an empty actor', async () => {
        // Build the real server, then add an onRequest hook that
        // runs AFTER the auth plugin's hook (which set the
        // principal from a verified token) and overrides the
        // principal's `subject` to an empty string. This simulates
        // the misconfiguration the route's invariant guards
        // against: a verifier that returns a principal object but
        // leaves the subject claim empty.
        const localDb = await createMemoryDatabase();
        (localDb as unknown as { audit: AuditRepository }).audit = makeFakeAudit();
        const localApp = await buildServer({ config: TEST_CONFIG, db: localDb });
        localApp.addHook('onRequest', async (req) => {
            (
                req as unknown as {
                    principal: {
                        subject: string;
                        scopes: Set<string>;
                    } | null;
                }
            ).principal = {
                subject: '',
                scopes: new Set(['vault:audit']),
            };
        });

        try {
            const res = await localApp.inject({
                method: 'GET',
                url: buildQuery(),
                headers: authHeaders(),
            });
            expect(res.statusCode).toBe(500);
            const body = res.json() as Json;
            // Central error handler collapses any non-4xx thrown
            // error to a generic envelope.
            expect(body.error).toBe('internal_error');
            expect(body.message).not.toContain('actorId');
        } finally {
            await localApp.close();
        }
    });
});

// ===========================================================================
// 8. Route registration sanity
// ===========================================================================

describe('GET /v1/audit registration', () => {
    it('route is registered (not silently shadowed)', async () => {
        const probeApp = await buildAppWithAudit(makeFakeAudit());
        try {
            // A 200 means we hit the route, not the JSON 404
            // handler. A shadowed route would 404.
            const res = await probeApp.inject({
                method: 'GET',
                url: buildQuery(),
                headers: authHeaders(),
            });
            expect(res.statusCode).toBe(200);
        } finally {
            await probeApp.close();
        }
    });
});