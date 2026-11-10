/**
 * POST /v1/mfa/enroll — Express route handler (Phase 4).
 *
 * Enrolls a TOTP step-up factor for the authenticated caller. The route delegates to the in-process
 * `makeEnrollMfa` command from the vault module.
 *
 * Wire shape: `POST /v1/mfa/enroll` with body
 *   `{ label?, algorithm?, digits?, period?, context }` (any `actor` field is ignored)
 * Response: `{ factorId, otpauthUri, factor }`
 *   - `otpauthUri` embeds the TOTP shared secret — caller MUST
 *     treat it as a secret (render only inside the admin's
 *     session, never persist, never log).
 *
 * Error mapping: every error path is an `EnrollMfaCommandError`
 * (or a `VaultError` we wrap). The mapping from `code` -> HTTP
 * status lives in `../errors.ts`.
 */
import type { Request, Response, Router } from 'express';
import express from 'express';
import { requireScope } from '../middleware';
import { sessionCallerContext } from '../session-context';
import { VaultError } from '../errors';
import type { VaultErrorCode } from '../errors';
import type {
  EnrollMfaCommand,
} from '../application/commands/enroll-mfa';
import { EnrollMfaCommandError } from '../application/commands/enroll-mfa';
import type { TotpAlgorithm } from '../application/ports/totp-verifier';
import type { VaultContext } from '../context';

interface MfaEnrollRequestBody {
  label?: unknown;
  algorithm?: unknown;
  digits?: unknown;
  period?: unknown;
  context?: unknown;
}

function asString(v: unknown, field: string): string {
  if (typeof v !== 'string') {
    throw new VaultError('INVALID_INPUT', `field "${field}" must be a string.`, 400);
  }
  return v;
}

function asInt(v: unknown, field: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v)) {
    throw new VaultError('INVALID_INPUT', `field "${field}" must be an integer.`, 400);
  }
  return v;
}

export function registerMfaEnrollRoute(router: Router, ctx: VaultContext | null): void {
  router.post(
    '/v1/mfa/enroll',
    requireScope('vault:mfa:enroll'),
    async (req: Request, res: Response) => {
      if (!ctx || !ctx.enrollMfa) {
        res.status(503).json({
          error: 'VAULT_DB_UNAVAILABLE',
          message: 'Vault module is not wired (no Mongo connection).',
        });
        return;
      }

      const body = (req.body ?? {}) as MfaEnrollRequestBody;
      let cmd: EnrollMfaCommand;
      try {
        const context = sessionCallerContext(res, body.context);
        // The factor always belongs to the authenticated caller; a
        // body-supplied `actor` is ignored.
        const actor = context.actorId;
        const partial: EnrollMfaCommand = { actor, context };
        if (body.label !== undefined) partial.label = asString(body.label, 'label');
        if (body.algorithm !== undefined) {
          partial.algorithm = asString(body.algorithm, 'algorithm') as TotpAlgorithm;
        }
        if (body.digits !== undefined) {
          partial.digits = asInt(body.digits, 'digits');
        }
        if (body.period !== undefined) {
          partial.period = asInt(body.period, 'period');
        }
        cmd = partial;
      } catch (err) {
        if (err instanceof VaultError) {
          res.status(err.status).json({ error: err.code, message: err.message });
          return;
        }
        throw err;
      }

      try {
        const result = await ctx.enrollMfa(cmd);
        res.status(201).json(result);
      } catch (err) {
        if (err instanceof EnrollMfaCommandError) {
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
          message: 'Unexpected error during MFA enrollment.',
        });
      }
    },
  );
}

/** Stand-alone `Router` factory. */
export function makeMfaEnrollRouter(ctx: VaultContext | null): Router {
  const r = express.Router();
  registerMfaEnrollRoute(r, ctx);
  return r;
}
