/**
 * POST /v1/detokenize/step-up/:challengeId/approve — Express route
 * handler (Phase 4).
 *
 * Approves a pending step-up challenge by submitting a TOTP code.
 * The route delegates to the in-process
 * `makeApproveStepUpChallenge` command. The `verifyMfa` step is
 * folded into the approve command (server-side) so a separate
 * `/v1/mfa/verify` route is not exposed.
 *
 * Wire shape: `POST /v1/detokenize/step-up/:challengeId/approve`
 *   body: `{ code, context }` (`context` carries only `reason` and the
 *   optional `requestId` / `sourceIp` / `userAgent`; the actor comes from
 *   the authenticated session, and any `window` field is ignored)
 * Response: `{ challengeId, status, approvedAt, verifiedFactorId }`
 *   - `status` is always `'approved'` on 2xx.
 *
 * Error mapping: every error path is an
 * `ApproveStepUpChallengeCommandError` (or a `VaultError` we wrap).
 * The mapping from `code` -> HTTP status lives in `../errors.ts`.
 */
import type { Request, Response, Router } from 'express';
import express from 'express';
import { requireScope } from '../middleware';
import { sessionCallerContext } from '../session-context';
import { VaultError } from '../errors';
import type { VaultErrorCode } from '../errors';
import type {
  ApproveStepUpChallengeCommand,
} from '../application/commands/approve-step-up-challenge';
import { ApproveStepUpChallengeCommandError } from '../application/commands/approve-step-up-challenge';
import type { VaultContext } from '../context';

interface StepUpApproveRequestBody {
  code?: unknown;
  context?: unknown;
}

function asString(v: unknown, field: string): string {
  if (typeof v !== 'string') {
    throw new VaultError('INVALID_INPUT', `field "${field}" must be a string.`, 400);
  }
  return v;
}

export function registerStepUpApproveRoute(router: Router, ctx: VaultContext | null): void {
  router.post(
    '/v1/detokenize/step-up/:challengeId/approve',
    requireScope('vault:detokenize'),
    async (req: Request, res: Response) => {
      if (!ctx || !ctx.approveStepUpChallenge) {
        res.status(503).json({
          error: 'VAULT_DB_UNAVAILABLE',
          message: 'Vault module is not wired (no Mongo connection).',
        });
        return;
      }

      const body = (req.body ?? {}) as StepUpApproveRequestBody;
      let cmd: ApproveStepUpChallengeCommand;
      try {
        const challengeId = asString(req.params.challengeId, 'challengeId');
        cmd = {
          challengeId,
          code: asString(body.code, 'code'),
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
        const result = await ctx.approveStepUpChallenge(cmd);
        res.status(200).json({
          challengeId: result.challengeId,
          status: result.status,
          approvedAt: result.approvedAt.toISOString(),
          verifiedFactorId: result.verifiedFactorId,
        });
      } catch (err) {
        if (err instanceof ApproveStepUpChallengeCommandError) {
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
          message: 'Unexpected error during step-up approval.',
        });
      }
    },
  );
}

/** Stand-alone `Router` factory. */
export function makeStepUpApproveRouter(ctx: VaultContext | null): Router {
  const r = express.Router();
  registerStepUpApproveRoute(r, ctx);
  return r;
}
