# infrastructure/db

## Overview
MongoDB persistence for the vault, plus the in-flight transaction counter used for graceful shutdown.

## Interface
- `binary.ts`: `toBuffer(value)` accepts `Buffer`, BSON `Binary`, or `Uint8Array`; throws `TypeError` otherwise.
- `mongo-identity.repository.ts`: `MongoIdentityRepository(db, session?)`: `insert` (upsert with `$setOnInsert`, so repeats are no-ops), `getById`, `revoke`, `rotate`.
- `mongo-token.repository.ts`: `MongoTokenRepository(db, session?)`: `insert`, `findById`.
- `mongo-step-up-challenge.repository.ts`: `MongoStepUpChallengeRepository(db, session?)`: `create`, `findById`, and CAS transitions `approve` (pending->approved), `consume` (approved->consumed), `expire` and `fail` (pending->expired/failed). Each returns null if the filter status did not match.
- `mongo-mfa-factor.repository.ts`: `MongoMfaFactorRepository(db)`: `insert` (always `active` + `PENDING_ENROLLMENT`, `verifyAttempts` 0), `markUsed`, `revoke`, `getById`, `listByActor`, `listActiveByActor` (only `ENROLLED`), `findActivePendingByActor`, `transitionToEnrolled` (CAS), `incrementVerifyAttempts`.
- `mongo-transactional-vault-writer.ts`: `MongoTransactionalVaultWriter(db, client).runWrite(work)`: runs `session.withTransaction`, exposing `insertIdentity`, `insertToken`, `writeLog` (insert into `logbook`).
- `vault-transaction-counter.ts`: `acquire`, `release`, `getActiveCount`, `waitForDrain(timeoutMs = 30000) -> Promise<boolean>`.

## Invariants
- Tokenize writes are atomic: identity + token + logbook row commit or roll back together.
- Transaction errors matching "Transaction numbers are only allowed on a replica set member or mongos", "not supported in standalone", or "IllegalOperation...transaction" are rethrown as `VaultError('VAULT_DB_REQUIRES_REPLICA_SET', ..., 503)`; Mongo must be a replica set or sharded cluster.
- `acquire`/`release` bracket `runWrite` (release in `finally`, endSession errors swallowed); an unmatched `release` only warns. The counter is process-local. Known gap: `acquire()` and `client.startSession()` run before the `try/finally`, so if `startSession()` throws, `release()` is never called, the counter leaks, and `waitForDrain` can wait its full timeout at shutdown.
- Identity `_id` is the subject hash; token `_id` is the opaque token; challenge/factor `_id` are their UUIDs.
- Challenge and factor repositories (except where a session is passed) do not use transactions; correctness relies on single-document CAS.
- `revoke`/`markUsed` on factors are not status-conditional.
- `expire`/`fail` ignore their timestamp arguments (`void expiredAt`, `void failedAt`); only `status` changes, so no `expiredAt`/`failedAt` is stored.
- The header comment of `mongo-step-up-challenge.repository.ts` says `pending` rows are never TTL-deleted. That is wrong: the TTL index is not status-aware (see [../../schema/README.md](../../schema/README.md)).

## Side Effects
- Reads/writes `vault_identities`, `vault_tokens`, `vault_step_up_challenges`, `vault_mfa_factors`, and inserts into `logbook`.
- Opens and ends Mongo client sessions.

## Verification
- Run: `tsx --test src/modules/vault/tests/transaction-counter.test.ts` and `binary-roundtrip.test.ts` via `npm test --workspace @fln/backend`
