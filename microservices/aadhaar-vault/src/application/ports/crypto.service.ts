/**
 * CryptoService port (Session 4, AADHAAR_VAULT_FREE_ARCHITECTURE.md §6 + §8.1).
 *
 * The tokenization envelope (per §8.1 step 4) is:
 *
 *     ciphertext, iv, authTag = AES-256-GCM(key, iv, plaintext, aad)
 *
 * We separate this from the `KeyManager` port:
 *
 *   - `KeyManager` mints + wraps per-record DEKs (see Session 3).
 *   - `CryptoService` performs the AES-GCM encryption / decryption
 *     step. Keeping these as two ports lets the command be unit-tested
 *     against either a real implementation or a fake.
 *
 * Adapters return *fresh* `Buffer`s; the caller is responsible for
 * zeroing its key material once the cipher operation has finished
 * (the `dek-zero` helper in `src/util/dek-zero.ts` handles that).
 */
export interface EncryptedEnvelope {
    /** AES-GCM ciphertext. Empty string plaintexts yield a zero-length buffer. */
    ciphertext: Buffer;
    /** 12-byte IV. Never reuse the same (key, iv) pair under AES-GCM. */
    iv: Buffer;
    /** 16-byte GCM auth tag. */
    authTag: Buffer;
}

export interface CryptoService {
    /**
     * Encrypt `plaintext` under `key` (32 bytes; AES-256) with the given
     * AAD. The function generates a fresh random IV — callers MUST NOT
     * reuse (key, iv) pairs. The AAD is bound into the GCM tag but is
     * NOT stored in the envelope.
     */
    encrypt(
        key: Buffer,
        plaintext: Buffer,
        aad: Buffer,
    ): Promise<EncryptedEnvelope>;

    /**
     * Decrypt an envelope under `key` with the given AAD. Throws if the
     * tag does not verify, the key length is wrong, or the IV / auth
     * tag lengths are wrong.
     */
    decrypt(
        key: Buffer,
        envelope: EncryptedEnvelope,
        aad: Buffer,
    ): Promise<Buffer>;

    /** Algorithm identifier, e.g. "aes-256-gcm". For persistence. */
    readonly algorithm: string;
}