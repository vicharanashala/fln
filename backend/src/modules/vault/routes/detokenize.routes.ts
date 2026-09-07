/**
 * POST /v1/detokenize — Express route handler (Phase 3).
 *
 * Consumes an approved step-up challenge and returns the recovered
 * plaintext Aadhaar. The route delegates to the in-process
 * `makeDetokenizeAadhaar` command from the vault module.
 *
 * The challenge row is the single source of truth for
 * authorisation; the route does NOT consult the FLN student table
 * to resolve the token — that linkage is already on the challenge
 * row (`challenge.tokenId`, `challenge.identityId`) and is enforced
 * by the command's actor-binding + CAS gates.
 *
 * Wire shape: `POST /v1/detokenize` with body
 *   `{ challengeId, context: { actorId, actorRole, reason, ... } }`
 * Response: `{ token, identityId, aadhaar, last4, auditId }`
 *   - `aadhaar` is the 12-digit plaintext. TEMPORARY. The route
 *     does not cache or persist it; the caller's responsibility
 *     to clear after display.
 *
 * Error mapping: every error path is a `DetokenizeCommandError`
 * (or a `VaultError` we wrap). The mapping from `code` -> HTTP
 * status lives in `../errors.ts` (`VAULT_CODE_TO_HTTP_STATUS`).
 */
import type { Request, Response, Router } from 'express';
import express from 'express';
import { requireScope } from '../middleware';
import { VaultError } from '../errors';
import type { VaultErrorCode } from '../errors';
import type { DetokenizeCallerContext } from '../application/commands/detokenize-aadhaar';
import { DetokenizeCommandError } from '../application/commands/detokenize-aadhaar';
import type { VaultContext } from '../context';

interface DetokenizeRequestBody {
  challengeId?: unknown;
  context?: unknown;
}

function asString(v: unknown, field: string): string {
  if (typeof v !== 'string') {
    throw new VaultError('INVALID_INPUT', `field "${field}" must be a string.`, 400);
  }
  return v;
}

function asContext(v: unknown): DetokenizeCallerContext {
  if (!v || typeof v !== 'object') {
    throw new VaultError('INVALID_INPUT', 'field "context" must be an object.', 400);
  }
  const o = v as Record<string, unknown>;
  return {
    actorId: asString(o.actorId, 'context.actorId'),
    actorRole: asString(o.actorRole, 'context.actorRole') as DetokenizeCallerContext['actorRole'],
    reason: asString(o.reason, 'context.reason'),
    requestId: o.requestId !== undefined ? asString(o.requestId, 'context.requestId') : undefined,
    sourceIp: o.sourceIp !== undefined ? asString(o.sourceIp, 'context.sourceIp') : undefined,
    userAgent: o.userAgent !== undefined ? asString(o.userAgent, 'context.userAgent') : undefined,
  };
}

export function registerDetokenizeRoute(router: Router, ctx: VaultContext | null): void {
  router.post(
    '/v1/detokenize',
    requireScope('vault:detokenize'),
    async (req: Request, res: Response) => {
      if (!ctx) {
        res.status(503).json({
          error: 'VAULT_DB_UNAVAILABLE',
          message: 'Vault module is not wired (no Mongo connection).',
        });
        return;
      }

      const body = (req.body ?? {}) as DetokenizeRequestBody;
      let challengeId: string;
      let context: DetokenizeCallerContext;
      try {
        if (typeof body.challengeId !== 'string' || body.challengeId.length === 0) {
          throw new VaultError(
            'INVALID_INPUT',
            'field "challengeId" must be a non-empty string.',
            400,
          );
        }
        challengeId = body.challengeId;
        context = asContext(body.context);
      } catch (err) {
        if (err instanceof VaultError) {
          res.status(err.status).json({ error: err.code, message: err.message });
          return;
        }
        throw err;
      }

      try {
        const result = await ctx.detokenize({ challengeId, context });
        // 200 on success — the recovered plaintext Aadhaar is
        // surfaced in the response. The caller (admin UI) is
        // responsible for clearing it from memory after the
        // reveal step.
        res.status(200).json(result);
      } catch (err) {
        if (err instanceof DetokenizeCommandError) {
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
          message: 'Unexpected error during detokenization.',
        });
      }
    },
  );
}

/** Stand-alone `Router` factory for callers that want a fresh
 *  router. Most production wiring uses {@link registerDetokenizeRoute}
 *  with the parent `app`'s router. */
export function makeDetokenizeRouter(ctx: VaultContext | null): Router {
  const r = express.Router();
  registerDetokenizeRoute(r, ctx);
  return r;
}
