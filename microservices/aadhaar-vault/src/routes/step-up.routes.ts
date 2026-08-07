/**
 * `POST /v1/detokenize/step-up/:challengeId/approve` — HTTP surface
 * for the {@link makeApproveStepUpChallenge} application command
 * (Session 7E).
 *
 * This route is the *second* of three routes that together implement
 * the step-up workflow for releasing an Aadhaar plaintext:
 *
 *   1. `POST /v1/detokenize/request`     → already shipped; mints a
 *      `vault_step_up_challenges` row in `pending` status.
 *   2. `POST /v1/detokenize/step-up/:challengeId/approve`
 *                                     → **this route**. Caller proves
 *      possession of the TOTP factor bound to the challenge; the
 *      challenge row flips from `pending` to `approved`. **No
 *      plaintext is ever returned by this route.**
 *   3. `POST /v1/detokenize`             → already shipped; consumes
 *      the approved challenge id and returns the plaintext.
 *
 * The route is the only place where the v0.1 partition between
 * application and infrastructure changes direction: the route
 * receives a JSON body + URL param, validates them, builds the
 * application-layer `ApproveStepUpChallengeCallerContext`, and asks
 * the command to do the work. The command itself never imports
 * `fastify`.
 *
 * # Auth boundary
 *
 *   1. Caller must present a verified Bearer JWT — supplied by the
 *      Session 5 Phase 1 auth plugin. No token → `401`.
 *   2. The token must carry `vault:detokenize` in its `scope` claim.
 *      Otherwise → `403`. The same scope is reused for the entire
 *      detokenize workflow (request / verify-mfa / release); the
 *      step-up never warrants a separate scope because it is just a
 *      gated preamble to the actual plaintext release. This mirrors
 *      the policy documented on `request-detokenization.routes.ts`.
 *   3. The JWT subject (a stable principal id) is the *trusted*
 *      `actorId` recorded in the audit row. The body's
 *      `context.actorId` is intentionally overridden when the JWT
 *      subject is present. This is the same principal-trust
 *      invariant documented on every other authenticated route in
 *      this codebase: an authenticated caller cannot impersonate a
 *      different principal by rewriting the body.
 *
 * # Status mapping
 *
 *   - `200` — challenge row flipped `pending → approved`, audit row
 *             appended, `StepUpChallengeApproved` event published.
 *   - `400` — JSON body failed schema validation, or the command
 *             rejected with `INVALID_INPUT` (empty `code`, etc.).
 *   - `401` — missing / malformed / expired / untrusted Bearer.
 *   - `403` — token verified but missing `vault:detokenize`. Also
 *             returned by the command for the *authorisation*
 *             failures `CHALLENGE_NOT_PENDING` /
 *             `CHALLENGE_EXPIRED` / `FACTOR_NOT_ACTIVE` /
 *             `FACTOR_EXPIRED` / `CODE_MISMATCH` (a challenger
 *             in the wrong state, or a factor that is not
 *             usable, is an authorisation failure — not a
 *             missing row).
 *   - `404` — `CHALLENGE_NOT_FOUND` / `FACTOR_NOT_FOUND`.
 *   - `500` — `INVALID_CONFIG` or any other unexpected error.
 *   - `503` — vault dependencies were not wired before the request
 *             arrived (race during startup).
 *
 * # Why the deps are lazy getters
 *
 *   `buildServer()` constructs the vault lazily via
 *   `createDatabase()` / `createKeyManager()` / `createTotpVerifier()`
 *   and wires the step-up challenge repository alongside the rest
 *   of the cross-cutting ports. The route handlers run in the same
 *   fastify boot that registers them, so the deps may not yet be
 *   ready at `app.register` time. Each handler rebuilds the command
 *   inside the request, fetching the current deps from the
 *   server-owned getters; this keeps the command heap-isolated and
 *   matches the tokenize/detokenize/request-detokenization route
 *   patterns.
 *
 * # Plaintext hygiene
 *
 *   The route is the *step-up* side of the release pre-authorisation
 *   step. No field in the response surface carries plaintext Aadhaar
 *   or a wrapped envelope; the eventual detokenize will use the
 *   approved `challengeId` (and its `approvedAt` / `verifiedFactorId`
 *   audit-trail) as proof-of-step-up. The route's only wire output is
 *   `{ challengeId, status, approvedAt, verifiedFactorId }`.
 */
import type { FastifyInstance, FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';

import {
    ApproveStepUpChallengeCommandError,
    makeApproveStepUpChallenge,
} from '../application/commands/approve-step-up-challenge.js';
import type { EventPublisher } from '../application/ports/event-publisher.js';
import type { KeyManager } from '../application/ports/key-manager.js';
import type { Logger } from '../logger.js';
import type { StepUpChallengeRepository } from '../application/ports/step-up-challenge.repository.js';
import type { Database } from '../db/index.js';
import type { TotpVerifier } from '../application/ports/totp-verifier.js';

const ActorRoleEnum = z.enum([
    'TEACHER',
    'SCHOOL_ADMIN',
    'STATE_ADMIN',
    'SUPER_ADMIN',
    'SERVICE',
]);

/**
 * `context` shape mirrors every other command's caller context
 * (`tokenize`, `detokenize`, `enroll-mfa`, `verify-mfa`,
 * `request-detokenization`). The `actorId` field is treated as a
 * *fallback* only when the JWT subject is absent, so validation
 * here mirrors the rest of the routes' contract and callers can
 * share client-side types across the workflow.
 */
const ApproveStepUpContextSchema = z
    .object({
        actorId: z.string().min(1).max(128),
        actorRole: ActorRoleEnum,
        reason: z.string().min(10).max(512),
        requestId: z.string().min(1).max(128).optional(),
        sourceIp: z.string().max(64).optional(),
        userAgent: z.string().max(512).optional(),
    })
    .strict();

/**
 * The MFA factor is identified by `challenge.requiredFactorId` —
 * the client MUST NOT supply `mfaId`. The schema is `.strict()`
 * so a request body that includes an unknown property (such as a
 * legacy `mfaId`) is rejected with `400 invalid_request`.
 *
 * `code` is the 6-digit TOTP the caller typed (numeric strings of
 * the length the factor was enrolled with). The body intentionally
 * does NOT carry `actorId` — the principal-trust invariant (see
 * step 5 in the handler) forces the JWT subject into that slot.
 */
const ApproveStepUpRequestSchema = z
    .object({
        code: z.string().regex(/^[0-9]{6,10}$/),
        context: ApproveStepUpContextSchema,
    })
    .strict();

/**
 * Status mapping for {@link ApproveStepUpChallengeCommandError}
 * codes. Anything not in this table is treated as a 500.
 * Deliberately small: every code is documented in the command's
 * file-level comment, and the wire surface is exactly the codes
 * below.
 *
 * The split between 403 and 404 matters: a `CHALLENGE_NOT_FOUND` is
 * observably different from `CHALLENGE_NOT_PENDING`. The first means
 * "this challenge id does not exist"; the second means "this
 * challenge exists but is not in a state that can be approved" —
 * an authorisation failure distinct from a missing row. We mirror
 * the same split that the request-detokenization route uses between
 * `FACTOR_NOT_FOUND` (404) and `FACTOR_NOT_ACTIVE` (403).
 */
const ERROR_STATUS: Record<string, number> = {
    INVALID_INPUT: 400,
    INVALID_CONFIG: 500,
    CHALLENGE_NOT_FOUND: 404,
    CHALLENGE_EXPIRED: 403,
    CHALLENGE_NOT_PENDING: 403,
    FACTOR_NOT_FOUND: 404,
    FACTOR_NOT_ACTIVE: 403,
    FACTOR_EXPIRED: 403,
    CODE_MISMATCH: 403,
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
        'Request input did not satisfy the step-up-approval contract.',
    INVALID_CONFIG: 'Vault is misconfigured for step-up approval.',
    CHALLENGE_NOT_FOUND:
        'The supplied challenge id does not match any vault row.',
    CHALLENGE_EXPIRED: 'The step-up challenge has already expired.',
    CHALLENGE_NOT_PENDING:
        'The step-up challenge is not in a pending state.',
    FACTOR_NOT_FOUND: 'The requested MFA factor does not exist.',
    FACTOR_NOT_ACTIVE: 'The requested MFA factor is not active.',
    FACTOR_EXPIRED: 'The requested MFA factor is expired.',
    CODE_MISMATCH: 'Verification code did not match.',
};

function replyForCommandError(
    reply: FastifyReply,
    err: ApproveStepUpChallengeCommandError,
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
 * for rationale). Tests can build an `ApproveStepUpDeps` with the
 * same shape to drive `stepUpApproveRoutes` in isolation.
 */
export interface ApproveStepUpDeps {
    /** API version surfaced in logs and audit `meta`. */
    version: string;
    keyManager: () => KeyManager | undefined;
    totp: () => TotpVerifier | undefined;
    db: () => Database | undefined;
    events: () => EventPublisher | undefined;
    challenges: () => StepUpChallengeRepository | undefined;
    logger: Logger;
}

/**
 * Fastify plugin. Registers the single
 * `POST /v1/detokenize/step-up/:challengeId/approve` endpoint.
 * See file-level header for the full auth / status / hygiene
 * contract.
 */
export const stepUpApproveRoutes: FastifyPluginAsync<{
    deps: ApproveStepUpDeps;
}> = async (
    app: FastifyInstance,
    { deps }: { deps: ApproveStepUpDeps },
) => {
    app.post(
        '/v1/detokenize/step-up/:challengeId/approve',
        async (req, reply) => {
            // -----------------------------------------------------------------
            // 1. Auth boundary. `requireScope` throws a 401 / 403
            //    reply if the principal is missing or lacks the
            //    scope; the throw is caught by Fastify's error
            //    handler before we touch any vault dependency.
            // -----------------------------------------------------------------
            req.requireScope('vault:detokenize');

            // -----------------------------------------------------------------
            // 2. URL-param shape check. Fastify route params are
            //    strings; we apply a length cap so a 100-KB
            //    challenge id from a buggy client trips a 400 here
            //    rather than at the repository lookup.
            // -----------------------------------------------------------------
            const params = req.params as { challengeId?: unknown };
            const challengeIdRaw = params.challengeId;
            if (
                typeof challengeIdRaw !== 'string' ||
                challengeIdRaw.length < 1 ||
                challengeIdRaw.length > 128
            ) {
                reply.code(400).send({
                    error: 'invalid_request',
                    message:
                        'Request URL parameter failed validation.',
                    details: [
                        {
                            path: 'challengeId',
                            code: 'invalid_string',
                        },
                    ],
                });
                return;
            }
            const challengeId = challengeIdRaw;

            // -----------------------------------------------------------------
            // 3. Lazy dep resolution. The command needs KeyManager +
            //    TotpVerifier + MfaFactorRepository +
            //    StepUpChallengeRepository + AuditRepository +
            //    EventPublisher.
            // -----------------------------------------------------------------
            const keyManager = deps.keyManager();
            const totp = deps.totp();
            const db = deps.db();
            const events = deps.events();
            const challenges = deps.challenges();

            if (!keyManager || !totp || !db || !events || !challenges) {
                deps.logger.error(
                    {
                        route:
                            'POST /v1/detokenize/step-up/:challengeId/approve',
                    },
                    'aadhaar-vault step-up-approve route invoked with missing dependency',
                );
                reply.code(503).send({
                    error: 'service_unavailable',
                    message: 'Step-up approval not ready.',
                });
                return;
            }

            // -----------------------------------------------------------------
            // 4. JSON body validation. The body intentionally does
            //    NOT carry `actorId` — the principal-trust invariant
            //    (step 5) forces the JWT subject into that slot.
            // -----------------------------------------------------------------
            const parsed = ApproveStepUpRequestSchema.safeParse(req.body);
            if (!parsed.success) {
                reply.code(400).send({
                    error: 'invalid_request',
                    message: 'Request body failed validation.',
                    details: parsed.error.issues.map((i) => {
                        // For `.strict()` violations, Zod puts the
                        // offending key name in `keys` and leaves
                        // `path` empty. Surface the key name so
                        // callers (and tests) can identify the
                        // offending field without parsing prose.
                        let path = i.path.join('.');
                        if (
                            i.code === 'unrecognized_keys' &&
                            Array.isArray(
                                (i as { keys?: unknown }).keys,
                            ) &&
                            (
                                (i as { keys?: unknown[] }).keys ?? []
                            ).length > 0
                        ) {
                            path = String(
                                (i as { keys: unknown[] }).keys[0],
                            );
                        }
                        return { path, code: i.code };
                    }),
                });
                return;
            }

            const body = parsed.data;

            // -----------------------------------------------------------------
            // 5. Principal-trust invariant. The JWT subject is the
            //    trusted principal attempting the step-up. The
            //    body's `actorId` is treated as a fallback used only
            //    when the JWT subject is empty (e.g. a service
            //    credential). This is the same policy documented on
            //    every other authenticated route in this codebase.
            // -----------------------------------------------------------------
            const verifiedSubject = req.principal?.subject;
            const actorId =
                verifiedSubject && verifiedSubject.length > 0
                    ? verifiedSubject
                    : body.context.actorId;
            const actorRole = body.context.actorRole;

            // -----------------------------------------------------------------
            // 6. Build and invoke the command. The audit + event
            //    publish paths travel through the same `db.audit`
            //    and `events` as every other command. The command
            //    returns the success envelope verbatim; every
            //    domain failure (missing challenge, wrong code, ...)
            //    throws a typed command error caught below.
            // -----------------------------------------------------------------
            const command = makeApproveStepUpChallenge({
                keyManager,
                totp,
                mfa: db.mfa,
                challenges,
                audit: db.audit,
                events,
            });

            try {
                const result = await command({
                    challengeId,
                    code: body.code,
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

                // Success. The command has already appended the
                // audit row, flipped the challenge row to
                // `approved`, and published the
                // `StepUpChallengeApproved` event.
                reply.code(200).send({
                    challengeId: result.challengeId,
                    status: result.status,
                    approvedAt: result.approvedAt,
                    verifiedFactorId: result.verifiedFactorId,
                });
            } catch (err) {
                if (err instanceof ApproveStepUpChallengeCommandError) {
                    deps.logger.info(
                        {
                            errCode: err.code,
                            actorId,
                            actorRole,
                            challengeId,
                            reqId: req.id,
                        },
                        'aadhaar-vault step-up-approve rejected',
                    );
                    replyForCommandError(reply, err);
                    return;
                }
                deps.logger.error(
                    { err, reqId: req.id },
                    'aadhaar-vault step-up-approve unexpected error',
                );
                throw err;
            }
        },
    );
};

export default stepUpApproveRoutes;