/**
 * In-memory adapter for the Step-Up Challenge repository.
 *
 * Used by the test suite (via `createMemoryDatabase()`) and by any
 * developer-mode runs that have not yet pointed at a real Postgres
 * instance. The adapter keeps challenges in a `Map<id, row>` so it is
 * O(1) on lookup and gives the test suite a clean copy of state per
 * test (Vitest creates a fresh pool per test file).
 *
 * Why a separate class from the Postgres adapter?
 *   * The Postgres adapter speaks SQL; this adapter speaks plain
 *     TypeScript. The two implementations are tested independently
 *     so a bug in the SQL surface does not surface here and vice
 *     versa.
 *   * In-memory adapters are required to drop the legacy `pg-mem`
 *     rewrite landmines (see `db/memory-pool.ts`). For an aggregate
 *     with a tight state-machine we want guarantees that a SQL
 *     conformance test does not give us — for example, that
 *     `consume` is *atomic* and that `findById` returns a deep
 *     clone so the caller cannot mutate stored state.
 *
 * Safety properties verified by tests:
 *   * `create` always sets `status = 'pending'` and stamps
 *     `approvedAt`/`consumedAt` to `null`.
 *   * `approve` requires `pending`; otherwise returns `null`.
 *   * `consume` requires `approved`; otherwise returns `null`.
 *     The atomic `approved → consumed` collapse prevents replay.
 *   * `expire` and `fail` require `pending`; otherwise `null`.
 *   * `deleteExpired` only deletes terminal rows older than `before`.
 */
import type {
    ApproveStepUpChallengeInput,
    CreateStepUpChallengeInput,
    StepUpChallenge,
    StepUpChallengeRepository,
    StepUpChallengeStatus,
    StepUpOperation,
} from '../../application/ports/step-up-challenge.repository.js';

/**
 * Internal row shape — same as the public shape but stored by `id`
 * for O(1) lookup.
 */
type ChallengeRow = StepUpChallenge;

/**
 * Result of `consume`: the consumed row, or `null` if the row was
 * missing / not `approved` / already `consumed`.
 */
type ConsumeResult = ChallengeRow | null;

/**
 * In-memory implementation of the step-up challenge repository.
 *
 * Thread safety: NOT thread-safe. JavaScript is single-threaded so
 * this is fine for the test harness; the production code path uses
 * the Postgres adapter which relies on row locks.
 */
export class MemoryStepUpChallengeRepository
    implements StepUpChallengeRepository
{
    private readonly byId = new Map<string, ChallengeRow>();

    /**
     * Internal helper — return a structural clone so the caller cannot
     * mutate stored state by holding a reference.
     */
    private clone(row: ChallengeRow): ChallengeRow {
        return {
            ...row,
            // Date fields must be cloned so the caller cannot push the
            // stored row's timestamp into the future.
            requestedAt: new Date(row.requestedAt.getTime()),
            expiresAt: new Date(row.expiresAt.getTime()),
            approvedAt:
                row.approvedAt === null
                    ? null
                    : new Date(row.approvedAt.getTime()),
            consumedAt:
                row.consumedAt === null
                    ? null
                    : new Date(row.consumedAt.getTime()),
        };
    }

    async create(input: CreateStepUpChallengeInput): Promise<StepUpChallenge> {
        // Hardening: every create lands in `pending` state. The
        // application command cannot bypass this — the repository
        // stamps the status.
        const row: ChallengeRow = {
            challengeId: input.challengeId,
            operation: input.operation as StepUpOperation,
            identityId: input.identityId,
            tokenId: input.tokenId,
            requestedBy: input.requestedBy,
            requestedAt: new Date(input.requestedAt.getTime()),
            expiresAt: new Date(input.expiresAt.getTime()),
            approvedAt: null,
            consumedAt: null,
            status: 'pending',
            requiredFactorId: input.requiredFactorId,
            verifiedFactorId: null,
            auditId: null,
            metadata: input.metadata,
        };
        this.byId.set(row.challengeId, row);
        return this.clone(row);
    }

    async findById(challengeId: string): Promise<StepUpChallenge | null> {
        const row = this.byId.get(challengeId);
        return row ? this.clone(row) : null;
    }

    async approve(
        input: ApproveStepUpChallengeInput,
    ): Promise<StepUpChallenge | null> {
        const row = this.byId.get(input.challengeId);
        if (!row) return null;
        if (row.status !== 'pending') return null;
        row.status = 'approved';
        row.approvedAt = new Date(input.approvedAt.getTime());
        row.verifiedFactorId = input.verifiedFactorId;
        row.auditId = input.auditId;
        return this.clone(row);
    }

    async consume(
        challengeId: string,
        consumedAt: Date,
    ): Promise<StepUpChallenge | null> {
        const row = this.byId.get(challengeId);
        if (!row) return null;
        // Replay gate: only `approved` may transition to `consumed`.
        // This is the single line of defence against replay for the
        // memory adapter.
        if (row.status !== 'approved') return null;
        row.status = 'consumed';
        row.consumedAt = new Date(consumedAt.getTime());
        return this.clone(row);
    }

    async expire(
        challengeId: string,
        expiredAt: Date,
    ): Promise<StepUpChallenge | null> {
        const row = this.byId.get(challengeId);
        if (!row) return null;
        if (row.status !== 'pending') return null;
        row.status = 'expired';
        // Stamp the expiry onto the existing expiresAt if it is
        // earlier (i.e. an out-of-band check noticed it had already
        // passed). The caller-supplied `expiredAt` is authoritative
        // when the row is being transitioned.
        if (row.expiresAt.getTime() > expiredAt.getTime()) {
            row.expiresAt = new Date(expiredAt.getTime());
        }
        return this.clone(row);
    }

    async fail(
        challengeId: string,
        failedAt: Date,
    ): Promise<StepUpChallenge | null> {
        const row = this.byId.get(challengeId);
        if (!row) return null;
        if (row.status !== 'pending') return null;
        row.status = 'failed';
        if (row.expiresAt.getTime() > failedAt.getTime()) {
            row.expiresAt = new Date(failedAt.getTime());
        }
        return this.clone(row);
    }

    async deleteExpired(before: Date): Promise<number> {
        // Defense in depth: only remove terminal rows (consumed,
        // expired, failed). Pending rows are protected even if their
        // `expiresAt` is in the past — the caller is expected to
        // first transition them via `expire` or `fail` so the audit
        // trail captures the lifecycle.
        let removed = 0;
        for (const [id, row] of this.byId) {
            const isTerminal =
                row.status === ('consumed' satisfies StepUpChallengeStatus) ||
                row.status === ('expired' satisfies StepUpChallengeStatus) ||
                row.status === ('failed' satisfies StepUpChallengeStatus);
            if (isTerminal && row.expiresAt.getTime() < before.getTime()) {
                this.byId.delete(id);
                removed += 1;
            }
        }
        return removed;
    }

    /**
     * Test-only helper — wipe every row. Production code never calls
     * this; it exists so `createMemoryDatabase()` callers can reset
     * state between scenarios. Not part of the public port surface.
     */
    __resetForTests(): void {
        this.byId.clear();
    }

    /**
     * Test-only helper — current row count. Not part of the public
     * port surface.
     */
    __sizeForTests(): number {
        return this.byId.size;
    }
}