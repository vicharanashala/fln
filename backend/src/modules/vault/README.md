# Vault Module (Aadhaar tokenization vault)

## Overview
In-process Aadhaar tokenization vault inside the FLN backend. Raw 12-digit Aadhaar numbers are envelope-encrypted (AES-256-GCM, per-record DEK wrapped by a key manager) and stored in MongoDB; callers only see an opaque token plus last4. Reversal (detokenize) requires a TOTP-backed step-up challenge: request, approve with an MFA code, then a single-use detokenize. Every operation writes an audit row into the shared FLN `logbook` collection.

Layering: `routes/` (Express) -> `application/commands` (use cases) -> `application/ports` (interfaces) <- `infrastructure/` (Mongo, node:crypto, otpauth, jose, key provider). `context.ts` is the composition root.

## Interface
- `index.ts`: `registerVaultRoutes(app, opts?)` builds the context from `dbStore.getDb()`, sets `app.vaultContext` (null if not wired), serves `GET /health` (`{status:'ok'}` or `{status:'degraded', reason}`), mounts all `/v1` routers. Re-exports `getActiveVaultTransactionCount`, `waitForVaultTransactionsDrain` for graceful shutdown.
- `context.ts`: `buildVaultContext({db, client, logger}) -> {ctx, failureReason?: 'no-mongo'|'key-manager-init-failed', failureError?}`; `VaultContext` holds `tokenize`, `detokenize`, `readAuditHistory`, `enrollMfa`, `requestDetokenization`, `approveStepUpChallenge`, `keyManagerInfo`. It also installs implementations into the legacy facade `backend/src/aadhaarVault.ts` via `__set*Impl` (tokenize, detokenize, enrollMfa, requestDetokenization, approveStepUpChallenge, listMfaFactors, verifyMfa, revokeMfa). `verifyMfa` is built only for that facade and has no HTTP route.
- `errors.ts`: `KNOWN_VAULT_CODES` (25 entries; the file header's "22 plus 2" is out of date), `VAULT_CODE_TO_HTTP_STATUS`, `VaultError(code, message, statusOverride?)`. A second, different `VaultError(code, status, message)` lives in `backend/src/aadhaarVault.ts` and is the one `context.ts` imports; the routes' `instanceof VaultError` checks bind only to the `errors.ts` class. Command-level codes such as `INVALID_CONFIG` (request-detokenization) are not in `KNOWN_VAULT_CODES`.
- `middleware.ts`: `requireScope(scope)`, `VaultScope` (`vault:tokenize|mfa:enroll|mfa:verify|detokenize|audit`; `vault:mfa:verify` is used by no route because no verify route exists).
- Other exports: `index.ts` exports `VaultModuleOptions` and augments `Express.Application` with `vaultContext`; `context.ts` exports `BuildVaultContextInput` and `BuildVaultContextResult`; `flnRoleToVaultRole` in `context.ts` is module-private.
- Subdirectories: [application](./application/README.md), [audit](./audit/README.md), [infrastructure](./infrastructure/README.md), [routes](./routes/README.md), [schema](./schema/README.md), [util](./util/README.md). `tests/` is test-only and undocumented.

## Invariants
- Detokenize is allowed only for a challenge that is `approved`, unexpired, operation `detokenize`, requested by the same `actorId`, and successfully consumed (atomic CAS). One approval yields at most one detokenize.
- Error codes are a public contract: add freely, never rename or remove. 503 `VAULT_DB_UNAVAILABLE` is returned by every route when the context is null.
- Vault module may be un-wired when there is no Mongo (`no-mongo`) or key manager construction fails (`key-manager-init-failed`); the server still starts and `/health` reports `degraded`. Known gap: `ensureVaultIndexes(db)` runs in `buildVaultContext` outside any try/catch and before the key manager is built, and `backend/src/index.ts` awaits `registerVaultRoutes` without a catch, so an index or collection-creation failure aborts boot.

## Side Effects
- Boot: `ensureVaultIndexes` creates collections and indexes in MongoDB; logs wiring status to the console.
- Reads env: `KEY_PROVIDER`, `LOCAL_DEV_MASTER_KEY`, `KEY_VERSION`, `NODE_ENV`, `VAULT_ALLOW_UNSAFE_KEY_PROVIDER`.
- Writes collections `vault_identities`, `vault_tokens`, `vault_step_up_challenges`, `vault_mfa_factors`, and audit rows to the shared `logbook` collection.

## Verification
- Run: `npm test --workspace @fln/backend` (vault subset: `tsx --test src/modules/vault/tests/<file>.test.ts`, files: audit-in-logbook, binary-roundtrip, step-up-e2e, transaction-counter)
