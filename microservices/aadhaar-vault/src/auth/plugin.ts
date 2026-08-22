/**
 * Auth plugin — Fastify hook that enforces JWT authentication on every
 * non-public route, and exposes `request.principal` + `request.requireScope`
 * to downstream handlers.
 *
 * Usage:
 *
 *     const verifier = createJwtVerifier({ ... }); // see ./factory.ts
 *     await app.register(authPlugin, { verifier });
 *
 *     // Public route (no token required):
 *     app.get('/health', { config: { public: true } }, handler);
 *
 *     // Or, opt a URL prefix out of auth centrally:
 *     await app.register(authPlugin, {
 *       verifier,
 *       publicUrlPrefixes: ['/console/'],
 *     });
 *
 *     // Authenticated route:
 *     app.post('/v1/tokenize', async (req) => {
 *       const { subject, scopes } = req.principal!;
 *       req.requireScope('vault:tokenize');
 *       ...
 *     });
 */
import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";

import { JwtVerificationError } from "../application/ports/jwt-verifier.js";
import type { JwtVerifier } from "../application/ports/jwt-verifier.js";

import "./types.js"; // augment FastifyRequest / FastifyContextConfig

export interface AuthPluginOptions {
  /** The verifier to use for all incoming requests. */
  readonly verifier: JwtVerifier;
  /**
   * URL prefixes that bypass authentication in addition to per-route
   * `config.public = true`. Useful when a third-party plugin (e.g.
   * `@fastify/static`) registers many routes at once and we don't have
   * per-route config knobs available. Match is a simple `startsWith` on
   * `request.url`; keep prefixes narrow to avoid accidentally exposing
   * authenticated endpoints.
   */
  readonly publicUrlPrefixes?: ReadonlyArray<string>;
}

/** Pull the raw token from a request, or `null` if absent. */
function extractBearerToken(req: FastifyRequest): string | null {
  const raw = req.headers.authorization;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const match = /^Bearer\s+(.+)$/iu.exec(trimmed);
  if (match === null) return null;
  const token = match[1]?.trim() ?? "";
  return token.length > 0 ? token : null;
}

/**
 * Map a `JwtVerificationError.code` to the HTTP status code we surface.
 * All codes here represent an unauthenticated / untrusted caller.
 */
function statusForCode(code: JwtVerificationError["code"]): number {
  // `token_expired` and all other "the token is no good" codes are 401.
  return 401;
}

const authPlugin: FastifyPluginAsync<AuthPluginOptions> = async (app, opts) => {
  const { verifier } = opts;

  app.decorateRequest("principal", null);

  app.decorateRequest("requireScope", (scope: string) => {
    throw new Error("requireScope called outside of an authenticated request");
  });

  app.addHook("onRequest", async (req, reply) => {
    const perRoutePublic = req.routeOptions.config?.public === true;
    const prefixPublic = (opts.publicUrlPrefixes ?? []).some((prefix) =>
      req.url.startsWith(prefix),
    );
    const isPublic = perRoutePublic || prefixPublic;
    if (isPublic) {
      // Public routes get an explicit `null` principal so handlers don't
      // accidentally treat them as authenticated.
      (req as unknown as { principal: null }).principal = null;
      return;
    }

    const token = extractBearerToken(req);
    if (token === null) {
      return reply.code(401).send({
        error: "unauthorized",
        message: "Missing or malformed Authorization header",
      });
    }

    try {
      const principal = await verifier.verify(token);
      (req as unknown as { principal: typeof principal }).principal = principal;

      (req as unknown as { requireScope: (s: string) => void }).requireScope =
        (scope: string) => {
          if (!principal.scopes.has(scope)) {
            const err = new Error(`Missing required scope: ${scope}`) as Error & {
              statusCode: number;
            };
            err.statusCode = 403;
            throw err;
          }
        };
    } catch (err) {
      if (err instanceof JwtVerificationError) {
        req.log.debug(
          { code: err.code, msg: err.message },
          "jwt verification failed",
        );
        return reply.code(statusForCode(err.code)).send({
          error: "unauthorized",
          code: err.code,
        });
      }
      // Unknown error — never leak detail to the client.
      req.log.error({ err }, "unexpected error during jwt verification");
      return reply.code(401).send({ error: "unauthorized" });
    }
  });
};

export default fp(authPlugin, {
  name: "aadhaar-vault/auth",
  fastify: "4.x",
});