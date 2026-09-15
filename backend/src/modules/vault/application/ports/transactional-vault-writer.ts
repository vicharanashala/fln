/**
 * Transactional write unit-of-work (ported verbatim from
 * src/application/ports/transactional-vault-writer.ts).
 *
 * The command writes to three collections — `vault_identities`,
 * `vault_tokens`, and the FLN `logbook` (the unified audit sink) — and
 * these three writes must succeed **or fail together**. If
 * `vault_tokens.insert(...)` succeeds but the logbook write fails (e.g.
 * disk full, deadlock, broken connection) the vault would end up holding
 * an unwrapped ciphertext row with no audit trail of *who* tokenized it.
 * That is unacceptable.
 *
 * Wrapping the three writes in a single `withTransaction` block is the
 * standard fix. The Mongo adapter
 * (`infrastructure/db/mongo-transactional-vault-writer.ts`) uses
 * `db.startSession() + session.withTransaction()`; the in-memory test
 * adapter (if needed) is just a closure. The command is identical either
 * way.
 *
 * Per issue #406's review, the audit sink is now the existing FLN
 * `logbook` collection (not a separate `vault_audit_log` table). The
 * `writeLog` method writes a `LogEntry` (the FLN activity-log row
 * shape) into `logbook` *inside* the same Mongo session, so the audit
 * row commits or rolls back atomically with the identity / token rows.
 * The naive refactor ("call `dbStore.addLog()` after the transaction
 * commits") would break the identity+token+audit atomicity invariant —
 * this `writeLog` is the method that keeps the guarantee.
 */
import type { LogEntry } from '../../../../db';
import type { NewIdentityRecord } from './repositories';
import type { NewToken, TokenRow } from './repositories';

/**
 * The set of write operations the command is allowed to perform inside
 * one transactional unit. Only methods the command actually needs are
 * exposed; the command must not reach for unrelated repository
 * capabilities from within a transaction (e.g. `revoke`, `rotate`).
 */
export interface VaultWriteConnection {
  insertIdentity(rec: NewIdentityRecord): Promise<void>;
  insertToken(token: NewToken & { id: string }): Promise<TokenRow>;
  /**
   * Write a `LogEntry` row to the FLN `logbook` collection, inside the
   * same Mongo session that the identity / token writes are using. The
   * row commits or rolls back atomically with the rest of the unit of
   * work. The caller is responsible for shaping the `LogEntry` (see
   * `backend/src/modules/vault/audit/logbook-entry.ts`); this method
   * just persists it.
   */
  writeLog(entry: LogEntry): Promise<void>;
}

/**
 * Wraps a unit of work in a single vault transaction.
 *
 * The writer is responsible for:
 *
 *   - Opening a transactional scope (Mongo `withTransaction` or equivalent);
 *   - Handing the work a `VaultWriteConnection` bound to that
 *     scope;
 *   - Committing if the work resolves;
 *   - Rolling back if the work throws, then re-throwing;
 *   - Releasing the underlying session in `finally`.
 *
 * The work may return any value, which is propagated to the caller.
 */
export interface TransactionalVaultWriter {
  runWrite<T>(work: (conn: VaultWriteConnection) => Promise<T>): Promise<T>;
}
