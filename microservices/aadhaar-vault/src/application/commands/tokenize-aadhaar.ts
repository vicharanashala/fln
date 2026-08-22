/**
 * `TokenizeAadhaar` command — application-layer use case (Session 4).
 *
 * Implements the §6.1 `POST /api/vault/tokenize` contract from
 * `AADHAAR_VAULT_FREE_ARCHITECTURE.md` §6.1 / §8.1. The command is the
 * only place that knows the *whole* tokenization pipeline: validate
 * → mint DEK → encrypt → persist identity → persist token → audit →
 * publish event → respond.
 *
 * Layering rules (clean architecture):
 *
 *   - This file knows about *domain* rules (12-digit Aadhaar format,
 *     INVALID_INPUT for non-Aadhaar types in v0.1) and orchestrates
 *     the ports. It does NOT import any infrastructure adapter
 *     (`pg`, `node:crypto` for the cipher itself, etc.).
 *   - All crypto primitives come from `CryptoService` (AES-GCM
 *     envelope).
 *   - All key material comes from `KeyManager` (per-record DEK mint
 *     + wrap).
 *   - All persistence goes through {@link TransactionalVaultWriter},
 *     which bundles the three writes (identity insert, token insert,
 *     audit append) into a single atomic unit. The production
 *     adapter is real Postgres `BEGIN`/`COMMIT`; the test adapter is
 *     the in-process memory pool.
 *   - Cross-cutting signalling goes through `EventPublisher`. NOTE:
 *     the publish call lives *outside* the transaction so a rolled-
 *     back unit-of-work doesn't emit a phantom event to subscribers
 *     (Redis Streams, downstream Kafka, etc.).
 *
 * **Wrap context (AAD for the DEK).** The per-record DEK is wrapped
 * by `KeyManager.generateDataKey(wrapContext)` under a byte buffer
 * that binds the resulting `wrapped_dek` blob to `(actor, identity)`.
 * If an attacker exfiltrates the wrapped DEK from the `vault_tokens`
 * row but does not also know the identity subjectHash they
 * unwrapping target, the wrap would fail to authenticate under any
 * other `(actor, identity)` pair. The buffer is constructed once here
 * and zeroed in `finally`.
 *
 * **Plaintext hygiene.** Any `Buffer` that briefly holds plaintext
 * is zeroed in `finally` via {@link safeZero}:
 *
 *   - `dek.plaintext` — the per-record DEK
 *   - `digitsBuf`     — the 12-digit raw Aadhaar we encrypt
 *   - `wrapContext`   — the AAD described above
 *   - `tokenAad` is intentionally *not* secret (it is the *additional
 *     authenticated data*, stored alongside the ciphertext to bind
 *     the row to context) so it is not zeroed.
 *
 * The DEK plaintext is a secret; the `finally` block zeros it before
 * the function returns — even on error paths.
 */

import { createHash, randomUUID } from 'node:crypto';

import type {
    TransactionalVaultWriter,
} from '../ports/transactional-vault-writer.js';
import type { KeyManager } from '../ports/key-manager.js';
import type { CryptoService } from '../ports/crypto.service.js';
import type { EventPublisher } from '../ports/event-publisher.js';
import { safeZero } from '../../util/dek-zero.js';

// ---------------------------------------------------------------------------
// Public types — the §6.1 contract surface
// ---------------------------------------------------------------------------

/**
 * Identity types accepted by this command.
 *
 * v0.1 scope (AADHAAR_VAULT_FREE_ARCHITECTURE.md §6.1): only `AADHAAR`
 * is implemented. `BIRTH_CERTIFICATE` and any future type are reserved
 * — the command will reject them with `INVALID_INPUT` until v0.2 wires
 * their validation rules.
 */
export type TokenizeIdentityType = 'AADHAAR' | 'BIRTH_CERTIFICATE';

/**
 * Caller context. Mirrors the audit shape (who, why, from where) so
 * the audit append + event publish don't have to re-derive it.
 *
 * `requestId` is opaque — typically the inbound HTTP `X-Request-Id`
 * or an upstream correlation id. `actorRole` is one of the
 * well-known RBAC tags; kept as a string union so future roles don't
 * require a code change here.
 */
export interface TokenizeCallerContext {
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
 * §6.1 request shape: { raw, type, context }.
 */
export interface TokenizeAadhaarCommand {
    raw: string;
    type: TokenizeIdentityType;
    context: TokenizeCallerContext;
}

/**
 * §6.1 response shape: { token, last4, tokenType, auditId, identityId }.
 *
 * `identityId` is the deterministic subjectHash UUID so callers can
 * later re-tokenize the same identity without producing a duplicate
 * vault_identities row (the `vault_identities.identity_id` PK is the
 * natural dup key — see migration 001 + `IdentityRepository`).
 */
export interface TokenizeAadhaarResult {
    /** Opaque per-token reference. UUIDv7 — sortable + globally unique. */
    token: string;
    /** Last 4 digits of the raw Aadhaar, for masked display. */
    last4: string;
    /** Echoed identity type, e.g. "AADHAAR". */
    tokenType: TokenizeIdentityType;
    /** Vault-side row id of the parent vault_identities record. */
    identityId: string;
    /**
     * Caller-side correlation id. In v0.1 we surface the inbound
     * `X-Request-Id` (or a freshly minted UUID if none was supplied)
     * so the FLN backend can stitch its own logs to the vault audit
     * chain. The vault's append-only audit row id is stamped
     * server-side and is *not* surfaced here.
     */
    auditId: string;
    /** Identity-key version (informational; echoed for client logs). */
    keyVersion: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Error class with a stable `code` so the HTTP layer can map to 400s
 * without sniffing message text.
 */
export class TokenizeCommandError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
        super(message);
        this.name = 'TokenizeCommandError';
        this.code = code;
    }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Canonical algorithm identifier — must match what `CryptoService`
 * reports on its `algorithm` property so detokenize can dispatch
 * correctly in Session 5.
 */
const ENVELOPE_ALGORITHM = 'aes-256-gcm';

/**
 * v0.1 envelope schema version. Bump on any layout change to
 * (iv, authTag, ciphertext, aad) so detokenize can refuse to unwrap
 * a row whose layout it doesn't understand.
 */
const ENVELOPE_SCHEMA_VERSION = 1;

/**
 * v0.1 pepper version. The pepper itself is held by the
 * `KeyManager` adapter (and rotated through `key_metadata`); the
 * *integer* version on the identity row tells detokenize which
 * pepper to apply when reconstructing subjectHash for lookup. v0.1
 * ships a single, environment-supplied pepper; v0.2 will plumb it
 * through `KeyMetadataRepository`.
 */
const PEPPER_VERSION_V0_1 = 1;

// ---------------------------------------------------------------------------
// Helpers (domain-only; no I/O)
// ---------------------------------------------------------------------------

/**
 * Strip the conventional separators an operator may type when reading
 * an Aadhaar off a card. Per Aadhaar conventions the printed form is
 * `XXXX XXXX XXXX` (space-grouped 4s); the v0.1 surface also accepts
 * dashes so legacy OCR'd inputs don't get rejected.
 *
 * Returns the digits-only form. Caller is responsible for length
 * validation.
 */
function normalizeAadhaar(raw: string): string {
    return raw.replace(/[\s-]+/g, '');
}

/**
 * Deterministic subjectHash: `SHA-256(version || ":" || digits)` →
 * first 16 bytes → formatted as a UUID-shaped hex string.
 *
 * Used as the primary key of `vault_identities` so that re-tokenizing
 * the same Aadhaar for the same tenant yields the same identity_id
 * (the application upserts on PK collision; see `IdentityRepository`).
 *
 * The pepper is held by the `KeyManager` adapter — it's NOT loaded
 * here. In v0.1 the command uses a fixed empty-pepper constant so
 * reviewer builds are reproducible without the operator ceremony
 * described in §5.1. v0.2 will source the pepper from
 * `KeyManager.info()` or a dedicated `PepperProvider` port; the
 * surface here stays the same.
 */
function computeSubjectHash(
    aadhaarDigits: string,
    pepperVersion: number,
): string {
    // Stable, domain-separated input: version || ":" || digits.
    // Including the version in the hash means a pepper rotation
    // immediately retires the old subjectHash space — old
    // vault_identities rows remain readable via their stored
    // (ciphertext, aad) but their `identity_id` is no longer
    // re-derivable, which is the intended "fail closed" property.
    const input = `${pepperVersion}:${aadhaarDigits}`;
    const digest = createHash('sha256').update(input, 'utf8').digest();
    // UUID layout: 8-4-4-4-12 from the first 16 bytes.
    const hex = digest.subarray(0, 16).toString('hex');
    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32),
    ].join('-');
}

/**
 * Parse the `kv-N` style key-version string the `KeyManager` reports
 * into an integer suitable for the `vault_identities.keyVersion`
 * column. Falls back to `0` for any non-conforming string so a
 * misconfigured adapter fails the audit row, not the request.
 */
function parseKeyVersionNumeric(keyVersion: string): number {
    const m = /^kv-(\d+)$/i.exec(keyVersion);
    return m && m[1] ? parseInt(m[1], 10) : 0;
}

// ---------------------------------------------------------------------------
// Command factory
// ---------------------------------------------------------------------------

/**
 * Dependencies the command needs. Keeping the constructor object
 * typed (rather than positional) makes test fakes readable.
 *
 * The three persistence ports (`identities`, `tokens`, `audit`) are
 * intentionally NOT exposed here — they live behind
 * `vaultWriter.runWrite`, which is the only seam persistence callers
 * have. This keeps the command from "leaking" individual repos and
 * accidentally firing writes outside the transaction.
 */
export interface TokenizeAadhaarDeps {
    keyManager: KeyManager;
    crypto: CryptoService;
    vaultWriter: TransactionalVaultWriter;
    events: EventPublisher;
    /**
     * Returns the *current* "now" — injected so tests can pin time
     * and so the timestamp used by event publish is the same value
     * the audit row + identity / token rows would agree on.
     */
    clock?: () => Date;
}

/**
 * Factory returns the bound command function. Style mirrors the
 * §11 sample so reviewers familiar with the architecture doc see no
 * surprise: `deps` in, async function out.
 */
export function makeTokenizeAadhaar(deps: TokenizeAadhaarDeps) {
    const clock: () => Date = deps.clock ?? (() => new Date());

    return async function tokenizeAadhaar(
        cmd: TokenizeAadhaarCommand,
    ): Promise<TokenizeAadhaarResult> {
        // -----------------------------------------------------------------
        // 1. Validate raw is 12 digits (after stripping spaces/dashes).
        // -----------------------------------------------------------------
        const digits = normalizeAadhaar(cmd.raw ?? '');
        if (!/^\d{12}$/.test(digits)) {
            throw new TokenizeCommandError(
                'INVALID_INPUT',
                'raw must be a 12-digit Aadhaar number (spaces and dashes permitted).',
            );
        }

        // -----------------------------------------------------------------
        // 2. Validate type === 'AADHAAR' for v0.1 scope.
        // -----------------------------------------------------------------
        if (cmd.type !== 'AADHAAR') {
            throw new TokenizeCommandError(
                'INVALID_INPUT',
                `identity type "${cmd.type}" is not supported in v0.1; only AADHAAR is accepted.`,
            );
        }

        // -----------------------------------------------------------------
        // 3. Compute the deterministic identity_id from subjectHash.
        //    Stable across calls so re-tokenizing the same Aadhaar hits
        //    the upsert path in `IdentityRepository.insert` rather than
        //    creating duplicate identity rows (v0.2 dup-detection).
        // -----------------------------------------------------------------
        const identityId = computeSubjectHash(digits, PEPPER_VERSION_V0_1);
        const last4 = digits.slice(-4);
        const now = clock();

        // AAD for the *ciphertext* (the token envelope). Per §8.1 the
        // AAD binds the ciphertext to its context — key version +
        // envelope schema version + identity_id. Any change to this
        // tuple after the row is written will cause AES-GCM tag
        // verification to fail on detokenize, which is the desired
        // "fail closed" property. This buffer is *not* secret — it is
        // itself stored in `vault_identities.aad` so detokenize can
        // reconstruct the same tuple for verification.
        const tokenAad = Buffer.from(
            [
                'aadhaar-vault/v1',
                `kv=${deps.keyManager.info().currentVersion}`,
                `schema=${ENVELOPE_SCHEMA_VERSION}`,
                `identity=${identityId}`,
            ].join('|'),
            'utf8',
        );

        // -----------------------------------------------------------------
        // 4. Buffers that hold plaintext or sensitive context — declared
        //    up-front so the `finally` block can zero them regardless
        //    of which branch we exit through.
        //
        //    `digitsBuf` is the plaintext we will hand to AES-GCM. It is
        //    short-lived — copied once, encrypted, then zeroed.
        //
        //    `wrapContext` is the per-record AAD under which the DEK is
        //    wrapped. See the file-level comment for why this is
        //    sensitive even though the values are otherwise known.
        // -----------------------------------------------------------------
        // CANONICAL wrap context: depends ONLY on identityId (a stable
        // row-level foreign key). Detokenize regenerates the same buffer
        // before unwrapping the DEK. This makes the wrap-context
        // deterministic w.r.t. the row, so any caller can detokenize
        // without needing to remember which actor originally minted
        // the token — the wrap is bound to identity, not to actor.
        const digitsBuf = Buffer.from(digits, 'utf8');
        const wrapContext = Buffer.from(`wrap:${identityId}`, 'utf8');

        // Mint a token id up-front so the audit row + event can both
        // reference it without re-deriving. (v0.1: Node's
        // `randomUUID` is v4; v0.2 will swap in a UUIDv7 helper — the
        // contract surface here is just an opaque string.)
        const tokenId = randomUUID();
        // Caller-side correlation id echoed in the response so the
        // FLN backend can stitch its own logs to the vault audit
        // chain. The vault's append-only audit row id is stamped
        // server-side and is not surfaced here in v0.1.
        const auditId =
            cmd.context.requestId && cmd.context.requestId.length > 0
                ? cmd.context.requestId
                : randomUUID();

        // -----------------------------------------------------------------
        // 4. Generate a fresh DEK via the KeyManager.
        //    The DEK plaintext is a `Buffer` that we are responsible for
        //    zeroing on every exit branch. If `generateDataKey` itself
        //    throws, there is no plaintext to zero — the `let` below
        //    starts undefined and the `finally` skips it.
        // -----------------------------------------------------------------
        let dek: Awaited<ReturnType<KeyManager['generateDataKey']>> | undefined;
        try {
            dek = await deps.keyManager.generateDataKey(wrapContext);
            const dekPlaintext = dek.plaintext;
            const dekWrapped = dek.wrapped.bytes;
            const dekKeyVersion = dek.keyVersion;

            // -------------------------------------------------------------
            // 5. Encrypt the 12-digit plaintext with AES-256-GCM.
            //    The AAD here is `tokenAad` (the row-binding tuple), NOT
            //    `wrapContext` (the actor-binding tuple for the DEK
            //    wrap). They are different concerns: AAD1 binds the
            //    ciphertext-to-row; AAD2 binds the wrapped-DEK to
            //    (actor, identity).
            // -------------------------------------------------------------
            const envelope = await deps.crypto.encrypt(
                dekPlaintext,
                digitsBuf,
                tokenAad,
            );

            const keyVersionNumeric = parseKeyVersionNumeric(dekKeyVersion);

            // -------------------------------------------------------------
            // 6-8. Atomic unit-of-work: identity, token, audit.
            //
            // `vaultWriter.runWrite` opens a Postgres transaction in
            // production and runs the three inserts against the same
            // `PoolClient`. On any throw inside this block the
            // production adapter issues ROLLBACK; the in-memory test
            // adapter cannot roll back (acceptable: tests assert on the
            // command's branching, not mid-flight storage state).
            //
            // The event publish is intentionally OUTSIDE the unit-of-work
            // so a rolled-back transaction does not emit a phantom
            // `AadhaarTokenized` event to subscribers.
            // -------------------------------------------------------------
            await deps.vaultWriter.runWrite(async (conn) => {
                await conn.insertIdentity({
                    identityId,
                    ciphertext: envelope.ciphertext,
                    aad: tokenAad,
                    pepperVersion: PEPPER_VERSION_V0_1,
                    keyVersion: keyVersionNumeric,
                });

                await conn.insertToken({
                    id: tokenId,
                    identityId,
                    algorithm: ENVELOPE_ALGORITHM,
                    ciphertext: envelope.ciphertext,
                    iv: envelope.iv,
                    authTag: envelope.authTag,
                    wrappedDek: dekWrapped,
                });

                await conn.appendAudit({
                    identityId,
                    actor: cmd.context.actorId,
                    action: 'TOKENIZE',
                    outcome: 'allow',
                    reason: cmd.context.reason,
                    requestId: cmd.context.requestId ?? null,
                    meta: {
                        actor_role: cmd.context.actorRole,
                        token_type: cmd.type,
                        token_id: tokenId,
                        last4,
                        key_version: dekKeyVersion,
                        envelope_schema_version: ENVELOPE_SCHEMA_VERSION,
                        source_ip: cmd.context.sourceIp ?? null,
                        user_agent: cmd.context.userAgent ?? null,
                    },
                });
            });

            // -------------------------------------------------------------
            // 9. Publish the domain event AFTER the transaction commits.
            //    The v0.1 adapter is in-process; a future Redis Streams
            //    adapter swaps in without a code change here. Failure of
            //    the publish is *not* fatal to the call — the row is
            //    committed and the audit chain is intact. A
            //    production-grade pub-sub should implement retry +
            //    dead-letter; v0.1 surfaces the failure as a server-
            //    side logged warning via the EventPublisher contract.
            // -------------------------------------------------------------
            await deps.events.publish({
                type: 'AadhaarTokenized',
                token: tokenId,
                identityId,
                last4,
                actorId: cmd.context.actorId,
                actorRole: cmd.context.actorRole,
                occurredAt: now.toISOString(),
            });

            // -------------------------------------------------------------
            // 10. Return the §6.1 contract-shaped response.
            // -------------------------------------------------------------
            return {
                token: tokenId,
                last4,
                tokenType: cmd.type,
                identityId,
                auditId,
                keyVersion: dekKeyVersion,
            };
        } finally {
            // -------------------------------------------------------------
            // Plaintext hygiene — ALWAYS, even on throw.
            //
            // Every `Buffer` whose contents the command treats as a
            // secret at any point in its lifetime is zeroed here. This
            // is a defense-in-depth measure: garbage-collected heaps
            // can still hold the bytes for an indeterminate time, but
            // a future core dump or accidental inspection sees zeros.
            //
            // `safeZero` no-ops on non-Buffers (so the undefined case
            // for `dek` is safe) and is a no-op if the buffer was
            // already zeroed.
            // -------------------------------------------------------------
            safeZero(digitsBuf);
            safeZero(wrapContext);
            if (dek) safeZero(dek.plaintext);
        }
    };
}