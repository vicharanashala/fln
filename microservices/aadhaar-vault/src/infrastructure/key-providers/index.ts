/**
 * KeyManager factory.
 *
 * Application-layer code depends only on the `KeyManager` port; this
 * file is the single place where a `KEY_PROVIDER` env value maps to a
 * concrete adapter. To add `hashicorp-vault`, `sops-age`, or
 * `aws-kms`, drop a sibling implementation file in this directory
 * and add one switch arm.
 *
 * Production-safety guard (defense-in-depth):
 *   `config.ts` already refuses to boot with `KEY_PROVIDER=local-dev`
 *   in `NODE_ENV=production` unless the unsafe flag is set. We repeat
 *   the check here so unit tests that bypass `loadConfig` still trip
 *   on misconfiguration — there is no scenario where the factory
 *   should silently produce an unsafe adapter.
 */
import type { Logger } from '../../logger.js';
import type { KeyManager } from '../../application/ports/key-manager.js';
import type { Config } from '../../config.js';
import {
  LocalDevKeyManager,
  type LocalDevConfig,
} from './local-dev-key-manager.js';

export interface CreateKeyManagerOptions {
  config: Config;
  /** Optional — passed through to the adapter for the prod-override
   *  warning log. If omitted, the adapter logs nothing. */
  logger?: Logger;
}

export function createKeyManager(
  options: CreateKeyManagerOptions,
): KeyManager {
  const { config, logger } = options;
  const provider = config.KEY_PROVIDER ?? 'local-dev';

  // Production-safety guard (defense-in-depth; mirrors config.ts).
  // We re-check here because direct callers (tests) may construct with
  // hand-built Config objects that did not pass through loadConfig.
  if (config.NODE_ENV === 'production' && provider === 'local-dev') {
    const allowed =
      config.VAULT_ALLOW_UNSAFE_KEY_PROVIDER === true ||
      config.VAULT_ALLOW_UNSAFE_KEY_PROVIDER === 'true';
    if (!allowed) {
      throw new Error(
        '[aadhaar-vault] Refusing to construct LocalDevKeyManager in NODE_ENV=production. ' +
          'Set KEY_PROVIDER to a real KMS-backed provider, or set ' +
          'VAULT_ALLOW_UNSAFE_KEY_PROVIDER=true to acknowledge the risk. ' +
          'See AADHAAR_VAULT_FREE_ARCHITECTURE.md §5.1.',
      );
    }
  }

  switch (provider) {
    case 'local-dev': {
      const masterKeyB64 = config.LOCAL_DEV_MASTER_KEY;
      if (!masterKeyB64) {
        throw new Error(
          '[aadhaar-vault] KEY_PROVIDER=local-dev requires LOCAL_DEV_MASTER_KEY ' +
            '(32+ bytes, base64-encoded).',
        );
      }
      const masterKey = Buffer.from(masterKeyB64, 'base64');
      const acknowledgedUnsafe =
        config.VAULT_ALLOW_UNSAFE_KEY_PROVIDER === true ||
        config.VAULT_ALLOW_UNSAFE_KEY_PROVIDER === 'true';
      const adapterCfg: LocalDevConfig = {
        keyVersion: config.KEY_VERSION ?? 'kv-1',
        masterKey,
        acknowledgedUnsafe,
      };
      return new LocalDevKeyManager(adapterCfg, logger);
    }
    default:
      throw new Error(
        `[aadhaar-vault] Unknown KEY_PROVIDER "${provider}". ` +
          'Supported: local-dev.',
      );
  }
}

export { LocalDevKeyManager };