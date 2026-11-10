# infrastructure/auth

## Overview
JWT verification adapter for service-to-service scopes.

## Interface
- `jwt-verifier.ts`: `Hs256JwtVerifier(options: {secret, issuer?, audience?, clockToleranceSeconds?})` implements `JwtVerifier`; methods `verify(token) -> {subject, scopes}`, `describe()`, getter `algorithm` (`'HS256'`).

## Invariants
- Secret must be a string of at least 32 bytes (constructor throws otherwise).
- Only `HS256` is accepted. `sub` is required. Scopes come from `scope` (space-separated string) or `scp` (string array).
- All `jose` failures are mapped to `JwtVerificationError` codes (`token_expired`, `issuer_mismatch`, `audience_mismatch`, `claim_missing`, `signature_invalid`, `token_malformed`, `unsupported_algorithm`, `token_missing`).
- Any error that is not a recognised `jose` error maps to `token_malformed`.
- Currently not referenced by `context.ts` or `middleware.ts`; vault routes do not enforce scopes via this class. Nothing in `src/` or `tests/` constructs it, so no verifier backs the scope claims described for `VaultScope`. The comment at `middleware.ts:17` names it `JoseJwtVerifier`, a class that does not exist.

## Side Effects
- None (CPU-only signature check).

## Verification
- Run: `npm test --workspace @fln/backend`
