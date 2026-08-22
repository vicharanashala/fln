/**
 * Step-Up Challenge repository port.
 *
 * Introduced in Session 7 to mediate sensitive operations behind an
 * in-band MFA approval. The challenge is a first-class domain object
 * with its own lifecycle (`pending → approved → consumed` or
 * `pending → expired` / `pending → failed`).
 *
 * Why a port instead of a concrete adapter?
 *   * The application layer must not depend on `pg`, `pg-mem`, or any
 *     concrete persistence library. This is the same separation used
 *     by the MFA factor and token repositories (see
 *     `mfa-repository.ts` / `token.repository.ts`).
 *   * `db/index.ts` is the only place that holds the wiring decision
 *     between the Postgres and the in-memory adapters. Everything
 *     upstream takes the interface and stays unaware of the choice.
 *
 * Lifecycle contract
 *   * `create` always lands a row in `pending` state. The caller must
 *     supply `challengeId`, `requestedAt`, `expiresAt`, and enough
 *     metadata to audit the request later.
 *   * `findById` is the only read; it returns `null` for unknown ids
 *     so callers can map the absence to a 404.
 *   * `approve` transitions `pending → approved`. It returns the
 *     updated row, or `null` if the row was missing **or** not in
 *     `pending` state. Callers must treat both outcomes as
 *     non-recoverable to keep the state machine non-bypassable.
 *   * `consume` is the atomic transition that gates the plaintext
 *     return. It accepts `approved → consumed` only. It is the
 *     single point of replay prevention.
 *   * `expire` transitions `pending → expired` (caller decides when
 *     to sweep; the repository does not run timers).
 *   * `fail` transitions `pending → failed` (caller signals that an
 *     MFA verification explicitly failed).
 *   * `deleteExpired(before)` is a maintenance helper. It is not on
 *     the hot path; the row is not deletable while still relevant.
 *
 * Concurrency notes
 *   * The Postgres adapter uses a `WHERE status = <expected>` guard
 *     on every state change so concurrent consume attempts collapse
 *     to a single winner. The memory adapter relies on single-thread
 *     Node semantics but mirrors the same single-row contract so
 *     tests can rely on identical behavior.
 *   * `consume` returns the updated row only when it transitioned the
 *     row. A `null` from consume is a hard "rejected" signal, not a
 *     "not found" — the caller must not retry.
 *
 * No `Fastify`, `pg`, or `crypto` imports are allowed in this file.
 * That keeps the application layer portable, testable, and free of
 * any I/O concerns.
 */

/**
 * Status values for a step-up challenge.
 *
 * The wire form is the lowercase string. The TypeScript alias is
 * kept narrow so the compiler rejects typos before the test suite
 * does.
 */
export type StepUpChallengeStatus =
    | 'pending'
    | 'approved'
    | 'consumed'
    | 'expired'
    | 'failed';

/**
 * The set of operations a challenge can authorize.
 *
 * Today only `detokenize` is wired in. Sessions 8+ will extend the
 * enumeration (key export, secret reveal, administrative deletion)
 * without touching the schema or the repository — only the commands
 * that own each operation.
 */
export type StepUpOperation = 'detokenize';

/**
 * Domain shape of a step-up challenge.
 *
 * Mirrors the SQL schema 1:1 with snake_case → camelCase translation.
 * Optional fields (`tokenId`, `approvedAt`, `consumedAt`,
 * `verifiedFactorId`, `auditId`, `metadata`) reflect nullable columns.
 */
export interface StepUpChallenge {
    challengeId: string;
    operation: StepUpOperation;
    identityId: string;
    tokenId: string | null;
    requestedBy: string;
    requestedAt: Date;
    expiresAt: Date;
    approvedAt: Date | null;
    consumedAt: Date | null;
    status: StepUpChallengeStatus;
    requiredFactorId: string;
    verifiedFactorId: string | null;
    auditId: string | null;
    metadata: string | null;
}

/**
 * Fields the caller supplies on `createChallenge`. Everything else
 * (timestamps, defaults) is owned by the application command.
 */
export interface CreateStepUpChallengeInput {
    challengeId: string;
    operation: StepUpOperation;
    identityId: string;
    tokenId: string | null;
    requestedBy: string;
    requestedAt: Date;
    expiresAt: Date;
    requiredFactorId: string;
    metadata: string | null;
}

/**
 * Fields the application command supplies when approving a challenge.
 * The repository stamps `approvedAt`; the command supplies the
 * verified factor and audit id.
 */
export interface ApproveStepUpChallengeInput {
    challengeId: string;
    verifiedFactorId: string;
    approvedAt: Date;
    auditId: string | null;
}

/**
 * Repository contract for the step-up challenge aggregate.
 *
 * Implementations: `PostgresStepUpChallengeRepository` (production),
 * `MemoryStepUpChallengeRepository` (test/dev). New adapters must
 * implement every method on this interface.
 */
export interface StepUpChallengeRepository {
    /** Persist a new challenge in `pending` state. */
    create(input: CreateStepUpChallengeInput): Promise<StepUpChallenge>;

    /** Look up a challenge by id. Returns `null` for unknown ids. */
    findById(challengeId: string): Promise<StepUpChallenge | null>;

    /**
     * Transition `pending → approved`. Returns the updated row, or
     * `null` if the row was missing or already past `pending`.
     */
    approve(
        input: ApproveStepUpChallengeInput,
    ): Promise<StepUpChallenge | null>;

    /**
     * Atomic `approved → consumed` transition. Returns the row, or
     * `null` if the row was missing, not `approved`, or already
     * `consumed`. This is the single replay-prevention gate.
     */
    consume(
        challengeId: string,
        consumedAt: Date,
    ): Promise<StepUpChallenge | null>;

    /**
     * Transition `pending → expired`. Returns the row, or `null` if
     * the row was missing or not in `pending` state. Used by the
     * background sweep **and** by the synchronous check performed
     * inside `consume` (so an expired `approved` challenge can also
     * be flipped to `expired`).
     */
    expire(challengeId: string, expiredAt: Date): Promise<StepUpChallenge | null>;

    /**
     * Transition `pending → failed`. Returns the row, or `null` if
     * the row was missing or not in `pending` state.
     */
    fail(challengeId: string, failedAt: Date): Promise<StepUpChallenge | null>;

    /**
     * Delete every row whose `expires_at` is older than `before` and
     * whose status is a terminal state (`consumed`, `expired`,
     * `failed`). Returns the number of rows removed.
     *
     * Pending rows are NEVER deleted — the caller is expected to first
     * transition them to `expired` (via `expire`) before sweeping.
     * This is to defend against a buggy caller that purges live
     * challenges.
     */
    deleteExpired(before: Date): Promise<number>;
}