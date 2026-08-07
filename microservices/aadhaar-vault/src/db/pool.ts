/**
 * Database pool factory.
 *
 * The vault deliberately depends on a *narrow* contract (`PoolLike`)
 * rather than `pg.Pool` directly. This lets:
 *
 *   1. Tests inject a hand-rolled `MemoryPool` (`./memory-pool.ts`)
 *      without booting a real Postgres process.
 *   2. Production swap the driver later (e.g. `pg-promise`) without
 *      touching any repository code.
 *
 * See AADHAAR_VAULT_FREE_ARCHITECTURE.md §3.3 (Postgres at 10.61.32.72).
 */
import pg from 'pg';

import { MemoryPool } from './memory-pool.js';

export interface QueryResult<T = unknown> {
    rows: T[];
    rowCount: number;
}

export interface PoolLike {
    query<T = unknown>(
        text: string,
        params?: unknown[],
    ): Promise<{ rows: T[]; rowCount: number | null }>;
    end(): Promise<void>;
    on?(event: 'error', listener: (err: Error) => void): unknown;
}

/**
 * Narrower runner contract. Both `pg.Pool` and `pg.PoolClient`
 * (returned by `pg.Pool.connect()`) satisfy this; `MemoryPool`
 * also satisfies it. Repository adapters take a {@link QueryRunner}
 * rather than a {@link PoolLike} so the *same* adapter class
 * can be invoked with either:
 *
 *   - a pool directly (the normal path used by `db/index.ts`); or
 *   - a connected client bound to an in-progress transaction
 *     (the path used by the transactional vault writer —
 *     `src/db/adapters/postgres-transactional-vault-writer.ts`).
 *
 * `PoolClient` lacks `end()` (only `Pool` has it), so a
 * `PoolLike`-typed parameter would refuse a `PoolClient`. Widening
 * the adapters to `QueryRunner` is a structural narrowing of the
 * API surface that the adapters actually depend on (they issue
 * `query(...)` and nothing else).
 */
export interface QueryRunner {
    query<T = unknown>(
        text: string,
        params?: unknown[],
    ): Promise<{ rows: T[]; rowCount: number | null }>;
}

/**
 * Construct a real Postgres pool backed by `pg`.
 *
 * `pg` is a CommonJS module; under ESM + NodeNext it surfaces as a
 * default export whose `.Pool` is the class we want.
 */
export function createRealPool(connectionString: string): PoolLike {
    const real = new pg.Pool({ connectionString });
    return real as unknown as PoolLike;
}

/**
 * Construct an empty in-memory pool. Used by the test suite only.
 *
 * The caller is responsible for pre-declaring tables via
 * `MemoryPool.define(...)` before issuing queries. The Db wiring module
 * does this from a hand-written TypeScript schema — see
 * `createMemoryDatabase()` in `./index.ts`.
 */
export function createMemoryPool(): MemoryPool {
    return new MemoryPool();
}

/**
 * Lightweight liveness probe used by the `/health/ready` route. Returns
 * `true` if Postgres responded to `SELECT 1` within the deadline.
 */
export async function pingPool(pool: PoolLike): Promise<boolean> {
    try {
        await pool.query('SELECT 1');
        return true;
    } catch {
        return false;
    }
}