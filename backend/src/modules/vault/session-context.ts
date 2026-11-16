// ==========================================
// VAULT MODULE — CALLER IDENTITY FROM THE SESSION
// ==========================================
// The caller's identity (`actorId`, `actorRole`) for every /v1 vault route
// comes only from the authenticated session that `requireScope` resolved
// (see middleware.ts). Any `actorId` / `actorRole` present in a request
// body is ignored; only the free-text `reason` and the optional
// `requestId` / `sourceIp` / `userAgent` are read from `body.context`.
import type { Response } from 'express';
import { VaultError } from './errors';

/** The authenticated caller, as resolved by `requireScope`. */
export interface VaultSessionActor {
  /** The user's email, the same identifier the in-process admin flow uses. */
  actorId: string;
  actorRole: 'SUPER_ADMIN';
  userId: string;
  schoolId: string;
}

/** Caller context handed to the vault commands. */
export interface SessionCallerContext extends VaultSessionActor {
  reason: string;
  requestId?: string;
  sourceIp?: string;
  userAgent?: string;
}

export function setVaultSessionActor(res: Response, actor: VaultSessionActor): void {
  res.locals.vaultActor = actor;
}

export function getVaultSessionActor(res: Response): VaultSessionActor {
  const actor = res.locals.vaultActor as VaultSessionActor | undefined;
  if (!actor) {
    throw new VaultError('UNAUTHORIZED', 'Authentication required', 401);
  }
  return actor;
}

function asString(v: unknown, field: string): string {
  if (typeof v !== 'string') {
    throw new VaultError('INVALID_INPUT', `field "${field}" must be a string.`, 400);
  }
  return v;
}

/**
 * Build the command caller context. `actorId`, `actorRole`, `userId` and
 * `schoolId` come from the session; `bodyContext` supplies only `reason`
 * (required) and the optional `requestId`, `sourceIp` and `userAgent`.
 */
export function sessionCallerContext(res: Response, bodyContext: unknown): SessionCallerContext {
  if (!bodyContext || typeof bodyContext !== 'object') {
    throw new VaultError('INVALID_INPUT', 'field "context" must be an object.', 400);
  }
  const o = bodyContext as Record<string, unknown>;
  return {
    ...getVaultSessionActor(res),
    reason: asString(o.reason, 'context.reason'),
    requestId: o.requestId !== undefined ? asString(o.requestId, 'context.requestId') : undefined,
    sourceIp: o.sourceIp !== undefined ? asString(o.sourceIp, 'context.sourceIp') : undefined,
    userAgent: o.userAgent !== undefined ? asString(o.userAgent, 'context.userAgent') : undefined,
  };
}
