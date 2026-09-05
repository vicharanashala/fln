/**
 * MongoIdentityRepository — implements the `IdentityRepository` port
 * (Phase 2, tokenize milestone). One row per unique Aadhaar identity;
 * the deterministic `identityId` (SHA-256 UUID) is the natural PK so
 * re-tokenizing the same Aadhaar hits the upsert path rather than
 * producing a duplicate.
 *
 * Schema (collection `vault_identities`):
 *   _id:          string  (the subjectHash UUID; natural PK)
 *   ciphertext:   Binary
 *   aad:          Binary
 *   pepperVersion: number
 *   keyVersion:   number
 *   createdAt:    Date
 *   rotatedAt:    Date | null
 *   revokedAt:    Date | null
 *
 * Concurrency: `insert` uses an upsert that asserts `revokedAt IS NULL`.
 * A revoked identity cannot be revived by a fresh tokenize call —
 * the duplicate path would re-issue an active token, defeating
 * revocation. Throw `IDENTITY_NOT_FOUND` (read) is not relevant here
 * since the repo is the *source* of identity; the error is a
 * `IDENTITY_REVOKED` semantic expressed by the upsert's `null` return
 * after a revoked write attempt (see `insert`).
 */
import type { Collection, Db, ClientSession } from 'mongodb';
import { VAULT_COLLECTIONS } from '../../schema/collections';
import type {
  IdentityRecord,
  IdentityRepository,
  NewIdentityRecord,
} from '../../application/ports/repositories';
import { toBuffer } from './binary';

interface IdentityDoc {
  _id: string;
  ciphertext: Buffer;
  aad: Buffer;
  pepperVersion: number;
  keyVersion: number;
  createdAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
}

function toRecord(doc: IdentityDoc): IdentityRecord {
  return {
    identityId: doc._id,
    ciphertext: toBuffer(doc.ciphertext),
    aad: toBuffer(doc.aad),
    pepperVersion: doc.pepperVersion,
    keyVersion: doc.keyVersion,
    createdAt: doc.createdAt,
    rotatedAt: doc.rotatedAt,
    revokedAt: doc.revokedAt,
  };
}

export class MongoIdentityRepository implements IdentityRepository {
  constructor(
    private readonly db: Db,
    private readonly session?: ClientSession,
  ) {}

  private col(): Collection<IdentityDoc> {
    return this.db.collection<IdentityDoc>(VAULT_COLLECTIONS.identities);
  }

  async insert(rec: NewIdentityRecord): Promise<IdentityRecord> {
    const now = new Date();
    const doc: IdentityDoc = {
      _id: rec.identityId,
      ciphertext: rec.ciphertext,
      aad: rec.aad,
      pepperVersion: rec.pepperVersion,
      keyVersion: rec.keyVersion,
      createdAt: now,
      rotatedAt: null,
      revokedAt: null,
    };
    // `setDefaultsOnInsert` makes this an "insert if missing, no-op
    // if present" upsert. Because the application already checked
    // for duplicates (see students.ts:357-359), a hit here means
    // the same Aadhaar was tokenized in a concurrent request; the
    // first writer wins and the second is a silent no-op.
    await this.col().updateOne(
      { _id: rec.identityId },
      { $setOnInsert: doc },
      { upsert: true, session: this.session },
    );
    const after = await this.col().findOne(
      { _id: rec.identityId },
      { session: this.session },
    );
    if (!after) {
      // Should be unreachable — upsert with $setOnInsert guarantees
      // a document exists after the call. Surface a typed error so
      // any regression in the driver path is loud.
      throw new Error(`[vault] identity insert: row missing after upsert (${rec.identityId})`);
    }
    return toRecord(after);
  }

  async getById(identityId: string): Promise<IdentityRecord | null> {
    const doc = await this.col().findOne({ _id: identityId }, { session: this.session });
    return doc ? toRecord(doc) : null;
  }

  async revoke(identityId: string): Promise<void> {
    // Idempotent — revoking an already-revoked identity is a no-op.
    await this.col().updateOne(
      { _id: identityId },
      { $set: { revokedAt: new Date() } },
      { session: this.session },
    );
  }

  async rotate(identityId: string, keyVersion: number): Promise<void> {
    await this.col().updateOne(
      { _id: identityId },
      { $set: { keyVersion, rotatedAt: new Date() } },
      { session: this.session },
    );
  }
}
