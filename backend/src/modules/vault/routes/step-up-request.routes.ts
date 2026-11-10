/**
 * POST /v1/detokenize/request — Express route handler (Phase 4).
 *
 * Mints a step-up challenge bound to a (token, factor) pair. The
 * challenge is the single source of truth for the detokenize
 * authorization gate. The route delegates to the in-process
 * `makeRequestDetokenization` command.
 *
 * Wire shape: `POST /v1/detokenize/request` with body
 *   `{ tokenId, factorId, context }`
 * Response: `{ challengeId, expiresAt, requiredFactor }`
 *   - No plaintext Aadhaar is ever in scope on this route.
 *
 * Error mapping: every error path is a
 * `RequestDetokenizationCommandError` (or a `VaultError` we wrap).
 * The mapping from `code` -> HTTP status lives in `../errors.ts`.
 */
import type { Request, Response, Router } from 'express';
import express from 'express';
import { requireScope } from '../middleware';
import { sessionCallerContext } from '../session-context';
import { VaultError } from '../errors';
import type { VaultErrorCode } from '../errors';
import type {
  RequestDetokenizationCommand,
} from '../application/commands/request-detokenization';
import { RequestDetokenizationCommandError } from '../application/commands/request-detokenization';
import type { VaultContext } from '../context';

interface StepUpRequestRequestBody {
  tokenId?: unknown;
  factorId?: unknown;
  context?: unknown;
}

function asString(v: unknown, field: string): string {
  if (typeof v !== 'string') {
    throw new VaultError('INVALID_INPUT', `field "${field}" must be a string.`, 400);
  }
  return v;
}

export function registerStepUpRequestRoute(router: Router, ctx: VaultContext | null): void {
  router.post(
    '/v1/detokenize/request',
    requireScope('vault:detokenize'),
    async (req: Request, res: Response) => {
      if (!ctx || !ctx.requestDetokenization) {
        res.status(503).json({
          error: 'VAULT_DB_UNAVAILABLE',
          message: 'Vault module is not wired (no Mongo connection).',
        });
        return;
      }

      const body = (req.body ?? {}) as StepUpRequestRequestBody;
      let cmd: RequestDetokenizationCommand;
      try {
        cmd = {
          tokenId: asString(body.tokenId, 'tokenId'),
          factorId: asString(body.factorId, 'factorId'),
          context: sessionCallerContext(res, body.context),
        };
      } catch (err) {
        if (err instanceof VaultError) {
          res.status(err.status).json({ error: err.code, message: err.message });
          return;
        }
        throw err;
      }

      try {
        const result = await ctx.requestDetokenization(cmd);
        // Serialize Date to ISO so the wire shape is JSON-friendly.
        res.status(201).json({
          challengeId: result.challengeId,
          expiresAt: result.expiresAt.toISOString(),
          requiredFactor: result.requiredFactor,
        });
      } catch (err) {
        if (err instanceof RequestDetokenizationCommandError) {
          const ve = new VaultError(
            err.code as VaultErrorCode,
            err.message,
            err.httpStatus,
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
          message: 'Unexpected error during step-up request.',
        });
      }
    },
  );
}

/** Stand-alone `Router` factory. */
export function makeStepUpRequestRouter(ctx: VaultContext | null): Router {
  const r = express.Router();
  registerStepUpRequestRoute(r, ctx);
  return r;
}
