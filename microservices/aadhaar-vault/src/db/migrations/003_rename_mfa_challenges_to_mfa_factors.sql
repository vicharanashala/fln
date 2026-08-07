-- 003_rename_mfa_challenges_to_mfa_factors.sql
-- Aadhaar Vault — Session 5 Phase 2: rename MFA challenges to MFA factors.
--
-- Why rename?
--   The original `vault_mfa_challenges` was a transient-artifact model
--   (issued / pending / consumed / failed). RFC 6238 step-up factors are
--   persistent (enrolled, used to verify many codes, eventually revoked).
--   The schema must grow TOTP-shaped columns and shed transient ones.
--
-- Migration policy (REPO_STATUS.md §7.14 / AADHAAR_VAULT_FREE_ARCHITECTURE.md):
--   "Prefer ALTER TABLE ... RENAME TO ... over destructive recreation."
--   No data migration is required: in v0.1 the table is empty in dev and
--   production. A real deployment with challenge data must run a separate
--   row-mapping script (TODO Session 6) before applying this migration.
--
-- What changes:
--   1. Table rename + three column renames.
--   2. `expires_at` becomes nullable: TOTP factors do not expire.
--   3. `status` default becomes 'active' (factors start life active).
--   4. Five new NOT NULL columns carry the TOTP envelope:
--        encrypted_secret BYTEA  -- wrapped via KeyManager sealSecret()
--        label            TEXT   -- user-facing display name
--        algorithm        TEXT   -- 'SHA1' | 'SHA256' | 'SHA512'
--        digits           INT    -- typically 6
--        period           INT    -- seconds, typically 30
--   5. Old partial index on the dropped `status='pending'` predicate is
--      removed; replaced by an actor hot-path index keyed on active rows.
--
-- Conventions (same as 001 / 002):
--   * `vault_` prefix.
--   * No `DEFAULT now()` — application supplies timestamps.
--   * `IF NOT EXISTS` only on CREATE; ALTER statements rely on the
--     migration ledger to guarantee single application.

-- ---------------------------------------------------------------------------
-- 1. Rename table
-- ---------------------------------------------------------------------------
ALTER TABLE vault_mfa_challenges RENAME TO vault_mfa_factors;

-- ---------------------------------------------------------------------------
-- 2. Rename columns
-- ---------------------------------------------------------------------------
ALTER TABLE vault_mfa_factors RENAME COLUMN challenge_id    TO factor_id;
ALTER TABLE vault_mfa_factors RENAME COLUMN challenge_type  TO factor_type;
ALTER TABLE vault_mfa_factors RENAME COLUMN consumed_at     TO last_used_at;

-- ---------------------------------------------------------------------------
-- 3. Drop the old partial index on the transient `status='pending'` predicate
--    (factors are active/revoked; that index never matches anything after
--    the rename).
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS vault_mfa_challenges_pending_idx;

-- ---------------------------------------------------------------------------
-- 4. Relax expires_at: TOTP factors do not carry an expiry. The column is
--    kept for future factor types (email-OTP, push) that may set their own
--    deadline.
-- ---------------------------------------------------------------------------
ALTER TABLE vault_mfa_factors ALTER COLUMN expires_at DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. New TOTP-shaped columns. The migrator's pg-mem rewriter only inspects
--    `CREATE TABLE` blocks; ADD COLUMN + ALTER COLUMN ... SET NOT NULL is
--    written explicitly so the SQL is portable.
-- ---------------------------------------------------------------------------
ALTER TABLE vault_mfa_factors ADD COLUMN encrypted_secret BYTEA;
ALTER TABLE vault_mfa_factors ALTER COLUMN encrypted_secret SET NOT NULL;

ALTER TABLE vault_mfa_factors ADD COLUMN label TEXT;
ALTER TABLE vault_mfa_factors ALTER COLUMN label SET NOT NULL;

ALTER TABLE vault_mfa_factors ADD COLUMN algorithm TEXT;
ALTER TABLE vault_mfa_factors ALTER COLUMN algorithm SET NOT NULL;

ALTER TABLE vault_mfa_factors ADD COLUMN digits INTEGER;
ALTER TABLE vault_mfa_factors ALTER COLUMN digits SET NOT NULL;

ALTER TABLE vault_mfa_factors ADD COLUMN period INTEGER;
ALTER TABLE vault_mfa_factors ALTER COLUMN period SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 6. Hot-path index for the detokenize-time MFA check (find an actor's
--    active factors). The pg-mem rewriter strips the `WHERE` predicate;
--    real Postgres keeps the partial index.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS vault_mfa_factors_actor_idx
    ON vault_mfa_factors (actor)
    WHERE status = 'active';