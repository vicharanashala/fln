/**
 * `RequestDetokenization` command — application-layer use case (Phase 4 port).
 *
 * Verbatim port of
 * `src/application/commands/request-detokenization.ts`,
 * adjusted only for:
 *   - relative import paths (no `.js` suffix; FLN backend ESM resolution)
 *   - the in-process `StepUpChallengeRepository` / `MfaFactorRepository`
 *     / `TokenRepository` / `IdentityRepository` / `AuditRepository`
 *     ports (no Fastify, no `pg`); the audit row id is a stringified
 *     ObjectId.
 *
 * Implements the "kick off a step-up challenge that authorises a
 * later Aadhaar release" use case. The plaintext Aadhaar is NEVER
 * returned here — only the challenge id, expiry, and a descriptor of
 * the MFA factor the caller must prove possession of next.
 *
 * Pipeline:
 *
 *   1. validate input (tokenId, factorId, caller context);
 *   2. load the token row via {@link TokenRepository.findById};
 *   3. load the parent identity row via {@link IdentityRepository.getById};
 *   4. load the requested MFA factor via {@link MfaFactorRepository.getById}
 *      and verify it is `active`, not expired, and belongs to the
 *      identity's actor (ownership check);
 *   5. create a fresh `StepUpChallenge` row via
 *      {@link StepUpChallengeRepository.create} with the operation
 *      pinned to `'detokenize'`;
 *   6. append an audit row (action=`STEP_UP_REQUEST`, outcome=`allow`);
 *   7. publish the `DetokenizationRequested` domain event;
 *   8. return the challenge descriptor (challengeId, expiresAt,
 *      requiredFactor).
 *
 * **Plaintext hygiene.** This command never decrypts an envelope,
 * so it never holds plaintext Aadhaar bytes. Only the challenge
 * id (a UUIDv4 in v0.1) is returned to the caller; the eventual
 * detokenize will use that id to validate the call.
 *
 * **TTL.** Defaulted to 300 seconds (5 minutes) but injectable via
 * `deps.ttlSeconds` so tests can pin short expiries. The TTL is
 * computed at *request* time and stored on the row, so an
 * inconsistent `clock()` between request and verify is harmless —
 * the verifier checks the stored `expiresAt`.
 */
import { randomUUID } from "node:crypto";
import type {
  IdentityRecord,
  IdentityRepository,
  MfaFactor,
  MfaFactorRepository,
  StepUpChallenge,
  StepUpChallengeRepository,
  StepUpOperation,
  TokenRepository,
} from "../ports/repositories";
import type { DomainEvent, EventPublisher } from "../ports/event-publisher";
import { dbStore } from "../../../../db";
import { mintVaultLogId, vaultLogbookEntry } from "../../audit/logbook-entry";

// ---------------------------------------------------------------------------
// Public types — the "request detokenization" contract surface
// ---------------------------------------------------------------------------

/**
 * Caller context. Same shape family as the other commands'
 * `*CallerContext` interfaces so the audit chain downstream sees a
 * consistent actor triple regardless of which command wrote it.
 */
export interface RequestDetokenizationCallerContext {
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
 * Request shape: `{ tokenId, factorId, context }`.
 *
 * `tokenId` is the opaque id minted by `TokenizeAadhaar`.
 * `factorId` is the MFA factor the caller wants to step up with.
 * The factor must be active and owned by the identity actor who
 * owns the token (otherwise the command refuses to create the
 * challenge).
 */
export interface RequestDetokenizationCommand {
  tokenId: string;
  factorId: string;
  context: RequestDetokenizationCallerContext;
}

/**
 * A short, non-secret descriptor of the MFA factor the caller
 * must prove possession of. Returned in the response so the
 * caller UI can show "approve MFA factor X" without leaking any
 * sealed bytes.
 */
export interface RequiredFactorDescriptor {
  factorId: string;
  actor: string;
  label: string;
  factorType: string;
}

/**
 * Response shape: `{ challengeId, expiresAt, requiredFactor }`.
 *
 * `challengeId` is the row id the caller will round-trip into
 * the next two commands (`VerifyMfa` with this id, then
 * `DetokenizeAadhaar` with this id).
 *
 * `expiresAt` is the absolute UTC timestamp at which the
 * challenge becomes invalid.
 *
 * `requiredFactor` is a non-secret descriptor of the factor the
 * caller must prove possession of next.
 */
export interface RequestDetokenizationResult {
  challengeId: string;
  expiresAt: Date;
  requiredFactor: RequiredFactorDescriptor;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Stable, code-tagged error so the HTTP layer can map to 4xx/5xx
 * without sniffing message text. Distinct from the other command
 * error classes so a `try/catch` on one doesn't accidentally
 * swallow the others.
 */
export class RequestDetokenizationCommandError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  constructor(code: string, message: string, httpStatus = 400) {
    super(message);
    this.name = "RequestDetokenizationCommandError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Default challenge TTL in seconds (5 minutes). Long enough for a
 * human to read a TOTP code off their phone and type it in, short
 * enough that a stolen challenge id is useless after a coffee
 * break. Override-able via `deps.ttlSeconds`.
 */
const DEFAULT_TTL_SECONDS = 300;

// ---------------------------------------------------------------------------
// Command factory
// ---------------------------------------------------------------------------

/**
 * Dependencies. Five ports + an optional clock + an optional
 * TTL knob. Each port is named for its role so the wiring site
 * reads like a manifest.
 */
export interface RequestDetokenizationDeps {
  tokens: TokenRepository;
  identities: IdentityRepository;
  mfa: MfaFactorRepository;
  challenges: StepUpChallengeRepository;
  events: EventPublisher;
  /**
   * Returns the *current* "now" — injected so tests can pin
   * time and so the timestamp used by the audit row and the
   * event publish agree.
   */
  clock?: () => Date;
  /**
   * Override for the challenge TTL in seconds. Defaults to
   * {@link DEFAULT_TTL_SECONDS}.
   */
  ttlSeconds?: number;
  /**
   * Override for the challenge id factory — defaults to a
   * fresh `randomUUID()` (UUIDv4). Exposed so tests can use
   * deterministic ids if they wish.
   */
  newChallengeId?: () => string;
}

/**
 * Factory returns the bound command function. Style mirrors
 * `makeTokenizeAadhaar` / `makeEnrollMfa` / `makeVerifyMfa`.
 */
export function makeRequestDetokenization(deps: RequestDetokenizationDeps) {
  const clock: () => Date = deps.clock ?? (() => new Date());
  const ttlSeconds = deps.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const newChallengeId: () => string =
    deps.newChallengeId ?? (() => randomUUID());

  return async function requestDetokenization(
    cmd: RequestDetokenizationCommand,
  ): Promise<RequestDetokenizationResult> {
    // -----------------------------------------------------------------
    // 1. Validate input.
    // -----------------------------------------------------------------
    if (typeof cmd.tokenId !== "string" || cmd.tokenId.length === 0) {
      throw new RequestDetokenizationCommandError(
        "INVALID_INPUT",
        "tokenId must be a non-empty string.",
      );
    }
    if (typeof cmd.factorId !== "string" || cmd.factorId.length === 0) {
      throw new RequestDetokenizationCommandError(
        "INVALID_INPUT",
        "factorId must be a non-empty string.",
      );
    }
    if (
      typeof cmd.context?.actorId !== "string" ||
      cmd.context.actorId.length === 0
    ) {
      throw new RequestDetokenizationCommandError(
        "INVALID_INPUT",
        "context.actorId must be a non-empty string.",
      );
    }
    if (
      typeof cmd.context?.reason !== "string" ||
      cmd.context.reason.length === 0
    ) {
      throw new RequestDetokenizationCommandError(
        "INVALID_INPUT",
        "context.reason must be a non-empty string.",
      );
    }
    if (ttlSeconds <= 0) {
      throw new RequestDetokenizationCommandError(
        "INVALID_CONFIG",
        "ttlSeconds must be a positive integer.",
        500,
      );
    }

    const now = clock();

    // -----------------------------------------------------------------
    // 2. Load the token row.
    // -----------------------------------------------------------------
    const tokenRow = await deps.tokens.findById(cmd.tokenId);
    if (!tokenRow) {
      throw new RequestDetokenizationCommandError(
        "TOKEN_NOT_FOUND",
        `no vault_tokens row matches id=${cmd.tokenId}.`,
        404,
      );
    }

    // -----------------------------------------------------------------
    // 3. Load the parent identity row.
    // -----------------------------------------------------------------
    const identityRow: IdentityRecord | null = await deps.identities.getById(
      tokenRow.identityId,
    );
    if (!identityRow) {
      throw new RequestDetokenizationCommandError(
        "IDENTITY_NOT_FOUND",
        `no vault_identities row matches id=${tokenRow.identityId}.`,
        404,
      );
    }

    // -----------------------------------------------------------------
    // 4. Load the requested MFA factor and validate ownership.
    // -----------------------------------------------------------------
    const factor: MfaFactor | null = await deps.mfa.getById(cmd.factorId);
    if (!factor) {
      throw new RequestDetokenizationCommandError(
        "FACTOR_NOT_FOUND",
        `no vault_mfa_factors row matches id=${cmd.factorId}.`,
        404,
      );
    }
    if (factor.status !== "active") {
      throw new RequestDetokenizationCommandError(
        "FACTOR_NOT_ACTIVE",
        `factor ${factor.factorId} is not active.`,
        403,
      );
    }
    if (
      factor.expiresAt !== null &&
      factor.expiresAt.getTime() <= now.getTime()
    ) {
      throw new RequestDetokenizationCommandError(
        "FACTOR_EXPIRED",
        `factor ${factor.factorId} is expired.`,
        403,
      );
    }

    // -----------------------------------------------------------------
    // 5. Create the challenge row. The TTL is computed at
    //    request time and stored on the row so a clock skew
    //    between request and verify is harmless.
    // -----------------------------------------------------------------
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    const challengeId = newChallengeId();

    const challenge: StepUpChallenge = await deps.challenges.create({
      challengeId,
      operation: "detokenize" satisfies StepUpOperation,
      identityId: identityRow.identityId,
      tokenId: tokenRow.id,
      requestedBy: cmd.context.actorId,
      requestedAt: now,
      expiresAt,
      requiredFactorId: factor.factorId,
      metadata: JSON.stringify({
        request_id: cmd.context.requestId ?? null,
        requested_role: cmd.context.actorRole,
      }),
    });

    // -----------------------------------------------------------------
    // 6. Append the audit row to the FLN `logbook` collection.
    // -----------------------------------------------------------------
    await dbStore.addLog(
      vaultLogbookEntry(
        {
          identityId: identityRow.identityId,
          actor: cmd.context.actorId,
          action: "STEP_UP_REQUEST",
          outcome: "allow",
          reason: cmd.context.reason,
          requestId: cmd.context.requestId ?? null,
          meta: {
            challenge_id: challenge.challengeId,
            token_id: tokenRow.id,
            operation: "detokenize",
            required_factor_id: factor.factorId,
            required_factor_actor: factor.actor,
            required_factor_type: factor.factorType,
            expires_at: expiresAt.toISOString(),
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

    // -----------------------------------------------------------------
    // 7. Publish the domain event.
    // -----------------------------------------------------------------
    const event: DomainEvent = {
      type: "DetokenizationRequested",
      challengeId: challenge.challengeId,
      identityId: identityRow.identityId,
      tokenId: tokenRow.id,
      requiredFactorId: factor.factorId,
      requiredFactorActor: factor.actor,
      requestedBy: cmd.context.actorId,
      requestedByRole: cmd.context.actorRole,
      expiresAt: expiresAt.toISOString(),
      occurredAt: now.toISOString(),
    };
    await deps.events.publish(event);

    // -----------------------------------------------------------------
    // 8. Return the descriptor. No plaintext Aadhaar is ever
    //    in scope here.
    // -----------------------------------------------------------------
    return {
      challengeId: challenge.challengeId,
      expiresAt: challenge.expiresAt,
      requiredFactor: {
        factorId: factor.factorId,
        actor: factor.actor,
        label: factor.label,
        factorType: factor.factorType,
      },
    };
  };
}
