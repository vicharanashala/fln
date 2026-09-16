/**
 * `safeZero` — application-layer helper that overwrites the contents
 * of a `Buffer` with zeros. Verbatim port of
 * `src/application/util/dek-zero.ts`.
 *
 * Used by the tokenize / detokenize / enroll-mfa / approve-step-up
 * commands to zero any `Buffer` that briefly held plaintext
 * (per-record DEK, the 12-digit Aadhaar buffer, the TOTP shared
 * secret, the wrap-context buffer, the MFA context buffer).
 *
 * Why a helper:
 *
 *   - Buffer.fill(0) works but it's easy to forget the call. A
 *     single import is harder to skip.
 *   - Centralising lets us swap the implementation later (e.g. for
 *     memory-locked regions) without touching every command.
 *   - The helper is intentionally a no-op on a falsy / non-Buffer
 *     input so the call site's `finally` can `safeZero(buf)` without
 *     a guard.
 */
export function safeZero(buf: Buffer | null | undefined): void {
  if (!buf) return;
  if (!Buffer.isBuffer(buf)) return;
  if (buf.length === 0) return;
  buf.fill(0);
}
