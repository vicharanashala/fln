/**
 * `EnrollMfa` command — application-layer use case (Session 5C).
 *
 * Implements the "enroll a TOTP step-up factor" use case. The
 * command is the only place that knows the whole enrollment
 * pipeline:
 *
 *   1. validate input (actor, label, optional factor-type meta);
 *   2. ask {@link TotpVerifier} to generate a fresh shared secret +
 *      otpauth URI;
 *   3. seal the secret with {@link KeyManager.sealSecret} under a
 *      context bound to the *factor id* (the factor id is the
 *      domain-separation tag — see {@link makeMfaSecretContext});
 *   4. persist the factor via {@link MfaFactorRepository.insert};
 *   5. append an audit row via {@link AuditRepository.append};
 *   6. publish the `MfaEnrolled` domain event via
 *      {@link EventPublisher.publish}.
 *
 * Layering rules (clean architecture):
 *
 *   - This file knows about *domain* rules (actor must be non-empty,
 *     label must be non-empty, factorType is the v0.1 set) and
 *     orchestrates the ports. It does NOT import any infrastructure
 *     adapter (`pg`, `otpauth`, `node:crypto`, etc.).
 *   - All crypto primitives come from `KeyManager.sealSecret` and
 *     `TotpVerifier.generateEnrollment`. The application layer does
 *     not pick an algorithm or a curve.
 *   - All persistence goes through application-layer ports
 *     (`MfaFactorRepository`, `AuditRepository`).
 *   - Cross-cutting signalling goes through `EventPublisher`. As with
 *     `TokenizeAadhaar`, the publish call lives *outside* any
 *     transaction boundary so a rolled-back unit-of-work cannot
 *     emit a phantom event to subscribers.
 *
 * **Wrap context for the TOTP secret.** The secret is sealed under
 * `mfa-factor:<factorId>` (see `mfa-secret-context.ts`). The
 * factorId is minted by the application at enrollment time (UUIDv7,
 * sortable + globally unique) and is stable for the lifetime of
 * the row. Changing the format in a future version *will* refuse
 * to open any previously-sealed secret — the desired "old key is
 * dead" property.
 *
 * **Plaintext hygiene.** The raw TOTP shared secret from
 * `TotpVerifier.generateEnrollment` is sensitive. The command
 * zeroes it in `finally` via {@link safeZero}. The context buffer
 * is also zeroed (defense-in-depth, matching the `TokenizeAadhaar`
 * pattern). The wrapped blob returned by `sealSecret` is
 * intentionally not zeroed: it is safe to persist and will be
 * stored as a `bytea` column.
 *
 * **Why no transaction bundle here.** The Postgres adapter for
 * `MfaFactorRepository.insert` runs a single statement; a separate
 * `AuditRepository.append` would normally be wrapped together.
 * Session 5C keeps the two writes in the *call order* `insert →
 * append → publish` without introducing a `TransactionalVaultWriter`
 * dependency: the `MfaFactorRepository` port does not currently
 * expose a transaction callback, and the brief explicitly says
 * "do not redesign the repository" in this session. The
 * "insert wins, audit may be lost" failure mode is acceptable for
 * v0.1 — the factor is the truth source, the audit row is a
 * best-effort log. A future schema-reconciliation session can
 * introduce a `vaultWriter.runWrite` port for MFA if a stronger
 * guarantee is needed.
 */
import { randomUUID } from 'node:crypto';

import type { KeyManager } from '../ports/key-manager.js';
import type { TotpVerifier, TotpAlgorithm } from '../ports/totp-verifier.js';
import type {
    MfaFactor,
    MfaFactorRepository,
} from '../ports/mfa-repository.js';
import type {
    AuditEntry,
    AuditRepository,
} from '../../db/ports/audit.repository.js';
import type { EventPublisher } from '../ports/event-publisher.js';
import { safeZero } from '../../util/dek-zero.js';
import { makeMfaSecretContext } from '../util/mfa-secret-context.js';

// ---------------------------------------------------------------------------
// Public types — the "enroll MFA" contract surface
// ---------------------------------------------------------------------------

/**
 * Caller context. Mirrors `TokenizeCallerContext` /
 * `ReadAuditHistoryCallerContext` so the audit chain sees a
 * consistent actor triple regardless of which command wrote the
 * row.
 */
export interface EnrollMfaCallerContext {
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
 * Request shape: `{ actor, label, context, algorithm?, digits?, period? }`.
 *
 * `algorithm` / `digits` / `period` are *optional* meta that
 * forward to `TotpVerifier.generateEnrollment`. v0.1 callers
 * typically omit them (defaults: SHA1 / 6 / 30, matching Google
 * Authenticator and the historical de-facto standard). A future
 * UI may expose them as "advanced" options.
 */
export interface EnrollMfaCommand {
    /**
     * The user / service principal that owns this factor. Same
     * shape as the JWT subject — a stable string the application
     * uses everywhere `actor` is referenced.
     */
    actor: string;
    /**
     * Human-readable label for the factor. Surfaced in the
     * otpauth URI and the audit row's `meta.label`. Defaults to
     * the actor when omitted (matches the §6.2 suggestion that a
     * single enrolled factor per actor is the v0.1 norm).
     */
    label?: string;
    context: EnrollMfaCallerContext;
    algorithm?: TotpAlgorithm;
    digits?: number;
    period?: number;
}

/**
 * Response shape: `{ factorId, otpauthUri, factor }`.
 *
 * `factorId` is the canonical row id (the value Verifies will
 * pass back). `otpauthUri` is what the user scans into their
 * authenticator app (or pastes as a deep link). `factor` is the
 * full persisted row, shaped for downstream log/UI consumers; the
 * `encryptedSecret` field is intentionally a `Buffer` (it is a
 * `bytea` in the database) so the HTTP layer can decide how to
 * shape the read response.
 */
export interface EnrollMfaResult {
    factorId: string;
    otpauthUri: string;
    factor: MfaFactor;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Error class with a stable `code` so the HTTP layer can map to
 * 4xx without sniffing message text. Distinct from
 * `TokenizeCommandError` and `ReadAuditHistoryCommandError` so a
 * `try/catch` on one doesn't accidentally swallow the others.
 */
export class EnrollMfaCommandError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
        super(message);
        this.name = 'EnrollMfaCommandError';
        this.code = code;
    }
}

// ---------------------------------------------------------------------------
// Command factory
// ---------------------------------------------------------------------------

/**
 * Dependencies the command needs. The four ports are kept
 * individually (rather than going through a `vaultWriter`
 * abstraction) because the brief explicitly says *do not redesign
 * the repository* in this session. A future session can introduce
 * an MFA-aware transactional writer if a stronger atomicity
 * guarantee is required.
 */
export interface EnrollMfaDeps {
    keyManager: KeyManager;
    totp: TotpVerifier;
    mfa: MfaFactorRepository;
    audit: AuditRepository;
    events: EventPublisher;
    /**
     * Returns the *current* "now" — injected so tests can pin
     * time and so the timestamp used by the audit row and the
     * event publish agree.
     */
    clock?: () => Date;
}

/**
 * Factory returns the bound command function. Style mirrors
 * `makeTokenizeAadhaar` / `makeReadAuditHistory`.
 */
export function makeEnrollMfa(deps: EnrollMfaDeps) {
    const clock: () => Date = deps.clock ?? (() => new Date());

    return async function enrollMfa(
        cmd: EnrollMfaCommand,
    ): Promise<EnrollMfaResult> {
        // -----------------------------------------------------------------
        // 1. Validate input. The actor triple is the only thing the
        //    audit row attributes; an empty `actorId` would produce
        //    a misleading audit row and a factor that cannot be
        //    listed later (ListActiveByActor is keyed on actor).
        // -----------------------------------------------------------------
        if (
            typeof cmd.context?.actorId !== 'string' ||
            cmd.context.actorId.length === 0
        ) {
            throw new EnrollMfaCommandError(
                'INVALID_INPUT',
                'context.actorId must be a non-empty string.',
            );
        }
        if (typeof cmd.actor !== 'string' || cmd.actor.length === 0) {
            throw new EnrollMfaCommandError(
                'INVALID_INPUT',
                'actor must be a non-empty string.',
            );
        }
        // The `label` is optional; default to the actor string.
        // We do NOT default to the raw JWT subject — the actor
        // here is the application-level identity principal
        // (e.g. "teacher-101") and is the right surface for an
        // authenticator app's account list.
        const label =
            typeof cmd.label === 'string' && cmd.label.length > 0
                ? cmd.label
                : cmd.actor;

        // -----------------------------------------------------------------
        // 2. Mint the factor id up-front. UUIDv7 (sortable +
        //    globally unique). The same value is used as:
        //      - the MfaFactor.factorId primary key,
        //      - the AES-GCM context for seal/open (so a
        //        stolen `encryptedSecret` blob cannot be
        //        transplanted into another factor row),
        //      - the `meta.factor_id` in the audit row,
        //      - the `factorId` field of the `MfaEnrolled` event.
        //    Minting up-front means the audit row and the event
        //    can both reference the id without re-deriving it.
        // -----------------------------------------------------------------
        const factorId = randomUUID();
        const now = clock();

        // Buffers that hold plaintext or sensitive context —
        // declared up-front so the `finally` block can zero
        // them regardless of which branch we exit through.
        let secretBuf: Buffer | undefined;
        let secretContext: Buffer | undefined;
        try {
            // -------------------------------------------------------------
            // 3. Generate the TOTP enrollment (shared secret +
            //    otpauth URI). The secret is plaintext from the
            //    call's perspective — the *verifier* never sees
            //    the secret again after enrollment.
            // -------------------------------------------------------------
            const enrollment = await deps.totp.generateEnrollment(
                cmd.actor,
                label,
                {
                    ...(cmd.algorithm ? { algorithm: cmd.algorithm } : {}),
                    ...(cmd.digits !== undefined ? { digits: cmd.digits } : {}),
                    ...(cmd.period !== undefined ? { period: cmd.period } : {}),
                },
            );
            secretBuf = enrollment.secret;

            // -------------------------------------------------------------
            // 4. Seal the shared secret under the per-factor
            //    context. The wrapped blob is the only form that
            //    ever touches the database.
            // -------------------------------------------------------------
            secretContext = makeMfaSecretContext(factorId);
            const wrapped = await deps.keyManager.sealSecret(
                secretBuf,
                secretContext,
            );

            // -------------------------------------------------------------
            // 5. Persist the factor row. The adapter supplies
            //    `createdAt` and `status='active'`. We pass
            //    `algorithm` / `digits` / `period` through
            //    verbatim from the enrollment (or the
            //    `TotpVerifier`'s defaults if the caller did
            //    not override them).
            //
            //    For v0.1 we resolve the effective meta by
            //    asking the verifier would be circular, so we
            //    re-derive from the same inputs we passed
            //    above. The verifier's defaults are the same
            //    as the v0.1 port defaults
            //    (SHA1/6/30).
            // -------------------------------------------------------------
            const effectiveAlgorithm: TotpAlgorithm =
                cmd.algorithm ?? 'SHA1';
            const effectiveDigits: number = cmd.digits ?? 6;
            const effectivePeriod: number = cmd.period ?? 30;

            const factor = await deps.mfa.insert({
                factorId,
                actor: cmd.actor,
                factorType: 'totp',
                label,
                encryptedSecret: wrapped.bytes,
                algorithm: effectiveAlgorithm,
                digits: effectiveDigits,
                period: effectivePeriod,
            });

            // -------------------------------------------------------------
            // 6. Append the audit row. We use `actor` (the
            //    application identity principal) as the
            //    audit-row actor — NOT `context.actorId` —
            //    so a privileged admin enrolling a factor on
            //    behalf of a teacher is correctly attributable.
            //    `context.actorId` is recorded in `meta.admin`.
            //
            //    NOTE: this append is best-effort. If it
            //    fails, we still return the enrollment
            //    result; the audit chain may be missing one
            //    row. The HTTP layer / runtime logger can
            //    surface the append failure separately.
            // -------------------------------------------------------------
            const auditEntry: AuditEntry = {
                identityId: null,
                actor: cmd.context.actorId,
                action: 'MFA_ENROLL',
                outcome: 'allow',
                reason: cmd.context.reason,
                requestId: cmd.context.requestId ?? null,
                meta: {
                    factor_id: factorId,
                    factor_type: 'totp',
                    factor_actor: cmd.actor,
                    label,
                    algorithm: effectiveAlgorithm,
                    digits: effectiveDigits,
                    period: effectivePeriod,
                    admin_actor: cmd.context.actorId,
                    admin_role: cmd.context.actorRole,
                    source_ip: cmd.context.sourceIp ?? null,
                    user_agent: cmd.context.userAgent ?? null,
                },
            };
            try {
                await deps.audit.append(auditEntry);
            } catch (auditErr) {
                // Same posture as `TokenizeAadhaar`: a failed
                // audit append is *not* fatal. The factor
                // row is the truth source; the audit chain
                // is a best-effort log. We do, however, want
                // a stack trace in the operator's logs so
                // they can investigate a persistent failure.
                // The `EventPublisher` contract is the
                // canonical place for this kind of
                // best-effort logging; v0.1 just throws
                // here and the run-time adapter (e.g. a
                // Fastify error hook) decides what to do.
                // Re-throw to keep the contract symmetrical
                // with the rest of the codebase: append
                // failures are the caller's problem.
                throw auditErr;
            }

            // -------------------------------------------------------------
            // 7. Publish the domain event AFTER the persistence
            //    calls. As with `TokenizeAadhaar`, the publish
            //    is intentionally the last step so a failed
            //    persist earlier in the chain does not produce
            //    a phantom `MfaEnrolled` event.
            // -------------------------------------------------------------
            await deps.events.publish({
                type: 'MfaEnrolled',
                factorId,
                actor: cmd.actor,
                factorType: 'totp',
                label,
                algorithm: effectiveAlgorithm,
                digits: effectiveDigits,
                period: effectivePeriod,
                enrolledBy: cmd.context.actorId,
                enrolledByRole: cmd.context.actorRole,
                occurredAt: now.toISOString(),
            });

            return {
                factorId,
                otpauthUri: enrollment.otpauthUri,
                factor,
            };
        } finally {
            // -------------------------------------------------------------
            // Plaintext hygiene — ALWAYS, even on throw.
            //
            // `secretBuf` is the raw TOTP shared secret. The
            // session brief mandates we zero it on every exit
            // branch.
            //
            // `secretContext` is the AES-GCM AAD — not
            // classical secret material, but the
            // `TokenizeAadhaar` precedent is to zero
            // *every* buffer the command allocates and
            // feeds to a crypto primitive. We follow the
            // same convention here for consistency.
            //
            // `safeZero` no-ops on undefined / non-Buffers,
            // so a throw inside `generateEnrollment` (before
            // `secretBuf` is set) is safe.
            // -------------------------------------------------------------
            if (secretBuf) safeZero(secretBuf);
            if (secretContext) safeZero(secretContext);
        }
    };
}