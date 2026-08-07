/**
 * KeyManager port.
 *
 * Session 3 introduces the minimal cryptographic boundary the rest of
 * the application needs to wrap and unwrap Data Encryption Keys (DEKs).
 * The port is intentionally narrow so adapters can be swapped without
 * leaking provider semantics into the call sites.
 *
 * Scope (what this port IS):
 *   - generate a fresh DEK and return both its plaintext form (for the
 *     caller to use immediately and zero) and its wrapped form (to
 *     persist alongside the ciphertext);
 *   - reverse that wrap given the same context bytes;
 *   - seal arbitrary-length secret bytes (e.g. RFC 6238 TOTP shared
 *     secrets) under the same envelope so the same KMS backing key
 *     covers both DEK wrap and secret-at-rest protection;
 *   - report non-sensitive provider + version metadata so callers and
 *     readiness probes can detect boot misconfiguration.
 *
 * Non-scope (what this port is NOT):
 *   - Audit-chain HMAC. `signAuditCheckpoint` belongs to a future
 *     AuditChainService so the audit chain can pick its key material
 *     independently of DEK wrap.
 *   - Key-rotation orchestration. `rotateKey` and metadata writes are
 *     deferred to a future KeyManagementService. The LocalDevKeyManager
 *     keeps a version *internally* but does not expose it.
 *
 * Domain purity (per the Session 3 brief):
 *   The port knows nothing about Aadhaar, identity tokens, or any
 *   business concept. Inputs and outputs are plaintext DEKs, wrapped
 *   DEKs, opaque context bytes, and key versions.
 */

/**
 * Opaque context bytes that bind a wrapped output to its use site (e.g.
 * an identity_id, a per-factor salt). Different `context` inputs to the
 * same master key MUST produce different wrapped blobs even when the
 * plaintext payload is identical.
 */
export type WrapContext = Buffer;

/** Plaintext Data Encryption Key, 32 bytes. Adapters MUST zero this
 *  in the caller's `finally` block via {@link safeZero}. */
export type PlainDek = Buffer;

/** Wrapped (encrypted) DEK plus any per-adapter metadata needed to
 *  round-trip the unwrap (e.g. IV, auth tag, key version tag). The
 *  shape is intentionally opaque to the application — the LocalDev
 *  adapter stores `(iv || tag || ciphertext)`, a future KMS adapter
 *  may store `(keyId || ciphertextBlob)`. */
export interface WrappedDek {
    /** Concatenated, opaque-to-port bytes. Adapter-defined layout. */
    bytes: Buffer;
}

/**
 * Generic wrapped-secret blob. Used for non-DEK payloads such as RFC 6238
 * TOTP shared secrets. Same wire shape as {@link WrappedDek} (the AES-GCM
 * envelope is the same); kept as a separate type so call sites read
 * semantically and a future adapter can split storage paths.
 */
export interface WrappedSecret {
    bytes: Buffer;
}

export interface GeneratedDek {
    /** Plaintext DEK. Caller is responsible for zeroing. */
    plaintext: PlainDek;
    /** Wrapped form, safe to persist alongside ciphertext. */
    wrapped: WrappedDek;
    /** Identifies which key version wrapped this DEK. Persist verbatim. */
    keyVersion: string;
}

export interface KeyManagerInfo {
    /** Provider identifier, e.g. 'local-dev'. Stable string. */
    provider: string;
    /** Current key version, e.g. 'kv-1'. Stable across DEKs issued during
     *  this process lifetime until a future rotation lands. */
    currentVersion: string;
    /** Cipher algorithm identifier, e.g. 'aes-256-gcm'. */
    algorithm: string;
}

export interface KeyManager {
    /** Generate a fresh DEK plus its wrapped form bound to `context`. */
    generateDataKey(context: WrapContext): Promise<GeneratedDek>;

    /**
     * Symmetric re-wrap: take an existing plaintext DEK and produce a
     * new `WrappedDek` bound to `context`. Useful for re-binding a DEK
     * to a fresh context (e.g. after rotation) without first unwrapping
     * it on disk. Adapters MUST NOT mutate or zero the input buffer;
     * the caller still owns its lifecycle.
     */
    wrapDataKey(dek: PlainDek, context: WrapContext): Promise<WrappedDek>;

    /** Reverse a wrap. Throws on context mismatch or tampered bytes. */
    unwrapDataKey(wrapped: WrappedDek, context: WrapContext): Promise<PlainDek>;

    /**
     * Seal arbitrary-length secret bytes under the same envelope as a
     * DEK wrap. Used by Phase 2 (TOTP shared secrets) and any future
     * adapter that needs to protect an opaque secret at rest without
     * paying the cost of a full DEK lifecycle. Adapters MUST NOT
     * mutate or zero the input buffer; the caller is responsible for
     * zeroing it via {@link safeZero}.
     *
     * @param plaintext The secret to seal. Caller-owned; do not retain.
     * @param context   Domain-separated binding (e.g. factor_id bytes).
     */
    sealSecret(
        plaintext: Buffer,
        context: WrapContext,
    ): Promise<WrappedSecret>;

    /**
     * Reverse {@link sealSecret}. Throws on context mismatch or
     * tampered bytes. The returned Buffer is a fresh allocation that
     * the caller MUST zero with {@link safeZero}.
     */
    openSecret(
        wrapped: WrappedSecret,
        context: WrapContext,
    ): Promise<Buffer>;

    /** Report non-sensitive provider + version metadata. Synchronous. */
    info(): KeyManagerInfo;
}