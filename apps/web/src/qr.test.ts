import assert from 'node:assert';
import { describe, it } from 'node:test';
import { QR_QUIET_ZONE, qrModules, qrSvgPath } from './qr';

const text = 'ps_ab12cd34ef56|stu_0b1f2c3d-4e5f-6789-abcd-ef0123456789';

describe('qr', () => {
  it('makes a square matrix with the three finder squares in the corners', () => {
    const m = qrModules(text);
    const n = m.length;
    assert.ok(n >= 21 && m.every(row => row.length === n));
    // every finder square is a dark 7x7 ring around a dark 3x3 centre, with a light ring between
    for (const [r0, c0] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
      for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
        const ring = r === 0 || r === 6 || c === 0 || c === 6, centre = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        assert.equal(m[r0 + r][c0 + c], ring || centre, `finder at ${r0},${c0} square ${r},${c}`);
      }
    }
  });
  it('is the same every time for the same text, and different for different text', () => {
    assert.deepStrictEqual(qrModules(text), qrModules(text));
    assert.notDeepStrictEqual(qrModules(text), qrModules(text.replace('stu_0b', 'stu_0c')));
  });
  it('turns every dark square, and only those, into the path, inside a quiet zone', () => {
    const m = qrModules(text);
    const dark = m.flat().filter(Boolean).length;
    const { size, d } = qrSvgPath(m);
    assert.equal(size, m.length + 2 * QR_QUIET_ZONE);
    assert.equal(d.split('M').length - 1, dark);
    const corners = [...d.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map(x => [Number(x[1]), Number(x[2])]);
    assert.ok(corners.every(([x, y]) => x >= QR_QUIET_ZONE && y >= QR_QUIET_ZONE && x < size - QR_QUIET_ZONE && y < size - QR_QUIET_ZONE), 'nothing is drawn in the quiet zone');
  });
});
