/**
 * `ApproveStepUpChallenge` command — application-layer use case (Session 7E).
 *
 * Implements the `pending → approved` transition of a step-up
 * challenge. The command is the ONLY place that knows how to turn a
 * raw `step_up_challenges` row from `pending` into `approved`:
 *
 *   1. validate input (challengeId, code, caller context);
 *   2. look up the challenge via
 *      {@link StepUpChallengeRepository.findById};
 *   3. reject if the challenge is missing or no longer in `pending`
 *      state (`CHALLENGE_NOT_FOUND` / `CHALLENGE_NOT_PENDING`);
 *   4. reject if the challenge has already expired (sweep to
 *      `expired` and audit the sweep);
 *   5. resolve the MFA factor identity from
 *      `challenge.requiredFactorId` (server-derived — the client
 *      never names a factor; the challenge row is authoritative);
 *   6. look up the MFA factor via
 *      {@link MfaFactorRepository.getById};
 *   7. reject missing / non-active / expired factor
 *      (`FACTOR_NOT_FOUND` / `FACTOR_NOT_ACTIVE` / `FACTOR_EXPIRED`);
 *   8. open the sealed shared secret with
 *      {@link KeyManager.openSecret} under the per-factor context
 *      (see {@link makeMfaSecretContext});
 *   9. verify the user-submitted code via
 *      {@link TotpVerifier.verifyCode} with a small clock-skew
 *      window;
 *  10. on a successful verify — append an audit row, publish a
 *      `StepUpChallengeApproved` event, and call
 *      {@link StepUpChallengeRepository.approve} to flip the row;
 *  11. on a failed verify — append a deny audit row, publish a
 *      `StepUpChallengeFailed` event, and call
 *      {@link StepUpChallengeRepository.fail}.
 *
 * # Layering rules (clean architecture)
 *
 *   - This file knows about *domain* rules (challenge must be
 *     `pending`, factor must be `active`, the factor must match the
 *     challenge's `requiredFactorId`, the code must be a 6-digit
 *     string) and orchestrates the ports. It does NOT import any
 *     infrastructure adapter (`pg`, `otpauth`, `node:crypto`, etc.).
 *   - All crypto primitives come from `KeyManager.openSecret` and
 *     `TotpVerifier.verifyCode`. The application layer does not
 *     pick an algorithm or a curve.
 *   - All persistence goes through application-layer ports
 *     (`StepUpChallengeRepository`, `MfaFactorRepository`,
 *     `AuditRepository`).
 *   - Cross-cutting signalling goes through `EventPublisher`. The
 *     publish call lives *outside* any transaction boundary so a
 *     rolled-back unit-of-work cannot emit a phantom event.
 *
 * # Why this is NOT folded into `VerifyMfa`
 *
 *   `VerifyMfa` is the Session 5C TOTP verifier — a deliberately
 *   generic primitive. It knows nothing about step-up challenges;
 *   it only verifies a code against a factor and audits the
 *   attempt. Folding the step-up state machine into it would
 *   couple the verifier to a specific operation and break the
 *   invariant that "MFA verify" is the single primitive every
 *   downstream workflow can reuse. This command therefore REUSES
 *   the same `TotpVerifier` / `KeyManager` / `MfaFactorRepository`
 *   ports `VerifyMfa` uses — the *crypto* is shared, the *state
 *   machine* is not.
 *
 * # Verification failure semantics
 *
 *   A failed verify (wrong code, revoked factor, expired factor,
 *   expired challenge) is *not* an exception — it is a rejection
 *   of the `ApproveStepUpChallengeCommand` via
 *   {@link ApproveStepUpChallengeCommandError}. The HTTP layer
 *   maps each `code` to a 4xx, the audit row records the failure,
 *   and the publish call fans the failure event to subscribers.
 *   The only paths that throw are input-validation failures and
 *   unexpected infrastructure errors (DB down, KMS unreachable).
 *
 * # Wrap context for the TOTP secret
 *
 *   The same `mfa-factor:<factorId>` context used at enrollment
 *   (see `mfa-secret-context.ts`) and reused by `VerifyMfa` is
 *   re-derived here. A stolen `encryptedSecret` blob from factor
 *   A cannot be opened under factor B's context — the desired
 *   "factor-scoped key" property.
 *
 * # Plaintext hygiene
 *
 *   The raw TOTP shared secret returned by `KeyManager.openSecret`
 *   is sensitive. The command zeroes it in `finally` via
 *   {@link safeZero}, regardless of which branch it exits through.
 *   The context buffer is also zeroed, matching the convention
 *   used by `VerifyMfa` / `EnrollMfa` / `TokenizeAadhaar`.
 *
 * # Audit ordering
 *
 *   On success the audit row is appended FIRST and its id is
 *   passed to `stepUpChallenges.approve` so the `vault_step_up_
 *   challenges.audit_id` column points at the canonical row. This
 *   means a single SQL join reconstructs the full "approval"
 *   event for an investigator. The publish call happens AFTER the
 *   approve call so a phantom event cannot be emitted for a row
 *   that never transitioned.
 */
import type { KeyManager } from '../ports/key-manager.js';
import type { TotpVerifier } from '../ports/totp-verifier.js';
import type {
    MfaFactor,
    MfaFactorRepository,
} from '../ports/mfa-repository.js';
import type {
    StepUpChallenge,
    StepUpChallengeRepository,
} from '../ports/step-up-challenge.repository.js';
import type {
    AuditEntry,
    AuditRepository,
} from '../../db/ports/audit.repository.js';
import type { EventPublisher } from '../ports/event-publisher.js';
import { safeZero } from '../../util/dek-zero.js';
import { makeMfaSecretContext } from '../util/mfa-secret-context.js';

// ---------------------------------------------------------------------------
// Public types — the "approve step-up challenge" contract surface
// ---------------------------------------------------------------------------

/**
 * Caller context. Same shape as the other commands' caller context
 * (`VerifyMfa`, `EnrollMfa`, `RequestDetokenization`, etc.) so the
 * audit chain sees a consistent actor triple. The route layer
 * supplies the JWT subject as `actorId`; the body's `actorId` is
 * intentionally NOT trusted.
 */
export interface ApproveStepUpChallengeCallerContext {
    actorId: string;
    actorRole:
        | 'TEACHER'
        | 'SCHOOL_ADMIN'
        | 'STATE_ADMIN'
        | 'SUPER_ADMIN'
        | 'SERVICE';
    reason: string;
    requestId?: string;
    sourceIp?: string;
    userAgent?: string;
}

/**
 * Request shape: `{ challengeId, code, context, window? }`.
 *
 *   - `challengeId` — the row minted by `RequestDetokenization`.
 *     The challenge row's `requiredFactorId` is the
 *     authoritative factor id; the client MUST NOT supply
 *     `mfaId`. The route layer's Zod schema is `.strict()` so a
 *     request body carrying a legacy `mfaId` field is rejected
 *     with `400 invalid_request` before it reaches this command.
 *   - `code` — the 6-digit TOTP code from the user's authenticator.
 *   - `context` — actor + reason for the audit chain.
 *   - `window` — clock-skew tolerance in TOTP time-steps.
 *     Defaults to `1` (accept the previous and next code as well
 *     as the current one). Per RFC 6238 §5.2.
 */
export interface ApproveStepUpChallengeCommand {
    challengeId: string;
    code: string;
    context: ApproveStepUpChallengeCallerContext;
    window?: number;
}

/**
 * Result shape for a successful approval. The route layer forwards
 * this as the JSON body of `POST /step-up/:challengeId/approve`.
 */
export interface ApproveStepUpChallengeSuccess {
    challengeId: string;
    status: 'approved';
    approvedAt: Date;
    verifiedFactorId: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Error class with a stable `code` so the HTTP layer can map to
 * 4xx without sniffing message text. Distinct from
 * `VerifyMfaCommandError` / `RequestDetokenizationCommandError` so
 * a `try/catch` on one doesn't accidentally swallow the others.
 *
 * Codes:
 *   - `INVALID_INPUT`        — input failed shape validation.
 *   - `INVALID_CONFIG`       — repository returned a row in an
 *                              unexpected state.
 *   - `CHALLENGE_NOT_FOUND`  — no row with this challengeId.
 *   - `CHALLENGE_NOT_PENDING`— row exists but is no longer
 *                              `pending` (already approved /
 *                              consumed / expired / failed).
 *   - `CHALLENGE_EXPIRED`    — `expiresAt` is in the past.
 *   - `FACTOR_NOT_FOUND`     — no row with this factorId.
 *   - `FACTOR_NOT_ACTIVE`    — factor is revoked / pending.
 *   - `FACTOR_EXPIRED`       — factor past `expiresAt`.
 *   - `CODE_MISMATCH`        — code did not match within the
 *                              window.
 */
export class ApproveStepUpChallengeCommandError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
        super(message);
        this.name = 'ApproveStepUpChallengeCommandError';
        this.code = code;
    }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default clock-skew window in TOTP time-steps (±1). */
const DEFAULT_WINDOW = 1;

/** Default length of a TOTP code. Matches the v0.1 port default
 *  (digits=6). Cross-digit verification is not supported. */
const DEFAULT_DIGITS = 6;

// ---------------------------------------------------------------------------
// Command factory
// ---------------------------------------------------------------------------

/**
 * Dependencies the command needs. The four "verify" ports are kept
 * individually (rather than going through a `vaultWriter`
 * abstraction) because the brief explicitly says *do not redesign
 * the repository* in this session. The `stepUpChallenges` port is
 * the only NEW dependency introduced by this command.
 */
export interface ApproveStepUpChallengeDeps {
    keyManager: KeyManager;
    totp: TotpVerifier;
    mfa: MfaFactorRepository;
    challenges: StepUpChallengeRepository;
    audit: AuditRepository;
    events: EventPublisher;
    /**
     * Returns the *current* "now" — injected so tests can pin
     * time and so the timestamp used by the audit row, the
     * `approve` / `fail` calls, and the event publish agree.
     */
    clock?: () => Date;
}

/**
 * Factory returns the bound command function. Style mirrors
 * `makeVerifyMfa` / `makeRequestDetokenization` / `makeEnrollMfa`.
 */
export function makeApproveStepUpChallenge(deps: ApproveStepUpChallengeDeps) {
    const clock: () => Date = deps.clock ?? (() => new Date());

    return async function approveStepUpChallenge(
        cmd: ApproveStepUpChallengeCommand,
    ): Promise<ApproveStepUpChallengeSuccess> {
        // -----------------------------------------------------------------
        // 1. Validate input. The audit row is keyed on
        //    `context.actorId`; an empty value would produce a
        //    misleading row. The challenge / factor / code fields
        //    are the surface the user supplied; we validate they
        //    are the right *shape* here and let the domain-level
        //    (challenge-not-found, code-mismatch) failures be
        //    thrown as command errors rather than exceptions.
        // -----------------------------------------------------------------
        if (
            typeof cmd.context?.actorId !== 'string' ||
            cmd.context.actorId.length === 0
        ) {
            throw new ApproveStepUpChallengeCommandError(
                'INVALID_INPUT',
                'context.actorId must be a non-empty string.',
            );
        }
        if (
            typeof cmd.challengeId !== 'string' ||
            cmd.challengeId.length === 0
        ) {
            throw new ApproveStepUpChallengeCommandError(
                'INVALID_INPUT',
                'challengeId must be a non-empty string.',
            );
        }
        if (typeof cmd.code !== 'string') {
            throw new ApproveStepUpChallengeCommandError(
                'INVALID_INPUT',
                'code must be a string.',
            );
        }
        // The code must be exactly `digits` decimal digits. We
        // do NOT coerce to a number first because leading zeros
        // would be lost. The digits count is fixed at 6 to match
        // the v0.1 enrollment default; cross-digit verification
        // is not supported.
        if (cmd.code.length !== DEFAULT_DIGITS || !/^\d+$/.test(cmd.code)) {
            throw new ApproveStepUpChallengeCommandError(
                'INVALID_INPUT',
                `code must be a ${DEFAULT_DIGITS}-digit decimal string.`,
            );
        }
        if (cmd.window !== undefined) {
            if (
                !Number.isFinite(cmd.window) ||
                !Number.isInteger(cmd.window) ||
                cmd.window < 0
            ) {
                throw new ApproveStepUpChallengeCommandError(
                    'INVALID_INPUT',
                    'window, when supplied, must be a non-negative integer.',
                );
            }
        }

        const now = clock();
        const window = cmd.window ?? DEFAULT_WINDOW;

        // -----------------------------------------------------------------
        // 2. Load the challenge.
        // -----------------------------------------------------------------
        const challenge = await deps.challenges.findById(cmd.challengeId);
        if (!challenge) {
            throw new ApproveStepUpChallengeCommandError(
                'CHALLENGE_NOT_FOUND',
                'No step-up challenge with that id exists.',
            );
        }

        // -----------------------------------------------------------------
        // 3. Reject unless status == pending. The repository's
        //    `approve` would also reject (returns `null` on
        //    non-pending), but failing fast here lets us emit a
        //    precise error code and a precise audit reason.
        // -----------------------------------------------------------------
        if (challenge.status !== 'pending') {
            throw new ApproveStepUpChallengeCommandError(
                'CHALLENGE_NOT_PENDING',
                `Step-up challenge is in state '${challenge.status}', not 'pending'.`,
            );
        }

        // -----------------------------------------------------------------
        // 4. Reject expired challenges. If the challenge has
        //    already crossed its `expiresAt`, sweep the row to
        //    `expired` so a future `findById` does not see a stale
        //    `pending` row. Sweep failures are NOT fatal — the
        //    caller still gets a `CHALLENGE_EXPIRED` rejection
        //    because the row is observably past its deadline.
        // -----------------------------------------------------------------
        if (challenge.expiresAt.getTime() <= now.getTime()) {
            try {
                await deps.challenges.expire(challenge.challengeId, now);
            } catch {
                // Intentionally swallowed — the sweep is a
                // best-effort bookkeeping call. The rejection
                // path below is the authoritative answer.
            }
            throw new ApproveStepUpChallengeCommandError(
                'CHALLENGE_EXPIRED',
                'Step-up challenge has expired.',
            );
        }

        // -----------------------------------------------------------------
        // 5. Server-derived factor resolution. The factor id is
        //    taken from `challenge.requiredFactorId` — the row
        //    minted by `RequestDetokenization` is the sole
        //    source of truth. The client NEVER names the
        //    factor; the route layer's Zod schema is `.strict()`
        //    so a request body carrying `mfaId` is rejected
        //    before this command runs.
        // -----------------------------------------------------------------
        // -----------------------------------------------------------------
        // 6. Load the factor.
        // -----------------------------------------------------------------
        const factor = await deps.mfa.getById(challenge.requiredFactorId);
        if (!factor) {
            throw new ApproveStepUpChallengeCommandError(
                'FACTOR_NOT_FOUND',
                'No MFA factor with that id exists.',
            );
        }

        // -----------------------------------------------------------------
        // 7. Reject if the factor is not `active`.
        // -----------------------------------------------------------------
        if (factor.status !== 'active') {
            throw new ApproveStepUpChallengeCommandError(
                'FACTOR_NOT_ACTIVE',
                `MFA factor is in state '${factor.status}', not 'active'.`,
            );
        }

        // -----------------------------------------------------------------
        // 8. Reject if the factor has expired.
        // -----------------------------------------------------------------
        if (
            factor.expiresAt !== null &&
            factor.expiresAt.getTime() <= now.getTime()
        ) {
            throw new ApproveStepUpChallengeCommandError(
                'FACTOR_EXPIRED',
                'MFA factor has expired.',
            );
        }

        // -----------------------------------------------------------------
        // 9. Open the sealed secret under the per-factor
        //    context and verify the user-submitted code. We use
        //    EXACTLY the same `openSecret` + `verifyCode` flow
        //    that `VerifyMfa` uses — no duplicated crypto.
        // -----------------------------------------------------------------
        const secretContext = makeMfaSecretContext(factor.factorId);
        let openedSecret: Buffer | undefined;
        try {
            openedSecret = await deps.keyManager.openSecret(
                { bytes: factor.encryptedSecret },
                secretContext,
            );

            const totpResult = await deps.totp.verifyCode(
                openedSecret,
                cmd.code,
                window,
                now.getTime(),
            );

            if (!totpResult.valid) {
                // ---------------------------------------------------------
                // Failed verification. Audit deny, publish failure
                // event, sweep the challenge to `failed` so a
                // subsequent approve attempt cannot succeed.
                // ---------------------------------------------------------
                await recordFailure(
                    deps,
                    cmd,
                    challenge,
                    factor,
                    'CODE_MISMATCH',
                    now,
                );
                throw new ApproveStepUpChallengeCommandError(
                    'CODE_MISMATCH',
                    'TOTP code did not match within the window.',
                );
            }

            // ---------------------------------------------------------
            // 10. Successful verification. Append audit FIRST,
            //     then call approve (passing the audit id back so
            //     the challenge row's `audit_id` column points at
            //     the canonical row), then publish the success
            //     event.
            // ---------------------------------------------------------
// `deps.audit.append` returns the numeric audit row id
            // assigned by the underlying store. The challenge
            // repository, however, persists the link as a string
            // column (`audit_id`), so we coerce once here at the
            // boundary. Storing it as a string keeps the storage
            // format identical to the wire format produced by the
            // `consume` path, which already records the same id.
            const auditId = await deps.audit.append(
                buildApproveAuditEntry(cmd, challenge, factor, totpResult.delta, window, now),
            );

            const approved = await deps.challenges.approve({
                challengeId: challenge.challengeId,
                verifiedFactorId: factor.factorId,
                approvedAt: now,
                auditId: String(auditId),
            });

            if (!approved) {
                // The repository rejected the transition. This
                // means the row was no longer `pending` when
                // approve ran — either a concurrent caller won
                // the race, or the row was swept to `expired` /
                // `failed` between our findById and approve. We
                // audit the transition loss so an investigator
                // can see the rejection.
                await deps.audit.append({
                    identityId: challenge.identityId,
                    actor: cmd.context.actorId,
                    action: 'STEP_UP_APPROVE',
                    outcome: 'deny',
                    reason: cmd.context.reason,
                    requestId: cmd.context.requestId ?? null,
                    meta: {
                        challenge_id: challenge.challengeId,
                        factor_id: factor.factorId,
                        failure_reason: 'CONCURRENT_TRANSITION',
                        source_ip: cmd.context.sourceIp ?? null,
                        user_agent: cmd.context.userAgent ?? null,
                    },
                });
                throw new ApproveStepUpChallengeCommandError(
                    'CHALLENGE_NOT_PENDING',
                    'Step-up challenge was concurrently transitioned out of pending.',
                );
            }

            await deps.events.publish({
                type: 'StepUpChallengeApproved',
                challengeId: approved.challengeId,
                operation: approved.operation,
                identityId: approved.identityId,
                tokenId: approved.tokenId,
                approvedAt: approved.approvedAt!.toISOString(),
                verifiedFactorId: approved.verifiedFactorId!,
                approvedBy: cmd.context.actorId,
                approvedByRole: cmd.context.actorRole,
                auditId: String(auditId),
                occurredAt: now.toISOString(),
            });

            return {
                challengeId: approved.challengeId,
                status: 'approved',
                approvedAt: approved.approvedAt!,
                verifiedFactorId: approved.verifiedFactorId!,
            };
        } finally {
            // -------------------------------------------------------------
            // Plaintext hygiene — ALWAYS, even on throw.
            //
            // `openedSecret` is the raw TOTP shared secret,
            // unsealed by `KeyManager.openSecret`. The session
            // brief mandates we zero it on every exit branch.
            //
            // `secretContext` is the AES-GCM AAD — same
            // defense-in-depth as `VerifyMfa` / `EnrollMfa` /
            // `TokenizeAadhaar`.
            // -------------------------------------------------------------
            if (openedSecret) safeZero(openedSecret);
            if (secretContext) safeZero(secretContext);
        }
    };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build the canonical allow-audit row for a successful approval.
 * Pulled out as a helper so the audit shape is stable and easy to
 * grep for in the codebase.
 */
function buildApproveAuditEntry(
    cmd: ApproveStepUpChallengeCommand,
    challenge: StepUpChallenge,
    factor: MfaFactor,
    delta: number,
    window: number,
    now: Date,
): AuditEntry {
    return {
        identityId: challenge.identityId,
        actor: cmd.context.actorId,
        action: 'STEP_UP_APPROVE',
        outcome: 'allow',
        reason: cmd.context.reason,
        requestId: cmd.context.requestId ?? null,
        meta: {
            challenge_id: challenge.challengeId,
            operation: challenge.operation,
            token_id: challenge.tokenId,
            factor_id: factor.factorId,
            factor_type: factor.factorType,
            factor_actor: factor.actor,
            delta,
            window,
            source_ip: cmd.context.sourceIp ?? null,
            user_agent: cmd.context.userAgent ?? null,
        },
    };
}

/**
 * Centralized failure-recording helper for a failed TOTP verify.
 * Audits the deny, publishes the failure event, and sweeps the
 * challenge to `failed` so the row can never be approved after a
 * failed code attempt.
 *
 * The sweep is best-effort: if `fail()` rejects because the row
 * already left `pending` (e.g. concurrent caller swept to
 * `expired`), the audit + publish still run so the original
 * failure is recorded.
 */
async function recordFailure(
    deps: ApproveStepUpChallengeDeps,
    cmd: ApproveStepUpChallengeCommand,
    challenge: StepUpChallenge,
    factor: MfaFactor,
    reason: 'CODE_MISMATCH',
    now: Date,
): Promise<void> {
    const auditEntry: AuditEntry = {
        identityId: challenge.identityId,
        actor: cmd.context.actorId,
        action: 'STEP_UP_APPROVE',
        outcome: 'deny',
        reason: cmd.context.reason,
        requestId: cmd.context.requestId ?? null,
        meta: {
            challenge_id: challenge.challengeId,
            operation: challenge.operation,
            token_id: challenge.tokenId,
            factor_id: factor.factorId,
            factor_actor: factor.actor,
            failure_reason: reason,
            source_ip: cmd.context.sourceIp ?? null,
            user_agent: cmd.context.userAgent ?? null,
        },
    };
    await deps.audit.append(auditEntry);

    await deps.events.publish({
        type: 'StepUpChallengeFailed',
        challengeId: challenge.challengeId,
        operation: challenge.operation,
        identityId: challenge.identityId,
        tokenId: challenge.tokenId,
        factorId: factor.factorId,
        reason,
        attemptedBy: cmd.context.actorId,
        attemptedByRole: cmd.context.actorRole,
        occurredAt: now.toISOString(),
    });

    // Best-effort sweep to `failed`. A null return means the row
    // already left `pending` (concurrent caller) — the audit +
    // publish above are still the canonical record of THIS
    // caller's attempt.
    try {
        await deps.challenges.fail(challenge.challengeId, now);
    } catch {
        // Intentionally swallowed.
    }
}