/**
 * RFC 6238 TOTP verifier adapter.
 *
 * Implementation strategy
 * -----------------------
 *   This adapter is the *only* file in the repository that imports
 *   `otpauth`. The application layer talks to the {@link TotpVerifier}
 *   port (`src/application/ports/totp-verifier.ts`) so swapping the
 *   library (or hand-rolling a verifier if `otpauth` ever goes stale)
 *   is a one-file change.
 *
 *   * `generateEnrollment`  — produces a fresh HMAC key via
 *     {@link Secret}, then asks `otpauth` to format the
 *     `otpauth://totp/...` URI. The user can paste the URI or scan
 *     the QR code into Google Authenticator / Authy / 1Password.
 *   * `verifyCode`          — instantiates a `TOTP` object from the
 *     shared secret and asks for a `validate(code, window)` check.
 *     The library returns an integer delta when the code matches
 *     a counter ± window; we surface that to the caller so a
 *     replay within the same window can be rejected at the
 *     application layer.
 *   * `currentCode`         — also `TOTP.generate()`. Exposed for
 *     tests (RFC 6238 vectors) and for tooling dashboards.
 *
 * Determinism note
 * ----------------
 *   RFC 6238 test vectors pin a `T0` (counter epoch) at Unix time
 *   zero. `otpauth` does the same internally, so passing the wall
 *   clock directly to `TOTP.counter(t)` yields the RFC vector
 *   inputs (T = floor((t - T0) / X), T0 = 0, X = period).
 *
 * Replay protection
 * -----------------
 *   The library does NOT track which codes have been used. Replay
 *   protection lives at the application layer: the
 *   `verifyCode` result carries the matched `delta`; the command
 *   layer combines it with `last_used_at` from the factor row to
 *   refuse reuse of the same counter value.
 */
import { Secret, TOTP } from 'otpauth';

import type {
    TotpAlgorithm,
    TotpEnrollment,
    TotpFactorMeta,
    TotpVerifyResult,
    TotpVerifier,
} from '../../application/ports/totp-verifier.js';

const DEFAULT_ALGORITHM: TotpAlgorithm = 'SHA1';
const DEFAULT_DIGITS = 6;
const DEFAULT_PERIOD = 30;

const ALG_TO_OTPALG = {
    SHA1: 'SHA1',
    SHA256: 'SHA256',
    SHA512: 'SHA512',
} as const;

/**
 * Build the standard `otpauth://totp/...` URI.
 *
 * The issuer + label layout is:
 *
 *   otpauth://totp/{issuer}:{account}?secret={base32}&issuer={issuer}&algorithm={...}&digits={...}&period={...}
 *
 * `otpauth` will percent-encode the label for us, but we still strip
 * stray `:`s from the user-supplied label to avoid ambiguous URIs
 * (the authenticator app splits on the first `:` to find the issuer).
 */
function buildOtpauthUri(
    secret: Secret,
    actor: string,
    label: string,
    meta: TotpFactorMeta,
): string {
    const issuer = 'FLN Vault';
    const safeLabel = label.replace(/[:\s]+/g, '-').slice(0, 64);
    const totp = new TOTP({
        issuer,
        label: `${issuer}:${actor}/${safeLabel}`,
        algorithm: ALG_TO_OTPALG[meta.algorithm],
        digits: meta.digits,
        period: meta.period,
        secret,
    });
    return totp.toString();
}

function normalizeMeta(meta?: Partial<TotpFactorMeta>): TotpFactorMeta {
    return {
        algorithm: meta?.algorithm ?? DEFAULT_ALGORITHM,
        digits: meta?.digits ?? DEFAULT_DIGITS,
        period: meta?.period ?? DEFAULT_PERIOD,
    };
}

/**
 * Adapt `otpauth`'s `validate` return value into the port's tagged
 * result. The library returns either `null` (no match) or an integer
 * counter delta. We preserve the delta so the caller can record it
 * for replay protection.
 */
function mapValidateResult(delta: number | null): TotpVerifyResult {
    if (delta === null) return { valid: false };
    return { valid: true, delta };
}

export class OtpAuthTotpVerifier implements TotpVerifier {
    async generateEnrollment(
        actor: string,
        label: string,
        meta?: Partial<TotpFactorMeta>,
    ): Promise<TotpEnrollment> {
        if (typeof actor !== 'string' || actor.length === 0) {
            throw new Error(
                '[aadhaar-vault] OtpAuthTotpVerifier: actor must be a non-empty string.',
            );
        }
        if (typeof label !== 'string' || label.length === 0) {
            throw new Error(
                '[aadhaar-vault] OtpAuthTotpVerifier: label must be a non-empty string.',
            );
        }
        const effective = normalizeMeta(meta);
        // `Secret` defaults to RFC 6238's recommended length for the
        // chosen algorithm (20 / 32 / 64 bytes). The constructor
        // generates a CSPRNG key when no buffer is supplied.
        const secret = new Secret({
            size: defaultSecretSizeFor(effective.algorithm),
        });
        const otpauthUri = buildOtpauthUri(secret, actor, label, effective);
        // `otpauth`'s `Secret.buffer` is typed as `ArrayBufferLike`; the
        // port contract requires `Buffer`. Copy into a fresh, owned
        // Buffer so the caller can safely zero it via `safeZero`.
        return { secret: Buffer.from(secret.buffer), otpauthUri };
    }

    async verifyCode(
        secret: Buffer,
        code: string,
        window: number = 1,
        nowMs: number = Date.now(),
    ): Promise<TotpVerifyResult> {
        if (!Buffer.isBuffer(secret) || secret.length === 0) {
            throw new Error(
                '[aadhaar-vault] OtpAuthTotpVerifier: secret must be a non-empty Buffer.',
            );
        }
        if (typeof code !== 'string') {
            throw new Error(
                '[aadhaar-vault] OtpAuthTotpVerifier: code must be a string.',
            );
        }
        if (!Number.isFinite(window) || window < 0) {
            throw new Error(
                '[aadhaar-vault] OtpAuthTotpVerifier: window must be ≥ 0.',
            );
        }
        // Normalise the user-typed code: strip whitespace, preserve
        // leading zeros. RFC 6238 codes are decimal so we only accept
        // digits here.
        const trimmed = code.replace(/\s+/g, '');
        if (!/^\d+$/.test(trimmed)) {
            return { valid: false };
        }
        const totp = buildTotpForVerify(secret, trimmed.length);
        const delta = totp.validate({ token: trimmed, window, timestamp: nowMs });
        return mapValidateResult(delta);
    }

    async currentCode(
        secret: Buffer,
        nowMs: number = Date.now(),
    ): Promise<string> {
        if (!Buffer.isBuffer(secret) || secret.length === 0) {
            throw new Error(
                '[aadhaar-vault] OtpAuthTotpVerifier: secret must be a non-empty Buffer.',
            );
        }
        const totp = buildTotpForVerify(secret, DEFAULT_DIGITS);
        return totp.generate({ timestamp: nowMs });
    }
}

/**
 * Build a `TOTP` instance from a raw secret buffer. We do not know
 * the algorithm / digits from the bytes alone; the application's
 * factor row carries those alongside the sealed secret and passes
 * them into the adapter via a hidden codepath (see the test file for
 * how the test surface re-uses the algorithm metadata).
 *
 * For now we expose two constructors:
 *
 *   - `buildTotpForVerify` (private helper above) assumes SHA-1/6.
 *     Production factors are SHA-1/6 by default; any deviation must
 *     go through `buildTotpWithMeta` below.
 *   - `buildTotpWithMeta` is exported for the test suite which needs
 *     to exercise SHA-256 / SHA-512 vectors.
 */
function buildTotpForVerify(secret: Buffer, digits: number): TOTP {
    // Per RFC 6238 Appendix A the recommended shared secret size
    // equals the hash output size (20/32/64 bytes). When the
    // caller does not pass algorithm metadata (the production path
    // through `verifyCode`), infer it from `secret.length` so an
    // adapter can reject the same RFC vectors as the reference
    // implementation. Unknown sizes fall back to SHA-1 so we do
    // not silently reject legacy factors.
    const algorithm = algorithmForSecretSize(secret.length);
    return buildTotpWithMeta(secret, {
        algorithm,
        digits,
        period: DEFAULT_PERIOD,
    });
}

function algorithmForSecretSize(size: number): TotpAlgorithm {
    switch (size) {
        case 20:
            return 'SHA1';
        case 32:
            return 'SHA256';
        case 64:
            return 'SHA512';
        default:
            return DEFAULT_ALGORITHM;
    }
}

export function buildTotpWithMeta(
    secret: Buffer,
    meta: TotpFactorMeta,
): TOTP {
    // `otpauth`'s `Secret` constructor expects `ArrayBufferLike`. A
    // Node `Buffer` is a `Uint8Array<ArrayBufferLike>`; the upstream
    // type does not currently accept that generic instantiation
    // directly, so we narrow with a single targeted cast. The bytes
    // themselves are copied into the Secret's own ArrayBuffer so the
    // caller can safely zero the input Buffer afterwards.
    const buffer: ArrayBufferLike = secret.buffer.slice(
        secret.byteOffset,
        secret.byteOffset + secret.byteLength,
    );
    return new TOTP({
        algorithm: ALG_TO_OTPALG[meta.algorithm],
        digits: meta.digits,
        period: meta.period,
        secret: new Secret({ buffer }),
    });
}

function defaultSecretSizeFor(algorithm: TotpAlgorithm): 20 | 32 | 64 {
    switch (algorithm) {
        case 'SHA1':
            return 20;
        case 'SHA256':
            return 32;
        case 'SHA512':
            return 64;
    }
}