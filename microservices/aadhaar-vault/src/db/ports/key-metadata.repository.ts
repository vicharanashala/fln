/**
 * Key metadata repository port.
 *
 * The vault never derives the DEK (data encryption key) locally; it
 * only records *which* key version is currently trusted for a given
 * pepper. The actual key material lives in the KMS.
 *
 * Status transitions:
 *   active  → retired   (no new tokenize, detokenize still works)
 *   retired → destroyed (no operations at all; metadata kept for audit)
 */
export type KeyStatus = 'active' | 'retired' | 'destroyed';

export interface KeyMetadataRecord {
    keyId: string;
    algorithm: string;
    pepperVersion: number;
    status: KeyStatus;
    createdAt: Date;
    retiredAt: Date | null;
    destroyedAt: Date | null;
}

export type NewKeyMetadataRecord = Omit<
    KeyMetadataRecord,
    'createdAt' | 'retiredAt' | 'destroyedAt' | 'status'
>;

export interface KeyMetadataRepository {
    insert(rec: NewKeyMetadataRecord): Promise<KeyMetadataRecord>;
    getActive(pepperVersion: number): Promise<KeyMetadataRecord | null>;
    markRetired(keyId: string): Promise<void>;
    markDestroyed(keyId: string): Promise<void>;
}