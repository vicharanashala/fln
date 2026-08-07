/**
 * `safeZero()` unit tests.
 *
 * Focus: verify the actual contract of the existing
 * `safeZero(buf: Buffer): void` helper in `src/util/dek-zero.ts`. Per
 * the resolution of the `validateZeroDek` mismatch in Session 3, these
 * tests describe the *current* behaviour and do not require any
 * production-code change.
 *
 * Contract verified:
 *  1.  Zero-fill in place — every byte of a populated buffer becomes 0;
 *      the original buffer identity (length, allocation) is preserved.
 *  2.  Non-Buffer inputs are a silent no-op — `safeZero` does not throw
 *      for typed arrays, plain objects, primitives, `null`, or
 *      `undefined`. This matches the documented "safe to call on
 *      anything" behaviour.
 *  3.  Returns `undefined` — the helper signals completion via side
 *      effect only; callers must not rely on a returned value.
 *
 * The DEK-zeroing responsibility lives in the caller (`finally` block)
 * so a returned value would imply ownership transfer the helper does
 * not have.
 */
import { describe, it, expect } from 'vitest';

import { safeZero } from '../src/util/dek-zero.js';

describe('safeZero', () => {
  it('overwrites every byte of a populated buffer with 0 in place', () => {
    const buf = Buffer.from('AADHAAR-NOT-FOR-LOGGING', 'utf8'); // 23 bytes
    expect(buf.length).toBe(23);
    // Pre-condition: at least one non-zero byte survives before the call.
    expect(buf.some((b) => b !== 0)).toBe(true);

    safeZero(buf);

    // Every byte is now 0; length and identity are preserved.
    expect(buf.length).toBe(23);
    expect(buf.every((b) => b === 0)).toBe(true);
    expect(buf.equals(Buffer.alloc(23, 0))).toBe(true);
  });

  it('is a no-op for non-Buffer inputs and does not throw', () => {
    const cases: ReadonlyArray<{ name: string; value: unknown }> = [
      { name: 'Uint8Array', value: new Uint8Array([1, 2, 3, 4]) },
      { name: 'ArrayBuffer', value: new ArrayBuffer(8) },
      { name: 'plain object', value: { 0: 1, length: 1 } },
      { name: 'null', value: null },
      { name: 'undefined', value: undefined },
      { name: 'number', value: 42 },
      { name: 'string', value: 'not a buffer' },
      { name: 'boolean', value: true },
      { name: 'array', value: [1, 2, 3] },
    ];

    for (const { name, value } of cases) {
      expect(() => safeZero(value as Buffer), name).not.toThrow();
      // For the typed array we additionally assert the helper did not
      // mutate it — only true `Buffer` instances are touched.
      if (value instanceof Uint8Array) {
        expect(value[0]).toBe(1);
        expect(value[1]).toBe(2);
      }
    }
  });

  it('returns undefined (void contract)', () => {
    const buf = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const result = safeZero(buf);
    expect(result).toBeUndefined();
    // Side-effect still applied.
    expect(buf.every((b) => b === 0)).toBe(true);
  });
});