import { analyzeScanQuality } from './scanQuality';

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

  console.log('--- All 8 scanQuality tests passed 100% cleanly! ---');
}

runTests();
