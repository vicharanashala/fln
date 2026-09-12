/**
 * NodeCryptoService — AES-256-GCM adapter (ported verbatim from
 * src/infrastructure/crypto/node-crypto.service.ts).
 *
 * Production implementation of the `CryptoService` port backed by
 * `node:crypto`. We deliberately stay on the standard library so the
 * vault has no external crypto dependency; auditors care about that.
 *
 * Trust: this adapter inherits whatever trust the surrounding process
 * enjoys. In `NODE_ENV=production` an attacker able to read process
 * memory can already extract DEKs at the moment a `decrypt()` is
 * called — the only guard against persistent theft is zeroing the
 * plaintext from memory the instant the call returns. Callers must
 * use the `dek-zero` helper at the right boundary.
 */
import crypto from 'node:crypto';

import type {
  CryptoService,
  EncryptedEnvelope,
} from '../../application/ports/crypto.service';

const KEY_LEN = 32; // AES-256
const IV_LEN = 12; // GCM IV
const TAG_LEN = 16; // GCM auth tag

export class NodeCryptoService implements CryptoService {
  readonly algorithm = 'aes-256-gcm';

  async encrypt(
    key: Buffer,
    plaintext: Buffer,
    aad: Buffer,
  ): Promise<EncryptedEnvelope> {
    assertKeyLength(key);
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv, {
      authTagLength: TAG_LEN,
    });
    // Node expects AAD to be set BEFORE update() / final().
    cipher.setAAD(aad, { plaintextLength: plaintext.length });
    const ctParts: Buffer[] = [];
    ctParts.push(cipher.update(plaintext));
    ctParts.push(cipher.final());
    const authTag = cipher.getAuthTag();
    return {
      ciphertext: Buffer.concat(ctParts),
      iv,
      authTag,
    };
  }

  async decrypt(
    key: Buffer,
    envelope: EncryptedEnvelope,
    aad: Buffer,
  ): Promise<Buffer> {
    assertKeyLength(key);
    assertEnvelopeShape(envelope);
    const decipher = crypto.createDecipheriv(this.algorithm, key, envelope.iv, {
      authTagLength: TAG_LEN,
    });
    decipher.setAAD(aad, { plaintextLength: envelope.ciphertext.length });
    decipher.setAuthTag(envelope.authTag);
    const ptParts: Buffer[] = [];
    ptParts.push(decipher.update(envelope.ciphertext));
    ptParts.push(decipher.final());
    return Buffer.concat(ptParts);
  }
}

function assertKeyLength(key: Buffer): void {
  if (key.length !== KEY_LEN) {
    throw new Error(
      `[vault] crypto: AES-256 requires a ${KEY_LEN}-byte key; got ${key.length}.`,
    );
  }
}

function assertEnvelopeShape(env: EncryptedEnvelope): void {
  if (env.iv.length !== IV_LEN) {
    throw new Error(
      `[vault] crypto: iv must be ${IV_LEN} bytes; got ${env.iv.length}.`,
    );
  }
  if (env.authTag.length !== TAG_LEN) {
    throw new Error(
      `[vault] crypto: authTag must be ${TAG_LEN} bytes; got ${env.authTag.length}.`,
    );
  }
}
