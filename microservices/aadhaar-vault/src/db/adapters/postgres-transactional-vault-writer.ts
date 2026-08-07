/**
 * Production adapter for {@link TransactionalVaultWriter}.
 *
 * Wraps the work in a real Postgres transaction by acquiring a
 * dedicated client from the pool (`pool.connect()`), issuing
 * `BEGIN`/`COMMIT`/`ROLLBACK` on it, and releasing the client in
 * `finally` even if the work or the commit throws.
 *
 * # Why a dedicated client
 *
 * `pg.Pool` does not provide `BEGIN`/`COMMIT` primitives directly.
 * Each transaction must run on a single `PoolClient` so that every
 * `query(...)` issued by the in-flight work is bound to the same
 * backend session. Releasing the client back to the pool at the end
 * of the unit-of-work is mandatory — `pg` only cleans up sockets
 * when its internal queue is empty, so a leaked client eventually
 * starves the pool.
 *
 * # Adapter parameter type
 *
 * The constructor takes a `PoolLike`. Internally we cast it to the
 * structurally-richer `pg.Pool` only to reach `connect()`. This is
 * safe because `db/index.ts` is the only call site and it always
 * passes the real `pg.Pool`; the test suite wires the memory adapter
 * instead (`memory-transactional-vault-writer.ts`).
 *
 * The returned `pg.PoolClient` is fed directly to the Postgres
 * repositories, which accept a {@link QueryRunner} (a structural
 * subset of `pg.Pool` that `pg.PoolClient` also happens to satisfy).
 * No extra interface declaration is needed.
 */
import pg from 'pg';

import type {
    TransactionalVaultWriter,
    VaultWriteConnection,
} from '../../application/ports/transactional-vault-writer.js';
import type { PoolLike } from '../pool.js';

import { PostgresAuditRepository } from './audit.postgres.js';
import { PostgresIdentityRepository } from './identity.postgres.js';
import { PostgresTokenRepository } from './token.postgres.js';

/**
 * Structural shape required from the underlying driver. `pg.Pool`
 * satisfies it; the test suite substitutes the in-memory adapter
 * (which does not).
 */
interface TransactionalPool extends PoolLike {
    connect(): Promise<pg.PoolClient>;
}

export class PostgresTransactionalVaultWriter
    implements TransactionalVaultWriter
{
    private readonly pgPool: TransactionalPool;

    constructor(pool: PoolLike) {
        this.pgPool = pool as unknown as TransactionalPool;
    }

    async runWrite<T>(
        work: (conn: VaultWriteConnection) => Promise<T>,
    ): Promise<T> {
        const client = await this.pgPool.connect();
        try {
            await client.query('BEGIN');
            const conn: VaultWriteConnection = {
                insertIdentity: (rec) =>
                    new PostgresIdentityRepository(client).insert(rec).then(
                        () => undefined,
                    ),
                insertToken: (token) =>
                    new PostgresTokenRepository(client).insert(token),
                appendAudit: (entry) =>
                    new PostgresAuditRepository(client)
                        .append(entry)
                        .then(
                            () => undefined,
                        ),
            };
            try {
                const result = await work(conn);
                await client.query('COMMIT');
                return result;
            } catch (err) {
                try {
                    await client.query('ROLLBACK');
                } catch (rollbackErr) {
                    // Surface the original error; attach the rollback
                    // failure as `cause` if we have an Error subclass
                    // that supports it (Node 16.9+).
                    if (
                        err instanceof Error &&
                        'cause' in err &&
                        rollbackErr instanceof Error
                    ) {
                        (err as Error & { cause?: unknown }).cause =
                            rollbackErr;
                    }
                }
                throw err;
            }
        } finally {
            // Returns the client to the pool. Passing no argument
            // signals a clean return and lets `pg` reuse the socket
            // immediately.
            client.release();
        }
    }
}