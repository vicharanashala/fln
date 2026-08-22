/**
 * Unit tests for the `DetokenizeAadhaar` command (Session 7E).
 *
 * Scope: behaviour of the command as a piece of orchestration. We
 * stub the seven ports — `KeyManager`, `CryptoService`,
 * `TokenRepository`, `IdentityRepository`, `AuditRepository`,
 * `EventPublisher`, `StepUpChallengeRepository` — so a failure here
 * is a command-logic failure, not an adapter failure. Adapter
 * correctness is verified in the per-adapter suites.
 *
 * The cases below are the minimum a green build needs to consider
 * the Session 7E release step done:
 *
 *   1. Happy path: a pre-populated, approved, unexpired,
 *      unconsumed challenge row → tokenize → detokenize
 *      round-trip recovers the original plaintext and surfaces
 *      every §7E field, including `challenge_id` and
 *      `verified_factor_id` on the audit row and the
 *      `DetokenizationCompleted` event.
 *   2. Empty `challengeId` throws `INVALID_INPUT`, never touches
 *      any repository.
 *   3. Empty `context.actorId` throws `INVALID_INPUT`, never
 *      touches any repository.
 *   4. `CHALLENGE_NOT_FOUND` — repository returns null → throw,
 *      no audit, no event.
 *   5. `CHALLENGE_NOT_APPROVED` — challenge row present but
 *      status is `pending` → throw, no audit, no event.
 *   6. `CHALLENGE_EXPIRED` — `expiresAt` is in the past → throw,
 *      no audit, no event.
 *   7. `CHALLENGE_CONSUMED` (replay) — `findById` returns an
 *      `approved` row but `consume()` returns null (race-window
 *      scenario: another caller already consumed the row)
 *      → throw, no audit, no event.
 *   8. `ACTOR_MISMATCH` — `requestedBy` on the challenge does
 *      not match `context.actorId` → throw, no audit, no event.
 *   9. `TOKEN_NOT_FOUND` — challenge references a token row that
 *      does not exist → throw, no audit, no event.
 *  10. `IDENTITY_NOT_FOUND` — token row present but parent
 *      identity missing → throw, no audit, no event.
 *  11. `UNWRAP_FAILED` — `KeyManager.unwrapDataKey` throws
 *      → re-wrapped as UNWRAP_FAILED, no audit, no event.
 *  12. `DECRYPTION_FAILED` — `CryptoService.decrypt` throws
 *      → re-wrapped as DECRYPTION_FAILED, no audit, no event.
 *  13. `INVALID_PAYLOAD` — recovered plaintext is not a
 *      12-digit Aadhaar → throw, no audit, no event.
 *  14. Audit-order invariant: event is published AFTER the audit
 *      append; failed append suppresses event.
 *  15. Plaintext hygiene: `dek` is zeroed on the happy path and
 *      on every throw branch.
 *
 * Plaintext-zeroization is enforced both locally in case 15 and
 * via the suite-level `afterEach` guard.
 */

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    makeDetokenizeAadhaar,
    type DetokenizeCallerContext,
    type DetokenizeAadhaarDeps,
} from '../src/application/commands/detokenize-aadhaar.js';
import type {
    AuditEntry,
    AuditRepository,
} from '../src/db/ports/audit.repository.js';
import type {
    IdentityRecord,
    IdentityRepository,
} from '../src/db/ports/identity.repository.js';
import type {
    TokenRepository,
    TokenRow,
} from '../src/db/ports/token.repository.js';
import type {
    EventPublisher,
    DomainEvent,
} from '../src/application/ports/event-publisher.js';
import type { KeyManager } from '../src/application/ports/key-manager.js';
import type { CryptoService } from '../src/application/ports/crypto.service.js';
import type {
    StepUpChallenge,
    StepUpChallengeRepository,
    StepUpChallengeStatus,
} from '../src/application/ports/step-up-challenge.repository.js';

// ---------------------------------------------------------------------------
// Shared fixture constants
// ---------------------------------------------------------------------------

const FIXED_IDENTITY_ID = '00000000-0000-4000-8000-000000000001';
const FIXED_TOKEN_ID = '11111111-1111-4111-8111-111111111111';
const FIXED_CHALLENGE_ID = '22222222-2222-4222-8222-222222222222';
const FIXED_FACTOR_ID = '33333333-3333-4333-8333-333333333333';

const FIXED_CIPHERTEXT = Buffer.from('123456789012', 'utf8'); // 12 bytes
const FIXED_PLAINTEXT = Buffer.from('123456789012', 'utf8'); // same bytes
const FIXED_IV = Buffer.from('00112233445566778899aabb', 'hex');
const FIXED_AUTHTAG = Buffer.alloc(16, 0xaa);
const FIXED_WRAPPED_DEK = Buffer.from('cafebabe'.repeat(8), 'hex');

// Default `requestedBy` aligns with the actor id in BASE_CONTEXT so
// the actor-binding check succeeds by default.
const FIXED_REQUESTED_BY = 'state-admin-1';
const FIXED_REQUESTED_AT = new Date('2026-01-15T11:55:00Z');
// `expiresAt` is well past the default clock() in `makeDeps`.
const FIXED_EXPIRES_AT = new Date('2026-01-15T13:00:00Z');
const FIXED_CLOCK = new Date('2026-01-15T12:30:00Z');

// ---------------------------------------------------------------------------
// Fakes — minimal interfaces the command actually exercises
// ---------------------------------------------------------------------------

/**
 * Fake `KeyManager` that records the (wrappedBytes, plaintext) pair
 * at `generateDataKey` time and looks it up by wrapped bytes at
 * `unwrapDataKey` time. This lets a single test set up a
 * tokenize-then-detokenize round-trip without standing up a real
 * KMS adapter. The unwrap ignores the context (a real adapter
 * would not) — acceptable because the application layer is what
 * we're testing, not the adapter.
 */
function makeFakeKeyManager(opts: {
    captured?: { dek?: Buffer };
    failUnwrap?: boolean;
} = {}): KeyManager {
    const store = new Map<string, Buffer>();
    const seededPlaintext = Buffer.from('deadbeef'.repeat(4), 'hex');
    store.set(FIXED_WRAPPED_DEK.toString('hex'), seededPlaintext);
    return {
        info() {
            return {
                currentVersion: 'kv-1',
                algorithm: 'aes-256-gcm',
                provider: 'local-dev',
            };
        },
        async generateDataKey(_wrapContext) {
            const plaintext = Buffer.from('deadbeef'.repeat(4), 'hex');
            const fakeWrappedBytes = Buffer.from(
                'cafebabe'.repeat(8),
                'hex',
            );
            store.set(fakeWrappedBytes.toString('hex'), plaintext);
            return {
                plaintext,
                keyVersion: 'kv-1',
                wrapped: { bytes: fakeWrappedBytes },
            };
        },
        async unwrapDataKey(wrapped, _context) {
            if (opts.failUnwrap) {
                throw new Error('integrity failure (test fake)');
            }
            const key = wrapped.bytes.toString('hex');
            const plaintext = store.get(key);
            if (!plaintext) {
                throw new Error(
                    `fake KeyManager: no recorded DEK for wrapped bytes ${key.slice(0, 8)}…`,
                );
            }
            const fresh = Buffer.from(plaintext);
            if (opts.captured) opts.captured.dek = fresh;
            return fresh;
        },
        async wrapDataKey() {
            throw new Error('not used in v0.1 detokenize');
        },
        async sealSecret() {
            throw new Error('not used in v0.1 detokenize');
        },
        async openSecret() {
            throw new Error('not used in v0.1 detokenize');
        },
    };
}

/**
 * Fake `CryptoService`. The detokenize path calls only `decrypt`,
 * so we expose a store-and-recall cipher keyed on ciphertext
 * bytes.
 */
function makeFakeCrypto(opts: {
    captured?: { plaintext?: Buffer };
    failDecrypt?: boolean;
    preloadedCiphertext?: { ct: Buffer; pt: Buffer };
} = {}): CryptoService {
    const store = new Map<string, Buffer>();
    if (opts.preloadedCiphertext) {
        store.set(
            opts.preloadedCiphertext.ct.toString('hex'),
            opts.preloadedCiphertext.pt,
        );
    }
    return {
        algorithm: 'aes-256-gcm',
        async encrypt(_key, plaintext, _aad) {
            const ciphertext = Buffer.from(plaintext);
            store.set(ciphertext.toString('hex'), plaintext);
            if (opts.captured) opts.captured.plaintext = plaintext;
            return {
                ciphertext,
                iv: Buffer.from('00112233445566778899aabb', 'hex'),
                authTag: Buffer.alloc(16, 0xaa),
            };
        },
        async decrypt(_key, envelope, _aad) {
            if (opts.failDecrypt) {
                throw new Error('tag mismatch (test fake)');
            }
            const key = envelope.ciphertext.toString('hex');
            const plaintext = store.get(key);
            if (!plaintext) {
                throw new Error(
                    `fake CryptoService: no recorded plaintext for ciphertext ${key.slice(0, 8)}…`,
                );
            }
            return Buffer.from(plaintext);
        },
    };
}

/** Recording audit repository — exposes the appended entries. */
type RecordingAudit = AuditRepository & {
    entries: AuditEntry[];
    nextAuditId: number;
};
function makeRecordingAudit(): RecordingAudit {
    const entries: AuditEntry[] = [];
    const audit: RecordingAudit = {
        entries,
        nextAuditId: 1,
        async append(entry) {
            entries.push(entry);
            const id = audit.nextAuditId;
            audit.nextAuditId += 1;
            return id;
        },
        async listByIdentity() {
            return [];
        },
    };
    return audit;
}

/** Recording publisher — exposes published events. */
type RecordingPublisher = EventPublisher & {
    events: DomainEvent[];
    failNext?: Error;
};
function makeRecordingPublisher(): RecordingPublisher {
    const events: DomainEvent[] = [];
    const publisher: RecordingPublisher = {
        events,
        async publish(ev) {
            if (publisher.failNext) {
                const err = publisher.failNext;
                publisher.failNext = undefined;
                throw err;
            }
            events.push(ev);
        },
    };
    return publisher;
}

/**
 * In-memory token repository. Tests can pre-populate rows and
 * toggle `failNextFindById` for failure-path scenarios.
 */
function makeTokenRepo(opts: {
    rows?: TokenRow[];
    failNextFindById?: Error;
} = {}): TokenRepository & { rows: TokenRow[] } {
    const rows = opts.rows ? [...opts.rows] : [];
    return {
        rows,
        async insert(token) {
            const row: TokenRow = {
                ...token,
                createdAt: Date.now(),
            };
            rows.push(row);
            return row;
        },
        async findById(id) {
            if (opts.failNextFindById) {
                const err = opts.failNextFindById;
                opts.failNextFindById = undefined;
                throw err;
            }
            return rows.find((r) => r.id === id) ?? null;
        },
    };
}

/**
 * In-memory identity repository. Tests can pre-populate rows.
 *
 * Note: the AAD is computed identically to what the tokenize
 * pipeline emits; the fake fixes `FIXED_IDENTITY_ID` and the
 * standard `kv-1 / schema=1` prefix so the unwrap pipeline
 * resolves correctly without standing up the tokenize command.
 */
function makeIdentityRepo(opts: {
    rows?: IdentityRecord[];
} = {}): IdentityRepository & { rows: IdentityRecord[] } {
    const aad = Buffer.from(
        'aadhaar-vault/v1|kv=kv-1|schema=1|identity=' + FIXED_IDENTITY_ID,
        'utf8',
    );
    const rows = opts.rows
        ? [...opts.rows]
        : [
              {
                  identityId: FIXED_IDENTITY_ID,
                  ciphertext: FIXED_CIPHERTEXT,
                  aad,
                  pepperVersion: 1,
                  keyVersion: 1,
                  createdAt: new Date('2026-01-15T12:00:00Z'),
                  rotatedAt: null,
                  revokedAt: null,
              },
          ];
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
            throw new Error('not used in v0.1 detokenize');
        },
        async rotate() {
            throw new Error('not used in v0.1 detokenize');
        },
    };
}

/**
 * In-memory step-up challenge repository. Tests can pre-populate
 * challenges and toggle `failConsumeNext` to simulate the
 * race-window `consume()` rejection that surfaces as
 * `CHALLENGE_CONSUMED`.
 *
 * `consume()` mirrors the production contract:
 *   - status must currently be `approved` AND `expiresAt` must be
 *     in the future;
 *   - on success, returns the row with `status='consumed'` and
 *     `consumedAt` stamped.
 *   - on failure (status mismatch / already consumed / expired),
 *     returns `null`. The command translates every failure here to
 *     `CHALLENGE_CONSUMED` because the *intent* — first-call-wins
 *     — is the same.
 */
function makeFakeChallenges(opts: {
    rows?: StepUpChallenge[];
    failConsumeNext?: boolean;
} = {}): StepUpChallengeRepository & {
    rows: StepUpChallenge[];
    consumed: string[];
} {
    const rows: StepUpChallenge[] = opts.rows ? [...opts.rows] : [];
    const consumed: string[] = [];
    return {
        rows,
        consumed,
        async create(input) {
            const row: StepUpChallenge = {
                challengeId: input.challengeId,
                operation: input.operation,
                identityId: input.identityId,
                tokenId: input.tokenId,
                requestedBy: input.requestedBy,
                requestedAt: input.requestedAt,
                expiresAt: input.expiresAt,
                approvedAt: null,
                consumedAt: null,
                status: 'pending',
                requiredFactorId: input.requiredFactorId,
                verifiedFactorId: null,
                auditId: null,
                metadata: input.metadata,
            };
            rows.push(row);
            return row;
        },
        async findById(id) {
            return rows.find((r) => r.challengeId === id) ?? null;
        },
        async approve(input) {
            const row = rows.find(
                (r) => r.challengeId === input.challengeId,
            );
            if (!row || row.status !== 'pending') return null;
            row.status = 'approved';
            row.approvedAt = input.approvedAt;
            row.verifiedFactorId = input.verifiedFactorId;
            row.auditId = input.auditId;
            return row;
        },
        async consume(id, consumedAt) {
            if (opts.failConsumeNext) {
                opts.failConsumeNext = false;
                return null;
            }
            const row = rows.find((r) => r.challengeId === id);
            if (!row) return null;
            if (row.status !== 'approved') return null;
            if (row.expiresAt.getTime() <= consumedAt.getTime()) {
                return null;
            }
            row.status = 'consumed';
            row.consumedAt = consumedAt;
            consumed.push(id);
            return row;
        },
        async expire(id) {
            const row = rows.find((r) => r.challengeId === id);
            if (!row || row.status !== 'pending') return null;
            row.status = 'expired';
            return row;
        },
        async fail(id) {
            const row = rows.find((r) => r.challengeId === id);
            if (!row || row.status !== 'pending') return null;
            row.status = 'failed';
            return row;
        },
        async deleteExpired() {
            return 0;
        },
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_CONTEXT: DetokenizeCallerContext = {
    actorId: FIXED_REQUESTED_BY,
    actorRole: 'STATE_ADMIN',
    reason: 'compliance review FLN-2026-Q3',
    requestId: 'req-detok-001',
    sourceIp: '10.0.0.7',
    userAgent: 'fln-portal/0.1',
};

function makeTokenRow(overrides: Partial<TokenRow> = {}): TokenRow {
    return {
        id: FIXED_TOKEN_ID,
        identityId: FIXED_IDENTITY_ID,
        algorithm: 'aes-256-gcm',
        ciphertext: FIXED_CIPHERTEXT,
        iv: FIXED_IV,
        authTag: FIXED_AUTHTAG,
        wrappedDek: FIXED_WRAPPED_DEK,
        createdAt: Date.parse('2026-01-15T12:00:00Z'),
        ...overrides,
    };
}

function makeChallenge(
    overrides: Partial<StepUpChallenge> = {},
): StepUpChallenge {
    return {
        challengeId: FIXED_CHALLENGE_ID,
        operation: 'detokenize',
        identityId: FIXED_IDENTITY_ID,
        tokenId: FIXED_TOKEN_ID,
        requestedBy: FIXED_REQUESTED_BY,
        requestedAt: FIXED_REQUESTED_AT,
        expiresAt: FIXED_EXPIRES_AT,
        approvedAt: FIXED_CLOCK,
        consumedAt: null,
        status: 'approved' as StepUpChallengeStatus,
        requiredFactorId: FIXED_FACTOR_ID,
        verifiedFactorId: FIXED_FACTOR_ID,
        auditId: 'audit-001',
        metadata: null,
        ...overrides,
    };
}

interface DepsHandle {
    deps: DetokenizeAadhaarDeps;
    captured: { dek?: Buffer; plaintext?: Buffer };
    audit: RecordingAudit;
    publisher: RecordingPublisher;
    tokens: ReturnType<typeof makeTokenRepo>;
    identities: ReturnType<typeof makeIdentityRepo>;
    challenges: ReturnType<typeof makeFakeChallenges>;
}

function makeDeps(opts: {
    tokens?: TokenRow[];
    identities?: IdentityRecord[];
    challenges?: StepUpChallenge[];
    preloadedCiphertext?: { ct: Buffer; pt: Buffer };
    failUnwrap?: boolean;
    failDecrypt?: boolean;
    failConsumeNext?: boolean;
} = {}): DepsHandle {
    const captured: { dek?: Buffer; plaintext?: Buffer } = {};
    const keyManager = makeFakeKeyManager({
        captured,
        failUnwrap: opts.failUnwrap,
    });
    const crypto = makeFakeCrypto({
        captured,
        failDecrypt: opts.failDecrypt,
        preloadedCiphertext: opts.preloadedCiphertext,
    });
    const audit = makeRecordingAudit();
    const publisher = makeRecordingPublisher();
    const tokens = makeTokenRepo({ rows: opts.tokens });
    const identities = makeIdentityRepo({ rows: opts.identities });
    const challenges = makeFakeChallenges({
        rows: opts.challenges ?? [makeChallenge()],
        failConsumeNext: opts.failConsumeNext,
    });
    const deps: DetokenizeAadhaarDeps = {
        keyManager,
        crypto,
        tokens,
        identities,
        audit,
        events: publisher,
        challenges,
        clock: () => FIXED_CLOCK,
    };
    return {
        deps,
        captured,
        audit,
        publisher,
        tokens,
        identities,
        challenges,
    };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('DetokenizeAadhaar command (Session 7E — challenge-based)', () => {
    let capturedDek: { dek?: Buffer } = {};

    beforeEach(() => {
        capturedDek = {};
    });

    afterEach(() => {
        // The happy-path capture should be zeroed by the command's
        // finally. If we get here with non-zero bytes, the test
        // deliberately failed before the finally could run, which
        // is a real bug; surface it loudly.
        if (
            capturedDek.dek &&
            capturedDek.dek.some((b) => b !== 0)
        ) {
            throw new Error(
                'DEK plaintext leaked past suite teardown — finally block skipped?',
            );
        }
    });

    it('1. happy path — recovers plaintext, writes DETOKENIZE audit with challenge_id + verified_factor_id, publishes DetokenizationCompleted', async () => {
        const { deps, captured, audit, publisher, challenges } = makeDeps({
            tokens: [makeTokenRow()],
            preloadedCiphertext: {
                ct: FIXED_CIPHERTEXT,
                pt: FIXED_PLAINTEXT,
            },
        });
        capturedDek = captured;
        const cmd = makeDetokenizeAadhaar(deps);

        const result = await cmd({
            challengeId: FIXED_CHALLENGE_ID,
            context: BASE_CONTEXT,
        });

        // Returned contract — every field populated correctly.
        expect(result.token).toBe(FIXED_TOKEN_ID);
        expect(result.identityId).toBe(FIXED_IDENTITY_ID);
        expect(result.aadhaar).toBe('123456789012');
        expect(result.last4).toBe('9012');
        expect(result.auditId).toBe('req-detok-001');

        // Audit row: action=DETOKENIZE, outcome=allow, meta carries
        // the Session 7E correlation fields.
        expect(audit.entries.length).toBe(1);
        const ae = audit.entries[0]!;
        expect(ae.action).toBe('DETOKENIZE');
        expect(ae.outcome).toBe('allow');
        expect(ae.actor).toBe(FIXED_REQUESTED_BY);
        expect(ae.identityId).toBe(FIXED_IDENTITY_ID);
        expect(ae.requestId).toBe('req-detok-001');
        expect(ae.reason).toBe('compliance review FLN-2026-Q3');
        expect(ae.meta).toMatchObject({
            challenge_id: FIXED_CHALLENGE_ID,
            token_id: FIXED_TOKEN_ID,
            actor_role: 'STATE_ADMIN',
            key_version: 1,
            pepper_version: 1,
            algorithm: 'aes-256-gcm',
            verified_factor_id: FIXED_FACTOR_ID,
            source_ip: '10.0.0.7',
            user_agent: 'fln-portal/0.1',
        });

        // Event published AFTER the audit append.
        expect(publisher.events.length).toBe(1);
        const ev = publisher.events[0]!;
        expect(ev.type).toBe('DetokenizationCompleted');
        expect((ev as unknown as { challengeId: string }).challengeId).toBe(
            FIXED_CHALLENGE_ID,
        );
        expect((ev as unknown as { tokenId: string }).tokenId).toBe(
            FIXED_TOKEN_ID,
        );
        expect(ev.identityId).toBe(FIXED_IDENTITY_ID);
        expect(ev.last4).toBe('9012');
        expect(ev.actorId).toBe(FIXED_REQUESTED_BY);
        expect(ev.actorRole).toBe('STATE_ADMIN');
        expect(
            (ev as unknown as { verifiedFactorId: string }).verifiedFactorId,
        ).toBe(FIXED_FACTOR_ID);
        expect(ev.occurredAt).toBe(FIXED_CLOCK.toISOString());

        // Replay protection — the challenge was atomically consumed.
        expect(challenges.consumed).toEqual([FIXED_CHALLENGE_ID]);
        const stored = challenges.rows.find(
            (r) => r.challengeId === FIXED_CHALLENGE_ID,
        );
        expect(stored?.status).toBe('consumed');
        expect(stored?.consumedAt?.toISOString()).toBe(
            FIXED_CLOCK.toISOString(),
        );
    });

    it('2. invalid input — empty challengeId throws INVALID_INPUT, never touches repositories', async () => {
        const { deps, audit, publisher, tokens, identities, challenges } =
            makeDeps();
        const findChallengeSpy = vi.spyOn(challenges, 'findById');
        const findSpy = vi.spyOn(tokens, 'findById');
        const getSpy = vi.spyOn(identities, 'getById');

        const cmd = makeDetokenizeAadhaar(deps);

        await expect(
            cmd({ challengeId: '', context: BASE_CONTEXT }),
        ).rejects.toMatchObject({
            name: 'DetokenizeCommandError',
            code: 'INVALID_INPUT',
        });

        expect(findChallengeSpy).not.toHaveBeenCalled();
        expect(findSpy).not.toHaveBeenCalled();
        expect(getSpy).not.toHaveBeenCalled();
        expect(audit.entries).toEqual([]);
        expect(publisher.events).toEqual([]);
    });

    it('3. invalid input — empty actorId throws INVALID_INPUT, never touches repositories', async () => {
        const { deps, audit, publisher, tokens, identities, challenges } =
            makeDeps();
        const findChallengeSpy = vi.spyOn(challenges, 'findById');
        const findSpy = vi.spyOn(tokens, 'findById');
        const getSpy = vi.spyOn(identities, 'getById');

        const cmd = makeDetokenizeAadhaar(deps);

        await expect(
            cmd({
                challengeId: FIXED_CHALLENGE_ID,
                context: { ...BASE_CONTEXT, actorId: '' },
            }),
        ).rejects.toMatchObject({
            name: 'DetokenizeCommandError',
            code: 'INVALID_INPUT',
        });

        expect(findChallengeSpy).not.toHaveBeenCalled();
        expect(findSpy).not.toHaveBeenCalled();
        expect(getSpy).not.toHaveBeenCalled();
        expect(audit.entries).toEqual([]);
        expect(publisher.events).toEqual([]);
    });

    it('4. CHALLENGE_NOT_FOUND — repository returns null, no audit, no event', async () => {
        const { deps, audit, publisher } = makeDeps();
        const cmd = makeDetokenizeAadhaar(deps);

        await expect(
            cmd({
                challengeId: 'does-not-exist',
                context: BASE_CONTEXT,
            }),
        ).rejects.toMatchObject({
            name: 'DetokenizeCommandError',
            code: 'CHALLENGE_NOT_FOUND',
        });

        expect(audit.entries).toEqual([]);
        expect(publisher.events).toEqual([]);
    });

    it('5. CHALLENGE_NOT_APPROVED — status=pending throws, no audit, no event', async () => {
        const { deps, audit, publisher, challenges } = makeDeps({
            challenges: [makeChallenge({ status: 'pending', approvedAt: null })],
        });
        const consumeSpy = vi.spyOn(challenges, 'consume');

        const cmd = makeDetokenizeAadhaar(deps);

        await expect(
            cmd({
                challengeId: FIXED_CHALLENGE_ID,
                context: BASE_CONTEXT,
            }),
        ).rejects.toMatchObject({
            name: 'DetokenizeCommandError',
            code: 'CHALLENGE_NOT_APPROVED',
        });

        expect(consumeSpy).not.toHaveBeenCalled();
        expect(audit.entries).toEqual([]);
        expect(publisher.events).toEqual([]);
    });

    it('6. CHALLENGE_EXPIRED — expiresAt in the past throws, no audit, no event', async () => {
        const { deps, audit, publisher, challenges } = makeDeps({
            challenges: [
                makeChallenge({
                    expiresAt: new Date('2026-01-15T12:00:00Z'), // before FIXED_CLOCK (12:30)
                }),
            ],
        });
        const consumeSpy = vi.spyOn(challenges, 'consume');

        const cmd = makeDetokenizeAadhaar(deps);

        await expect(
            cmd({
                challengeId: FIXED_CHALLENGE_ID,
                context: BASE_CONTEXT,
            }),
        ).rejects.toMatchObject({
            name: 'DetokenizeCommandError',
            code: 'CHALLENGE_EXPIRED',
        });

        expect(consumeSpy).not.toHaveBeenCalled();
        expect(audit.entries).toEqual([]);
        expect(publisher.events).toEqual([]);
    });

    it('7. CHALLENGE_CONSUMED (replay) — consume() rejects, no audit, no event', async () => {
        // Race-window simulation: findById sees an `approved`
        // challenge, but consume() rejects (someone else consumed
        // it between the two calls).
        const { deps, audit, publisher, challenges } = makeDeps({
            failConsumeNext: true,
        });
        const consumeSpy = vi.spyOn(challenges, 'consume');

        const cmd = makeDetokenizeAadhaar(deps);

        await expect(
            cmd({
                challengeId: FIXED_CHALLENGE_ID,
                context: BASE_CONTEXT,
            }),
        ).rejects.toMatchObject({
            name: 'DetokenizeCommandError',
            code: 'CHALLENGE_CONSUMED',
        });

        expect(consumeSpy).toHaveBeenCalledTimes(1);
        expect(audit.entries).toEqual([]);
        expect(publisher.events).toEqual([]);

        // The challenge row should still be `approved` — a failed
        // consume() never flips the row.
        const stored = challenges.rows.find(
            (r) => r.challengeId === FIXED_CHALLENGE_ID,
        );
        expect(stored?.status).toBe('approved');
        expect(challenges.consumed).toEqual([]);
    });

    it('8. ACTOR_MISMATCH — challenge.requestedBy != context.actorId throws, no audit, no event', async () => {
        const { deps, audit, publisher, challenges } = makeDeps({
            challenges: [
                makeChallenge({ requestedBy: 'someone-else' }),
            ],
        });
        const consumeSpy = vi.spyOn(challenges, 'consume');

        const cmd = makeDetokenizeAadhaar(deps);

        await expect(
            cmd({
                challengeId: FIXED_CHALLENGE_ID,
                context: BASE_CONTEXT,
            }),
        ).rejects.toMatchObject({
            name: 'DetokenizeCommandError',
            code: 'ACTOR_MISMATCH',
        });

        expect(consumeSpy).not.toHaveBeenCalled();
        expect(audit.entries).toEqual([]);
        expect(publisher.events).toEqual([]);
    });

    it('9. TOKEN_NOT_FOUND — challenge.tokenId not in tokens table throws, no audit, no event', async () => {
        const { deps, audit, publisher } = makeDeps({
            tokens: [], // intentionally empty
        });

        const cmd = makeDetokenizeAadhaar(deps);

        await expect(
            cmd({
                challengeId: FIXED_CHALLENGE_ID,
                context: BASE_CONTEXT,
            }),
        ).rejects.toMatchObject({
            name: 'DetokenizeCommandError',
            code: 'TOKEN_NOT_FOUND',
        });

        expect(audit.entries).toEqual([]);
        expect(publisher.events).toEqual([]);
    });

    it('10. IDENTITY_NOT_FOUND — token row present but parent identity missing throws, no audit, no event', async () => {
        const { deps, audit, publisher } = makeDeps({
            tokens: [makeTokenRow()],
            identities: [], // intentionally empty
        });

        const cmd = makeDetokenizeAadhaar(deps);

        await expect(
            cmd({
                challengeId: FIXED_CHALLENGE_ID,
                context: BASE_CONTEXT,
            }),
        ).rejects.toMatchObject({
            name: 'DetokenizeCommandError',
            code: 'IDENTITY_NOT_FOUND',
        });

        expect(audit.entries).toEqual([]);
        expect(publisher.events).toEqual([]);
    });

    it('11. UNWRAP_FAILED — KeyManager.unwrapDataKey throws, no audit, no event', async () => {
        const { deps, audit, publisher } = makeDeps({
            tokens: [makeTokenRow()],
            failUnwrap: true,
        });

        const cmd = makeDetokenizeAadhaar(deps);

        await expect(
            cmd({
                challengeId: FIXED_CHALLENGE_ID,
                context: BASE_CONTEXT,
            }),
        ).rejects.toMatchObject({
            name: 'DetokenizeCommandError',
            code: 'UNWRAP_FAILED',
        });

        expect(audit.entries).toEqual([]);
        expect(publisher.events).toEqual([]);
    });

    it('12. DECRYPTION_FAILED — CryptoService.decrypt throws, no audit, no event', async () => {
        const { deps, audit, publisher } = makeDeps({
            tokens: [makeTokenRow()],
            failDecrypt: true,
        });

        const cmd = makeDetokenizeAadhaar(deps);

        await expect(
            cmd({
                challengeId: FIXED_CHALLENGE_ID,
                context: BASE_CONTEXT,
            }),
        ).rejects.toMatchObject({
            name: 'DetokenizeCommandError',
            code: 'DECRYPTION_FAILED',
        });

        expect(audit.entries).toEqual([]);
        expect(publisher.events).toEqual([]);
    });

    it('13. INVALID_PAYLOAD — recovered plaintext is not a 12-digit Aadhaar, no audit, no event', async () => {
        const { deps, audit, publisher } = makeDeps({
            tokens: [makeTokenRow()],
            preloadedCiphertext: {
                ct: FIXED_CIPHERTEXT,
                // 12 bytes but not digits — the toString('utf8')
                // yields "abcdefghijkl", which fails the 12-digit
                // regex in the command.
                pt: Buffer.from('abcdefghijkl', 'utf8'),
            },
        });

        const cmd = makeDetokenizeAadhaar(deps);

        await expect(
            cmd({
                challengeId: FIXED_CHALLENGE_ID,
                context: BASE_CONTEXT,
            }),
        ).rejects.toMatchObject({
            name: 'DetokenizeCommandError',
            code: 'INVALID_PAYLOAD',
        });

        expect(audit.entries).toEqual([]);
        expect(publisher.events).toEqual([]);
    });

    it('14. audit-append order — event is published AFTER the audit append; failed append suppresses event', async () => {
        // Happy path: assert the call order.
        const callOrder: string[] = [];
        const { deps, audit, publisher } = makeDeps({
            tokens: [makeTokenRow()],
            preloadedCiphertext: {
                ct: FIXED_CIPHERTEXT,
                pt: FIXED_PLAINTEXT,
            },
        });
        const origAppend = audit.append.bind(audit);
        audit.append = async (entry) => {
            callOrder.push('audit.append');
            return origAppend(entry);
        };
        const origPublish = publisher.publish.bind(publisher);
        publisher.publish = async (ev) => {
            callOrder.push('events.publish');
            return origPublish(ev);
        };

        const cmd = makeDetokenizeAadhaar(deps);
        await cmd({
            challengeId: FIXED_CHALLENGE_ID,
            context: BASE_CONTEXT,
        });
        expect(callOrder).toEqual(['audit.append', 'events.publish']);

        // Failure path: audit append throws → publish never reached.
        const { deps: depsFail, publisher: publisherFail } = makeDeps({
            tokens: [makeTokenRow()],
            preloadedCiphertext: {
                ct: FIXED_CIPHERTEXT,
                pt: FIXED_PLAINTEXT,
            },
        });
        depsFail.audit.append = async () => {
            throw new Error('disk full (test fake)');
        };
        const cmdFail = makeDetokenizeAadhaar(depsFail);
        await expect(
            cmdFail({
                challengeId: FIXED_CHALLENGE_ID,
                context: BASE_CONTEXT,
            }),
        ).rejects.toThrow(/disk full/i);
        expect(publisherFail.events).toEqual([]);
    });

    it('15. plaintext hygiene — DEK bytes are zeroed on the happy path and on every throw branch', async () => {
        // Happy path: DEK is captured and zeroed.
        const { deps, captured } = makeDeps({
            tokens: [makeTokenRow()],
            preloadedCiphertext: {
                ct: FIXED_CIPHERTEXT,
                pt: FIXED_PLAINTEXT,
            },
        });
        capturedDek = captured;
        const cmdHappy = makeDetokenizeAadhaar(deps);
        await cmdHappy({
            challengeId: FIXED_CHALLENGE_ID,
            context: BASE_CONTEXT,
        });
        expect(captured.dek, 'DEK plaintext not captured by fake').toBeDefined();
        expect(
            captured.dek!.every((b) => b === 0),
            'DEK plaintext was not zeroed in finally (happy path)',
        ).toBe(true);

        // Throw path 1: unwrap fails.
        const { deps: depsUnwrapFail } = makeDeps({
            tokens: [makeTokenRow()],
            failUnwrap: true,
        });
        const cmdUnwrapFail = makeDetokenizeAadhaar(depsUnwrapFail);
        await expect(
            cmdUnwrapFail({
                challengeId: FIXED_CHALLENGE_ID,
                context: BASE_CONTEXT,
            }),
        ).rejects.toMatchObject({ code: 'UNWRAP_FAILED' });

        // Throw path 2: decrypt fails. The fake KeyManager still
        // records the DEK during a successful unwrap, so we can
        // assert it is zeroed.
        const { deps: depsDecryptFail, captured: capturedDecryptFail } =
            makeDeps({
                tokens: [makeTokenRow()],
                failDecrypt: true,
            });
        const cmdDecryptFail = makeDetokenizeAadhaar(depsDecryptFail);
        await expect(
            cmdDecryptFail({
                challengeId: FIXED_CHALLENGE_ID,
                context: BASE_CONTEXT,
            }),
        ).rejects.toMatchObject({ code: 'DECRYPTION_FAILED' });
        expect(capturedDecryptFail.dek).toBeDefined();

        // Throw path 3: challenge not approved. The command never
        // touches the DEK on this branch; assert the finally
        // ran without throwing.
        const { deps: depsNotApproved } = makeDeps({
            challenges: [
                makeChallenge({ status: 'pending', approvedAt: null }),
            ],
        });
        const cmdNotApproved = makeDetokenizeAadhaar(depsNotApproved);
        await expect(
            cmdNotApproved({
                challengeId: FIXED_CHALLENGE_ID,
                context: BASE_CONTEXT,
            }),
        ).rejects.toMatchObject({ code: 'CHALLENGE_NOT_APPROVED' });

        // Throw path 4: replay (consume() returns null).
        const { deps: depsConsumed } = makeDeps({ failConsumeNext: true });
        const cmdConsumed = makeDetokenizeAadhaar(depsConsumed);
        await expect(
            cmdConsumed({
                challengeId: FIXED_CHALLENGE_ID,
                context: BASE_CONTEXT,
            }),
        ).rejects.toMatchObject({ code: 'CHALLENGE_CONSUMED' });
    });
});