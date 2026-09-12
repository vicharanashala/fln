// ==========================================
// VAULT MODULE — STABLE ERROR CODES
// ==========================================
// 22 stable error codes (plus 2 vault-internal ones) ported from
// src/routes/error-mapping.ts and the existing
// mirror in backend/src/aadhaarVault.ts:KNOWN_VAULT_CODES. Every vault error
// thrown anywhere in the module must use one of these codes; the HTTP layer
// maps code → status via mapVaultErrorToHttp() in routes/.
//
// IMPORTANT: this list is part of the public contract. Clients (the FLN
// admin UI, the audit pipeline) match on the `error` field. Adding a new
// code is fine; renaming or removing one is a breaking change.
export const KNOWN_VAULT_CODES = [
  // 4xx — client errors
  'INVALID_INPUT',                // 400 — Zod parse / shape mismatch
  'UNAUTHORIZED',                 // 401 — missing or invalid service JWT
  'FORBIDDEN',                    // 403 — valid JWT but wrong scope
  'PEPPER_MISMATCH',              // 422 — raw Aadhaar doesn't match the active pepper
  'RATE_LIMIT',                   // 429 — local anti-abuse
  'TOKEN_NOT_FOUND',              // 404 — tokenId not in vault
  'IDENTITY_NOT_FOUND',           // 404 — identityId not in vault
  'FACTOR_NOT_FOUND',             // 404 — factorId not registered
  'FACTOR_NOT_ACTIVE',            // 403 — factor revoked
  'FACTOR_EXPIRED',               // 403 — factor past its expiresAt
  'CHALLENGE_NOT_FOUND',          // 404 — challengeId unknown
  'CHALLENGE_NOT_PENDING',        // 403 — approve called twice or on a consumed/expired challenge
  'CHALLENGE_NOT_APPROVED',       // 403 — detokenize called before approve
  'CHALLENGE_EXPIRED',            // 410 — challenge past TTL (Gone, not 403, because the
                                  //       challenge is *unrecoverable* — re-request required)
  'CHALLENGE_CONSUMED',           // 409 — concurrent detokenize collapsed to one winner
  'CHALLENGE_OPERATION_MISMATCH', // 403 — challenge's operation != detokenize
  'ACTOR_MISMATCH',               // 403 — caller is not the original requester
  'CODE_MISMATCH',                // 403 — TOTP code wrong
  'CODE_REPLAYED',                // 403 — same TOTP code used twice (anti-replay)
  'UNWRAP_FAILED',                // 500 — DEK unwrap failed (master key mismatch)
  'DECRYPTION_FAILED',            // 500 — AES-GCM auth tag mismatch (tampered ciphertext)
  'INVALID_PAYLOAD',              // 500 — decrypted plaintext is not a valid Aadhaar shape
  // 5xx — server / transport
  'INTERNAL',                     // 500 — unexpected error
  'VAULT_DB_REQUIRES_REPLICA_SET',// 503 — withTransaction() called against a non-replica-set Mongo
  'VAULT_DB_UNAVAILABLE',         // 503 — Mongo unreachable (no JSON-file fallback for vault writes)
] as const;

export type VaultErrorCode = typeof KNOWN_VAULT_CODES[number];

// HTTP status mapping for the 22 client-visible codes. Mirrors the vault's
// src/routes/error-mapping.ts:mapCommandError table. Kept here (not in the
// Express route layer) so the contract is co-located with the codes.
export const VAULT_CODE_TO_HTTP_STATUS: Record<VaultErrorCode, number> = {
  INVALID_INPUT: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  PEPPER_MISMATCH: 422,
  RATE_LIMIT: 429,
  TOKEN_NOT_FOUND: 404,
  IDENTITY_NOT_FOUND: 404,
  FACTOR_NOT_FOUND: 404,
  FACTOR_NOT_ACTIVE: 403,
  FACTOR_EXPIRED: 403,
  CHALLENGE_NOT_FOUND: 404,
  CHALLENGE_NOT_PENDING: 403,
  CHALLENGE_NOT_APPROVED: 403,
  CHALLENGE_EXPIRED: 410,
  CHALLENGE_CONSUMED: 409,
  CHALLENGE_OPERATION_MISMATCH: 403,
  ACTOR_MISMATCH: 403,
  CODE_MISMATCH: 403,
  CODE_REPLAYED: 403,
  UNWRAP_FAILED: 500,
  DECRYPTION_FAILED: 500,
  INVALID_PAYLOAD: 500,
  INTERNAL: 500,
  VAULT_DB_REQUIRES_REPLICA_SET: 503,
  VAULT_DB_UNAVAILABLE: 503,
};

export class VaultError extends Error {
  public readonly code: VaultErrorCode;
  public readonly status: number;

  constructor(code: VaultErrorCode, message: string, statusOverride?: number) {
    super(message);
    this.name = 'VaultError';
    this.code = code;
    this.status = statusOverride ?? VAULT_CODE_TO_HTTP_STATUS[code];
    // Maintain proper prototype chain for instanceof across transpilation.
    Object.setPrototypeOf(this, VaultError.prototype);
  }
}
