/**
 * `ApproveStepUpChallenge` command — application-layer use case (Phase 4 port).
 *
 * Verbatim port of
 * `src/application/commands/approve-step-up-challenge.ts`,
 * adjusted only for:
 *   - relative import paths (no `.js` suffix; FLN backend ESM resolution)
 *   - the in-process `StepUpChallengeRepository` / `MfaFactorRepository`
 *     / `AuditRepository` ports (no Fastify, no `pg`); the audit row
 *     id is a stringified ObjectId (not a Postgres BIGSERIAL).
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
 * **Verification failure semantics.** A failed verify (wrong code,
 * revoked factor, expired factor, expired challenge) is *not* an
 * exception — it is a rejection of the `ApproveStepUpChallengeCommand`
 * via {@link ApproveStepUpChallengeCommandError}. The HTTP layer
 * maps each `code` to a 4xx, the audit row records the failure,
 * and the publish call fans the failure event to subscribers.
 *
 * **Wrap context for the TOTP secret.** The same
 * `mfa-factor:<factorId>` context used at enrollment (see
 * `application/util/mfa-secret-context.ts`) and reused by `VerifyMfa`
 * is re-derived here.
 *
 * **Plaintext hygiene.** The raw TOTP shared secret returned by
 * `KeyManager.openSecret` is sensitive. The command zeroes it in
 * `finally` via {@link safeZero}, regardless of which branch it
 * exits through. The context buffer is also zeroed.
 *
 * **Audit ordering.** On success the audit row is appended FIRST
 * and its id is passed to `stepUpChallenges.approve` so the
 * `vault_step_up_challenges.audit_id` column points at the
 * canonical row. The publish call happens AFTER the approve call
 * so a phantom event cannot be emitted for a row that never
 * transitioned.
 */
import type { KeyManager } from "../ports/key-manager";
import type { TotpVerifier } from "../ports/totp-verifier";
import type {
  MfaFactor,
  MfaFactorRepository,
  StepUpChallenge,
  StepUpChallengeRepository,
} from "../ports/repositories";
import type { EventPublisher } from "../ports/event-publisher";
import { dbStore } from "../../../../db";
import { safeZero } from "../../util/dek-zero";
import { makeMfaSecretContext } from "../util/mfa-secret-context";
import {
  mintVaultLogId,
  vaultLogbookEntry,
  type VaultAuditInput,
} from "../../audit/logbook-entry";

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
    | "TEACHER"
    | "SCHOOL_ADMIN"
    | "STATE_ADMIN"
    | "SUPER_ADMIN"
    | "SERVICE";
  reason: string;
  requestId?: string;
  sourceIp?: string;
  userAgent?: string;
  /** Denormalised fields the logbook row carries for display /
   *  filtering. Populated by the route layer from the
   *  authenticated user; left empty for the SERVICE actor. */
  userId?: string;
  schoolId?: string;
  schoolName?: string;
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
  status: "approved";
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
    this.name = "ApproveStepUpChallengeCommandError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Default clock-skew window in TOTP time-steps (±3). With the default
 * 30s period this gives a ±90s acceptance window — long enough for a
 * human to unlock their phone, open the authenticator, and type the
 * code without racing the next code rotation. Production deployments
 * can tighten this via the `window` field on the request body.
 */
const DEFAULT_WINDOW = 3;

// ---------------------------------------------------------------------------
// Accepted TOTP code lengths.
//
// The freshly-minted default is 6 digits (see
// `infrastructure/mfa/totp-verifier.ts:DEFAULT_DIGITS`) but this
// command also accepts 8-digit codes for factors enrolled before the
// default flipped — they carry `digits: 8` in their row, the
// per-factor `meta.digits` is read downstream at
// `buildTotpForVerify` time, and forcing a re-enroll would be
// unnecessary user friction. Cross-digit verification (e.g. a
// 6-digit code against an 8-digit factor) is rejected: the row
// drives the validator's digit count, the input must match.
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
    // 1. Validate input.
    // -----------------------------------------------------------------
    if (
      typeof cmd.context?.actorId !== "string" ||
      cmd.context.actorId.length === 0
    ) {
      throw new ApproveStepUpChallengeCommandError(
        "INVALID_INPUT",
        "context.actorId must be a non-empty string.",
      );
    }
    if (
      typeof cmd.challengeId !== "string" ||
      cmd.challengeId.length === 0
    ) {
      throw new ApproveStepUpChallengeCommandError(
        "INVALID_INPUT",
        "challengeId must be a non-empty string.",
      );
    }
    if (typeof cmd.code !== "string") {
      throw new ApproveStepUpChallengeCommandError(
        "INVALID_INPUT",
        "code must be a string.",
      );
    }
    // Accept 6 OR 8 digit codes. The freshly-minted default is
    // 6 digits (matching the UI's "6-digit code" label). Factors
    // enrolled before the default flipped carry `digits: 8` and
    // must keep working without forcing the user to revoke +
    // re-enroll. The actual TOTP validation downstream reads the
    // per-factor `meta.digits` to construct the `otpauth.TOTP`,
    // so the validation itself uses whatever the row says.
    if (cmd.code.length !== 6 && cmd.code.length !== 8) {
      throw new ApproveStepUpChallengeCommandError(
        "INVALID_INPUT",
        "code must be a 6- or 8-digit decimal string.",
      );
    }
    if (!/^\d+$/.test(cmd.code)) {
      throw new ApproveStepUpChallengeCommandError(
        "INVALID_INPUT",
        "code must be a 6- or 8-digit decimal string.",
      );
    }
    if (cmd.window !== undefined) {
      if (
        !Number.isFinite(cmd.window) ||
        !Number.isInteger(cmd.window) ||
        cmd.window < 0
      ) {
        throw new ApproveStepUpChallengeCommandError(
          "INVALID_INPUT",
          "window, when supplied, must be a non-negative integer.",
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
        "CHALLENGE_NOT_FOUND",
        "No step-up challenge with that id exists.",
      );
    }

    // -----------------------------------------------------------------
    // 3. Reject unless status == pending.
    // -----------------------------------------------------------------
    if (challenge.status !== "pending") {
      throw new ApproveStepUpChallengeCommandError(
        "CHALLENGE_NOT_PENDING",
        `Step-up challenge is in state '${challenge.status}', not 'pending'.`,
      );
    }

    // -----------------------------------------------------------------
    // 4. Reject expired challenges. If the challenge has
    //    already crossed its `expiresAt`, sweep the row to
    //    `expired` so a future `findById` does not see a stale
    //    `pending` row.
    // -----------------------------------------------------------------
    if (challenge.expiresAt.getTime() <= now.getTime()) {
      try {
        await deps.challenges.expire(challenge.challengeId, now);
      } catch {
        // Best-effort — the rejection below is authoritative.
      }
      throw new ApproveStepUpChallengeCommandError(
        "CHALLENGE_EXPIRED",
        "Step-up challenge has expired.",
      );
    }

    // -----------------------------------------------------------------
    // 5/6. Server-derived factor resolution. The factor id is
    //      taken from `challenge.requiredFactorId` — the row
    //      minted by `RequestDetokenization` is the sole
    //      source of truth. The client NEVER names the factor.
    // -----------------------------------------------------------------
    const factor = await deps.mfa.getById(challenge.requiredFactorId);
    if (!factor) {
      throw new ApproveStepUpChallengeCommandError(
        "FACTOR_NOT_FOUND",
        "No MFA factor with that id exists.",
      );
    }

    // -----------------------------------------------------------------
    // 7. Reject if the factor is not `active`.
    // -----------------------------------------------------------------
    if (factor.status !== "active") {
      throw new ApproveStepUpChallengeCommandError(
        "FACTOR_NOT_ACTIVE",
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
        "FACTOR_EXPIRED",
        "MFA factor has expired.",
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
          "CODE_MISMATCH",
          now,
        );
        throw new ApproveStepUpChallengeCommandError(
          "CODE_MISMATCH",
          "TOTP code did not match within the window.",
        );
      }

      // ---------------------------------------------------------
      // 10. Successful verification. Append audit FIRST,
      //     then call approve (passing the audit id back so
      //     the challenge row's `audit_id` column points at
      //     the canonical row), then publish the success
      //     event.
      // ---------------------------------------------------------
      // Per issue #406, the audit row is the FLN `logbook`
      // collection's row. The synthetic `vaultlog_...` id
      // doubles as the challenge row's `audit_id` link, so
      // an analyst can pivot from the logbook row to the
      // challenge that approved it. We mint the id BEFORE
      // writing the row so we know the link value even if
      // the write fails; the write failure itself surfaces
      // as the caller's exception.
      const auditId = mintVaultLogId(now);
      await dbStore.addLog(
        vaultLogbookEntry(
          buildApproveAuditEntry(cmd, challenge, factor, totpResult.delta, window, now),
          {
            userId: cmd.context.userId ?? '',
            schoolId: cmd.context.schoolId ?? '',
            schoolName: cmd.context.schoolName ?? '',
            actorRole: cmd.context.actorRole,
          },
          auditId,
          now,
        ),
      );

      const approved = await deps.challenges.approve({
        challengeId: challenge.challengeId,
        verifiedFactorId: factor.factorId,
        approvedAt: now,
        auditId,
      });

      if (!approved) {
        // The repository rejected the transition. This
        // means the row was no longer `pending` when
        // approve ran.
        await dbStore.addLog(
          vaultLogbookEntry(
            {
              identityId: challenge.identityId,
              actor: cmd.context.actorId,
              action: "STEP_UP_APPROVE",
              outcome: "deny",
              reason: cmd.context.reason,
              requestId: cmd.context.requestId ?? null,
              meta: {
                challenge_id: challenge.challengeId,
                factor_id: factor.factorId,
                failure_reason: "CONCURRENT_TRANSITION",
                source_ip: cmd.context.sourceIp ?? null,
                user_agent: cmd.context.userAgent ?? null,
              },
            },
            {
              userId: cmd.context.userId ?? '',
              schoolId: cmd.context.schoolId ?? '',
              schoolName: cmd.context.schoolName ?? '',
              actorRole: cmd.context.actorRole,
            },
            mintVaultLogId(now),
            now,
          ),
        );
        throw new ApproveStepUpChallengeCommandError(
          "CHALLENGE_NOT_PENDING",
          "Step-up challenge was concurrently transitioned out of pending.",
        );
      }

      await deps.events.publish({
        type: "StepUpChallengeApproved",
        challengeId: approved.challengeId,
        operation: approved.operation,
        identityId: approved.identityId,
        tokenId: approved.tokenId,
        approvedAt: approved.approvedAt!.toISOString(),
        verifiedFactorId: approved.verifiedFactorId!,
        approvedBy: cmd.context.actorId,
        approvedByRole: cmd.context.actorRole,
        auditId,
        occurredAt: now.toISOString(),
      });

      return {
        challengeId: approved.challengeId,
        status: "approved",
        approvedAt: approved.approvedAt!,
        verifiedFactorId: approved.verifiedFactorId!,
      };
    } finally {
      // -------------------------------------------------------------
      // Plaintext hygiene — ALWAYS, even on throw.
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
): VaultAuditInput {
  return {
    identityId: challenge.identityId,
    actor: cmd.context.actorId,
    action: "STEP_UP_APPROVE",
    outcome: "allow",
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
 */
async function recordFailure(
  deps: ApproveStepUpChallengeDeps,
  cmd: ApproveStepUpChallengeCommand,
  challenge: StepUpChallenge,
  factor: MfaFactor,
  reason: "CODE_MISMATCH",
  now: Date,
): Promise<void> {
  await dbStore.addLog(
    vaultLogbookEntry(
      {
        identityId: challenge.identityId,
        actor: cmd.context.actorId,
        action: "STEP_UP_APPROVE",
        outcome: "deny",
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
      },
      {
        userId: cmd.context.userId ?? '',
        schoolId: cmd.context.schoolId ?? '',
        schoolName: cmd.context.schoolName ?? '',
        actorRole: cmd.context.actorRole,
      },
      mintVaultLogId(now),
      now,
    ),
  );

  await deps.events.publish({
    type: "StepUpChallengeFailed",
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

  // Best-effort sweep to `failed`.
  try {
    await deps.challenges.fail(challenge.challengeId, now);
  } catch {
    // Intentionally swallowed.
  }
}
