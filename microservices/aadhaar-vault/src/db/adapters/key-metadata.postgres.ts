/**
 * Postgres adapter for `KeyMetadataRepository`.
 *
 * The DB enforces the `status = 'active'` default. `markRetired` and
 * `markDestroyed` are idempotent: calling them twice is a no-op rather
 * than an error.
 */
import type {
    KeyMetadataRecord,
    KeyMetadataRepository,
    KeyStatus,
    NewKeyMetadataRecord,
} from '../ports/key-metadata.repository.js';
import type { PoolLike } from '../pool.js';

interface KeyRow {
    key_id: string;
    algorithm: string;
    pepper_version: number;
    status: string;
    created_at: Date;
    retired_at: Date | null;
    destroyed_at: Date | null;
}

function mapRow(row: KeyRow): KeyMetadataRecord {
    return {
        keyId: row.key_id,
        algorithm: row.algorithm,
        pepperVersion: row.pepper_version,
        status: row.status as KeyStatus,
        createdAt: row.created_at,
        retiredAt: row.retired_at,
        destroyedAt: row.destroyed_at,
    };
}

export class PostgresKeyMetadataRepository implements KeyMetadataRepository {
    constructor(private readonly pool: PoolLike) {}

    async insert(rec: NewKeyMetadataRecord): Promise<KeyMetadataRecord> {
        // `created_at` is supplied by the application so the schema is
        // portable to `pg-mem` (which doesn't parse `DEFAULT now()`).
        const createdAt = new Date();
        const { rows } = await this.pool.query<KeyRow>(
            `INSERT INTO vault_key_metadata
                (key_id, algorithm, pepper_version, created_at)
             VALUES ($1, $2, $3, $4)
             RETURNING key_id, algorithm, pepper_version, status,
                       created_at, retired_at, destroyed_at`,
            [rec.keyId, rec.algorithm, rec.pepperVersion, createdAt],
        );
        return mapRow(rows[0]!);
    }

    async getActive(
        pepperVersion: number,
    ): Promise<KeyMetadataRecord | null> {
        const { rows } = await this.pool.query<KeyRow>(
            `SELECT key_id, algorithm, pepper_version, status,
                    created_at, retired_at, destroyed_at
             FROM vault_key_metadata
             WHERE pepper_version = $1 AND status = 'active'
             ORDER BY created_at DESC
             LIMIT 1`,
            [pepperVersion],
        );
        return rows[0] ? mapRow(rows[0]) : null;
    }

    async markRetired(keyId: string): Promise<void> {
        const retiredAt = new Date();
        await this.pool.query(
            `UPDATE vault_key_metadata
             SET status = 'retired', retired_at = $2
             WHERE key_id = $1 AND status = 'active'`,
            [keyId, retiredAt],
        );
    }

    async markDestroyed(keyId: string): Promise<void> {
        const destroyedAt = new Date();
        await this.pool.query(
            `UPDATE vault_key_metadata
             SET status = 'destroyed', destroyed_at = $2
             WHERE key_id = $1 AND status IN ('active', 'retired')`,
            [keyId, destroyedAt],
        );
    }
}