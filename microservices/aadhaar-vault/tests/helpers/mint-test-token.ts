/**
 * Test-only helper: mints HS256-signed JWTs.
 *
 * We deliberately do NOT depend on a third-party JWT library for this
 * — `node:crypto.createHmac` is enough for the spec we use (HS256 +
 * `scope` claim). Keeping the helper dependency-free means a broken
 * `npm install` (e.g., `jose` pulled out) does not cascade into
 * hundreds of red tests.
 *
 * The verifier adapter (`Hs256JwtVerifier`) is the contract this
 * helper speaks to; if you change the wire format here, you must
 * keep the adapter in lock-step.
 */
import { createHmac } from 'node:crypto';

export interface MintTokenOptions {
  /** HMAC secret — must match the verifier's configured secret. */
  secret: string;
  /** `sub` claim. */
  subject: string;
  /** Will be space-joined into the `scope` claim. */
  scopes?: string[];
  issuer?: string;
  audience?: string;
  /** Positive or negative seconds from now. Defaults to +300s. */
  expiresInSec?: number;
  /** Seconds from now; negative = "valid in the past". Default 0. */
  notBeforeSec?: number;
  /** Override the clock for deterministic tests. Defaults to Date.now(). */
  nowMs?: number;
}

const HEADER = base64urlFromBytes(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8'));

export function mintTestToken(opts: MintTokenOptions): string {
  const nowSec = Math.floor((opts.nowMs ?? Date.now()) / 1000);
  const payload: Record<string, unknown> = {
    sub: opts.subject,
    scope: (opts.scopes ?? []).join(' '),
    iat: nowSec,
    nbf: nowSec + (opts.notBeforeSec ?? 0),
    exp: nowSec + (opts.expiresInSec ?? 300),
  };
  if (opts.issuer) payload.iss = opts.issuer;
  if (opts.audience) payload.aud = opts.audience;

  const body = base64urlFromBytes(Buffer.from(JSON.stringify(payload), 'utf8'));
  const signingInput = `${HEADER}.${body}`;
  const sig = createHmac('sha256', opts.secret).update(signingInput).digest();
  return `${signingInput}.${base64urlFromBytes(sig)}`;
}

function base64urlFromBytes(b: Buffer): string {
  return b
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}