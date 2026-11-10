# schema

## Overview
MongoDB collection names and boot-time index creation for the vault.

## Interface
- `collections.ts`: `VAULT_COLLECTIONS` = `identities: 'vault_identities'`, `tokens: 'vault_tokens'`, `stepUpChallenges: 'vault_step_up_challenges'`, `mfaFactors: 'vault_mfa_factors'`; type `VaultCollectionName`.
- `indexes.ts`: `ensureVaultIndexes(db)`; creates each collection (ignores `NamespaceExists`) and indexes: tokens `{identityId:1}`; challenges `{status:1,expiresAt:1}`, `{requestedBy:1}` partial on `status:'pending'`, TTL `{expiresAt:1}` with `expireAfterSeconds: 3600`; factors `{actor:1,status:1}`, `{actor:1,lifecycleState:1}`, `{actor:1,createdAt:-1}`.

## Invariants
- Idempotent; safe on every boot.
- There is no vault audit collection: audit rows live in the FLN `logbook` collection. An old `vault_audit_log` is not touched.
- The challenge TTL index applies to every challenge document (including `pending`/`approved` ones) 1h after `expiresAt`; Mongo's TTL sweep is not status-aware. The header comments in `indexes.ts` and `mongo-step-up-challenge.repository.ts` say only terminal rows are eligible; they are wrong.
- Known gaps: this module creates no index on `logbook`, yet `listLogsByDetailsPrefix` (`db.ts`) runs an anchored `$regex` on `details` plus a `timestamp` sort for every audit read, which scans the collection unless another index exists.

## Side Effects
- Creates collections and indexes in MongoDB.

## Verification
- Run: `npm test --workspace @fln/backend`
