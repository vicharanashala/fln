/**
 * Repository tests for the Session 7 step-up challenge persistence.
 *
 * Two adapters are exercised here:
 *   1. `MemoryStepUpChallengeRepository` — directly.
 *   2. `PostgresStepUpChallengeRepository` — through the test
 *      `MemoryPool` that powers every other adapter's tests.
 *
 * The Postgres adapter is intentionally not tested against a live
 * Postgres instance in CI (the repo is pg-mem-free); the
 * `MemoryPool` speaks the exact INSERT/UPDATE/DELETE grammar the
 * adapters issue, so any divergence will trip a thrown error during
 * the test run. The conditional-UPDATE state machine is verified by
 * the assertions below.
 *
 * Test surface (mirrors the Phase 12 deliverable list):
 *   * Challenge lifecycle (create → find → approve → consume)
 *   * Approval rejection from non-pending states
 *   * Replay rejection (consumed challenge cannot be consumed again)
 *   * Expired challenge handling
 *   * Failed challenge handling
 *   * deleteExpired only touches terminal rows
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { createMemoryDatabase } from '../src/db/index.js';
import {
    MemoryStepUpChallengeRepository,
} from '../src/infrastructure/db/memory-step-up-challenge.repository.js';
import {
    PostgresStepUpChallengeRepository,
} from '../src/infrastructure/db/postgres-step-up-challenge.repository.js';
import type {
    CreateStepUpChallengeInput,
    StepUpChallengeRepository,
} from '../src/application/ports/step-up-challenge.repository.js';

const SAMPLE_INPUT = (
    overrides: Partial<CreateStepUpChallengeInput> = {},
): CreateStepUpChallengeInput => ({
    challengeId: overrides.challengeId ?? '00000000-0000-0000-0000-000000000abc',
    operation: overrides.operation ?? 'detokenize',
    identityId: overrides.identityId ?? 'identity-1',
    tokenId: overrides.tokenId ?? 'token-1',
    requestedBy: overrides.requestedBy ?? 'actor-1',
    requestedAt: overrides.requestedAt ?? new Date('2026-01-01T00:00:00Z'),
    expiresAt: overrides.expiresAt ?? new Date('2026-01-01T00:05:00Z'),
    requiredFactorId: overrides.requiredFactorId ?? 'factor-1',
    metadata: overrides.metadata ?? null,
});

/**
 * Shared assertion suite for both adapters. Each adapter is wired
 * into a fresh `RepositoryHarness`; the suite then verifies the
 * identical contract against either persistence layer.
 */
function buildSuite(
    name: string,
    makeRepository: () => StepUpChallengeRepository | Promise<StepUpChallengeRepository>,
) {
    describe(name, () => {
        let repo: StepUpChallengeRepository;

        beforeEach(async () => {
            repo = await makeRepository();
        });

        it('creates a row in pending state and finds it by id', async () => {
            const input = SAMPLE_INPUT();
            const created = await repo.create(input);
            expect(created.status).toBe('pending');
            expect(created.challengeId).toBe(input.challengeId);
            expect(created.approvedAt).toBeNull();
            expect(created.consumedAt).toBeNull();
            expect(created.verifiedFactorId).toBeNull();
            expect(created.auditId).toBeNull();
            expect(created.tokenId).toBe('token-1');

            const fetched = await repo.findById(input.challengeId);
            expect(fetched).not.toBeNull();
            expect(fetched!.status).toBe('pending');
            expect(fetched!.expiresAt.getTime()).toBe(
                input.expiresAt.getTime(),
            );
        });

        it('returns null when findById is called for an unknown id', async () => {
            const fetched = await repo.findById('no-such-id');
            expect(fetched).toBeNull();
        });

        it('transitions pending → approved on a correct factor match', async () => {
            const created = await repo.create(SAMPLE_INPUT());
            const approved = await repo.approve({
                challengeId: created.challengeId,
                verifiedFactorId: 'factor-1',
                approvedAt: new Date('2026-01-01T00:01:00Z'),
                auditId: 'audit-approve-1',
            });
            expect(approved).not.toBeNull();
            expect(approved!.status).toBe('approved');
            expect(approved!.verifiedFactorId).toBe('factor-1');
            expect(approved!.approvedAt?.toISOString()).toBe(
                '2026-01-01T00:01:00.000Z',
            );
            expect(approved!.auditId).toBe('audit-approve-1');
        });

        it('rejects approval when the row is missing', async () => {
            const result = await repo.approve({
                challengeId: 'absent',
                verifiedFactorId: 'factor-1',
                approvedAt: new Date(),
                auditId: null,
            });
            expect(result).toBeNull();
        });

        it('rejects approval when the row is already approved', async () => {
            const c = await repo.create(SAMPLE_INPUT());
            await repo.approve({
                challengeId: c.challengeId,
                verifiedFactorId: 'factor-1',
                approvedAt: new Date(),
                auditId: null,
            });
            const second = await repo.approve({
                challengeId: c.challengeId,
                verifiedFactorId: 'factor-1',
                approvedAt: new Date(),
                auditId: null,
            });
            expect(second).toBeNull();
        });

        it('rejects approval when the row has already failed', async () => {
            const c = await repo.create(SAMPLE_INPUT());
            await repo.fail(c.challengeId, new Date());
            const approved = await repo.approve({
                challengeId: c.challengeId,
                verifiedFactorId: 'factor-1',
                approvedAt: new Date(),
                auditId: null,
            });
            expect(approved).toBeNull();
        });

        it('consumes an approved challenge exactly once (replay rejection)', async () => {
            const c = await repo.create(SAMPLE_INPUT());
            await repo.approve({
                challengeId: c.challengeId,
                verifiedFactorId: 'factor-1',
                approvedAt: new Date(),
                auditId: null,
            });
            const first = await repo.consume(c.challengeId, new Date());
            expect(first).not.toBeNull();
            expect(first!.status).toBe('consumed');
            expect(first!.consumedAt).toBeInstanceOf(Date);

            // Replay — second consume must return null, never an
            // updated row. This is the single most important
            // assertion in this file.
            const replay = await repo.consume(c.challengeId, new Date());
            expect(replay).toBeNull();
        });

        it('rejects consume when the row is in pending state', async () => {
            const c = await repo.create(SAMPLE_INPUT());
            const consumed = await repo.consume(c.challengeId, new Date());
            expect(consumed).toBeNull();
        });

        it('rejects consume when the row is missing', async () => {
            const result = await repo.consume('absent', new Date());
            expect(result).toBeNull();
        });

        it('expires a pending row and refuses subsequent approve', async () => {
            const c = await repo.create(SAMPLE_INPUT());
            const exp = await repo.expire(c.challengeId, new Date());
            expect(exp).not.toBeNull();
            expect(exp!.status).toBe('expired');

            const approved = await repo.approve({
                challengeId: c.challengeId,
                verifiedFactorId: 'factor-1',
                approvedAt: new Date(),
                auditId: null,
            });
            expect(approved).toBeNull();
        });

        it('fails a pending row and refuses subsequent expire', async () => {
            const c = await repo.create(SAMPLE_INPUT());
            const failed = await repo.fail(c.challengeId, new Date());
            expect(failed).not.toBeNull();
            expect(failed!.status).toBe('failed');

            const exp = await repo.expire(c.challengeId, new Date());
            expect(exp).toBeNull();
        });

        it('expire on a consumed row is a no-op (returns null)', async () => {
            const c = await repo.create(SAMPLE_INPUT());
            await repo.approve({
                challengeId: c.challengeId,
                verifiedFactorId: 'factor-1',
                approvedAt: new Date(),
                auditId: null,
            });
            await repo.consume(c.challengeId, new Date());
            const exp = await repo.expire(c.challengeId, new Date());
            expect(exp).toBeNull();
        });

        it('deleteExpired only removes terminal rows in the past', async () => {
            // Mix of rows across all status values with varying TTLs.
            const oldPending = await repo.create(
                SAMPLE_INPUT({
                    challengeId:
                        '00000000-0000-0000-0000-0000000000a1',
                    requestedAt: new Date('2026-01-01T00:00:00Z'),
                    // Expired ages ago — pending row that the sweeper
                    // must NOT delete (caller is expected to expire
                    // it first).
                    expiresAt: new Date('2026-01-01T00:01:00Z'),
                }),
            );
            const oldConsumed = await repo.create(
                SAMPLE_INPUT({
                    challengeId:
                        '00000000-0000-0000-0000-0000000000a2',
                    requestedAt: new Date('2026-01-01T00:00:00Z'),
                    expiresAt: new Date('2026-01-01T00:01:00Z'),
                }),
            );
            await repo.approve({
                challengeId: oldConsumed.challengeId,
                verifiedFactorId: 'factor-1',
                approvedAt: new Date('2026-01-01T00:00:30Z'),
                auditId: null,
            });
            await repo.consume(
                oldConsumed.challengeId,
                new Date('2026-01-01T00:00:35Z'),
            );

            const future = await repo.create(
                SAMPLE_INPUT({
                    challengeId:
                        '00000000-0000-0000-0000-0000000000a3',
                    requestedAt: new Date('2026-02-01T00:00:00Z'),
                    expiresAt: new Date('2026-02-01T00:05:00Z'),
                }),
            );

            const removed = await repo.deleteExpired(
                new Date('2026-01-15T00:00:00Z'),
            );
            expect(removed).toBe(1);

            // Pending-but-expired row is still present.
            const stillPending = await repo.findById(oldPending.challengeId);
            expect(stillPending?.status).toBe('pending');

            // Consumed row is gone.
            const consumedGone = await repo.findById(oldConsumed.challengeId);
            expect(consumedGone).toBeNull();

            // Future row is intact.
            const futureOk = await repo.findById(future.challengeId);
            expect(futureOk?.status).toBe('pending');
        });
    });
}

describe('StepUpChallengeRepository (memory adapter)', () => {
    buildSuite('memory adapter', () => new MemoryStepUpChallengeRepository());
});

describe('StepUpChallengeRepository (postgres adapter via MemoryPool)', () => {
    buildSuite('postgres adapter', async () => {
        const db = await createMemoryDatabase();
        // Tests use a fresh `Database`; the MemoryPool inside it
        // already has the `vault_step_up_challenges` table spec
        // declared via `declareSchema()` in `db/index.ts`.
        return new PostgresStepUpChallengeRepository(db.pool);
    });
});