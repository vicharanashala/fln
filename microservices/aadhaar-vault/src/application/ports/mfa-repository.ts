/**
 * MFA factor repository port (Session 5 Phase 2).
 *
 * Replaces the previous `vault_mfa_challenges` transient-artifact model
 * with a persistent factor model. Each row is a step-up factor that
 * lives until revoked:
 *
 *   - `actor`          — the user / service principal that enrolled it
 *   - `factorType`     — currently 'totp'; future: 'webauthn', 'email-otp'
 *   - `status`         — 'active' or 'revoked'
 *   - `encryptedSecret`— the TOTP shared secret sealed via
 *                        {@link KeyManager.sealSecret}; never stored in
 *                        plaintext
 *   - `algorithm`      — 'SHA1' | 'SHA256' | 'SHA512'
 *   - `digits`         — code length, typically 6
 *   - `period`         — time-step in seconds, typically 30
 *   - `lastUsedAt`     — wall-clock time the most recent successful
 *                        verification happened (for replay protection
 *                        and audit)
 *   - `expiresAt`      — optional deadline; TOTP factors do not expire,
 *                        future factor types (e.g. email-OTP) may set it
 *   - `createdAt`      — enrollment time
 *
 * Layering:
 *   The port is application-layer. The Postgres adapter that implements
 *   it lives in `src/infrastructure/db/postgres-mfa-repository.ts`.
 *   The test pool (`src/db/memory-pool.ts`) declares the column shapes
 *   it expects to see; the migrator is responsible for matching them
 *   on real Postgres via `003_rename_mfa_challenges_to_mfa_factors.sql`.
 */
export type MfaFactorType = 'totp';

export type MfaFactorStatus = 'active' | 'revoked';

export interface MfaFactor {
    factorId: string;
    actor: string;
    factorType: MfaFactorType;
    status: MfaFactorStatus;
    label: string;
    /** AES-GCM envelope of the TOTP shared secret. Persisted as the
     *  output of {@link KeyManager.sealSecret}. */
    encryptedSecret: Buffer;
    algorithm: string;
    digits: number;
    period: number;
    lastUsedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
}

export interface InsertMfaFactorInput {
    factorId: string;
    actor: string;
    factorType: MfaFactorType;
    label: string;
    encryptedSecret: Buffer;
    algorithm: string;
    digits: number;
    period: number;
    expiresAt?: Date | null;
}

export interface MfaFactorRepository {
    /**
     * Persist a newly enrolled factor. The adapter supplies `createdAt`
     * (the application's wall clock) and `status='active'`. The caller
     * supplies the factor_id (UUIDv7, same shape as `vault_tokens.id`).
     */
    insert(rec: InsertMfaFactorInput): Promise<MfaFactor>;

    /** Mark the factor as having been used at `usedAt`. Idempotent:
     *  a second call updates the timestamp. Returns null when the
     *  factor_id is unknown. */
    markUsed(
        factorId: string,
        usedAt: Date,
    ): Promise<MfaFactor | null>;

    /** Revoke the factor. After this call the factor still exists
     *  (audit) but {@link listActiveByActor} will skip it. Idempotent:
     *  revoking an already-revoked row is a no-op that still returns
     *  the row. */
    revoke(factorId: string): Promise<MfaFactor | null>;

    /** Look up by id. Returns null when unknown. */
    getById(factorId: string): Promise<MfaFactor | null>;

    /** All factors enrolled by an actor, newest first. */
    listByActor(actor: string): Promise<MfaFactor[]>;

    /** Active (non-revoked) factors only. The detokenize hot path. */
    listActiveByActor(actor: string): Promise<MfaFactor[]>;
}