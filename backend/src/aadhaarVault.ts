// Aadhaar Vault client — shared by the backend's route modules.
//
// Moves raw Aadhaar out of the primary request path: on student registration
// the backend calls the vault's POST /v1/tokenize and persists only a mask,
// an opaque token, and a deterministic identity id. This module is the single
// integration point for the Aadhaar Vault microservice
// (microservices/aadhaar-vault/), so route modules can call it without
// creating a circular dependency on index.ts.
//
// Phase 2 hardening (this revision):
//   - Request timeout via AbortSignal.timeout(...) — a hung vault can no
//     longer hang registration (or serially stall every row of a bulk import).
//     Tunable via AADHAAR_VAULT_TIMEOUT_MS (default 10000ms).
//   - Typed VaultError carrying { code, status } so internal callers can
//     distinguish configuration problems, network failures, timeouts,
//     malformed responses and the vault's own stable error codes.
//   - Clear fail-closed configuration error when the service JWT secret is
//     missing. Registration still fails; nothing is ever written.
//
// Logging hygiene: no message produced here ever contains the raw Aadhaar,
// the minted service JWT, or any secret — only stable error codes, HTTP
// statuses and transport-level descriptions.
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const AADHAAR_VAULT_URL = (process.env.AADHAAR_VAULT_URL || 'http://127.0.0.1:4101').replace(/\/+$/, '');
const AADHAAR_VAULT_SERVICE_JWT_SECRET = process.env.AADHAAR_VAULT_SERVICE_JWT_SECRET;
const AADHAAR_VAULT_SERVICE_JWT_ISSUER = process.env.AADHAAR_VAULT_SERVICE_JWT_ISSUER;
const AADHAAR_VAULT_SERVICE_JWT_AUDIENCE = process.env.AADHAAR_VAULT_SERVICE_JWT_AUDIENCE;
const AADHAAR_VAULT_SERVICE_JWT_SUBJECT = process.env.AADHAAR_VAULT_SERVICE_JWT_SUBJECT || 'fln-backend-service';

// Conservative service-to-service timeout: the vault is a small local
// Postgres-backed service and tokenization is one transaction.
const DEFAULT_TIMEOUT_MS = 10000;

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

// ---------------------------------------------------------------------------
// Typed error surface (Phase 2 hardening)
// ---------------------------------------------------------------------------

/** Stable failure codes raised by this client. */
export type VaultErrorCode =
  // Local configuration problem — fail-closed before any network call.
  | 'NOT_CONFIGURED'
  // Connection/DNS/socket failure — vault could not be reached at all.
  | 'UNREACHABLE'
  // Request aborted because the vault did not answer in time.
  | 'TIMEOUT'
  // Vault answered successfully but the body was unusable / contract-breaking.
  | 'MALFORMED_RESPONSE'
  // The vault's own stable error codes (tokenize.routes.ts ERROR_STATUS).
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'PEPPER_MISMATCH'
  | 'RATE_LIMIT'
  | 'INTERNAL'
  // Any other non-OK status whose body does not carry a known code.
  | 'UNKNOWN_VAULT_ERROR';

/**
 * Typed failure thrown by {@link tokenizeAadhaar}.
 *
 * `status` mirrors the closest HTTP status so internal handlers can reason
 * about retryability (4xx vs 5xx vs transport) WITHOUT parsing messages.
 * Messages are safe to log: they never contain raw Aadhaar, bearer tokens,
 * or vault secrets — only stable codes and transport descriptions. The
 * public API keeps returning its generic application-level error; this
 * type exists for backend logs and internal handling only.
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

function buildVaultServiceJwt(): string {
  if (!AADHAAR_VAULT_SERVICE_JWT_SECRET) {
    // Fail closed BEFORE any network call, with an actionable message that
    // names the exact variables an operator must set (values never logged).
    throw new VaultError(
      'NOT_CONFIGURED',
      500,
      'AADHAAR_VAULT_SERVICE_JWT_SECRET is not configured. Set AADHAAR_VAULT_URL and '
        + 'AADHAAR_VAULT_SERVICE_JWT_SECRET (plus optionally AADHAAR_VAULT_SERVICE_JWT_ISSUER / '
        + '_AUDIENCE / _SUBJECT) to match the vault deployment. Registration cannot proceed '
        + 'safely until this is fixed.',
    );
  }

  const signingOptions: jwt.SignOptions = {
    algorithm: 'HS256',
    expiresIn: '5m',
  };
  if (AADHAAR_VAULT_SERVICE_JWT_ISSUER) signingOptions.issuer = AADHAAR_VAULT_SERVICE_JWT_ISSUER;
  if (AADHAAR_VAULT_SERVICE_JWT_AUDIENCE) signingOptions.audience = AADHAAR_VAULT_SERVICE_JWT_AUDIENCE;

  return jwt.sign(
    {
      sub: AADHAAR_VAULT_SERVICE_JWT_SUBJECT,
      scope: 'vault:tokenize',
    },
    AADHAAR_VAULT_SERVICE_JWT_SECRET,
    signingOptions,
  );
}

export type AadhaarTokenizeContext = {
  email?: string;
  sourceIp?: string;
  userAgent?: string;
  requestId?: string;
};

/** Resolved per call so ops can tune it via env without touching code. */
function resolveTimeoutMs(): number {
  const parsed = Number(process.env.AADHAAR_VAULT_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

/**
 * Tokenize a raw 12-digit Aadhaar with the Aadhaar Vault microservice.
 * The raw value is sent to the vault over HTTPS and is never stored in the
 * FLN backend's own database.
 *
 * Throws {@link VaultError} on ANY failure — callers must fail the
 * registration; there is no plaintext fallback path by design.
 */
export async function tokenizeAadhaar(
  rawAadhar: string,
  context: AadhaarTokenizeContext = {},
): Promise<AadhaarVaultTokenizeResult> {
  const serviceJwt = buildVaultServiceJwt();
  const timeoutMs = resolveTimeoutMs();

  let response: Response;
  try {
    response = await fetch(`${AADHAAR_VAULT_URL}/v1/tokenize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceJwt}`,
      },
      body: JSON.stringify({
        raw: rawAadhar,
        type: 'AADHAAR',
        context: {
          actorId: AADHAAR_VAULT_SERVICE_JWT_SUBJECT,
          actorRole: 'SERVICE',
          reason: `Aadhaar tokenization for student registration by ${context.email || 'unknown user'}`,
          requestId: context.requestId || `fln-${randomUUID()}`,
          sourceIp: context.sourceIp,
          userAgent: context.userAgent,
        },
      }),
      // Phase 2 hardening: bound the request so a hung vault fails the
      // registration quickly instead of hanging the HTTP request.
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError' || err?.code === 'ABORT_ERR') {
      throw new VaultError('TIMEOUT', 504, `Aadhaar Vault did not respond within ${timeoutMs}ms.`);
    }
    throw new VaultError(
      'UNREACHABLE',
      503,
      `Could not reach the Aadhaar Vault at ${AADHAAR_VAULT_URL}: ${err?.message || 'network failure'}.`,
    );
  }

  // Body parse is best-effort: error responses are JSON today, but a proxy
  // or 5xx page may not be. Body contents are never echoed on parse failure.
  const data: any = await response.json().catch(() => null);

  if (!response.ok) {
    const vaultCode: string = typeof data?.error === 'string' ? data.error : '';
    const knownCodes: readonly VaultErrorCode[] = [
      'INVALID_INPUT', 'UNAUTHORIZED', 'FORBIDDEN', 'PEPPER_MISMATCH', 'RATE_LIMIT', 'INTERNAL',
    ];
    const code: VaultErrorCode = knownCodes.find(c => c === vaultCode) ?? 'UNKNOWN_VAULT_ERROR';
    // The vault returns stable, generic messages (it never echoes input),
    // so surfacing data.message internally is safe; fall back to status alone.
    const message: string =
      typeof data?.message === 'string' && data.message.length > 0
        ? data.message
        : `Aadhaar Vault returned HTTP ${response.status}.`;
    throw new VaultError(code, response.status, message);
  }

  // Success-contract check (POST /v1/tokenize → 201 with these fields).
  if (
    !data ||
    typeof data.token !== 'string' || data.token.length === 0 ||
    typeof data.identityId !== 'string' || data.identityId.length === 0
  ) {
    throw new VaultError(
      'MALFORMED_RESPONSE',
      502,
      'Aadhaar Vault returned a success status without the required token/identityId fields.',
    );
  }

  return data as AadhaarVaultTokenizeResult;
}
