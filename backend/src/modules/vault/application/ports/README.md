# application/ports

## Overview
Interfaces (hexagonal ports) the commands depend on. Implementations live in [../../infrastructure](../../infrastructure/README.md).

## Interface
- `key-manager.ts`: `KeyManager` (`info()`, `generateDataKey(ctx)`, `wrapDataKey`, `unwrapDataKey`, `sealSecret(plaintext, ctx)`, `openSecret(wrapped, ctx)`), types `WrapContext`, `PlainDek`, `WrappedDek`, `WrappedSecret`, `GeneratedDek`, `KeyManagerInfo`. The context buffer is intended to bind ciphertext to its owner.
- `crypto.service.ts`: `CryptoService` (`algorithm`, `encrypt(key, plaintext, aad)`, `decrypt(key, envelope, aad)`), `EncryptedEnvelope {ciphertext, iv, authTag}`.
- `repositories.ts`: `IdentityRepository`, `TokenRepository`, `StepUpChallengeRepository` (`create`, `findById`, `approve`, `consume`, `expire`, `fail`), `MfaFactorRepository`. `IdentityRepository` also has `getById`, `revoke`, `rotate`; `TokenRepository` has `insert`, `findById`; `MfaFactorRepository` has `insert`, `markUsed`, `revoke`, `getById`, `listByActor`, `listActiveByActor`, `findActivePendingByActor`, `transitionToEnrolled`, `incrementVerifyAttempts`. Types `IdentityRecord`, `NewIdentityRecord`, `NewToken`, `TokenRow`, `CreateStepUpChallengeInput`, `ApproveStepUpChallengeInput`, `InsertMfaFactorInput`, `StepUpChallenge`, `StepUpChallengeStatus` (`pending|approved|consumed|expired|failed`), `StepUpOperation` (`'detokenize'`), `MfaFactor` (includes `lifecycleState` and `verifyAttempts`), `MfaFactorType`, `MfaFactorStatus`, `MfaFactorLifecycleState`.
- `transactional-vault-writer.ts`: `TransactionalVaultWriter.runWrite(work)`, `VaultWriteConnection` (`insertIdentity`, `insertToken`, `writeLog`).
- `totp-verifier.ts`: `TotpVerifier` (`generateEnrollment`, `verifyCode(secret, code, window, nowMs)`, `currentCode`), `TotpAlgorithm`, `TotpVerifyResult` (`TotpVerifyOk | TotpVerifyFail`), `TotpEnrollment`, `TotpFactorMeta`.
- `event-publisher.ts`: `EventPublisher.publish(event)`, `DomainEvent {type, ...}`.
- `jwt-verifier.ts`: `JwtVerifier.verify(token) -> JwtPrincipal {subject, scopes}` (types `JwtScope`, `JwtToken`, `JwtPrincipal`), `JwtVerificationError` with typed `code`.

## Invariants
- Conditional repository methods (`approve`, `consume`, `expire`, `fail`) return null when the precondition status does not hold; commands rely on this for concurrency safety.
- Ports carry no Express or Mongo types, except `LogEntry` in the writer port.

## Side Effects
- None (type-only, plus `JwtVerificationError` class).

## Verification
- Run: `npm test --workspace @fln/backend`
