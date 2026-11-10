// ==========================================
// VAULT MODULE — SCOPE GATE MIDDLEWARE
// ==========================================
// Express middleware that gates a vault route by required scope.
//
// Nothing in the repository calls the /v1 vault routes over HTTP (the admin
// UI reaches the vault in-process through backend/src/aadhaarVault.ts), and
// no service-JWT scopes are issued, so every vault scope is restricted to
// SUPERADMIN users authenticated by getAuthUser. The resolved caller is
// stored on `res.locals` (see session-context.ts) and is the only source of
// the actor identity the routes pass to the commands.
//
// Reuses getAuthUser from backend/src/auth.ts — never reimplement JWT
// verification. The vault module is one consumer of the FLN auth model.
import type { Request, Response, NextFunction } from 'express';
import { getAuthUser } from '../../auth';
import { UserRole } from '../../db';
import { setVaultSessionActor } from './session-context';

export type VaultScope =
  | 'vault:tokenize'    // POST /v1/tokenize
  | 'vault:mfa:enroll'  // POST /v1/mfa/enroll
  | 'vault:mfa:verify'  // POST /v1/mfa/verify
  | 'vault:detokenize'  // POST /v1/detokenize, /v1/detokenize/request, /v1/detokenize/step-up/:id/approve
  | 'vault:audit';      // GET  /v1/audit

// requireScope(scope) — Express middleware factory.
// On failure: 401 (no auth) or 403 (not a SUPERADMIN), both as VaultError JSON.
// Every scope currently has the same rule, so the scope argument only names
// the route being protected.
export function requireScope(scope: VaultScope) {
  void scope;
  return function vaultScopeGate(req: Request, res: Response, next: NextFunction): void {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    if (user.role !== UserRole.SUPERADMIN) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Superadmin access required' });
      return;
    }

    setVaultSessionActor(res, {
      actorId: user.email,
      actorRole: 'SUPER_ADMIN',
      userId: user.id,
      schoolId: user.schoolId ?? '',
    });
    next();
  };
}
