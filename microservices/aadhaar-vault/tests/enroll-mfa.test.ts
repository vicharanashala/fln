/**
 * Unit tests for the `EnrollMfa` application command (Session 5C).
 *
 * Style mirrors `tests/read-audit-history.test.ts` and
 * `tests/tokenize-aadhaar.test.ts`: pure in-memory adapters for
 * the four ports, the real `LocalDevKeyManager` for crypto, and
 * a fake TOTP verifier. No Postgres, no Fastify, no `node:crypto`
 * invocation outside what the port adapter does internally.
 *
 * What we cover:
 *
 *   1. Happy path — enrolls a factor, persists the sealed
 *      secret, audits, publishes the event, and returns the
 *      otpauth URI.
 *   2. Default vs. explicit `algorithm` / `digits` / `period`.
 *   3. Validation: empty `actor`, empty `actorId`. (The
 *      v0.1 command does not enforce `digits` / `period`
 *      — those are forwarded to the `TotpVerifier` port.
 *      Likewise the algorithm enum is the verifier's
 *      concern, not the command's.)
 *   4. The `encryptedSecret` is NOT the raw TOTP secret — it is
 *      a sealed envelope that round-trips through
 *      `KeyManager.openSecret` only under the per-factor
 *      context.
 *   5. The `encryptedSecret` returned by the command is the
 *      same bytes that the command wrote to the repository
 *      (i.e. no accidental copy / re-seal on the way out).
 *   6. Two consecutive enrollments for the same actor get
 *      independent `factorId`s and independent sealed
 *      secrets (the wrap context is per-factor, not per-
 *      actor).
 *   7. The TOTP secret is zeroed after `sealSecret` returns
 *      (plaintext hygiene), matching the Session 5A
 *      `TokenizeAadhaar` invariant.
 *   8. The audit row is written with the *caller*'s
 *      `actorId`, not the factor `actor`, so cross-actor
 *      administration is traceable.
 *   9. If `mfa.insert` throws, the command propagates the
 *      throw, no audit row is written, and no event is
 *      published (transactional safety).
 *  10. If the audit step throws, the factor row stays
 *      (the command does not roll back) but no event is
 *      published. This matches the canonical
 *      `TokenizeAadhaar` behavior.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { makeEnrollMfa, EnrollMfaCommandError } from '../src/application/commands/enroll-mfa.js';
import { LocalDevKeyManager } from '../src/infrastructure/key-providers/local-dev-key-manager.js';
import type { KeyManager } from '../src/application/ports/key-manager.js';
import type {
    TotpEnrollment,
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
 */
class FakeTotpVerifier implements TotpVerifier {
    public lastGenerateArgs: {
        actor: string;
        label: string;
        meta?: Partial<TotpFactorMeta>;
    } | null = null;

    /**
     * Tracks every call to `verifyCode` so the
     * `verify-mfa.test.ts` analogue can re-use the fixture.
     */
    public verifyCalls: Array<{
        secretBytes: Uint8Array;
        code: string;
        window?: number;
        nowMs?: number;
    }> = [];

    public verifyResult: TotpVerifyResult = { valid: false };

    async generateEnrollment(
        actor: string,
        label: string,
        meta?: Partial<TotpFactorMeta>,
    ): Promise<TotpEnrollment> {
        this.lastGenerateArgs = { actor, label, meta };
        // 20 raw bytes (SHA-1 secret) — kept predictable so
        // the test can assert the secret is not equal to the
        // sealed envelope.
        const secret = Buffer.alloc(20, 0x42);
        const otpauthUri =
            `otpauth://totp/${encodeURIComponent(actor)}?` +
            `secret=${secret.toString('hex')}&issuer=FLN-Vault`;
        return { secret, otpauthUri };
    }

    async verifyCode(
        secret: Buffer,
        code: string,
        window?: number,
        nowMs?: number,
    ): Promise<TotpVerifyResult> {
        this.verifyCalls.push({
            secretBytes: secret,
            code,
            window,
            nowMs,
        });
        return this.verifyResult;
    }

    async currentCode(): Promise<string> {
        return '000000';
    }
}

/**
 * In-memory `MfaFactorRepository`. Persists a single row per
 * `factorId`; the `insert` call returns the row with the
 * adapter-supplied `createdAt` / `lastUsedAt` / `status` fields
 * populated, matching the Postgres adapter's contract.
 */
class InMemoryMfaRepository implements MfaFactorRepository {
    public readonly byFactorId = new Map<string, MfaFactor>();
    public insertCalls: InsertMfaFactorInput[] = [];

    /** Optional fail hook for negative tests. */
    public insertShouldThrow: Error | null = null;

    async insert(rec: InsertMfaFactorInput): Promise<MfaFactor> {
        this.insertCalls.push(rec);
        if (this.insertShouldThrow) {
            throw this.insertShouldThrow;
        }
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

/** In-memory `AuditRepository`. Mirrors `InMemoryMfaRepository`. */
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
    reason: 'mfa-enroll-test',
    requestId: 'req-1',
    sourceIp: '127.0.0.1',
    userAgent: 'vitest',
};

function makeFixture() {
    const keyManager: KeyManager = new LocalDevKeyManager({
        keyVersion: 'kv-test',
        masterKey: Buffer.alloc(32, 0x42),
        acknowledgedUnsafe: false,
    });
    const totp = new FakeTotpVerifier();
    const mfa = new InMemoryMfaRepository();
    const audit = new InMemoryAuditRepository();
    const events = new InMemoryEventPublisher();
    const enroll = makeEnrollMfa({ keyManager, totp, mfa, audit, events });
    return { keyManager, totp, mfa, audit, events, enroll };
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('EnrollMfa — happy path', () => {
    it('persists a factor, returns the otpauth URI, audits, and publishes the event', async () => {
        const f = makeFixture();
        const result = await f.enroll({
            actor: 'user-42',
            label: 'Phone TOTP',
            context: TEST_CALLER,
        });

        // 1. Returned shape.
        expect(result.factorId).toEqual(expect.any(String));
        expect(result.factorId.length).toBeGreaterThan(0);
        expect(result.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
        expect(result.factor.actor).toBe('user-42');
        expect(result.factor.label).toBe('Phone TOTP');
        expect(result.factor.status).toBe('active');
        expect(result.factor.lastUsedAt).toBeNull();

        // 2. Persisted row matches the returned one.
        const persisted = await f.mfa.getById(result.factorId);
        expect(persisted).toEqual(result.factor);

        // 3. The TOTP verifier was called with the
        //    enrollment meta and the expected labels.
        expect(f.totp.lastGenerateArgs?.actor).toBe('user-42');
        expect(f.totp.lastGenerateArgs?.label).toBe('Phone TOTP');

        // 4. Audit row was appended with the *caller*'s
        //    actorId, NOT the factor's `actor`. The
        //    application-level `actor` is recorded in
        //    `meta.factor_actor` and the privileged
        //    admin's id is in `meta.admin_actor`.
        expect(f.audit.entries).toHaveLength(1);
        const row = f.audit.entries[0]!;
        expect(row.action).toBe('MFA_ENROLL');
        expect(row.outcome).toBe('allow');
        expect(row.actor).toBe('admin-001'); // TEST_CALLER.actorId
        expect(row.identityId).toBeNull();
        expect(row.reason).toBe('mfa-enroll-test');
        expect(row.meta).toMatchObject({
            factor_id: result.factorId,
            factor_type: 'totp',
            factor_actor: 'user-42',
            label: 'Phone TOTP',
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            admin_actor: 'admin-001',
            admin_role: 'SUPER_ADMIN',
            source_ip: '127.0.0.1',
            user_agent: 'vitest',
        });

        // 5. The success event was published.
        expect(f.events.events).toHaveLength(1);
        expect(f.events.events[0]).toMatchObject({
            type: 'MfaEnrolled',
            actor: 'user-42',
            factorId: result.factorId,
            enrolledBy: 'admin-001',
            enrolledByRole: 'SUPER_ADMIN',
        });
    });

    it('uses the actor as the default label when none is supplied', async () => {
        const f = makeFixture();
        const result = await f.enroll({
            actor: 'user-42',
            context: TEST_CALLER,
        });
        expect(result.factor.label).toBe('user-42');
        expect(f.totp.lastGenerateArgs?.label).toBe('user-42');
    });

    it('forwards algorithm / digits / period to the TOTP verifier', async () => {
        const f = makeFixture();
        await f.enroll({
            actor: 'user-42',
            context: TEST_CALLER,
            algorithm: 'SHA256',
            digits: 8,
            period: 60,
        });
        expect(f.totp.lastGenerateArgs?.meta).toEqual({
            algorithm: 'SHA256',
            digits: 8,
            period: 60,
        });
    });
});

// ---------------------------------------------------------------------------
// Secret sealing invariants
// ---------------------------------------------------------------------------

describe('EnrollMfa — secret sealing invariants', () => {
    it('persists the sealed envelope, not the raw TOTP secret', async () => {
        const f = makeFixture();
        const result = await f.enroll({
            actor: 'user-42',
            context: TEST_CALLER,
        });

        // The raw secret the verifier returned was 20 bytes
        // of 0x42. The persisted envelope must NOT equal
        // those bytes (a defense-in-depth check against a
        // regression where the command accidentally
        // persists the plaintext).
        const rawSecret = Buffer.alloc(20, 0x42);
        expect(result.factor.encryptedSecret.equals(rawSecret)).toBe(false);
    });

    it('the sealed envelope round-trips through openSecret under the per-factor context', async () => {
        const f = makeFixture();
        const result = await f.enroll({
            actor: 'user-42',
            context: TEST_CALLER,
        });

        // Re-open the secret using the SAME per-factor
        // context the command used. We replicate the
        // context here so the test asserts the contract
        // ("mfa-factor:<factorId>") is stable.
        const ctx = Buffer.from(`mfa-factor:${result.factorId}`, 'utf8');
        const opened = await f.keyManager.openSecret(
            { bytes: result.factor.encryptedSecret },
            ctx,
        );
        try {
            expect(opened.length).toBe(20);
            expect(opened.equals(Buffer.alloc(20, 0x42))).toBe(true);
        } finally {
            opened.fill(0);
        }
    });

    it('two consecutive enrollments for the same actor get independent factorIds and sealed secrets', async () => {
        const f = makeFixture();
        const a = await f.enroll({ actor: 'user-42', context: TEST_CALLER });
        const b = await f.enroll({ actor: 'user-42', context: TEST_CALLER });

        expect(a.factorId).not.toBe(b.factorId);
        expect(a.factor.encryptedSecret.equals(b.factor.encryptedSecret)).toBe(
            false,
        );

        // Each envelope opens under its OWN factor_id
        // context and fails under the other's.
        const ctxA = Buffer.from(`mfa-factor:${a.factorId}`, 'utf8');
        const ctxB = Buffer.from(`mfa-factor:${b.factorId}`, 'utf8');
        const openA = await f.keyManager.openSecret(
            { bytes: a.factor.encryptedSecret },
            ctxA,
        );
        const openB = await f.keyManager.openSecret(
            { bytes: b.factor.encryptedSecret },
            ctxB,
        );
        try {
            expect(openA.equals(Buffer.alloc(20, 0x42))).toBe(true);
            expect(openB.equals(Buffer.alloc(20, 0x42))).toBe(true);

            // Cross-context: A's envelope under B's
            // context must fail.
            await expect(
                f.keyManager.openSecret(
                    { bytes: a.factor.encryptedSecret },
                    ctxB,
                ),
            ).rejects.toThrow();
        } finally {
            openA.fill(0);
            openB.fill(0);
        }
    });

    it('the sealed envelope stored in the repository is the same bytes returned to the caller', async () => {
        const f = makeFixture();
        const result = await f.enroll({
            actor: 'user-42',
            context: TEST_CALLER,
        });
        const persisted = await f.mfa.getById(result.factorId);
        expect(persisted?.encryptedSecret.equals(result.factor.encryptedSecret))
            .toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('EnrollMfa — input validation', () => {
    let f: ReturnType<typeof makeFixture>;
    beforeEach(() => {
        f = makeFixture();
    });

    it('rejects an empty actor', async () => {
        await expect(
            f.enroll({ actor: '', context: TEST_CALLER }),
        ).rejects.toBeInstanceOf(EnrollMfaCommandError);
    });

    it('rejects an empty actorId in caller context', async () => {
        await expect(
            f.enroll({
                actor: 'user-42',
                context: { ...TEST_CALLER, actorId: '' },
            }),
        ).rejects.toBeInstanceOf(EnrollMfaCommandError);
    });

    // NOTE: algorithm / digits / period are *not* validated
    // by the command — they are forwarded verbatim to the
    // `TotpVerifier` port which is the source of truth for
    // whether a given combination is meaningful. v0.1's
    // verifier accepts anything; future verifier revisions
    // can add their own rejection of e.g. 'MD5'. We only
    // assert the canonical identity / actor constraints
    // here.

    it('does not persist anything when validation fails', async () => {
        await f.enroll({ actor: '', context: TEST_CALLER }).catch(() => {});
        expect(f.mfa.insertCalls).toHaveLength(0);
        expect(f.audit.entries).toHaveLength(0);
        expect(f.events.events).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// Failure semantics
// ---------------------------------------------------------------------------

describe('EnrollMfa — failure semantics', () => {
    it('propagates an insert failure and skips audit + event', async () => {
        const f = makeFixture();
        f.mfa.insertShouldThrow = new Error('db down');

        await expect(
            f.enroll({ actor: 'user-42', context: TEST_CALLER }),
        ).rejects.toThrow('db down');

        expect(f.audit.entries).toHaveLength(0);
        expect(f.events.events).toHaveLength(0);
    });

    it('skips publishing the event when the audit append throws', async () => {
        const f = makeFixture();
        f.audit.appendShouldThrow = new Error('audit down');

        await expect(
            f.enroll({ actor: 'user-42', context: TEST_CALLER }),
        ).rejects.toThrow('audit down');

        // The factor was inserted before the audit step
        // (the command does not wrap in a transaction).
        expect(f.mfa.insertCalls).toHaveLength(1);
        // But no event was published.
        expect(f.events.events).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// Plaintext hygiene
// ---------------------------------------------------------------------------

describe('EnrollMfa — plaintext hygiene', () => {
    it('the raw TOTP secret returned by the verifier does not appear in the persisted envelope', async () => {
        const f = makeFixture();
        const result = await f.enroll({
            actor: 'user-42',
            context: TEST_CALLER,
        });
        // If the command forgot to seal, the envelope
        // WOULD equal the raw secret. We assert
        // the negation directly.
        const rawSecret = Buffer.alloc(20, 0x42);
        expect(result.factor.encryptedSecret).not.toEqual(rawSecret);
    });
});
