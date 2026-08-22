/**
 * `DetokenizeAadhaar` command — Session 7E release step.
 *
 * This command implements the *final* leg of the step-up detokenize
 * pipeline that began in Session 5 (request → MFA approval →
 * release). Before this session, this command still accepted a raw
 * `token` id and silently bypassed the `StepUpChallenge` row,
 * which meant:
 *
 *   - anyone with `vault:detokenize` scope could decrypt plaintext
 *     without ever having gone through `POST /v1/detokenize/request`
 *     or `POST /v1/detokenize/step-up/:id/approve`;
 *   - replay protection, approval enforcement, expiry, and actor
 *     binding were all bypassed because the challenge row was
 *     never consulted.
 *
 * This rewrite makes the challenge the single source of truth for
 * authorisation. The command now:
 *
 *   1. validates `{ challengeId, context }` (non-empty
 *      `challengeId`; non-empty `context.actorId`);
 *   2. loads the `StepUpChallenge` row (CHALLENGE_NOT_FOUND if
 *      absent);
 *   3. verifies the challenge's `operation === 'detokenize'`
 *      (CHALLENGE_OPERATION_MISMATCH);
 *   4. verifies the challenge is not expired
 *      (CHALLENGE_EXPIRED);
 *   5. verifies the challenge status is `approved`
 *      (CHALLENGE_NOT_APPROVED);
 *   6. verifies `context.subject === challenge.requestedBy`
 *      (ACTOR_MISMATCH);
 *   7. **atomically consumes** the challenge via
 *      `StepUpChallengeRepository.consume(challengeId)`. This is
 *      the canonical replay-protection primitive — it returns the
 *      row only when the transition `approved → consumed` is
 *      successful, and rejects otherwise (CHALLENGE_CONSUMED).
 *      Replay protection now flows from this single transition;
 *      no `consume()` success means no plaintext.
 *   8. loads the token row by `challenge.tokenId` (any id format
 *      mintable by `TokenizeAadhaar` works);
 *   9. loads the parent identity row by
 *      `challenge.identityId || token.identityId` to recover the
 *      AAD bound at tokenize time;
 *  10. unwraps the DEK under the canonical wrap context
 *      (`wrap:<identityId>`, matching the tokenize pipeline);
 *  11. decrypts the envelope under the recovered AAD (UNWRAP_FAILED
 *      / DECRYPTION_FAILED on crypto failure);
 *  12. validates the recovered plaintext is a 12-digit Aadhaar
 *      (INVALID_PAYLOAD);
 *  13. appends a DETOKENIZE audit row whose `meta` carries the
 *      `challenge_id` and `verified_factor_id`;
 *  14. publishes a `DetokenizationCompleted` event LAST (so a
 *      failed audit earlier in the chain cannot produce a phantom
 *      event), carrying the same correlation fields;
 *  15. zeroizes DEK + plaintext + wrap-context buffers in
 *      `finally`, regardless of which branch we exit through.
 *
 * # Wrap context (schema reconciliation note, unchanged)
 *
 * The wrap context is reconstructed deterministically from
 * `identityId` (`wrap:<identityId>`, bytes), matching the
 * `TokenizeAadhaar` post-reconciliation convention. Centralised in
 * `makeDetokenizeWrapContext(identityId)` so a future
 * schema-reconciliation session has a single point of change.
 *
 * # Layering (clean architecture, unchanged)
 *
 *   - All persistence goes through the existing application
 *     ports. The new port (`StepUpChallengeRepository`) is added
 *     to the deps bag alongside the existing five; the
 *     repository's `consume()` is the *only* atomic transition.
 *   - The application layer does not pick a cipher or a curve;
 *     `KeyManager.unwrapDataKey` and `CryptoService.decrypt` are
 *     still the seams.
 *   - The command does not import `fastify`. The HTTP layer is the
 *     only place that knows about the route shape.
 *
 * # Plaintext hygiene (unchanged)
 *
 * The DEK, the recovered Aadhaar buffer, and the wrap-context
 * buffer are zeroed in `finally` via {@link safeZero}. The AAD
 * buffer (`identityRow.aad`) is *not* a secret in this session —
 * AES-GCM treats it as authenticity input and the identity row
 * itself stores it — so it is not zeroed (matching `TokenizeAadhaar`).
 */

import type { TokenRepository } from '../../db/ports/token.repository.js';
import type {
    IdentityRecord,
    IdentityRepository,
} from '../../db/ports/identity.repository.js';
import type {
    AuditEntry,
    AuditRepository,
} from '../../db/ports/audit.repository.js';
import type { KeyManager } from '../ports/key-manager.js';
import type { CryptoService } from '../ports/crypto.service.js';
import type { EventPublisher } from '../ports/event-publisher.js';
import type { StepUpChallengeRepository } from '../ports/step-up-challenge.repository.js';
import { safeZero } from '../../util/dek-zero.js';

// ---------------------------------------------------------------------------
// Public types — the detokenize command's contract surface
// ---------------------------------------------------------------------------

/**
 * Caller context. Mirrors the other commands so the audit chain
 * downstream sees a consistent actor triple regardless of which
 * command wrote the row.
 *
 * `subject` is the verified JWT subject (the trusted principal);
 * the route layer is responsible for projecting it onto this
 * shape. `actorId` is the audit-log id; `actorRole` is the
 * privileged role under which the caller acts.
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
}

/**
 * Request shape: `{ challengeId, context }`.
 *
 * `challengeId` is the opaque id minted by `RequestDetokenization`
 * and bound to a specific `(tokenId, identityId, requestedBy)`
 * tuple. The actor-binding check (`context.subject ===
 * challenge.requestedBy`) is what stops a caller with
 * `vault:detokenize` scope from consuming someone else's
 * challenge by id.
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
 * The codes are:
 *   - `INVALID_INPUT`            — input failed shape validation
 *                                 (empty challengeId, empty actorId).
 *   - `CHALLENGE_NOT_FOUND`      — no challenge row matches the id.
 *   - `CHALLENGE_OPERATION_MISMATCH`
 *                               — challenge row's `operation` is
 *                                 not `detokenize` (defence in depth;
 *                                 the request route enforces this
 *                                 already).
 *   - `CHALLENGE_EXPIRED`        — challenge row's `expiresAt` is
 *                                 in the past.
 *   - `CHALLENGE_NOT_APPROVED`   — challenge row's `status` is not
 *                                 `approved` (still `pending`,
 *                                 already `consumed`, etc., though
 *                                 `consumed` is mapped to its own
 *                                 code by `consume()`).
 *   - `CHALLENGE_CONSUMED`       — `consume()` rejected the row;
 *                                 this is the canonical replay
 *                                 error.
 *   - `ACTOR_MISMATCH`           — caller's verified subject does
 *                                 not match `challenge.requestedBy`.
 *   - `TOKEN_NOT_FOUND`          — challenge references a token row
 *                                 that no longer exists (logical FK
 *                                 drift).
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
 * Deterministic from `identityId` so any caller with the right
 * scope can unwrap. Centralised here so a future schema-
 * reconciliation session has a single point of change.
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
 * Dependencies the command needs. Six ports:
 *
 *   - existing five (carried over verbatim from Session 5C):
 *     `KeyManager`, `CryptoService`, `TokenRepository`,
 *     `IdentityRepository`, `AuditRepository`, `EventPublisher`,
 *     `clock?`.
 *   - new this session: `StepUpChallengeRepository`. The
 *     `consume()` call on this port is the *only* atomic
 *     transition we rely on for replay protection.
 */
export interface DetokenizeAadhaarDeps {
    keyManager: KeyManager;
    crypto: CryptoService;
    tokens: TokenRepository;
    identities: IdentityRepository;
    audit: AuditRepository;
    events: EventPublisher;
    /**
     * Session 7E — the step-up challenge repository. Required.
     * `consume(challengeId)` is the canonical replay-protection
     * primitive; the command does not decrypt until it succeeds.
     */
    challenges: StepUpChallengeRepository;
    /**
     * Returns the *current* "now" — injected so tests can pin
     * time and so the timestamps used by the audit row, the event
     * publish, and the expiry check all agree.
     */
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
        //    surfacing an explicit INVALID_INPUT keeps the call
        //    site's error handling uniform.
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
        //    `StepUpChallengeRow | null`; a missing row is mapped
        //    to CHALLENGE_NOT_FOUND so the HTTP layer can return
        //    404 without sniffing message text.
        // -----------------------------------------------------------------
        const challenge = await deps.challenges.findById(cmd.challengeId);
        if (!challenge) {
            throw new DetokenizeCommandError(
                'CHALLENGE_NOT_FOUND',
                `no step-up challenge matches id=${cmd.challengeId}.`,
            );
        }

        // -----------------------------------------------------------------
        // 3. STAGE-ONE replay / lifecycle validation — cheap
        //    short-circuit checks that do NOT touch the database
        //    for writes. These run before the canonical consume()
        //    CAS for two reasons:
        //
        //      (a) give callers a precise, *expected* error code
        //          for non-replay failures (expired, wrong actor,
        //          wrong operation, never-approved). The CAS below
        //          is binary — it can only say "you lose" — so a
        //          challenge that has expired but never been
        //          consumed must surface as CHALLENGE_EXPIRED
        //          (410), not CHALLENGE_CONSUMED (409). A challenge
        //          that was minted for a different operation must
        //          surface as CHALLENGE_OPERATION_MISMATCH (403),
        //          not CHALLENGE_CONSUMED (409).
        //
        //      (b) keep the canonical CAS gate unambiguous. The
        //          Stage-Two consume() rejection below means
        //          exactly one thing: "another caller beat you to
        //          it" (or "the row vanished between findById and
        //          consume"). Anything else has already been ruled
        //          out by Stage One.
        //
        //    The order matters and is itself part of the contract:
        //
        //      status == 'consumed'  → CHALLENGE_CONSUMED     (409)
        //        (a row that *was* approved but is now consumed is
        //         observably a replay attempt — surface it as
        //         such, NOT as CHALLENGE_NOT_APPROVED)
        //      expiry in the past    → CHALLENGE_EXPIRED       (410)
        //      status != 'approved'  → CHALLENGE_NOT_APPROVED  (403)
        //      operation mismatch     → CHALLENGE_OPERATION_MISMATCH (403)
        //      subject mismatch      → ACTOR_MISMATCH          (403)
        //
        //    If we returned CHALLENGE_NOT_APPROVED for an already-
        //    consumed row, a replay attempt would surface as 403
        //    (state failure) instead of 409 (replay); clients would
        //    not be able to distinguish a stale challenge from a
        //    replay, which is exactly the information gap a
        //    defence-in-depth design wants to avoid.
        // -----------------------------------------------------------------
        if (challenge.status === 'consumed') {
            throw new DetokenizeCommandError(
                'CHALLENGE_CONSUMED',
                `challenge ${cmd.challengeId} has already been consumed.`,
            );
        }

        // 4. Expiry. The challenge row carries `expiresAt` as a
        //    `Date` (mirroring the SQL schema). We compare against
        //    `clock()` (also a `Date`). Runs BEFORE the generic
        //    status check so an expired challenge that was never
        //    consumed surfaces as CHALLENGE_EXPIRED (410), not
        //    CHALLENGE_NOT_APPROVED (403) — the time-bounding
        //    failure is more specific than the state failure.
        const now = clock();
        if (challenge.expiresAt.getTime() <= now.getTime()) {
            throw new DetokenizeCommandError(
                'CHALLENGE_EXPIRED',
                `challenge ${cmd.challengeId} expired at ${challenge.expiresAt.toISOString()}.`,
            );
        }

        // 5. Generic status check. Anything that is not `approved`
        //    and is not `consumed` (already handled above) collapses
        //    to CHALLENGE_NOT_APPROVED — i.e. the MFA approval step
        //    (`pending`), an explicit deny, a failed verify, etc.
        if (challenge.status !== 'approved') {
            throw new DetokenizeCommandError(
                'CHALLENGE_NOT_APPROVED',
                `challenge ${cmd.challengeId} is not approved (status=${challenge.status}).`,
            );
        }

        // 6. Operation binding. A challenge minted for a different
        //    operation must not release detokenization plaintext.
        //    The request route already enforces this when minting;
        //    the check here is defence-in-depth so a future
        //    migration of the request route cannot silently broaden
        //    the release surface. Runs AFTER the status check so an
        //    expired / unapproved row is reported with the more
        //    specific lifecycle code, not a generic operation code.
        if (!isDetokenizeOperation(challenge.operation)) {
            throw new DetokenizeCommandError(
                'CHALLENGE_OPERATION_MISMATCH',
                `challenge ${cmd.challengeId} is not a detokenize challenge (operation=${challenge.operation ?? 'null'}).`,
            );
        }

        // 7. Actor binding. The JWT subject is the trusted
        //    principal; the request route projects it onto
        //    `context.actorId` (the route already does that
        //    projection, see `detokenize.routes.ts`). The command
        //    enforces it here so the actor-binding invariant holds
        //    even if a future route bypass wires the command
        //    through a non-HTTP seam.
        if (challenge.requestedBy !== cmd.context.actorId) {
            throw new DetokenizeCommandError(
                'ACTOR_MISMATCH',
                `challenge ${cmd.challengeId} was requested by ${challenge.requestedBy}, not ${cmd.context.actorId}.`,
            );
        }

        // -----------------------------------------------------------------
        // 7. Atomically consume the challenge. THIS is the
        //    canonical replay-protection primitive — `consume()`
        //    is the only atomic transition the command relies on,
        //    and the implementation is the single seam that
        //    distinguishes "first call wins" from "second call loses"
        //    under concurrency. We do not decrypt, audit, or publish
        //    until this returns the row.
        //
        //    A failure here means either (a) the row is missing
        //    (race-window: another caller consumed it between our
        //    `findById` and `consume`), or (b) the row is in a
        //    state that does not permit the transition (already
        //    consumed). Both surface as CHALLENGE_CONSUMED at the
        //    HTTP layer (409). The repository interface guards the
        //    transition; we guard the messaging.
        // -----------------------------------------------------------------
        const consumed = await deps.challenges.consume(cmd.challengeId, now);
        if (!consumed) {
            throw new DetokenizeCommandError(
                'CHALLENGE_CONSUMED',
                `challenge ${cmd.challengeId} has already been consumed.`,
            );
        }

        // -----------------------------------------------------------------
        // 8. Load the token row by id. The repository returns
        //    `TokenRow | null`; a missing row is mapped to
        //    TOKEN_NOT_FOUND (404) — a logical impossibility
        //    after the request route minted a challenge that
        //    pinned `tokenId`, but a useful failure mode if the
        //    tokens and challenges tables ever drift (e.g. a
        //    future retention job).
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
        // 9. Load the parent identity row. The identity row
        //    carries the AAD the envelope's GCM tag was bound to
        //    at tokenize time. Identity is keyed off
        //    `challenge.identityId` if the request route populated
        //    it (it always does, by construction — the
        //    `RequestDetokenization` command writes both fields);
        //    we fall back to `tokenRow.identityId` for legacy
        //    challenge rows and for adapter round-trip safety.
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
        // 10-15. Buffers that hold plaintext or sensitive context
        //        are declared up-front so the `finally` block can
        //        zero them regardless of which branch we exit
        //        through.
        //
        //   `dek`             — unwrapped DEK from
        //                        `KeyManager.unwrapDataKey`.
        //   `aadhaarBuf`      — 12-digit plaintext recovered
        //                        from the envelope.
        //   `wrapContext`     — deterministically reconstructed
        //                        context under which the DEK is
        //                        unwrapped.
        //
        //   The AAD buffer (`identityRow.aad`) is *not* a secret
        //   — it is the row-binding tuple stored on the identity
        //   row itself, and AES-GCM only treats it as authenticity
        //   input. We do not zero it (mirroring `TokenizeAadhaar`
        //   for `tokenAad`).
        // -----------------------------------------------------------------
        const wrapContext = makeDetokenizeWrapContext(identityRow.identityId);

        // Caller-side correlation id echoed in the response. The
        // vault's append-only audit row id is stamped server-side
        // and is not surfaced here in v0.1.
        const auditId =
            cmd.context.requestId && cmd.context.requestId.length > 0
                ? cmd.context.requestId
                : `detok-${tokenRow.id.slice(0, 8)}-${now.getTime().toString(36)}`;

        let dek: Buffer | undefined;
        let aadhaarBuf: Buffer | undefined;
        try {
            // -------------------------------------------------------------
            // 10. Unwrap the DEK. The wrap context is reconstructed
            //     from the identity row (see
            //     `makeDetokenizeWrapContext`). The `KeyManager`
            //     adapter throws on a context mismatch or tampered
            //     bytes; we surface that as UNWRAP_FAILED so the
            //     HTTP layer can map to 5xx.
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
            // 11. Decrypt the envelope. AES-GCM throws on tag
            //     mismatch (wrong AAD, tampered ciphertext, wrong
            //     key) — surface as DECRYPTION_FAILED with the
            //     same reasoning as UNWRAP_FAILED.
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
            // 12. Validate the recovered plaintext is a 12-digit
            //     Aadhaar. The `TokenizeAadhaar` pipeline rejects
            //     any non-12-digit input before encrypting, so a
            //     successful decrypt that yields something else
            //     would indicate a corrupted row. Surface as
            //     INVALID_PAYLOAD.
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
            // 13. Append the audit row. Action is `DETOKENIZE`,
            //     outcome is `allow` (we are reporting a successful
            //     recovery; failure paths throw before this point
            //     and write their own deny/error rows in a future
            //     session). The meta block carries the actor
            //     context, the originating challenge id, the
            //     verified factor id (so the approval can be cross-
            //     referenced), and the originating token's id.
            //
            //     `verifiedFactorId` is optional on the challenge
            //     row — older or memory-fake challenges may not
            //     surface it. We omit it from `meta` if absent so
            //     the audit row stays faithful.
            // -------------------------------------------------------------
            const verifiedFactorId =
                typeof challenge.verifiedFactorId === 'string' &&
                challenge.verifiedFactorId.length > 0
                    ? challenge.verifiedFactorId
                    : null;

            const auditEntry: AuditEntry = {
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
            };
            try {
                await deps.audit.append(auditEntry);
            } catch (auditErr) {
                // Same posture as the pre-step-up command:
                // re-throw so the runtime logger can pick it up,
                // but the plaintext is already in the caller's
                // hands from the crypto step above. The contract
                // is "best-effort audit"; v0.1 surfaces this via
                // the standard error path and leaves stronger
                // guarantees to a future session.
                throw auditErr;
            }

            // -------------------------------------------------------------
            // 14. Publish the domain event AFTER the audit append.
            //     The publish is the last step so a failed audit
            //     earlier in the chain does not produce a phantom
            //     `DetokenizationCompleted` event. The event
            //     payload carries the same correlation fields
            //     (challengeId, verifiedFactorId) so downstream
            //     subscribers can re-bind the release to the
            //     challenge that authorised it.
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
            // 15. Plaintext hygiene — ALWAYS, even on throw.
            //
            //     Every `Buffer` whose contents the command treats
            //     as a secret at any point in its lifetime is
            //     zeroed here. `safeZero` no-ops on undefined /
            //     non-Buffers, so a throw inside `unwrapDataKey`
            //     (before `dek` is set) or inside `decrypt`
            //     (before `aadhaarBuf` is set) is safe.
            // -------------------------------------------------------------
            if (dek) safeZero(dek);
            if (aadhaarBuf) safeZero(aadhaarBuf);
            safeZero(wrapContext);
        }
    };
}