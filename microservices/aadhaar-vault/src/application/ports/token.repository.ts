/**
 * TokenRepository port (Session 4, AADHAAR_VAULT_FREE_ARCHITECTURE.md §8.1 step 5 + §9).
 *
 * A "token" is the row persisted for every successful tokenization.
 * The row holds the AES-GCM envelope of the 12-digit Aadhaar
 * plaintext, the wrapped DEK reference, the binding to the
 * `Identity` (which carries the stable subject id), and the
 * audit-trail timestamps.
 *
 * Two-way pointer vs §9: the token row points *back* to the identity
 * (`identity_id`) and the identity row has an FK to `latest_token_id`.
 * Postgres guarantees referential integrity on both.
 *
 * Why an opaque id: the token id is server-issued (UUIDv7, sortable
 * by creation time) so callers can never guess at another tenant's
 * id space. The id is returned to the client exactly once — at
 * insert — and used as the lookup key for `findById`.
 */

export interface TokenRow {
    /** Server-issued opaque id (UUIDv7). */
    id: string;
    /** Stable subject id from `IdentityRepository.insert`. */
    identityId: string;
    /** Algorithm used to encrypt — currently "aes-256-gcm". */
    algorithm: string;
    /** AES-GCM ciphertext. */
    ciphertext: Buffer;
    /** 12-byte IV. */
    iv: Buffer;
    /** 16-byte GCM auth tag. */
    authTag: Buffer;
    /** Opaque key reference (see `KeyManager`). Adapter does NOT parse. */
    wrappedDek: Buffer;
    /** Server epoch millis. */
    createdAt: number;
}

export interface NewToken {
    identityId: string;
    algorithm: string;
    ciphertext: Buffer;
    iv: Buffer;
    authTag: Buffer;
    wrappedDek: Buffer;
}

export interface TokenRepository {
    /** Insert a token row. Returns the new id + server-assigned timestamps. */
    insert(token: NewToken): Promise<TokenRow>;
    /** Look up by id. Returns null if the id is unknown. */
    findById(id: string): Promise<TokenRow | null>;
}