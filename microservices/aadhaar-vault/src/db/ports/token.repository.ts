/**
 * Persistence-layer port for tokenization envelopes.
 *
 * The vault stores one row per successful tokenization. This port
 * owns *only* the row shape and the insert/lookup contract; envelope
 * construction (encryption, DEK wrapping, GCM AAD binding) lives in
 * the application layer (`application/commands/tokenize-aadhaar.ts`).
 *
 * Why is this in `db/ports/`?
 *   The other repository ports (`identity.repository.ts`,
 *   `mfa.repository.ts`, etc.) all live here, so the dependency
 *   direction stays uniform: `application` depends on `db`, never
 *   the reverse. The TokenizeAadhaar command depends on this port;
 *   the Postgres adapter implements it.
 */
export interface NewToken {
    /** Opaque token id. Application layer mints a UUIDv7. */
    id: string;
    identityId: string;
    algorithm: string;
    ciphertext: Buffer;
    iv: Buffer;
    authTag: Buffer;
    wrappedDek: Buffer;
}

export interface TokenRow {
    id: string;
    identityId: string;
    algorithm: string;
    ciphertext: Buffer;
    iv: Buffer;
    authTag: Buffer;
    wrappedDek: Buffer;
    /** Unix millis; matches the date semantics of `vault_identities.created_at`. */
    createdAt: number;
}

export interface TokenRepository {
    insert(token: NewToken): Promise<TokenRow>;
    findById(id: string): Promise<TokenRow | null>;
}