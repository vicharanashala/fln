/**
 * In-memory adapter for {@link TransactionalVaultWriter}.
 *
 * Wraps a unit of work with the *same* Postgres repository classes used
 * in production, but bound to a {@link MemoryPool} instead of a real
 * `pg.Pool`. The Postgres repositories depend only on the structural
 * {@link QueryRunner} interface, which `MemoryPool` happens to satisfy,
 * so the same `INSERT`/`UPDATE`/`SELECT` statements run against the
 * hand-rolled table store. This keeps test parity: any SQL the
 * production adapter issues, the test driver issues too.
 *
 * The intent is *test parity*, not real atomicity:
 *
 *   - If the work resolves, the writer propagates the resolved value.
 *   - If the work throws, the writer rethrows. The `MemoryPool` has no
 *     `BEGIN`/`COMMIT` semantics, so partial writes that already
 *     landed remain visible to subsequent reads. This is acceptable
 *     for unit tests, which assert on the *command* layer's branching
 *     (e.g. "no writes occur when the key manager throws") rather than
 *     on mid-flight storage state.
 *
 * Production deployments always use
 * {@link PostgresTransactionalVaultWriter}.
 */
import type {
    TransactionalVaultWriter,
    VaultWriteConnection,
} from '../../application/ports/transactional-vault-writer.js';
import type { QueryRunner } from '../pool.js';

import { PostgresAuditRepository } from './audit.postgres.js';
import { PostgresIdentityRepository } from './identity.postgres.js';
import { PostgresTokenRepository } from './token.postgres.js';

export class MemoryTransactionalVaultWriter
    implements TransactionalVaultWriter
{
    constructor(private readonly runner: QueryRunner) {}

    async runWrite<T>(
        work: (conn: VaultWriteConnection) => Promise<T>,
    ): Promise<T> {
        const conn: VaultWriteConnection = {
            insertIdentity: (rec) =>
                new PostgresIdentityRepository(this.runner)
                    .insert(rec)
                    .then(() => undefined),
            insertToken: (token) =>
                new PostgresTokenRepository(this.runner).insert(token),
            appendAudit: (entry) =>
                new PostgresAuditRepository(this.runner).append(entry),
        };
        return work(conn);
    }
}