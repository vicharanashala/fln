/**
 * POST /v1/tokenize — Express route handler.
 *
 * Phase 2: mirrors the in-process command the legacy HTTP vault
 * service exposed, but in-process. Kept registered (not deleted) so
 * future internal services / the Phase 5 console can call it without
 * going through the student-registration code path.
 *
 * In Phase 2 the only real caller is `aadhaarVault.ts:tokenizeAadhaar`
 * (which has the in-process command installed on it by
 * `buildVaultContext`). This route is the public surface and exists
 * primarily so the shape and error mapping can be exercised by
 * `curl` / integration tests without going through the higher-level
 * student routes.
 *
 * Error mapping: every error path is a `VaultError` (or a
 * `TokenizeCommandError` we wrap). The mapping from `code` -> HTTP
 * status lives in `../errors.ts`.
 */
import type { Request, Response, Router } from 'express';
import express from 'express';
import { requireScope } from '../middleware';
import { VaultError } from '../errors';
import type { VaultErrorCode } from '../errors';
import type { TokenizeCallerContext, TokenizeIdentityType } from '../application/commands/tokenize-aadhaar';
import { TokenizeCommandError } from '../application/commands/tokenize-aadhaar';
import type { VaultContext } from '../context';

interface TokenizeRequestBody {
  raw?: unknown;
  type?: unknown;
  context?: unknown;
}

function asString(v: unknown, field: string): string {
  if (typeof v !== 'string') {
    throw new VaultError('INVALID_INPUT', `field "${field}" must be a string.`, 400);
  }
  return v;
}

function asContext(v: unknown): TokenizeCallerContext {
  if (!v || typeof v !== 'object') {
    throw new VaultError('INVALID_INPUT', 'field "context" must be an object.', 400);
  }
  const o = v as Record<string, unknown>;
  return {
    actorId: asString(o.actorId, 'context.actorId'),
    actorRole: asString(o.actorRole, 'context.actorRole') as TokenizeCallerContext['actorRole'],
    reason: asString(o.reason, 'context.reason'),
    requestId: o.requestId !== undefined ? asString(o.requestId, 'context.requestId') : undefined,
    sourceIp: o.sourceIp !== undefined ? asString(o.sourceIp, 'context.sourceIp') : undefined,
    userAgent: o.userAgent !== undefined ? asString(o.userAgent, 'context.userAgent') : undefined,
  };
}

export function registerTokenizeRoute(router: Router, ctx: VaultContext | null): void {
  router.post(
    '/v1/tokenize',
    requireScope('vault:tokenize'),
    async (req: Request, res: Response) => {
      if (!ctx) {
        res.status(503).json({
          error: 'VAULT_DB_UNAVAILABLE',
          message: 'Vault module is not wired (no Mongo connection).',
        });
        return;
      }

      const body = (req.body ?? {}) as TokenizeRequestBody;
      let raw: string;
      let type: TokenizeIdentityType;
      let context: TokenizeCallerContext;
      try {
        raw = asString(body.raw, 'raw');
        type = asString(body.type, 'type') as TokenizeIdentityType;
        context = asContext(body.context);
      } catch (err) {
        if (err instanceof VaultError) {
          res.status(err.status).json({ error: err.code, message: err.message });
          return;
        }
        throw err;
      }

      try {
        const result = await ctx.tokenize({ raw, type, context });
        res.status(201).json(result);
      } catch (err) {
        if (err instanceof TokenizeCommandError) {
          // The command throws a TokenizeCommandError with a stable
          // `code` (e.g. INVALID_INPUT). Wrap it so the route layer
          // can use the same error-mapping table.
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
          message: 'Unexpected error during tokenization.',
        });
      }
    },
  );
}

/** Stand-alone `Router` factory for callers that want a fresh
 *  router. Most production wiring uses {@link registerTokenizeRoute}
 *  with the parent `app`'s router. */
export function makeTokenizeRouter(ctx: VaultContext | null): Router {
  const r = express.Router();
  registerTokenizeRoute(r, ctx);
  return r;
}
