// Aadhaar Vault client — shared by the backend's route modules.
//
// Moves raw Aadhaar out of the primary request path: on student registration
// the backend calls the vault and persists only a mask, an opaque token, and
// a deterministic identity id. This module is the single integration point
// for the in-process Aadhaar Vault (backend/src/modules/vault/), so route
// modules can call it without creating a circular dependency on index.ts.
//
// Phase 7 (this revision):
//   The legacy HTTP path to a separate Fastify+Postgres microservice has
//   been deleted (microservices/aadhaar-vault/ is gone). The vault is now
//   an in-process module that wires its 5 commands (`tokenizeAadhaar`,
//   `enrollMfa`, `requestDetokenization`, `approveStepUpChallenge`,
//   `detokenizeAadhaar`) into this module's swappable impls at boot
//   (see modules/vault/context.ts). Before that wiring runs — for example,
//   in tests that don't enable the module — the impls fall back to
//   throwing a clear `NOT_CONFIGURED` `VaultError` so a stray call fails
//   fast and obviously rather than silently succeeding.
//
// Step-up workflow:
//   The full Step-Up flow (admin reveal) drives 4 commands in sequence:
//     1. `enrollMfa`              — mint a TOTP factor for the admin
//     2. `requestDetokenization`  — mint a challenge bound to (token, factor)
//     3. `approveStepUpChallenge` — verify the admin's TOTP code
//     4. `detokenizeAadhaar`      — consume the approved challenge, recover plaintext
//   These are invoked by `backend/src/routes/aadhaarDetokenize.ts`, never
//   from the browser. The Vault never issues user-scoped JWTs — every
//   command runs entirely inside the backend process.
//
// Logging hygiene: no message produced here ever contains the raw Aadhaar,
// a TOTP code, the otpauth URI (which encodes the shared secret), or any
// secret — only stable error codes, HTTP statuses and contract descriptions.
import type { Request } from 'express';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Stable failure codes raised by every method on this module. */
export type VaultErrorCode =
  // Local configuration problem — fail-closed before any work happens.
  | 'NOT_CONFIGURED'
  // The vault's own stable error codes (tokenize / detokenize / mfa / step-up).
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'PEPPER_MISMATCH'
  | 'RATE_LIMIT'
  | 'INTERNAL'
  // Step-up lifecycle codes (mirrored 1:1 from the vault module).
  | 'TOKEN_NOT_FOUND'
  | 'IDENTITY_NOT_FOUND'
  | 'FACTOR_NOT_FOUND'
  | 'FACTOR_NOT_ACTIVE'
  | 'FACTOR_EXPIRED'
  | 'CHALLENGE_NOT_FOUND'
  | 'CHALLENGE_NOT_PENDING'
  | 'CHALLENGE_NOT_APPROVED'
  | 'CHALLENGE_EXPIRED'
  | 'CHALLENGE_CONSUMED'
  | 'CHALLENGE_OPERATION_MISMATCH'
  | 'ACTOR_MISMATCH'
  | 'CODE_MISMATCH'
  | 'CODE_REPLAYED'
  | 'UNWRAP_FAILED'
  | 'DECRYPTION_FAILED'
  | 'INVALID_PAYLOAD'
  // Required for the stale shim; the in-process command never throws it
  // today, but the type is preserved for call-site compatibility.
  | 'TIMEOUT'
  | 'UNREACHABLE'
  | 'MALFORMED_RESPONSE'
  | 'UNKNOWN_VAULT_ERROR';

/**
 * Typed failure thrown by every method on this module.
 *
 * `status` mirrors the closest HTTP status so internal handlers can reason
 * about retryability (4xx vs 5xx) WITHOUT parsing messages. Messages are
 * safe to log: they never contain raw Aadhaar, bearer tokens, TOTP secrets,
 * or vault secrets — only stable codes and contract descriptions.
 */
export class VaultError extends Error {
  readonly code: VaultErrorCode;
  readonly status: number;

  constructor(code: VaultErrorCode, status: number, message: string) {
    super(message);
    this.name = 'VaultError';
    this.code = code;
    this.status = status;
  }
}

export type AadhaarVaultTokenizeResult = {
  token: string;
  last4: string;
  tokenType: string;
  identityId: string;
  auditId: string;
  keyVersion: string | number;
};

/** XXXX-XXXX-<last4> — the only Aadhaar representation allowed at rest. */
export function formatAadhaarMask(rawAadhar: string): string {
  const digits = rawAadhar.replace(/[^0-9]/g, '');
  return 'XXXX-XXXX-' + digits.slice(-4);
}

export type AadhaarTokenizeContext = {
  email?: string;
  sourceIp?: string;
  userAgent?: string;
  requestId?: string;
};

/** Caller context for the step-up + MFA endpoints. Distinct from
 *  `AadhaarTokenizeContext` because the vault requires an `actorRole`
 *  drawn from a fixed enum.
 */
export type AadhaarActorContext = AadhaarTokenizeContext & {
  /** Vault-side role. Maps FLN role → Vault role. Required. */
  actorRole: 'TEACHER' | 'SCHOOL_ADMIN' | 'STATE_ADMIN' | 'SUPER_ADMIN' | 'SERVICE';
};

/** Extract a best-effort AadhaarActorContext from an Express request.
 *  Used by the FLN routes that wrap the vault commands. */
export function actorContextFromRequest(req: Request): AadhaarActorContext {
  const u = (req as any).user ?? {};
  const role = String(u.role || 'SERVICE').toUpperCase();
  // Map FLN role names to the Vault's fixed enum.
  const actorRole: AadhaarActorContext['actorRole'] =
    role === 'SUPERADMIN' ? 'SUPER_ADMIN'
    : role === 'DISTRICT_ADMIN' || role === 'BLOCK_ADMIN' || role === 'STATE_ADMIN' ? 'STATE_ADMIN'
    : role === 'SCHOOL_ADMIN' ? 'SCHOOL_ADMIN'
    : role === 'TEACHER' ? 'TEACHER'
    : 'SERVICE';
  return {
    email: u.email,
    sourceIp: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
    requestId: (req as any).id ?? undefined,
    actorRole,
  };
}

// ---------------------------------------------------------------------------
// Swappable in-process implementations
// ---------------------------------------------------------------------------
//
// Every public function delegates to an `*Impl` closure. The in-process
// vault module (`backend/src/modules/vault/context.ts`) installs the real
// commands at boot. Until that wiring runs — for example in tests that
// bypass module boot — the default impl throws `NOT_CONFIGURED` so a
// stray call fails fast and obviously rather than silently succeeding.
// The Phase 1-6 default (HTTP fetch) is gone; the in-process module
// is the only path.

const NOT_CONFIGURED: VaultError = new VaultError(
  'NOT_CONFIGURED',
  500,
  'Aadhaar vault module is not wired. backend/src/index.ts must import '
    + 'backend/src/modules/vault and call registerVaultRoutes(app) at boot. '
    + 'This call cannot proceed safely until that is fixed.',
);

export type TokenizeAadhaarFn = (
  rawAadhar: string,
  context: AadhaarTokenizeContext,
) => Promise<AadhaarVaultTokenizeResult>;

let tokenizeAadhaarImpl: TokenizeAadhaarFn = async () => { throw NOT_CONFIGURED; };
const tokenizeAadhaarImplDefault = tokenizeAadhaarImpl;

export function __setTokenizeAadhaarImpl(fn: TokenizeAadhaarFn | null): void {
  tokenizeAadhaarImpl = fn === null ? tokenizeAadhaarImplDefault : fn;
}

export async function tokenizeAadhaar(
  rawAadhar: string,
  context: AadhaarTokenizeContext = {},
): Promise<AadhaarVaultTokenizeResult> {
  return tokenizeAadhaarImpl(rawAadhar, context);
}

export type EnrollMfaParams = {
  actor: string;
  label?: string;
  algorithm?: 'SHA1' | 'SHA256' | 'SHA512';
  digits?: number;
  period?: number;
  context: AadhaarActorContext;
};

export type EnrollMfaResult = {
  factorId: string;
  otpauthUri: string;
  factor: Record<string, unknown>;
};

export type EnrollMfaFn = (params: EnrollMfaParams) => Promise<EnrollMfaResult>;

let enrollMfaImpl: EnrollMfaFn = async () => { throw NOT_CONFIGURED; };
const enrollMfaImplDefault = enrollMfaImpl;

export function __setEnrollMfaImpl(fn: EnrollMfaFn | null): void {
  enrollMfaImpl = fn === null ? enrollMfaImplDefault : fn;
}

export async function enrollMfa(params: EnrollMfaParams): Promise<EnrollMfaResult> {
  return enrollMfaImpl(params);
}

export type RequestDetokenizationParams = {
  tokenId: string;
  factorId: string;
  context: AadhaarActorContext;
};

export type RequestDetokenizationResult = {
  challengeId: string;
  expiresAt: string;
  requiredFactor: Record<string, unknown>;
};

export type RequestDetokenizationFn = (
  params: RequestDetokenizationParams,
) => Promise<RequestDetokenizationResult>;

let requestDetokenizationImpl: RequestDetokenizationFn = async () => { throw NOT_CONFIGURED; };
const requestDetokenizationImplDefault = requestDetokenizationImpl;

export function __setRequestDetokenizationImpl(fn: RequestDetokenizationFn | null): void {
  requestDetokenizationImpl = fn === null ? requestDetokenizationImplDefault : fn;
}

export async function requestDetokenization(
  params: RequestDetokenizationParams,
): Promise<RequestDetokenizationResult> {
  return requestDetokenizationImpl(params);
}

export type ApproveStepUpParams = {
  challengeId: string;
  /** 6- or 8-digit TOTP code from the admin's authenticator app. NEVER logged. */
  code: string;
  context: AadhaarActorContext;
};

export type ApproveStepUpResult = {
  challengeId: string;
  status: 'approved';
  approvedAt: string;
  verifiedFactorId: string;
};

export type ApproveStepUpChallengeFn = (
  params: ApproveStepUpParams,
) => Promise<ApproveStepUpResult>;

let approveStepUpChallengeImpl: ApproveStepUpChallengeFn = async () => { throw NOT_CONFIGURED; };
const approveStepUpChallengeImplDefault = approveStepUpChallengeImpl;

export function __setApproveStepUpChallengeImpl(fn: ApproveStepUpChallengeFn | null): void {
  approveStepUpChallengeImpl = fn === null ? approveStepUpChallengeImplDefault : fn;
}

export async function approveStepUpChallenge(
  params: ApproveStepUpParams,
): Promise<ApproveStepUpResult> {
  return approveStepUpChallengeImpl(params);
}

export type DetokenizeParams = {
  challengeId: string;
  context: AadhaarActorContext;
};

export type DetokenizeResult = {
  token: string;
  identityId: string;
  /** Plaintext 12-digit Aadhaar — TEMPORARY. Must not be persisted / cached
   *  beyond the lifetime of the admin's reveal step. The frontend clears it
   *  on dialog close and after a short auto-clear timer. */
  aadhaar: string;
  last4: string;
  auditId: string;
};

export type DetokenizeAadhaarFn = (
  params: DetokenizeParams,
) => Promise<DetokenizeResult>;

let detokenizeAadhaarImpl: DetokenizeAadhaarFn = async () => { throw NOT_CONFIGURED; };
const detokenizeAadhaarImplDefault = detokenizeAadhaarImpl;

export function __setDetokenizeAadhaarImpl(fn: DetokenizeAadhaarFn | null): void {
  detokenizeAadhaarImpl = fn === null ? detokenizeAadhaarImplDefault : fn;
}

export async function detokenizeAadhaar(
  params: DetokenizeParams,
): Promise<DetokenizeResult> {
  return detokenizeAadhaarImpl(params);
}

/**
 * Read-only metadata about a persisted TOTP factor — the projection we
 * expose over the wire. The `encryptedSecret` and any other secret
 * material stays server-side; this envelope is for admin self-service UI
 * only. `lastUsedAt` / `expiresAt` are ISO strings when present, `null`
 * otherwise. `createdAt` is always an ISO string.
 *
 * `lifecycleState` and `verifyAttempts` are REQUIRED on the wire —
 * the Security panel and the Aadhaar reveal dialog both branch on
 * `lifecycleState` to decide whether to render the Pending/Enrolled
 * state or the "Authenticator required" handoff to the Security
 * panel. Omitting these fields (the pre-fix shape) made every
 * just-verified factor look like "not enrolled" to the UI, which
 * in turn made the Security panel's "Set up authenticator" button
 * fire a POST /api/me/mfa/enroll that returned 409 ALREADY_ENROLLED.
 */
export type MfaFactorMeta = {
  factorId: string;
  actor: string;
  factorType: 'totp' | string;
  status: 'active' | 'revoked' | string;
  lifecycleState: 'PENDING_ENROLLMENT' | 'ENROLLED';
  label: string | null;
  algorithm: 'SHA1' | 'SHA256' | 'SHA512' | string;
  digits: number;
  period: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  verifyAttempts: number;
};

export type ListMfaFactorsParams = {
  actor: string;
};

export type ListMfaFactorsResult = {
  factors: MfaFactorMeta[];
};

export type ListMfaFactorsFn = (
  params: ListMfaFactorsParams,
) => Promise<ListMfaFactorsResult>;

let listMfaFactorsImpl: ListMfaFactorsFn = async () => { throw NOT_CONFIGURED; };
const listMfaFactorsImplDefault = listMfaFactorsImpl;

export function __setListMfaFactorsImpl(fn: ListMfaFactorsFn | null): void {
  listMfaFactorsImpl = fn === null ? listMfaFactorsImplDefault : fn;
}

/**
 * List the caller's active TOTP factors, newest first. Used by the
 * FLN-side enroll route to detect a returning admin and reuse the
 * existing factor rather than mint a new secret every reveal. Only
 * factors with `status: 'active'` are returned — revoked factors are
 * hidden by design. The caller's identity is bound to the JWT subject
 * by the route layer; this function does not authorize.
 */
export async function listMfaFactors(
  params: ListMfaFactorsParams,
): Promise<ListMfaFactorsResult> {
  return listMfaFactorsImpl(params);
}

// ---------------------------------------------------------------------------
// VerifyMfa shim (Wave 2A)
// ---------------------------------------------------------------------------
//
// Wraps the vault command's verifyMfa use case for the FLN
// /api/me/mfa/verify route. Same swappable-impl pattern as the
// other shims above: the default impl throws NOT_CONFIGURED
// until `__setVerifyMfaFactorImpl` is wired by
// `backend/src/modules/vault/context.ts`. The wire shape mirrors
// the existing AadhaarActorContext so the route handler doesn't
// have to translate between two context shapes.
//
// Result shape: a flattened envelope that hides the underlying
// `VerifyMfaResult` discriminated union. The route maps the
// failure `reason` to an HTTP status; the success shape is the
// factor id + lifecycle state the UI needs to transition from
// the "Pending" to the "Enrolled" render state.

const NOT_CONFIGURED_VERIFY: VaultError = new VaultError(
  'NOT_CONFIGURED',
  500,
  'Aadhaar vault module is not wired. backend/src/index.ts must import '
    + 'backend/src/modules/vault and call registerVaultRoutes(app) at boot. '
    + 'This call cannot proceed safely until that is fixed.',
);

export type VerifyMfaFactorParams = {
  factorId: string;
  code: string;
  /** JWT subject — the actor who owns this factor. The command
   *  refuses to verify a factor whose `actor` does not match
   *  (the cross-admin attack guard). */
  actor: string;
  context: {
    actorId: string;
    actorRole: 'TEACHER' | 'SCHOOL_ADMIN' | 'STATE_ADMIN' | 'SUPER_ADMIN' | 'SERVICE';
    reason: string;
    requestId?: string;
  };
};

export type VerifyMfaFactorResult =
  | {
      valid: true;
      factorId: string;
      lifecycleState: 'PENDING_ENROLLMENT' | 'ENROLLED';
      delta?: number;
    }
  | {
      valid: false;
      factorId: string | null;
      reason:
        | 'FACTOR_NOT_FOUND'
        | 'FACTOR_REVOKED'
        | 'FACTOR_EXPIRED'
        | 'ACTOR_MISMATCH'
        | 'CODE_MISMATCH'
        | 'ALREADY_ENROLLED';
    };

export type VerifyMfaFactorFn = (params: VerifyMfaFactorParams) => Promise<VerifyMfaFactorResult>;

let verifyMfaFactorImpl: VerifyMfaFactorFn = async () => { throw NOT_CONFIGURED_VERIFY; };
const verifyMfaFactorImplDefault = verifyMfaFactorImpl;

export function __setVerifyMfaImpl(fn: VerifyMfaFactorFn | null): void {
  verifyMfaFactorImpl = fn === null ? verifyMfaFactorImplDefault : fn;
}

/**
 * Verify a 6-8 digit TOTP code against the caller's factor. The
 * command flips a PENDING_ENROLLMENT factor to ENROLLED on first
 * success and returns the post-transition lifecycle state so the
 * route can distinguish first-verify (200, lifecycleState=ENROLLED)
 * from re-verify (409, ALREADY_ENROLLED).
 */
export async function verifyMfaFactor(
  params: VerifyMfaFactorParams,
): Promise<VerifyMfaFactorResult> {
  return verifyMfaFactorImpl(params);
}

// ---------------------------------------------------------------------------
// RevokeMfa shim (Wave 2A)
// ---------------------------------------------------------------------------
//
// Wraps the vault repository's `mfa.revoke(factorId)` for the FLN
// DELETE /api/me/mfa/factors/:factorId route. Same swappable-impl
// pattern as the other shims; default impl throws NOT_CONFIGURED
// until `__setRevokeMfaImpl` is wired in
// `backend/src/modules/vault/context.ts`. The route performs
// actor-isolation BEFORE calling this shim, so the shim itself
// does not authorize — it just delegates to the in-process
// repository and returns the updated row.

const NOT_CONFIGURED_REVOKE: VaultError = new VaultError(
  'NOT_CONFIGURED',
  500,
  'Aadhaar vault module is not wired. backend/src/index.ts must import '
    + 'backend/src/modules/vault and call registerVaultRoutes(app) at boot. '
    + 'This call cannot proceed safely until that is fixed.',
);

export type RevokeMfaParams = {
  factorId: string;
};

export type RevokeMfaResult = {
  factorId: string;
  status: 'revoked';
};

export type RevokeMfaFn = (params: RevokeMfaParams) => Promise<RevokeMfaResult>;

let revokeMfaImpl: RevokeMfaFn = async () => { throw NOT_CONFIGURED_REVOKE; };
const revokeMfaImplDefault = revokeMfaImpl;

export function __setRevokeMfaImpl(fn: RevokeMfaFn | null): void {
  revokeMfaImpl = fn === null ? revokeMfaImplDefault : fn;
}

/**
 * Revoke a TOTP factor. Idempotent — revoking an already-
 * revoked row is a no-op that still returns the row.
 */
export async function revokeMfaFactor(
  params: RevokeMfaParams,
): Promise<RevokeMfaResult> {
  return revokeMfaImpl(params);
}
