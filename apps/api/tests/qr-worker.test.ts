import assert from 'node:assert';
import { after, describe, it } from 'node:test';
import jpeg from 'jpeg-js';
import qrcode from 'qrcode-generator';
import { PNG } from 'pngjs';
import { createQrWorker, defaultQrWorkerOptions, readQrInThread, type QrWorker } from '../src/services/qrReader';

// #904: the QR code of a photographed paper is read in a worker thread, so a scan never holds up other requests.
const TEXT = 'ps_ab12cd34ef56|stu_0b1f2c3d-4e5f-6789-abcd-ef0123456789';

/** A photo with the code in the top right corner: white page, some printed lines. */
function page(text: string | null, w: number, h: number, px: number): { w: number; h: number; d: Uint8Array } {
  const d = new Uint8Array(w * h * 4).fill(255);
  const dot = (x: number, y: number, v: number) => { const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; };
  for (let k = 0; k < 30; k++) for (let x = 80; x < w - 80; x++) if (((x >> 4) + k) % 3) dot(x, 300 + k * 30, 70);
  if (text !== null) {
    const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
    const n = qr.getModuleCount(), x0 = w - 80 - n * px, y0 = 60;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) for (let dy = 0; dy < px; dy++) for (let dx = 0; dx < px; dx++) dot(x0 + c * px + dx, y0 + r * px + dy, 20);
  }
  return { w, h, d };
}
const png = (p: ReturnType<typeof page>) => { const x = new PNG({ width: p.w, height: p.h }); x.data = Buffer.from(p.d); return PNG.sync.write(x); };
const jpg = (p: ReturnType<typeof page>) => jpeg.encode({ width: p.w, height: p.h, data: Buffer.from(p.d) }, 70).data;

const open: QrWorker[] = [];
const worker = (over: Partial<Parameters<typeof createQrWorker>[0]> = {}) => { const w = createQrWorker({ ...defaultQrWorkerOptions(), ...over }); open.push(w); return w; };
after(async () => { for (const w of open) await w.close(); });

describe('the QR worker', () => {
  it('reads what the main thread reads, and gives null for a photo with no code, a blank page and junk', async () => {
    const w = worker();
    const withCode = png(page(TEXT, 900, 900, 9)), noCode = png(page(null, 900, 900, 9));
    assert.equal(await w.read(withCode), TEXT);
    assert.equal(await w.read(withCode), await readQrInThread(withCode));
    assert.equal(await w.read(noCode), null);
    assert.equal(await w.read(Buffer.from('not an image')), null);
    assert.equal(await w.read(Buffer.alloc(0)), null);
  });
  it('gives every photo its own answer when several are sent at once', async () => {
    const w = worker();
    const texts = ['ps_a1|stu_1', 'ps_b2|stu_2', 'ps_c3|stu_3', 'ps_d4|stu_4', 'ps_e5|stu_5'];
    const got = await Promise.all(texts.map(t => w.read(png(page(t, 800, 800, 9)))));
    assert.deepStrictEqual(got, texts);
  });
  it('keeps the main thread free while a very large photo is read, which the in-thread reader does not', async () => {
    const big = jpg(page(TEXT, 4000, 5600, 6)); // 22 megapixels
    // how long the main thread was stuck, seen as the longest gap between ticks of a 10 ms timer
    const longestGap = async (read: () => Promise<string | null>) => {
      let last = Date.now(), max = 0;
      const t = setInterval(() => { const now = Date.now(); max = Math.max(max, now - last); last = now; }, 10);
      const text = await read();
      await new Promise(r => setTimeout(r, 40)); // let the timer have its turn: a stall shows up as one late tick
      clearInterval(t);
      assert.equal(text, TEXT);
      return max;
    };
    const w = worker();
    await w.read(png(page(TEXT, 400, 400, 8))); // start the worker first: starting is not what is measured
    const inWorker = await longestGap(() => w.read(big));
    const inThread = await longestGap(() => readQrInThread(big));
    assert.ok(inWorker < 300, `with the worker the main thread was never stuck for long (${inWorker} ms)`);
    assert.ok(inThread > inWorker * 2, `reading in the main thread holds it (${inThread} ms against ${inWorker} ms)`);
  });
  it('reads in the main thread when the worker dies, and keeps working', async () => {
    const w = worker({ file: new URL('./fixtures/qr-worker-dies.mjs', import.meta.url), execArgv: [] });
    const img = png(page(TEXT, 800, 800, 9));
    assert.equal(await w.read(img), TEXT);
    assert.equal(await w.read(img), TEXT, 'and again');
  });
  it('reads in the main thread when the worker does not answer in time', async () => {
    const w = worker({ file: new URL('./fixtures/qr-worker-hangs.mjs', import.meta.url), execArgv: [], timeoutMs: 300 });
    const t0 = Date.now();
    assert.equal(await w.read(png(page(TEXT, 800, 800, 9))), TEXT);
    assert.ok(Date.now() - t0 < 5000);
  });
  it('reads in the main thread when the worker script is missing', async () => {
    const w = worker({ file: new URL('./fixtures/does-not-exist.mjs', import.meta.url), execArgv: [] });
    assert.equal(await w.read(png(page(TEXT, 800, 800, 9))), TEXT);
  });
  it('refuses new photos once closed, and a photo still waiting is answered', async () => {
    const w = createQrWorker(defaultQrWorkerOptions());
    const waiting = w.read(png(page(TEXT, 800, 800, 9)));
    await w.close();
    assert.equal(await waiting, TEXT);
    await assert.rejects(w.read(png(page(TEXT, 800, 800, 9))), /closed/);
  });
});
