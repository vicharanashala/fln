/**
 * `GET /v1/audit` — HTTP surface for the {@link ReadAuditHistory}
 * application command (Session 5C).
 *
 * The route is the *only* place where the v0.1 partition between
 * application and infrastructure changes direction: the route
 * receives query parameters, validates them, builds the
 * application-layer `ReadAuditHistoryCallerContext`, and asks the
 * command to do the work. The command itself never imports `fastify`.
 *
 * # Auth boundary
 *
 *   1. Caller must present a verified Bearer JWT — supplied by the
 *      Session 5 Phase 1 auth plugin. No token → `401`.
 *   2. The token must carry `vault:audit` in its `scope` claim.
 *      Otherwise → `403`.
 *   3. The JWT subject (a stable principal id) is the *trusted*
 *      `actorId`. The route does NOT accept an `actorId` query
 *      parameter — the only source for `actorId` is the JWT subject.
 *      This locks in the principal-trust invariant established in
 *      Session 6A: an authenticated caller cannot impersonate a
 *      different principal by rewriting the request. The route
 *      does not fall back to a body-supplied value; if the auth
 *      plugin is wired (so `requireScope` succeeded) but the JWT
 *      claim is missing, the route surfaces a `500 internal_error`
 *      so the misconfiguration is loud and observable in operator
 *      dashboards, not silently rewritten to an empty actor.
 *
 * # Status mapping
 *
 *   - `200` — read succeeded; entries shaped per the §6 contract.
 *   - `400` — query string failed schema validation, or the command
 *             surfaced `INVALID_INPUT` (e.g. empty `identityId`,
 *             though Zod catches that first at the route layer).
 *   - `401` — missing / malformed / expired / untrusted Bearer.
 *   - `403` — token verified but missing `vault:audit`.
 *   - `500` — unexpected error, or the principal-trust invariant
 *             tripped (authenticated principal has no subject).
 *   - `503` — `db.audit` was not wired before the request arrived.
 *
 * # Why the deps are lazy getters
 *
 *   `buildServer()` constructs the vault lazily. The route handlers
 *   run in the same fastify boot that registers them, so the deps
 *   may not yet be ready at `app.register` time. Each handler
 *   rebuilds the command inside the request, fetching the current
 *   `db` from the server-owned getter; this keeps the command
 *   heap-isolated and matches the tokenize/detokenize route pattern.
 *
 * # Schema reconciliation notes
 *
 *   The current `ReadAuditHistory` command does not return any
 *   session-5c-deferred fields (e.g. `last4`, token status). This
 *   route exposes exactly the fields the command returns today; the
 *   deferred `LookupMaskedAadhaar` and `RevokeAadhaarToken`
 *   commands are intentionally out of scope for this session.
 */
import type { FastifyInstance, FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';

import {
    ReadAuditHistoryCommandError,
    makeReadAuditHistory,
} from '../application/commands/read-audit-history.js';
import type { Database } from '../db/index.js';
import type { Logger } from '../logger.js';

// ---------------------------------------------------------------------------
// Local enum — duplicated from `tokenize.routes.ts` / `detokenize.routes.ts`.
//
// No shared route schema exists today; per the Session 6B scope rules,
// introducing one would expand the change beyond the route layer. A future
// cleanup can hoist this to `src/routes/schemas.ts` once a third route
// (e.g. `LookupMaskedAadhaar`) needs it. The values MUST stay in lockstep
// with the application command's `ReadAuditHistoryCallerContext.actorRole`
// union — see `src/application/commands/read-audit-history.ts`.
// ---------------------------------------------------------------------------
const ActorRoleEnum = z.enum([
    'TEACHER',
    'SCHOOL_ADMIN',
    'STATE_ADMIN',
    'SUPER_ADMIN',
    'SERVICE',
]);

/**
 * Zod schema for the public query string.
 *
 *  - `.strict()` rejects unknown keys, including any `actorId`
 *    override the client tries to inject. This is the schema-level
 *    enforcement of the principal-trust invariant.
 *  - `limit` is *coerced* from a string to a number (Fastify
 *    delivers query params as strings) and bounded at the route
 *    layer: 1 ≤ limit ≤ 200. Out-of-range requests are rejected
 *    with 400 — the command's silent clamp to `MAX_LIMIT` is a
 *    backstop for non-HTTP callers and is intentionally bypassed
 *    here so clients always see the limit they asked for.
 *  - `actorId` is intentionally absent. The route derives it from
 *    the verified JWT subject inside the handler.
 */
const AuditQuerySchema = z
    .object({
        identityId: z.string().min(1).max(128),
        limit: z.coerce
            .number()
            .int()
            .min(1)
            .max(200)
            .optional(),
        actorRole: ActorRoleEnum,
        reason: z.string().min(10).max(512),
        requestId: z.string().min(1).max(128).optional(),
        sourceIp: z.string().max(64).optional(),
        userAgent: z.string().max(512).optional(),
    })
    .strict();

/**
 * Status mapping for {@link ReadAuditHistoryCommandError} codes.
 * Anything not in this table is treated as 500. Deliberately small:
 * the command only throws `INVALID_INPUT` today.
 */
const ERROR_STATUS: Record<string, number> = {
    INVALID_INPUT: 400,
};

/**
 * Stable, non-leaky human-readable messages keyed by error code. We
 * never echo the underlying error's `.message` to the client — it
 * has been logged with the full detail.
 */
const ERROR_MESSAGES: Record<string, string> = {
    INVALID_INPUT:
        'Request input did not satisfy the audit-read contract.',
};

function replyForCommandError(
    reply: FastifyReply,
    err: ReadAuditHistoryCommandError,
): void {
    const status = ERROR_STATUS[err.code] ?? 500;
    reply.code(status).send({
        error: err.code,
        message:
            ERROR_MESSAGES[err.code] ?? 'An unexpected error occurred.',
    });
}

export interface AuditDeps {
    /** API version surfaced in logs. */
    version: string;
    db: () => Database | undefined;
    logger: Logger;
}

export const auditRoutes: FastifyPluginAsync<{ deps: AuditDeps }> =
    async (
        app: FastifyInstance,
        { deps }: { deps: AuditDeps },
    ) => {
        app.get('/v1/audit', async (req, reply) => {
            // -----------------------------------------------------------------
            // 1. Auth boundary. `requireScope` throws a 401/403 reply if the
            //    principal is missing or lacks the scope; the throw is caught
            //    by Fastify's error handler before we touch any vault
            //    dependency. The 401 path covers a missing/malformed token;
            //    the 403 path covers a verified token without `vault:audit`.
            // -----------------------------------------------------------------
            req.requireScope('vault:audit');

            // -----------------------------------------------------------------
            // 2. Lazy dep resolution. The 503 guard short-circuits when
            //    `db` (and therefore `db.audit`) is not wired yet.
            // -----------------------------------------------------------------
            const db = deps.db();
            if (!db) {
                deps.logger.error(
                    { route: 'GET /v1/audit' },
                    'aadhaar-vault audit route invoked with missing dependency',
                );
                reply.code(503).send({
                    error: 'service_unavailable',
                    message: 'Audit read not ready.',
                });
                return;
            }

            // -----------------------------------------------------------------
            // 3. Zod validation of the query string. `.strict()` enforces
            //    that no extra properties (e.g. an attempted `actorId`
            //    override) are accepted. The route uses `safeParse` so a
            //    failure surfaces as a structured 400 envelope rather than
            //    a thrown exception.
            // -----------------------------------------------------------------
            const parsed = AuditQuerySchema.safeParse(req.query);
            if (!parsed.success) {
                reply.code(400).send({
                    error: 'invalid_request',
                    message: 'Query string failed validation.',
                    details: parsed.error.issues.map((i) => ({
                        path: i.path.join('.'),
                        code: i.code,
                    })),
                });
                return;
            }

            const query = parsed.data;

            // -----------------------------------------------------------------
            // 4. Principal-trust invariant. The JWT subject is the only
            //    source for `actorId`; the public schema does not expose
            //    an `actorId` field, and there is no body-supplied fallback.
            //    If the auth plugin is wired (so `requireScope` succeeded)
            //    but the principal claim is unexpectedly empty, we surface
            //    a 500 — never fabricate an empty actor. The command treats
            //    `context.actorId` as metadata, not a primary input, so the
            //    structural invariant of the route is "principal must be
            //    non-empty when `requireScope` passes".
            // -----------------------------------------------------------------
            const subject = req.principal?.subject;
            if (typeof subject !== 'string' || subject.length === 0) {
                deps.logger.error(
                    {
                        reqId: req.id,
                        principal: req.principal,
                        route: 'GET /v1/audit',
                    },
                    'aadhaar-vault audit route: authenticated principal has no subject',
                );
                throw new Error(
                    'aadhaar-vault audit route: authenticated principal has no subject',
                );
            }
            const actorId = subject;

            // -----------------------------------------------------------------
            // 5. Build and invoke the command. The command is read-only —
            //    no transactional writer, no event publish, no key manager,
            //    no crypto service. Persistence is the only cross-cutting
            //    concern, and it travels with `db.audit`.
            // -----------------------------------------------------------------
            const command = makeReadAuditHistory({
                audit: db.audit,
            });

            try {
                const result = await command({
                    identityId: query.identityId,
                    limit: query.limit,
                    context: {
                        actorId,
                        actorRole: query.actorRole,
                        reason: query.reason,
                        // Established convention (tokenize/detokenize routes):
                        // explicit query override falls back to the
                        // request-derived value.
                        requestId:
                            query.requestId ?? req.id ?? undefined,
                        sourceIp: query.sourceIp ?? req.ip,
                        userAgent:
                            query.userAgent ??
                            (req.headers['user-agent']
                                ? String(req.headers['user-agent'])
                                : undefined),
                    },
                });

                // Project the command result 1:1. Every field below comes
                // directly from `ReadAuditHistoryResult`; nothing is
                // fabricated or recomputed in the route layer.
                reply.code(200).send({
                    identityId: result.identityId,
                    limit: result.limit,
                    pageSize: result.pageSize,
                    entries: result.entries,
                });
            } catch (err) {
                if (err instanceof ReadAuditHistoryCommandError) {
                    deps.logger.info(
                        {
                            errCode: err.code,
                            actorId,
                            actorRole: query.actorRole,
                            identityId: query.identityId,
                            reqId: req.id,
                        },
                        'aadhaar-vault audit read rejected',
                    );
                    replyForCommandError(reply, err);
                    return;
                }
                deps.logger.error(
                    { err, reqId: req.id },
                    'aadhaar-vault audit read unexpected error',
                );
                throw err;
            }
        });
    };

export default auditRoutes;