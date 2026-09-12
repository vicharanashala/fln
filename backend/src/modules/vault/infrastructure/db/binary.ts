/**
 * Buffer <-> MongoDB Binary conversion helpers.
 *
 * The vault ports carry binary fields as `Buffer` (matching Node's
 * `node:crypto` types). The Mongo driver returns `Binary` instances
 * from BSON deserialization; we want `Buffer` so the rest of the
 * application doesn't have to know about the driver.
 *
 * Both `Buffer` and `Binary` extend `Uint8Array`, so the round-trip
 * is allocation-free — we just construct a Buffer view over the
 * existing bytes. The reverse direction (Buffer -> Binary) goes
 * through BSON serialization automatically when the driver writes
 * a document, so we never need to wrap a Buffer manually.
 *
 * **BSON Binary data layout (bson >= 6 / mongodb >= 6):**
 * The data lives at `buffer[0:position]`, NOT at
 * `buffer[position:end]`. The `position` field is the LENGTH of
 * the data; the underlying `buffer` is a (typically larger)
 * pre-allocated Uint8Array that may have trailing unused capacity.
 * `length()` returns `position` (the data length, not a remaining
 * count), and `value()` is the canonical accessor — it returns
 * `buffer.subarray(0, position)`.
 *
 * The earlier implementation read `Buffer.from(buf.buffer, position,
 * length() - position)` which combined the offset-with-length
 * math the other way around. For a deserialized Binary of N bytes
 * that would read N bytes of trailing garbage (typically zeroed)
 * instead of the real data, and any downstream crypto would fail
 * the AES-GCM auth tag check. Use `Binary.value()` so we get the
 * library's own correct slice.
 */
import { Binary } from 'mongodb';

/** Coerce a BSON Binary (or already-Buffer) to a fresh Buffer. */
export function toBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Binary) {
    // `value.value()` returns `buffer.subarray(0, position)` — the
    // exact data range. Wrap in Buffer.from(Buffer.from(...)) so
    // the result is an OWNED copy that callers can safely mutate
    // (e.g. `safeZero`) without aliasing other rows or the BSON
    // Binary's internal allocation.
    return Buffer.from(Buffer.from(value.value()));
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }
  throw new TypeError(
    `[vault] expected Buffer/Binary/Uint8Array, got ${typeof value}`,
  );
}
