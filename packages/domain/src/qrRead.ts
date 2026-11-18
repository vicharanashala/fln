import jsQR from 'jsqr';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

/**
 * Reads the QR code on a photographed paper (#904 Part B).
 *
 * Phone photos are large and the code is small (24 mm on an A4 paper), so it is looked for in a few passes: the whole photo
 * made smaller, the same at a higher size, and the top right corner at full detail, where the code is printed. Each pass is
 * cheap; the first one that finds a code wins. It never throws: a photo that cannot be read, or has no code, gives null.
 */

interface Raster { width: number; height: number; data: Uint8ClampedArray }

// Refuses images that would need too much memory to open. The API runs in a service capped at 384 MB, and an image takes about 4 bytes a pixel
// to open (twice that while decoding). The web app sends photos of at most 1600 pixels, so only a direct upload can be this large.
const MAX_PIXELS = 16_000_000; // about 4000 x 4000

function decode(image: Buffer): Raster | null {
  try {
    if (image.length > 4 && image[0] === 0x89 && image[1] === 0x50) {
      const png = PNG.sync.read(image, { skipRescale: true });
      if (png.width * png.height > MAX_PIXELS) return null;
      return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.byteLength) };
    }
    if (image.length > 3 && image[0] === 0xff && image[1] === 0xd8) {
      const jpg = jpeg.decode(image, { useTArray: true, maxMemoryUsageInMB: 256, maxResolutionInMP: MAX_PIXELS / 1_000_000 });
      return { width: jpg.width, height: jpg.height, data: new Uint8ClampedArray(jpg.data.buffer, jpg.data.byteOffset, jpg.data.byteLength) };
    }
  } catch { /* not an image we can open */ }
  return null;
}

/** Part of the picture, made smaller by averaging blocks so thin modules do not vanish, until its longer side is at most `maxSide`. */
function region(r: Raster, x0: number, y0: number, x1: number, y1: number, maxSide: number): Raster {
  const w = x1 - x0, h = y1 - y0;
  const step = Math.max(1, Math.ceil(Math.max(w, h) / maxSide));
  const ow = Math.floor(w / step), oh = Math.floor(h / step);
  const out = new Uint8ClampedArray(ow * oh * 4);
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      let sum0 = 0, sum1 = 0, sum2 = 0;
      for (let dy = 0; dy < step; dy++) {
        let i = ((y0 + y * step + dy) * r.width + x0 + x * step) * 4;
        for (let dx = 0; dx < step; dx++, i += 4) { sum0 += r.data[i]; sum1 += r.data[i + 1]; sum2 += r.data[i + 2]; }
      }
      const n = step * step, o = (y * ow + x) * 4;
      out[o] = sum0 / n; out[o + 1] = sum1 / n; out[o + 2] = sum2 / n; out[o + 3] = 255;
    }
  }
  return { width: ow, height: oh, data: out };
}

/** The text of the QR code in this photo (JPEG or PNG), or null when there is none or the photo cannot be read. */
export function readQrFromImage(image: Buffer): string | null {
  const full = decode(image);
  if (!full || full.width < 40 || full.height < 40) return null;
  const { width: w, height: h } = full;
  const passes: Array<() => Raster> = [
    () => region(full, 0, 0, w, h, 1600),
    () => region(full, Math.floor(w * 0.5), 0, w, Math.floor(h * 0.4), 1100),
    () => region(full, 0, 0, w, h, 2600),
    () => region(full, 0, 0, w, Math.floor(h * 0.5), 2000),
  ];
  for (const pass of passes) {
    const r = pass();
    if (r.width < 40 || r.height < 40) continue;
    const found = jsQR(r.data, r.width, r.height, { inversionAttempts: 'attemptBoth' });
    if (found && found.data) return found.data;
  }
  return null;
}
