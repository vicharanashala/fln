/**
 * Transactional write unit-of-work for the `TokenizeAadhaar` command.
 *
 * # Why a port
 *
 * The command writes to three tables — `vault_identities`, `vault_tokens`,
 * `vault_audit_log` — and these three writes must succeed **or fail
 * together**. If `vault_tokens.insert(...)` succeeds but
 * `vault_audit_log.append(...)` fails (e.g. disk full, deadlock, broken
 * connection) the vault would end up holding an unwrapped ciphertext row
 * with no audit trail of *who* tokenized it. That is unacceptable under
 * the threat model in `AADHAAR_VAULT.md`.
 *
 * Wrapping the three writes in a single Postgres `BEGIN`/`COMMIT` block
 * is the standard fix. But there are two competing ways to express it,
 * and we deliberately want neither of them to leak into the command:
 *
 *   - Passing raw `pg.PoolClient` handles around — leaks `pg` into the
 *     application layer, which the architecture doc says must depend
 *     only on application-layer ports.
 *   - Putting the txn inside each repository — would force the command
 *     to `BEGIN` itself, which is again an `pg` leak.
 *
 * Instead we expose a {@link TransactionalVaultWriter} port. The command
 * receives a `VaultWriteConnection` (the three repo handles it needs)
 * and asks the writer to commit or roll back. The writer may use
 * Postgres `BEGIN`/`COMMIT` under the hood (production adapter) or an
 * in-memory savepoint (test adapter); the command is identical either
 * way.
 *
 * # Event publishing
 *
 * The `tokenize.aadhaar` event is *not* published inside this
 * transaction. Events are best-effort and live in a different store; if
 * the audit log commit fails we still want the event publisher to
 * record "tokenize attempted", and if the txn commits we still want
 * the audit row to be the authoritative record. See the command for
 * the precise ordering.
 */
import type { AuditEntry } from '../../db/ports/audit.repository.js';
import type { NewIdentityRecord } from '../../db/ports/identity.repository.js';
import type { NewToken, TokenRow } from '../../db/ports/token.repository.js';

/**
 * The set of write operations the command is allowed to perform inside
 * one transactional unit. Only methods the command actually needs are
 * exposed; the command must not reach for unrelated repository
 * capabilities from within a transaction (e.g. `revoke`, `rotate`).
 */
export interface VaultWriteConnection {
    insertIdentity(rec: NewIdentityRecord): Promise<void>;
    insertToken(token: NewToken & { id: string }): Promise<TokenRow>;
    appendAudit(entry: AuditEntry): Promise<void>;
}

/**
 * Wraps a unit of work in a single vault transaction.
 *
 * The writer is responsible for:
 *
 *   - Opening a transactional scope (Postgres `BEGIN` or equivalent);
 *   - Handing the work a {@link VaultWriteConnection} bound to that
 *     scope;
 *   - Committing if the work resolves;
 *   - Rolling back if the work throws, then re-throwing;
 *   - Releasing the underlying connection in `finally`.
 *
 * The work may return any value, which is propagated to the caller.
 */
export interface TransactionalVaultWriter {
    runWrite<T>(work: (conn: VaultWriteConnection) => Promise<T>): Promise<T>;
}