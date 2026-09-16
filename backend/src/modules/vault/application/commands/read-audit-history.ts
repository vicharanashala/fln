/**
 * `ReadAuditHistory` command — application-layer use case.
 *
 * Per issue #406's review, the vault's audit chain has been
 * unified onto the FLN `logbook` collection (via
 * `dbStore.addLog` / `dbStore.addLogInSession`). This command
 * is the read-side: it pulls the `vault:`-prefixed logbook
 * rows for a given `identityId`, parses the `details` string
 * back into the structured `VaultAuditRecord` shape the API
 * exposes, and returns them newest-first.
 *
 * Why the read lives in the application layer (not at the
 * route layer): the parsing helper is shared with the write
 * path (`vaultLogbookEntry` is the inverse of
 * `parseVaultLogbookEntry`), so co-locating the read with the
 * write in `backend/src/modules/vault/audit/logbook-entry.ts`
 * keeps the two in lockstep. The route layer would otherwise
 * have to import a parsing helper that lives across the
 * application / infrastructure boundary.
 *
 * Read-only entry point over the FLN `logbook` collection. The
 * command is the only place that knows the "read audit history"
 * contract: validate → list vault-prefixed rows → filter by
 * identityId → cap to the requested limit → shape the response.
 *
 * **Pagination.** The `dbStore.listLogsByDetailsPrefix` method
 * exposes only `limit` (no offset, no cursor). So the command
 * offers a *windowed* read: a single page of up to `limit`
 * records, ordered newest-first. The page may include rows
 * whose identityId is not the requested one — those are
 * filtered out in application code after the list call — so
 * the page's `pageSize` is the post-filter count, not the
 * pre-filter count. Operators asking for a large page can
 * still hit the underlying DB query's cap (1000 rows) and see
 * fewer than their requested limit if the underlying collection
 * is bigger; future sessions can add cursor-based pagination
 * here without changing the command's surface.
 *
 * **Plaintext hygiene.** This command does not touch any
 * plaintext or secret material — audit records are stored as
 * opaque `meta` blobs that the application never decrypts.
 */
import { dbStore } from '../../../../db';
import {
  parseVaultLogbookEntry,
  type VaultAuditRecord,
} from '../../audit/logbook-entry';

// ---------------------------------------------------------------------------
// Public types — the "read audit history" contract surface
// ---------------------------------------------------------------------------

/**
 * Caller context. Mirrors `TokenizeCallerContext` so the
 * audit chain downstream sees a consistent actor triple
 * (who, why, from where) regardless of which command wrote
 * the row. The context here is *not* persisted as a new
 * audit row (read = read; see the file-level comment), but
 * it is the right shape for a future route handler that
 * wants to log the read alongside the call site.
 */
export interface ReadAuditHistoryCallerContext {
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
 * Request shape: `{ identityId, limit?, context }`.
 *
 * `limit` is optional; when omitted the command uses
 * {@link DEFAULT_LIMIT}. When supplied, the command validates
 * it is a positive integer and silently caps it at
 * {@link MAX_LIMIT} so an operator can't pull the entire
 * chain in a single round-trip.
 */
export interface ReadAuditHistoryCommand {
  identityId: string;
  limit?: number;
  context: ReadAuditHistoryCallerContext;
}

/**
 * Single audit record shaped for the v0.1 read surface. The
 * `auditId` is the `LogEntry.id` of the canonical row
 * (a synthetic `vaultlog_...` string) and the same value
 * the challenge row's `audit_id` column holds, so an
 * analyst can pivot from the logbook row to the challenge
 * that triggered it.
 */
export interface ReadAuditHistoryEntry {
  auditId: string;
  identityId: string | null;
  actor: string;
  action: string;
  outcome: 'allow' | 'deny' | 'error';
  reason: string | null;
  requestId: string | null;
  meta: Record<string, unknown> | null;
  occurredAt: string;
}

/**
 * Response shape: `{ identityId, limit, pageSize, entries }`.
 *
 * `limit` echoes the *effective* limit (post-capping) so the
 * caller can tell when their requested `limit` was clamped.
 * `pageSize` is the actual number of records returned;
 * `entries.length` is the same value but the explicit field
 * avoids forcing the caller to branch on `entries` being
 * empty.
 */
export interface ReadAuditHistoryResult {
  identityId: string;
  limit: number;
  pageSize: number;
  entries: ReadAuditHistoryEntry[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Error class with a stable `code` so the HTTP layer can
 * map to 4xx without sniffing message text. Mirrors
 * `TokenizeCommandError` — the names are purposely distinct
 * so a `try/catch` on one doesn't accidentally swallow the
 * other.
 */
export class ReadAuditHistoryCommandError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ReadAuditHistoryCommandError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Server-side default page size. Used when the caller does
 * not specify `limit`. Kept small (50) so the response stays
 * bounded for normal UI consumers; an analyst wanting more
 * passes `limit` explicitly up to {@link MAX_LIMIT}.
 */
const DEFAULT_LIMIT = 50;

/**
 * Server-side maximum page size. A caller asking for
 * `limit: 10000` is silently capped to this value rather than
 * rejected — the command prefers a degraded-but-successful
 * response over a hard 400 for what is otherwise a valid
 * request.
 */
const MAX_LIMIT = 200;

/**
 * The `details` prefix that marks a logbook row as a vault
 * audit row. The mapping helper at
 * `backend/src/modules/vault/audit/logbook-entry.ts` is the
 * single source of truth for this string; the constant here
 * is a copy because the read command cannot import a runtime
 * value across the application/audit boundary cleanly.
 *
 * If the prefix ever changes, this constant AND the
 * `vaultLogbookEntry` formatter AND the integration tests
 * must all be updated together.
 */
const VAULT_DETAILS_PREFIX = 'vault:';

// ---------------------------------------------------------------------------
// Command factory
// ---------------------------------------------------------------------------

/**
 * Dependencies the command needs. There is no port seam
 * here: the command reads from the FLN `logbook` collection
 * via the `dbStore` singleton, the same handle the rest of
 * the FLN backend uses for its own activity log. Tests that
 * need a fixture install a custom `dbStore` shape (via
 * module-scope patching) rather than going through a port.
 *
 * `clock` is accepted for interface parity with
 * `TokenizeAadhaar` (and any future command that needs to
 * stamp a row) but is *not* used by this command today: the
 * audit row's `occurredAt` is the canonical timestamp, not
 * "when the read happened".
 */
export interface ReadAuditHistoryDeps {
  /**
   * Test seam: in production this is the `dbStore` singleton
   * (the default); tests inject an in-memory store with a
   * `listLogsByDetailsPrefix` method that returns a fixed
   * array. Marked optional so the production call site can
   * simply `makeReadAuditHistory({})` and let the command
   * reach for the singleton via a lazy require.
   */
  dbStore?: Pick<typeof dbStore, 'listLogsByDetailsPrefix'>;
  clock?: () => Date;
}

/**
 * Factory returns the bound command function. Style mirrors
 * `makeTokenizeAadhaar`: `deps` in, async function out.
 */
export function makeReadAuditHistory(deps: ReadAuditHistoryDeps = {}) {
  const store = deps.dbStore ?? dbStore;

  return async function readAuditHistory(
    cmd: ReadAuditHistoryCommand,
  ): Promise<ReadAuditHistoryResult> {
    // -----------------------------------------------------------------
    // 1. Validate identityId. The audit chain keys off the
    //    subjectHash UUID; an empty string is a programming
    //    error and must surface loudly as INVALID_INPUT
    //    rather than silently returning an empty list (which
    //    would mask a caller-side bug).
    // -----------------------------------------------------------------
    if (
      typeof cmd.identityId !== 'string' ||
      cmd.identityId.length === 0
    ) {
      throw new ReadAuditHistoryCommandError(
        'INVALID_INPUT',
        'identityId must be a non-empty string.',
      );
    }

    // -----------------------------------------------------------------
    // 2. Resolve `limit`. Default when absent; validate
    //    when present; clamp to MAX_LIMIT. We do NOT reject
    //    an over-large limit — silent clamping is friendlier
    //    to API clients and the `limit` field in the
    //    response echoes the effective value.
    // -----------------------------------------------------------------
    const requestedLimit = cmd.limit ?? DEFAULT_LIMIT;
    if (
      typeof requestedLimit !== 'number' ||
      !Number.isInteger(requestedLimit) ||
      requestedLimit <= 0
    ) {
      throw new ReadAuditHistoryCommandError(
        'INVALID_INPUT',
        'limit must be a positive integer when provided.',
      );
    }
    const effectiveLimit =
      requestedLimit > MAX_LIMIT ? MAX_LIMIT : requestedLimit;

    // -----------------------------------------------------------------
    // 3. Read the vault-prefixed logbook rows. The DB-side
    //    limit is `effectiveLimit` (we filter by identityId
    //    in application code afterwards), but we widen the
    //    DB-side window by a factor of 4 to give the in-
    //    memory filter enough headroom when the prefix
    //    matches rows for many identities (e.g. a busy
    //    superadmin running the read once a day). The factor
    //    is bounded — we never ask the DB for more than
    //    MAX_LIMIT * 4 rows — to prevent a pathological
    //    limit request from pulling the entire collection.
    //
    //    An operator wanting exact cursor-based pagination
    //    for huge logbook collections is the motivation for
    //    the future session that adds an `identityId` index
    //    + cursor to the read port.
    // -----------------------------------------------------------------
    const dbLimit = Math.min(effectiveLimit * 4, MAX_LIMIT * 4);
    const rows = await store.listLogsByDetailsPrefix(
      VAULT_DETAILS_PREFIX,
      { limit: dbLimit },
    );

    // -----------------------------------------------------------------
    // 4. Parse the rows back into the audit-record shape and
    //    filter to the requested identity. The parse helper
    //    returns `null` for non-vault rows (the prefix
    //    filter on the DB side already excludes them, but
    //    the helper is the safety net) and for malformed
    //    vault rows (a single corrupt logbook entry does
    //    not break the page).
    // -----------------------------------------------------------------
    const records: VaultAuditRecord[] = [];
    for (const row of rows) {
      const rec = parseVaultLogbookEntry(row);
      if (!rec) continue;
      if (rec.identityId !== cmd.identityId) continue;
      records.push(rec);
      if (records.length >= effectiveLimit) break;
    }

    // -----------------------------------------------------------------
    // 5. Shape the response. The list is already sorted
    //    newest-first by the DB query, so the in-memory
    //    ordering is preserved.
    // -----------------------------------------------------------------
    return {
      identityId: cmd.identityId,
      limit: effectiveLimit,
      pageSize: records.length,
      entries: records.map(toEntry),
    };
  };
}

// ---------------------------------------------------------------------------
// Mapping helper
// ---------------------------------------------------------------------------

/**
 * Project an internal `VaultAuditRecord` onto the public
 * read surface. `occurredAt` is serialized to ISO-8601 so the
 * caller never has to deal with `Date` instances. Optional
 * fields are normalized to `null` (vs. `undefined`) so the
 * response shape is predictable for downstream consumers —
 * `JSON.stringify` drops `undefined` but keeps `null`, which
 * is the JSON contract we want.
 */
function toEntry(record: VaultAuditRecord): ReadAuditHistoryEntry {
  return {
    auditId: record.auditId,
    identityId: record.identityId,
    actor: record.actor,
    action: record.action,
    outcome: record.outcome,
    reason: record.reason ?? null,
    requestId: record.requestId ?? null,
    meta: record.meta ?? null,
    occurredAt: record.occurredAt.toISOString(),
  };
}
