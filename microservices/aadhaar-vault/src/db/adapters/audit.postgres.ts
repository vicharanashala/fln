/**
 * Postgres adapter for `AuditRepository`.
 *
 * `meta` is a JSONB column. We serialize on the way in with
 * `JSON.stringify` and parse on the way out with `JSON.parse` so that
 * both `pg` and `pg-mem` (which have slightly different defaults for
 * JSONB parameter binding) behave identically.
 */
import type {
    AuditEntry,
    AuditRecord,
    AuditRepository,
} from '../ports/audit.repository.js';
import type { QueryRunner } from '../pool.js';

interface AuditRow {
    audit_id: number;
    identity_id: string | null;
    actor: string;
    action: string;
    outcome: string;
    reason: string | null;
    request_id: string | null;
    occurred_at: Date;
    meta: unknown;
}

function mapRow(row: AuditRow): AuditRecord {
    return {
        auditId: row.audit_id,
        identityId: row.identity_id,
        actor: row.actor,
        action: row.action,
        outcome: row.outcome as AuditRecord['outcome'],
        reason: row.reason,
        requestId: row.request_id,
        occurredAt: row.occurred_at,
        meta: (row.meta ?? {}) as Record<string, unknown>,
    };
}

export class PostgresAuditRepository implements AuditRepository {
    constructor(private readonly runner: QueryRunner) {}

    async append(entry: AuditEntry): Promise<number> {
        // Application-supplied timestamp so that the same `pg-mem` test
        // harness that runs the migration also runs the repositories.
        // See the note at the top of `001_initial_schema.sql`.
        const occurredAt = new Date();
        const { rows } = await this.runner.query<{ audit_id: number }>(
            `INSERT INTO vault_audit_log
                (identity_id, actor, action, outcome, reason, request_id, occurred_at, meta)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
             RETURNING audit_id`,
            [
                entry.identityId,
                entry.actor,
                entry.action,
                entry.outcome,
                entry.reason ?? null,
                entry.requestId ?? null,
                occurredAt,
                JSON.stringify(entry.meta ?? {}),
            ],
        );
        const row = rows[0];
        if (!row) {
            throw new Error(
                'PostgresAuditRepository.append: INSERT did not RETURN a row.',
            );
        }
        return row.audit_id;
    }

    async listByIdentity(
        identityId: string,
        opts?: { limit?: number },
    ): Promise<AuditRecord[]> {
        const limit = Math.max(1, Math.min(opts?.limit ?? 50, 500));
        const { rows } = await this.runner.query<AuditRow>(
            `SELECT audit_id, identity_id, actor, action, outcome,
                    reason, request_id, occurred_at, meta
             FROM vault_audit_log
             WHERE identity_id = $1
             ORDER BY occurred_at DESC
             LIMIT $2`,
            [identityId, limit],
        );
        return rows.map(mapRow);
    }
}