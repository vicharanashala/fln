import { analyzeScanQuality } from './scanQuality';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

function createMockPngBuffer(width: number, height: number, totalSize = 8000): Buffer {
  const buf = Buffer.alloc(Math.max(totalSize, 30));
  // PNG signature
  buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4e; buf[3] = 0x47;
  // IHDR width & height
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

function createMockJpegBuffer(width: number, height: number, totalSize = 8000): Buffer {
  const buf = Buffer.alloc(Math.max(totalSize, 30));
  // JPEG SOI marker
  buf[0] = 0xff; buf[1] = 0xd8;
  // SOF0 marker
  buf[2] = 0xff; buf[3] = 0xc0;
  // Length of SOF segment (e.g. 17 bytes)
  buf.writeUInt16BE(17, 4);
  // Precision (8-bit)
  buf[6] = 8;
  // Height & Width in SOF0
  buf.writeUInt16BE(height, 7);
  buf.writeUInt16BE(width, 9);
  return buf;
}

function createRealPngBuffer(width: number, height: number, pixelGen: (x: number, y: number) => [number, number, number]): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      const [r, g, b] = pixelGen(x, y);
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }
  const raw = PNG.sync.write(png);
  if (raw.length < 6000) {
    // Pad trailing bytes (ignored by PNG readers as extra trailing payload) to simulate realistic file size
    const padded = Buffer.alloc(6500);
    raw.copy(padded, 0);
    return padded;
  }
  return raw;
}

function createRealJpegBuffer(width: number, height: number, pixelGen: (x: number, y: number) => [number, number, number]): Buffer {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) * 4;
      const [r, g, b] = pixelGen(x, y);
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  const rawImageData = { data, width, height };
  const encoded = jpeg.encode(rawImageData, 90);
  return encoded.data;
}

function runTests() {
  console.log('--- Running scanQuality boundary unit tests ---');

  // Test 1: Valid clear portrait page (800x1100)
  const validBuf = createMockPngBuffer(800, 1100);
  const validRes = analyzeScanQuality(validBuf);
  if (validRes.status !== 'pass' || validRes.checks.resolution !== 'pass' || validRes.checks.orientation !== 'pass') {
    throw new Error(`Test 1 Failed: Expected status pass, got ${validRes.status} (reasons: ${validRes.reasons.join(', ')})`);
  }
  console.log('✓ Test 1 Passed: Valid clear portrait page yields status pass');

  // Test 2: Too small resolution (400x400)
  const smallBuf = createMockPngBuffer(400, 400);
  const smallRes = analyzeScanQuality(smallBuf);
  if (smallRes.status !== 'reject' || smallRes.canOverride !== false || smallRes.checks.resolution !== 'fail') {
    throw new Error(`Test 2 Failed: Expected status reject with canOverride false for low resolution`);
  }
  console.log('✓ Test 2 Passed: Low-resolution image yields status reject with canOverride false');

  // Test 3: Rotated landscape page (1400x800)
  const rotatedBuf = createMockPngBuffer(1400, 800);
  const rotatedRes = analyzeScanQuality(rotatedBuf);
  if (rotatedRes.status !== 'warning' || rotatedRes.checks.orientation !== 'warning' || rotatedRes.canOverride !== true) {
    throw new Error(`Test 3 Failed: Expected status warning for rotated image`);
  }
  console.log('✓ Test 3 Passed: Rotated landscape page yields orientation warning with canOverride true');

  // Test 4: Empty / Corrupt small file (< 5KB)
  const tinyBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const tinyRes = analyzeScanQuality(tinyBuf);
  if (tinyRes.status !== 'reject' || tinyRes.canOverride !== false) {
    throw new Error(`Test 4 Failed: Expected status reject for corrupt/small file`);
  }
  console.log('✓ Test 4 Passed: Corrupt/small file (<5KB) yields status reject');

  // Test 5: File exceeding 25MB limit
  const hugeBuf = Buffer.alloc(26 * 1024 * 1024);
  const hugeRes = analyzeScanQuality(hugeBuf);
  if (hugeRes.status !== 'reject' || hugeRes.canOverride !== false) {
    throw new Error(`Test 5 Failed: Expected status reject for file exceeding 25MB`);
  }
  console.log('✓ Test 5 Passed: Exceeding 25MB limit yields status reject');

  // Test 6: Unsupported file format (e.g. image/gif)
  const gifRes = analyzeScanQuality(validBuf, 'image/gif');
  if (gifRes.status !== 'reject' || gifRes.canOverride !== false) {
    throw new Error(`Test 6 Failed: Expected status reject for unsupported mime type 'image/gif'`);
  }
  console.log('✓ Test 6 Passed: Unsupported image type yields status reject');

  // Test 7: JPEG SOF parsing
  const jpegBuf = createMockJpegBuffer(900, 1200);
  const jpegRes = analyzeScanQuality(jpegBuf, 'image/jpeg');
  if (jpegRes.status !== 'pass' || jpegRes.metrics.width !== 900 || jpegRes.metrics.height !== 1200) {
    throw new Error(`Test 7 Failed: Expected JPEG dimensions 900x1200, got ${jpegRes.metrics.width}x${jpegRes.metrics.height}`);
  }
  console.log('✓ Test 7 Passed: Valid JPEG header parsing yields dimensions and status pass');

  // Test 8: Boundary minimum resolution (600x600)
  const boundaryBuf = createMockPngBuffer(600, 600);
  const boundaryRes = analyzeScanQuality(boundaryBuf);
  if (boundaryRes.status !== 'pass' || boundaryRes.checks.resolution !== 'pass') {
    throw new Error(`Test 8 Failed: Expected 600x600 to pass resolution check`);
  }
  console.log('✓ Test 8 Passed: Boundary 600x600 resolution passes resolution check');

  // --- Pixel-level checks with decoded raster data ---

  // Test 9: Real PNG in-focus worksheet page with dark text on light paper
  const realGoodPng = createRealPngBuffer(600, 800, (x, y) => {
    // 80% white paper (240), 20% dark printed text lines (30)
    const isTextLine = (y % 40 < 4) && (x % 20 < 14);
    const val = isTextLine ? 30 : 240;
    return [val, val, val];
  });
  const goodRes = analyzeScanQuality(realGoodPng);
  if (
    goodRes.status !== 'pass' ||
    goodRes.checks.brightness !== 'pass' ||
    goodRes.checks.contrast !== 'pass' ||
    goodRes.checks.blur !== 'pass'
  ) {
    throw new Error(
      `Test 9 Failed: Expected all pass for crisp scan, got status=${goodRes.status}, checks=${JSON.stringify(goodRes.checks)}, metrics=${JSON.stringify(goodRes.metrics)}`
    );
  }
  console.log(`✓ Test 9 Passed: Crisp in-focus PNG scan passes brightness, contrast, and blur checks (metrics: brightness=${goodRes.metrics.brightness}, contrast=${goodRes.metrics.contrast}, sharpness=${goodRes.metrics.sharpness})`);

  // Test 10: Real PNG underexposed / dark scan (mean luminance < 45)
  const realDarkPng = createRealPngBuffer(600, 800, (x, y) => {
    // Dark paper / underexposed camera capture with natural noise (15-35)
    const noise = ((x * 17 + y * 31) % 15);
    const val = 20 + noise;
    return [val, val, val];
  });
  const darkRes = analyzeScanQuality(realDarkPng);
  if (darkRes.status !== 'warning' || darkRes.checks.brightness !== 'warning') {
    throw new Error(`Test 10 Failed: Expected brightness warning for underexposed scan, got status=${darkRes.status}, checks=${JSON.stringify(darkRes.checks)}, size=${realDarkPng.length}`);
  }
  console.log(`✓ Test 10 Passed: Underexposed PNG triggers brightness warning (brightness=${darkRes.metrics.brightness})`);

  // Test 11: Real PNG overexposed / washed out scan (mean luminance > 235)
  const realBrightPng = createRealPngBuffer(600, 800, (x, y) => {
    // Overexposed washed out capture with natural high-end noise (238-254)
    const noise = ((x * 13 + y * 29) % 15);
    const val = 239 + noise;
    return [val, val, val];
  });
  const brightRes = analyzeScanQuality(realBrightPng);
  if (brightRes.status !== 'warning' || brightRes.checks.brightness !== 'warning') {
    throw new Error(`Test 11 Failed: Expected brightness warning for overexposed scan, got status=${brightRes.status}, checks=${JSON.stringify(brightRes.checks)}, size=${realBrightPng.length}`);
  }
  console.log(`✓ Test 11 Passed: Overexposed PNG triggers brightness warning (brightness=${brightRes.metrics.brightness})`);

  // Test 12: Real PNG low contrast scan (standard deviation < 15)
  const realLowContrastPng = createRealPngBuffer(600, 800, (x, y) => {
    // Gray scan with noise between 120 and 128 (std dev ~ 2.5 < 15)
    const noise = ((x * 7 + y * 11) % 8);
    const val = 120 + noise;
    return [val, val, val];
  });
  const lowContrastRes = analyzeScanQuality(realLowContrastPng);
  if (lowContrastRes.status !== 'warning' || lowContrastRes.checks.contrast !== 'warning') {
    throw new Error(`Test 12 Failed: Expected contrast warning for flat low contrast scan, got status=${lowContrastRes.status}, checks=${JSON.stringify(lowContrastRes.checks)}, size=${realLowContrastPng.length}`);
  }
  console.log(`✓ Test 12 Passed: Low-contrast PNG triggers contrast warning (contrast std dev=${lowContrastRes.metrics.contrast})`);

  // Test 13: Real PNG blurry image with smooth linear gradient (Laplacian variance < 50)
  const realBlurryPng = createRealPngBuffer(600, 800, (x, _y) => {
    // Smooth gradual ramp from 80 to 180 across 600px width.
    // Contrast is high (~29), but Laplacian second-derivative is ~0.
    const val = Math.round(80 + (x / 600) * 100);
    return [val, val, val];
  });
  const blurryRes = analyzeScanQuality(realBlurryPng);
  if (blurryRes.status !== 'warning' || blurryRes.checks.blur !== 'warning') {
    throw new Error(`Test 13 Failed: Expected blur warning for smooth gradient image, got status=${blurryRes.status}, checks=${JSON.stringify(blurryRes.checks)}`);
  }
  console.log(`✓ Test 13 Passed: Blurry gradient PNG triggers blur warning (sharpness=${blurryRes.metrics.sharpness})`);

  // Test 14: Real JPEG scan with high-contrast sharp grid
  const realGoodJpeg = createRealJpegBuffer(600, 800, (x, y) => {
    const isLine = (x % 30 < 3) || (y % 30 < 3);
    const val = isLine ? 20 : 230;
    return [val, val, val];
  });
  const goodJpegRes = analyzeScanQuality(realGoodJpeg, 'image/jpeg');
  if (
    goodJpegRes.status !== 'pass' ||
    goodJpegRes.checks.brightness !== 'pass' ||
    goodJpegRes.checks.contrast !== 'pass' ||
    goodJpegRes.checks.blur !== 'pass'
  ) {
    throw new Error(`Test 14 Failed: Expected all pass for crisp JPEG scan, got ${JSON.stringify(goodJpegRes)}`);
  }
  console.log(`✓ Test 14 Passed: Crisp in-focus JPEG scan passes all pixel and header checks`);

  console.log('--- All 14 scanQuality boundary & pixel unit tests passed 100% cleanly! ---');
}

runTests();

