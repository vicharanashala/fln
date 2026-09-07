/**
 * KeyManager factory (simplified from
 * src/infrastructure/key-providers/index.ts).
 *
 * The original factory took a `Config` object built by a separate
 * `loadConfig()` step. In the merged module we read env vars directly
 * — this keeps the wiring to a single, obvious place. KMS-backed
 * providers (hashicorp-vault, aws-kms, etc.) are out of scope for the
 * merge; only `local-dev` is supported.
 *
 * Production-safety guard: refuse to construct the LocalDevKeyManager
 * in `NODE_ENV=production` unless `VAULT_ALLOW_UNSAFE_KEY_PROVIDER=true`
 * is explicitly set.
 */
import type { KeyManager } from '../../application/ports/key-manager';
import { LocalDevKeyManager, type LocalDevConfig } from './local-dev-key-manager';

export interface CreateKeyManagerOptions {
  logger?: { warn: (obj: unknown, msg: string) => void };
}

export function createKeyManager(options: CreateKeyManagerOptions = {}): KeyManager {
  const provider = process.env.KEY_PROVIDER ?? 'local-dev';

  if (provider !== 'local-dev') {
    throw new Error(
      `[vault] Unknown KEY_PROVIDER "${provider}". Supported: local-dev. ` +
        'KMS-backed providers are out of scope for the merged vault module.',
    );
  }

  if (
    process.env.NODE_ENV === 'production' &&
    process.env.VAULT_ALLOW_UNSAFE_KEY_PROVIDER !== 'true'
  ) {
    throw new Error(
      '[vault] Refusing to construct LocalDevKeyManager in NODE_ENV=production. ' +
        'Set KEY_PROVIDER to a real KMS-backed provider, or set ' +
        'VAULT_ALLOW_UNSAFE_KEY_PROVIDER=true to acknowledge the risk.',
    );
  }

  const masterKeyB64 = process.env.LOCAL_DEV_MASTER_KEY;
  if (!masterKeyB64) {
    throw new Error(
      '[vault] KEY_PROVIDER=local-dev requires LOCAL_DEV_MASTER_KEY ' +
        '(32+ bytes, base64-encoded).',
    );
  }
  const masterKey = Buffer.from(masterKeyB64, 'base64');
  const acknowledgedUnsafe = process.env.VAULT_ALLOW_UNSAFE_KEY_PROVIDER === 'true';
  const adapterCfg: LocalDevConfig = {
    keyVersion: process.env.KEY_VERSION ?? 'kv-1',
    masterKey,
    acknowledgedUnsafe,
  };
  return new LocalDevKeyManager(adapterCfg, options.logger);
}

export { LocalDevKeyManager };
