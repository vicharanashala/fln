/**
 * Database integration test.
 *
 * Uses the hand-rolled `MemoryPool` (`src/db/memory-pool.ts`) so we
 * don't need a live Postgres for unit tests. The supported SQL
 * grammar is exactly the shapes the five adapters issue; the goal is
 * to verify the *adapters*, not to verify Postgres — production runs
 * against the real DB.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createMemoryDatabase, type Database } from '../src/db/index.js';

let db: Database;

beforeEach(async () => {
  db = await createMemoryDatabase();
});

afterEach(async () => {
  await db.close();
});

describe('identities repository', () => {
  it('inserts, fetches, and rotates an identity', async () => {
    const ciphertext = Buffer.from('ciphertext-bytes');
    const aad = Buffer.from('aad-bytes');

    const inserted = await db.identities.insert({
      identityId: 'aadhaar-1',
      ciphertext,
      aad,
      pepperVersion: 1,
      keyVersion: 1,
    });

    expect(inserted.identityId).toBe('aadhaar-1');
    expect(inserted.ciphertext.equals(Buffer.from('ciphertext-bytes'))).toBe(
      true,
    );
    expect(inserted.aad.equals(Buffer.from('aad-bytes'))).toBe(true);
    expect(inserted.createdAt).toBeInstanceOf(Date);
    expect(inserted.rotatedAt).toBeNull();
    expect(inserted.revokedAt).toBeNull();

    const fetched = await db.identities.getById('aadhaar-1');
    expect(fetched).not.toBeNull();
    expect(fetched?.identityId).toBe('aadhaar-1');
    expect(fetched?.keyVersion).toBe(1);

    await db.identities.rotate('aadhaar-1', 2);

    const rotated = await db.identities.getById('aadhaar-1');
    expect(rotated?.keyVersion).toBe(2);
    expect(rotated?.rotatedAt).toBeInstanceOf(Date);
  });

  it('revokes an identity (idempotent)', async () => {
    await db.identities.insert({
      identityId: 'aadhaar-2',
      ciphertext: Buffer.from('c'),
      aad: Buffer.from('a'),
      pepperVersion: 1,
      keyVersion: 1,
    });

    await db.identities.revoke('aadhaar-2');
    await db.identities.revoke('aadhaar-2'); // second call is a no-op

    const fetched = await db.identities.getById('aadhaar-2');
    expect(fetched?.revokedAt).toBeInstanceOf(Date);
  });

  it('returns null for an unknown identity', async () => {
    const fetched = await db.identities.getById('does-not-exist');
    expect(fetched).toBeNull();
  });
});

describe('audit repository', () => {
  it('appends entries and lists them by identity, newest first', async () => {
    await db.identities.insert({
      identityId: 'aadhaar-audit',
      ciphertext: Buffer.from('c'),
      aad: Buffer.from('a'),
      pepperVersion: 1,
      keyVersion: 1,
    });

    await db.audit.append({
      identityId: 'aadhaar-audit',
      actor: 'fln-backend',
      action: 'tokenize',
      outcome: 'allow',
      requestId: 'r-1',
      meta: { source: 'kyc' },
    });

    await db.audit.append({
      identityId: 'aadhaar-audit',
      actor: 'fln-backend',
      action: 'detokenize',
      outcome: 'deny',
      reason: 'no_mfa',
      requestId: 'r-2',
    });

    const rows = await db.audit.listByIdentity('aadhaar-audit');
    expect(rows).toHaveLength(2);
    // newest first
    expect(rows[0]?.action).toBe('detokenize');
    expect(rows[0]?.outcome).toBe('deny');
    expect(rows[0]?.reason).toBe('no_mfa');
    expect(rows[1]?.action).toBe('tokenize');
    expect(rows[1]?.outcome).toBe('allow');
  });

  it('respects the limit option', async () => {
    await db.identities.insert({
      identityId: 'aadhaar-limit',
      ciphertext: Buffer.from('c'),
      aad: Buffer.from('a'),
      pepperVersion: 1,
      keyVersion: 1,
    });

    for (let i = 0; i < 5; i += 1) {
      await db.audit.append({
        identityId: 'aadhaar-limit',
        actor: 'fln-backend',
        action: `act-${i}`,
        outcome: 'allow',
      });
    }

    const rows = await db.audit.listByIdentity('aadhaar-limit', { limit: 2 });
    expect(rows).toHaveLength(2);
  });
});

describe('mfa factor repository', () => {
  it('inserts a factor, fetches it, and transitions through used / revoked', async () => {
    const inserted = await db.mfa.insert({
      factorId: 'factor-1',
      actor: 'fln-backend',
      factorType: 'totp',
      label: 'Primary phone',
      encryptedSecret: Buffer.from([1, 2, 3, 4]),
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });

    expect(inserted.factorId).toBe('factor-1');
    expect(inserted.status).toBe('active');
    expect(inserted.label).toBe('Primary phone');
    expect(inserted.encryptedSecret.equals(Buffer.from([1, 2, 3, 4]))).toBe(
      true,
    );
    expect(inserted.algorithm).toBe('SHA1');
    expect(inserted.digits).toBe(6);
    expect(inserted.period).toBe(30);
    expect(inserted.lastUsedAt).toBeNull();
    expect(inserted.expiresAt).toBeNull();
    expect(inserted.createdAt).toBeInstanceOf(Date);

    const used = await db.mfa.markUsed('factor-1', new Date());
    expect(used?.status).toBe('active');
    expect(used?.lastUsedAt).toBeInstanceOf(Date);

    const fetched = await db.mfa.getById('factor-1');
    expect(fetched?.actor).toBe('fln-backend');
    expect(fetched?.factorType).toBe('totp');
  });

  it('revokes a factor and removes it from listActiveByActor', async () => {
    await db.mfa.insert({
      factorId: 'factor-2',
      actor: 'fln-backend',
      factorType: 'totp',
      label: 'Backup phone',
      encryptedSecret: Buffer.from([9, 9, 9]),
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });

    const revoked = await db.mfa.revoke('factor-2');
    expect(revoked?.status).toBe('revoked');

    const active = await db.mfa.listActiveByActor('fln-backend');
    expect(active).toHaveLength(0);

    // Idempotent: revoking again still returns the row.
    const again = await db.mfa.revoke('factor-2');
    expect(again?.status).toBe('revoked');
  });

  it('listByActor returns all factors newest-first', async () => {
    await db.mfa.insert({
      factorId: 'factor-a',
      actor: 'user-1',
      factorType: 'totp',
      label: 'A',
      encryptedSecret: Buffer.from([1]),
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });
    await db.mfa.insert({
      factorId: 'factor-b',
      actor: 'user-1',
      factorType: 'totp',
      label: 'B',
      encryptedSecret: Buffer.from([2]),
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });

    const all = await db.mfa.listByActor('user-1');
    expect(all.map((f) => f.factorId)).toEqual(['factor-b', 'factor-a']);
  });

  it('returns null for an unknown factor id', async () => {
    expect(await db.mfa.getById('does-not-exist')).toBeNull();
    expect(await db.mfa.markUsed('does-not-exist', new Date())).toBeNull();
    expect(await db.mfa.revoke('does-not-exist')).toBeNull();
  });
});

describe('key metadata repository', () => {
  it('inserts a key, finds the active one, retires and destroys it', async () => {
    const k = await db.keyMetadata.insert({
      keyId: 'key-1',
      algorithm: 'AES-256-GCM',
      pepperVersion: 1,
    });

    expect(k.status).toBe('active');
    expect(k.retiredAt).toBeNull();
    expect(k.destroyedAt).toBeNull();

    const active = await db.keyMetadata.getActive(1);
    expect(active?.keyId).toBe('key-1');

    await db.keyMetadata.markRetired('key-1');

    const afterRetire = await db.keyMetadata.getActive(1);
    expect(afterRetire).toBeNull(); // no longer active

    await db.keyMetadata.markDestroyed('key-1');

    // markDestroyed on an already-destroyed row is a no-op.
    await db.keyMetadata.markDestroyed('key-1');
  });

  it('keeps active and retired as separate rows for the same pepper', async () => {
    await db.keyMetadata.insert({
      keyId: 'key-a',
      algorithm: 'AES-256-GCM',
      pepperVersion: 2,
    });

    await db.keyMetadata.insert({
      keyId: 'key-b',
      algorithm: 'AES-256-GCM',
      pepperVersion: 2,
    });

    await db.keyMetadata.markRetired('key-a');

    const active = await db.keyMetadata.getActive(2);
    expect(active?.keyId).toBe('key-b');
  });
});