# application/util

## Overview
Small helpers shared by commands that handle sensitive buffers.

## Interface
- `dek-zero.ts`: `safeZero(buf: Buffer | null | undefined): void` zero-fills a Buffer in place; no-op for falsy, non-Buffer, or empty input. (A near-duplicate `safeZero(buf: Buffer)` exists in [../../util/dek-zero.ts](../../util/README.md) and is the one imported by commands. The copy in this directory is dead code: no file, including tests, imports it.)
- `mfa-secret-context.ts`: `makeMfaSecretContext(factorId): Buffer` returns UTF-8 `mfa-factor:<factorId>`; throws on empty/non-string.

## Invariants
- The MFA seal/open context format `mfa-factor:<factorId>` must be identical in enroll, verify, and approve; changing it makes all stored `encryptedSecret` blobs unopenable.
- Each call returns a fresh Buffer; the caller zeroes it.
- Callers (enroll, verify, approve) seal and open under this context, though the factor id is a v4 `randomUUID()` (some in-code comments say UUIDv7).

## Side Effects
- `safeZero` mutates the passed Buffer. Nothing else.

## Verification
- Run: `npm test --workspace @fln/backend`
