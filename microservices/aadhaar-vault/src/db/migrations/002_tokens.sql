-- 002_tokens.sql
-- Aadhaar Vault — tokenization envelope table (Session 4)
-- See AADHAAR_VAULT_FREE_ARCHITECTURE.md §9.
--
-- Conventions (same as 001_initial_schema.sql)
--  * `vault_` prefix.
--  * No `DEFAULT now()` — timestamps are supplied by the application so
--    the SQL stays portable across `pg`, `pg-mem`, and MemoryPool.
--  * No foreign keys. Refer to `identity_id` and `wrapped_dek` by id
--    only; lifecycle is decoupled by design.
--  * `IF NOT EXISTS` so re-applying against an already-migrated
--    database is a no-op.
--  * `pgcrypto` is intentionally NOT enabled: tokens.id is a UUIDv7
--    minted by the application (see `application/commands/tokenize-aadhaar.ts`),
--    so the database never generates ids and we do not import the
--    extension unnecessarily.

-- ---------------------------------------------------------------------------
-- 1. Tokenization envelope
--    One row per successful tokenization. Holds:
--      * the AES-GCM envelope of the 12-digit Aadhaar plaintext,
--      * an opaque reference to the per-record DEK (managed by
--        `KeyManager`; the adapter does not parse its bytes),
--      * the parent identity_id (logical link — no FK).
--    The cipher's GCM auth tag is bound to the AAD on the row above;
--    that AAD is the identity-level AAD (`tenant|identity_version|...`).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vault_tokens (
    id           UUID        PRIMARY KEY,
    identity_id  UUID        NOT NULL,
    algorithm    TEXT        NOT NULL,
    ciphertext   BYTEA       NOT NULL,
    iv           BYTEA       NOT NULL,
    auth_tag     BYTEA       NOT NULL,
    wrapped_dek  BYTEA       NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL
);

-- Hot-path lookup by parent identity. Used by `Detokenize` (Session 5).
CREATE INDEX IF NOT EXISTS vault_tokens_identity_idx
    ON vault_tokens (identity_id, created_at DESC);