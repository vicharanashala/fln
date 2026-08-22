/**
 * Health routes.
 *
 * Architecture doc §6 mandates three probes with distinct semantics:
 *   - GET /health       — generic liveness payload, never fails.
 *   - GET /health/live  — Kubernetes-style liveness; returns 200 always.
 *   - GET /health/ready — Kubernetes-style readiness; reports dependency status.
 *
 * All three probes are PUBLIC by design — kubelet does not carry bearer
 * tokens, and the auth plugin must not 401 a liveness check that gates
 * the pod. The `{ public: true }` route config is the single source of
 * truth for the allow-list (see auth/plugin.ts). Adding a future probe
 * that DOES need auth must drop the `public: true` flag.
 *
 * Session 2 wired the Postgres ping. Session 3 added the key-provider
 * readiness check alongside it — verifying that `app.keyManager.info()`
 * returns a non-empty `currentVersion`.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { KeyManager } from '../application/ports/key-manager.js';

export type KeyProviderStatus = 'ok' | 'down' | 'not-configured';

export interface HealthDeps {
  version: string;
  /**
   * Used by `/health/ready` to decide whether to return 200 or 503.
   * Should resolve `true` only when every dependency it owns is healthy.
   * The plugin **does not** throw on `false` — the route returns 503
   * with the reason inline.
   */
  isReady: () => Promise<boolean>;
  /**
   * Resolves the current KeyManager instance from the Fastify server.
   * Returned synchronously because wiring happens at boot; we keep the
   * shape as a function so future lazy composition is friction-free.
   */
  keyManager: () => KeyManager | undefined;
}

export const healthRoutes: FastifyPluginAsync<{ deps: HealthDeps }> = async (
  app: FastifyInstance,
  { deps },
) => {
  app.get(
    '/health',
    { config: { public: true } },
    async () => ({
      status: 'ok',
      service: 'aadhaar-vault',
      version: deps.version,
      timestamp: new Date().toISOString(),
    }),
  );

  app.get(
    '/health/live',
    { config: { public: true } },
    async () => ({ status: 'alive' }),
  );

  app.get(
    '/health/ready',
    { config: { public: true } },
    async (_req, reply) => {
      const ok = await deps.isReady();
      const keyStatus: KeyProviderStatus = (() => {
        const km = deps.keyManager();
        if (!km) return 'not-configured';
        const info = km.info();
        if (!info || !info.currentVersion || info.currentVersion.length === 0) {
          return 'down';
        }
        return 'ok';
      })();

      if (!ok || keyStatus !== 'ok') {
        reply.code(503);
        return {
          status: 'not_ready',
          checks: {
            postgres: ok ? 'ok' : 'unreachable',
            keyProvider: keyStatus,
          },
        };
      }
      return {
        status: 'ready',
        checks: {
          postgres: 'ok',
          keyProvider: 'ok',
        },
      };
    },
  );
};

export default healthRoutes;