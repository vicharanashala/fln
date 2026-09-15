/**
 * MongoStepUpChallengeRepository — Phase 3.
 *
 * Mirrors the Postgres adapter's concurrency model: every state-changing
 * update is a `findOneAndUpdate({_id, status: <expected>}, ...)` so two
 * concurrent `consume()` calls collapse to exactly one winner. The second
 * call's filter does not match, the update is a no-op, and the method
 * returns `null` — same semantics as the Postgres `RETURNING 0 rows`.
 *
 * Collection: `vault_step_up_challenges`. Indexes are ensured at boot
 * by `schema/indexes.ts`. Note: the schema includes a TTL index on
 * `expiresAt` so terminal rows in `consumed`/`expired`/`failed` are
 * reclaimed after a small grace window; the application must not
 * assume a `consumed` row is queryable indefinitely. (`pending` rows
 * are NOT deleted by the TTL — they transition to `expired` first
 * via the repository's `expire()` method, exactly mirroring the
 * Postgres adapter's terminal-only delete policy.)
 *
 * `deleteExpired` is intentionally NOT ported — Mongo's TTL index
 * replaces the manual sweep. See `schema/indexes.ts` for the
 * expireAfterSeconds configuration.
 *
 * Field mapping (snake_case SQL → camelCase TypeScript):
 *   challenge_id        -> challengeId
 *   operation           -> operation
 *   identity_id         -> identityId
 *   token_id            -> tokenId
 *   requested_by        -> requestedBy
 *   requested_at        -> requestedAt
 *   expires_at          -> expiresAt
 *   approved_at         -> approvedAt
 *   consumed_at         -> consumedAt
 *   status              -> status
 *   required_factor_id  -> requiredFactorId
 *   verified_factor_id  -> verifiedFactorId
 *   audit_id            -> auditId
 *   metadata            -> metadata
 */
import type { ClientSession, Collection, Db } from 'mongodb';
import { VAULT_COLLECTIONS } from '../../schema/collections';
import type {
  ApproveStepUpChallengeInput,
  CreateStepUpChallengeInput,
  StepUpChallenge,
  StepUpChallengeRepository,
  StepUpChallengeStatus,
  StepUpOperation,
} from '../../application/ports/repositories';

interface ChallengeDoc {
  _id: string;
  operation: string;
  identityId: string;
  tokenId: string | null;
  requestedBy: string;
  requestedAt: Date;
  expiresAt: Date;
  approvedAt: Date | null;
  consumedAt: Date | null;
  status: string;
  requiredFactorId: string;
  verifiedFactorId: string | null;
  auditId: string | null;
  metadata: string | null;
}

function toChallenge(doc: ChallengeDoc): StepUpChallenge {
  return {
    challengeId: doc._id,
    operation: doc.operation as StepUpOperation,
    identityId: doc.identityId,
    tokenId: doc.tokenId,
    requestedBy: doc.requestedBy,
    requestedAt: doc.requestedAt,
    expiresAt: doc.expiresAt,
    approvedAt: doc.approvedAt,
    consumedAt: doc.consumedAt,
    status: doc.status as StepUpChallengeStatus,
    requiredFactorId: doc.requiredFactorId,
    verifiedFactorId: doc.verifiedFactorId,
    auditId: doc.auditId,
    metadata: doc.metadata,
  };
}

export class MongoStepUpChallengeRepository implements StepUpChallengeRepository {
  constructor(
    private readonly db: Db,
    private readonly session?: ClientSession,
  ) {}

  private col(): Collection<ChallengeDoc> {
    return this.db.collection<ChallengeDoc>(VAULT_COLLECTIONS.stepUpChallenges);
  }

  async create(input: CreateStepUpChallengeInput): Promise<StepUpChallenge> {
    const doc: ChallengeDoc = {
      _id: input.challengeId,
      operation: input.operation,
      identityId: input.identityId,
      tokenId: input.tokenId,
      requestedBy: input.requestedBy,
      requestedAt: input.requestedAt,
      expiresAt: input.expiresAt,
      approvedAt: null,
      consumedAt: null,
      status: 'pending',
      requiredFactorId: input.requiredFactorId,
      verifiedFactorId: null,
      auditId: null,
      metadata: input.metadata,
    };
    await this.col().insertOne(doc, { session: this.session });
    return toChallenge(doc);
  }

  async findById(challengeId: string): Promise<StepUpChallenge | null> {
    const doc = await this.col().findOne({ _id: challengeId }, { session: this.session });
    return doc ? toChallenge(doc) : null;
  }

  async approve(input: ApproveStepUpChallengeInput): Promise<StepUpChallenge | null> {
    // Only `pending` may transition to `approved`. The conditional
    // update is the single source of truth for the state machine —
    // application code cannot bypass it.
    const result = await this.col().findOneAndUpdate(
      { _id: input.challengeId, status: 'pending' },
      {
        $set: {
          status: 'approved',
          approvedAt: input.approvedAt,
          verifiedFactorId: input.verifiedFactorId,
          auditId: input.auditId,
        },
      },
      { returnDocument: 'after', session: this.session },
    );
    return result ? toChallenge(result as ChallengeDoc) : null;
  }

  async consume(
    challengeId: string,
    consumedAt: Date,
  ): Promise<StepUpChallenge | null> {
    // Replay-prevention gate. Only `approved` may transition to
    // `consumed`. Any other state (including already-`consumed`)
    // returns null. The caller maps the null to a hard rejection
    // — never a retry.
    const result = await this.col().findOneAndUpdate(
      { _id: challengeId, status: 'approved' },
      {
        $set: {
          status: 'consumed',
          consumedAt,
        },
      },
      { returnDocument: 'after', session: this.session },
    );
    return result ? toChallenge(result as ChallengeDoc) : null;
  }

  async expire(challengeId: string, expiredAt: Date): Promise<StepUpChallenge | null> {
    const result = await this.col().findOneAndUpdate(
      { _id: challengeId, status: 'pending' },
      {
        $set: {
          status: 'expired',
          // Don't overwrite expiresAt — it was set at creation; we
          // just stamp when the transition happened. The TTL index
          // uses the original expiresAt for the cleanup window.
        },
      },
      { returnDocument: 'after', session: this.session },
    );
    void expiredAt; // reserved for future use; see comment above.
    return result ? toChallenge(result as ChallengeDoc) : null;
  }

  async fail(challengeId: string, failedAt: Date): Promise<StepUpChallenge | null> {
    const result = await this.col().findOneAndUpdate(
      { _id: challengeId, status: 'pending' },
      {
        $set: {
          status: 'failed',
        },
      },
      { returnDocument: 'after', session: this.session },
    );
    void failedAt;
    return result ? toChallenge(result as ChallengeDoc) : null;
  }
}
