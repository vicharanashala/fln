/**
 * TOTP (RFC 6238) verifier port.
 *
 * The application layer needs a small surface to:
 *   1. Generate a fresh TOTP shared secret at enrollment and the
 *      matching `otpauth://` URI that the user pastes into their
 *      authenticator app or scans from a QR code.
 *   2. Verify a 6-digit code submitted at step-up time, with a small
 *      ±window to absorb clock drift. The verifier must return enough
 *      information for the application to:
 *        - log the verification outcome (success / mismatch);
 *        - record the time-step the code was matched against so the
 *          same code cannot be replayed within the same window.
 *
 * Domain purity:
 *   The port operates on raw byte buffers and digit counts. It knows
 *   nothing about Aadhaar, identity tokens, or HTTP. The `otpauth`
 *   dependency is fully encapsulated by the infrastructure adapter
 *   (`src/infrastructure/mfa/totp-verifier.ts`); the application
 *   layer imports nothing from `otpauth`.
 *
 * Why a clock-skew window?
 *   RFC 6238 §5.2 recommends a small window (typically ±1 step) so the
 *   verifier accepts the previous and next code. The window is part of
 *   the port contract; the application layer does not need to know how
 *   many steps are checked.
 */
export interface TotpEnrollment {
    /** Raw shared-secret bytes. Length is the algorithm's hash output:
     *  SHA-1 → 20 bytes, SHA-256 → 32 bytes, SHA-512 → 64 bytes.
     *  The application layer persists this via {@link sealSecret}; the
     *  verifier itself never sees the secret again after enrollment. */
    secret: Buffer;
    /** `otpauth://totp/...` URI suitable for QR encoding. The label
     *  encodes the actor so the user's authenticator app surfaces the
     *  right account when multiple factors are enrolled. */
    otpauthUri: string;
}

export type TotpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';

export interface TotpFactorMeta {
    algorithm: TotpAlgorithm;
    /** Code length, typically 6. */
    digits: number;
    /** Time-step in seconds, typically 30. */
    period: number;
}

export interface TotpVerifyOk {
    valid: true;
    /**
     * The signed integer offset from "now" to the time-step whose code
     * matched. 0 = current step, -1 = previous step, +1 = next step.
     * The application layer MUST record this so a replay within the
     * same window is rejected.
     */
    delta: number;
}

export interface TotpVerifyFail {
    valid: false;
}

export type TotpVerifyResult = TotpVerifyOk | TotpVerifyFail;

export interface TotpVerifier {
    /**
     * Generate a fresh enrollment. Returns the raw secret bytes (which
     * the caller MUST seal via {@link KeyManager.sealSecret} and then
     * zero) plus the otpauth URI for the authenticator app.
     *
     * @param actor      Stable user identifier (e.g. JWT subject).
     * @param label      User-visible account name (e.g. "FLN Vault").
     * @param meta       Algorithm, digits, period. Defaults to SHA1/6/30
     *                   which is the historical de-facto standard and
     *                   matches Google / Authy / 1Password defaults.
     */
    generateEnrollment(
        actor: string,
        label: string,
        meta?: Partial<TotpFactorMeta>,
    ): Promise<TotpEnrollment>;

    /**
     * Verify a user-submitted code against the unsealed secret bytes.
     * Caller is responsible for {@link safeZero}'ing the secret once
     * verification completes (whether it succeeded or not).
     *
     * @param secret     The unsealed TOTP shared secret.
     * @param code       The 6-digit code as the user typed it. Leading
     *                   zeros are preserved — callers should NOT coerce
     *                   to a number first.
     * @param window     Allowed clock-drift in steps (default 1, i.e.
     *                   accept the previous and next code as well as
     *                   the current one). MUST be ≥ 0.
     * @param nowMs      Wall-clock time used to derive the counter.
     *                   Defaults to Date.now(); tests pass an explicit
     *                   value to assert against RFC 6238 vectors.
     */
    verifyCode(
        secret: Buffer,
        code: string,
        window?: number,
        nowMs?: number,
    ): Promise<TotpVerifyResult>;

    /**
     * Compute the current code for a secret. Used by tests (RFC 6238
     * vectors) and by tooling that wants to render a "live" code on a
     * dashboard. Production HTTP routes MUST NOT expose this method;
     * it is intentionally NOT part of the public command surface.
     */
    currentCode(
        secret: Buffer,
        nowMs?: number,
    ): Promise<string>;
}