/**
 * `POST /v1/detokenize/request` — HTTP surface for the
 * {@link makeRequestDetokenization} application command (Session 7B).
 *
 * This route is the *first* of three routes that together implement
 * the step-up workflow for releasing an Aadhaar plaintext:
 *
 *   1. `POST /v1/detokenize/request`     → this route. Mints a
 *      `vault_step_up_challenges` row bound to a token and an MFA
 *      factor. Returns `{ challengeId, expiresAt, requiredFactor }`.
 *      **No plaintext is ever returned by this route.**
 *   2. `POST /v1/detokenize/verify-mfa`  → caller proves possession
 *      of the factor with a TOTP code; the challenge row flips to
 *      `approved`.
 *   3. `POST /v1/detokenize`             → already shipped; consumes
 *      the approved challenge id and returns the plaintext.
 *
 * The route is the only place where the v0.1 partition between
 * application and infrastructure changes direction: the route
 * receives a JSON body, validates it, builds the application-layer
 * `RequestDetokenizationCallerContext`, and asks the command to do
 * the work. The command itself never imports `fastify`.
 *
 * # Auth boundary
 *
 *   1. Caller must present a verified Bearer JWT — supplied by the
 *      Session 5 Phase 1 auth plugin. No token → `401`.
 *   2. The token must carry `vault:detokenize` in its `scope` claim.
 *      Otherwise → `403`. The same scope is reused for the entire
 *      detokenize workflow (request / verify-mfa / release); the
 *      step-up never warrants a separate scope because it is just a
 *      gated preamble to the actual plaintext release.
 *   3. The JWT subject (a stable principal id) is the *trusted*
 *      `actorId`. The body's `context.actorId` is intentionally
 *      ignored if the JWT subject is present. This mirrors the
 *      invariant documented on `detokenize.routes.ts`: an
 *      authenticated caller cannot impersonate a different principal
 *      by rewriting the body. When the JWT subject is absent (e.g.
 *      a service credential where `subject` is empty) the body's
 *      `actorId` is used as a fallback so the audit log still has a
 *      non-empty actor.
 *
 * # Status mapping
 *
 *   - `200` — challenge row appended, audit row appended,
 *             `DetokenizationRequested` event published.
 *   - `400` — JSON body failed schema validation, or the command
 *             rejected with `INVALID_INPUT`.
 *   - `401` — missing / malformed / expired / untrusted Bearer.
 *   - `403` — token verified but missing `vault:detokenize`, or the
 *             command rejected with `FACTOR_NOT_ACTIVE` /
 *             `FACTOR_EXPIRED` (a disabled factor is an
 *             authorisation failure, not a missing row).
 *   - `404` — `TOKEN_NOT_FOUND` / `IDENTITY_NOT_FOUND` /
 *             `FACTOR_NOT_FOUND`.
 *   - `500` — `INVALID_CONFIG` or any other unexpected error.
 *   - `503` — vault dependencies were not wired before the request
 *             arrived (race during startup).
 *
 * # Why the deps are lazy getters
 *
 *   `buildServer()` constructs the vault lazily via
 *   `createDatabase()` and wires the step-up challenge repository
 *   alongside the rest of the cross-cutting ports. The route
 *   handlers run in the same fastify boot that registers them, so
 *   the deps may not yet be ready at `app.register` time. Each
 *   handler rebuilds the command inside the request, fetching the
 *   current deps from the server-owned getters; this keeps the
 *   command heap-isolated and matches the detokenize-route pattern.
 *
 * # Plaintext hygiene
 *
 *   The route is a release-pre-authorisation step. The body carries
 *   a `tokenId` and a `factorId` — both opaque identifiers. No
 *   field in the response surface carries plaintext Aadhaar or a
 *   wrapped envelope; the eventual detokenize will use the
 *   `challengeId` we return here as proof-of-step-up.
 */
import type { FastifyInstance, FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';

import {
    RequestDetokenizationCommandError,
    makeRequestDetokenization,
} from '../application/commands/request-detokenization.js';
import type { EventPublisher } from '../application/ports/event-publisher.js';
import type { StepUpChallengeRepository } from '../application/ports/step-up-challenge.repository.js';
import type { Database } from '../db/index.js';
import type { Logger } from '../logger.js';

const ActorRoleEnum = z.enum([
    'TEACHER',
    'SCHOOL_ADMIN',
    'STATE_ADMIN',
    'SUPER_ADMIN',
    'SERVICE',
]);

/**
 * `context` shape is the same family used by every other command's
 * caller context (`tokenize`, `detokenize`, `enroll-mfa`,
 * `verify-mfa`). The `actorId` field is treated as a *fallback*
 * only when the JWT subject is absent, so validation here mirrors
 * the detokenize route's contract and callers can share
 * client-side types across the workflow.
 */
const RequestDetokenizationContextSchema = z
    .object({
        actorId: z.string().min(1).max(128),
        actorRole: ActorRoleEnum,
        reason: z.string().min(10).max(512),
        requestId: z.string().min(1).max(128).optional(),
        sourceIp: z.string().max(64).optional(),
        userAgent: z.string().max(512).optional(),
    })
    .strict();

const RequestDetokenizationRequestSchema = z
    .object({
        tokenId: z.string().min(1).max(128),
        factorId: z.string().min(1).max(128),
        context: RequestDetokenizationContextSchema,
    })
    .strict();

/**
 * Status mapping for {@link RequestDetokenizationCommandError} codes.
 * Anything not in this table is treated as a 500. Deliberately
 * small: every code is documented in the command's file-level
 * comment, and the wire surface is exactly the seven codes below.
 *
 * The split between 403 and 404 matters: a `FACTOR_NOT_FOUND` is
 * observably different from `FACTOR_NOT_ACTIVE` / `FACTOR_EXPIRED`.
 * The first means "this factor id does not exist for you"; the
 * second means "this factor exists but cannot be used right now"
 * — an authorisation failure distinct from a missing row.
 */
const ERROR_STATUS: Record<string, number> = {
    INVALID_INPUT: 400,
    INVALID_CONFIG: 500,
    TOKEN_NOT_FOUND: 404,
    IDENTITY_NOT_FOUND: 404,
    FACTOR_NOT_FOUND: 404,
    FACTOR_NOT_ACTIVE: 403,
    FACTOR_EXPIRED: 403,
};

/**
 * Stable, non-leaky human-readable messages keyed by error code. The
 * `INVALID_CONFIG` code does not have a wire message — the handler
 * falls back to a generic message. We never echo the underlying
 * error's `.message` to the client — it has been logged with the
 * full detail (including the parameter that failed the lookup).
 */
const ERROR_MESSAGES: Record<string, string> = {
    INVALID_INPUT:
        'Request input did not satisfy the request-detokenization contract.',
    INVALID_CONFIG: 'Vault is misconfigured for request-detokenization.',
    TOKEN_NOT_FOUND: 'The supplied token does not match any vault row.',
    IDENTITY_NOT_FOUND: 'The vault row references a missing identity row.',
    FACTOR_NOT_FOUND: 'The requested MFA factor does not exist.',
    FACTOR_NOT_ACTIVE: 'The requested MFA factor is not active.',
    FACTOR_EXPIRED: 'The requested MFA factor is expired.',
};

function replyForCommandError(
    reply: FastifyReply,
    err: RequestDetokenizationCommandError,
): void {
    const status = ERROR_STATUS[err.code] ?? 500;
    reply.code(status).send({
        error: err.code,
        message:
            ERROR_MESSAGES[err.code] ?? 'An unexpected error occurred.',
    });
}

/**
 * Route-level dependencies. `version` is surfaced in logs / audit
 * metadata; the four getters all return `undefined` until the
 * server has finished booting (lazy seam — see file-level comment
 * for rationale). Tests can build a `RequestDetokenizationDeps`
 * with the same shape to drive `requestDetokenizationRoutes` in
 * isolation.
 */
export interface RequestDetokenizationDeps {
    /** API version surfaced in logs and audit `meta`. */
    version: string;
    db: () => Database | undefined;
    events: () => EventPublisher | undefined;
    challenges: () => StepUpChallengeRepository | undefined;
    logger: Logger;
}

/**
 * Fastify plugin. Registers the single
 * `POST /v1/detokenize/request` endpoint. See file-level header for
 * the full auth / status / hygiene contract.
 */
export const requestDetokenizationRoutes: FastifyPluginAsync<{
    deps: RequestDetokenizationDeps;
}> = async (
    app: FastifyInstance,
    { deps }: { deps: RequestDetokenizationDeps },
) => {
    app.post('/v1/detokenize/request', async (req, reply) => {
        // Auth boundary. `requireScope` throws a 401 / 403 reply
        // if the principal is missing or lacks the scope; the
        // throw is caught by Fastify's error handler before we
        // touch any vault dependency.
        req.requireScope('vault:detokenize');

        const db = deps.db();
        const events = deps.events();
        const challenges = deps.challenges();

        if (!db || !events || !challenges) {
            deps.logger.error(
                { route: 'POST /v1/detokenize/request' },
                'aadhaar-vault route invoked with missing dependency',
            );
            reply.code(503).send({
                error: 'service_unavailable',
                message: 'Vault not ready.',
            });
            return;
        }

        const parsed = RequestDetokenizationRequestSchema.safeParse(req.body);
        if (!parsed.success) {
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

        const body = parsed.data;

        // The JWT subject is the trusted principal. When the route
        // is called by a service credential with an empty subject,
        // the body's `actorId` is the fallback. This is the same
        // principal-trust policy documented on `detokenize.routes.ts`
        // and `tokenize.routes.ts`: an authenticated caller cannot
        // impersonate a different principal by rewriting the body.
        const verifiedSubject = req.principal?.subject;
        const actorId =
            verifiedSubject && verifiedSubject.length > 0
                ? verifiedSubject
                : body.context.actorId;
        const actorRole = body.context.actorRole;

        // Construct the command per the application-layer contract.
        // Every port that the command touches is read off the
        // already-wired Database facade (`db.tokens`, `db.identities`,
        // `db.mfa`, `db.audit`) or off the server-owned
        // step-up challenge repository. No business logic lives in
        // this handler; the command owns validation, persistence,
        // audit, and event publication.
        const command = makeRequestDetokenization({
            tokens: db.tokens,
            identities: db.identities,
            mfa: db.mfa,
            challenges,
            audit: db.audit,
            events,
        });

        try {
            const result = await command({
                tokenId: body.tokenId,
                factorId: body.factorId,
                context: {
                    actorId,
                    actorRole,
                    reason: body.context.reason,
                    requestId:
                        body.context.requestId ?? req.id ?? undefined,
                    sourceIp: body.context.sourceIp ?? req.ip,
                    userAgent:
                        body.context.userAgent ??
                        (req.headers['user-agent']
                            ? String(req.headers['user-agent'])
                            : undefined),
                },
            });

            // `expiresAt` is a `Date`. Fastify / `JSON.stringify`
            // serialises it to ISO-8601 on the wire; we do NOT
            // call `.toISOString()` ourselves so the contract
            // matches the other commands' response shapes verbatim.
            reply.code(200).send({
                challengeId: result.challengeId,
                expiresAt: result.expiresAt,
                requiredFactor: result.requiredFactor,
            });
        } catch (err) {
            if (err instanceof RequestDetokenizationCommandError) {
                deps.logger.info(
                    {
                        errCode: err.code,
                        actorId,
                        actorRole,
                        tokenId: body.tokenId,
                        factorId: body.factorId,
                        reqId: req.id,
                    },
                    'aadhaar-vault request-detokenization rejected',
                );
                replyForCommandError(reply, err);
                return;
            }
            deps.logger.error(
                { err, reqId: req.id },
                'aadhaar-vault request-detokenization unexpected error',
            );
            throw err;
        }
    });
};

export default requestDetokenizationRoutes;