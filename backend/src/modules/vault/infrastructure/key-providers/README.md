# infrastructure/key-providers

## Overview
Selects and implements the `KeyManager` that wraps per-record DEKs and seals MFA secrets.

## Interface
- `index.ts`: `createKeyManager({logger?}) -> KeyManager`; re-exports `LocalDevKeyManager`; also exports the `CreateKeyManagerOptions` type (`{logger?}`).
- `local-dev-key-manager.ts`: `LocalDevKeyManager(cfg: {keyVersion, masterKey, acknowledgedUnsafe}, logger?)` with `info()`, `generateDataKey`, `wrapDataKey`, `unwrapDataKey`, `sealSecret`, `openSecret`. `LocalDevConfig` (that constructor's config type) is also exported.

## Invariants
- Env contract: `KEY_PROVIDER` defaults to `local-dev` and any other value throws. In `NODE_ENV=production` construction throws unless `VAULT_ALLOW_UNSAFE_KEY_PROVIDER=true`. `LOCAL_DEV_MASTER_KEY` (base64) is required; `KEY_VERSION` defaults to `kv-1`. The master key is not length-checked beyond non-empty (the factory's error text says "32+ bytes" but nothing enforces it).
- Wrapping: subkey = HKDF-SHA256(masterKey, salt = context, info = `aadhaar-vault/dek-wrap`), 32 bytes; blob layout = `iv(12) | tag(16) | ciphertext` (AES-256-GCM). An empty context falls back to a fixed salt.
- Contexts are `wrap:<identityId>` for DEKs and `mfa-factor:<factorId>` for secrets. A wrong context derives a different subkey, so unwrap/open fails with an integrity error.
- DEK is 32 random bytes. `unwrapDataKey` rejects wrong length and zeroes it.
- The key version is a label only: the wrapped blob does not embed it, so changing `KEY_VERSION` with the same master key does not re-key; changing the master key makes existing data unreadable (`UNWRAP_FAILED`).
- Master key lives in process memory; this provider is explicitly not production-grade (no KMS).

## Side Effects
- Reads `process.env`. Logs `vault.key.local-dev.acknowledged-unsafe` via logger when the unsafe flag is set.

## Verification
- Run: `npm test --workspace @fln/backend` (see also `tests/vault-config.test.ts` in the backend package)
