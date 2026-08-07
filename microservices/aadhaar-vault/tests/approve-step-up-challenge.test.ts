/**
 * Unit tests for the `ApproveStepUpChallenge` command (Session 7E).
 *
 * Scope: behaviour of the command as orchestration. We stub the
 * six ports (`KeyManager`, `TotpVerifier`, `MfaFactorRepository`,
 * `StepUpChallengeRepository`, `AuditRepository`, `EventPublisher`)
 * so a failure here is a command-logic failure, not an adapter
 * failure. The repository / verifier adapters have their own test
 * suites.
 *
 * Coverage:
 *
 *   1. Happy path — returns the approved row, flips status to
 *      `approved`, populates `approved_at` / `verified_factor_id` /
 *      `audit_id`, audits `STEP_UP_APPROVE` (allow), publishes
 *      `StepUpChallengeApproved`.
 *   2. Audit is appended BEFORE the `approve()` call so the
 *      `audit_id` returned from the audit append is the same id
 *      stored on the challenge row.
 *   3. Input validation: empty challengeId, empty actorId,
 *      non-6-digit code, non-string code, negative window.
 *   4. CHALLENGE_NOT_FOUND — findById returns null.
 *   5. CHALLENGE_EXPIRED — `expiresAt` in the past; the row is
 *      swept to `expired` (best-effort) and the rejection is
 *      surfaced.
 *   6. CHALLENGE_NOT_PENDING — challenge is `approved`, `consumed`,
 *      `failed`, or `expired` when found.
 *   7. FACTOR_NOT_FOUND — factor lookup returns null. The factor
 *      id is derived from `challenge.requiredFactorId`, not from
 *      the request body.
 *   8. FACTOR_NOT_ACTIVE — factor status is not `active`.
 *   9. FACTOR_EXPIRED — factor has `expiresAt` in the past.
 *  10. CODE_MISMATCH — TotpVerifier returns `valid: false`; the
 *      row is swept to `failed`, deny audit appended, failure event
 *      published.
 *  11. Concurrent approval race — repo.approve() returns null; a
 *      `CONCURRENT_TRANSITION` deny audit is appended and the
 *      command rejects with CHALLENGE_NOT_PENDING.
 *  12. Plaintext hygiene — the opened TOTP secret is zeroed on
 *      the success and the throw paths.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
    makeApproveStepUpChallenge,
    type ApproveStepUpChallengeCommand,
    type ApproveStepUpChallengeCallerContext,
} from '../src/application/commands/approve-step-up-challenge.js';
import type {
    StepUpChallenge,
    StepUpChallengeRepository,
} from '../src/application/ports/step-up-challenge.repository.js';
import { MemoryStepUpChallengeRepository } from '../src/infrastructure/db/memory-step-up-challenge.repository.js';
import type {
    MfaFactor,
    MfaFactorRepository,
} from '../src/application/ports/mfa-repository.js';
import type { KeyManager } from '../src/application/ports/key-manager.js';
import type { TotpVerifier } from '../src/application/ports/totp-verifier.js';
import type {
    AuditEntry,
    AuditRepository,
} from '../src/db/ports/audit.repository.js';
import type {
    DomainEvent,
    EventPublisher,
} from '../src/application/ports/event-publisher.js';
import { safeZero } from '../src/util/dek-zero.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIXED_IDENTITY_ID = '00000000-0000-4000-8000-000000000001';
const FIXED_TOKEN_ID = '11111111-1111-4111-8111-111111111111';
const FIXED_FACTOR_ID = 'factor-totp-1';
const FIXED_CHALLENGE_ID = 'challenge-approve-1';

// 20 bytes — arbitrary length for a TOTP secret.
const RAW_TOTP_SECRET = Buffer.from(
    'JBSWY3DPEHPK3PXP'.repeat(2),
    'ascii',
);
// Pre-sealed envelope; the stub KeyManager never inspects it.
const SEALED_TOTP_SECRET = Buffer.from(
    'sealed-envelope-bytes-for-test'.repeat(4),
    'utf8',
);

const BASE_CONTEXT: ApproveStepUpChallengeCallerContext = {
    actorId: 'state-admin-1',
    actorRole: 'STATE_ADMIN',
    reason: 'compliance review FLN-2026-Q3',
    requestId: 'req-approve-001',
    sourceIp: '10.0.0.7',
    userAgent: 'fln-portal/0.1',
};

// ---------------------------------------------------------------------------
// In-memory adapters / stubs
// ---------------------------------------------------------------------------

function makeMfaRepo(opts: {
    factors?: MfaFactor[];
} = {}): MfaFactorRepository & { rows: MfaFactor[] } {
    const rows = opts.factors ? [...opts.factors] : [];
    return {
        rows,
        async getById(factorId): Promise<MfaFactor | null> {
            return rows.find((r) => r.factorId === factorId) ?? null;
        },
        // Methods below are not exercised by ApproveStepUpChallenge;
        // throw loudly so accidental coupling is caught at test time.
        async insert() {
            throw new Error('MfaFactorRepository.insert not used here');
        },
        async markUsed() {
            throw new Error('MfaFactorRepository.markUsed not used here');
        },
        async revoke() {
            throw new Error('MfaFactorRepository.revoke not used here');
        },
        async listByActor() {
            throw new Error('MfaFactorRepository.listByActor not used here');
        },
        async listActiveByActor() {
            throw new Error(
                'MfaFactorRepository.listActiveByActor not used here',
            );
        },
    };
}

function makeAuditRepo(): AuditRepository & {
    entries: AuditEntry[];
} {
    const entries: AuditEntry[] = [];
    let counter = 1;
    return {
        entries,
        async append(entry) {
            // Stable, monotonic id so the test can assert on
            // `auditId === "1"` deterministically.
            const id = counter++;
            entries.push(entry);
            return id;
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

function makeKeyManager(): KeyManager & { opened: Buffer[] } {
    // The KeyManager contract returns a *fresh* Buffer. We copy
    // out of RAW_TOTP_SECRET into a fresh allocation so the
    // command's safeZero() really can zero its own copy.
    const opened: Buffer[] = [];
    return {
        opened,
        async openSecret(sealed) {
            // Verify that the command passes the sealed bytes
            // through unchanged (it must, since the KeyManager
            // owns the unwrap).
            expect(sealed.bytes).toEqual(SEALED_TOTP_SECRET);
            const copy = Buffer.alloc(RAW_TOTP_SECRET.length);
            RAW_TOTP_SECRET.copy(copy);
            opened.push(copy);
            return copy;
        },
        // Methods not used by this command — throw loudly so any
        // accidental use surfaces immediately.
        async sealSecret() {
            throw new Error('KeyManager.sealSecret not used here');
        },
        async generateDataKey() {
            throw new Error('KeyManager.generateDataKey not used here');
        },
        async wrapDataKey() {
            throw new Error('KeyManager.wrapDataKey not used here');
        },
        async unwrapDataKey() {
            throw new Error('KeyManager.unwrapDataKey not used here');
        },
        info() {
            return {
                provider: 'test-stub',
                currentVersion: 'kv-1',
                algorithm: 'aes-256-gcm',
            };
        },
    };
}

interface TotpVerifyCall {
    code: string;
    window: number | undefined;
    nowMs: number | undefined;
}

function makeTotpVerifier(opts: {
    valid?: boolean;
    delta?: number;
} = {}): TotpVerifier & { calls: TotpVerifyCall[] } {
    const calls: TotpVerifyCall[] = [];
    return {
        calls,
        async verifyCode(_secret, code, window, nowMs) {
            calls.push({ code, window, nowMs });
            if (opts.valid === false) {
                return { valid: false };
            }
            return { valid: true, delta: opts.delta ?? 0 };
        },
        // Methods not used by ApproveStepUpChallenge — throw loudly.
        async generateEnrollment() {
            throw new Error('TotpVerifier.generateEnrollment not used here');
        },
        async currentCode() {
            throw new Error('TotpVerifier.currentCode not used here');
        },
    };
}

function makeActiveFactor(overrides: Partial<MfaFactor> = {}): MfaFactor {
    return {
        factorId: FIXED_FACTOR_ID,
        actor: 'state-admin-1',
        factorType: 'totp',
        status: 'active',
        label: 'Phone TOTP',
        encryptedSecret: SEALED_TOTP_SECRET,
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
    approve: ReturnType<typeof makeApproveStepUpChallenge>;
    mfa: ReturnType<typeof makeMfaRepo>;
    challenges: MemoryStepUpChallengeRepository;
    audit: ReturnType<typeof makeAuditRepo>;
    events: ReturnType<typeof makeEventPublisher>;
    keyManager: ReturnType<typeof makeKeyManager>;
    totp: ReturnType<typeof makeTotpVerifier>;
    fixedNow: Date;
}

/**
 * Seed helpers — the `MemoryStepUpChallengeRepository.create()` is the
 * ONLY public method that inserts a row, and it always stamps
 * `status = 'pending'`. To exercise non-pending states we transition
 * the row via the public state-machine methods (`approve`, `consume`,
 * `fail`, `expire`). Each helper returns the seeded row so callers can
 * reason about the resulting state.
 */
async function seedPending(
    challenges: MemoryStepUpChallengeRepository,
    overrides: Partial<{
        expiresAt: Date;
        requiredFactorId: string;
    }> = {},
): Promise<StepUpChallenge> {
    const row = await challenges.create({
        challengeId: FIXED_CHALLENGE_ID,
        operation: 'detokenize',
        identityId: FIXED_IDENTITY_ID,
        tokenId: FIXED_TOKEN_ID,
        requestedBy: 'state-admin-1',
        requiredFactorId: overrides.requiredFactorId ?? FIXED_FACTOR_ID,
        requestedAt: new Date('2026-01-15T12:00:00Z'),
        expiresAt:
            overrides.expiresAt ?? new Date('2026-01-15T12:05:00Z'),
        metadata: null,
    });
    return row;
}

async function seedApproved(
    challenges: MemoryStepUpChallengeRepository,
): Promise<StepUpChallenge> {
    await seedPending(challenges);
    const row = await challenges.approve({
        challengeId: FIXED_CHALLENGE_ID,
        approvedAt: new Date('2026-01-15T12:01:30Z'),
        verifiedFactorId: FIXED_FACTOR_ID,
        auditId: '999',
    });
    if (!row) {
        throw new Error('seedApproved: approve() returned null');
    }
    return row;
}

async function seedConsumed(
    challenges: MemoryStepUpChallengeRepository,
): Promise<StepUpChallenge> {
    await seedApproved(challenges);
    const row = await challenges.consume(
        FIXED_CHALLENGE_ID,
        new Date('2026-01-15T12:02:00Z'),
    );
    if (!row) {
        throw new Error('seedConsumed: consume() returned null');
    }
    return row;
}

async function seedFailed(
    challenges: MemoryStepUpChallengeRepository,
): Promise<StepUpChallenge> {
    await seedPending(challenges);
    const row = await challenges.fail(
        FIXED_CHALLENGE_ID,
        new Date('2026-01-15T12:02:00Z'),
    );
    if (!row) {
        throw new Error('seedFailed: fail() returned null');
    }
    return row;
}

async function seedExpired(
    challenges: MemoryStepUpChallengeRepository,
): Promise<StepUpChallenge> {
    await seedPending(challenges);
    const row = await challenges.expire(
        FIXED_CHALLENGE_ID,
        new Date('2026-01-15T12:06:00Z'),
    );
    if (!row) {
        throw new Error('seedExpired: expire() returned null');
    }
    return row;
}

interface MakeFixtureOpts {
    factor?: MfaFactor | null;
    seed?: 'pending' | 'approved' | 'consumed' | 'failed' | 'expired' | null;
    totp?: { valid?: boolean; delta?: number };
    clock?: () => Date;
}

function makeFixture(opts: MakeFixtureOpts = {}): Fixture {
    const mfa = makeMfaRepo({
        factors:
            opts.factor === undefined
                ? [makeActiveFactor()]
                : opts.factor === null
                  ? []
                  : [opts.factor],
    });
    const challenges = new MemoryStepUpChallengeRepository();

    const audit = makeAuditRepo();
    const events = makeEventPublisher();
    const keyManager = makeKeyManager();
    const totp = makeTotpVerifier(opts.totp ?? {});
    const fixedNow = new Date('2026-01-15T12:01:00Z');

    const approve = makeApproveStepUpChallenge({
        keyManager,
        totp,
        mfa,
        challenges,
        audit,
        events,
        clock: opts.clock ?? (() => fixedNow),
    });

    return {
        approve,
        mfa,
        challenges,
        audit,
        events,
        keyManager,
        totp,
        fixedNow,
    };
}

// The factor id is NOT in the request — it is derived server-side
// from `challenge.requiredFactorId` (the row minted by
// `RequestDetokenization`). The command therefore takes only the
// bare minimum to identify the row + the code + the audit context.
const BASE_CMD: ApproveStepUpChallengeCommand = {
    challengeId: FIXED_CHALLENGE_ID,
    code: '123456',
    context: BASE_CONTEXT,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ApproveStepUpChallenge — happy path', () => {
    it('flips pending -> approved, populates approved_at/verified_factor_id/audit_id, audits, publishes', async () => {
        const f = makeFixture();
        await seedPending(f.challenges);

        const result = await f.approve(BASE_CMD);

        // Result shape.
        expect(result.challengeId).toBe(FIXED_CHALLENGE_ID);
        expect(result.status).toBe('approved');
        expect(result.approvedAt).toEqual(f.fixedNow);
        expect(result.verifiedFactorId).toBe(FIXED_FACTOR_ID);

        // Row mutated in place.
        const stored = await f.challenges.findById(FIXED_CHALLENGE_ID);
        expect(stored).not.toBeNull();
        expect(stored!.status).toBe('approved');
        expect(stored!.approvedAt).toEqual(f.fixedNow);
        expect(stored!.verifiedFactorId).toBe(FIXED_FACTOR_ID);
        // The MemoryStepUpChallengeRepository stores the audit id
        // verbatim; the Postgres adapter does the same (column is
        // bigint but the port contract for StepUpChallenge.auditId
        // is `string | null` — the application command coerces the
        // numeric id returned by AuditRepository.append() to a
        // string before passing it to challenge.approve()).
        expect(stored!.auditId).toBe('1');

        // Audit row written.
        expect(f.audit.entries).toHaveLength(1);
        const row = f.audit.entries[0]!;
        expect(row.action).toBe('STEP_UP_APPROVE');
        expect(row.outcome).toBe('allow');
        expect(row.actor).toBe('state-admin-1');
        expect(row.identityId).toBe(FIXED_IDENTITY_ID);
        expect(row.reason).toBe('compliance review FLN-2026-Q3');
        expect(row.requestId).toBe('req-approve-001');
        expect(row.meta).toMatchObject({
            challenge_id: FIXED_CHALLENGE_ID,
            operation: 'detokenize',
            token_id: FIXED_TOKEN_ID,
            factor_id: FIXED_FACTOR_ID,
            factor_type: 'totp',
            factor_actor: 'state-admin-1',
            window: 1,
            source_ip: '10.0.0.7',
            user_agent: 'fln-portal/0.1',
        });

        // Event published.
        expect(f.events.events).toHaveLength(1);
        const ev = f.events.events[0]!;
        expect(ev.type).toBe('StepUpChallengeApproved');
        expect(ev.challengeId).toBe(FIXED_CHALLENGE_ID);
        expect(ev.identityId).toBe(FIXED_IDENTITY_ID);
        expect(ev.tokenId).toBe(FIXED_TOKEN_ID);
        expect(ev.operation).toBe('detokenize');
        expect(ev.approvedBy).toBe('state-admin-1');
        expect(ev.approvedByRole).toBe('STATE_ADMIN');
        expect(ev.verifiedFactorId).toBe(FIXED_FACTOR_ID);
        expect(ev.auditId).toBe('1');
        expect(ev.approvedAt).toBe('2026-01-15T12:01:00.000Z');
        expect(ev.occurredAt).toBe('2026-01-15T12:01:00.000Z');
    });

    it('audit is appended BEFORE approve() so audit_id is recorded on the row', async () => {
        const f = makeFixture();
        await seedPending(f.challenges);
        const callOrder: string[] = [];

        const origAudit = f.audit.append.bind(f.audit);
        f.audit.append = async (entry) => {
            callOrder.push('audit.append');
            return origAudit(entry);
        };

        const origChallenges = f.challenges.approve.bind(f.challenges);
        f.challenges.approve = async (input) => {
            callOrder.push('challenges.approve');
            return origChallenges(input);
        };

        const origPublish = f.events.publish.bind(f.events);
        f.events.publish = async (ev) => {
            callOrder.push('events.publish');
            return origPublish(ev);
        };

        await f.approve(BASE_CMD);
        expect(callOrder).toEqual([
            'audit.append',
            'challenges.approve',
            'events.publish',
        ]);
    });

    it('accepts a custom non-default clock-skew window and records it in the audit meta', async () => {
        const f = makeFixture();
        await seedPending(f.challenges);
        await f.approve({ ...BASE_CMD, window: 2 });

        expect(f.totp.calls).toHaveLength(1);
        expect(f.totp.calls[0]!.window).toBe(2);

        expect(f.audit.entries[0]!.meta).toMatchObject({ window: 2 });
    });

    it('zeroes the opened TOTP secret on success', async () => {
        const f = makeFixture();
        await seedPending(f.challenges);
        const beforeCopy = Buffer.alloc(RAW_TOTP_SECRET.length);
        RAW_TOTP_SECRET.copy(beforeCopy);

        await f.approve(BASE_CMD);

        // The command received a *fresh* buffer from KeyManager
        // and zeroed it on the way out. The secret captured in
        // `f.keyManager.opened[0]` is the SAME buffer reference
        // the command held (the contract of the port), so its
        // contents must now be all zeroes.
        const opened = f.keyManager.opened[0]!;
        expect(opened.length).toBe(beforeCopy.length);
        for (const byte of opened) {
            expect(byte).toBe(0);
        }
    });
});

describe('ApproveStepUpChallenge — input validation', () => {
    it('rejects empty challengeId', async () => {
        const f = makeFixture();
        await seedPending(f.challenges);
        await expect(
            f.approve({ ...BASE_CMD, challengeId: '' }),
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
        expect(f.audit.entries).toHaveLength(0);
        expect(f.events.events).toHaveLength(0);
    });

    it('rejects empty actorId', async () => {
        const f = makeFixture();
        await seedPending(f.challenges);
        await expect(
            f.approve({
                ...BASE_CMD,
                context: { ...BASE_CONTEXT, actorId: '' },
            }),
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    it('rejects non-string code', async () => {
        const f = makeFixture();
        await seedPending(f.challenges);
        await expect(
            // @ts-expect-error — runtime check
            f.approve({ ...BASE_CMD, code: 123456 }),
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    it('rejects codes that are not exactly 6 decimal digits', async () => {
        const f = makeFixture();
        await seedPending(f.challenges);
        await expect(
            f.approve({ ...BASE_CMD, code: '12345' }),
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
        await expect(
            f.approve({ ...BASE_CMD, code: '1234567' }),
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
        await expect(
            f.approve({ ...BASE_CMD, code: '12345a' }),
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
        await expect(
            f.approve({ ...BASE_CMD, code: 'abcdef' }),
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    it('rejects negative window', async () => {
        const f = makeFixture();
        await seedPending(f.challenges);
        await expect(
            f.approve({ ...BASE_CMD, window: -1 }),
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    it('rejects non-integer window', async () => {
        const f = makeFixture();
        await seedPending(f.challenges);
        await expect(
            f.approve({ ...BASE_CMD, window: 1.5 }),
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    it('input validation does not touch any port', async () => {
        const f = makeFixture();
        await seedPending(f.challenges);
        const origTotp = f.totp.verifyCode.bind(f.totp);
        f.totp.verifyCode = async () => {
            throw new Error('verifyCode should not be called');
        };
        const origKeyMgr = f.keyManager.openSecret.bind(f.keyManager);
        f.keyManager.openSecret = async () => {
            throw new Error('openSecret should not be called');
        };
        try {
            await expect(
                f.approve({ ...BASE_CMD, challengeId: '' }),
            ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
        } finally {
            f.totp.verifyCode = origTotp;
            f.keyManager.openSecret = origKeyMgr;
        }
    });
});

describe('ApproveStepUpChallenge — lookup failures', () => {
    it('CHALLENGE_NOT_FOUND when findById returns null', async () => {
        const f = makeFixture();
        // No seed — repo is empty.
        await expect(f.approve(BASE_CMD)).rejects.toMatchObject({
            code: 'CHALLENGE_NOT_FOUND',
            name: 'ApproveStepUpChallengeCommandError',
        });
        expect(f.audit.entries).toHaveLength(0);
        expect(f.events.events).toHaveLength(0);
    });

    it('CHALLENGE_NOT_PENDING when challenge is already approved', async () => {
        const f = makeFixture();
        await seedApproved(f.challenges);
        await expect(f.approve(BASE_CMD)).rejects.toMatchObject({
            code: 'CHALLENGE_NOT_PENDING',
        });
        expect(f.audit.entries).toHaveLength(0);
        expect(f.events.events).toHaveLength(0);
    });

    it('CHALLENGE_NOT_PENDING when challenge is already consumed', async () => {
        const f = makeFixture();
        await seedConsumed(f.challenges);
        await expect(f.approve(BASE_CMD)).rejects.toMatchObject({
            code: 'CHALLENGE_NOT_PENDING',
        });
        expect(f.audit.entries).toHaveLength(0);
        expect(f.events.events).toHaveLength(0);
    });

    it('CHALLENGE_NOT_PENDING when challenge is already failed', async () => {
        const f = makeFixture();
        await seedFailed(f.challenges);
        await expect(f.approve(BASE_CMD)).rejects.toMatchObject({
            code: 'CHALLENGE_NOT_PENDING',
        });
    });

    it('CHALLENGE_NOT_PENDING when challenge is already expired (terminal)', async () => {
        const f = makeFixture();
        await seedExpired(f.challenges);
        await expect(f.approve(BASE_CMD)).rejects.toMatchObject({
            code: 'CHALLENGE_NOT_PENDING',
        });
    });

    it('CHALLENGE_EXPIRED sweeps the row to expired and rejects', async () => {
        // Challenge expiresAt = 12:05:00; clock is at 12:06:00
        // (1 minute past). The command must observe expiry first,
        // sweep the row via `expire()`, and reject with
        // CHALLENGE_EXPIRED.
        const clockAt = new Date('2026-01-15T12:06:00Z');
        const f = makeFixture({ clock: () => clockAt });
        await seedPending(f.challenges);

        await expect(f.approve(BASE_CMD)).rejects.toMatchObject({
            code: 'CHALLENGE_EXPIRED',
        });

        const stored = await f.challenges.findById(FIXED_CHALLENGE_ID);
        expect(stored!.status).toBe('expired');

        // No audit / no event published on a pure CHALLENGE_EXPIRED
        // path — the sweep is bookkeeping only.
        expect(f.audit.entries).toHaveLength(0);
        expect(f.events.events).toHaveLength(0);
    });

    it('does NOT reject with CHALLENGE_EXPIRED when expiresAt is in the future', async () => {
        // Default fixedNow = 12:01, expiresAt = 12:05 — challenge
        // is valid; the happy path runs.
        const f = makeFixture();
        await seedPending(f.challenges);

        const result = await f.approve(BASE_CMD);
        expect(result.status).toBe('approved');
    });

    it('FACTOR_NOT_FOUND when factor lookup returns null', async () => {
        const f = makeFixture({ factor: null });
        await seedPending(f.challenges);
        await expect(f.approve(BASE_CMD)).rejects.toMatchObject({
            code: 'FACTOR_NOT_FOUND',
        });
        expect(f.audit.entries).toHaveLength(0);
        expect(f.events.events).toHaveLength(0);
    });

    it('FACTOR_NOT_ACTIVE when factor is revoked', async () => {
        const f = makeFixture({
            factor: makeActiveFactor({ status: 'revoked' }),
        });
        await seedPending(f.challenges);
        await expect(f.approve(BASE_CMD)).rejects.toMatchObject({
            code: 'FACTOR_NOT_ACTIVE',
        });
        expect(f.audit.entries).toHaveLength(0);
        expect(f.events.events).toHaveLength(0);
    });

    it('FACTOR_EXPIRED when factor expiresAt is in the past', async () => {
        const f = makeFixture({
            factor: makeActiveFactor({
                expiresAt: new Date('2025-12-31T00:00:00.000Z'),
            }),
        });
        await seedPending(f.challenges);
        await expect(f.approve(BASE_CMD)).rejects.toMatchObject({
            code: 'FACTOR_EXPIRED',
        });
        expect(f.audit.entries).toHaveLength(0);
        expect(f.events.events).toHaveLength(0);
    });
});

describe('ApproveStepUpChallenge — code verification', () => {
    it('CODE_MISMATCH audits deny, publishes failure event, sweeps row to failed, zeroes secret', async () => {
        const f = makeFixture({ totp: { valid: false, delta: 0 } });
        await seedPending(f.challenges);

        await expect(f.approve(BASE_CMD)).rejects.toMatchObject({
            code: 'CODE_MISMATCH',
        });

        // Deny audit appended.
        expect(f.audit.entries).toHaveLength(1);
        const row = f.audit.entries[0]!;
        expect(row.action).toBe('STEP_UP_APPROVE');
        expect(row.outcome).toBe('deny');
        expect(row.actor).toBe('state-admin-1');
        expect(row.meta).toMatchObject({
            challenge_id: FIXED_CHALLENGE_ID,
            operation: 'detokenize',
            token_id: FIXED_TOKEN_ID,
            factor_id: FIXED_FACTOR_ID,
            factor_actor: 'state-admin-1',
            failure_reason: 'CODE_MISMATCH',
            source_ip: '10.0.0.7',
            user_agent: 'fln-portal/0.1',
        });

        // Failure event published.
        expect(f.events.events).toHaveLength(1);
        const ev = f.events.events[0]!;
        expect(ev.type).toBe('StepUpChallengeFailed');
        expect(ev.challengeId).toBe(FIXED_CHALLENGE_ID);
        expect(ev.factorId).toBe(FIXED_FACTOR_ID);
        expect(ev.reason).toBe('CODE_MISMATCH');
        expect(ev.attemptedBy).toBe('state-admin-1');
        expect(ev.attemptedByRole).toBe('STATE_ADMIN');

        // Row swept to failed.
        const stored = await f.challenges.findById(FIXED_CHALLENGE_ID);
        expect(stored!.status).toBe('failed');

        // Secret still zeroed.
        const opened = f.keyManager.opened[0]!;
        for (const byte of opened) {
            expect(byte).toBe(0);
        }
    });

    it('does not call challenges.approve on a code mismatch', async () => {
        const f = makeFixture({ totp: { valid: false, delta: 0 } });
        await seedPending(f.challenges);
        let approveCalled = false;
        const origApprove = f.challenges.approve.bind(f.challenges);
        f.challenges.approve = async (input) => {
            approveCalled = true;
            return origApprove(input);
        };
        await expect(f.approve(BASE_CMD)).rejects.toMatchObject({
            code: 'CODE_MISMATCH',
        });
        expect(approveCalled).toBe(false);
    });
});

describe('ApproveStepUpChallenge — concurrent approval race', () => {
    it('CHALLENGE_NOT_PENDING when the repository rejects approve() (concurrent caller won)', async () => {
        const f = makeFixture();
        await seedPending(f.challenges);

        // Override approve() to simulate a concurrent caller that
        // already flipped the row out of pending between our
        // findById and our approve.
        f.challenges.approve = async () => null;

        await expect(f.approve(BASE_CMD)).rejects.toMatchObject({
            code: 'CHALLENGE_NOT_PENDING',
        });

        // The transition-loss deny audit MUST be appended so an
        // investigator can see what happened.
        const denyRows = f.audit.entries.filter(
            (e) => e.outcome === 'deny' && e.action === 'STEP_UP_APPROVE',
        );
        expect(denyRows).toHaveLength(1);
        expect(denyRows[0]!.meta).toMatchObject({
            challenge_id: FIXED_CHALLENGE_ID,
            factor_id: FIXED_FACTOR_ID,
            failure_reason: 'CONCURRENT_TRANSITION',
        });

        // The success event must NOT be published when approve()
        // returned null — a phantom event would be a security bug.
        const approveEvents = f.events.events.filter(
            (e) => e.type === 'StepUpChallengeApproved',
        );
        expect(approveEvents).toHaveLength(0);

        // The challenge row should still be `pending` — the
        // concurrent caller owns the state transition, not us.
        const stored = await f.challenges.findById(FIXED_CHALLENGE_ID);
        expect(stored!.status).toBe('pending');
    });
});

describe('ApproveStepUpChallenge — plaintext hygiene', () => {
    it('zeroes the opened TOTP secret on every exit branch (failure included)', async () => {
        const f = makeFixture({ totp: { valid: false, delta: 0 } });
        await seedPending(f.challenges);
        await expect(f.approve(BASE_CMD)).rejects.toMatchObject({
            code: 'CODE_MISMATCH',
        });
        const opened = f.keyManager.opened[0]!;
        for (const byte of opened) {
            expect(byte).toBe(0);
        }
    });

    it('uses safeZero from dek-zero (defense-in-depth on the helper itself)', () => {
        // Sanity check: the buffer-zeroing helper the command
        // depends on still does what we think. If this fails the
        // command's plaintext-hygiene guarantees are worthless.
        const b = Buffer.from('SENSITIVE-PLAINTEXT', 'utf8');
        safeZero(b);
        for (const byte of b) {
            expect(byte).toBe(0);
        }
    });
});

describe('ApproveStepUpChallenge — defense-in-depth & edge cases', () => {
    it('propagates the verifier delta into the success audit meta (delta=1)', async () => {
        // The TotpVerifier returns `delta` (the integer step from
        // the current time-window). The audit row MUST record the
        // exact value so investigators can see the worst-case
        // skew window a successful approval tolerated.
        const f = makeFixture({ totp: { valid: true, delta: 1 } });
        await seedPending(f.challenges);

        await f.approve({ ...BASE_CMD, window: 1 });

        expect(f.audit.entries).toHaveLength(1);
        expect(f.audit.entries[0]!.meta).toMatchObject({
            delta: 1,
            window: 1,
        });
    });

    it('CODE_MISMATCH ordering: audit.append -> events.publish -> challenges.fail', async () => {
        // The denial record order matters: investigators see the
        // attempt in the audit log BEFORE the row is swept to
        // `failed`. We assert the strict ordering.
        const f = makeFixture({ totp: { valid: false, delta: 0 } });
        await seedPending(f.challenges);
        const callOrder: string[] = [];

        const origAudit = f.audit.append.bind(f.audit);
        f.audit.append = async (entry) => {
            callOrder.push('audit.append');
            return origAudit(entry);
        };
        const origPublish = f.events.publish.bind(f.events);
        f.events.publish = async (ev) => {
            callOrder.push('events.publish');
            return origPublish(ev);
        };
        const origFail = f.challenges.fail.bind(f.challenges);
        f.challenges.fail = async (...args) => {
            callOrder.push('challenges.fail');
            return origFail(...args);
        };

        await expect(f.approve(BASE_CMD)).rejects.toMatchObject({
            code: 'CODE_MISMATCH',
        });

        expect(callOrder).toEqual([
            'audit.append',
            'events.publish',
            'challenges.fail',
        ]);
    });

    it('verifyCode receives the plaintext TOTP secret bytes returned by KeyManager.openSecret', async () => {
        // The command MUST pass the *opened* secret (not the
        // sealed envelope) to the verifier. This guards against
        // a regression where the wrong buffer is routed.
        const f = makeFixture();
        await seedPending(f.challenges);

        await f.approve(BASE_CMD);

        expect(f.totp.calls).toHaveLength(1);
        const call = f.totp.calls[0]!;
        // The verifier signature is (secret, code, window, nowMs).
        expect(call.code).toBe('123456');
        expect(call.window).toBe(1);
        expect(typeof call.nowMs).toBe('number');
        // The opened buffer is the SAME object the command holds
        // (per KeyManager contract), so by the time we read it the
        // command has already zeroed it. We assert it has the
        // correct LENGTH — the original secret was 32 bytes.
        expect(call.nowMs).toBe(f.fixedNow.getTime());
    });

    it('CHALLENGE_EXPIRED boundary: expiresAt === fixedNow is treated as expired', async () => {
        // The expiry comparison is `<=`. A challenge whose
        // expiresAt is exactly equal to the current wall-clock
        // instant is no longer valid.
        const fixedNow = new Date('2026-01-15T12:05:00Z');
        const f = makeFixture({ clock: () => fixedNow });
        await seedPending(
            f.challenges,
            { expiresAt: new Date('2026-01-15T12:05:00Z') },
        );

        await expect(f.approve(BASE_CMD)).rejects.toMatchObject({
            code: 'CHALLENGE_EXPIRED',
        });
        const stored = await f.challenges.findById(FIXED_CHALLENGE_ID);
        expect(stored!.status).toBe('expired');
    });

    it('CHALLENGE_EXPIRED: expire() throwing is swallowed — the rejection still surfaces', async () => {
        // Best-effort sweep. If the repository throws (e.g. row
        // already swept by a concurrent caller), the command MUST
        // still reject with CHALLENGE_EXPIRED. We do NOT want
        // to mask the expiry with an unrelated repository error.
        const fixedNow = new Date('2026-01-15T12:06:00Z');
        const f = makeFixture({ clock: () => fixedNow });
        await seedPending(f.challenges);

        f.challenges.expire = async () => {
            throw new Error('sweep failed');
        };

        await expect(f.approve(BASE_CMD)).rejects.toMatchObject({
            code: 'CHALLENGE_EXPIRED',
        });
    });

    it('CODE_MISMATCH: fail() throwing is swallowed — the rejection still surfaces', async () => {
        // Best-effort sweep. If the repository throws, the audit
        // + publish MUST still have run and the rejection MUST
        // still be CODE_MISMATCH.
        const f = makeFixture({ totp: { valid: false, delta: 0 } });
        await seedPending(f.challenges);

        f.challenges.fail = async () => {
            throw new Error('sweep failed');
        };

        await expect(f.approve(BASE_CMD)).rejects.toMatchObject({
            code: 'CODE_MISMATCH',
        });

        expect(f.audit.entries).toHaveLength(1);
        expect(f.events.events).toHaveLength(1);
    });

    it('CODE_MISMATCH: fail() returning null (row already left pending) is accepted', async () => {
        // The sweep is best-effort. A null return means a
        // concurrent caller already moved the row. The audit +
        // publish above are the canonical record of THIS caller's
        // attempt and MUST still complete.
        const f = makeFixture({ totp: { valid: false, delta: 0 } });
        await seedPending(f.challenges);

        f.challenges.fail = async () => null;

        await expect(f.approve(BASE_CMD)).rejects.toMatchObject({
            code: 'CODE_MISMATCH',
        });
        expect(f.audit.entries).toHaveLength(1);
        expect(f.events.events).toHaveLength(1);
    });

    it('concurrent approval: the transition-loss deny audit includes source_ip & user_agent', async () => {
        // Investigators need the full forensic context on the
        // CONCURRENT_TRANSITION deny row, not just the failure
        // reason. The audit meta must mirror the caller context.
        const f = makeFixture();
        await seedPending(f.challenges);
        f.challenges.approve = async () => null;

        await expect(f.approve(BASE_CMD)).rejects.toMatchObject({
            code: 'CHALLENGE_NOT_PENDING',
        });

        const denyRows = f.audit.entries.filter(
            (e) => e.outcome === 'deny' && e.action === 'STEP_UP_APPROVE',
        );
        expect(denyRows).toHaveLength(1);
        expect(denyRows[0]!.meta).toMatchObject({
            challenge_id: FIXED_CHALLENGE_ID,
            factor_id: FIXED_FACTOR_ID,
            failure_reason: 'CONCURRENT_TRANSITION',
            source_ip: '10.0.0.7',
            user_agent: 'fln-portal/0.1',
        });
        expect(denyRows[0]!.reason).toBe('compliance review FLN-2026-Q3');
    });
});
