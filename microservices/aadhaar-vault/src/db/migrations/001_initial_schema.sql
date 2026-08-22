-- 001_initial_schema.sql
-- Aadhaar Vault — initial schema
-- See AADHAAR_VAULT_FREE_ARCHITECTURE.md §3.2 (Data Model).
--
-- Conventions
--  * All tables are prefixed `vault_` so they do not collide with other
--    schemas in the same database (e.g. the future fln-backend schema).
--  * UUIDs are stored as native `uuid` columns. Timestamps are
--    `timestamptz` and are supplied by the application (NOT defaulted
--    by `now()`) — see "Why no `DEFAULT now()`" below.
--  * No foreign keys are declared at the DB level. Vault tables reference
--    each other only by id; lifecycle decoupling is intentional so that
--    key rotation, identity revocation, and audit retention can proceed
--    independently. Referential integrity is enforced in the application
--    layer (see `src/db/repositories/*`).
--  * Every table except the migration ledger is created with
--    `IF NOT EXISTS` so that this file is safe to re-apply against an
--    already-migrated database.
--
-- Why no `DEFAULT now()`?
--   The test suite runs against `pg-mem`, which (as of writing) does
--   not parse function-call DEFAULT clauses such as `DEFAULT now()`.
--   Setting the timestamps explicitly from the application is portable
--   across `pg`, `pg-mem`, and any future adapter and keeps the SQL
--   schema trivially rewritable for other dialects.

-- ---------------------------------------------------------------------------
-- 1. Schema migrations ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vault_schema_migrations (
    version     TEXT        PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL
);

-- ---------------------------------------------------------------------------
-- 2. Encrypted identity records
--    The plaintext identity number never lives in this table; only the
--    ciphertext and the AAD that bind the ciphertext to its context.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vault_identities (
    identity_id          UUID        PRIMARY KEY,
    ciphertext           BYTEA       NOT NULL,
    aad                  BYTEA       NOT NULL,
    pepper_version       INTEGER     NOT NULL,
    key_version          INTEGER     NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL,
    rotated_at           TIMESTAMPTZ,
    revoked_at           TIMESTAMPTZ
);

-- Index that lets the hot path (active identity lookup) skip revoked rows.
CREATE INDEX IF NOT EXISTS vault_identities_active_idx
    ON vault_identities (identity_id)
    WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Audit log (append-only)
--    Every tokenize / detokenize / rotate / revoke / auth attempt is
--    recorded here. Rows must never be UPDATEd or DELETEd in normal
--    operation; retention is enforced out-of-band.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vault_audit_log (
    audit_id     BIGSERIAL  PRIMARY KEY,
    identity_id  UUID,
    actor        TEXT       NOT NULL,
    action       TEXT       NOT NULL,
    outcome      TEXT       NOT NULL,
    reason       TEXT,
    request_id   TEXT,
    occurred_at  TIMESTAMPTZ NOT NULL,
    meta         JSONB      NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS vault_audit_log_identity_idx
    ON vault_audit_log (identity_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS vault_audit_log_actor_idx
    ON vault_audit_log (actor, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- 4. MFA challenges
--    Step-up authentication artifacts (TOTP, WebAuthn, etc.). Their
--    lifetime is short; the table is read-mostly with periodic pruning.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vault_mfa_challenges (
    challenge_id   UUID        PRIMARY KEY,
    actor          TEXT        NOT NULL,
    challenge_type TEXT        NOT NULL,
    status         TEXT        NOT NULL DEFAULT 'pending',
    expires_at     TIMESTAMPTZ NOT NULL,
    consumed_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS vault_mfa_challenges_pending_idx
    ON vault_mfa_challenges (status, expires_at)
    WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- 5. Key metadata
--    Tracks which key version is active, retired, or destroyed so that
--    detokenize can refuse to unwrap with a retired key without needing
--    a network round-trip to the KMS.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vault_key_metadata (
    key_id        UUID        PRIMARY KEY,
    algorithm     TEXT        NOT NULL,
    pepper_version INTEGER    NOT NULL,
    status        TEXT        NOT NULL DEFAULT 'active',
    created_at    TIMESTAMPTZ NOT NULL,
    retired_at    TIMESTAMPTZ,
    destroyed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS vault_key_metadata_status_idx
    ON vault_key_metadata (status, created_at DESC);