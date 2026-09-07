/**
 * GET /v1/audit — Express route handler (Phase 3).
 *
 * Read-only audit history endpoint. Returns the most recent
 * `limit` audit rows for the requested `identityId` (a subjectHash
 * UUID), most recent first. The route delegates to the in-process
 * `makeReadAuditHistory` command.
 *
 * Wire shape: `GET /v1/audit?identityId=<uuid>&limit=<n>` (also
 * accepts a JSON body with the same fields, for clients that
 * prefer POST-style semantics).
 * Response: `{ identityId, limit, pageSize, entries: [...] }`
 *   - `entries[i].auditId` is a stringified ObjectId (a string,
 *     not a number — see the read-audit-history command for the
 *     shape-reconciliation note).
 *
 * **Scope.** `vault:audit:read` is distinct from
 * `vault:detokenize` so an analyst who should be able to *read*
 * the audit log cannot *consume* a step-up challenge. (Tokenize,
 * detokenize, and read are three separate scopes so the principle
 * of least privilege is preserved on the caller's side.)
 *
 * Error mapping: every error path is a `ReadAuditHistoryCommandError`
 * (or a `VaultError` we wrap). The mapping from `code` -> HTTP
 * status lives in `../errors.ts`.
 */
import type { Request, Response, Router } from 'express';
import express from 'express';
import { requireScope } from '../middleware';
import { VaultError } from '../errors';
import type { VaultErrorCode } from '../errors';
import type { ReadAuditHistoryCallerContext } from '../application/commands/read-audit-history';
import { ReadAuditHistoryCommandError } from '../application/commands/read-audit-history';
import type { VaultContext } from '../context';

interface AuditRequestBody {
  identityId?: unknown;
  limit?: unknown;
  context?: unknown;
}

function asString(v: unknown, field: string): string {
  if (typeof v !== 'string') {
    throw new VaultError('INVALID_INPUT', `field "${field}" must be a string.`, 400);
  }
  return v;
}

function asContext(v: unknown): ReadAuditHistoryCallerContext {
  if (!v || typeof v !== 'object') {
    throw new VaultError('INVALID_INPUT', 'field "context" must be an object.', 400);
  }
  const o = v as Record<string, unknown>;
  return {
    actorId: asString(o.actorId, 'context.actorId'),
    actorRole: asString(o.actorRole, 'context.actorRole') as ReadAuditHistoryCallerContext['actorRole'],
    reason: asString(o.reason, 'context.reason'),
    requestId: o.requestId !== undefined ? asString(o.requestId, 'context.requestId') : undefined,
    sourceIp: o.sourceIp !== undefined ? asString(o.sourceIp, 'context.sourceIp') : undefined,
    userAgent: o.userAgent !== undefined ? asString(o.userAgent, 'context.userAgent') : undefined,
  };
}

export function registerAuditRoute(router: Router, ctx: VaultContext | null): void {
  const handler = async (req: Request, res: Response): Promise<void> => {
    if (!ctx) {
      res.status(503).json({
        error: 'VAULT_DB_UNAVAILABLE',
        message: 'Vault module is not wired (no Mongo connection).',
      });
      return;
    }

    // Accept both GET query params and JSON body (POST-style). The
    // GET path is the canonical one (clients can curl it); the
    // JSON body is supported for callers that prefer POST.
    const source: Record<string, unknown> = (req.method === 'GET')
      ? { ...(req.query as Record<string, unknown>), ...((req.body && typeof req.body === 'object') ? req.body as Record<string, unknown> : {}) }
      : ((req.body ?? {}) as Record<string, unknown>);

    let identityId: string;
    let limit: number | undefined;
    let context: ReadAuditHistoryCallerContext;
    try {
      identityId = asString(source.identityId, 'identityId');
      if (source.limit !== undefined && source.limit !== null) {
        const parsed = Number(source.limit);
        if (!Number.isFinite(parsed)) {
          throw new VaultError(
            'INVALID_INPUT',
            'field "limit" must be a positive integer.',
            400,
          );
        }
        limit = parsed;
      }
      context = asContext(source.context);
    } catch (err) {
      if (err instanceof VaultError) {
        res.status(err.status).json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }

    try {
      const result = await ctx.readAuditHistory({ identityId, limit, context });
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof ReadAuditHistoryCommandError) {
        const ve = new VaultError(
          err.code as VaultErrorCode,
          err.message,
          undefined,
        );
        res.status(ve.status).json({ error: ve.code, message: ve.message });
        return;
      }
      if (err instanceof VaultError) {
        res.status(err.status).json({ error: err.code, message: err.message });
        return;
      }
      res.status(500).json({
        error: 'INTERNAL',
        message: 'Unexpected error during audit read.',
      });
    }
  };

  router.get('/v1/audit', requireScope('vault:audit'), handler);
  // POST is supported for clients that prefer body-based access
  // (the GET route is the canonical one for the audit API).
  router.post('/v1/audit', requireScope('vault:audit'), handler);
}

/** Stand-alone `Router` factory for callers that want a fresh
 *  router. Most production wiring uses {@link registerAuditRoute}
 *  with the parent `app`'s router. */
export function makeAuditRouter(ctx: VaultContext | null): Router {
  const r = express.Router();
  registerAuditRoute(r, ctx);
  return r;
}
