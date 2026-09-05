/**
 * MongoTokenRepository — implements the `TokenRepository` port
 * (Phase 2, tokenize milestone). One row per tokenization. Multiple
 * rows MAY share an `identityId` in v0.2+ (re-tokenization); v0.1
 * never re-uses an identity_id for two distinct tokens.
 *
 * Schema (collection `vault_tokens`):
 *   _id:         string  (the opaque token id, UUID v4)
 *   identityId:  string  (FK -> vault_identities._id)
 *   algorithm:   string  ('aes-256-gcm')
 *   ciphertext:  Binary
 *   iv:          Binary   (12 bytes)
 *   authTag:     Binary   (16 bytes)
 *   wrappedDek:  Binary   (LocalDev layout: iv || tag || ct)
 *   createdAt:   Date
 */
import type { Collection, Db, ClientSession } from 'mongodb';
import { VAULT_COLLECTIONS } from '../../schema/collections';
import type {
  NewToken,
  TokenRepository,
  TokenRow,
} from '../../application/ports/repositories';
import { toBuffer } from './binary';

interface TokenDoc {
  _id: string;
  identityId: string;
  algorithm: string;
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  wrappedDek: Buffer;
  createdAt: Date;
}

function toRow(doc: TokenDoc): TokenRow {
  return {
    id: doc._id,
    identityId: doc.identityId,
    algorithm: doc.algorithm,
    ciphertext: toBuffer(doc.ciphertext),
    iv: toBuffer(doc.iv),
    authTag: toBuffer(doc.authTag),
    wrappedDek: toBuffer(doc.wrappedDek),
    createdAt: doc.createdAt.getTime(),
  };
}

export class MongoTokenRepository implements TokenRepository {
  constructor(
    private readonly db: Db,
    private readonly session?: ClientSession,
  ) {}

  private col(): Collection<TokenDoc> {
    return this.db.collection<TokenDoc>(VAULT_COLLECTIONS.tokens);
  }

  async insert(token: NewToken): Promise<TokenRow> {
    const doc: TokenDoc = {
      _id: token.id,
      identityId: token.identityId,
      algorithm: token.algorithm,
      ciphertext: token.ciphertext,
      iv: token.iv,
      authTag: token.authTag,
      wrappedDek: token.wrappedDek,
      createdAt: new Date(),
    };
    await this.col().insertOne(doc, { session: this.session });
    return toRow(doc);
  }

  async findById(id: string): Promise<TokenRow | null> {
    const doc = await this.col().findOne({ _id: id }, { session: this.session });
    return doc ? toRow(doc) : null;
  }
}
