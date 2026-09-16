/**
 * `DetokenizeAadhaar` command — Phase 3 port.
 *
 * Verbatim port of
 * `src/application/commands/detokenize-aadhaar.ts`,
 * adjusted only for:
 *   - relative import paths (no `.js` suffix; FLN backend ESM resolution)
 *   - the in-process `StepUpChallengeRepository` (no Fastify, no `pg`)
 *   - the audit row is written via `dbStore.addLog` against the FLN
 *     `logbook` collection (issue #406) — there is no separate
 *     `AuditRepository` port anymore. The audit row id is stamped
 *     into the meta and recorded in the challenge row's `audit_id`
 *     column (via the upstream `approveStepUpChallenge` call site)
 *     for chain correlation.
 *
 * This is the *final* leg of the step-up detokenize pipeline. The
 * challenge row is the single source of truth for authorisation:
 *
 *   1. validate `{ challengeId, context }` (non-empty `challengeId`;
 *      non-empty `context.actorId`);
 *   2. load the challenge row (CHALLENGE_NOT_FOUND if missing);
 *   3. stage-one replay / lifecycle checks (cheap, no DB writes):
 *      status='consumed' → CHALLENGE_CONSUMED (409 — replay);
 *      expired          → CHALLENGE_EXPIRED  (410);
 *      status≠approved  → CHALLENGE_NOT_APPROVED (403);
 *      operation≠detok  → CHALLENGE_OPERATION_MISMATCH (403);
 *      subject mismatch → ACTOR_MISMATCH (403);
 *   4. `consume(challengeId, now)` — the canonical replay-protection
 *      primitive. Returns null on race-loss → CHALLENGE_CONSUMED;
 *   5. load token row by `challenge.tokenId` (TOKEN_NOT_FOUND);
 *   6. load identity row by `challenge.identityId || token.identityId`
 *      (IDENTITY_NOT_FOUND);
 *   7. unwrap DEK under `wrap:<identityId>` (UNWRAP_FAILED);
 *   8. decrypt envelope under identity AAD (DECRYPTION_FAILED);
 *   9. validate 12-digit plaintext (INVALID_PAYLOAD);
 *  10. append DETOKENIZE audit row with `meta.challenge_id, token_id,
 *      verified_factor_id`;
 *  11. publish `DetokenizationCompleted` event LAST (so a failed audit
 *      cannot emit a phantom event);
 *  12. zero DEK, plaintext, wrap-context buffers in `finally`.
 *
 * Wrap context reconstruction: `makeDetokenizeWrapContext(identityId)`
 * → `Buffer.from("wrap:" + identityId, "utf8")`, matching the
 * tokenize pipeline. Centralised so a future schema-reconciliation
 * session has a single point of change.
 *
 * Plaintext hygiene: DEK, recovered Aadhaar buffer, and wrap-context
 * buffer are zeroed in `finally` via `safeZero`. The AAD buffer
 * (`identityRow.aad`) is *not* a secret in this session — AES-GCM
 * treats it as authenticity input and the identity row itself stores
 * it — so it is not zeroed (mirroring `TokenizeAadhaar`).
 */

import type {
  IdentityRecord,
  IdentityRepository,
} from '../ports/repositories';
import type { TokenRepository } from '../ports/repositories';
import type { KeyManager } from '../ports/key-manager';
import type { CryptoService } from '../ports/crypto.service';
import type { EventPublisher } from '../ports/event-publisher';
import type { StepUpChallengeRepository } from '../ports/repositories';
import { dbStore } from '../../../../db';
import { safeZero } from '../../util/dek-zero';
import { mintVaultLogId, vaultLogbookEntry } from '../../audit/logbook-entry';

// ---------------------------------------------------------------------------
// Public types — the detokenize command's contract surface
// ---------------------------------------------------------------------------

/**
 * Caller context. Mirrors the other commands so the audit chain
 * downstream sees a consistent actor triple regardless of which
 * command wrote the row.
 *
 * `actorId` is the trusted principal (the route layer projects the
 * verified JWT subject onto this field). `actorRole` is the privileged
 * role under which the caller acts.
 */
export interface DetokenizeCallerContext {
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
  /** Denormalised fields the logbook row carries for display /
   *  filtering. Populated by the route layer from the
   *  authenticated user; left empty for the SERVICE actor. */
  userId?: string;
  schoolId?: string;
  schoolName?: string;
}

/**
 * Request shape: `{ challengeId, context }`.
 *
 * `challengeId` is the opaque id minted by `RequestDetokenization`
 * and bound to a specific `(tokenId, identityId, requestedBy)`
 * tuple. The actor-binding check (`context.actorId ===
 * challenge.requestedBy`) is what stops a caller with
 * `vault:detokenize` scope from consuming someone else's challenge
 * by id.
 */
export interface DetokenizeAadhaarCommand {
  challengeId: string;
  context: DetokenizeCallerContext;
}

/**
 * Response shape — identical surface as the pre-step-up command,
 * so existing callers depending on `{ token, identityId, aadhaar,
 * last4, auditId }` continue to work.
 *
 * `auditId` is the caller-side correlation id (the inbound
 * `X-Request-Id` or a fresh UUID). The vault's append-only audit
 * row id is stamped server-side and is *not* surfaced here.
 */
export interface DetokenizeAadhaarResult {
  token: string;
  identityId: string;
  aadhaar: string;
  last4: string;
  auditId: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Error class with a stable `code` so the HTTP layer can map to
 * 4xx/5xx without sniffing message text. Distinct from the other
 * command error classes so a `try/catch` on one doesn't accidentally
 * swallow the others.
 *
 * Codes:
 *   - `INVALID_INPUT`            — input failed shape validation.
 *   - `CHALLENGE_NOT_FOUND`      — no challenge row matches the id.
 *   - `CHALLENGE_OPERATION_MISMATCH` — challenge row's `operation` is
 *                                     not `detokenize` (defence in
 *                                     depth; the request route
 *                                     enforces this already).
 *   - `CHALLENGE_EXPIRED`        — challenge row's `expiresAt` is in
 *                                 the past.
 *   - `CHALLENGE_NOT_APPROVED`   — challenge row's `status` is not
 *                                 `approved` (still `pending`,
 *                                 explicitly `failed`, etc.).
 *   - `CHALLENGE_CONSUMED`       — `consume()` rejected the row; this
 *                                 is the canonical replay error.
 *   - `ACTOR_MISMATCH`           — caller's verified subject does
 *                                 not match `challenge.requestedBy`.
 *   - `TOKEN_NOT_FOUND`          — challenge references a token row
 *                                 that no longer exists.
 *   - `IDENTITY_NOT_FOUND`       — challenge / token reference a
 *                                 parent identity row that no
 *                                 longer exists.
 *   - `UNWRAP_FAILED`            — KMS / HKDF unwrap failed.
 *   - `DECRYPTION_FAILED`        — AES-GCM tag mismatch.
 *   - `INVALID_PAYLOAD`          — recovered plaintext is not a
 *                                 12-digit Aadhaar.
 */
export class DetokenizeCommandError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'DetokenizeCommandError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Canonical DEK wrap context — must match the tokenize pipeline.
 * Deterministic from `identityId` so any caller with the right scope
 * can unwrap. Centralised so a future schema-reconciliation session
 * has a single point of change.
 */
function makeDetokenizeWrapContext(identityId: string): Buffer {
  return Buffer.from(`wrap:${identityId}`, 'utf8');
}

/**
 * Normalise the `operation` field to a lower-case string so we can
 * compare safely. The repository fills this in as a literal
 * `'detokenize'` today, but we tolerate accidental casing in the
 * test fakes without throwing on the cast.
 */
function isDetokenizeOperation(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.toLowerCase() === 'detokenize';
}

// ---------------------------------------------------------------------------
// Command factory
// ---------------------------------------------------------------------------

/**
 * Dependencies the command needs. Seven ports:
 *
 *   - `KeyManager`     — DEK wrap / unwrap seam
 *   - `CryptoService`  — AES-GCM seam
 *   - `TokenRepository`         — token row reads
 *   - `IdentityRepository`      — identity row reads (for AAD)
 *   - `AuditRepository`         — append-only audit chain
 *   - `EventPublisher`          — domain event fan-out
 *   - `StepUpChallengeRepository` — single source of truth for
 *                                  detokenize authorisation; its
 *                                  `consume()` is the canonical
 *                                  replay-protection primitive.
 *
 *   `clock?` is injected so tests can pin time and so the
 *   timestamps used by the audit row, the event publish, and the
 *   expiry check all agree.
 */
export interface DetokenizeAadhaarDeps {
  keyManager: KeyManager;
  crypto: CryptoService;
  tokens: TokenRepository;
  identities: IdentityRepository;
  events: EventPublisher;
  challenges: StepUpChallengeRepository;
  clock?: () => Date;
}

/**
 * Factory returns the bound command function. Style mirrors
 * `makeTokenizeAadhaar` / `makeEnrollMfa`.
 */
export function makeDetokenizeAadhaar(deps: DetokenizeAadhaarDeps) {
  const clock: () => Date = deps.clock ?? (() => new Date());

  return async function detokenizeAadhaar(
    cmd: DetokenizeAadhaarCommand,
  ): Promise<DetokenizeAadhaarResult> {
    // -----------------------------------------------------------------
    // 1. Validate the input shape. The command short-circuits on
    //    any input that cannot resolve to a valid challenge —
    //    surfacing an explicit INVALID_INPUT keeps the call site's
    //    error handling uniform.
    // -----------------------------------------------------------------
    if (
      typeof cmd.challengeId !== 'string' ||
      cmd.challengeId.length === 0
    ) {
      throw new DetokenizeCommandError(
        'INVALID_INPUT',
        'challengeId must be a non-empty string.',
      );
    }
    if (
      typeof cmd.context?.actorId !== 'string' ||
      cmd.context.actorId.length === 0
    ) {
      throw new DetokenizeCommandError(
        'INVALID_INPUT',
        'context.actorId must be a non-empty string.',
      );
    }

    // -----------------------------------------------------------------
    // 2. Load the challenge row. The repository returns
    //    `StepUpChallenge | null`; a missing row is mapped to
    //    CHALLENGE_NOT_FOUND so the HTTP layer can return 404
    //    without sniffing message text.
    // -----------------------------------------------------------------
    const challenge = await deps.challenges.findById(cmd.challengeId);
    if (!challenge) {
      throw new DetokenizeCommandError(
        'CHALLENGE_NOT_FOUND',
        `no step-up challenge matches id=${cmd.challengeId}.`,
      );
    }

    // -----------------------------------------------------------------
    // 3. STAGE-ONE replay / lifecycle validation — cheap short-
    //    circuit checks that do NOT touch the database for writes.
    //    These run before the canonical consume() CAS for two
    //    reasons:
    //
    //      (a) give callers a precise, *expected* error code for
    //          non-replay failures (expired, wrong actor, wrong
    //          operation, never-approved). The CAS below is
    //          binary — it can only say "you lose" — so a
    //          challenge that has expired but never been consumed
    //          must surface as CHALLENGE_EXPIRED (410), not
    //          CHALLENGE_CONSUMED (409).
    //      (b) keep the canonical CAS gate unambiguous. A
    //          Stage-Two consume() rejection means exactly one
    //          thing: "another caller beat you to it" (or "the
    //          row vanished between findById and consume").
    //
    //    Order matters and is itself part of the contract:
    //      status == 'consumed'  → CHALLENGE_CONSUMED     (409)
    //      expiry in the past    → CHALLENGE_EXPIRED       (410)
    //      status != 'approved'  → CHALLENGE_NOT_APPROVED  (403)
    //      operation mismatch     → CHALLENGE_OPERATION_MISMATCH (403)
    //      subject mismatch      → ACTOR_MISMATCH          (403)
    // -----------------------------------------------------------------
    if (challenge.status === 'consumed') {
      throw new DetokenizeCommandError(
        'CHALLENGE_CONSUMED',
        `challenge ${cmd.challengeId} has already been consumed.`,
      );
    }

    // 4. Expiry. Runs BEFORE the generic status check so an expired
    //    challenge that was never consumed surfaces as
    //    CHALLENGE_EXPIRED (410), not CHALLENGE_NOT_APPROVED (403).
    const now = clock();
    if (challenge.expiresAt.getTime() <= now.getTime()) {
      throw new DetokenizeCommandError(
        'CHALLENGE_EXPIRED',
        `challenge ${cmd.challengeId} expired at ${challenge.expiresAt.toISOString()}.`,
      );
    }

    // 5. Generic status check. Anything that is not `approved` and
    //    is not `consumed` (already handled above) collapses to
    //    CHALLENGE_NOT_APPROVED.
    if (challenge.status !== 'approved') {
      throw new DetokenizeCommandError(
        'CHALLENGE_NOT_APPROVED',
        `challenge ${cmd.challengeId} is not approved (status=${challenge.status}).`,
      );
    }

    // 6. Operation binding. Defence in depth so a future migration
    //    of the request route cannot silently broaden the release
    //    surface. Runs AFTER the status check so an expired /
    //    unapproved row is reported with the more specific
    //    lifecycle code.
    if (!isDetokenizeOperation(challenge.operation)) {
      throw new DetokenizeCommandError(
        'CHALLENGE_OPERATION_MISMATCH',
        `challenge ${cmd.challengeId} is not a detokenize challenge (operation=${challenge.operation ?? 'null'}).`,
      );
    }

    // 7. Actor binding. The route layer is responsible for
    //    projecting the verified JWT subject onto `context.actorId`;
    //    the command enforces it here so the actor-binding
    //    invariant holds even if a future route bypass wires the
    //    command through a non-HTTP seam.
    if (challenge.requestedBy !== cmd.context.actorId) {
      throw new DetokenizeCommandError(
        'ACTOR_MISMATCH',
        `challenge ${cmd.challengeId} was requested by ${challenge.requestedBy}, not ${cmd.context.actorId}.`,
      );
    }

    // -----------------------------------------------------------------
    // 8. Atomically consume the challenge. THIS is the canonical
    //    replay-protection primitive — `consume()` is the only
    //    atomic transition the command relies on. The Mongo adapter
    //    uses `findOneAndUpdate({_id, status: 'approved'}, …)` so
    //    two concurrent consume() calls collapse to exactly one
    //    winner. A failure here means either (a) the row is
    //    missing (race-window: another caller consumed it between
    //    our `findById` and `consume`), or (b) the row is in a
    //    state that does not permit the transition. Both surface
    //    as CHALLENGE_CONSUMED (409).
    // -----------------------------------------------------------------
    const consumed = await deps.challenges.consume(cmd.challengeId, now);
    if (!consumed) {
      throw new DetokenizeCommandError(
        'CHALLENGE_CONSUMED',
        `challenge ${cmd.challengeId} has already been consumed.`,
      );
    }

    // -----------------------------------------------------------------
    // 9. Load the token row by id. A missing row is mapped to
    //    TOKEN_NOT_FOUND (404) — a logical impossibility after the
    //    request route minted a challenge that pinned `tokenId`,
    //    but a useful failure mode if the tokens and challenges
    //    collections ever drift (e.g. a future retention job).
    // -----------------------------------------------------------------
    if (
      typeof challenge.tokenId !== 'string' ||
      challenge.tokenId.length === 0
    ) {
      throw new DetokenizeCommandError(
        'TOKEN_NOT_FOUND',
        `challenge ${cmd.challengeId} does not pin a tokenId.`,
      );
    }
    const tokenRow = await deps.tokens.findById(challenge.tokenId);
    if (!tokenRow) {
      throw new DetokenizeCommandError(
        'TOKEN_NOT_FOUND',
        `no vault_tokens row matches id=${challenge.tokenId}.`,
      );
    }

    // -----------------------------------------------------------------
    // 10. Load the parent identity row. The identity row carries
    //     the AAD the envelope's GCM tag was bound to at tokenize
    //     time. Identity is keyed off `challenge.identityId` if
    //     the request route populated it (it always does, by
    //     construction — the `RequestDetokenization` command
    //     writes both fields); we fall back to
    //     `tokenRow.identityId` for legacy challenge rows and
    //     for adapter round-trip safety.
    // -----------------------------------------------------------------
    const identityKey =
      typeof challenge.identityId === 'string' &&
      challenge.identityId.length > 0
        ? challenge.identityId
        : tokenRow.identityId;
    const identityRow: IdentityRecord | null = await deps.identities.getById(
      identityKey,
    );
    if (!identityRow) {
      throw new DetokenizeCommandError(
        'IDENTITY_NOT_FOUND',
        `no vault_identities row matches id=${identityKey}.`,
      );
    }

    // -----------------------------------------------------------------
    // 11-15. Buffers that hold plaintext or sensitive context are
    //         declared up-front so the `finally` block can zero
    //         them regardless of which branch we exit through.
    //
    //   `dek`         — unwrapped DEK from `KeyManager.unwrapDataKey`.
    //   `aadhaarBuf`  — 12-digit plaintext recovered from the envelope.
    //   `wrapContext` — deterministically reconstructed context
    //                   under which the DEK is unwrapped.
    //
    //   The AAD buffer (`identityRow.aad`) is *not* a secret — it is
    //   the row-binding tuple stored on the identity row itself,
    //   and AES-GCM only treats it as authenticity input. We do
    //   not zero it (mirroring `TokenizeAadhaar` for `tokenAad`).
    // -----------------------------------------------------------------
    const wrapContext = makeDetokenizeWrapContext(identityRow.identityId);

    // Caller-side correlation id echoed in the response. The
    // vault's append-only audit row id is stamped server-side and
    // is not surfaced here.
    const auditId =
      cmd.context.requestId && cmd.context.requestId.length > 0
        ? cmd.context.requestId
        : `detok-${tokenRow.id.slice(0, 8)}-${now.getTime().toString(36)}`;

    let dek: Buffer | undefined;
    let aadhaarBuf: Buffer | undefined;
    try {
      // -------------------------------------------------------------
      // 11. Unwrap the DEK. The wrap context is reconstructed from
      //     the identity row. The `KeyManager` adapter throws on
      //     a context mismatch or tampered bytes; we surface that
      //     as UNWRAP_FAILED so the HTTP layer can map to 5xx.
      // -------------------------------------------------------------
      try {
        dek = await deps.keyManager.unwrapDataKey(
          { bytes: tokenRow.wrappedDek },
          wrapContext,
        );
      } catch (err) {
        throw new DetokenizeCommandError(
          'UNWRAP_FAILED',
          `failed to unwrap DEK: ${(err as Error).message}`,
        );
      }

      // -------------------------------------------------------------
      // 12. Decrypt the envelope. AES-GCM throws on tag mismatch
      //     (wrong AAD, tampered ciphertext, wrong key) — surface
      //     as DECRYPTION_FAILED with the same reasoning as
      //     UNWRAP_FAILED.
      // -------------------------------------------------------------
      try {
        aadhaarBuf = await deps.crypto.decrypt(
          dek,
          {
            ciphertext: tokenRow.ciphertext,
            iv: tokenRow.iv,
            authTag: tokenRow.authTag,
          },
          identityRow.aad,
        );
      } catch (err) {
        throw new DetokenizeCommandError(
          'DECRYPTION_FAILED',
          `failed to decrypt envelope: ${(err as Error).message}`,
        );
      }

      // -------------------------------------------------------------
      // 13. Validate the recovered plaintext is a 12-digit
      //     Aadhaar. The `TokenizeAadhaar` pipeline rejects any
      //     non-12-digit input before encrypting, so a successful
      //     decrypt that yields something else would indicate a
      //     corrupted row. Surface as INVALID_PAYLOAD.
      // -------------------------------------------------------------
      const aadhaar = aadhaarBuf.toString('utf8');
      if (!/^\d{12}$/.test(aadhaar)) {
        throw new DetokenizeCommandError(
          'INVALID_PAYLOAD',
          'recovered plaintext is not a 12-digit Aadhaar.',
        );
      }
      const last4 = aadhaar.slice(-4);

      // -------------------------------------------------------------
      // 14. Append the audit row. Action is `DETOKENIZE`, outcome
      //     is `allow`. The meta block carries the actor context,
      //     the originating challenge id, the verified factor id
      //     (so the approval can be cross-referenced), and the
      //     originating token's id.
      //
      //     `verifiedFactorId` is optional on the challenge row —
      //     older or memory-fake challenges may not surface it.
      //     We omit it from `meta` if absent so the audit row
      //     stays faithful.
      // -------------------------------------------------------------
      const verifiedFactorId =
        typeof challenge.verifiedFactorId === 'string' &&
        challenge.verifiedFactorId.length > 0
          ? challenge.verifiedFactorId
          : null;

      // Per issue #406, the audit sink is the FLN `logbook`
      // collection (via `dbStore.addLog`), not a separate
      // `vault_audit_log` table. The mapping helper shapes
      // the `LogEntry` and strips any plaintext Aadhaar
      // defensively, even though no field here ever carries it.
      try {
        await dbStore.addLog(
          vaultLogbookEntry(
            {
              identityId: identityRow.identityId,
              actor: cmd.context.actorId,
              action: 'DETOKENIZE',
              outcome: 'allow',
              reason: cmd.context.reason,
              requestId: cmd.context.requestId ?? null,
              meta: {
                challenge_id: challenge.challengeId,
                token_id: tokenRow.id,
                actor_role: cmd.context.actorRole,
                key_version: identityRow.keyVersion,
                pepper_version: identityRow.pepperVersion,
                algorithm: tokenRow.algorithm,
                verified_factor_id: verifiedFactorId,
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
      } catch (auditErr) {
        // Same posture as the pre-step-up command: re-throw so
        // the runtime logger can pick it up, but the plaintext
        // is already in the caller's hands from the crypto step
        // above. The contract is "best-effort audit"; v0.1
        // surfaces this via the standard error path and leaves
        // stronger guarantees to a future session.
        throw auditErr;
      }

      // -------------------------------------------------------------
      // 15. Publish the domain event AFTER the audit append. The
      //     publish is the last step so a failed audit earlier in
      //     the chain does not produce a phantom
      //     `DetokenizationCompleted` event. The event payload
      //     carries the same correlation fields (challengeId,
      //     verifiedFactorId) so downstream subscribers can
      //     re-bind the release to the challenge that authorised
      //     it.
      // -------------------------------------------------------------
      await deps.events.publish({
        type: 'DetokenizationCompleted',
        challengeId: challenge.challengeId,
        tokenId: tokenRow.id,
        identityId: identityRow.identityId,
        last4,
        actorId: cmd.context.actorId,
        actorRole: cmd.context.actorRole,
        verifiedFactorId,
        occurredAt: now.toISOString(),
      } as unknown as Parameters<EventPublisher['publish']>[0]);

      return {
        token: tokenRow.id,
        identityId: identityRow.identityId,
        aadhaar,
        last4,
        auditId,
      };
    } finally {
      // -------------------------------------------------------------
      // Plaintext hygiene — ALWAYS, even on throw.
      // -------------------------------------------------------------
      if (dek) safeZero(dek);
      if (aadhaarBuf) safeZero(aadhaarBuf);
      safeZero(wrapContext);
    }
  };
}
