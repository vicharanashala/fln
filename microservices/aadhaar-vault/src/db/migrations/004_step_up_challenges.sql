-- 004_step_up_challenges.sql
-- Aadhaar Vault — Session 7 Phase 1: Step-Up Authentication challenges.
--
-- Background
--   Before Session 7, the vault required only a JWT with the
--   `vault:detokenize` scope to return an Aadhaar plaintext. That is
--   too weak for a sensitive operation. The session introduces a
--   first-class **DetokenizationChallenge** object that mediates the
--   approval: the principal must first prove possession of an enrolled
--   MFA factor, and only then can they consume the challenge to receive
--   the plaintext.
--
-- Why a separate table?
--   * Challenges are **transient** — TTL of 5 minutes by default.
--   * Challenges are **single-use** — consumed or expired challenges
--     must never unlock a second detokenization.
--   * Challenges are **actor-bound** — `identity_id` and `requested_by`
--     are denormalized so a stolen challenge from another principal is
--     useless.
--   * Challenges are **operation-bound** — the `operation` column names
--     the privileged action the challenge authorises. Today only
--     `detokenize` exists; future operations (key export, secret
--     reveal, administrative deletion) will reuse the same shape.
--
-- Why not extend `vault_mfa_factors`?
--   * Factors are persistent (RFC 6238, valid until revoked).
--   * Challenges are ephemeral and state-machine driven.
--   * Conflating them breaks audit replay and the eventual partition
--     lifecycle: factors should outlive their challenges by months.
--
-- Migration policy (REPO_STATUS.md §7.14)
--   * `vault_` prefix.
--   * No `DEFAULT now()` — application supplies timestamps.
--   * `IF NOT EXISTS` only on CREATE; ALTER statements rely on the
--     migration ledger to guarantee single application.
--   * `metadata` carries free-form context (e.g. IP, user-agent, the
--     token-id being revealed) without a schema migration per field.
--
-- Status enum (column-level CHECK keeps the enum portable across
-- pg-mem and real Postgres without a CREATE TYPE round-trip):
--   pending   — issued, awaiting MFA verification
--   approved  — MFA verified, not yet consumed
--   consumed  — approved and redeemed for the operation
--   expired   — TTL elapsed without approval
--   failed    — MFA verification explicitly failed

CREATE TABLE vault_step_up_challenges (
    challenge_id        UUID         PRIMARY KEY,
    operation           TEXT         NOT NULL,
    identity_id         TEXT         NOT NULL,
    token_id            TEXT,
    requested_by        TEXT         NOT NULL,
    requested_at        TIMESTAMPTZ  NOT NULL,
    expires_at          TIMESTAMPTZ  NOT NULL,
    approved_at         TIMESTAMPTZ,
    consumed_at         TIMESTAMPTZ,
    status              TEXT         NOT NULL,
    required_factor_id  TEXT         NOT NULL,
    verified_factor_id  TEXT,
    audit_id            TEXT,
    metadata            TEXT,
    CONSTRAINT vault_step_up_challenges_status_chk
        CHECK (status IN ('pending', 'approved', 'consumed', 'expired', 'failed'))
);

-- Hot path 1: lookup by challenge_id. PK index covers this, but the
-- explicit index makes the index name grep-able and survives a future
-- choice to switch the PK to a composite.
CREATE INDEX vault_step_up_challenges_id_idx
    ON vault_step_up_challenges (challenge_id);

-- Hot path 2: prune expired rows by status + TTL.
CREATE INDEX vault_step_up_challenges_status_expiry_idx
    ON vault_step_up_challenges (status, expires_at);

-- Hot path 3: list a principal's pending challenges.
CREATE INDEX vault_step_up_challenges_actor_idx
    ON vault_step_up_challenges (requested_by)
    WHERE status = 'pending';

-- Optional FK to identity is intentionally NOT declared at the SQL
-- level: the vault's identity table is in the same schema and the
-- application enforces referential integrity. Avoiding the FK keeps
-- challenge creation possible during identity-rollback operations.