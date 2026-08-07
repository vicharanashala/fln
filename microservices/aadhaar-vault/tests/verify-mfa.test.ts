/**
 * Unit tests for the `VerifyMfa` application command (Session 5C).
 *
 * Style mirrors `tests/enroll-mfa.test.ts` and
 * `tests/read-audit-history.test.ts`: pure in-memory adapters for
 * the four ports, the real `LocalDevKeyManager` for crypto, and
 * a fake TOTP verifier. No Postgres, no Fastify, no
 * `node:crypto` invocation outside what the port adapter does
 * internally.
 *
 * What we cover:
 *
 *   1. Happy path — verifies a code, opens the sealed secret,
 *      calls `markUsed`, audits with `delta`, publishes
 *      `MfaVerified`, and returns the success result.
 *   2. The `delta` returned by the verifier is propagated to
 *      the success result AND the audit row.
 *   3. The `window` argument is forwarded to `TotpVerifier.verifyCode`.
 *   4. The `lastUsedAt` on the returned factor matches the
 *      clock that was injected.
 *   5. Validation: empty `actorId`, empty `factorId`, non-string
 *      `code`, non-digit `code`, wrong-length `code`, empty
 *      `expectedActor`, negative/non-integer `window`.
 *   6. Failure mode — `FACTOR_NOT_FOUND` (no row at all).
 *   7. Failure mode — `FACTOR_REVOKED` (status != 'active').
 *   8. Failure mode — `FACTOR_EXPIRED` (now > expiresAt).
 *   9. Failure mode — `ACTOR_MISMATCH` (expectedActor set and
 *      differs from factor's actor).
 *  10. Failure mode — `CODE_MISMATCH` (verifier returns invalid).
 *  11. Every failure path still audits and publishes the
 *      `MfaVerificationFailed` event.
 *  12. The audit row on success uses `outcome: 'allow'`; on
 *      failure uses `outcome: 'deny'`.
 *  13. The audit row's `actor` field is the *caller*'s
 *      `actorId`, not the factor's actor (same convention as
 *      `EnrollMfa`).
 *  14. The sealed envelope opened with the per-factor context
 *      is the raw TOTP secret (round-trip).
 *  15. Cross-context opening fails (factor A's envelope cannot
 *      be opened under factor B's context).
 *  16. Plaintext hygiene — the opened secret is zeroed after
 *      `verifyCode` returns.
 *  17. If `markUsed` returns null, the command returns
 *      `FACTOR_NOT_FOUND` (defensive fallback).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
    makeVerifyMfa,
    VerifyMfaCommandError,
} from '../src/application/commands/verify-mfa.js';
import { LocalDevKeyManager } from '../src/infrastructure/key-providers/local-dev-key-manager.js';
import type { KeyManager } from '../src/application/ports/key-manager.js';
import type {
    TotpFactorMeta,
    TotpVerifyResult,
    TotpVerifier,
} from '../src/application/ports/totp-verifier.js';
import type {
    MfaFactor,
    InsertMfaFactorInput,
    MfaFactorRepository,
} from '../src/application/ports/mfa-repository.js';
import type {
    AuditEntry,
    AuditRecord,
    AuditRepository,
} from '../src/db/ports/audit.repository.js';
import type { DomainEvent, EventPublisher } from '../src/application/ports/event-publisher.js';

// ---------------------------------------------------------------------------
// In-memory test adapters
// ---------------------------------------------------------------------------

/**
 * Minimal, in-process TOTP verifier. The real `TotpVerifier`
 * adapter pulls in `otpauth`; here we model only the *shape* the
 * command needs (the bytes it must seal, the URI it surfaces)
 * so the test stays fast and free of node-only deps that
 * conflict with the application-layer rule.
 *
 * The same `FakeTotpVerifier` shape is used by `enroll-mfa.test.ts`
 * but kept local here so the two tests are independent.
 */
class FakeTotpVerifier implements TotpVerifier {
    /**
     * Recorded `verifyCode` calls. We capture TWO views of the
     * secret the command passed in:
     *
     *   - `secretBytesCopy`: a *snapshot copy* taken at the
     *     moment verifyCode is invoked, so we can assert on
     *     the plaintext bytes the command intended to hand
     *     to the verifier (BEFORE the command's `finally`
     *     zeros the buffer via `safeZero`).
     *   - `secretRef`: the live `Buffer` reference. After
     *     the command's promise resolves (i.e. AFTER its
     *     `finally` block has run), this reference MUST be
     *     all zeros. This is the plaintext-hygiene check.
     */
    public verifyCalls: Array<{
        secretBytesCopy: Buffer;
        secretRef: Buffer;
        code: string;
        window?: number;
        nowMs?: number;
    }> = [];

    public verifyResult: TotpVerifyResult = { valid: false };

    async generateEnrollment(): Promise<{
        secret: Buffer;
        otpauthUri: string;
    }> {
        // Not used by VerifyMfa but required by the port.
        return { secret: Buffer.alloc(0), otpauthUri: '' };
    }

    async verifyCode(
        secret: Buffer,
        code: string,
        window?: number,
        nowMs?: number,
    ): Promise<TotpVerifyResult> {
        this.verifyCalls.push({
            secretBytesCopy: Buffer.from(secret),
            secretRef: secret,
            code,
            window,
            nowMs,
        });
        return this.verifyResult;
    }

    async currentCode(): Promise<string> {
        return '000000';
    }

    async generateCode(): Promise<{
        secret: Buffer;
        otpauthUri: string;
        meta: TotpFactorMeta;
    }> {
        return {
            secret: Buffer.alloc(0),
            otpauthUri: '',
            meta: { algorithm: 'SHA1', digits: 6, period: 30 },
        };
    }
}

/**
 * In-memory `MfaFactorRepository`. Persists a single row per
 * `factorId`.
 */
class InMemoryMfaRepository implements MfaFactorRepository {
    public readonly byFactorId = new Map<string, MfaFactor>();
    public insertCalls: InsertMfaFactorInput[] = [];
    public markUsedCalls: Array<{ factorId: string; usedAt: Date }> = [];

    /** Optional fail hook for negative tests. */
    public markUsedShouldReturnNull = false;

    async insert(rec: InsertMfaFactorInput): Promise<MfaFactor> {
        this.insertCalls.push(rec);
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
        this.byFactorId.set(rec.factorId, row);
        return row;
    }

    async markUsed(factorId: string, usedAt: Date): Promise<MfaFactor | null> {
        this.markUsedCalls.push({ factorId, usedAt });
        if (this.markUsedShouldReturnNull) return null;
        const row = this.byFactorId.get(factorId);
        if (!row) return null;
        row.lastUsedAt = usedAt;
        return row;
    }

    async revoke(factorId: string): Promise<MfaFactor | null> {
        const row = this.byFactorId.get(factorId);
        if (!row) return null;
        row.status = 'revoked';
        return row;
    }

    async getById(factorId: string): Promise<MfaFactor | null> {
        return this.byFactorId.get(factorId) ?? null;
    }

    async listByActor(actor: string): Promise<MfaFactor[]> {
        return Array.from(this.byFactorId.values())
            .filter((r) => r.actor === actor)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    async listActiveByActor(actor: string): Promise<MfaFactor[]> {
        return (await this.listByActor(actor)).filter(
            (r) => r.status === 'active',
        );
    }
}

/** In-memory `AuditRepository`. Mirrors the enroll-mfa test fixture. */
class InMemoryAuditRepository implements AuditRepository {
    public readonly entries: AuditRecord[] = [];
    public nextId = 1;
    public appendShouldThrow: Error | null = null;

    async append(entry: AuditEntry): Promise<void> {
        if (this.appendShouldThrow) throw this.appendShouldThrow;
        const rec: AuditRecord = {
            ...entry,
            auditId: this.nextId++,
            occurredAt: new Date('2026-01-01T00:00:00.000Z'),
        };
        this.entries.push(rec);
    }

    async listByIdentity(): Promise<AuditRecord[]> {
        return [...this.entries];
    }
}

/** In-memory `EventPublisher`. Records the call site for asserts. */
class InMemoryEventPublisher implements EventPublisher {
    public readonly events: DomainEvent[] = [];
    public publishShouldThrow: Error | null = null;

    async publish(event: DomainEvent): Promise<void> {
        if (this.publishShouldThrow) throw this.publishShouldThrow;
        this.events.push(event);
    }
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_CALLER = {
    actorId: 'admin-001',
    actorRole: 'SUPER_ADMIN' as const,
    reason: 'mfa-verify-test',
    requestId: 'req-1',
    sourceIp: '127.0.0.1',
    userAgent: 'vitest',
};

/**
 * Creates a fully wired fixture. The `clock` is fixed at
 * '2026-01-01T12:00:00.000Z' so all assertions are
 * deterministic.
 *
 * @param factorOverrides per-test overrides applied to the
 *   seeded factor (e.g. setting `status: 'revoked'` for the
 *   `FACTOR_REVOKED` test).
 */
function makeFixture(factorOverrides: Partial<MfaFactor> = {}) {
    const keyManager: KeyManager = new LocalDevKeyManager({
        keyVersion: 'kv-test',
        masterKey: Buffer.alloc(32, 0x42),
        acknowledgedUnsafe: false,
    });
    const totp = new FakeTotpVerifier();
    const mfa = new InMemoryMfaRepository();
    const audit = new InMemoryAuditRepository();
    const events = new InMemoryEventPublisher();

    const fixedNow = new Date('2026-01-01T12:00:00.000Z');
    const verify = makeVerifyMfa({
        keyManager,
        totp,
        mfa,
        audit,
        events,
        clock: () => fixedNow,
    });

    return { keyManager, totp, mfa, audit, events, verify, fixedNow };
}

/**
 * Seal a raw TOTP secret using the same `KeyManager` the
 * production code uses, under the canonical per-factor
 * context. Returns the *envelope* bytes that the command
 * would persist.
 *
 * Note: the `KeyManager` port's `sealSecret` takes a raw
 * `Buffer` (the plaintext payload) — NOT a `{bytes: ...}`
 * wrapper. That wrapper is the *output* type
 * (`WrappedSecret`) and is what `openSecret` consumes.
 */
async function sealFactorSecret(
    keyManager: KeyManager,
    factorId: string,
    rawSecret: Buffer,
): Promise<Buffer> {
    const ctx = Buffer.from(`mfa-factor:${factorId}`, 'utf8');
    const envelope = await keyManager.sealSecret(rawSecret, ctx);
    return Buffer.from(envelope.bytes);
}

/**
 * Seed a default active factor in the in-memory MFA repo.
 * Returns the factor id.
 */
async function seedActiveFactor(
    mfa: InMemoryMfaRepository,
    keyManager: KeyManager,
    overrides: Partial<InsertMfaFactorInput> = {},
): Promise<string> {
    const factorId = 'factor-1';
    const rawSecret = Buffer.alloc(20, 0x42);
    const envelope = await sealFactorSecret(keyManager, factorId, rawSecret);
    const row: InsertMfaFactorInput = {
        factorId,
        actor: 'user-42',
        factorType: 'totp',
        label: 'Phone TOTP',
        encryptedSecret: envelope,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        expiresAt: null,
        ...overrides,
    };
    await mfa.insert(row);
    return factorId;
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('VerifyMfa — happy path', () => {
    it('verifies a code, marks the factor used, audits, and publishes MfaVerified', async () => {
        const f = makeFixture();
        const factorId = await seedActiveFactor(f.mfa, f.keyManager);
        f.totp.verifyResult = { valid: true, delta: 0 };

        const result = await f.verify({
            factorId,
            code: '123456',
            context: TEST_CALLER,
        });

        // 1. Result shape.
        expect(result.valid).toBe(true);
        if (!result.valid) throw new Error('expected success');
        expect(result.factorId).toBe(factorId);
        expect(result.actor).toBe('user-42');
        expect(result.delta).toBe(0);
        expect(result.factor.factorId).toBe(factorId);
        expect(result.factor.lastUsedAt).toEqual(f.fixedNow);

        // 2. markUsed was called exactly once with the fixed
        //    clock.
        expect(f.mfa.markUsedCalls).toHaveLength(1);
        expect(f.mfa.markUsedCalls[0]).toEqual({
            factorId,
            usedAt: f.fixedNow,
        });

        // 3. The verifier was called with the opened secret
        //    and the user-supplied code.
        expect(f.totp.verifyCalls).toHaveLength(1);
        const call = f.totp.verifyCalls[0]!;
        expect(call.code).toBe('123456');
        expect(call.window).toBe(1); // default
        expect(call.nowMs).toBe(f.fixedNow.getTime());
        // The opened secret must equal the raw secret we
        // sealed (20 bytes of 0x42). We check the
        // *snapshot copy* (taken inside the fake at
        // call time) so safeZero's later zeroing of the
        // live buffer does not interfere.
        expect(call.secretBytesCopy.equals(Buffer.alloc(20, 0x42))).toBe(true);

        // 4. Audit row was appended with allow.
        expect(f.audit.entries).toHaveLength(1);
        const row = f.audit.entries[0]!;
        expect(row.action).toBe('MFA_VERIFY');
        expect(row.outcome).toBe('allow');
        expect(row.actor).toBe('admin-001');
        expect(row.identityId).toBeNull();
        expect(row.reason).toBe('mfa-verify-test');
        expect(row.meta).toMatchObject({
            factor_id: factorId,
            factor_type: 'totp',
            factor_actor: 'user-42',
            delta: 0,
            window: 1,
            source_ip: '127.0.0.1',
            user_agent: 'vitest',
        });

        // 5. The success event was published.
        expect(f.events.events).toHaveLength(1);
        expect(f.events.events[0]).toMatchObject({
            type: 'MfaVerified',
            factorId,
            actor: 'user-42',
            delta: 0,
            verifiedBy: 'admin-001',
            verifiedByRole: 'SUPER_ADMIN',
        });
    });

    it('propagates a non-zero delta from the verifier', async () => {
        const f = makeFixture();
        const factorId = await seedActiveFactor(f.mfa, f.keyManager);
        f.totp.verifyResult = { valid: true, delta: -1 };

        const result = await f.verify({
            factorId,
            code: '123456',
            context: TEST_CALLER,
        });
        expect(result.valid).toBe(true);
        if (!result.valid) throw new Error('expected success');
        expect(result.delta).toBe(-1);

        expect(f.audit.entries[0]?.meta).toMatchObject({ delta: -1 });
        expect(f.events.events[0]).toMatchObject({
            type: 'MfaVerified',
            delta: -1,
        });
    });

    it('forwards the caller-supplied window to the verifier', async () => {
        const f = makeFixture();
        const factorId = await seedActiveFactor(f.mfa, f.keyManager);
        f.totp.verifyResult = { valid: true, delta: 0 };

        await f.verify({
            factorId,
            code: '123456',
            context: TEST_CALLER,
            window: 3,
        });
        expect(f.totp.verifyCalls[0]?.window).toBe(3);
        expect(f.audit.entries[0]?.meta).toMatchObject({ window: 3 });
    });

    it('accepts an explicit expectedActor that matches the factor actor', async () => {
        const f = makeFixture();
        const factorId = await seedActiveFactor(f.mfa, f.keyManager);
        f.totp.verifyResult = { valid: true, delta: 0 };

        const result = await f.verify({
            factorId,
            code: '123456',
            context: TEST_CALLER,
            expectedActor: 'user-42',
        });
        expect(result.valid).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('VerifyMfa — input validation', () => {
    let f: ReturnType<typeof makeFixture>;
    let factorId: string;
    beforeEach(async () => {
        f = makeFixture();
        factorId = await seedActiveFactor(f.mfa, f.keyManager);
        f.totp.verifyResult = { valid: true, delta: 0 };
    });

    it('rejects an empty factorId', async () => {
        await expect(
            f.verify({ factorId: '', code: '123456', context: TEST_CALLER }),
        ).rejects.toBeInstanceOf(VerifyMfaCommandError);
    });

    it('rejects an empty actorId in caller context', async () => {
        await expect(
            f.verify({
                factorId,
                code: '123456',
                context: { ...TEST_CALLER, actorId: '' },
            }),
        ).rejects.toBeInstanceOf(VerifyMfaCommandError);
    });

    it('rejects a non-string code', async () => {
        await expect(
            f.verify({
                factorId,
                // @ts-expect-error — intentionally wrong type
                code: 123456,
                context: TEST_CALLER,
            }),
        ).rejects.toBeInstanceOf(VerifyMfaCommandError);
    });

    it('rejects a code with non-digit characters', async () => {
        await expect(
            f.verify({
                factorId,
                code: '12345a',
                context: TEST_CALLER,
            }),
        ).rejects.toBeInstanceOf(VerifyMfaCommandError);
    });

    it('rejects a code with the wrong length', async () => {
        await expect(
            f.verify({
                factorId,
                code: '12345',
                context: TEST_CALLER,
            }),
        ).rejects.toBeInstanceOf(VerifyMfaCommandError);
    });

    it('rejects an empty expectedActor when supplied', async () => {
        await expect(
            f.verify({
                factorId,
                code: '123456',
                context: TEST_CALLER,
                expectedActor: '',
            }),
        ).rejects.toBeInstanceOf(VerifyMfaCommandError);
    });

    it('rejects a negative window', async () => {
        await expect(
            f.verify({
                factorId,
                code: '123456',
                context: TEST_CALLER,
                window: -1,
            }),
        ).rejects.toBeInstanceOf(VerifyMfaCommandError);
    });

    it('rejects a non-integer window', async () => {
        await expect(
            f.verify({
                factorId,
                code: '123456',
                context: TEST_CALLER,
                window: 1.5,
            }),
        ).rejects.toBeInstanceOf(VerifyMfaCommandError);
    });

    it('does not touch any port when validation fails', async () => {
        await f
            .verify({ factorId: '', code: '123456', context: TEST_CALLER })
            .catch(() => {});
        expect(f.mfa.markUsedCalls).toHaveLength(0);
        expect(f.totp.verifyCalls).toHaveLength(0);
        expect(f.audit.entries).toHaveLength(0);
        expect(f.events.events).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// Failure modes
// ---------------------------------------------------------------------------

describe('VerifyMfa — failure modes', () => {
    it('returns FACTOR_NOT_FOUND when no row exists, audits, and publishes MfaVerificationFailed', async () => {
        const f = makeFixture();
        const result = await f.verify({
            factorId: 'does-not-exist',
            code: '123456',
            context: TEST_CALLER,
        });

        expect(result.valid).toBe(false);
        if (result.valid) throw new Error('expected failure');
        expect(result.reason).toBe('FACTOR_NOT_FOUND');
        expect(result.factorId).toBe('does-not-exist');

        // No markUsed, no verifyCode call.
        expect(f.mfa.markUsedCalls).toHaveLength(0);
        expect(f.totp.verifyCalls).toHaveLength(0);

        // Audit row present, denied.
        expect(f.audit.entries).toHaveLength(1);
        const row = f.audit.entries[0]!;
        expect(row.action).toBe('MFA_VERIFY');
        expect(row.outcome).toBe('deny');
        expect(row.actor).toBe('admin-001');
        expect(row.meta).toMatchObject({
            factor_id: 'does-not-exist',
            factor_actor: null,
            failure_reason: 'FACTOR_NOT_FOUND',
        });

        // Failure event published.
        expect(f.events.events).toHaveLength(1);
        expect(f.events.events[0]).toMatchObject({
            type: 'MfaVerificationFailed',
            factorId: 'does-not-exist',
            actor: null,
            reason: 'FACTOR_NOT_FOUND',
            attemptedBy: 'admin-001',
            attemptedByRole: 'SUPER_ADMIN',
        });
    });

    it('returns FACTOR_REVOKED when the factor exists but is not active', async () => {
        const f = makeFixture();
        const factorId = await seedActiveFactor(f.mfa, f.keyManager);
        // Manually revoke.
        await f.mfa.revoke(factorId);

        const result = await f.verify({
            factorId,
            code: '123456',
            context: TEST_CALLER,
        });

        expect(result.valid).toBe(false);
        if (result.valid) throw new Error('expected failure');
        expect(result.reason).toBe('FACTOR_REVOKED');

        expect(f.audit.entries[0]?.meta).toMatchObject({
            failure_reason: 'FACTOR_REVOKED',
            factor_actor: 'user-42',
        });
        expect(f.events.events[0]).toMatchObject({
            type: 'MfaVerificationFailed',
            reason: 'FACTOR_REVOKED',
        });
    });

    it('returns FACTOR_EXPIRED when now is past expiresAt', async () => {
        const f = makeFixture();
        const factorId = await seedActiveFactor(f.mfa, f.keyManager, {
            expiresAt: new Date('2025-12-31T00:00:00.000Z'),
        });

        const result = await f.verify({
            factorId,
            code: '123456',
            context: TEST_CALLER,
        });

        expect(result.valid).toBe(false);
        if (result.valid) throw new Error('expected failure');
        expect(result.reason).toBe('FACTOR_EXPIRED');

        expect(f.audit.entries[0]?.meta).toMatchObject({
            failure_reason: 'FACTOR_EXPIRED',
        });
        expect(f.events.events[0]).toMatchObject({
            type: 'MfaVerificationFailed',
            reason: 'FACTOR_EXPIRED',
        });
    });

    it('returns ACTOR_MISMATCH when expectedActor differs from the factor actor', async () => {
        const f = makeFixture();
        const factorId = await seedActiveFactor(f.mfa, f.keyManager);

        const result = await f.verify({
            factorId,
            code: '123456',
            context: TEST_CALLER,
            expectedActor: 'someone-else',
        });

        expect(result.valid).toBe(false);
        if (result.valid) throw new Error('expected failure');
        expect(result.reason).toBe('ACTOR_MISMATCH');

        expect(f.audit.entries[0]?.meta).toMatchObject({
            failure_reason: 'ACTOR_MISMATCH',
            factor_actor: 'user-42',
        });
        expect(f.events.events[0]).toMatchObject({
            type: 'MfaVerificationFailed',
            reason: 'ACTOR_MISMATCH',
        });
    });

    it('returns CODE_MISMATCH when the verifier rejects the code', async () => {
        const f = makeFixture();
        const factorId = await seedActiveFactor(f.mfa, f.keyManager);
        f.totp.verifyResult = { valid: false };

        const result = await f.verify({
            factorId,
            code: '000000',
            context: TEST_CALLER,
        });

        expect(result.valid).toBe(false);
        if (result.valid) throw new Error('expected failure');
        expect(result.reason).toBe('CODE_MISMATCH');

        // The verifier WAS called (we got past the
        // pre-checks).
        expect(f.totp.verifyCalls).toHaveLength(1);
        // But markUsed was NOT called.
        expect(f.mfa.markUsedCalls).toHaveLength(0);

        expect(f.audit.entries[0]?.meta).toMatchObject({
            failure_reason: 'CODE_MISMATCH',
            factor_actor: 'user-42',
        });
        expect(f.events.events[0]).toMatchObject({
            type: 'MfaVerificationFailed',
            reason: 'CODE_MISMATCH',
        });
    });

    it('returns FACTOR_NOT_FOUND when markUsed returns null (row vanished)', async () => {
        const f = makeFixture();
        const factorId = await seedActiveFactor(f.mfa, f.keyManager);
        f.totp.verifyResult = { valid: true, delta: 0 };
        f.mfa.markUsedShouldReturnNull = true;

        const result = await f.verify({
            factorId,
            code: '123456',
            context: TEST_CALLER,
        });

        expect(result.valid).toBe(false);
        if (result.valid) throw new Error('expected failure');
        expect(result.reason).toBe('FACTOR_NOT_FOUND');

        // The audit row IS present (the failure-recording
        // helper fired before the result was returned).
        expect(f.audit.entries[0]?.meta).toMatchObject({
            failure_reason: 'FACTOR_NOT_FOUND',
        });
        // No success event was published.
        expect(f.events.events.some((e) => e.type === 'MfaVerified')).toBe(false);
    });

    it('every failure mode records a deny audit row with the caller as actor', async () => {
        const f = makeFixture();
        // FACTOR_NOT_FOUND
        await f.verify({
            factorId: 'missing',
            code: '123456',
            context: TEST_CALLER,
        });
        // FACTOR_REVOKED
        const revId = await seedActiveFactor(f.mfa, f.keyManager);
        await f.mfa.revoke(revId);
        await f.verify({
            factorId: revId,
            code: '123456',
            context: TEST_CALLER,
        });
        // CODE_MISMATCH
        const okId = await seedActiveFactor(f.mfa, f.keyManager);
        f.totp.verifyResult = { valid: false };
        await f.verify({
            factorId: okId,
            code: '123456',
            context: TEST_CALLER,
        });

        expect(f.audit.entries).toHaveLength(3);
        for (const row of f.audit.entries) {
            expect(row.outcome).toBe('deny');
            expect(row.actor).toBe('admin-001');
            expect(row.meta).toHaveProperty('failure_reason');
        }
    });
});

// ---------------------------------------------------------------------------
// Sealing invariants
// ---------------------------------------------------------------------------

describe('VerifyMfa — sealing invariants', () => {
    it('opens the sealed envelope under the per-factor context', async () => {
        const f = makeFixture();
        const factorId = await seedActiveFactor(f.mfa, f.keyManager);
        f.totp.verifyResult = { valid: true, delta: 0 };

        await f.verify({
            factorId,
            code: '123456',
            context: TEST_CALLER,
        });

        // The verifier was called with the *raw* TOTP
        // secret (20 bytes of 0x42), not the envelope.
        // We check the snapshot copy to avoid
        // safeZero's later zeroing of the live buffer.
        const call = f.totp.verifyCalls[0]!;
        expect(call.secretBytesCopy.equals(Buffer.alloc(20, 0x42))).toBe(true);
    });

    it('a per-factor context mismatch prevents verification (defense-in-depth)', async () => {
        // Verify by directly swapping the factor's envelope
        // with one sealed under a *different* factor_id
        // context. The command must surface this as a
        // CODE_MISMATCH (openSecret throws, the
        // try/finally zeroes what it can, and the throw
        // propagates out). We assert the throw.
        const f = makeFixture();
        const factorId = await seedActiveFactor(f.mfa, f.keyManager);

        // Seal the same raw secret under a different
        // factor_id context.
        const wrongCtx = Buffer.from('mfa-factor:other-factor', 'utf8');
        const tampered = await f.keyManager.sealSecret(
            Buffer.alloc(20, 0x42),
            wrongCtx,
        );
        const row = f.mfa.byFactorId.get(factorId)!;
        row.encryptedSecret = Buffer.from(tampered.bytes);

        // The openSecret step will throw because the
        // context doesn't match the seal context.
        await expect(
            f.verify({
                factorId,
                code: '123456',
                context: TEST_CALLER,
            }),
        ).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Plaintext hygiene
// ---------------------------------------------------------------------------

describe('VerifyMfa — plaintext hygiene', () => {
    /**
     * Plaintext-hygiene check: after the command's promise
     * resolves, the `safeZero` in its `finally` block MUST
     * have zeroed the buffer the verifier received.
     *
     * The fake verifier stores the *live reference* as
     * `verifyCalls[0].secretRef`. We assert on that
     * reference *after* `f.verify(...)` has resolved (so
     * the command's `finally` has already run).
     *
     * Note: the snapshot copy (`secretBytesCopy`) and the
     * live reference (`secretRef`) initially hold the same
     * bytes; only the live reference is mutated by
     * `safeZero`.
     */
    it('the opened secret is zeroed after verifyCode returns (success path)', async () => {
        const f = makeFixture();
        const factorId = await seedActiveFactor(f.mfa, f.keyManager);
        f.totp.verifyResult = { valid: true, delta: 0 };

        await f.verify({
            factorId,
            code: '123456',
            context: TEST_CALLER,
        });

        const call = f.totp.verifyCalls[0]!;
        // Sanity: we DID receive a non-empty secret
        // before it was zeroed.
        expect(call.secretBytesCopy.length).toBe(20);
        expect(call.secretBytesCopy.equals(Buffer.alloc(20, 0x42))).toBe(true);
        // Hygiene: the live reference is all zeros now.
        expect(call.secretRef.equals(Buffer.alloc(call.secretRef.length, 0))).toBe(true);
    });

    it('the opened secret is zeroed even when the verifier reports a code mismatch', async () => {
        const f = makeFixture();
        const factorId = await seedActiveFactor(f.mfa, f.keyManager);
        f.totp.verifyResult = { valid: false };

        await f.verify({
            factorId,
            code: '000000',
            context: TEST_CALLER,
        });

        const call = f.totp.verifyCalls[0]!;
        expect(call.secretBytesCopy.equals(Buffer.alloc(20, 0x42))).toBe(true);
        // The failure path still runs the `finally`, so
        // the live reference is zeroed.
        expect(call.secretRef.equals(Buffer.alloc(call.secretRef.length, 0))).toBe(true);
    });
});
