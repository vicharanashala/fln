/**
 * Fastify type augmentations for the auth plugin.
 *
 * After `app.register(authPlugin)` runs, every request carries:
 *   - `request.principal` — the verified JWT principal (or `null` if the
 *     route is in the public allow-list).
 *   - `request.requireScope(scope)` — throws 403 if the principal lacks
 *     the requested scope.
 *
 * Routes that MUST be authenticated read `request.principal` and
 * pre-handlers (see `authPlugin`) reject unauthenticated requests with
 * 401 before the handler runs.
 */
import "fastify";
import type { JwtScope, JwtPrincipal } from "../application/ports/jwt-verifier.js";

declare module "fastify" {
  interface FastifyRequest {
    /**
     * The verified JWT principal for this request, or `null` when the
     * route is in the public allow-list (e.g. `/health`).
     */
    readonly principal: JwtPrincipal | null;

    /**
     * Assert that the principal carries `scope`. Throws an error with
     * `statusCode: 403` if the assertion fails.
     */
    requireScope: (scope: JwtScope) => void;
  }

  interface FastifyContextConfig {
    /** Mark a route as public so the auth plugin does not require a token. */
    public?: boolean;
  }
}