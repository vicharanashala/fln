// Admin detokenization routes — Step-Up workflow for revealing plaintext Aadhaar.
//
// Phase 2 of the Aadhaar Vault integration (commit 50fa99c) wired
// `tokenizeAadhaar()` into the registration path. This module wires the
// REVERSE path — an authorized admin (SUPERADMIN / ADMIN / DISTRICT_ADMIN /
// BLOCK_ADMIN) with a verified MFA factor can recover the plaintext Aadhaar
// for a student they are permitted to access, in order to correct enrollment
// mistakes, comply with audit/legal requests, or print official reports.
//
// # Security model
//
//   1. The browser NEVER holds a vault credential. Every vault call here
//      runs entirely in-process (backend/src/modules/vault/) — there is
//      no service-to-service JWT to mint or verify.
//   2. The browser NEVER directly authenticates to the vault. The browser
//      only talks to this Express layer.
//   3. Plain tokenization (registration) does NOT require MFA. Detokenization
//      here goes through the vault's three-stage Step-Up workflow:
//        (a) `enrollMfa`           — the admin enrolls a TOTP factor ONCE
//                                    (returning admins reuse the existing
//                                    factor; see `alreadyEnrolled` below)
//        (b) `requestStepUp`       — mints a challenge bound to that factor
//        (c) `approveStepUp`       — admin submits the TOTP code
//        (d) `detokenize`          — consumes the approved challenge
//   4. Backend authorization happens BEFORE any vault call. `canAccessStudent`
//      gates the request — a TEACHER cannot request detokenization for a
//      student in another school.
//   5. The vault token id is RESOLVED FROM THE AUTHORIZED STUDENT RECORD.
//      The browser NEVER supplies a tokenId or challengeId to the detokenize
//      endpoint. The client supplies only the student id and the TOTP code.
//      The backend reads the student's `aadhaarTokenId` from MongoDB, runs
//      authorization, and proxies to the vault. The user CANNOT supply an
//      arbitrary token to bypass authorization.
//   6. Plaintext Aadhaar is NEVER persisted in FLN. The detokenize response is
//      the ONLY time the backend ever returns plaintext; the route returns it
//      to the browser and the browser MUST auto-clear it (60s timer + on
//      dialog close). It never enters MongoDB, never enters logs.
//   7. TOTP secrets are NEVER stored in the FLN database. They live only in
//      the vault (encrypted at rest) and in the admin's authenticator app
//      (via the `otpauth://` URI returned from `enrollMfa`). They are
//      NEVER returned over the wire on subsequent reveals — only the
//      `factorId` of an existing factor is echoed back, and only on the
//      FIRST enrollment is the `otpauthUri` sent.
//
// # Why these routes live separately from students.ts
//
//   students.ts is the existing route module and is still in the
//   god-file-replacement phase (MIGRATION_PLAN.md). Per the migration
//   rules, we add new domain logic in a new module rather than expanding
//   the existing one.

import express from 'express';
import { dbStore, UserRole } from '../db';
import { getAuthUser, canAccessStudent } from '../auth';
import {
  requestDetokenization,
  approveStepUpChallenge,
  detokenizeAadhaar,
  listMfaFactors,
  VaultError,
  type RequestDetokenizationResult,
  type ApproveStepUpResult,
  type DetokenizeResult,
} from '../aadhaarVault';

// Roles that may drive the Step-Up detokenization workflow. Per security
// rule (4) above: these are the aggregate-scope admin roles. TEACHER /
// SCHOOL / VOLUNTEER do NOT have detokenization rights — their day-to-day
// workflow never needs plaintext Aadhaar.
const DETOKENIZE_ROLES: readonly UserRole[] = [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.DISTRICT_ADMIN,
  UserRole.BLOCK_ADMIN,
];

/** Map FLN UserRole → Vault ActorRoleEnum (vault route Zod schema). The
 *  vault enum is intentionally narrower than FLN's hierarchy. We collapse
 *  FLN ADMIN / DISTRICT_ADMIN / BLOCK_ADMIN into STATE_ADMIN (they all
 *  operate at the state or sub-state level in this codebase — none is
 *  a "TEACHER" / "SCHOOL_ADMIN" / "SERVICE"). SUPERADMIN → SUPER_ADMIN.
 */
function flnRoleToVaultRole(role: UserRole): 'SUPER_ADMIN' | 'STATE_ADMIN' | 'SERVICE' {
  if (role === UserRole.SUPERADMIN) return 'SUPER_ADMIN';
  if (role === UserRole.ADMIN || role === UserRole.DISTRICT_ADMIN || role === UserRole.BLOCK_ADMIN) {
    return 'STATE_ADMIN';
  }
  // SERVICE is never assigned to an end-user — it is the fallback for any
  // unexpected caller. The detokenize endpoints above restrict to admin
  // roles only, so this branch is purely defensive.
  return 'SERVICE';
}

/** Shared gate. Returns the resolved student on success, or sends the
 *  appropriate error reply and returns null. The student is returned with
 *  its vault fields (`aadhaarTokenId`, `aadhaarIdentityId`) intact because
 *  the detokenize endpoints below need them. The HTTP response itself
 *  still goes through the PublicStudent strip where appropriate.
 */
async function authorizeAndResolveStudent(
  req: express.Request,
  res: express.Response,
  studentId: string,
): Promise<Awaited<ReturnType<typeof dbStore.getStudentById>> | null> {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  if (!DETOKENIZE_ROLES.includes(user.role)) {
    res.status(403).json({ error: 'Forbidden — detokenization requires an admin role.' });
    return null;
  }
  const student = await dbStore.getStudentById(studentId);
  if (!student) {
    res.status(404).json({ error: 'Student not found.' });
    return null;
  }
  // IDOR-safe: admin can only act on students within their scope.
  if (!canAccessStudent(user, student)) {
    // Deliberately not "student not found" — that would mask the IDOR
    // surface. The admin already knows the id exists; telling them they
    // can't act on it is the intended UX.
    res.status(403).json({ error: 'Forbidden — student is outside your scope.' });
    return null;
  }
  if (!student.aadhaarTokenId) {
    // Student was registered before the vault was wired, or tokenization
    // somehow returned an empty token. Either way: nothing to detokenize.
    res.status(409).json({
      error: 'Student has no vault token — registration may predate the vault integration.',
    });
    return null;
  }
  return student;
}

/** Translates a VaultError into the HTTP status the client should render.
 *  Status codes are chosen to mirror the vault's own route table — clients
 *  can react to the same set of error codes regardless of which proxy layer
 *  surfaced them. The response body is a small stable envelope:
 *  `{ error: <vault code | 'vault_<transport>'>, message: <safe string> }`.
 *  Messages NEVER contain the raw Aadhaar, token, or TOTP code.
 */
function vaultErrorToHttp(err: VaultError, res: express.Response): void {
  // Map VaultError.status (which already mirrors the vault HTTP) straight
  // through — the vault's own ERROR_STATUS tables are the source of truth.
  res.status(err.status >= 400 && err.status < 600 ? err.status : 500).json({
    error: err.code,
    message: err.message,
  });
}

export function registerAadhaarDetokenizeRoutes(app: express.Express): void {
  // ─────────────────────────────────────────────────────────────────────────
  // 0. GET /api/students/:id/aadhaar/mfa/me
  //
  //    DEPRECATED (Wave 2A): this per-student surface is replaced by
  //    the account-level `/api/me/mfa/factors` route. The handler
  //    responds `410 Gone` with the new endpoint's URL so any open
  //    browser tab during deployment redirects cleanly. The route
  //    itself is preserved (not deleted) — see MIGRATION_PLAN.md for
  //    the deferred cleanup phase.
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/students/:id/aadhaar/mfa/me', (_req, res) => {
    res.status(410).json({
      error: 'MOVED',
      newEndpoint: '/api/me/mfa/factors',
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. POST /api/students/:id/aadhaar/mfa/enroll
  //
  //    DEPRECATED (Wave 2A): replaced by the account-level
  //    `/api/me/mfa/enroll` route. The handler responds `410 Gone`
  //    with the new endpoint's URL. The enrollment surface is
  //    account-level — there is no studentId in the URL anymore,
  //    because the authenticator app belongs to the admin, not the
  //    student.
  // ─────────────────────────────────────────────────────────────────────────
  app.post('/api/students/:id/aadhaar/mfa/enroll', (_req, res) => {
    res.status(410).json({
      error: 'MOVED',
      newEndpoint: '/api/me/mfa/enroll',
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. POST /api/students/:id/aadhaar/step-up/request
  //
  //    Body: `{ factorId }` — the admin supplies ONLY the factor id they
  //    enrolled with. The backend resolves the student's vault token id
  //    from MongoDB (NOT from the body) and mints a challenge.
  //
  //    NEW (Wave 2A): the route refuses to mint a step-up challenge
  //    unless the caller has at least one `ENROLLED` factor. A
  //    `PENDING_ENROLLMENT` factor (just minted, awaiting first
  //    verify) is NOT eligible for step-up — the admin must complete
  //    enrollment first. This preserves the hard invariant: the
  //    step-up path does NOT mint factors; it only SELECTS an
  //    existing ENROLLED factor.
  // ─────────────────────────────────────────────────────────────────────────
  app.post('/api/students/:id/aadhaar/step-up/request', async (req, res) => {
    const student = await authorizeAndResolveStudent(req, res, req.params.id);
    if (!student) return;

    const user = getAuthUser(req)!;
    const requestedFactorId = typeof req.body?.factorId === 'string' ? req.body.factorId : '';
    if (requestedFactorId.length === 0) {
      return res.status(400).json({ error: 'Missing factorId in request body.' });
    }

    // Preflight: the caller must have at least one ENROLLED
    // factor. We do this BEFORE the vault call so a 403 surfaces
    // fast and never reaches `requestDetokenization` (which would
    // then call `mfa.getById` and surface a different code). The
    // explicit factorId-in-body check below is belt-and-braces:
    // a malicious admin could supply a PENDING_ENROLLMENT factor
    // id from the response of the new /api/me/mfa/enroll endpoint.
    try {
      const factorsResult = await listMfaFactors({ actor: user.email });
      const enrolled = factorsResult.factors.find(
        (f) => (f as any).lifecycleState === 'ENROLLED',
      );
      if (!enrolled) {
        return res.status(403).json({ error: 'MFA_NOT_ENROLLED' });
      }
      // The factor id in the body must match the caller's
      // ENROLLED factor. This is the cross-admin attack guard
      // for step-up — a compromised admin cannot reuse a
      // PENDING_ENROLLMENT factor id (or another admin's
      // factor id) to mint a challenge.
      if (enrolled.factorId !== requestedFactorId) {
        return res.status(403).json({ error: 'MFA_NOT_ENROLLED' });
      }
      const factorId = enrolled.factorId;

      const result: RequestDetokenizationResult = await requestDetokenization({
        tokenId: student.aadhaarTokenId!, // validated non-null in authorizeAndResolveStudent
        factorId,
        context: {
          email: user.email,
          actorRole: flnRoleToVaultRole(user.role),
          requestId: `fln-stepup-req-${Date.now()}`,
        },
      });
      res.json(result);
    } catch (err: any) {
      if (err instanceof VaultError) return vaultErrorToHttp(err, res);
      console.error('Aadhaar vault step-up request unexpected error:', err?.code ?? 'UNKNOWN', err?.message);
      res.status(500).json({ error: 'vault_internal', message: 'Step-up request failed.' });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. POST /api/students/:id/aadhaar/step-up/approve
  //
  //    Body: `{ challengeId, code }`. The backend verifies the challenge
  //    was minted for this student (not strictly required — the vault does
  //    its own actor-binding — but a defensive lookup prevents a malicious
  //    admin from approving a challenge minted by someone else for a
  //    different student). The TOTP code is forwarded to the vault and
  //    NEVER logged.
  // ─────────────────────────────────────────────────────────────────────────
  app.post('/api/students/:id/aadhaar/step-up/approve', async (req, res) => {
    const student = await authorizeAndResolveStudent(req, res, req.params.id);
    if (!student) return;

    const user = getAuthUser(req)!;
    const challengeId = typeof req.body?.challengeId === 'string' ? req.body.challengeId : '';
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    if (challengeId.length === 0 || code.length === 0) {
      return res.status(400).json({ error: 'Missing challengeId or code in request body.' });
    }
    if (!/^[0-9]{6,10}$/.test(code)) {
      return res.status(400).json({ error: 'Invalid TOTP code format.' });
    }

    try {
      const result: ApproveStepUpResult = await approveStepUpChallenge({
        challengeId,
        code,
        context: {
          email: user.email,
          actorRole: flnRoleToVaultRole(user.role),
          requestId: `fln-stepup-approve-${Date.now()}`,
        },
      });
      res.json(result);
    } catch (err: any) {
      if (err instanceof VaultError) return vaultErrorToHttp(err, res);
      console.error('Aadhaar vault step-up approve unexpected error:', err?.code ?? 'UNKNOWN', err?.message);
      res.status(500).json({ error: 'vault_internal', message: 'Step-up approval failed.' });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. POST /api/students/:id/aadhaar/detokenize
  //
  //    Body: `{ challengeId }`. Consumes the APPROVED challenge and returns
  //    plaintext Aadhaar. The challengeId is the ONLY detokenize input from
  //    the client — the backend resolves the student's vault token id from
  //    MongoDB. The user CANNOT supply a tokenId to bypass authorization.
  // ─────────────────────────────────────────────────────────────────────────
  app.post('/api/students/:id/aadhaar/detokenize', async (req, res) => {
    const student = await authorizeAndResolveStudent(req, res, req.params.id);
    if (!student) return;

    const user = getAuthUser(req)!;
    const challengeId = typeof req.body?.challengeId === 'string' ? req.body.challengeId : '';
    if (challengeId.length === 0) {
      return res.status(400).json({ error: 'Missing challengeId in request body.' });
    }

    try {
      const result: DetokenizeResult = await detokenizeAadhaar({
        challengeId,
        context: {
          email: user.email,
          actorRole: flnRoleToVaultRole(user.role),
          requestId: `fln-detokenize-${Date.now()}`,
        },
      });

      // Audit. We log the vault's auditId (opaque) + the FLN admin id
      // + the student id. NEVER log the plaintext Aadhaar or the TOTP code.
      await dbStore.addLog({
        id: 'log_' + Date.now(),
        timestamp: new Date().toISOString(),
        schoolId: student.schoolId,
        schoolName: 'GPS',
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        activityType: 'verify',
        status: 'Success',
        details: `Admin detokenized Aadhaar for ${student.name} (studentId=${student.id}, vaultAuditId=${result.auditId}).`,
      });

      // Return plaintext + minimal envelope. The frontend is responsible for
      // clearing `aadhaar` after a short auto-clear window and on dialog close.
      // We do NOT include the mask — the caller already knows the mask; the
      // point of this endpoint is to reveal the full number.
      res.json({
        aadhaar: result.aadhaar,
        last4: result.last4,
        auditId: result.auditId,
        // Echo the mask (XXXX-XXXX-1234) for client-side confirmation that
        // they're looking at the right record. Never echo token / identityId.
        aadharMasked: `XXXX-XXXX-${result.last4}`,
      });
    } catch (err: any) {
      if (err instanceof VaultError) return vaultErrorToHttp(err, res);
      console.error('Aadhaar vault detokenize unexpected error:', err?.code ?? 'UNKNOWN', err?.message);
      res.status(500).json({ error: 'vault_internal', message: 'Detokenization failed.' });
    }
  });
}
