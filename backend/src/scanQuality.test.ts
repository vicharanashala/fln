import { analyzeScanQuality } from './scanQuality';

function createMockPngBuffer(width: number, height: number, fillByte = 128, addVariance = true): Buffer {
  const buf = Buffer.alloc(Math.max(100, width * height * 2));
  // PNG IHDR magic bytes
  buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4e; buf[3] = 0x47;
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  const step = Math.max(1, Math.floor(buf.length / 1000));
  for (let i = 24; i < buf.length; i++) {
    const idx = Math.floor(i / step);
    const noise = addVariance ? (idx % 2 === 0 ? 80 : -80) : 0;
    buf[i] = Math.min(255, Math.max(0, fillByte + noise));
  }
  return buf;
}

function runTests() {
  console.log('--- Running scanQuality boundary unit tests ---');

  // Test 1: Valid clear page (800x1100, moderate brightness, high contrast)
  const validBuf = createMockPngBuffer(800, 1100, 140, true);
  const validRes = analyzeScanQuality(validBuf);
  if (validRes.status !== 'pass') {
    throw new Error(`Test 1 Failed: Expected status pass, got ${validRes.status} (reasons: ${validRes.reasons.join(', ')})`);
  }
  console.log('✓ Test 1 Passed: Valid clear page yields status pass');

  // Test 2: Too small resolution (400x400)
  const smallBuf = createMockPngBuffer(400, 400, 140, true);
  const smallRes = analyzeScanQuality(smallBuf);
  if (smallRes.status !== 'reject' || smallRes.canOverride !== false || smallRes.checks.resolution !== 'fail') {
    throw new Error(`Test 2 Failed: Expected status reject with canOverride false for low resolution`);
  }
  console.log('✓ Test 2 Passed: Low-resolution image yields status reject with canOverride false');

  // Test 3: Very dark page
  const darkBuf = createMockPngBuffer(1000, 1400, 20, false);
  const darkRes = analyzeScanQuality(darkBuf);
  if (darkRes.status !== 'warning' || darkRes.checks.brightness !== 'warning' || darkRes.canOverride !== true) {
    throw new Error(`Test 3 Failed: Expected status warning for dark image`);
  }
  console.log('✓ Test 3 Passed: Dark page yields brightness warning with canOverride true');

  // Test 4: Rotated landscape page (1400x800)
  const rotatedBuf = createMockPngBuffer(1400, 800, 140, true);
  const rotatedRes = analyzeScanQuality(rotatedBuf);
  if (rotatedRes.status !== 'warning' || rotatedRes.checks.orientation !== 'warning') {
    throw new Error(`Test 4 Failed: Expected status warning for rotated image`);
  }
  console.log('✓ Test 4 Passed: Rotated landscape page yields orientation warning');

  // Test 5: Empty / Corrupt small file
  const tinyBuf = Buffer.from([0x89, 0x50, 0x4e]);
  const tinyRes = analyzeScanQuality(tinyBuf);
  if (tinyRes.status !== 'reject' || tinyRes.canOverride !== false) {
    throw new Error(`Test 5 Failed: Expected status reject for corrupt file`);
  }
  console.log('✓ Test 5 Passed: Corrupt file yields status reject');

  // Test 6: Unsupported file format (e.g. application/pdf or image/gif)
  const gifRes = analyzeScanQuality(validBuf, 'image/gif');
  if (gifRes.status !== 'reject' || gifRes.canOverride !== false) {
    throw new Error(`Test 6 Failed: Expected status reject for unsupported mime type 'image/gif'`);
  }
  console.log('✓ Test 6 Passed: Unsupported image type yields status reject');

  // Test 7: Overexposed bright image
  const brightBuf = createMockPngBuffer(1000, 1400, 245, false);
  const brightRes = analyzeScanQuality(brightBuf);
  if (brightRes.status !== 'warning' || brightRes.checks.brightness !== 'warning') {
    throw new Error(`Test 7 Failed: Expected status warning for overexposed bright image`);
  }
  console.log('✓ Test 7 Passed: Overexposed bright page yields brightness warning');

  // Test 8: Low-contrast image
  const lowContrastBuf = createMockPngBuffer(1000, 1400, 128, false);
  const lowContrastRes = analyzeScanQuality(lowContrastBuf);
  if (lowContrastRes.status !== 'warning' || lowContrastRes.checks.contrast !== 'warning') {
    throw new Error(`Test 8 Failed: Expected status warning for low contrast image`);
  }
  console.log('✓ Test 8 Passed: Low-contrast page yields contrast warning');

  console.log('--- All 8 scanQuality tests passed 100% cleanly! ---');
}

runTests();
