/**
 * POST `/v1/tokenize` route (AADHAAR_VAULT_FREE_ARCHITECTURE.md §6.1, §6.2).
 *
 * This is the only write path that produces a vault token. It is the
 * narrow compile-time seam between the outside world (JSON over HTTP)
 * and the application-layer `TokenizeAadhaar` command. The route is
 * intentionally thin:
 *
 *   - Require the `vault:tokenize` scope via the auth plugin's
 *     `req.requireScope()` guard. The guard returns 401 when the
 *     verifier rejected the bearer token, and 403 when the token is
 *     valid but lacks the scope.
 *   - Parse + validate the request body with Zod. Anything malformed
 *     never reaches the command.
 *   - Stitch a `TokenizeCallerContext` from explicit fields + the live
 *     Fastify request (`request.id`, `request.ip`, `user-agent`).
 *   - Invoke the command via the factory in `application/commands/`.
 *   - Translate `TokenizeCommandError.code` → HTTP status; never echo
 *     raw `err.message` into the response.
 *
 * # Authentication boundary
 *
 * When the auth plugin is wired (production), the verified JWT's
 * `subject` is the source of truth for `actorId`. The body's
 * `actorId` is then merely advisory. This guarantees the audit row
 * carries a verified caller identity, not a client-asserted one.
 *
 * In test builds, the auth plugin is a no-op (no HMAC secret) and
 * `req.principal` is `null`. The route then falls back to the body's
 * `actorId` so the existing route test fixture can still drive the
 * happy path without minting a bearer token. The same code path runs
 * in both cases; the only difference is which field wins.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import type { Database } from '../db/index.js';
import type { Logger } from '../logger.js';
import type { CryptoService } from '../application/ports/crypto.service.js';
import type { EventPublisher } from '../application/ports/event-publisher.js';
import type { KeyManager } from '../application/ports/key-manager.js';
import type { TransactionalVaultWriter } from '../application/ports/transactional-vault-writer.js';
import {
  TokenizeCommandError,
  makeTokenizeAadhaar,
} from '../application/commands/tokenize-aadhaar.js';

/* -------------------------------------------------------------------- *
 * Zod schema                                                          *
 * -------------------------------------------------------------------- */

const IdentityTypeEnum = z.enum(['AADHAAR', 'BIRTH_CERTIFICATE']);

/** Minimal actor descriptor. The auth plugin's verified principal
 *  (`req.principal.subject`) overrides the body for `actorId` when
 *  the plugin is wired; the body value is therefore a test-only or
 *  trust-gateway fallback. The enum string-set MUST mirror
 *  `TokenizeCallerContext` in `application/commands/tokenize-aadhaar.ts`
 *  exactly. */
const ActorRoleEnum = z.enum([
  'TEACHER',
  'SCHOOL_ADMIN',
  'STATE_ADMIN',
  'SUPER_ADMIN',
  'SERVICE',
]);

const TokenizeContextSchema = z
  .object({
    actorId: z
      .string({ required_error: 'context.actorId is required' })
      .min(1)
      .max(128),
    actorRole: ActorRoleEnum,
    /** Free-text justification. Min length blocks empty-string laziness. */
    reason: z
      .string({ required_error: 'context.reason is required' })
      .min(10)
      .max(512),
    requestId: z.string().min(1).max(128).optional(),
    sourceIp: z.string().max(64).optional(),
    userAgent: z.string().max(512).optional(),
  })
  .strict();

/** Body schema. `.strict()` rejects unknown keys so the contract is
 *  additive — clients cannot smuggle new fields in to be silently
 *  ignored. */
const TokenizeRequestSchema = z
  .object({
    raw: z
      .string({ required_error: 'raw is required' })
      .min(1)
      // Hard cap matches Fastify's bodyLimit (64 KiB) with headroom;
      // an Aadhaar is 12 digits so anything over 32 chars is junk.
      .max(32),
    type: IdentityTypeEnum,
    context: TokenizeContextSchema,
  })
  .strict();

type TokenizeRequest = z.infer<typeof TokenizeRequestSchema>;

/* -------------------------------------------------------------------- *
 * Error mapping                                                        *
 * -------------------------------------------------------------------- */

/**
 * HTTP status + stable error code per `TokenizeCommandError.code`.
 *
 * Codes MUST match the architecture doc; adding a new code requires
 * extending this table. Each code maps to exactly one status so
 * observability dashboards can match response.status ↔ error.code.
 */
const ERROR_STATUS: Record<string, number> = {
  INVALID_INPUT: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  PEPPER_MISMATCH: 422,
  RATE_LIMIT: 429,
  INTERNAL: 500,
};

function replyForCommandError(
  reply: import('fastify').FastifyReply,
  err: TokenizeCommandError,
): void {
  const status = ERROR_STATUS[err.code] ?? 500;
  // We intentionally do not echo `err.message` to the client — some
  // messages may contain identifiers or operator notes; the body only
  // exposes the stable architectural code.
  reply.code(status).send({
    error: err.code,
    message:
      status >= 500
        ? 'An unexpected error occurred.'
        : err.code === 'INVALID_INPUT'
          ? 'Request input did not satisfy the tokenization contract.'
          : err.code === 'UNAUTHORIZED'
            ? 'Missing or invalid credentials.'
            : err.code === 'FORBIDDEN'
              ? 'Caller is not allowed to tokenize this identity.'
              : err.code === 'PEPPER_MISMATCH'
                ? 'Identity does not match the active pepper.'
                : err.code === 'RATE_LIMIT'
                  ? 'Too many tokenization requests; retry later.'
                  : 'Request could not be processed.',
  });
}

/* -------------------------------------------------------------------- *
 * Plugin dependencies                                                  *
 * -------------------------------------------------------------------- */

export interface TokenizeDeps {
  version: string;
  /** Resolves deps lazily so Fastify plugins are fully wired by the
   *  time the route first runs. Each getter re-reads `app.*` on every
   *  call; that is cheap and keeps test overrides honest. */
  keyManager: () => KeyManager | undefined;
  crypto: () => CryptoService | undefined;
  vaultWriter: () => TransactionalVaultWriter | undefined;
  events: () => EventPublisher | undefined;
  db: () => Database | undefined;
  logger: Logger;
}

export const tokenizeRoutes: FastifyPluginAsync<{ deps: TokenizeDeps }> = async (
  app: FastifyInstance,
  { deps },
) => {
  app.post('/v1/tokenize', async (req, reply) => {
    /* ---------------- auth boundary ---------------- */
    // `req.requireScope` is installed by the auth plugin. When the
    // verifier is wired (production), the call is a hard gate:
    //   - missing/invalid token  → 401 (auth plugin's onRequest hook)
    //   - valid token, no scope  → 403 with `error: 'unauthorized'`
    // When the verifier is NOT wired (test only — `NODE_ENV=test`
    // without `SERVICE_JWT_HMAC_SECRET`), `requireScope` was
    // initialised to a function that throws a 503. The route is
    // therefore unreachable in that configuration, which is the
    // desired fail-closed behaviour.
    req.requireScope('vault:tokenize');

    /* ---------------- dependency guard ---------------- */
    const keyManager = deps.keyManager();
    const crypto = deps.crypto();
    const vaultWriter = deps.vaultWriter();
    const events = deps.events();
    const db = deps.db();

    if (!keyManager || !crypto || !vaultWriter || !events || !db) {
      deps.logger.error(
        { route: 'POST /v1/tokenize' },
        'aadhaar-vault route invoked with missing dependency',
      );
      reply
        .code(503)
        .send({ error: 'service_unavailable', message: 'Vault not ready.' });
      return;
    }

    /* ---------------- request validation ---------------- */
    const parsed = TokenizeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      // 400 with a stable shape. We strip the verbose zod issues to
      // a `details` array so logs stay grep-able without echoing
      // third-party path strings to the public response.
      reply.code(400).send({
        error: 'invalid_request',
        message: 'Request body failed validation.',
        details: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          code: i.code,
        })),
      });
      return;
    }

    const body: TokenizeRequest = parsed.data;

    /* ---------------- actor identity ----------------
     * When the auth plugin produced a verified principal, prefer
     * `req.principal.subject` over the client-supplied `actorId`. The
     * body value is retained as a fallback for the test path only,
     * where the plugin is a no-op and `req.principal` is `null`. */
    const verifiedSubject = req.principal?.subject;
    const actorId = verifiedSubject ?? body.context.actorId;
    const actorRole = body.context.actorRole;

    const command = makeTokenizeAadhaar({
      keyManager,
      crypto,
      vaultWriter,
      events,
    });

    let result;
    try {
      result = await command({
        raw: body.raw,
        type: body.type,
        context: {
          actorId,
          actorRole,
          reason: body.context.reason,
          requestId: body.context.requestId ?? req.id,
          sourceIp: body.context.sourceIp ?? req.ip,
          userAgent:
            body.context.userAgent ??
            (req.headers['user-agent'] as string | undefined),
        },
      });
    } catch (err) {
      if (err instanceof TokenizeCommandError) {
        deps.logger.info(
          {
            err,
            errCode: err.code,
            actorId,
            actorRole,
            type: body.type,
            reqId: req.id,
          },
          'aadhaar-vault tokenize rejected',
        );
        replyForCommandError(reply, err);
        return;
      }
      // Unknown error — let the central error handler in server.ts
      // format the 500. We re-throw so its log line carries the
      // request scope.
      deps.logger.error(
        { err, reqId: req.id },
        'aadhaar-vault tokenize unexpected error',
      );
      throw err;
    }

    /* ---------------- success response ---------------- */
    reply.code(201).send({
      token: result.token,
      last4: result.last4,
      tokenType: result.tokenType,
      auditId: result.auditId,
      identityId: result.identityId,
      keyVersion: result.keyVersion,
    });
    return;
  });
};

export default tokenizeRoutes;