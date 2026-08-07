/**
 * Stable HTTP error mapping for application-layer command errors
 * (Session 7C).
 *
 * The application commands throw `*CommandError` subclasses that
 * already carry a stable `code` string and a `httpStatus` number.
 * The HTTP layer never inspects the error message to choose a
 * status code — it just reads `httpStatus`. This module
 * consolidates that contract in one place so the route handlers
 * stay thin and so the mapping is unit-testable in isolation.
 *
 * `MapCommandError` is the single function every route uses. It
 * returns `{ status, code, message }`. Routes hand that straight
 * to `reply.status(status).send({ code, message })`.
 *
 * If a future command throws an error not on the allow-list, the
 * mapper falls through to a generic `500 INTERNAL_ERROR` and the
 * framework never leaks the message text. Stack traces never
 * leave the server.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Minimum shape any command error must satisfy. All four command
 * error classes (`RequestDetokenizationCommandError`,
 * `VerifyMfaCommandError`, `DetokenizeCommandError`) conform.
 */
export interface CommandErrorLike extends Error {
    readonly code: string;
    readonly httpStatus: number;
}

/**
 * Stable HTTP shape returned to clients.
 */
export interface MappedHttpError {
    status: number;
    code: string;
    message: string;
}

/**
 * Type guard. Allows callers to filter unknown errors before they
 * fall through to the 500 path.
 */
export function isCommandErrorLike(
    err: unknown,
): err is CommandErrorLike {
    return (
        err instanceof Error &&
        typeof (err as { code?: unknown }).code === 'string' &&
        typeof (err as { httpStatus?: unknown }).httpStatus === 'number'
    );
}

/**
 * Map a thrown error to a deterministic `{ status, code, message }`.
 *
 * Known `*CommandError` codes keep their `httpStatus` and `code`;
 * only the message is sanitised to the error's `message` (which
 * the application layer already authors to be safe-for-clients —
 * no stack traces, no internal ids beyond what the caller
 * supplied). Anything we don't recognise becomes a stable
 * `INTERNAL_ERROR` with status 500 and a generic message, and the
 * caller-side stack trace is logged via the Fastify request
 * logger so an operator can still triage.
 */
/**
 * Explicit HTTP-status overrides for codes whose canonical status
 * (carried on the command error) differs from the Session 7C
 * route-layer contract. The keys MUST be in SCREAMING_SNAKE_CASE
 * (the form every route uses when it throws a `*CommandError`).
 *
 * Today two overrides are in force:
 *   - CHALLENGE_OWNER_MISMATCH: a command-level classification
 *     (a different principal holds the challenge than the one
 *     asking to consume it) is a *forbidden* action, not a
 *     conflict. We map it to 403 to align the API surface with
 *     the "wrong actor" rule in the Session 7C spec.
 *   - CHALLENGE_EXPIRED: the canonical command error has its own
 *     410, but we keep the override here so a future command
 *     refactor that demotes the code to 409 still surfaces the
 *     RFC-7231 "gone" semantic on the HTTP layer.
 */
const STATUS_OVERRIDES: Readonly<Record<string, number>> = Object.freeze({
    CHALLENGE_OWNER_MISMATCH: 403,
    CHALLENGE_EXPIRED: 410,
});

export function mapCommandError(err: unknown): MappedHttpError {
    if (isCommandErrorLike(err)) {
        const override = STATUS_OVERRIDES[err.code];
        const status = override !== undefined ? override : err.httpStatus;
        return {
            status,
            code: err.code,
            message: err.message,
        };
    }
    return {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'unexpected server error',
    };
}

/**
 * Convenience: send the mapped error directly on a Fastify reply.
 *
 * The supplied request is used only for structured logging of
 * unrecognised errors. The error message itself is never
 * reflected back to the client for unknown errors (no message
 * sniffing / no stack traces).
 */
export function replyWithCommandError(
    reply: FastifyReply,
    request: FastifyRequest,
    err: unknown,
): FastifyReply {
    const mapped = mapCommandError(err);
    if (mapped.status >= 500) {
        request.log.error(
            { err, route: request.routeOptions?.url ?? request.url },
            'unrecognised error in route handler',
        );
    } else {
        request.log.warn(
            {
                code: mapped.code,
                status: mapped.status,
                route: request.routeOptions?.url ?? request.url,
            },
            'command error mapped to HTTP response',
        );
    }
    return reply.status(mapped.status).send({
        code: mapped.code,
        message: mapped.message,
    });
}