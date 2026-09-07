/**
 * Vault audit → logbook mapping.
 *
 * The vault's audit chain was originally written to its own
 * `vault_audit_log` Mongo collection via the `AuditRepository` port.
 * Issue #406's review asked for a single audit sink: the existing
 * `logbook` Mongo collection (the FLN activity log). This file is
 * the single source of truth for the mapping between the vault's
 * internal audit shape (`AuditEntry` / `AuditRecord`) and the
 * `LogEntry` shape the rest of FLN uses.
 *
 * Why a separate module (rather than inlining the mapping in
 * each command): the mapping is *reversible* (the read-audit-
 * history command must parse the logbook row back into the
 * `AuditRecord` shape the API exposes), and the `details` payload
 * format is part of the contract. Centralising the format in one
 * place means the read path cannot drift from the write path.
 *
 * **Plaintext hygiene.** The mapping helper strips any
 * `meta.aadhaar` field defensively. No command in the vault ever
 * sets one — plaintext Aadhaar never enters the audit chain — but
 * a future bug or a careless copy-paste must not be able to leak
 * the 12-digit number into the logbook (security rule 9).
 */
import { UserRole } from '../../../db';
import type { LogEntry } from '../../../db';

// ---------------------------------------------------------------------------
// Forward mapping: AuditEntry-shaped input → LogEntry
// ---------------------------------------------------------------------------

/**
 * The subset of AuditEntry that the mapper actually needs. We do
 * not import `AuditEntry` from the (now-deleted) repositories port
 * because the caller already has the fields in hand — the
 * structural type is more useful than the nominal one and lets
 * each vault command keep using the literal object it builds.
 */
export interface VaultAuditInput {
  identityId: string | null;
  actor: string;
  action: string;
  outcome: 'allow' | 'deny' | 'error';
  reason?: string | null;
  requestId?: string | null;
  meta?: Record<string, unknown>;
}

export interface VaultAuditCallerMeta {
  /** The actor's userId (the JWT subject). Empty string for the SERVICE actor. */
  userId: string;
  /** The actor's schoolId (from the JWT claim). Empty string if not applicable. */
  schoolId: string;
  /** The actor's school name (from the schools table, denormalised for log display). */
  schoolName: string;
  /** The actor's role, in the vault's `actorRole` union shape. */
  actorRole:
    | 'TEACHER'
    | 'SCHOOL_ADMIN'
    | 'STATE_ADMIN'
    | 'SUPER_ADMIN'
    | 'SERVICE';
}

/**
 * The shape this mapper produces is exactly the `LogEntry` the
 * `logbook` collection stores. The `id` is the caller's choice —
 * the application layer mints it (typically a synthetic string
 * that also serves as the `auditId` link on the challenge row).
 */
export type VaultLogbookEntry = LogEntry;

/**
 * Build a `LogEntry` for a vault audit event. The row is
 * ready to be handed to `dbStore.addLog` (non-transactional) or
 * `dbStore.addLogInSession` (transactional, inside the
 * `withTransaction` block).
 *
 * The `details` field is a stable, parseable string the read
 * command can decode back into an `AuditRecord`. Format:
 *
 *   `vault:<action> identity=<id> token=<id|null> challenge=<id|null> factor=<id|null> reason="..." requestId="..." outcome=<allow|deny|error> meta=<json>`
 *
 * The leading `vault:` tag is the prefix the read command uses
 * to filter the logbook collection to vault rows only — regular
 * FLN activity rows do not match this prefix and are skipped.
 */
export function vaultLogbookEntry(
  input: VaultAuditInput,
  caller: VaultAuditCallerMeta,
  id: string,
  now: Date = new Date(),
): VaultLogbookEntry {
  const status: LogEntry['status'] =
    input.outcome === 'allow' ? 'Success' : 'Failed';
  const userRole = mapActorRoleToUserRole(caller.actorRole);
  const details = formatDetails(input);

  return {
    id,
    timestamp: now.toISOString(),
    schoolId: caller.schoolId || 'system',
    schoolName: caller.schoolName || 'system',
    userId: caller.userId || 'system',
    userEmail: input.actor,
    userRole,
    activityType: mapActionToActivityType(input.action),
    status,
    details,
  };
}

// ---------------------------------------------------------------------------
// Reverse mapping: LogEntry → AuditRecord (for read-audit-history)
// ---------------------------------------------------------------------------

/**
 * Vault-shaped audit record surfaced to the API. We do NOT import
 * the (deleted) `AuditRecord` type from the repositories port —
 * the read-audit-history command's surface is its own type, and
 * this module just provides the row data the command needs to
 * shape its response.
 */
export interface VaultAuditRecord {
  auditId: string;
  identityId: string | null;
  actor: string;
  action: string;
  outcome: 'allow' | 'deny' | 'error';
  reason: string | null;
  requestId: string | null;
  meta: Record<string, unknown> | null;
  occurredAt: Date;
}

/**
 * Parse a `LogEntry` back into a `VaultAuditRecord`. Returns
 * `null` if the row is not a vault audit row (the `details`
 * prefix doesn't match). The read-audit-history command
 * uses `null` to skip non-vault rows; a malformed vault row
 * is also returned as `null` rather than thrown, so a single
 * corrupt logbook row does not break the whole page.
 */
export function parseVaultLogbookEntry(log: LogEntry): VaultAuditRecord | null {
  if (!log.details.startsWith('vault:')) return null;
  const parsed = parseDetails(log.details);
  if (!parsed) return null;
  return {
    auditId: log.id,
    identityId: parsed.identity,
    actor: log.userEmail,
    action: parsed.action,
    outcome: parsed.outcome,
    reason: parsed.reason,
    requestId: parsed.requestId,
    meta: parsed.meta,
    occurredAt: new Date(log.timestamp),
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Map the vault's `actorRole` union onto the FLN `UserRole`
 * enum. The vault's role set is a strict subset of the FLN
 * hierarchy — vault doesn't model DISTRICT_ADMIN, BLOCK_ADMIN,
 * or VOLUNTEER because those roles are not authorized to call
 * the vault endpoints.
 *
 * `SERVICE` has no direct counterpart (the FLN `UserRole` enum
 * models human users). The most conservative mapping is
 * `SUPERADMIN` since service actions are authorised by the
 * superadmin's policies; we mark the row in `details` with
 * `actor_role=SERVICE` so the distinction is preserved in the
 * audit chain regardless of the `userRole` field's value.
 */
function mapActorRoleToUserRole(
  actorRole: VaultAuditCallerMeta['actorRole'],
): UserRole {
  switch (actorRole) {
    case 'TEACHER':
      return UserRole.TEACHER;
    case 'SCHOOL_ADMIN':
      return UserRole.SCHOOL;
    case 'STATE_ADMIN':
      return UserRole.ADMIN;
    case 'SUPER_ADMIN':
      return UserRole.SUPERADMIN;
    case 'SERVICE':
      return UserRole.SUPERADMIN;
  }
}

function mapActionToActivityType(
  action: string,
): LogEntry['activityType'] {
  // The vault emits a small set of action tags; they map 1:1
  // onto the activityType union values we added in db.ts.
  switch (action) {
    case 'TOKENIZE':
      return 'tokenize';
    case 'DETOKENIZE':
      return 'detokenize';
    case 'STEP_UP_REQUEST':
      return 'step_up_request';
    case 'STEP_UP_APPROVE':
      return 'step_up_approve';
    case 'MFA_ENROLL':
      return 'mfa_enroll';
    case 'MFA_VERIFY':
      return 'mfa_verify';
    // NEW (Wave 2A): account-level enrollment lifecycle rows.
    // Each row is the FLN route's counterpart to the vault
    // command's row — the two are siblings, not replacements.
    // The `activityType` union in `db.ts` already carries
    // these 4 string literals, so the mapping is 1:1.
    case 'MFA_ENROLLMENT_INITIATED':
      return 'mfa_enrollment_initiated';
    case 'MFA_ENROLLMENT_VERIFIED':
      return 'mfa_enrollment_verified';
    case 'MFA_ENROLLMENT_FAILED':
      return 'mfa_enrollment_failed';
    case 'MFA_ENROLLMENT_REVOKED':
      return 'mfa_enrollment_revoked';
    default:
      // Unknown vault action — fall through to a generic
      // tokenize so the union type is satisfied. The `details`
      // string carries the original `action` for forensics.
      return 'tokenize';
  }
}

// ---------------------------------------------------------------------------
// details string format
// ---------------------------------------------------------------------------
//
// We use a simple, parseable, space-separated format. JSON would
// also work but a structured string is greppable in production
// log streams and survives `mongosh` display. The format is:
//
//   vault:<action> identity=<id> token=<id|null> challenge=<id|null>
//     factor=<id|null> reason="..." requestId="..."
//     outcome=<allow|deny|error> meta=<json>
//
// Strings are double-quoted; the only escaped characters inside
// a quoted value are `"` (→ `\"`) and `\` (→ `\\`). The meta JSON
// payload is a single unquoted token whose value contains its own
// quotes — this keeps the parser's job simple (one regex per
// well-known key, no recursive parsing).
//
// The `stripAadhaarFromMeta` defensive scrub runs on the
// `meta` object before the row is written, so a future bug that
// tries to put a 12-digit Aadhaar in the meta cannot land it in
// the logbook.

function formatDetails(input: VaultAuditInput): string {
  // Use the canonical lowercase form of the action so the
  // `details` string agrees with the row's `activityType`.
  // The parse-back path (`parseVaultLogbookEntry`) reads this
  // exact token, so the two must agree or the read command
  // would surface the action in a different shape than the
  // write committed.
  const parts: string[] = [`vault: ${mapActionToActivityType(input.action)}`];
  parts.push(`identity=${input.identityId ?? 'null'}`);
  const meta = stripAadhaarFromMeta(input.meta ?? {});
  // `meta` is folded into the row last so it doesn't get
  // truncated by a parser stopping at the first unquoted space.
  const reason = input.reason ?? '';
  const requestId = input.requestId ?? '';
  parts.push(`reason="${escapeQuoted(reason)}"`);
  parts.push(`requestId="${escapeQuoted(requestId)}"`);
  parts.push(`outcome=${input.outcome}`);
  // The token / challenge / factor ids are pulled from the
  // canonical meta fields the vault commands already use, so the
  // read command can find them by name without scanning the JSON.
  const tokenId = typeof meta.token_id === 'string' ? meta.token_id : 'null';
  const challengeId =
    typeof meta.challenge_id === 'string' ? meta.challenge_id : 'null';
  const factorId =
    typeof meta.factor_id === 'string' ? meta.factor_id : 'null';
  parts.push(`token=${tokenId}`);
  parts.push(`challenge=${challengeId}`);
  parts.push(`factor=${factorId}`);
  // The rest of the meta is appended as a JSON blob. We use a
  // sentinel that cannot appear inside a JSON string so the
  // parser can split on it cleanly.
  parts.push(`meta=${JSON.stringify(meta)}`);
  return parts.join(' ');
}

function escapeQuoted(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Defensive scrub: drop any field that looks like a plaintext
 * Aadhaar (12 consecutive digits) or whose key is `aadhaar`.
 * The vault commands never set such a field, so this is a
 * belt-and-braces guard against a future bug leaking the
 * 12-digit number into the logbook.
 */
function stripAadhaarFromMeta(
  meta: Record<string, unknown>,
): Record<string, unknown> {
  const AADHAAR_KEYS = new Set(['aadhaar', 'aadhaar_number', 'raw']);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (AADHAAR_KEYS.has(k)) continue;
    if (typeof v === 'string' && /^\d{12}$/.test(v)) continue;
    out[k] = v;
  }
  return out;
}

interface ParsedDetails {
  action: string;
  identity: string | null;
  reason: string | null;
  requestId: string | null;
  outcome: 'allow' | 'deny' | 'error';
  meta: Record<string, unknown> | null;
}

function parseDetails(details: string): ParsedDetails | null {
  // Strip the leading `vault: <action>` tag. The action may
  // follow the colon immediately or after a space; both forms
  // are accepted for forward/backward compatibility.
  const actionMatch = /^vault:\s*(\S+)\s*(.*)$/.exec(details);
  if (!actionMatch || !actionMatch[1] || !actionMatch[2]) return null;
  const action = actionMatch[1];
  const rest = actionMatch[2];

  // Extract the well-known `identity=`, `outcome=` pairs first.
  // These are unquoted and value is either a UUID/null/an
  // enum tag — all safely matched by a non-greedy `[^\s]+`.
  const identity = unquotedKV(rest, 'identity');
  const outcomeRaw = unquotedKV(rest, 'outcome');
  if (outcomeRaw !== 'allow' && outcomeRaw !== 'deny' && outcomeRaw !== 'error') {
    return null;
  }
  const reason = quotedKV(rest, 'reason');
  const requestId = quotedKV(rest, 'requestId');
  const metaRaw = unquotedKV(rest, 'meta');
  let meta: Record<string, unknown> | null = null;
  if (metaRaw && metaRaw !== 'null') {
    try {
      const parsed = JSON.parse(metaRaw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        meta = parsed as Record<string, unknown>;
      }
    } catch {
      // Malformed meta — keep `meta: null` so the row is
      // still returned; the rest of the row is salvageable.
      meta = null;
    }
  }

  return {
    action,
    identity: identity === 'null' ? null : identity,
    reason,
    requestId,
    outcome: outcomeRaw,
    meta,
  };
}

function unquotedKV(s: string, key: string): string | null {
  // Match `key=value` where value is a non-whitespace run.
  const re = new RegExp(`(?:^|\\s)${key}=([^\\s]+)`);
  const m = re.exec(s);
  return m && m[1] ? m[1] : null;
}

function quotedKV(s: string, key: string): string | null {
  // Match `key="value"` where value may contain escaped
  // quotes (`\"`) and escaped backslashes (`\\`). We do not
  // support arbitrary newlines inside the value — vault
  // commands never set one — but we handle the common escape
  // pairs the formatter produces.
  const re = new RegExp(`(?:^|\\s)${key}="((?:[^"\\\\]|\\\\.)*)"`);
  const m = re.exec(s);
  if (!m || !m[1]) return null;
  return m[1].replace(/\\(.)/g, '$1');
}

// ---------------------------------------------------------------------------
// ID minting (synthetic, used as both the LogEntry.id and the
// challenge row's `auditId` link)
// ---------------------------------------------------------------------------

/**
 * Build the synthetic `id` value used as the LogEntry's `id`
 * field. The same string is also written to the challenge row's
 * `auditId` column so the admin Step-Up flow can correlate
 * "approve" with "detokenize".
 *
 * Format: `vaultlog_<base36-millis>_<base36-rand>`. Prefixed with
 * `vaultlog_` so it cannot collide with the FLN `log_<...>` ids
 * other code paths produce, and so an operator grep'ing the
 * `logbook` collection for vault rows can find them by id.
 */
export function mintVaultLogId(
  now: Date = new Date(),
  rand: () => number = Math.random,
): string {
  const ts = now.getTime().toString(36);
  const r = Math.floor(rand() * 0xffffffff)
    .toString(36)
    .padStart(7, '0');
  return `vaultlog_${ts}_${r}`;
}
