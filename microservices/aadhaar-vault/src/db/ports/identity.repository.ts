/**
 * Identity repository port.
 *
 * The vault never stores the plaintext identity number; it only stores
 * the ciphertext + AAD. Repositories therefore work with opaque byte
 * buffers — callers (i.e. the crypto module in Session 3) own the
 * mapping between plaintext and ciphertext.
 *
 * See AADHAAR_VAULT_FREE_ARCHITECTURE.md §3.2.
 */
export interface IdentityRecord {
    identityId: string;
    ciphertext: Buffer;
    aad: Buffer;
    pepperVersion: number;
    keyVersion: number;
    createdAt: Date;
    rotatedAt: Date | null;
    revokedAt: Date | null;
}

export type NewIdentityRecord = Omit<
    IdentityRecord,
    'createdAt' | 'rotatedAt' | 'revokedAt'
>;

export interface IdentityRepository {
    insert(rec: NewIdentityRecord): Promise<IdentityRecord>;
    getById(identityId: string): Promise<IdentityRecord | null>;
    revoke(identityId: string): Promise<void>;
    rotate(identityId: string, keyVersion: number): Promise<void>;
}