/**
 * JwtVerifier port — application-layer contract for verifying inbound JWTs.
 *
 * The verifier is intentionally minimal: it resolves a token to a strongly
 * typed `JwtPrincipal` (subject + scopes), or throws a typed error.
 *
 * Adapters are responsible for:
 *   - signature algorithm enforcement (HS256, RS256, etc.)
 *   - issuer / audience validation
 *   - clock-skew and expiry handling
 *   - public-key / secret resolution
 *
 * The application layer never sees raw keys, JWKS endpoints, or claim
 * parsing detail — that's the adapter's concern.
 */

/** A single scope / permission claim extracted from a verified JWT. */
export type JwtScope = string;

/**
 * The authenticated principal derived from a verified JWT.
 *
 * - `subject` is the `sub` claim (caller identity).
 * - `scopes` is the normalised set of scopes (`scope` or `scp` claim).
 */
export interface JwtPrincipal {
  readonly subject: string;
  readonly scopes: ReadonlySet<JwtScope>;
}

/** Token supplied by the caller. Raw, unverified, untrusted. */
export type JwtToken = string;

/**
 * Thrown when a token fails verification for any reason (bad signature,
 * wrong issuer/audience, expired, malformed, etc.).
 *
 * Adapters SHOULD set `code` to a stable, machine-readable category so the
 * HTTP layer can map it to a 401 vs 403 response without leaking detail.
 */
export class JwtVerificationError extends Error {
  public readonly code:
    | "token_missing"
    | "token_malformed"
    | "token_expired"
    | "token_not_yet_valid"
    | "signature_invalid"
    | "issuer_mismatch"
    | "audience_mismatch"
    | "claim_missing"
    | "unsupported_algorithm";

  constructor(
    code: JwtVerificationError["code"],
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "JwtVerificationError";
    this.code = code;
  }
}

/**
 * The verifier contract.
 *
 * Implementations MUST be safe to call concurrently and MUST NOT cache
 * verification results across requests — every call performs a fresh
 * verification against the supplied token.
 */
export interface JwtVerifier {
  /**
   * Verify `token` and return the resolved principal.
   *
   * @throws {JwtVerificationError} when the token is missing, malformed,
   *   expired, or otherwise invalid.
   */
  verify(token: JwtToken): Promise<JwtPrincipal>;
}