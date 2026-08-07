/**
 * HS256 (HMAC-SHA256) JWT verifier adapter.
 *
 * Implements the `JwtVerifier` port using a shared symmetric secret.
 * Suitable for internal/trusted-issuer deployments and for local dev.
 *
 * Security notes:
 *   - The secret is NEVER logged. We compare secret lengths in logs only.
 *   - The token's `alg` header is enforced to be exactly `HS256` to prevent
 *     algorithm-confusion attacks (e.g. `alg: none` or RS256-via-HMAC).
 *   - Issuer and audience are enforced when configured.
 *   - Clock skew defaults to 0; callers can override via `clockTolerance`.
 */
import { jwtVerify, errors as joseErrors, type JWTPayload, type JWTVerifyOptions } from "jose";
import { TextEncoder } from "node:util";

import type {
  JwtPrincipal,
  JwtScope,
  JwtToken,
  JwtVerifier,
} from "../../application/ports/jwt-verifier.js";
import { JwtVerificationError } from "../../application/ports/jwt-verifier.js";

export interface Hs256JwtVerifierOptions {
  /** Raw shared secret. MUST be at least 32 bytes of entropy. */
  readonly secret: string;
  /** Expected `iss` claim. When set, the token's `iss` must match exactly. */
  readonly issuer?: string;
  /** Expected `aud` claim. When set, the token's `aud` must include it. */
  readonly audience?: string;
  /**
   * Allowed clock skew in seconds when validating `exp` / `nbf`.
   * Defaults to 0.
   */
  readonly clockToleranceSeconds?: number;
}

/**
 * Extract the set of scopes from a verified payload.
 *
 * Supports both the OAuth2-style `scope` claim (space-delimited string)
 * and the JWT-style `scp` claim (array of strings). Both are normalised
 * to a `ReadonlySet<string>`.
 */
function extractScopes(payload: JWTPayload): ReadonlySet<JwtScope> {
  const scopes = new Set<JwtScope>();
  const raw = payload["scope"] ?? payload["scp"];
  if (typeof raw === "string") {
    for (const s of raw.split(/\s+/u)) {
      if (s.length > 0) scopes.add(s);
    }
  } else if (Array.isArray(raw)) {
    for (const s of raw) {
      if (typeof s === "string" && s.length > 0) scopes.add(s);
    }
  }
  return scopes;
}

/** Map a `jose` error to our typed `JwtVerificationError`. */
function toVerificationError(err: unknown): JwtVerificationError {
  if (err instanceof JwtVerificationError) return err;
  if (err instanceof joseErrors.JWTExpired) {
    return new JwtVerificationError("token_expired", "Token has expired", { cause: err });
  }
  if (err instanceof joseErrors.JWTClaimValidationFailed) {
    const claim = err.claim;
    const code = claim === "iss"
      ? "issuer_mismatch"
      : claim === "aud"
        ? "audience_mismatch"
        : "claim_missing";
    return new JwtVerificationError(code, err.message, { cause: err });
  }
  if (err instanceof joseErrors.JWSSignatureVerificationFailed) {
    return new JwtVerificationError("signature_invalid", "Signature verification failed", { cause: err });
  }
  if (err instanceof joseErrors.JWSInvalid || err instanceof joseErrors.JWTInvalid) {
    return new JwtVerificationError("token_malformed", err.message, { cause: err });
  }
  if (err instanceof joseErrors.JOSEAlgNotAllowed || err instanceof joseErrors.JOSENotSupported) {
    return new JwtVerificationError("unsupported_algorithm", err.message, { cause: err });
  }
  return new JwtVerificationError("token_malformed", "Token verification failed", { cause: err });
}

export class Hs256JwtVerifier implements JwtVerifier {
  private readonly key: Uint8Array;
  private readonly options: Hs256JwtVerifierOptions;
  private readonly jwtVerifyOptions: JWTVerifyOptions;

  constructor(options: Hs256JwtVerifierOptions) {
    if (typeof options.secret !== "string" || options.secret.length === 0) {
      throw new Error("Hs256JwtVerifier: `secret` must be a non-empty string");
    }
    if (Buffer.byteLength(options.secret, "utf8") < 32) {
      throw new Error(
        "Hs256JwtVerifier: `secret` must be at least 32 bytes (256 bits) of entropy",
      );
    }
    this.options = options;
    const enc = new TextEncoder();
    this.key = enc.encode(options.secret);

    const verifyOptions: JWTVerifyOptions = {
      algorithms: ["HS256"],
      clockTolerance: options.clockToleranceSeconds ?? 0,
    };
    if (options.issuer !== undefined) verifyOptions.issuer = options.issuer;
    if (options.audience !== undefined) verifyOptions.audience = options.audience;
    this.jwtVerifyOptions = verifyOptions;
  }

  /** The signing algorithm this verifier accepts (always `HS256`). */
  public get algorithm(): "HS256" {
    return "HS256";
  }

  /** Effective options (read-only, safe to log without the secret). */
  public describe(): { algorithm: "HS256"; issuer?: string; audience?: string } {
    const out: { algorithm: "HS256"; issuer?: string; audience?: string } = {
      algorithm: "HS256",
    };
    if (this.options.issuer !== undefined) out.issuer = this.options.issuer;
    if (this.options.audience !== undefined) out.audience = this.options.audience;
    return out;
  }

  public async verify(token: JwtToken): Promise<JwtPrincipal> {
    if (typeof token !== "string" || token.length === 0) {
      throw new JwtVerificationError("token_missing", "Token is missing or empty");
    }
    let payload: JWTPayload;
    try {
      const result = await jwtVerify(token, this.key, this.jwtVerifyOptions);
      payload = result.payload;
    } catch (err) {
      throw toVerificationError(err);
    }

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new JwtVerificationError("claim_missing", "Token is missing a `sub` claim");
    }

    return {
      subject: payload.sub,
      scopes: extractScopes(payload),
    };
  }
}