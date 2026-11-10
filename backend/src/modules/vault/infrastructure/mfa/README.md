# infrastructure/mfa

## Overview
TOTP adapter built on the `otpauth` library.

## Interface
- `totp-verifier.ts`: `OtpAuthTotpVerifier` (`generateEnrollment(actor, label, meta?)`, `verifyCode(secret, code, window=1, nowMs)`, `currentCode(secret, nowMs)`), and `buildTotpWithMeta(secret, meta)`.

## Invariants
- Defaults: SHA1, 8 digits, 30 s. `currentCode` uses the 8-digit default. Secret size depends on algorithm (SHA1 20, SHA256 32, SHA512 64 bytes), random via `otpauth.Secret`.
- otpauth URI issuer `FLN Vault`, label `FLN Vault:<actor>/<label with whitespace/colons replaced by "-", max 64>`.
- Verification re-derives the algorithm from the secret length; it always uses period 30. The stored `algorithm`/`digits`/`period` on the factor are not consulted, so non-default `period` enrolments will not verify correctly. Whitespace in the code is stripped; non-digits return `{valid:false}`.
- Returns `{valid:true, delta}` where delta is the step offset within the window.

## Side Effects
- None besides CPU and randomness. The returned enrollment secret Buffer must be zeroed by the caller.

## Verification
- Run: `tsx --test src/modules/vault/tests/step-up-e2e.test.ts` via `npm test --workspace @fln/backend`
