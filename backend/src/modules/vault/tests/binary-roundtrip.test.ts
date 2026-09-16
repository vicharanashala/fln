/**
 * Buffer <-> BSON Binary roundtrip regression test.
 *
 * BSON v6 (used by mongodb >= 6) stores Binary values with a
 * layout where the data lives at `buffer[0:position]` and
 * `position` is the data LENGTH (not an offset). `length()` returns
 * `position` (not `buffer.length - position`).
 *
 * The earlier `toBuffer` helper used the inverse math
 * (`Buffer.from(buf.buffer, position, length() - position)`) and
 * silently read garbage bytes at the END of the underlying buffer
 * instead of the actual data at the start. The downstream
 * AES-GCM auth tag check then failed with "Unsupported state or
 * unable to authenticate data" because the decipher was given
 * zeroes (or whatever happened to sit at that offset), not the
 * sealed envelope.
 *
 * This test exercises three properties:
 *
 *   1. A Binary constructed from a known payload round-trips
 *      through `toBuffer` with the bytes intact (a direct
 *      `Buffer.equals` assertion).
 *   2. A Binary whose internal buffer is LARGER than its data
 *      (a realistic BSON deserialization shape) still yields
 *      the correct data, NOT the trailing capacity.
 *   3. The full LocalDevKeyManager seal -> BSON Binary ->
 *      toBuffer -> open roundtrip succeeds (the end-to-end
 *      invariant the bug violated).
 *
 * Run:  npx tsx --test backend/src/modules/vault/tests/binary-roundtrip.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { Binary } from 'mongodb';

import { toBuffer } from '../infrastructure/db/binary';
import { LocalDevKeyManager } from '../infrastructure/key-providers/local-dev-key-manager';
import { makeMfaSecretContext } from '../application/util/mfa-secret-context';

test('toBuffer: returns a Buffer of the same length as the Binary data', () => {
  const payload = randomBytes(48); // 12 IV + 16 tag + 20 SHA1 ct
  const bin = new Binary(Buffer.from(payload));
  const out = toBuffer(bin);
  assert.ok(Buffer.isBuffer(out), 'expected a Node Buffer');
  assert.equal(out.length, 48, 'toBuffer must not include trailing capacity');
  assert.ok(
    out.equals(payload),
    'toBuffer must return the original payload bytes, not garbage',
  );
});

test('toBuffer: ignores trailing capacity when buffer is larger than data', () => {
  // Construct a Binary whose underlying buffer is bigger than its
  // data — the realistic BSON deserialization shape (the BSON
  // allocator hands out 256-byte buckets by default; the data is
  // a strict prefix of the buffer).
  const data = randomBytes(48);
  const bigBuf = Buffer.concat([data, Buffer.alloc(208, 0xff)]);
  // `new Binary(Uint8Array)` stores position = byteLength; that
  // happens to be the same as the data length here. We then
  // exercise the "position is the LENGTH, data is the prefix"
  // contract by mutating the binary to look like a deserialized
  // shape: truncate the meaningful data to 48 bytes by writing
  // position back to 48. (The BSON library doesn't expose a
  // public setPosition, so this is a white-box check: we are
  // confirming `toBuffer` reads the prefix, not the suffix.)
  const bin = new Binary(bigBuf);
  (bin as unknown as { position: number }).position = 48;
  const out = toBuffer(bin);
  assert.equal(
    out.length,
    48,
    'toBuffer must return exactly `position` bytes, not the rest of the buffer',
  );
  assert.ok(
    out.equals(data),
    'toBuffer must return the data prefix, not the trailing 0xff capacity',
  );
  // The 0xff capacity must NOT be present anywhere in the output.
  for (let i = 0; i < out.length; i++) {
    assert.notEqual(out[i], 0xff, `byte at offset ${i} leaked from trailing capacity`);
  }
});

test('toBuffer: returns the original Buffer unchanged for Buffer input', () => {
  const b = randomBytes(64);
  const out = toBuffer(b);
  assert.strictEqual(out, b, 'Buffer passthrough must be identity');
});

test('toBuffer: throws on unsupported types', () => {
  assert.throws(() => toBuffer('not a buffer'), /expected Buffer\/Binary\/Uint8Array/);
  assert.throws(() => toBuffer(null), /expected Buffer\/Binary\/Uint8Array/);
  assert.throws(() => toBuffer(42), /expected Buffer\/Binary\/Uint8Array/);
});

test('toBuffer end-to-end: sealed envelope round-trips through BSON and decrypts', async () => {
  // Use a real AES-GCM envelope so a corrupted roundtrip is
  // visible as a tag-mismatch on the second open. The earlier
  // bug produced exactly this failure mode.
  const keyManager = new LocalDevKeyManager({
    keyVersion: 'kv-1',
    masterKey: randomBytes(32),
    acknowledgedUnsafe: false,
  });
  const factorId = randomUUID();
  const secret = randomBytes(20); // SHA1-sized TOTP shared secret
  const context = makeMfaSecretContext(factorId);

  // Seal
  const sealed = await keyManager.sealSecret(secret, context);
  assert.equal(sealed.bytes.length, 12 + 16 + 20, 'envelope: iv + tag + ct');

  // Simulate a BSON roundtrip: wrap the sealed bytes in a Binary
  // whose internal buffer is larger than the data (the realistic
  // shape a deserializer produces), then read it back through
  // toBuffer. Before the fix this read 48 bytes of trailing zeros
  // and the next step failed with an auth-tag error.
  const padded = Buffer.concat([sealed.bytes, Buffer.alloc(208, 0)]);
  const bin = new Binary(padded);
  (bin as unknown as { position: number }).position = sealed.bytes.length;
  const recovered = toBuffer(bin);

  // Open
  const opened = await keyManager.openSecret({ bytes: recovered }, context);
  assert.ok(
    opened.equals(secret),
    'openSecret must yield the original plaintext after a BSON-shaped roundtrip',
  );
});
