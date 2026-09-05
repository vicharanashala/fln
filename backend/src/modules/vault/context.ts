/**
 * Vault module wiring.
 *
 * `buildVaultContext` is the single place that turns a `Db` +
 * `MongoClient` into the fully-wired `VaultContext` the route handlers
 * consume. It is invoked once at boot by `registerVaultRoutes` and
 * the result is stashed on `app.vaultContext` (Express
 * `Application` augmentation) for the route layer to use.
 *
 * Why not export a `VaultModule` class and inject its instance via
 * `app.use((req, res, next) => res.locals.vault = ...)`: because
 * `app.locals` is typed as `any` and the production route layer is
 * plain Express handlers (not class-based controllers). A
 * `Record<string, VaultContext>` map keyed by a string tag is
 * closer to how the rest of the FLN backend wires state.
 *
 * If `db` is `null` (the test file-fallback path or a misconfigured
 * dev box) the builder returns `null` and the route layer is told
 * to refuse calls with 503. The in-process commands wired onto
 * `aadhaarVault.ts` are skipped — that lets the existing hardening
 * tests stub the functions directly without standing up Mongo.
 */
import type { Db, MongoClient } from 'mongodb';

import { NodeCryptoService } from './infrastructure/crypto/node-crypto.service';
import { createKeyManager } from './infrastructure/key-providers';
import { InProcessEventPublisher } from './infrastructure/events/in-process-event-publisher';
import { MongoTransactionalVaultWriter } from './infrastructure/db/mongo-transactional-vault-writer';
import { MongoIdentityRepository } from './infrastructure/db/mongo-identity.repository';
import { MongoTokenRepository } from './infrastructure/db/mongo-token.repository';
import { MongoStepUpChallengeRepository } from './infrastructure/db/mongo-step-up-challenge.repository';
import { MongoMfaFactorRepository } from './infrastructure/db/mongo-mfa-factor.repository';
import { ensureVaultIndexes } from './schema/indexes';
import { makeTokenizeAadhaar } from './application/commands/tokenize-aadhaar';
import { makeDetokenizeAadhaar } from './application/commands/detokenize-aadhaar';
import { makeReadAuditHistory } from './application/commands/read-audit-history';
import { makeEnrollMfa } from './application/commands/enroll-mfa';
import { makeRequestDetokenization } from './application/commands/request-detokenization';
import { makeApproveStepUpChallenge } from './application/commands/approve-step-up-challenge';
import { makeVerifyMfa } from './application/commands/verify-mfa';
import { OtpAuthTotpVerifier } from './infrastructure/mfa/totp-verifier';
import {
  __setTokenizeAadhaarImpl,
  __setDetokenizeAadhaarImpl,
  __setEnrollMfaImpl,
  __setRequestDetokenizationImpl,
  __setApproveStepUpChallengeImpl,
  __setListMfaFactorsImpl,
  __setVerifyMfaImpl,
  __setRevokeMfaImpl,
  VaultError,
  type MfaFactorMeta,
} from '../../aadhaarVault';
import { UserRole } from '../../db';

export interface VaultContext {
  tokenize: ReturnType<typeof makeTokenizeAadhaar>;
  detokenize: ReturnType<typeof makeDetokenizeAadhaar>;
  readAuditHistory: ReturnType<typeof makeReadAuditHistory>;
  enrollMfa: ReturnType<typeof makeEnrollMfa>;
  requestDetokenization: ReturnType<typeof makeRequestDetokenization>;
  approveStepUpChallenge: ReturnType<typeof makeApproveStepUpChallenge>;
  keyManagerInfo: { provider: string; currentVersion: string; algorithm: string };
}

export interface BuildVaultContextInput {
  db: Db | null;
  client: MongoClient | null;
  /** Optional logger for the event publisher + key manager. */
  logger?: { info: (obj: unknown, msg?: string) => void; warn: (obj: unknown, msg?: string) => void };
}

export interface BuildVaultContextResult {
  /** The wired context, or `null` if the build failed. */
  ctx: VaultContext | null;
  /** When `ctx` is `null`, a stable reason tag for logging / health
   *  probes. `undefined` when the build succeeded. */
  failureReason?: 'no-mongo' | 'key-manager-init-failed';
  /** The underlying error when `failureReason` is set. */
  failureError?: Error;
}

/**
 * Map FLN UserRole → Vault ActorRoleEnum (vault command's caller-
 * context shape). Mirrors the helper in
 * `backend/src/routes/aadhaarDetokenize.ts:85-94` — kept local to
 * this file so the in-process shim wiring doesn't depend on a
 * route module. The two helpers must stay in sync; the
 * mapping is small enough that a duplicate is cheaper than a
 * cross-module import that would re-introduce a circular dep.
 *
 * Accepts both the FLN `UserRole` enum (lowercase strings) and the
 * vault-side role union (uppercase strings); both shapes are
 * passed to this helper from the route layer. The mapping table
 * itself is identical because both sides encode the same
 * authorization intent — the difference is only the string
 * convention.
 */
function flnRoleToVaultRole(
  role: UserRole | 'TEACHER' | 'SCHOOL_ADMIN' | 'STATE_ADMIN' | 'SUPER_ADMIN' | 'SERVICE',
): 'SUPER_ADMIN' | 'STATE_ADMIN' | 'SERVICE' {
  if (role === UserRole.SUPERADMIN || role === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (
    role === UserRole.ADMIN ||
    role === UserRole.DISTRICT_ADMIN ||
    role === UserRole.BLOCK_ADMIN ||
    role === 'STATE_ADMIN'
  ) {
    return 'STATE_ADMIN';
  }
  // SERVICE is never assigned to an end-user — it is the fallback
  // for any unexpected caller. The detokenize endpoints restrict to
  // admin roles only, so this branch is purely defensive.
  return 'SERVICE';
}

/**
 * Build the wired vault context. Idempotent — safe to call from
 * `registerVaultRoutes` at every boot, since the underlying repos
 * are stateless and the key manager holds only an immutable config.
 *
 * Side effects:
 *   - Calls `ensureVaultIndexes(db)` to create the collections +
 *     indexes (idempotent; safe to re-run).
 *   - Installs the in-process tokenize + detokenize implementations
 *     on `aadhaarVault.ts` via `__setTokenizeAadhaarImpl` and
 *     `__setDetokenizeAadhaarImpl` so the existing call sites
 *     (student registration, admin reveal) transparently route
 *     through the module.
 */
export async function buildVaultContext(
  input: BuildVaultContextInput,
): Promise<BuildVaultContextResult> {
  if (!input.db || !input.client) {
    return { ctx: null, failureReason: 'no-mongo' };
  }

  // Ensure schema before anything reads/writes.
  await ensureVaultIndexes(input.db);

  // Build deps.
  let keyManager;
  try {
    keyManager = createKeyManager({ logger: input.logger });
  } catch (err) {
    return {
      ctx: null,
      failureReason: 'key-manager-init-failed',
      failureError: err instanceof Error ? err : new Error(String(err)),
    };
  }
  const crypto = new NodeCryptoService();
  const events = new InProcessEventPublisher({ logger: input.logger });
  const vaultWriter = new MongoTransactionalVaultWriter(input.db, input.client);

  // Repositories (all read-side; writes go through vaultWriter
  // for the tokenize path). Identity + token + challenge + mfa
  // are the four collections the detokenize + step-up paths walk.
  // The audit chain is the FLN `logbook` collection, written
  // by the commands themselves via `dbStore.addLog` /
  // `dbStore.addLogInSession` — there is no `audit` repo
  // anymore (issue #406).
  const identities = new MongoIdentityRepository(input.db);
  const tokens = new MongoTokenRepository(input.db);
  const challenges = new MongoStepUpChallengeRepository(input.db);
  const mfa = new MongoMfaFactorRepository(input.db);

  // RFC 6238 TOTP verifier. The application-layer
  // `TotpVerifier` port keeps `otpauth` confined to a single
  // adapter so the commands never import it directly.
  const totp = new OtpAuthTotpVerifier();

  // Commands. The detokenize command needs the read-side repos
  // directly; the tokenize command needs the transactional
  // writer (so identity + token + logbook audit land
  // atomically). The audit chain is the FLN `logbook`
  // collection, written by the commands themselves.
  const tokenize = makeTokenizeAadhaar({
    keyManager,
    crypto,
    vaultWriter,
    events,
  });
  const detokenize = makeDetokenizeAadhaar({
    keyManager,
    crypto,
    tokens,
    identities,
    events,
    challenges,
  });
  const readAuditHistory = makeReadAuditHistory({});
  const enrollMfa = makeEnrollMfa({
    keyManager,
    totp,
    mfa,
    events,
  });
  const requestDetokenization = makeRequestDetokenization({
    tokens,
    identities,
    mfa,
    challenges,
    events,
  });
  const approveStepUpChallenge = makeApproveStepUpChallenge({
    keyManager,
    totp,
    mfa,
    challenges,
    events,
  });
  // NEW (Wave 2A): the verifyMfa command is the only path that
  // transitions PENDING_ENROLLMENT -> ENROLLED and writes the
  // MFA_ENROLLMENT_VERIFIED audit row. The route layer's
  // POST /api/me/mfa/verify handler invokes it after a
  // successful TOTP submission during enrollment.
  const verifyMfa = makeVerifyMfa({
    keyManager,
    totp,
    mfa,
    events,
    bumpVerifyAttempts: (id) => mfa.incrementVerifyAttempts(id),
    transitionToEnrolled: (id) => mfa.transitionToEnrolled(id),
  });

  const ctx: VaultContext = {
    tokenize,
    detokenize,
    readAuditHistory,
    enrollMfa,
    requestDetokenization,
    approveStepUpChallenge,
    keyManagerInfo: keyManager.info(),
  };

  // Install the in-process tokenize implementation on the legacy
  // shim. After this returns, calls to `tokenizeAadhaar(rawAadhar,
  // ctx)` from student registration / bulk import go through the
  // module, not HTTP. The HTTP fallback (default impl) is no
  // longer consulted.
  __setTokenizeAadhaarImpl(async (rawAadhar, aadhaarCtx) => {
    // Map the FLN shim's context shape to the command's caller
    // context. The shim has `email`; the command wants `actorId`.
    const result = await tokenize({
      raw: rawAadhar,
      type: 'AADHAAR',
      context: {
        actorId: aadhaarCtx.email || 'fln-backend-service',
        actorRole: 'SERVICE',
        reason: `Aadhaar tokenization for student registration by ${aadhaarCtx.email || 'unknown user'}`,
        requestId: aadhaarCtx.requestId,
        sourceIp: aadhaarCtx.sourceIp,
        userAgent: aadhaarCtx.userAgent,
      },
    });
    return result;
  });

  // Install the in-process detokenize implementation on the
  // legacy shim. After this returns, calls to
  // `detokenizeAadhaar({challengeId, context})` from the admin
  // reveal flow go through the module, not HTTP.
  __setDetokenizeAadhaarImpl(async (params) => {
    // The shim's AadhaarActorContext uses `email`; the command
    // wants `actorId`. The actorRole enum is identical across
    // both surfaces, so it's passed through unchanged.
    const result = await detokenize({
      challengeId: params.challengeId,
      context: {
        actorId: params.context.email || 'fln-backend-service',
        actorRole: params.context.actorRole,
        reason: `Detokenization for admin reveal — ${params.context.email || 'fln admin'}`,
        requestId: params.context.requestId,
        sourceIp: params.context.sourceIp,
        userAgent: params.context.userAgent,
      },
    });
    // The command's result shape is identical to the legacy
    // shim's `DetokenizeResult` — same field set and types — so
    // it's safe to pass through without reshaping.
    return result;
  });

  // Install the in-process enrollMfa implementation on the
  // legacy shim. After this returns, calls to
  // `enrollMfa({actor, label, context, ...})` from the admin
  // step-up flow go through the module, not HTTP.
  __setEnrollMfaImpl(async (params) => {
    const result = await enrollMfa({
      actor: params.actor,
      context: {
        actorId: params.actor,
        actorRole: params.context.actorRole,
        reason: `MFA enrollment for ${params.actor} — ${params.context.email || 'fln admin'}`,
        requestId: params.context.requestId,
        sourceIp: params.context.sourceIp,
        userAgent: params.context.userAgent,
      },
      ...(params.label !== undefined ? { label: params.label } : {}),
      ...(params.algorithm !== undefined ? { algorithm: params.algorithm } : {}),
      ...(params.digits !== undefined ? { digits: params.digits } : {}),
      ...(params.period !== undefined ? { period: params.period } : {}),
    });
    // The command's `factor` is a typed `MfaFactor`; the shim's
    // contract is `Record<string, unknown>` (it forwards the
    // response as-is). Convert via a deliberate object spread
    // so the call-site shape is stable.
    //
    // `lifecycleState` and `verifyAttempts` MUST be projected —
    // the FLN /api/me/mfa/enroll route maps the result through
    // `factorMetaToWire` and then JSON-serializes the response.
    // Omitting them produces `lifecycleState: undefined` in the
    // wire JSON (the field is silently dropped), which the
    // Security panel + Aadhaar reveal dialog both treat as
    // "not enrolled" — exactly the bug class this shim exists
    // to prevent.
    const factorObj: Record<string, unknown> = {
      factorId: result.factor.factorId,
      actor: result.factor.actor,
      factorType: result.factor.factorType,
      status: result.factor.status,
      lifecycleState: result.factor.lifecycleState,
      label: result.factor.label,
      algorithm: result.factor.algorithm,
      digits: result.factor.digits,
      period: result.factor.period,
      lastUsedAt: result.factor.lastUsedAt,
      expiresAt: result.factor.expiresAt,
      createdAt: result.factor.createdAt,
      verifyAttempts: result.factor.verifyAttempts,
    };
    return {
      factorId: result.factorId,
      otpauthUri: result.otpauthUri,
      factor: factorObj,
    };
  });

  // Install the in-process requestDetokenization implementation
  // on the legacy shim. After this returns, calls to
  // `requestDetokenization({tokenId, factorId, context})` from
  // the admin step-up flow go through the module, not HTTP.
  __setRequestDetokenizationImpl(async (params) => {
    const result = await requestDetokenization({
      tokenId: params.tokenId,
      factorId: params.factorId,
      context: {
        actorId: params.context.email || 'fln-backend-service',
        actorRole: params.context.actorRole,
        reason: `Step-up challenge for admin detokenization — ${params.context.email || 'fln admin'}`,
        requestId: params.context.requestId,
        sourceIp: params.context.sourceIp,
        userAgent: params.context.userAgent,
      },
    });
    // The command returns a `Date` for `expiresAt`; the shim
    // contract is an ISO string. Convert here.
    return {
      challengeId: result.challengeId,
      expiresAt: result.expiresAt.toISOString(),
      requiredFactor: result.requiredFactor as unknown as Record<string, unknown>,
    };
  });

  // Install the in-process approveStepUpChallenge implementation
  // on the legacy shim. After this returns, calls to
  // `approveStepUpChallenge({challengeId, code, context})` from
  // the admin step-up flow go through the module, not HTTP.
  __setApproveStepUpChallengeImpl(async (params) => {
    const result = await approveStepUpChallenge({
      challengeId: params.challengeId,
      code: params.code,
      context: {
        actorId: params.context.email || 'fln-backend-service',
        actorRole: params.context.actorRole,
        reason: `Step-up approval for admin detokenization — ${params.context.email || 'fln admin'}`,
        requestId: params.context.requestId,
        sourceIp: params.context.sourceIp,
        userAgent: params.context.userAgent,
      },
    });
    // The command returns a `Date` for `approvedAt`; the shim
    // contract is an ISO string.
    return {
      challengeId: result.challengeId,
      status: result.status,
      approvedAt: result.approvedAt.toISOString(),
      verifiedFactorId: result.verifiedFactorId,
    };
  });

  // Install the read-side listMfaFactors implementation on the
  // legacy shim. After this returns, calls to
  // `listMfaFactors({actor})` from the FLN admin-enroll route
  // return the caller's active TOTP factors (newest first) so
  // the FLN layer can detect a returning admin and skip the
  // QR re-enrollment step. We project the Mongo MfaFactor to
  // the wire shape and never expose `encryptedSecret`.
  //
  // `lifecycleState` and `verifyAttempts` MUST be projected —
  // the Security panel and Aadhaar reveal dialog both branch
  // on `lifecycleState` to decide between Pending / Enrolled /
  // "not enrolled". Omitting them makes a freshly-verified
  // factor look like "not enrolled" to the UI, which in turn
  // makes the Security panel fire a POST /api/me/mfa/enroll
  // that returns 409 ALREADY_ENROLLED.
  __setListMfaFactorsImpl(async (params) => {
    const rows = await mfa.listActiveByActor(params.actor);
    const factors: MfaFactorMeta[] = rows.map(r => ({
      factorId: r.factorId,
      actor: r.actor,
      factorType: r.factorType,
      status: r.status,
      lifecycleState: r.lifecycleState,
      label: r.label,
      algorithm: r.algorithm,
      digits: r.digits,
      period: r.period,
      lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      verifyAttempts: r.verifyAttempts,
    }));
    return { factors };
  });

  // Install the in-process verifyMfa implementation on the
  // legacy shim. After this returns, calls to
  // `verifyMfaFactor({factorId, code, actor, context})` from
  // the FLN /api/me/mfa/verify route layer go through the
  // module, not HTTP. The route passes the JWT subject as
  // `actor` so the command refuses to verify a factor
  // belonging to a different actor (the cross-admin attack
  // guard). On a successful verify against a PENDING_ENROLLMENT
  // factor, the command atomically transitions the factor to
  // ENROLLED and writes a separate MFA_ENROLLMENT_VERIFIED
  // audit row in addition to the existing MFA_VERIFY row.
  __setVerifyMfaImpl(async (params) => {
    const result = await verifyMfa({
      factorId: params.factorId,
      code: params.code,
      expectedActor: params.actor,
      context: {
        actorId: params.context.actorId,
        actorRole: flnRoleToVaultRole(params.context.actorRole),
        reason: params.context.reason,
        requestId: params.context.requestId,
      },
    });
    // Flatten the discriminated union into the wire shape
    // the route consumes. The route needs:
    //   - success: factorId + lifecycleState + (optional) delta
    //   - failure: factorId (nullable) + reason
    // The command's success returns the post-`markUsed` factor
    // row; we project its `lifecycleState` and `factorId`.
    if (result.valid) {
      return {
        valid: true,
        factorId: result.factorId,
        lifecycleState: (result.factor as any).lifecycleState,
        delta: result.delta,
      };
    }
    // `result.valid === false` here — TypeScript should narrow,
    // but the discriminant access via `result.reason` requires
    // a direct reference. The cast keeps the type checker
    // honest across the union split.
    const failure = result as { valid: false; factorId: string | null; reason: string };
    return {
      valid: false,
      factorId: failure.factorId,
      reason: failure.reason as
        | 'FACTOR_NOT_FOUND'
        | 'FACTOR_REVOKED'
        | 'FACTOR_EXPIRED'
        | 'ACTOR_MISMATCH'
        | 'CODE_MISMATCH',
    };
  });

  // Install the in-process revokeMfa implementation on the
  // legacy shim. The route layer's actor-isolation check
  // (factor.actor === user.email) runs BEFORE this shim is
  // invoked, so the shim is a thin delegation to the
  // repository. The shim does not write an audit row — the
  // route does, with the FLN admin's id.
  __setRevokeMfaImpl(async (params) => {
    const row = await mfa.revoke(params.factorId);
    if (!row) {
      // Unknown factor — the route's pre-check should have
      // caught this; surface a typed error so the route's
      // VaultError handler returns 404.
      throw new VaultError(
        'FACTOR_NOT_FOUND',
        404,
        `no vault_mfa_factors row matches id=${params.factorId}.`,
      );
    }
    return { factorId: row.factorId, status: 'revoked' };
  });

  return { ctx };
}
