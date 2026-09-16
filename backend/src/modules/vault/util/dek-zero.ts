/**
 * Buffer-zeroing helpers (ported verbatim from
 * src/util/dek-zero.ts).
 *
 * DEK plaintexts must not linger in heap memory after a detokenize
 * finishes. Naive `buffer = Buffer.alloc(0)` does not zero the
 * underlying memory; we have to overwrite it in place. The V8 GC
 * threshold is what eventually frees the page.
 */

/**
 * Zero-fill a Buffer in place. Safe to call on `Buffer.allocUnsafe`
 * (backing store is owned), and on regular `Buffer.from(...)` results
 * (Node copies the slice into a fresh pool allocation).
 */
export function safeZero(buf: Buffer): void {
  if (!Buffer.isBuffer(buf)) return;
  // `Buffer` length is immutable; `fill` overwrites every byte with 0.
  buf.fill(0);
}
