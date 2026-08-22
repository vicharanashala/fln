/**
 * Verifier factory — turns runtime config into a concrete `JwtVerifier`.
 *
 * The only currently-shipped adapter is `Hs256JwtVerifier`. Future
 * adapters (RS256 with JWKS, EdDSA, etc.) can be selected here from
 * `config.algorithm` without changing call sites.
 *
 * `createJwtVerifierFromConfig` is the config-aware entry point used by
 * `buildServer`. It inspects `serviceConfig` and returns `undefined`
 * when the auth prerequisites are not met (e.g. test config without an
 * HMAC secret). The server treats `undefined` as "auth not wired" and
 * logs a warning so the omission is never silent.
 *
 * `loadConfig` already aborts boot in non-test environments when
 * `SERVICE_JWT_HMAC_SECRET` is missing, so the `undefined` path should
 * only ever execute under `NODE_ENV=test`.
 */
import type { Logger } from "../logger.js";
import type { JwtVerifier } from "../application/ports/jwt-verifier.js";
import {
  Hs256JwtVerifier,
  type Hs256JwtVerifierOptions,
} from "../infrastructure/auth/hs256-jwt-verifier.js";
import type { Config } from "../config.js";

export interface JwtVerifierConfig {
  /** Algorithm selector. Currently only `HS256` is supported. */
  readonly algorithm: "HS256";
  /** HS256 shared secret. Required when `algorithm === "HS256"`. */
  readonly secret: string;
  /** When set, tokens MUST have a matching `iss` claim. */
  readonly issuer?: string;
  /** When set, tokens MUST have a matching `aud` claim. */
  readonly audience?: string;
  /** Allowed clock skew in seconds. Defaults to 0. */
  readonly clockToleranceSeconds?: number;
}

/**
 * Construct a `JwtVerifier` from runtime config.
 *
 * @throws if `algorithm` is unknown or required options are missing.
 */
export function createJwtVerifier(config: JwtVerifierConfig): JwtVerifier {
  switch (config.algorithm) {
    case "HS256": {
      const opts: Hs256JwtVerifierOptions = {
        secret: config.secret,
        ...(config.issuer !== undefined ? { issuer: config.issuer } : {}),
        ...(config.audience !== undefined ? { audience: config.audience } : {}),
        ...(config.clockToleranceSeconds !== undefined
          ? { clockToleranceSeconds: config.clockToleranceSeconds }
          : {}),
      };
      return new Hs256JwtVerifier(opts);
    }
    default: {
      // Exhaustiveness check.
      const _exhaustive: never = config.algorithm;
      throw new Error(`Unsupported JWT algorithm: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Pull a verifier out of the runtime `Config` object, or `undefined`
 * when the auth prerequisites are missing.
 *
 * Behaviour:
 *  - `serviceConfig.SERVICE_JWT_HMAC_SECRET` unset → `undefined`.
 *    The boot path emits a single warning so the omission is visible.
 *  - `serviceConfig.SERVICE_JWT_ALGORITHM` unset → defaults to `HS256`.
 *    RS256/JWKS lands in a follow-up; until then, the enum is enforced.
 *  - `SERVICE_JWT_ISSUER` / `SERVICE_JWT_AUDIENCE` are forwarded when
 *    present so the verifier enforces them as mandatory claims.
 *  - `SERVICE_JWT_CLOCK_TOLERANCE_SECONDS` defaults to 30s when unset.
 *    This is slightly more permissive than the verifier's default of 0
 *    so that small NTP drift between the FLN backend and the vault
 *    does not invalidate tokens minted a second ago.
 */
export function createJwtVerifierFromConfig(
  serviceConfig: Config,
  _logger: Logger,
): JwtVerifier | undefined {
  const secret = serviceConfig.SERVICE_JWT_HMAC_SECRET;
  if (secret === undefined || secret.length === 0) {
    return undefined;
  }

  const algorithm = serviceConfig.SERVICE_JWT_ALGORITHM ?? "HS256";
  const clockToleranceSeconds =
    serviceConfig.SERVICE_JWT_CLOCK_TOLERANCE_SECONDS ?? 30;

  return createJwtVerifier({
    algorithm,
    secret,
    ...(serviceConfig.SERVICE_JWT_ISSUER !== undefined
      ? { issuer: serviceConfig.SERVICE_JWT_ISSUER }
      : {}),
    ...(serviceConfig.SERVICE_JWT_AUDIENCE !== undefined
      ? { audience: serviceConfig.SERVICE_JWT_AUDIENCE }
      : {}),
    clockToleranceSeconds,
  });
}