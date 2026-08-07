/**
 * `ReadAuditHistory` command — application-layer use case (Session 5C).
 *
 * Read-only entry point over the `AuditRepository` (defined in
 * `src/db/ports/audit.repository.ts`). The command is the only place
 * that knows the §6.x-ish "read audit history" contract: validate →
 * paginate within the existing port's surface → shape the response.
 *
 * Layering rules (clean architecture):
 *
 *   - This file knows about *domain* rules (non-empty `identityId`,
 *     `limit` must be a positive integer, `limit` is capped at the
 *     server-side maximum) and orchestrates the port. It does NOT
 *     import any infrastructure adapter (`pg`, `node:crypto`, etc.).
 *   - All persistence goes through `AuditRepository.listByIdentity`,
 *     which is the only seam the command has. The production adapter
 *     is real Postgres `ORDER BY occurred_at DESC LIMIT N`; the test
 *     adapter is an in-memory fake.
 *   - This command does NOT write a new audit row. The audit chain
 *     is append-only; a read is a read, and the existing row chain
 *     is the authoritative record. Logging or correlating the read
 *     itself is a cross-cutting concern the call site handles (e.g.
 *     Fastify request log), not the application command.
 *
 * **Pagination.** The current `AuditRepository.listByIdentity` port
 * exposes only `limit` (no `offset`, no cursor). Session 5C scopes
 * the change to the application layer only — the repository is
 * intentionally not redesigned. So the command offers a *windowed*
 * read: a single page of up to `limit` records, ordered by the
 * adapter's own canonical ordering (most recent first; the
 * production adapter enforces this in `ORDER BY occurred_at DESC`).
 * Future sessions that introduce offset/cursor-based pagination on
 * the audit port will not need to change this command's surface.
 *
 * **Plaintext hygiene.** This command does not touch any plaintext
 * or secret material — audit records are stored as opaque `meta`
 * blobs that the application never decrypts. There is no `finally`
 * buffer-zeroing to do, mirroring the wider rule that the command
 * is only responsible for secret buffers whose lifetime it owns.
 */
import type {
    AuditRecord,
    AuditRepository,
} from '../../db/ports/audit.repository.js';

// ---------------------------------------------------------------------------
// Public types — the "read audit history" contract surface
// ---------------------------------------------------------------------------

/**
 * Caller context. Mirrors `TokenizeCallerContext` so the audit chain
 * downstream sees a consistent actor triple (who, why, from where)
 * regardless of which command wrote it. The context here is *not*
 * persisted as a new audit row (read = read; see the file-level
 * comment), but it is the right shape for a future route handler
 * that wants to log the read alongside the call site.
 *
 * `requestId` is opaque — typically the inbound HTTP `X-Request-Id`
 * or an upstream correlation id. `actorRole` is one of the well-known
 * RBAC tags; kept as a string union so future roles don't require a
 * code change here.
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
 * `limit` is optional; when omitted the command uses {@link DEFAULT_LIMIT}.
 * When supplied, the command validates it is a positive integer and
 * silently caps it at {@link MAX_LIMIT} so an operator can't pull the
 * entire chain in a single round-trip.
 */
export interface ReadAuditHistoryCommand {
    identityId: string;
    limit?: number;
    context: ReadAuditHistoryCallerContext;
}

/**
 * Single audit record shaped for the v0.1 read surface. Field names
 * match the `AuditRecord` port except `occurredAt` is stringified to
 * ISO-8601 so the caller (HTTP layer, log, downstream consumer) never
 * has to think about `Date` serialization.
 */
export interface ReadAuditHistoryEntry {
    auditId: number;
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
 * `limit` echoes the *effective* limit (post-capping) so the caller
 * can tell when their requested `limit` was clamped. `pageSize` is
 * the actual number of records returned; `entries.length` is the
 * same value but the explicit field avoids forcing the caller to
 * branch on `entries` being empty.
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
 * Error class with a stable `code` so the HTTP layer can map to 4xx
 * without sniffing message text. Mirrors `TokenizeCommandError` —
 * the names are purposely distinct so a `try/catch` on one doesn't
 * accidentally swallow the other.
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
 * Server-side default page size. Used when the caller does not
 * specify `limit`. Kept small (50) so the response stays bounded
 * for normal UI consumers; an analyst wanting more passes `limit`
 * explicitly up to {@link MAX_LIMIT}.
 */
const DEFAULT_LIMIT = 50;

/**
 * Server-side maximum page size. A caller asking for `limit: 10000`
 * is silently capped to this value rather than rejected — the
 * command prefers a degraded-but-successful response over a hard
 * 400 for what is otherwise a valid request.
 */
const MAX_LIMIT = 200;

// ---------------------------------------------------------------------------
// Command factory
// ---------------------------------------------------------------------------

/**
 * Dependencies the command needs. The single persistence port is
 * `audit.read`: there is no `vaultWriter.runWrite` here because this
 * is a read-only command. The architecture stays consistent —
 * persistence is still behind a port, never reached directly.
 *
 * `clock` is accepted for interface parity with `TokenizeAadhaar`
 * (and any future command that needs to stamp a row) but is *not*
 * used by this command today: the audit row's `occurredAt` is the
 * canonical timestamp, not "when the read happened".
 */
export interface ReadAuditHistoryDeps {
    audit: AuditRepository;
    clock?: () => Date;
}

/**
 * Factory returns the bound command function. Style mirrors
 * `makeTokenizeAadhaar`: `deps` in, async function out.
 */
export function makeReadAuditHistory(deps: ReadAuditHistoryDeps) {
    return async function readAuditHistory(
        cmd: ReadAuditHistoryCommand,
    ): Promise<ReadAuditHistoryResult> {
        // -----------------------------------------------------------------
        // 1. Validate identityId. The audit chain keys off the
        //    subjectHash UUID; an empty string is a programming error
        //    and must surface loudly as INVALID_INPUT rather than
        //    silently returning an empty list (which would mask a
        //    caller-side bug).
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
        // 2. Resolve `limit`. Default when absent; validate when present;
        //    clamp to MAX_LIMIT. We do NOT reject an over-large limit —
        //    silent clamping is friendlier to API clients and the
        //    `limit` field in the response echoes the effective value.
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
        // 3. Delegate to the audit port. The port returns
        //    `AuditRecord[]` ordered by the adapter's canonical ordering
        //    (most recent first by the production adapter's
        //    `ORDER BY occurred_at DESC`). The command does not
        //    sort, deduplicate, or enrich the rows.
        // -----------------------------------------------------------------
        const records = await deps.audit.listByIdentity(cmd.identityId, {
            limit: effectiveLimit,
        });

        // -----------------------------------------------------------------
        // 4. Shape the response. `toEntry` is the only place the
        //    `AuditRecord` → `ReadAuditHistoryEntry` mapping lives,
        //    so the surface here is the single source of truth for
        //    what the read endpoint exposes.
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
 * Project an internal `AuditRecord` onto the public read surface.
 * `occurredAt` is serialized to ISO-8601 so the caller never has to
 * deal with `Date` instances. Optional fields are normalized to
 * `null` (vs. `undefined`) so the response shape is predictable
 * for downstream consumers — `JSON.stringify` drops `undefined`
 * but keeps `null`, which is the JSON contract we want.
 */
function toEntry(record: AuditRecord): ReadAuditHistoryEntry {
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