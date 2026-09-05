// ==========================================
// VAULT MODULE — SCOPE GATE MIDDLEWARE (Phase 1 stub)
// ==========================================
// Express middleware that gates a vault route by required scope. In Phase 1
// this is a stub that authenticates via getAuthUser (so the import chain and
// error path are exercised) but does NOT yet check scopes (that lands in
// Phase 2 alongside the real service-JWT verifier).
//
// Reuses getAuthUser from backend/src/auth.ts — never reimplement JWT
// verification. The vault module is one consumer of the FLN auth model.
import type { Request, Response, NextFunction } from 'express';
import { getAuthUser } from '../../auth';

// Service-to-service scopes. The FLN backend is the only caller of the vault.
// In Phase 2 these scopes are embedded in a service JWT minted by
// backend/src/aadhaarVault.ts:buildVaultServiceJwt() and verified by the
// JoseJwtVerifier (infrastructure/auth/jwt-verifier.ts).
export type VaultScope =
  | 'vault:tokenize'    // POST /v1/tokenize
  | 'vault:mfa:enroll'  // POST /v1/mfa/enroll
  | 'vault:mfa:verify'  // POST /v1/mfa/verify
  | 'vault:detokenize'  // POST /v1/detokenize, /v1/detokenize/request, /v1/detokenize/step-up/:id/approve
  | 'vault:audit';      // GET  /v1/audit

// Paths that bypass auth. Mirrors the vault's publicUrlPrefixes
// (src/server.ts:386). The /console/* prefix is
// used by the developer UI (Phase 5); /health/* are the readiness probes.
const PUBLIC_PATH_PREFIXES = ['/console/', '/health'];

function isPublicPath(path: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(p => path === p || path.startsWith(p));
}

// requireScope(scope) — Express middleware factory.
// On failure: 401 (no auth) or 403 (wrong scope), both as VaultError JSON.
export function requireScope(scope: VaultScope) {
  return function vaultScopeGate(req: Request, res: Response, next: NextFunction): void {
    if (isPublicPath(req.path)) return next();

    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    // Phase 1 stub: any authenticated user passes. Phase 2 replaces this
    // with a real service-JWT verifier that reads the principal.scopes set
    // off the Bearer token. Until then, the scope parameter is unused.
    void scope;
    next();
  };
}
