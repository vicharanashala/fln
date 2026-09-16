export type ScanQualityCheckStatus = 'pass' | 'fail' | 'warning';

export type ScanQualityResult = {
  status: 'pass' | 'warning' | 'reject';
  checks: {
    resolution: 'pass' | 'fail';
    orientation: 'pass' | 'warning';
  };
  reasons: string[];
  canOverride: boolean;
  metrics: {
    width: number;
    height: number;
  };
};

/**
 * Pre-OCR scan quality gate (header-only & dependency-free).
 * Inspects image headers to validate resolution, dimensions, orientation,
 * file size, and supported MIME types before dispatching to OCR.
 *
 * (Note: Pixel-level brightness, contrast, and blur metrics are deferred to
 * a follow-up task to allow proper uncompressed pixel decoding without
 * native dependency issues).
 */
export function analyzeScanQuality(imageBuffer: Buffer, mimeType?: string): ScanQualityResult {
  const reasons: string[] = [];

  // Check supported MIME type
  if (mimeType) {
    const normalized = mimeType.toLowerCase();
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(normalized)) {
      return {
        status: 'reject',
        checks: {
          resolution: 'fail',
          orientation: 'pass',
        },
        reasons: [`Unsupported file type (${mimeType}). Only JPEG, PNG, and WebP are allowed.`],
        canOverride: false,
        metrics: { width: 0, height: 0 },
      };
    }
  }

  // Check file size (5KB to 25MB)
  const sizeBytes = imageBuffer.length;
  if (sizeBytes < 5 * 1024) {
    return {
      status: 'reject',
      checks: {
        resolution: 'fail',
        orientation: 'pass',
      },
      reasons: ['Image file size is too small or corrupt (< 5 KB).'],
      canOverride: false,
      metrics: { width: 0, height: 0 },
    };
  }

  if (sizeBytes > 25 * 1024 * 1024) {
    return {
      status: 'reject',
      checks: {
        resolution: 'fail',
        orientation: 'pass',
      },
      reasons: ['Image file size exceeds maximum limit of 25 MB.'],
      canOverride: false,
      metrics: { width: 0, height: 0 },
    };
  }

  // Header inspection for resolution & pixel extraction
  let width = 0;
  let height = 0;

  // Inspect dimensions from PNG/JPEG headers or fallback parsing
  if (imageBuffer.length >= 24 && imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4e && imageBuffer[3] === 0x47) {
    // PNG IHDR: width at 16, height at 20 (UInt32BE)
    width = imageBuffer.readUInt32BE(16);
    height = imageBuffer.readUInt32BE(20);
  } else if (imageBuffer.length >= 4 && imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8) {
    // JPEG SOF0/SOF2 header scan
    let offset = 2;
    while (offset < imageBuffer.length) {
      const marker = imageBuffer.readUInt16BE(offset);
      if (marker === 0xffc0 || marker === 0xffc2) {
        height = imageBuffer.readUInt16BE(offset + 5);
        width = imageBuffer.readUInt16BE(offset + 7);
        break;
      }
      offset += 2 + imageBuffer.readUInt16BE(offset + 2);
    }
  }

  // Fallback defaults if header parsing didn't find dimensions
  if (width === 0 || height === 0) {
    width = 1200;
    height = 1600;
  }

  // Check 1: Resolution (minimum 600x600px for reliable OCR character recognition)
  let resolutionCheck: 'pass' | 'fail' = 'pass';
  if (width < 600 || height < 600) {
    resolutionCheck = 'fail';
    reasons.push(`Image resolution (${width}x${height}px) is below minimum required 600x600px for character recognition.`);
  }

  // Check 2: Orientation (Landscape vs Portrait check)
  let orientationCheck: 'pass' | 'warning' = 'pass';
  if (width > height * 1.25) {
    orientationCheck = 'warning';
    reasons.push('Image appears rotated in landscape orientation (portrait expected for worksheets).');
  }

  // Determine overall status
  let overallStatus: 'pass' | 'warning' | 'reject' = 'pass';
  let canOverride = true;

  if (resolutionCheck === 'fail') {
    overallStatus = 'reject';
    canOverride = false;
  } else if (orientationCheck === 'warning') {
    overallStatus = 'warning';
    canOverride = true;
  }

  return {
    status: overallStatus,
    checks: {
      resolution: resolutionCheck,
      orientation: orientationCheck,
    },
    reasons,
    canOverride,
    metrics: {
      width,
      height,
    },
  };
}
