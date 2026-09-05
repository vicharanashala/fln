/**
 * Repository port interfaces (consolidated from
 * src/db/ports/*.ts).
 *
 * In the original microservice each repository lived in its own file.
 * Here we consolidate the three needed for Phase 2 (tokenize) into one
 * file so the port surface is co-located. Phases 3 (mfa, step-up) and
 * 4 will add more types here or in sibling files.
 */
import type { Buffer } from 'node:buffer';

// ---------------------------------------------------------------------------
// Identity repository
// ---------------------------------------------------------------------------
export interface IdentityRecord {
  identityId: string;
  ciphertext: Buffer;
  aad: Buffer;
  pepperVersion: number;
  keyVersion: number;
  createdAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
}

export type NewIdentityRecord = Omit<
  IdentityRecord,
  'createdAt' | 'rotatedAt' | 'revokedAt'
>;

export interface IdentityRepository {
  insert(rec: NewIdentityRecord): Promise<IdentityRecord>;
  getById(identityId: string): Promise<IdentityRecord | null>;
  revoke(identityId: string): Promise<void>;
  rotate(identityId: string, keyVersion: number): Promise<void>;
}

// ---------------------------------------------------------------------------
// Token repository
// ---------------------------------------------------------------------------
export interface NewToken {
  /** Opaque token id. Application layer mints a UUIDv4. */
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

// ---------------------------------------------------------------------------
// Audit repository
// ---------------------------------------------------------------------------
// The original Phase 2 port defined a separate `AuditRepository` that
// wrote to a dedicated `vault_audit_log` Mongo collection. Per issue
// #406's review, the vault audit chain has been unified onto the FLN
// `logbook` collection via `dbStore.addLog` / `dbStore.addLogInSession`
// (see `backend/src/modules/vault/audit/logbook-entry.ts` for the
// mapping). The old port interface, the `AuditEntry` / `AuditRecord`
// types, and the `MongoAuditRepository` adapter are all gone; the
// `VaultWriteConnection.writeLog` method is the only seam the
// transactional writer exposes, and it accepts the FLN `LogEntry`
// shape directly.

// ---------------------------------------------------------------------------
// Step-up challenge repository (Phase 3)
// ---------------------------------------------------------------------------
// Lifecycle: pending → approved → consumed, or pending → expired/failed.
// The four state transitions are all implemented as `findOneAndUpdate` with
// a status guard so two concurrent consume() calls collapse to one winner.

export type StepUpChallengeStatus =
  | 'pending'
  | 'approved'
  | 'consumed'
  | 'expired'
  | 'failed';

export type StepUpOperation = 'detokenize';

export interface StepUpChallenge {
  challengeId: string;
  operation: StepUpOperation;
  identityId: string;
  tokenId: string | null;
  requestedBy: string;
  requestedAt: Date;
  expiresAt: Date;
  approvedAt: Date | null;
  consumedAt: Date | null;
  status: StepUpChallengeStatus;
  requiredFactorId: string;
  verifiedFactorId: string | null;
  auditId: string | null;
  metadata: string | null;
}

export interface CreateStepUpChallengeInput {
  challengeId: string;
  operation: StepUpOperation;
  identityId: string;
  tokenId: string | null;
  requestedBy: string;
  requestedAt: Date;
  expiresAt: Date;
  requiredFactorId: string;
  metadata: string | null;
}

export interface ApproveStepUpChallengeInput {
  challengeId: string;
  verifiedFactorId: string;
  approvedAt: Date;
  auditId: string | null;
}

export interface StepUpChallengeRepository {
  /** Persist a new challenge in `pending` state. */
  create(input: CreateStepUpChallengeInput): Promise<StepUpChallenge>;
  /** Look up a challenge by id. Returns `null` for unknown ids. */
  findById(challengeId: string): Promise<StepUpChallenge | null>;
  /**
   * Transition `pending → approved`. Returns the updated row, or
   * `null` if the row was missing or already past `pending`.
   */
  approve(input: ApproveStepUpChallengeInput): Promise<StepUpChallenge | null>;
  /**
   * Atomic `approved → consumed` transition. Returns the row, or
   * `null` if the row was missing, not `approved`, or already
   * `consumed`. This is the single replay-prevention gate.
   */
  consume(challengeId: string, consumedAt: Date): Promise<StepUpChallenge | null>;
  /** Transition `pending → expired`. Returns `null` if missing or not pending. */
  expire(challengeId: string, expiredAt: Date): Promise<StepUpChallenge | null>;
  /** Transition `pending → failed`. Returns `null` if missing or not pending. */
  fail(challengeId: string, failedAt: Date): Promise<StepUpChallenge | null>;
}

// ---------------------------------------------------------------------------
// MFA factor repository (Phase 4)
// ---------------------------------------------------------------------------
// Persistent step-up factor model. Each row is a TOTP factor that lives
// until revoked.
//
//   - `actor`           — the user / service principal that enrolled it.
//   - `factorType`      — currently 'totp'; future: 'webauthn', 'email-otp'.
//   - `status`          — 'active' or 'revoked'.
//   - `encryptedSecret` — the TOTP shared secret sealed via
//                         KeyManager.sealSecret; never stored in plaintext.
//   - `algorithm`       — 'SHA1' | 'SHA256' | 'SHA512'.
//   - `digits`          — code length, typically 6.
//   - `period`          — time-step in seconds, typically 30.
//   - `lastUsedAt`      — wall-clock time the most recent successful
//                         verification happened (for replay protection
//                         and audit).
//   - `expiresAt`       — optional deadline; TOTP factors do not expire,
//                         future factor types (e.g. email-OTP) may set it.
//   - `createdAt`       — enrollment time.

export type MfaFactorType = "totp";

export type MfaFactorStatus = "active" | "revoked";

export type MfaFactorLifecycleState = "PENDING_ENROLLMENT" | "ENROLLED";

export interface MfaFactor {
  factorId: string;
  actor: string;
  factorType: MfaFactorType;
  status: MfaFactorStatus;
  lifecycleState: MfaFactorLifecycleState;  // NEW: enrollment lifecycle, orthogonal to status
  label: string;
  /** AES-GCM envelope of the TOTP shared secret. Persisted as the
   *  output of KeyManager.sealSecret. */
  encryptedSecret: Buffer;
  algorithm: string;
  digits: number;
  period: number;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  verifyAttempts: number;  // NEW: monotonic counter of verifyMfaFactor calls (success + failure)
}

export interface InsertMfaFactorInput {
  factorId: string;
  actor: string;
  factorType: MfaFactorType;
  lifecycleState: MfaFactorLifecycleState;  // NEW: defaults to PENDING_ENROLLMENT at insert
  verifyAttempts: number;                    // NEW: defaults to 0 at insert
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
  markUsed(factorId: string, usedAt: Date): Promise<MfaFactor | null>;

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

  /** Active (non-revoked) factors that are still PENDING_ENROLLMENT — used by
   *  POST /api/me/mfa/enroll to detect a resumable enrollment and return the
   *  same factorId+otpauthUri without minting a new secret. */
  findActivePendingByActor(actor: string): Promise<MfaFactor[]>;

  /** Atomic CAS: PENDING_ENROLLMENT -> ENROLLED. Returns the updated row, or
   *  null if the factor doesn't exist OR is already ENROLLED. The route
   *  uses the null return to distinguish "first verify" from "re-verify". */
  transitionToEnrolled(factorId: string): Promise<MfaFactor | null>;

  /** Atomic $inc of verifyAttempts. Called once per verifyMfaFactor attempt
   *  (success or failure) so the counter reflects all attempts. */
  incrementVerifyAttempts(factorId: string): Promise<void>;
}
