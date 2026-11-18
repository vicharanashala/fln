import assert from 'node:assert';
import jpeg from 'jpeg-js';
import qrcode from 'qrcode-generator';
import { PNG } from 'pngjs';
import { readQrFromImage } from './qrRead';
import { parsePrintedSheetQr, printedSheetQrText } from './printedSheet';

const TEXT = printedSheetQrText('ps_ab12cd34ef56', 'stu_0b1f2c3d-4e5f-6789-abcd-ef0123456789');

/** A white page with the code on it, like a photographed paper: size, where the code sits, how large its squares are, a turn, and some noise. */
function page(o: { text?: string; w: number; h: number; x: number; y: number; px: number; turn?: 0 | 1 | 2 | 3; noise?: number; blur?: boolean }): { r: { w: number; h: number; d: Uint8Array } } {
  const qr = qrcode(0, 'M'); qr.addData(o.text ?? TEXT); qr.make();
  const n = qr.getModuleCount();
  const d = new Uint8Array(o.w * o.h * 4).fill(255);
  let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!qr.isDark(r, c)) continue;
    for (let dy = 0; dy < o.px; dy++) for (let dx = 0; dx < o.px; dx++) {
      const X = o.x + c * o.px + dx, Y = o.y + r * o.px + dy, i = (Y * o.w + X) * 4;
      d[i] = d[i + 1] = d[i + 2] = 20;
    }
  }
  // some "printed text" stripes so the page is not just one code on white
  for (let k = 0; k < 40; k++) { const y = 200 + k * 30; for (let x = 100; x < o.w - 100; x++) if (((x >> 4) + k) % 3) { const i = (y * o.w + x) * 4; d[i] = d[i + 1] = d[i + 2] = 60; } }
  let out = { w: o.w, h: o.h, d };
  for (let t = 0; t < (o.turn ?? 0); t++) { // turn a quarter, clockwise
    const nd = new Uint8Array(out.d.length);
    for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) { const s = (y * out.w + x) * 4, dst = (x * out.h + (out.h - 1 - y)) * 4; nd.set(out.d.subarray(s, s + 4), dst); }
    out = { w: out.h, h: out.w, d: nd };
  }
  if (o.blur) { const nd = new Uint8Array(out.d); for (let y = 1; y < out.h - 1; y++) for (let x = 1; x < out.w - 1; x++) for (let ch = 0; ch < 3; ch++) { let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += out.d[((y + dy) * out.w + x + dx) * 4 + ch]; nd[(y * out.w + x) * 4 + ch] = s / 9; } out = { ...out, d: nd }; }
  if (o.noise) for (let i = 0; i < out.d.length; i += 4) { const v = Math.round((rnd() - 0.5) * o.noise); for (let ch = 0; ch < 3; ch++) out.d[i + ch] = Math.max(0, Math.min(255, out.d[i + ch] + v)); }
  return { r: out };
}
const png = (p: ReturnType<typeof page>) => { const x = new PNG({ width: p.r.w, height: p.r.h }); x.data = Buffer.from(p.r.d); return PNG.sync.write(x); };
const jpg = (p: ReturnType<typeof page>, q = 70) => jpeg.encode({ width: p.r.w, height: p.r.h, data: Buffer.from(p.r.d) }, q).data;

// a clear code reads back as the exact text, from a PNG and from a JPEG
assert.equal(readQrFromImage(png(page({ w: 800, h: 800, x: 200, y: 200, px: 10 }))), TEXT);
assert.equal(readQrFromImage(jpg(page({ w: 800, h: 800, x: 200, y: 200, px: 10 }))), TEXT);

// a small code in the top right corner of a phone-sized photo (3000 x 4200), the way the paper is printed
const phone = page({ w: 3000, h: 4200, x: 2150, y: 150, px: 9 });
let t0 = Date.now();
assert.equal(readQrFromImage(jpg(phone)), TEXT);
assert.ok(Date.now() - t0 < 6000, `a phone-sized photo is read in a few seconds (${Date.now() - t0} ms)`);

// a very large photo (22 megapixels) with a small code: the whole-picture pass is too coarse, the corner pass finds it
const huge = page({ w: 4000, h: 5600, x: 2900, y: 200, px: 6 });
t0 = Date.now();
assert.equal(readQrFromImage(jpg(huge, 75)), TEXT, 'a 22 megapixel photo');
console.log(`22 MP photo read in ${Date.now() - t0} ms`);

// the paper held any way round, a little noise and blur
for (const turn of [1, 2, 3] as const) assert.equal(readQrFromImage(png(page({ w: 1600, h: 1600, x: 900, y: 120, px: 9, turn }))), TEXT, `turned ${turn}`);
assert.equal(readQrFromImage(jpg(page({ w: 2400, h: 3200, x: 1500, y: 100, px: 9, noise: 40, blur: true }), 60)), TEXT, 'noise and blur');

// what it reads is exactly what the parser needs
assert.deepStrictEqual(parsePrintedSheetQr(readQrFromImage(png(page({ w: 800, h: 800, x: 200, y: 200, px: 10 })))), { printedSheetId: 'ps_ab12cd34ef56', studentId: 'stu_0b1f2c3d-4e5f-6789-abcd-ef0123456789' });
// another code is read as it is; it is the parser that refuses it
assert.equal(readQrFromImage(png(page({ text: 'hello', w: 800, h: 800, x: 200, y: 200, px: 10 }))), 'hello');
assert.equal(parsePrintedSheetQr('hello'), null);

// no code, a blank page, and things that are not photos give null and never throw
const blank = new PNG({ width: 600, height: 600 }); blank.data.fill(255);
assert.equal(readQrFromImage(PNG.sync.write(blank)), null);
assert.equal(readQrFromImage(Buffer.alloc(0)), null);
assert.equal(readQrFromImage(Buffer.from('not an image at all')), null);
assert.equal(readQrFromImage(Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01])), null, 'a cut-off JPEG');
assert.equal(readQrFromImage(png(page({ w: 20, h: 20, x: 0, y: 0, px: 0 }))), null, 'a tiny image');
console.log('qrRead: ok');
