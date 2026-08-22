/**
 * Postgres adapter for `IdentityRepository`.
 *
 * Maps between the domain shape (`IdentityRecord`) and the row shape
 * stored in `vault_identities`. BYTEA columns round-trip as `Buffer`
 * in both `pg` and `pg-mem`, so no extra serialization is required.
 *
 * Takes a {@link QueryRunner} (not a `PoolLike`) so the *same* adapter
 * can be wired either to a bare `pg.Pool` or to a `pg.PoolClient`
 * bound to an in-progress transaction owned by
 * `PostgresTransactionalVaultWriter`. See `../pool.ts` for the
 * rationale behind the two-tier contract.
 */
import type {
    IdentityRecord,
    IdentityRepository,
    NewIdentityRecord,
} from '../ports/identity.repository.js';
import type { QueryRunner } from '../pool.js';

interface IdentityRow {
    identity_id: string;
    ciphertext: Buffer;
    aad: Buffer;
    pepper_version: number;
    key_version: number;
    created_at: Date;
    rotated_at: Date | null;
    revoked_at: Date | null;
}

function mapRow(row: IdentityRow): IdentityRecord {
    return {
        identityId: row.identity_id,
        ciphertext: row.ciphertext,
        aad: row.aad,
        pepperVersion: row.pepper_version,
        keyVersion: row.key_version,
        createdAt: row.created_at,
        rotatedAt: row.rotated_at,
        revokedAt: row.revoked_at,
    };
}

export class PostgresIdentityRepository implements IdentityRepository {
    constructor(private readonly runner: QueryRunner) {}

    async insert(rec: NewIdentityRecord): Promise<IdentityRecord> {
        const now = new Date();
        const { rows } = await this.runner.query<IdentityRow>(
            `INSERT INTO vault_identities
                (identity_id, ciphertext, aad, pepper_version, key_version, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING identity_id, ciphertext, aad,
                       pepper_version, key_version,
                       created_at, rotated_at, revoked_at`,
            [
                rec.identityId,
                rec.ciphertext,
                rec.aad,
                rec.pepperVersion,
                rec.keyVersion,
                now,
            ],
        );
        return mapRow(rows[0]!);
    }

    async getById(identityId: string): Promise<IdentityRecord | null> {
        const { rows } = await this.runner.query<IdentityRow>(
            `SELECT identity_id, ciphertext, aad,
                    pepper_version, key_version,
                    created_at, rotated_at, revoked_at
             FROM vault_identities
             WHERE identity_id = $1`,
            [identityId],
        );
        return rows[0] ? mapRow(rows[0]) : null;
    }

    async revoke(identityId: string): Promise<void> {
        const now = new Date();
        await this.runner.query(
            `UPDATE vault_identities
             SET revoked_at = $2
             WHERE identity_id = $1 AND revoked_at IS NULL`,
            [identityId, now],
        );
    }

    async rotate(identityId: string, keyVersion: number): Promise<void> {
        const now = new Date();
        await this.runner.query(
            `UPDATE vault_identities
             SET key_version = $2, rotated_at = $3
             WHERE identity_id = $1`,
            [identityId, keyVersion, now],
        );
    }
}