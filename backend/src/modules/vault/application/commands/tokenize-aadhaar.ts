/**
 * `TokenizeAadhaar` command — application-layer use case
 * (ported verbatim from
 * src/application/commands/tokenize-aadhaar.ts,
 * with `.js` import suffixes stripped for the FLN backend's ESM
 * resolution).
 *
 * Implements the §6.1 `POST /v1/tokenize` contract from
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
 *   - All persistence goes through `TransactionalVaultWriter`,
 *     which bundles the three writes (identity insert, token insert,
 *     audit append) into a single atomic unit.
 *   - Cross-cutting signalling goes through `EventPublisher`. NOTE:
 *     the publish call lives *outside* the transaction so a rolled-
 *     back unit-of-work doesn't emit a phantom event to subscribers.
 *
 * **Wrap context (AAD for the DEK).** The per-record DEK is wrapped
 * by `KeyManager.generateDataKey(wrapContext)` under a byte buffer
 * that binds the resulting `wrapped_dek` blob to `(actor, identity)`.
 *
 * **Plaintext hygiene.** Any `Buffer` that briefly holds plaintext
 * is zeroed in `finally` via `safeZero`:
 *
 *   - `dek.plaintext` — the per-record DEK
 *   - `digitsBuf`     — the 12-digit raw Aadhaar we encrypt
 *   - `wrapContext`   — the AAD described above
 *   - `tokenAad` is intentionally *not* secret (it is the *additional
 *     authenticated data*, stored alongside the ciphertext to bind
 *     the row to context) so it is not zeroed.
 */

import { createHash, randomUUID } from 'node:crypto';

import type {
  TransactionalVaultWriter,
} from '../ports/transactional-vault-writer';
import type { KeyManager } from '../ports/key-manager';
import type { CryptoService } from '../ports/crypto.service';
import type { EventPublisher } from '../ports/event-publisher';
import { safeZero } from '../../util/dek-zero';
import { vaultLogbookEntry } from '../../audit/logbook-entry';

// ---------------------------------------------------------------------------
// Public types — the §6.1 contract surface
// ---------------------------------------------------------------------------

/**
 * Identity types accepted by this command.
 *
 * v0.1 scope: only `AADHAAR` is implemented. `BIRTH_CERTIFICATE` and
 * any future type are reserved — the command will reject them with
 * `INVALID_INPUT` until v0.2 wires their validation rules.
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
 *
 * `userId`, `schoolId`, `schoolName` are denormalised fields the
 * `logbook` row carries for display and filtering. The route layer
 * populates them from the authenticated user; the SERVICE actor
 * (e.g. the backend registering a student on behalf of a teacher)
 * leaves them empty and the mapping helper falls back to 'system'.
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
  userId?: string;
  schoolId?: string;
  schoolName?: string;
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
 * vault_identities row.
 */
export interface TokenizeAadhaarResult {
  /** Opaque per-token reference. UUIDv4. */
  token: string;
  /** Last 4 digits of the raw Aadhaar, for masked display. */
  last4: string;
  /** Echoed identity type, e.g. "AADHAAR". */
  tokenType: TokenizeIdentityType;
  /** Vault-side row id of the parent vault_identities record. */
  identityId: string;
  /**
   * Caller-side correlation id echoed in the response.
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
 * correctly in Phase 3.
 */
const ENVELOPE_ALGORITHM = 'aes-256-gcm';

/**
 * v0.1 envelope schema version. Bump on any layout change to
 * (iv, authTag, ciphertext, aad) so detokenize can refuse to unwrap
 * a row whose layout it doesn't understand.
 */
const ENVELOPE_SCHEMA_VERSION = 1;

/**
 * v0.1 pepper version. v0.2 will plumb it through key metadata; the
 * v0.1 surface here stays the same.
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
 */
function normalizeAadhaar(raw: string): string {
  return raw.replace(/[\s-]+/g, '');
}

/**
 * Deterministic subjectHash: `SHA-256(version || ":" || digits)` →
 * first 16 bytes → formatted as a UUID-shaped hex string.
 *
 * Used as the primary key of `vault_identities` so that re-tokenizing
 * the same Aadhaar yields the same identity_id.
 */
function computeSubjectHash(
  aadhaarDigits: string,
  pepperVersion: number,
): string {
  const input = `${pepperVersion}:${aadhaarDigits}`;
  const digest = createHash('sha256').update(input, 'utf8').digest();
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
    // -----------------------------------------------------------------
    const identityId = computeSubjectHash(digits, PEPPER_VERSION_V0_1);
    const last4 = digits.slice(-4);
    const now = clock();

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
    // -----------------------------------------------------------------
    const digitsBuf = Buffer.from(digits, 'utf8');
    const wrapContext = Buffer.from(`wrap:${identityId}`, 'utf8');

    // Mint a token id up-front so the audit row + event can both
    // reference it without re-deriving.
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
    // -----------------------------------------------------------------
    let dek: Awaited<ReturnType<KeyManager['generateDataKey']>> | undefined;
    try {
      dek = await deps.keyManager.generateDataKey(wrapContext);
      const dekPlaintext = dek.plaintext;
      const dekWrapped = dek.wrapped.bytes;
      const dekKeyVersion = dek.keyVersion;

      // -------------------------------------------------------------
      // 5. Encrypt the 12-digit plaintext with AES-256-GCM.
      // -------------------------------------------------------------
      const envelope = await deps.crypto.encrypt(
        dekPlaintext,
        digitsBuf,
        tokenAad,
      );

      const keyVersionNumeric = parseKeyVersionNumeric(dekKeyVersion);

      // -------------------------------------------------------------
      // 6-8. Atomic unit-of-work: identity, token, audit.
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

        // Audit row goes to the FLN `logbook` collection inside the
        // same Mongo session as the identity + token inserts, so the
        // audit row commits or rolls back atomically with them. The
        // `auditId` (the synthetic LogEntry.id) is also the value
        // returned to the caller, so downstream tools can stitch the
        // tokenize response to the logbook row.
        await conn.writeLog(
          vaultLogbookEntry(
            {
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
            },
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
      });

      // -------------------------------------------------------------
      // 9. Publish the domain event AFTER the transaction commits.
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
      // -------------------------------------------------------------
      safeZero(digitsBuf);
      safeZero(wrapContext);
      if (dek) safeZero(dek.plaintext);
    }
  };
}
