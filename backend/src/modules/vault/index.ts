/**
 * VAULT MODULE — REGISTRATION ENTRY
 *
 * Sole public surface of the in-process vault module.
 *
 * Phase 2 (this revision):
 *   - `registerVaultRoutes` builds the wired vault context from
 *     `dbStore.getDb()` + `mongoClient` and stashes it on
 *     `app.locals.vaultContext`.
 *   - Registers `POST /v1/tokenize` as an Express route. The route
 *     delegates to the in-process `makeTokenizeAadhaar` command.
 *   - Installs the in-process tokenize implementation on
 *     `aadhaarVault.ts` so existing call sites (student
 *     registration, bulk import) transparently route through the
 *     module.
 *   - If `dbStore.getDb()` returns `null` (file-fallback dev mode,
 *     test environments without Mongo), the module logs a warning
 *     and registers the route as a 503 stub. The legacy HTTP path
 *     on `aadhaarVault.ts` remains the only working tokenize.
 *
 * The full lifecycle (Phase 3 → Phase 7) progressively adds:
 *   - Phase 3: detokenize (POST /v1/detokenize) + audit (GET /v1/audit)
 *   - Phase 4: step-up request/approve + MFA enroll/verify
 *   - Phase 5: console static mount at /console/ (DROPPED 2026-09-01
 *              per user direction — admin Step-Up flow is implemented
 *              directly against the main backend, so the standalone
 *              console UI is not needed)
 *   - Phase 6: graceful shutdown surface
 *              (`getActiveVaultTransactionCount`,
 *              `waitForVaultTransactionsDrain`) re-exported here so
 *              the boot script in `backend/src/index.ts` can drive
 *              the shutdown sequence without reaching into
 *              implementation paths.
 *   - Phase 7: drop the VAULT_MODULE_ENABLED flag entirely
 */
import type { Express, Request, Response } from 'express';
import express from 'express';
import { dbStore } from '../../db';
import { buildVaultContext, type VaultContext } from './context';
import { registerTokenizeRoute } from './routes/tokenize.routes';
import { registerDetokenizeRoute } from './routes/detokenize.routes';
import { registerAuditRoute } from './routes/audit.routes';
import { registerMfaEnrollRoute } from './routes/mfa-enroll.routes';
import { registerStepUpRequestRoute } from './routes/step-up-request.routes';
import { registerStepUpApproveRoute } from './routes/step-up-approve.routes';
import { requireScope } from './middleware';
import {
  getActiveCount as getActiveVaultTransactionCount,
  waitForDrain as waitForVaultTransactionsDrain,
} from './infrastructure/db/vault-transaction-counter';

// Augment Express's `Application` so the wired vault context can be
// read off `req.app.vaultContext` without `any`. We deliberately
// don't touch `Application.locals` (its type is a TS-private merge
// in @types/express and conflicts with a same-name augmentation).
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Application {
      vaultContext?: VaultContext | null;
    }
  }
}

export interface VaultModuleOptions {
  // Reserved for future phases — explicit dep injection (a real
  // MongoClient handle, test fakes) for callers that need to bypass
  // the `dbStore.getDb()` global. Phase 2 always uses the global.
  dbOverride?: never;
}

export async function registerVaultRoutes(
  app: Express,
  _opts: VaultModuleOptions = {},
): Promise<void> {
  const db = dbStore.getDb();
  // The `Db` carries a reference to its parent `MongoClient` on
  // `db.client`. Using that (rather than the global `mongoClient`
  // export) means the same connection the rest of the FLN backend
  // uses is the one that the vault's transactional writer opens
  // sessions on — they share the connection pool.
  const client = db?.client ?? null;
  const logger = {
    info: (obj: unknown, msg?: string) => console.log(msg ?? '', obj),
    warn: (obj: unknown, msg?: string) => console.warn(msg ?? '', obj),
  };

  const built = await buildVaultContext({ db, client, logger });
  const wiredCtx: VaultContext | null = built.ctx;
  const failureReason: string | undefined = built.failureReason;
  const failureError: Error | undefined = built.failureError;

  if (!wiredCtx) {
    console.warn(
      `[vault] Module NOT wired: ${failureReason}` +
        (failureError ? ` — ${failureError.message}` : ''),
    );
  } else {
    console.log(
      `[vault] Module wired — keyManager=${wiredCtx.keyManagerInfo.provider}` +
        ` v${wiredCtx.keyManagerInfo.currentVersion}`,
    );
  }
  app.vaultContext = wiredCtx;

  // Health probe — used by container readiness checks and the
  // Phase 5 console's polling client.
  app.get('/health', (_req: Request, res: Response) => {
    if (wiredCtx) {
      res.json({ status: 'ok' });
    } else {
      res.json({ status: 'degraded', reason: failureReason });
    }
  });

  // Vault v1 routes. The router is mounted at the app root so the
  // paths match the legacy contract (`/v1/tokenize`, etc.).
  const router = express.Router();
  registerTokenizeRoute(router, app.vaultContext ?? null);
  registerDetokenizeRoute(router, app.vaultContext ?? null);
  registerAuditRoute(router, app.vaultContext ?? null);
  // Phase 4: step-up + MFA + verifier routes. The tokenize /
  // detokenize routes are the only ones actively used by the
  // current FLN frontend; the step-up + MFA routes preserve the
  // microservice's external HTTP contract for any future
  // internal caller / monitoring / debugging.
  registerMfaEnrollRoute(router, app.vaultContext ?? null);
  registerStepUpRequestRoute(router, app.vaultContext ?? null);
  registerStepUpApproveRoute(router, app.vaultContext ?? null);
  app.use(router);

  // Console readiness — Phase 5 mounts the static assets here. The
  // prefix is reserved now so /health / /console/* paths in
  // `requireScope` can short-circuit cleanly.
  void requireScope; // keep import live for future phases
}

// Re-exported so the boot script (`backend/src/index.ts`) can drive
// the graceful-shutdown sequence without reaching into private
// implementation paths. The names are stable; the underlying
// counter is process-local.
//
//   - getActiveVaultTransactionCount() — number of in-flight
//     `session.withTransaction` blocks right now. Mostly used by
//     tests; the boot script uses it to log how many writes are
//     still pending at shutdown start.
//   - waitForVaultTransactionsDrain(timeoutMs) — resolves with
//     `true` when the count reaches zero, `false` on timeout. The
//     boot script calls this in the shutdown sequence so a
//     SIGTERM does not orphan an in-flight multi-document write.
export {
  getActiveVaultTransactionCount,
  waitForVaultTransactionsDrain,
};
