/**
 * Postgres adapter for the Step-Up Challenge repository.
 *
 * Mirrors the column layout of migration 004 (`vault_step_up_challenges`)
 * and the row-shape contract documented in
 * `application/ports/step-up-challenge.repository.ts`.
 *
 * Concurrency model
 *   Every state-changing UPDATE includes a `WHERE status = <expected>`
 *   predicate so two concurrent `consume` calls collapse to exactly
 *   one winner; the second call returns zero rows and is mapped to a
 *   `null` outcome. This is the only line of defence against replay
 *   and it sits inside the SQL — application code cannot bypass it.
 *
 *   The `RETURNING` clause guarantees the row is delivered to the
 *   caller only when the update actually changed it; the caller does
 *   not need to issue a follow-up `SELECT`.
 *
 *   The adapter does NOT rely on row-level locks (`SELECT … FOR
 *   UPDATE`). The conditional-UPDATE pattern is sufficient because
 *   Postgres serializes UPDATE locks on the row and the status
 *   predicate filters out the second writer.
 *
 * Time semantics
 *   All timestamps are stamped by the application command (no
 *   `DEFAULT now()` in the schema), which keeps the adapter portable
 *   across pg, pg-mem, and any future store. The adapter does not
 *   interpret expiry — it merely stores and returns the row.
 *
 * Pool compatibility
 *   Tested against both the production `pg` pool (`src/db/pool.ts`)
 *   and the in-process `pg-mem` MemoryPool (`src/db/memory-pool.ts`),
 *   both of which satisfy the `PoolLike` interface. The SQL is plain
 *   PostgreSQL DML.
 */
import type {
    ApproveStepUpChallengeInput,
    CreateStepUpChallengeInput,
    StepUpChallenge,
    StepUpChallengeRepository,
    StepUpChallengeStatus,
    StepUpOperation,
} from '../../application/ports/step-up-challenge.repository.js';
import type { PoolLike } from '../../db/pool.js';

interface StepUpRow {
    challenge_id: string;
    operation: string;
    identity_id: string;
    token_id: string | null;
    requested_by: string;
    requested_at: Date;
    expires_at: Date;
    approved_at: Date | null;
    consumed_at: Date | null;
    status: string;
    required_factor_id: string;
    verified_factor_id: string | null;
    audit_id: string | null;
    metadata: string | null;
}

const SELECT_COLUMNS = `
    challenge_id,
    operation,
    identity_id,
    token_id,
    requested_by,
    requested_at,
    expires_at,
    approved_at,
    consumed_at,
    status,
    required_factor_id,
    verified_factor_id,
    audit_id,
    metadata
`;

function mapRow(row: StepUpRow): StepUpChallenge {
    return {
        challengeId: row.challenge_id,
        operation: row.operation as StepUpOperation,
        identityId: row.identity_id,
        tokenId: row.token_id,
        requestedBy: row.requested_by,
        requestedAt: row.requested_at,
        expiresAt: row.expires_at,
        approvedAt: row.approved_at,
        consumedAt: row.consumed_at,
        status: row.status as StepUpChallengeStatus,
        requiredFactorId: row.required_factor_id,
        verifiedFactorId: row.verified_factor_id,
        auditId: row.audit_id,
        metadata: row.metadata,
    };
}

/**
 * Production adapter. Implements the entire
 * `StepUpChallengeRepository` interface against a Postgres-compatible
 * pool. The adapter is intentionally stateless; all persistence lives
 * in the database.
 */
export class PostgresStepUpChallengeRepository
    implements StepUpChallengeRepository
{
    constructor(private readonly pool: PoolLike) {}

    async create(input: CreateStepUpChallengeInput): Promise<StepUpChallenge> {
        const { rows } = await this.pool.query<StepUpRow>(
            `INSERT INTO vault_step_up_challenges
                (challenge_id, operation, identity_id, token_id,
                 requested_by, requested_at, expires_at,
                 status, required_factor_id, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7,
                 'pending', $8, $9)
             RETURNING ${SELECT_COLUMNS}`,
            [
                input.challengeId,
                input.operation,
                input.identityId,
                input.tokenId,
                input.requestedBy,
                input.requestedAt,
                input.expiresAt,
                input.requiredFactorId,
                input.metadata,
            ],
        );
        const row = rows[0];
        if (!row) {
            throw new Error(
                'step-up challenge INSERT returned no row (unexpected)',
            );
        }
        return mapRow(row);
    }

    async findById(challengeId: string): Promise<StepUpChallenge | null> {
        const { rows } = await this.pool.query<StepUpRow>(
            `SELECT ${SELECT_COLUMNS}
             FROM vault_step_up_challenges
             WHERE challenge_id = $1`,
            [challengeId],
        );
        const row = rows[0];
        return row ? mapRow(row) : null;
    }

    async approve(
        input: ApproveStepUpChallengeInput,
    ): Promise<StepUpChallenge | null> {
        // Only `pending` may transition to `approved`. The
        // conditional UPDATE is the single source of truth for the
        // state machine — application code cannot bypass it.
        const { rows } = await this.pool.query<StepUpRow>(
            `UPDATE vault_step_up_challenges
             SET status = 'approved',
                 approved_at = $2,
                 verified_factor_id = $3,
                 audit_id = $4
             WHERE challenge_id = $1 AND status = 'pending'
             RETURNING ${SELECT_COLUMNS}`,
            [
                input.challengeId,
                input.approvedAt,
                input.verifiedFactorId,
                input.auditId,
            ],
        );
        const row = rows[0];
        return row ? mapRow(row) : null;
    }

    async consume(
        challengeId: string,
        consumedAt: Date,
    ): Promise<StepUpChallenge | null> {
        // Replay-prevention gate. Only `approved` may transition to
        // `consumed`. Any other state (including already-`consumed`)
        // returns zero rows. The caller maps the empty result to a
        // hard rejection — never a retry.
        const { rows } = await this.pool.query<StepUpRow>(
            `UPDATE vault_step_up_challenges
             SET status = 'consumed',
                 consumed_at = $2
             WHERE challenge_id = $1 AND status = 'approved'
             RETURNING ${SELECT_COLUMNS}`,
            [challengeId, consumedAt],
        );
        const row = rows[0];
        return row ? mapRow(row) : null;
    }

    async expire(
        challengeId: string,
        expiredAt: Date,
    ): Promise<StepUpChallenge | null> {
        const { rows } = await this.pool.query<StepUpRow>(
            `UPDATE vault_step_up_challenges
             SET status = 'expired'
             WHERE challenge_id = $1 AND status = 'pending'
             RETURNING ${SELECT_COLUMNS}`,
            [challengeId, expiredAt],
        );
        const row = rows[0];
        return row ? mapRow(row) : null;
    }

    async fail(
        challengeId: string,
        failedAt: Date,
    ): Promise<StepUpChallenge | null> {
        const { rows } = await this.pool.query<StepUpRow>(
            `UPDATE vault_step_up_challenges
             SET status = 'failed'
             WHERE challenge_id = $1 AND status = 'pending'
             RETURNING ${SELECT_COLUMNS}`,
            [challengeId, failedAt],
        );
        const row = rows[0];
        return row ? mapRow(row) : null;
    }

    async deleteExpired(before: Date): Promise<number> {
        // Only terminal rows are eligible for deletion. Pending rows
        // are protected even if they are well past expiry — the
        // caller is expected to first transition them with `expire`
        // (or `fail`) so the audit trail captures the lifecycle.
        const { rowCount } = await this.pool.query(
            `DELETE FROM vault_step_up_challenges
             WHERE status IN ('consumed', 'expired', 'failed')
               AND expires_at < $1`,
            [before],
        );
        return rowCount ?? 0;
    }
}