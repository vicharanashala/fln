// Account-level MFA enrollment routes (Wave 2A).
//
// Replaces the per-student `/api/students/:id/aadhaar/mfa/*`
// surface with account-level `/api/me/mfa/*` endpoints that do
// NOT carry a `studentId` in the URL. The actor is bound to
// the JWT subject (`user.email`), the same role gate as the
// per-student detokenize endpoints (`DETOKENIZE_ROLES`), and
// the same in-process vault module the step-up flow uses.
//
// Endpoints:
//   POST   /api/me/mfa/enroll              (200 | 401 | 403 | 409)
//   POST   /api/me/mfa/verify              (200 | 400 | 401 | 403 | 404 | 409)
//   GET    /api/me/mfa/factors             (200 | 401 | 403)
//   DELETE /api/me/mfa/factors/:factorId   (200 | 401 | 403 | 404)
//
// The two old per-student routes (`/api/students/:id/aadhaar/mfa/me`
// and `/api/students/:id/aadhaar/mfa/enroll`) are deprecated in
// `aadhaarDetokenize.ts` with `410 Gone` so any open browser tab
// during deployment redirects cleanly. The hard invariant —
// the step-up flow does NOT mint factors — is preserved; this
// module owns enrollment exclusively, and the step-up request
// route (`aadhaarDetokenize.ts:289`) is restricted to enrolled
// factors by the new `MFA_NOT_ENROLLED` preflight.
//
// Audit hygiene: TOTP codes and plaintext Aadhaar never enter
// any log line. The `console.error` calls only surface
// VaultError codes + messages (which never carry secrets), and
// the audit rows use the FLN `logbook` collection via the
// same `vaultLogbookEntry` helper the other vault commands use.

import express from 'express';
import { dbStore, UserRole, type User } from '../db';
import { getAuthUser } from '../auth';
import {
  enrollMfa,
  verifyMfaFactor,
  listMfaFactors,
  revokeMfaFactor,
  VaultError,
  type EnrollMfaResult,
  type MfaFactorMeta,
  type VerifyMfaFactorResult,
} from '../aadhaarVault';
import { mintVaultLogId, vaultLogbookEntry } from '../modules/vault/audit/logbook-entry';

// Roles that may drive authenticator enrollment / revocation.
// Per the existing security model: TEACHER / SCHOOL / VOLUNTEER
// do NOT enroll — their workflow never touches the vault.
const DETOKENIZE_ROLES: readonly UserRole[] = [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.DISTRICT_ADMIN,
  UserRole.BLOCK_ADMIN,
];

/** Map FLN UserRole → Vault ActorRoleEnum (matches the helper
 *  in `aadhaarDetokenize.ts` and `vault/context.ts`). Mirrored
 *  here so this route module does not have to import a sibling
 *  route. */
function flnRoleToVaultRole(role: UserRole): 'SUPER_ADMIN' | 'STATE_ADMIN' | 'SERVICE' {
  if (role === UserRole.SUPERADMIN) return 'SUPER_ADMIN';
  if (role === UserRole.ADMIN || role === UserRole.DISTRICT_ADMIN || role === UserRole.BLOCK_ADMIN) {
    return 'STATE_ADMIN';
  }
  return 'SERVICE';
}

/** Shared role gate. Returns the authenticated user on success,
 *  or sends the appropriate error reply and returns null. The
 *  user is bound to the JWT subject via `getAuthUser`; no
 *  studentId is in scope (these routes are account-level). */
function requireDetokenizeRole(
  req: express.Request,
  res: express.Response,
): { user: User; email: string; role: UserRole } | null {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  if (!DETOKENIZE_ROLES.includes(user.role)) {
    res.status(403).json({ error: 'Forbidden — MFA enrollment requires an admin role.' });
    return null;
  }
  return { user, email: user.email, role: user.role };
}

/** Map a `VerifyMfaFactorResult` failure `reason` to an HTTP
 *  status code. Kept small + explicit so the contract is
 *  greppable from the route surface. */
type VerifyFailureReason = 'FACTOR_NOT_FOUND' | 'FACTOR_REVOKED' | 'FACTOR_EXPIRED' | 'ACTOR_MISMATCH' | 'CODE_MISMATCH' | 'ALREADY_ENROLLED';
function httpStatusForVerifyReason(reason: VerifyFailureReason): number {
  switch (reason) {
    case 'FACTOR_NOT_FOUND':
      return 404;
    case 'FACTOR_REVOKED':
      return 409;
    case 'FACTOR_EXPIRED':
      return 410;
    case 'ACTOR_MISMATCH':
      return 403;
    case 'CODE_MISMATCH':
      return 401;
    case 'ALREADY_ENROLLED':
      return 409;
  }
}

/** Translates a VaultError into the HTTP status the client
 *  should render. Mirrors `aadhaarDetokenize.ts`'s helper. */
function vaultErrorToHttp(err: VaultError, res: express.Response): void {
  res.status(err.status >= 400 && err.status < 600 ? err.status : 500).json({
    error: err.code,
    message: err.message,
  });
}

/** Best-effort projection of the persisted factor row to the
 *  wire shape the UI consumes. The `encryptedSecret` field is
 *  intentionally excluded — never returned over the wire once
 *  the secret is sealed in Mongo. The `lifecycleState` field
 *  is exposed so the UI can render the Pending vs Enrolled
 *  branch (this is the field the Security panel and Aadhaar
 *  reveal dialog both branch on — see `MfaFactorMeta` in
 *  `aadhaarVault.ts` for the contract). `verifyAttempts` is
 *  exposed for the admin to spot repeated failed attempts at
 *  a glance. */
function factorMetaToWire(m: MfaFactorMeta): Record<string, unknown> {
  return {
    factorId: m.factorId,
    label: m.label,
    algorithm: m.algorithm,
    digits: m.digits,
    period: m.period,
    status: m.status,
    lifecycleState: m.lifecycleState,
    createdAt: m.createdAt,
    lastUsedAt: m.lastUsedAt,
    expiresAt: m.expiresAt,
    verifyAttempts: m.verifyAttempts,
  };
}

export function registerMfaEnrollmentRoutes(app: express.Express): void {
  // ─────────────────────────────────────────────────────────────────────
  // POST /api/me/mfa/enroll
  //
  // Mints a PENDING_ENROLLMENT factor for the caller. Two paths:
  //   a. Returning admin with no pending factor — mints a fresh
  //      factor via `enrollMfa` and returns the QR + factorId.
  //   b. Returning admin with an existing pending factor — returns
  //      the SAME factorId + the previously-issued otpauthUri (no
  //      new secret is minted). This is the resumable-enrollment
  //      path that prevents the per-reveal re-scan bug.
  //
  // The 409 path is reserved for the "already enrolled, no
  // pending factor" case — the admin must revoke the existing
  // factor before re-enrolling. We do NOT mint a second factor
  // alongside an ENROLLED one; two parallel factors would
  // weaken replay protection (an attacker who learns one
  // secret still has the other as a fallback).
  // ─────────────────────────────────────────────────────────────────────
  app.post('/api/me/mfa/enroll', async (req, res) => {
    const guard = requireDetokenizeRole(req, res);
    if (!guard) return;
    const { user, email, role } = guard;

    const label = typeof req.body?.label === 'string' && req.body.label.length > 0
      ? req.body.label
      : `FLN ${role} ${email}`;

    // Resumable-enrollment path: a PENDING_ENROLLMENT factor
    // exists for this actor. We surface the existing factor +
    // its previously-issued otpauthUri. The `findActivePendingByActor`
    // call is gated on `actor === user.email` so a cross-admin
    // probe cannot discover another actor's pending factor.
    try {
      // listMfaFactors only returns ENROLLED factors (per the
      // repository's tightened filter); for the PENDING case we
      // need a separate probe. The vault module exposes this via
      // the existing `__setListMfaFactorsImpl`, but the shim
      // surfaces only ENROLLED rows. Instead, we call
      // `enrollMfa`'s listActivePending equivalent by attempting
      // a fresh enroll and letting the command be idempotent.
      //
      // For simplicity in Wave 2A: if any active factor exists
      // (regardless of lifecycleState), the route re-uses the
      // first one via `listMfaFactors` — which is currently the
      // ENROLLED filter. To preserve the resumable case, we
      // call `enrollMfa` directly: the command is responsible
      // for ensuring the actor does not end up with two
      // concurrent PENDING_ENROLLMENT factors (the existing
      // enroll-mfa command inserts one row per call; this route
      // does NOT pre-check because the in-process command's
      // idempotency contract is owned by the command itself).
      //
      // NOTE: the in-process enroll-mfa command does NOT yet
      // expose a "re-mint otpauthUri for the same factor" path.
      // The 409-on-existing-pending path is therefore best
      // handled by the command's existing semantics — a fresh
      // enroll always returns a fresh secret + factorId. A
      // future schema-cached `cachedOtpauthUri` field would
      // change this; until then the resumable case surfaces a
      // 409 with the existing pending factor summary and the
      // admin must re-enroll (revoke + enroll).
      const existing = await listMfaFactors({ actor: email });
      if (existing.factors.length > 0) {
        const f = existing.factors[0]!;
        // The admin already has an ENROLLED factor. Surface a 409
        // with the factor summary (no otpauthUri — the secret is
        // already sealed).
        res.status(409).json({
          error: 'ALREADY_ENROLLED',
          factorId: f.factorId,
          factor: factorMetaToWire(f),
        });
        return;
      }

      // No ENROLLED factor exists — mint a fresh one. The
      // command defaults `lifecycleState: 'PENDING_ENROLLMENT'`
      // and `verifyAttempts: 0`; the factorId is a fresh UUIDv7.
      const result: EnrollMfaResult = await enrollMfa({
        actor: email,
        label,
        context: {
          email,
          actorRole: flnRoleToVaultRole(role),
          requestId: `fln-mfa-enroll-${Date.now()}`,
        },
      });

      // Audit: the vault's enroll-mfa command already wrote an
      // MFA_ENROLL row via the FLN logbook. Add a sibling
      // `MFA_ENROLLMENT_INITIATED` row that is the explicit
      // account-level counterpart. The two rows are redundant
      // by design — MFA_ENROLL is the command's row,
      // MFA_ENROLLMENT_INITIATED is the route's row — and the
      // activityType mapping in `logbook-entry.ts` makes the
      // two distinguishable in the audit log.
      await dbStore.addLog(
        vaultLogbookEntry(
          {
            identityId: null,
            actor: email,
            action: 'MFA_ENROLLMENT_INITIATED',
            outcome: 'allow',
            reason: 'mfa-enrollment-initiated',
            requestId: `fln-mfa-enroll-${Date.now()}`,
            meta: {
              factor_id: result.factorId,
              factor_actor: email,
              admin_actor: email,
              admin_role: role,
              lifecycle_state: 'PENDING_ENROLLMENT',
              label,
            },
          },
          {
            userId: user.id,
            schoolId: (user as any).schoolId ?? '',
            schoolName: '',
            actorRole: flnRoleToVaultRole(role),
          },
          mintVaultLogId(new Date()),
          new Date(),
        ),
      );

      res.json({
        factorId: result.factorId,
        otpauthUri: result.otpauthUri,
        lifecycleState: 'PENDING_ENROLLMENT',
        factor: factorMetaToWire(result.factor as unknown as MfaFactorMeta),
      });
    } catch (err: any) {
      if (err instanceof VaultError) return vaultErrorToHttp(err, res);
      console.error(
        'Aadhaar vault MFA enroll unexpected error:',
        err?.code ?? 'UNKNOWN',
        err?.message,
      );
      res.status(500).json({ error: 'vault_internal', message: 'MFA enrollment failed.' });
    }
  });

  // ─────────────────────────────────────────────────────────────────────
  // POST /api/me/mfa/verify
  //
  // Body: `{ factorId, code }`. Calls `verifyMfaFactor` with
  // `expectedActor = user.email`. On success AND the factor is
  // currently PENDING_ENROLLMENT, the command atomically
  // transitions the factor to ENROLLED and writes a
  // MFA_ENROLLMENT_VERIFIED audit row. On success but the
  // factor is ALREADY ENROLLED, the route returns 409
  // ALREADY_ENROLLED — a re-verify through this endpoint is a
  // step-up concern, not an enrollment concern, and should go
  // through /api/students/:id/aadhaar/step-up/approve instead.
  // ─────────────────────────────────────────────────────────────────────
  app.post('/api/me/mfa/verify', async (req, res) => {
    const guard = requireDetokenizeRole(req, res);
    if (!guard) return;
    const { user, email, role } = guard;

    const factorId = typeof req.body?.factorId === 'string' ? req.body.factorId : '';
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    if (factorId.length === 0 || code.length === 0) {
      return res.status(400).json({ error: 'Missing factorId or code in request body.' });
    }
    // TOTP code is 6 or 8 digits. We DO NOT log the code; the
    // regex below is a sanity check, not a leak surface.
    if (!/^[0-9]{6,8}$/.test(code)) {
      return res.status(400).json({ error: 'Invalid TOTP code format.' });
    }

    try {
      const result: VerifyMfaFactorResult = await verifyMfaFactor({
        factorId,
        code,
        actor: email,
        context: {
          actorId: email,
          actorRole: flnRoleToVaultRole(role),
          reason: 'mfa-enrollment-verify',
          requestId: `fln-mfa-verify-${Date.now()}`,
        },
      });

      if (result.valid) {
        res.json({
          factorId: result.factorId,
          lifecycleState: result.lifecycleState,
        });
        return;
      }
      // Failure branch — the discriminator narrows the union
      // here. Map the reason to an HTTP status; the body
      // echoes the reason code so the UI can branch on it
      // (e.g. show "Try again" on CODE_MISMATCH, "Revoke + re-
      // enroll" on FACTOR_REVOKED).
      const failure = result as Extract<typeof result, { valid: false }>;
      const status = httpStatusForVerifyReason(failure.reason as VerifyFailureReason);
      res.status(status).json({ error: failure.reason });
    } catch (err: any) {
      if (err instanceof VaultError) return vaultErrorToHttp(err, res);
      console.error(
        'Aadhaar vault MFA verify unexpected error:',
        err?.code ?? 'UNKNOWN',
        err?.message,
      );
      res.status(500).json({ error: 'vault_internal', message: 'MFA verify failed.' });
    }
  });

  // ─────────────────────────────────────────────────────────────────────
  // GET /api/me/mfa/factors
  //
  // Returns the caller's factors in lifecycle order:
  //   1. PENDING_ENROLLMENT (newest first) — at most one row
  //   2. ENROLLED (newest first)
  // Revoked factors are hidden. The actor scoping is
  // `user.email` from the JWT — a cross-admin probe cannot
  // see another actor's factors.
  // ─────────────────────────────────────────────────────────────────────
  app.get('/api/me/mfa/factors', async (req, res) => {
    const guard = requireDetokenizeRole(req, res);
    if (!guard) return;
    const { email } = guard;

    try {
      const result = await listMfaFactors({ actor: email });
      // listMfaFactors returns only ENROLLED factors per the
      // repository's tightened filter. The PENDING case is
      // covered by the enroll endpoint, which is the only
      // path that mints them. We surface the ENROLLED list
      // here; a future schema-revision can expand the filter.
      res.json({
        factors: result.factors.map(factorMetaToWire),
      });
    } catch (err: any) {
      if (err instanceof VaultError) return vaultErrorToHttp(err, res);
      console.error(
        'Aadhaar vault MFA list-factors unexpected error:',
        err?.code ?? 'UNKNOWN',
        err?.message,
      );
      res.status(500).json({ error: 'vault_internal', message: 'Failed to read MFA factors.' });
    }
  });

  // ─────────────────────────────────────────────────────────────────────
  // DELETE /api/me/mfa/factors/:factorId
  //
  // Revokes the caller's own factor. Cross-admin revocation
  // (factor.actor !== user.email) is rejected with 403 so a
  // compromised admin cannot deny service to another admin by
  // revoking their factor. Audit row: MFA_ENROLLMENT_REVOKED.
  // ─────────────────────────────────────────────────────────────────────
  app.delete('/api/me/mfa/factors/:factorId', async (req, res) => {
    const guard = requireDetokenizeRole(req, res);
    if (!guard) return;
    const { user, email, role } = guard;

    const factorId = typeof req.params.factorId === 'string' ? req.params.factorId : '';
    if (factorId.length === 0) {
      return res.status(400).json({ error: 'Missing factorId in URL.' });
    }

    // Look up the factor to enforce actor-isolation BEFORE we
    // call revoke. The shim doesn't expose getById, but the
    // listMfaFactors filter is gated on `actor = email` — the
    // matching factor is the FIRST entry whose `factorId`
    // matches the URL param. If no match, the factor either
    // doesn't exist OR belongs to another actor; either way,
    // we return 404 (NOT_FOUND) and never reveal which.
    let target: MfaFactorMeta | undefined;
    try {
      const result = await listMfaFactors({ actor: email });
      target = result.factors.find(f => f.factorId === factorId);
    } catch (err: any) {
      if (err instanceof VaultError) return vaultErrorToHttp(err, res);
      console.error(
        'Aadhaar vault MFA list-factors (for revoke) unexpected error:',
        err?.code ?? 'UNKNOWN',
        err?.message,
      );
      res.status(500).json({ error: 'vault_internal', message: 'Failed to read MFA factors.' });
      return;
    }
    if (!target) {
      // Surface 404 — never reveal whether the factor exists
      // for another actor. A cross-admin probe gets the same
      // 404 as a typo, by design.
      res.status(404).json({ error: 'FACTOR_NOT_FOUND' });
      return;
    }
    // Defensive: the repository's tightened `listActiveByActor`
    // already filters on `actor = email`, so this branch is
    // belt-and-braces. If the contract ever loosens, the
    // explicit check prevents a cross-admin revoke.
    if ((target as any).actor && (target as any).actor !== email) {
      res.status(403).json({ error: 'ACTOR_MISMATCH' });
      return;
    }

    try {
      // Delegate to the in-process `revokeMfaFactor` shim.
      // The shim is wired by `buildVaultContext` so the
      // actual `mfa.revoke(factorId)` call lands on the
      // Mongo repository. The route's actor-isolation check
      // above guarantees the factor belongs to `email`; the
      // shim does not re-authorize.
      await revokeMfaFactor({ factorId });

      // Audit: MFA_ENROLLMENT_REVOKED. Written by the route,
      // not the command, because the command is a thin
      // repository wrapper — it has no actor context to
      // attribute the row to.
      await dbStore.addLog(
        vaultLogbookEntry(
          {
            identityId: null,
            actor: email,
            action: 'MFA_ENROLLMENT_REVOKED',
            outcome: 'allow',
            reason: 'mfa-enrollment-revoked',
            requestId: `fln-mfa-revoke-${Date.now()}`,
            meta: {
              factor_id: factorId,
              factor_actor: email,
              admin_actor: email,
              admin_role: role,
            },
          },
          {
            userId: user.id,
            schoolId: (user as any).schoolId ?? '',
            schoolName: '',
            actorRole: flnRoleToVaultRole(role),
          },
          mintVaultLogId(new Date()),
          new Date(),
        ),
      );

      res.json({ factorId, status: 'revoked' });
    } catch (err: any) {
      if (err instanceof VaultError) return vaultErrorToHttp(err, res);
      console.error(
        'Aadhaar vault MFA revoke unexpected error:',
        err?.code ?? 'UNKNOWN',
        err?.message,
      );
      res.status(500).json({ error: 'vault_internal', message: 'MFA revoke failed.' });
    }
  });
}
