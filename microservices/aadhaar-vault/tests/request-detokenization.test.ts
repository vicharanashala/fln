/**
 * Unit tests for the `RequestDetokenization` command (Session 7B).
 *
 * Scope: behaviour of the command as a piece of orchestration. We
 * stub the six ports (`TokenRepository`, `IdentityRepository`,
 * `MfaFactorRepository`, `StepUpChallengeRepository`,
 * `AuditRepository`, `EventPublisher`) so a failure here is a
 * command-logic failure, not an adapter failure. The
 * `MemoryStepUpChallengeRepository` adapter is exercised separately
 * in `tests/step-up-challenge.repository.test.ts`.
 *
 * Coverage:
 *
 *   1. Happy path — returns challengeId/expiresAt/requiredFactor,
 *      writes a pending challenge, audits STEP_UP_REQUEST,
 *      publishes `DetokenizationRequested`. NEVER returns any
 *      plaintext Aadhaar.
 *   2. Validation: empty tokenId, empty factorId, empty actorId,
 *      empty reason.
 *   3. Token row missing → `TOKEN_NOT_FOUND`.
 *   4. Identity row missing → `IDENTITY_NOT_FOUND`.
 *   5. Factor row missing → `FACTOR_NOT_FOUND`.
 *   6. Factor row present but status != 'active' →
 *      `FACTOR_NOT_ACTIVE`.
 *   7. Factor row present but past expiresAt → `FACTOR_EXPIRED`.
 *   8. TTL is computed at request time and stored on the row.
 *   9. The command publishes the event AFTER the audit append.
 *  10. Challenge row carries the correct pin (tokenId, identityId,
 *      requestedBy, requiredFactorId, operation='detokenize').
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
    makeRequestDetokenization,
    type RequestDetokenizationCommand,
    type RequestDetokenizationCallerContext,
} from '../src/application/commands/request-detokenization.js';
import type {
    StepUpChallenge,
    StepUpChallengeRepository,
} from '../src/application/ports/step-up-challenge.repository.js';
import { MemoryStepUpChallengeRepository } from '../src/infrastructure/db/memory-step-up-challenge.repository.js';
import type {
    MfaFactor,
    MfaFactorRepository,
    InsertMfaFactorInput,
} from '../src/application/ports/mfa-repository.js';
import type {
    IdentityRecord,
    IdentityRepository,
} from '../src/db/ports/identity.repository.js';
import type {
    TokenRepository,
    TokenRow,
} from '../src/db/ports/token.repository.js';
import type {
    AuditEntry,
    AuditRepository,
} from '../src/db/ports/audit.repository.js';
import type { DomainEvent, EventPublisher } from '../src/application/ports/event-publisher.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIXED_IDENTITY_ID = '00000000-0000-4000-8000-000000000001';
const FIXED_TOKEN_ID = '11111111-1111-4111-8111-111111111111';
const FIXED_AAD = Buffer.from(
    'aadhaar-vault/v1|kv=kv-1|schema=1|identity=' + FIXED_IDENTITY_ID,
    'utf8',
);

const BASE_CONTEXT: RequestDetokenizationCallerContext = {
    actorId: 'state-admin-1',
    actorRole: 'STATE_ADMIN',
    reason: 'compliance review FLN-2026-Q3',
    requestId: 'req-stepup-001',
    sourceIp: '10.0.0.7',
    userAgent: 'fln-portal/0.1',
};

// ---------------------------------------------------------------------------
// In-memory adapters
// ---------------------------------------------------------------------------

function makeTokenRepo(opts: {
    rows?: TokenRow[];
} = {}): TokenRepository & { rows: TokenRow[] } {
    const rows = opts.rows ? [...opts.rows] : [];
    return {
        rows,
        async insert(token) {
            const row: TokenRow = { ...token, createdAt: Date.now() };
            rows.push(row);
            return row;
        },
        async findById(id) {
            return rows.find((r) => r.id === id) ?? null;
        },
    };
}

function makeIdentityRepo(opts: {
    rows?: IdentityRecord[];
} = {}): IdentityRepository & { rows: IdentityRecord[] } {
    const rows = opts.rows ? [...opts.rows] : [];
    return {
        rows,
        async insert(rec) {
            const row: IdentityRecord = {
                ...rec,
                createdAt: new Date(),
                rotatedAt: null,
                revokedAt: null,
            };
            rows.push(row);
            return row;
        },
        async getById(id) {
            return rows.find((r) => r.identityId === id) ?? null;
        },
        async revoke() {
            throw new Error('not used');
        },
        async rotate() {
            throw new Error('not used');
        },
    };
}

function makeMfaRepo(opts: {
    rows?: MfaFactor[];
} = {}): MfaFactorRepository & { rows: MfaFactor[] } {
    const rows = opts.rows ? [...opts.rows] : [];
    return {
        rows,
        async insert(rec: InsertMfaFactorInput): Promise<MfaFactor> {
            const row: MfaFactor = {
                factorId: rec.factorId,
                actor: rec.actor,
                factorType: rec.factorType,
                status: 'active',
                label: rec.label,
                encryptedSecret: rec.encryptedSecret,
                algorithm: rec.algorithm,
                digits: rec.digits,
                period: rec.period,
                lastUsedAt: null,
                expiresAt: rec.expiresAt ?? null,
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
            };
            rows.push(row);
            return row;
        },
        async markUsed(factorId, usedAt): Promise<MfaFactor | null> {
            const row = rows.find((r) => r.factorId === factorId);
            if (!row) return null;
            row.lastUsedAt = usedAt;
            return row;
        },
        async revoke(factorId): Promise<MfaFactor | null> {
            const row = rows.find((r) => r.factorId === factorId);
            if (!row) return null;
            row.status = 'revoked';
            return row;
        },
        async getById(factorId): Promise<MfaFactor | null> {
            return rows.find((r) => r.factorId === factorId) ?? null;
        },
        async listByActor(actor): Promise<MfaFactor[]> {
            return rows.filter((r) => r.actor === actor);
        },
        async listActiveByActor(actor): Promise<MfaFactor[]> {
            return rows.filter(
                (r) => r.actor === actor && r.status === 'active',
            );
        },
    };
}

function makeAuditRepo(): AuditRepository & { entries: AuditEntry[] } {
    const entries: AuditEntry[] = [];
    return {
        entries,
        async append(entry) {
            entries.push(entry);
        },
        async listByIdentity() {
            return [];
        },
    };
}

function makeEventPublisher(): EventPublisher & { events: DomainEvent[] } {
    const events: DomainEvent[] = [];
    return {
        events,
        async publish(ev) {
            events.push(ev);
        },
    };
}

function makeIdentityRow(
    overrides: Partial<IdentityRecord> = {},
): IdentityRecord {
    return {
        identityId: FIXED_IDENTITY_ID,
        ciphertext: Buffer.from('ciphertext-bytes', 'utf8'),
        aad: FIXED_AAD,
        pepperVersion: 1,
        keyVersion: 1,
        createdAt: new Date('2026-01-15T12:00:00Z'),
        rotatedAt: null,
        revokedAt: null,
        ...overrides,
    };
}

function makeTokenRow(overrides: Partial<TokenRow> = {}): TokenRow {
    return {
        id: FIXED_TOKEN_ID,
        identityId: FIXED_IDENTITY_ID,
        algorithm: 'aes-256-gcm',
        ciphertext: Buffer.from('123456789012', 'utf8'),
        iv: Buffer.from('00112233445566778899aabb', 'hex'),
        authTag: Buffer.alloc(16, 0xaa),
        wrappedDek: Buffer.from('cafebabe'.repeat(8), 'hex'),
        createdAt: Date.parse('2026-01-15T12:00:00Z'),
        ...overrides,
    };
}

function makeActiveFactor(overrides: Partial<MfaFactor> = {}): MfaFactor {
    return {
        factorId: 'factor-totp-1',
        actor: 'state-admin-1',
        factorType: 'totp',
        status: 'active',
        label: 'Phone TOTP',
        encryptedSecret: Buffer.alloc(0),
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        ...overrides,
    };
}

interface Fixture {
    request: ReturnType<typeof makeRequestDetokenization>;
    tokens: ReturnType<typeof makeTokenRepo>;
    identities: ReturnType<typeof makeIdentityRepo>;
    mfa: ReturnType<typeof makeMfaRepo>;
    challenges: MemoryStepUpChallengeRepository;
    audit: ReturnType<typeof makeAuditRepo>;
    events: ReturnType<typeof makeEventPublisher>;
    fixedNow: Date;
}

function makeFixture(opts: {
    tokens?: TokenRow[];
    identities?: IdentityRecord[];
    factors?: MfaFactor[];
    clock?: () => Date;
    ttlSeconds?: number;
    newChallengeId?: () => string;
} = {}): Fixture {
    const tokens = makeTokenRepo({
        rows: opts.tokens ?? [makeTokenRow()],
    });
    const identities = makeIdentityRepo({
        rows: opts.identities ?? [makeIdentityRow()],
    });
    const mfa = makeMfaRepo({
        rows: opts.factors ?? [makeActiveFactor()],
    });
    const challenges = new MemoryStepUpChallengeRepository();
    const audit = makeAuditRepo();
    const events = makeEventPublisher();
    const fixedNow = new Date('2026-01-15T12:00:00Z');

    const request = makeRequestDetokenization({
        tokens,
        identities,
        mfa,
        challenges,
        audit,
        events,
        clock: opts.clock ?? (() => fixedNow),
        ttlSeconds: opts.ttlSeconds ?? 300,
        newChallengeId:
            opts.newChallengeId ?? (() => 'challenge-test-id'),
    });

    return { request, tokens, identities, mfa, challenges, audit, events, fixedNow };
}

const BASE_CMD: RequestDetokenizationCommand = {
    tokenId: FIXED_TOKEN_ID,
    factorId: 'factor-totp-1',
    context: BASE_CONTEXT,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RequestDetokenization — happy path', () => {
    it('returns challengeId / expiresAt / requiredFactor, writes pending challenge, audits, publishes', async () => {
        const f = makeFixture();

        const result = await f.request(BASE_CMD);

        // Response shape.
        expect(result.challengeId).toBe('challenge-test-id');
        expect(result.expiresAt).toEqual(
            new Date('2026-01-15T12:05:00Z'), // fixedNow + 300s
        );
        expect(result.requiredFactor).toEqual({
            factorId: 'factor-totp-1',
            actor: 'state-admin-1',
            label: 'Phone TOTP',
            factorType: 'totp',
        });

        // No plaintext Aadhaar anywhere on the wire.
        const dumped = JSON.stringify(result);
        expect(dumped).not.toMatch(/\d{12}/);
        expect(dumped).not.toContain('123456789012');

        // Challenge row written, status='pending'.
        const stored = await f.challenges.findById('challenge-test-id');
        expect(stored).not.toBeNull();
        expect(stored!.status).toBe('pending');
        expect(stored!.operation).toBe('detokenize');
        expect(stored!.identityId).toBe(FIXED_IDENTITY_ID);
        expect(stored!.tokenId).toBe(FIXED_TOKEN_ID);
        expect(stored!.requestedBy).toBe('state-admin-1');
        expect(stored!.requiredFactorId).toBe('factor-totp-1');

        // Audit row.
        expect(f.audit.entries).toHaveLength(1);
        const row = f.audit.entries[0]!;
        expect(row.action).toBe('STEP_UP_REQUEST');
        expect(row.outcome).toBe('allow');
        expect(row.actor).toBe('state-admin-1');
        expect(row.identityId).toBe(FIXED_IDENTITY_ID);
        expect(row.requestId).toBe('req-stepup-001');
        expect(row.meta).toMatchObject({
            challenge_id: 'challenge-test-id',
            token_id: FIXED_TOKEN_ID,
            operation: 'detokenize',
            required_factor_id: 'factor-totp-1',
            required_factor_actor: 'state-admin-1',
            required_factor_type: 'totp',
            source_ip: '10.0.0.7',
            user_agent: 'fln-portal/0.1',
        });

        // Event published.
        expect(f.events.events).toHaveLength(1);
        const ev = f.events.events[0]!;
        expect(ev.type).toBe('DetokenizationRequested');
        expect(ev.challengeId).toBe('challenge-test-id');
        expect(ev.identityId).toBe(FIXED_IDENTITY_ID);
        expect(ev.tokenId).toBe(FIXED_TOKEN_ID);
        expect(ev.requiredFactorId).toBe('factor-totp-1');
        expect(ev.requiredFactorActor).toBe('state-admin-1');
        expect(ev.requestedBy).toBe('state-admin-1');
        expect(ev.requestedByRole).toBe('STATE_ADMIN');
        expect(ev.expiresAt).toBe('2026-01-15T12:05:00.000Z');
        expect(ev.occurredAt).toBe('2026-01-15T12:00:00.000Z');
    });

    it('TTL knob controls the challenge expiry', async () => {
        const f = makeFixture({ ttlSeconds: 60 });
        const result = await f.request(BASE_CMD);
        expect(result.expiresAt).toEqual(
            new Date('2026-01-15T12:01:00Z'),
        );
    });

    it('publishes the event AFTER the audit append', async () => {
        const f = makeFixture();
        const callOrder: string[] = [];
        const origAppend = f.audit.append.bind(f.audit);
        f.audit.append = async (entry) => {
            callOrder.push('audit.append');
            return origAppend(entry);
        };
        const origPublish = f.events.publish.bind(f.events);
        f.events.publish = async (ev) => {
            callOrder.push('events.publish');
            return origPublish(ev);
        };

        await f.request(BASE_CMD);
        expect(callOrder).toEqual(['audit.append', 'events.publish']);
    });

    it('a misconfigured ttlSeconds throws INVALID_CONFIG (500) without touching ports', async () => {
        const f = makeFixture({ ttlSeconds: 0 });
        await expect(f.request(BASE_CMD)).rejects.toMatchObject({
            name: 'RequestDetokenizationCommandError',
            code: 'INVALID_CONFIG',
            httpStatus: 500,
        });
        expect(f.audit.entries).toHaveLength(0);
        expect(f.events.events).toHaveLength(0);
    });
});

describe('RequestDetokenization — input validation', () => {
    let f: Fixture;
    beforeEach(() => {
        f = makeFixture();
    });

    it('rejects empty tokenId', async () => {
        await expect(
            f.request({ ...BASE_CMD, tokenId: '' }),
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
        expect(f.audit.entries).toHaveLength(0);
        expect(f.events.events).toHaveLength(0);
    });

    it('rejects empty factorId', async () => {
        await expect(
            f.request({ ...BASE_CMD, factorId: '' }),
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    it('rejects empty actorId', async () => {
        await expect(
            f.request({
                ...BASE_CMD,
                context: { ...BASE_CONTEXT, actorId: '' },
            }),
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    it('rejects empty reason', async () => {
        await expect(
            f.request({
                ...BASE_CMD,
                context: { ...BASE_CONTEXT, reason: '' },
            }),
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });
});

describe('RequestDetokenization — lookup failures', () => {
    it('TOKEN_NOT_FOUND when the token row is missing', async () => {
        const f = makeFixture({ tokens: [] });
        await expect(f.request(BASE_CMD)).rejects.toMatchObject({
            code: 'TOKEN_NOT_FOUND',
            httpStatus: 404,
        });
        expect(f.audit.entries).toHaveLength(0);
        expect(f.events.events).toHaveLength(0);
    });

    it('IDENTITY_NOT_FOUND when the identity row is missing', async () => {
        const f = makeFixture({ identities: [] });
        await expect(f.request(BASE_CMD)).rejects.toMatchObject({
            code: 'IDENTITY_NOT_FOUND',
            httpStatus: 404,
        });
        expect(f.audit.entries).toHaveLength(0);
        expect(f.events.events).toHaveLength(0);
    });

    it('FACTOR_NOT_FOUND when the factor row is missing', async () => {
        const f = makeFixture({ factors: [] });
        await expect(f.request(BASE_CMD)).rejects.toMatchObject({
            code: 'FACTOR_NOT_FOUND',
            httpStatus: 404,
        });
        expect(f.audit.entries).toHaveLength(0);
        expect(f.events.events).toHaveLength(0);
    });

    it('FACTOR_NOT_ACTIVE when the factor is revoked', async () => {
        const f = makeFixture({
            factors: [
                makeActiveFactor({ status: 'revoked' }),
            ],
        });
        await expect(f.request(BASE_CMD)).rejects.toMatchObject({
            code: 'FACTOR_NOT_ACTIVE',
            httpStatus: 403,
        });
        expect(f.audit.entries).toHaveLength(0);
        expect(f.events.events).toHaveLength(0);
    });

    it('FACTOR_EXPIRED when now > expiresAt', async () => {
        const f = makeFixture({
            factors: [
                makeActiveFactor({
                    expiresAt: new Date('2025-12-31T00:00:00.000Z'),
                }),
            ],
        });
        await expect(f.request(BASE_CMD)).rejects.toMatchObject({
            code: 'FACTOR_EXPIRED',
            httpStatus: 403,
        });
    });
});

describe('RequestDetokenization — interaction with downstream commands', () => {
    /**
     * Session 7B end-to-end check: after a successful request, the
     * challenge row pins everything VerifyMfa + DetokenizeAadhaar
     * later need to validate. This test confirms the row shape
     * matches the contract those commands expect, without going
     * through them here (their tests cover the consumer side).
     */
    it('persists a challenge row whose shape is consumable by downstream commands', async () => {
        const f = makeFixture();
        await f.request(BASE_CMD);

        const stored: StepUpChallenge | null = await f.challenges.findById(
            'challenge-test-id',
        );
        expect(stored).toMatchObject({
            challengeId: 'challenge-test-id',
            operation: 'detokenize',
            identityId: FIXED_IDENTITY_ID,
            tokenId: FIXED_TOKEN_ID,
            requestedBy: 'state-admin-1',
            status: 'pending',
            requiredFactorId: 'factor-totp-1',
            approvedAt: null,
            consumedAt: null,
            verifiedFactorId: null,
            auditId: null,
        });
    });
});