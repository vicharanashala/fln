/**
 * LocalDevKeyManager unit tests (Session 3).
 *
 * Coverage matrix (8 cases):
 *  1.  round-trip           — generate + unwrap returns the same DEK bytes
 *  2.  context-binding      — same DEK wrapped under two contexts produces
 *                             different ciphertexts; the wrong-context
 *                             unwrap fails an integrity check
 *  3.  randomness           — two consecutive generateDataKey calls produce
 *                             different plaintexts AND ciphertexts
 *  4.  info shape           — info() returns the expected schema and matches
 *                             the configured key version
 *  5.  tamper detection     — flipping a single bit in the ciphertext
 *                             causes unwrap to throw (AES-GCM tag check)
 *  6.  short-blob error     — unwrapDataKey rejects blobs shorter than
 *                             iv || tag || ct
 *  7.  prod-guard (refuse)  — factory refuses local-dev in production
 *                             unless the unsafe-override flag is set
 *  8.  prod-guard (allow)   — the unsafe-override flag accepts local-dev
 *                             in production explicitly
 */
import { describe, it, expect } from 'vitest';

import type { Config } from '../src/config.js';
import { LocalDevKeyManager } from '../src/infrastructure/key-providers/local-dev-key-manager.js';
import { createKeyManager } from '../src/infrastructure/key-providers/index.js';

const MASTER_KEY = Buffer.alloc(32, 0x42); // Fixed bytes; not security-sensitive in unit tests.
const KEY_VERSION = 'kv-1';
const CTX_A = Buffer.from('student:foo', 'utf8');
const CTX_B = Buffer.from('student:bar', 'utf8');

function makeLocalDev(
  overrides: Partial<ConstructorParameters<typeof LocalDevKeyManager>[0]> = {},
): LocalDevKeyManager {
  return new LocalDevKeyManager({
    keyVersion: KEY_VERSION,
    masterKey: MASTER_KEY,
    acknowledgedUnsafe: false,
    ...overrides,
  });
}

function makeConfig(overrides: Partial<Config> = {}): Config {
  const base: Config = {
    NODE_ENV: 'test',
    PORT: 4101,
    HOST: '127.0.0.1',
    LOG_LEVEL: 'silent',
    KEY_PROVIDER: 'local-dev',
    LOCAL_DEV_MASTER_KEY: MASTER_KEY.toString('base64'),
    KEY_VERSION: KEY_VERSION,
    VAULT_ALLOW_UNSAFE_KEY_PROVIDER: false,
  };
  return { ...base, ...overrides };
}

describe('LocalDevKeyManager', () => {
  it('generate then unwrap returns the original DEK bytes', async () => {
    const km = makeLocalDev();
    const { plaintext, wrapped, keyVersion } = await km.generateDataKey(CTX_A);
    try {
      expect(plaintext.length).toBe(32);
      expect(keyVersion).toBe(KEY_VERSION);
      const unwrapped = await km.unwrapDataKey(wrapped, CTX_A);
      expect(unwrapped.equals(plaintext)).toBe(true);
      unwrapped.fill(0);
    } finally {
      plaintext.fill(0);
    }
  });

  it('wraps the same DEK under different contexts into different ciphertexts', async () => {
    const km = makeLocalDev();
    // Re-use the plaintext so the difference is provably in the wrap.
    const fixedDek = Buffer.alloc(32, 0x07);
    const a = await km.wrapDataKey(fixedDek, CTX_A);
    const b = await km.wrapDataKey(fixedDek, CTX_B);
    try {
      expect(a.bytes.equals(b.bytes)).toBe(false);

      // Wrong-context unwrap must fail; the AEAD tag covers the wrapped
      // bytes, but the subkey was derived per-context, so a wrap with
      // CTX_A will NOT authenticate against CTX_B even before tampering.
      await expect(km.unwrapDataKey(a, CTX_B)).rejects.toThrow(
        /integrity failure/,
      );

      // Right-context unwrap still returns the original plaintext.
      const unwrapped = await km.unwrapDataKey(a, CTX_A);
      expect(unwrapped.equals(fixedDek)).toBe(true);
      unwrapped.fill(0);
    } finally {
      fixedDek.fill(0);
    }
  });

  it('two consecutive generateDataKey calls return different DEKs', async () => {
    const km = makeLocalDev();
    const a = await km.generateDataKey(CTX_A);
    const b = await km.generateDataKey(CTX_A);
    try {
      expect(a.plaintext.equals(b.plaintext)).toBe(false);
      // Different IVs also mean different ciphertexts.
      expect(a.wrapped.bytes.equals(b.wrapped.bytes)).toBe(false);
    } finally {
      a.plaintext.fill(0);
      b.plaintext.fill(0);
    }
  });

  it('info() returns provider, currentVersion, and algorithm', () => {
    const km = makeLocalDev({ keyVersion: 'kv-7' });
    expect(km.info()).toEqual({
      provider: 'local-dev',
      currentVersion: 'kv-7',
      algorithm: 'aes-256-gcm',
    });
  });

  it('tampered wrapped bytes fail AEAD authentication', async () => {
    const km = makeLocalDev();
    const { plaintext, wrapped } = await km.generateDataKey(CTX_A);
    try {
      // Flip a single bit in the ciphertext region. Layout is
      // iv (12) || tag (16) || ct (32); flip byte 30 (last ct byte).
      const tampered = Buffer.from(wrapped.bytes);
      tampered[30] = tampered[30]! ^ 0x01;
      await expect(
        km.unwrapDataKey({ bytes: tampered }, CTX_A),
      ).rejects.toThrow(/integrity failure/);
    } finally {
      plaintext.fill(0);
    }
  });

  it('rejects wrapped blobs shorter than iv+tag+1 byte', async () => {
    const km = makeLocalDev();
    const tooShort = Buffer.alloc(12 + 16, 0); // missing ciphertext
    await expect(
      km.unwrapDataKey({ bytes: tooShort }, CTX_A),
    ).rejects.toThrow(/too short/);
  });
});

describe('createKeyManager factory', () => {
  it('refuses to build local-dev in production without the unsafe override', () => {
    const cfg = makeConfig({ NODE_ENV: 'production' });
    expect(() => createKeyManager({ config: cfg })).toThrow(
      /Refusing to construct LocalDevKeyManager/,
    );
  });

  it('accepts local-dev in production when the unsafe override is set', () => {
    const cfg = makeConfig({
      NODE_ENV: 'production',
      VAULT_ALLOW_UNSAFE_KEY_PROVIDER: true,
    });
    const km = createKeyManager({ config: cfg });
    expect(km.info().provider).toBe('local-dev');
    expect(km.info().currentVersion).toBe(KEY_VERSION);
  });
});