/**
 * Vault index ensure-on-boot.
 *
 * Creates the collections + indexes the vault needs to operate. Safe
 * to call multiple times — `createIndex` is idempotent for identical
 * specs and `createCollection` will return the existing name silently
 * if the collection already exists.
 *
 * Phase 2: identities, tokens, audit_log.
 * Phase 3: step_up_challenges (incl. TTL on terminal rows).
 * Phase 4: mfa_factors.
 */
import type { Db } from 'mongodb';
import { VAULT_COLLECTIONS } from './collections';

export async function ensureVaultIndexes(db: Db): Promise<void> {
  // vault_identities — _id is the natural key (subjectHash UUID).
  await db.createCollection(VAULT_COLLECTIONS.identities).catch((err) => {
    if (err?.codeName !== 'NamespaceExists') throw err;
  });

  // vault_tokens — _id is the natural key (the opaque token id).
  // `identityId` is the FK used by Phase 3's detokenize path.
  await db.createCollection(VAULT_COLLECTIONS.tokens).catch((err) => {
    if (err?.codeName !== 'NamespaceExists') throw err;
  });
  await db.collection(VAULT_COLLECTIONS.tokens).createIndex({ identityId: 1 });

  // vault_audit_log — REMOVED. Per issue #406's review, the vault
  // audit chain is unified onto the FLN `logbook` collection (the
  // existing activity-log table). The vault module writes audit
  // rows via `dbStore.addLog` / `dbStore.addLogInSession` — there
  // is no separate `vault_audit_log` collection, and no
  // `auditId`-keyed index to maintain. Operators with an old
  // `vault_audit_log` collection in Mongo from a prior deployment
  // can drop it out of band; the schema ensure on boot no longer
  // touches it.

  // vault_step_up_challenges — Phase 3.
  // PK is `challenge_id` (the natural key); we store it on `_id`.
  // Secondary indexes (mirroring the Postgres migration 004):
  //   - status+expiresAt: prune lookup
  //   - requestedBy: list a principal's pending challenges
  //   - expiresAt TTL: Mongo's native equivalent of the Postgres
  //     `deleteExpired` cron. Only terminal rows (consumed/expired/
  //     failed) are eligible because Mongo's TTL sweeper deletes
  //     any document whose indexed date field is older than the
  //     configured offset — pending rows are protected by being
  //     transitioned to `expired` first via the repository. The
  //     grace window is 1h so audit consumers have time to read
  //     recently-terminal rows.
  await db.createCollection(VAULT_COLLECTIONS.stepUpChallenges).catch((err) => {
    if (err?.codeName !== 'NamespaceExists') throw err;
  });
  await db
    .collection(VAULT_COLLECTIONS.stepUpChallenges)
    .createIndex({ status: 1, expiresAt: 1 });
  await db
    .collection(VAULT_COLLECTIONS.stepUpChallenges)
    .createIndex(
      { requestedBy: 1 },
      { partialFilterExpression: { status: 'pending' } },
    );
  await db
    .collection(VAULT_COLLECTIONS.stepUpChallenges)
    .createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 3600 }, // 1h grace after expiresAt
    );

  // vault_mfa_factors — Phase 4.
  // PK is `factor_id` (the natural key); we store it on `_id`.
  // Secondary indexes (mirroring the Postgres migration 003):
  //   - actor+status: listActiveByActor (the detokenize hot path)
  //   - actor+createdAt: listByActor (admin UI / audit)
  //   - actor+lifecycleState: findActivePendingByActor (the
  //     resumable-enrollment lookup)
  await db.createCollection(VAULT_COLLECTIONS.mfaFactors).catch((err) => {
    if (err?.codeName !== 'NamespaceExists') throw err;
  });
  await db
    .collection(VAULT_COLLECTIONS.mfaFactors)
    .createIndex({ actor: 1, status: 1 });
  await db
    .collection(VAULT_COLLECTIONS.mfaFactors)
    .createIndex({ actor: 1, lifecycleState: 1 }); // supports findActivePendingByActor
  await db
    .collection(VAULT_COLLECTIONS.mfaFactors)
    .createIndex({ actor: 1, createdAt: -1 });
}
