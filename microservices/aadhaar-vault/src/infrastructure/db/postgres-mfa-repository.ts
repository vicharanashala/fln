/**
 * Postgres adapter for the MFA factor repository.
 *
 * Replaces `db/adapters/mfa.postgres.ts` (which targeted the old
 * `vault_mfa_challenges` schema). Phase 2 of Session 5 renamed the
 * table to `vault_mfa_factors` and added five TOTP-shaped columns;
 * this adapter speaks the new shape verbatim.
 *
 * Column mapping
 *   factor_id        <-> factor_id          (UUID, text-shaped)
 *   actor            <-> actor
 *   factor_type      <-> factor_type        ('totp' today)
 *   status           <-> status             ('active' | 'revoked')
 *   label            <-> label              (NEW)
 *   encrypted_secret <-> encrypted_secret   (NEW, BYTEA)
 *   algorithm        <-> algorithm          (NEW)
 *   digits           <-> digits             (NEW, INTEGER)
 *   period           <-> period             (NEW, INTEGER)
 *   last_used_at     <-> last_used_at       (renamed from consumed_at)
 *   expires_at       <-> expires_at         (now nullable)
 *   created_at       <-> created_at         (supplied by app, NOT default)
 *
 * Pool compat
 *   Tested against the in-process MemoryPool (`src/db/memory-pool.ts`)
 *   which mirrors the same column shapes. The production Postgres
 *   pool (`src/db/pool.ts`) is the same `PoolLike` interface, so the
 *   SQL is one adapter for both.
 */
import type {
    InsertMfaFactorInput,
    MfaFactor,
    MfaFactorRepository,
    MfaFactorStatus,
    MfaFactorType,
} from '../../application/ports/mfa-repository.js';
import type { PoolLike } from '../../db/pool.js';

interface MfaRow {
    factor_id: string;
    actor: string;
    factor_type: string;
    status: string;
    label: string;
    encrypted_secret: Buffer | Uint8Array;
    algorithm: string;
    digits: number;
    period: number;
    last_used_at: Date | null;
    expires_at: Date | null;
    created_at: Date;
}

function toBuffer(raw: Buffer | Uint8Array): Buffer {
    return Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
}

function mapRow(row: MfaRow): MfaFactor {
    return {
        factorId: row.factor_id,
        actor: row.actor,
        factorType: row.factor_type as MfaFactorType,
        status: row.status as MfaFactorStatus,
        label: row.label,
        encryptedSecret: toBuffer(row.encrypted_secret),
        algorithm: row.algorithm,
        digits: row.digits,
        period: row.period,
        lastUsedAt: row.last_used_at,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
    };
}

const SELECT_COLUMNS = `
    factor_id, actor, factor_type, status, label,
    encrypted_secret, algorithm, digits, period,
    last_used_at, expires_at, created_at
`;

export class PostgresMfaFactorRepository implements MfaFactorRepository {
    constructor(private readonly pool: PoolLike) {}

    async insert(rec: InsertMfaFactorInput): Promise<MfaFactor> {
        // created_at is supplied by the application so the schema
        // stays portable across pg, pg-mem, and any future adapter.
        const createdAt = new Date();
        const { rows } = await this.pool.query<MfaRow>(
            `INSERT INTO vault_mfa_factors
                (factor_id, actor, factor_type, status, label,
                 encrypted_secret, algorithm, digits, period,
                 expires_at, created_at)
             VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, $8, $9, $10)
             RETURNING ${SELECT_COLUMNS}`,
            [
                rec.factorId,
                rec.actor,
                rec.factorType,
                rec.label,
                rec.encryptedSecret,
                rec.algorithm,
                rec.digits,
                rec.period,
                rec.expiresAt ?? null,
                createdAt,
            ],
        );
        return mapRow(rows[0]!);
    }

    async markUsed(
        factorId: string,
        usedAt: Date,
    ): Promise<MfaFactor | null> {
        const { rows } = await this.pool.query<MfaRow>(
            `UPDATE vault_mfa_factors
             SET last_used_at = $2
             WHERE factor_id = $1
             RETURNING ${SELECT_COLUMNS}`,
            [factorId, usedAt],
        );
        return rows[0] ? mapRow(rows[0]) : null;
    }

    async revoke(factorId: string): Promise<MfaFactor | null> {
        const { rows } = await this.pool.query<MfaRow>(
            `UPDATE vault_mfa_factors
             SET status = 'revoked'
             WHERE factor_id = $1 AND status = 'active'
             RETURNING ${SELECT_COLUMNS}`,
            [factorId],
        );
        if (rows[0]) return mapRow(rows[0]);
        // Either the row doesn't exist, or it was already revoked.
        // Look it up so the caller still gets the row when revoking
        // an already-revoked factor (idempotency).
        return this.getById(factorId);
    }

    async getById(factorId: string): Promise<MfaFactor | null> {
        const { rows } = await this.pool.query<MfaRow>(
            `SELECT ${SELECT_COLUMNS}
             FROM vault_mfa_factors
             WHERE factor_id = $1`,
            [factorId],
        );
        return rows[0] ? mapRow(rows[0]) : null;
    }

    async listByActor(actor: string): Promise<MfaFactor[]> {
        const { rows } = await this.pool.query<MfaRow>(
            `SELECT ${SELECT_COLUMNS}
             FROM vault_mfa_factors
             WHERE actor = $1
             ORDER BY created_at DESC`,
            [actor],
        );
        return rows.map(mapRow);
    }

    async listActiveByActor(actor: string): Promise<MfaFactor[]> {
        const { rows } = await this.pool.query<MfaRow>(
            `SELECT ${SELECT_COLUMNS}
             FROM vault_mfa_factors
             WHERE actor = $1 AND status = 'active'
             ORDER BY created_at DESC`,
            [actor],
        );
        return rows.map(mapRow);
    }
}