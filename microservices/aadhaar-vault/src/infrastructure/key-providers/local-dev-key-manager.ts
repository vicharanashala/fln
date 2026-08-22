/**
 * LocalDevKeyManager — first KeyManager adapter.
 *
 * Threat model (architecture doc §5.1, "local-dev"):
 *   The master key is supplied via `LOCAL_DEV_MASTER_KEY` env. Anyone
 *   who can read process env can derive every DEK this adapter has
 *   ever issued. The adapter therefore refuses to start when
 *   `NODE_ENV=production` unless `VAULT_ALLOW_UNSAFE_KEY_PROVIDER=true`
 *   is set; that override is treated as a deliberate, logged acceptance.
 *
 * Crypto:
 *   - Per-wrap subkey = HKDF-SHA-256(master, salt=context, info="aadhaar-vault/dek-wrap").
 *     This binds the wrap to its `context` so that re-using the same
 *     DEK with two different contexts produces two different wrapped
 *     blobs (the AEAD key itself is different).
 *   - DEK wrap   = AES-256-GCM(subkey, IV, plaintext DEK) with no AAD.
 *     The ciphertext-and-tag layout is `(iv || tag || ct)`.
 *
 * Domain purity:
 *   The adapter operates only on plaintext DEKs, wrapped DEKs, context
 *   bytes, and key versions. It does not know what is encrypted. The
 *   persisted identity blob will live elsewhere — `vault_identities`
 *   will store the *ciphertext* of the sensitive payload, separately
 *   from the wrapped DEK that lives alongside it. This separation is
 *   intentional: the application layer is the only place that knows
 *   which side holds the payload and which side holds the key.
 */
import { hkdfSync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

import type {
  GeneratedDek,
  KeyManager,
  KeyManagerInfo,
  PlainDek,
  WrapContext,
  WrappedDek,
  WrappedSecret,
} from '../../application/ports/key-manager.js';

const ALGORITHM = 'aes-256-gcm';
const HKDF_INFO = Buffer.from('aadhaar-vault/dek-wrap', 'utf8');
const HKDF_SALT_FALLBACK = Buffer.from('aadhaar-vault/dek-wrap-salt', 'utf8');
const IV_LEN = 12; // 96-bit IV recommended for AES-GCM.
const DEK_LEN = 32; // 256-bit DEK.
const TAG_LEN = 16; // 128-bit GCM auth tag.

export interface LocalDevConfig {
  /** Current key version tag, e.g. 'kv-1'. Passes through to `info()`. */
  keyVersion: string;
  /** Master key bytes (32 bytes recommended). Supplied via env. */
  masterKey: Buffer;
  /** When true, log a startup warning. Set this only when the prod-guard
   *  override was explicitly accepted by an operator. */
  acknowledgedUnsafe: boolean;
}

export class LocalDevKeyManager implements KeyManager {
  private readonly masterKey: Buffer;
  private readonly keyVersion: string;

  constructor(
    cfg: LocalDevConfig,
    private readonly logger?: { warn: (obj: unknown, msg: string) => void },
  ) {
    if (!Buffer.isBuffer(cfg.masterKey) || cfg.masterKey.length === 0) {
      throw new Error(
        '[aadhaar-vault] LocalDevKeyManager: masterKey must be a non-empty Buffer.',
      );
    }
    if (!cfg.keyVersion || typeof cfg.keyVersion !== 'string') {
      throw new Error(
        '[aadhaar-vault] LocalDevKeyManager: keyVersion is required.',
      );
    }
    this.masterKey = cfg.masterKey;
    this.keyVersion = cfg.keyVersion;

    if (cfg.acknowledgedUnsafe) {
      this.logger?.warn(
        { keyVersion: this.keyVersion, provider: 'local-dev' },
        'aadhaar-vault.key.local-dev.acknowledged-unsafe',
      );
    }
  }

  info(): KeyManagerInfo {
    return {
      provider: 'local-dev',
      currentVersion: this.keyVersion,
      algorithm: ALGORITHM,
    };
  }

  async generateDataKey(context: WrapContext): Promise<GeneratedDek> {
    if (!Buffer.isBuffer(context)) {
      throw new Error('[aadhaar-vault] LocalDevKeyManager: context must be a Buffer.');
    }
    const plaintext = randomBytes(DEK_LEN);
    const wrapped = this.wrap(plaintext, context);
    return { plaintext, wrapped, keyVersion: this.keyVersion };
  }

  async wrapDataKey(dek: PlainDek, context: WrapContext): Promise<WrappedDek> {
    if (!Buffer.isBuffer(dek) || dek.length !== DEK_LEN) {
      throw new Error(
        `[aadhaar-vault] LocalDevKeyManager: wrapDataKey requires a ${DEK_LEN}-byte DEK.`,
      );
    }
    if (!Buffer.isBuffer(context)) {
      throw new Error('[aadhaar-vault] LocalDevKeyManager: context must be a Buffer.');
    }
    return this.wrap(dek, context);
  }

  async unwrapDataKey(wrapped: WrappedDek, context: WrapContext): Promise<PlainDek> {
    if (!Buffer.isBuffer(wrapped?.bytes)) {
      throw new Error('[aadhaar-vault] LocalDevKeyManager: wrapped.bytes must be a Buffer.');
    }
    if (!Buffer.isBuffer(context)) {
      throw new Error('[aadhaar-vault] LocalDevKeyManager: context must be a Buffer.');
    }
    if (wrapped.bytes.length < IV_LEN + TAG_LEN + 1) {
      // Even a single-byte plaintext needs IV + tag.
      throw new Error('[aadhaar-vault] LocalDevKeyManager: wrapped blob is too short.');
    }
    const iv = wrapped.bytes.subarray(0, IV_LEN);
    const tag = wrapped.bytes.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ct = wrapped.bytes.subarray(IV_LEN + TAG_LEN);
    const key = this.deriveSubkey(context);

    let plaintext: Buffer;
    try {
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
    } catch (err) {
      // AES-GCM throws on tag mismatch; surface a typed error so callers
      // can distinguish integrity failures from programmer errors.
      throw new Error(
        `[aadhaar-vault] LocalDevKeyManager: unwrap integrity failure: ${(err as Error).message}`,
      );
    }
    if (plaintext.length !== DEK_LEN) {
      plaintext.fill(0);
      throw new Error(
        `[aadhaar-vault] LocalDevKeyManager: unwrapped DEK length mismatch (got ${plaintext.length}, expected ${DEK_LEN}).`,
      );
    }
    return plaintext;
  }

  /**
   * Derive a per-context subkey from the master using HKDF-SHA-256.
   *
   * HKDF makes the subkey depend on `context`, so two wraps of the
   * same DEK with different contexts produce different ciphertexts.
   * We pass `context` as the HKDF *salt* and a fixed `info` string so
   * derived subkeys never collide with HKDF uses elsewhere in the
   * process. If `context` is empty we fall back to a domain-separated
   * constant — HKDF forbids an empty salt, but more importantly we
   * want empty-context DEKs (if anyone ever issues them) to still
   * differ from non-empty ones.
   */
  private deriveSubkey(context: WrapContext): Buffer {
    const salt = context.length > 0 ? context : HKDF_SALT_FALLBACK;
    const derived = hkdfSync('sha256', this.masterKey, salt, HKDF_INFO, 32);
    return Buffer.from(derived);
  }

  private wrap(plaintext: Buffer, context: WrapContext): WrappedDek {
    const key = this.deriveSubkey(context);
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    const bytes = Buffer.concat([iv, tag, ct]);
    return { bytes };
  }

  async sealSecret(
    plaintext: Buffer,
    context: WrapContext,
  ): Promise<WrappedSecret> {
    if (!Buffer.isBuffer(plaintext) || plaintext.length === 0) {
      throw new Error(
        '[aadhaar-vault] LocalDevKeyManager: sealSecret requires a non-empty Buffer.',
      );
    }
    if (!Buffer.isBuffer(context)) {
      throw new Error(
        '[aadhaar-vault] LocalDevKeyManager: sealSecret context must be a Buffer.',
      );
    }
    // Same AES-256-GCM envelope as DEK wrap. The subkey is HKDF-derived
    // from `context`, so the same TOTP secret sealed under two different
    // factor_ids produces two distinct wrapped blobs. The plaintext
    // buffer is NOT mutated by `wrap`; the caller is responsible for
    // safeZero'ing it.
    return this.wrap(plaintext, context);
  }

  async openSecret(
    wrapped: WrappedSecret,
    context: WrapContext,
  ): Promise<Buffer> {
    if (!Buffer.isBuffer(wrapped?.bytes)) {
      throw new Error(
        '[aadhaar-vault] LocalDevKeyManager: wrapped.bytes must be a Buffer.',
      );
    }
    if (!Buffer.isBuffer(context)) {
      throw new Error(
        '[aadhaar-vault] LocalDevKeyManager: openSecret context must be a Buffer.',
      );
    }
    if (wrapped.bytes.length < IV_LEN + TAG_LEN + 1) {
      throw new Error(
        '[aadhaar-vault] LocalDevKeyManager: wrapped blob is too short.',
      );
    }
    const iv = wrapped.bytes.subarray(0, IV_LEN);
    const tag = wrapped.bytes.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ct = wrapped.bytes.subarray(IV_LEN + TAG_LEN);
    const key = this.deriveSubkey(context);

    let plaintext: Buffer;
    try {
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
    } catch (err) {
      throw new Error(
        `[aadhaar-vault] LocalDevKeyManager: openSecret integrity failure: ${(err as Error).message}`,
      );
    }
    return plaintext;
  }
}
