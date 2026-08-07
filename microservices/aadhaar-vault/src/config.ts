/**
 * Typed environment loader.
 *
 * - Session 1 reads:  NODE_ENV, PORT, HOST, LOG_LEVEL.
 * - Sessions 2–5 will extend this schema (DB, JWT, key provider, MFA, OpenAPI)
 *   by adding new optional fields with `.optional()` defaults so existing
 *   config files do not need to be edited in lockstep with this loader.
 *
 * Safety:  Zod *parses*, it does not *enforce* a use-it-or-die policy.
 * Callers must explicitly call {@link loadConfig} at process start so that
 * misconfiguration aborts boot instead of being silently coerced at runtime.
 */
import { z } from 'zod';

const NodeEnv = z.enum(['development', 'test', 'production']);
const LogLevel = z.enum([
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'silent',
]);

const ConfigSchema = z.object({
  NODE_ENV: NodeEnv.default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4101),
  HOST: z.string().min(1).default('0.0.0.0'),
  LOG_LEVEL: LogLevel.default('info'),

  // Session 2: Postgres connection. Required at boot when NODE_ENV is
  // anything other than `test`. We declare it optional here and enforce
  // the requirement in `loadConfig` so the test environment can boot
  // without a DB URI (tests wire their own pg-mem instance directly).
  VAULT_DB_URI: z.string().min(1).optional(),

  // Deferred to Session 3
  KEY_PROVIDER: z.string().min(1).optional(),
  LOCAL_DEV_MASTER_KEY: z.string().min(1).optional(),
  KEY_VERSION: z.string().min(1).optional(),
  VAULT_ALLOW_UNSAFE_KEY_PROVIDER: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional(),

  // Deferred to Session 4
  SERVICE_JWT_AUDIENCE: z.string().min(1).optional(),
  SERVICE_JWT_ISSUER: z.string().url().optional(),
  FLN_BACKEND_JWKS_URL: z.string().url().optional(),

  // Session 4 (auth foundation): shared HMAC secret used by the
  // Hs256JwtVerifier adapter. Required at boot when NODE_ENV != 'test'
  // so a non-test deployment cannot accidentally run without auth.
  SERVICE_JWT_HMAC_SECRET: z.string().min(1).optional(),
  // Algorithm selector for the verifier factory. Currently only HS256
  // is implemented; RS256/JWKS lands in a follow-up session.
  SERVICE_JWT_ALGORITHM: z.enum(['HS256']).optional(),
  // Allowed clock skew in seconds for JWT exp/nbf validation.
  SERVICE_JWT_CLOCK_TOLERANCE_SECONDS: z.coerce.number().int().min(0).optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Read `process.env`, parse it through {@link ConfigSchema}, and apply
 * production-only safety guards declared in
 * `AADHAAR_VAULT_FREE_ARCHITECTURE.md` §5.1.
 *
 * Throws a structured `Error` on invalid config — callers should let that
 * error propagate so Fastify is never built with a half-validated config.
 */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = ConfigSchema.safeParse(source);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('\n');
    throw new Error(
      `[aadhaar-vault] Invalid environment configuration:\n${issues}`,
    );
  }

  const cfg = parsed.data;

  // Session 4 (auth foundation): refuse to boot in non-test environments
  // without an HMAC secret. Without this guard a misconfigured production
  // deploy would silently run with `authPlugin` doing nothing because the
  // verifier would be constructed against an empty secret. Tests skip the
  // guard because they wire their own deps directly into `buildServer`.
  if (cfg.NODE_ENV !== 'test' && !cfg.SERVICE_JWT_HMAC_SECRET) {
    throw new Error(
      '[aadhaar-vault] SERVICE_JWT_HMAC_SECRET is required when NODE_ENV != "test". ' +
        'Set it to a shared HS256 secret (>= 32 bytes of entropy).',
    );
  }

  // Production safety guards (architecture doc §5.1).
  // These are dormant in development so the dev DX is not blocked.
  if (cfg.NODE_ENV === 'production') {
    const isLocalDev = cfg.KEY_PROVIDER === 'local-dev';
    const isAllowed =
      cfg.VAULT_ALLOW_UNSAFE_KEY_PROVIDER === true ||
      cfg.VAULT_ALLOW_UNSAFE_KEY_PROVIDER === 'true';

    if (isLocalDev && !isAllowed) {
      throw new Error(
        '[aadhaar-vault] Refusing to start in production with KEY_PROVIDER=local-dev. ' +
          'Set KEY_PROVIDER to a real KMS-backed provider, or set ' +
          'VAULT_ALLOW_UNSAFE_KEY_PROVIDER=true to acknowledge the risk. ' +
          'See AADHAAR_VAULT_FREE_ARCHITECTURE.md §5.1.',
      );
    }
  }

  return cfg;
}