/**
 * Postgres adapter for `TokenRepository`.
 *
 * Mirrors the column shape declared in
 * `src/db/migrations/002_tokens.sql` and the equivalent
 * `MemoryPool` spec in `src/db/index.ts`. BYTEA columns round-trip
 * as `Buffer` in both `pg` and `pg-mem`, so no extra serialization
 * is required at the adapter boundary.
 *
 * The token id is supplied by the application layer (UUIDv7) — see
 * `TokenizeAadhaar`. We deliberately do not rely on a Postgres
 * `gen_random_uuid()` because auditors want a stable algorithm for
 * id derivation that does not drift across Postgres versions.
 */
import type { QueryRunner } from '../pool.js';
import type {
    NewToken,
    TokenRepository,
    TokenRow,
} from '../ports/token.repository.js';

interface PgTokenRow {
    id: string;
    identity_id: string;
    algorithm: string;
    ciphertext: Buffer;
    iv: Buffer;
    auth_tag: Buffer;
    wrapped_dek: Buffer;
    created_at: Date;
}

function mapRow(row: PgTokenRow): TokenRow {
    return {
        id: row.id,
        identityId: row.identity_id,
        algorithm: row.algorithm,
        ciphertext: row.ciphertext,
        iv: row.iv,
        authTag: row.auth_tag,
        wrappedDek: row.wrapped_dek,
        createdAt: row.created_at.getTime(),
    };
}

export class PostgresTokenRepository implements TokenRepository {
    constructor(private readonly runner: QueryRunner) {}

    async insert(token: NewToken & { id: string }): Promise<TokenRow> {
        const now = new Date();
        const { rows } = await this.runner.query<PgTokenRow>(
            `INSERT INTO vault_tokens
                (id, identity_id, algorithm, ciphertext, iv, auth_tag, wrapped_dek, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, identity_id, algorithm, ciphertext, iv, auth_tag,
                       wrapped_dek, created_at`,
            [
                token.id,
                token.identityId,
                token.algorithm,
                token.ciphertext,
                token.iv,
                token.authTag,
                token.wrappedDek,
                now,
            ],
        );
        return mapRow(rows[0]!);
    }

    async findById(id: string): Promise<TokenRow | null> {
        const { rows } = await this.runner.query<PgTokenRow>(
            `SELECT id, identity_id, algorithm, ciphertext, iv, auth_tag,
                    wrapped_dek, created_at
             FROM vault_tokens
             WHERE id = $1`,
            [id],
        );
        return rows[0] ? mapRow(rows[0]) : null;
    }
}