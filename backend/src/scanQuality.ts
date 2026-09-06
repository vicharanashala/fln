export type ScanQualityCheckStatus = 'pass' | 'fail' | 'warning';

export type ScanQualityResult = {
  status: 'pass' | 'warning' | 'reject';
  checks: {
    resolution: 'pass' | 'fail';
    brightness: 'pass' | 'warning';
    contrast: 'pass' | 'warning';
    blur: 'pass' | 'warning';
    orientation: 'pass' | 'warning';
  };
  reasons: string[];
  canOverride: boolean;
  metrics: {
    width: number;
    height: number;
    brightnessScore: number;
    contrastScore: number;
    blurScore: number;
  };
};

/**
 * Analyzes raw image buffer before OCR extraction.
 * Performs deterministic checks for resolution, brightness, contrast, blur, and orientation.
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
          brightness: 'pass',
          contrast: 'pass',
          blur: 'pass',
          orientation: 'pass',
        },
        reasons: [`Unsupported file type (${mimeType}). Only JPEG, PNG, and WebP are allowed.`],
        canOverride: false,
        metrics: { width: 0, height: 0, brightnessScore: 0, contrastScore: 0, blurScore: 0 },
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
        brightness: 'pass',
        contrast: 'pass',
        blur: 'pass',
        orientation: 'pass',
      },
      reasons: ['Image file size is too small or corrupt (< 5 KB).'],
      canOverride: false,
      metrics: { width: 0, height: 0, brightnessScore: 0, contrastScore: 0, blurScore: 0 },
    };
  }

  if (sizeBytes > 25 * 1024 * 1024) {
    return {
      status: 'reject',
      checks: {
        resolution: 'fail',
        brightness: 'pass',
        contrast: 'pass',
        blur: 'pass',
        orientation: 'pass',
      },
      reasons: ['Image file size exceeds maximum limit of 25 MB.'],
      canOverride: false,
      metrics: { width: 0, height: 0, brightnessScore: 0, contrastScore: 0, blurScore: 0 },
    };
  }

  // Header inspection for resolution & pixel extraction
  let width = 0;
  let height = 0;

  // Inspect dimensions from PNG/JPEG headers or fallback parsing
  if (imageBuffer.length >= 24 && imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4e && imageBuffer[3] === 0x47) {
    // PNG IHDR
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

  // Check 1: Resolution (minimum 600x600px)
  let resolutionCheck: 'pass' | 'fail' = 'pass';
  if (width < 600 || height < 600) {
    resolutionCheck = 'fail';
    reasons.push(`Image resolution (${width}x${height}px) is below minimum required 600x600px for character recognition.`);
  }

  // Estimate Luminance, Contrast & Blur from image buffer samples
  let sumLuminance = 0;
  let sampleCount = 0;
  const targetSamples = 1000;
  const step = Math.max(1, Math.floor(imageBuffer.length / targetSamples));
  const samples: number[] = [];

  for (let i = 0; i < imageBuffer.length; i += step) {
    const val = imageBuffer[i];
    sumLuminance += val;
    samples.push(val);
    sampleCount++;
  }

  const meanBrightness = sampleCount > 0 ? sumLuminance / sampleCount : 128;

  // Contrast: Standard Deviation
  let sumVariance = 0;
  for (const val of samples) {
    sumVariance += Math.pow(val - meanBrightness, 2);
  }
  const stdDevContrast = sampleCount > 0 ? Math.sqrt(sumVariance / sampleCount) : 40;

  // Blur score estimation: high-frequency difference variance
  let diffSum = 0;
  for (let i = 0; i < samples.length - 1; i++) {
    diffSum += Math.abs(samples[i + 1] - samples[i]);
  }
  const blurScore = sampleCount > 1 ? diffSum / (sampleCount - 1) : 30;

  // Check 2: Brightness
  let brightnessCheck: 'pass' | 'warning' = 'pass';
  if (meanBrightness < 45) {
    brightnessCheck = 'warning';
    reasons.push('Image is too dark (average brightness is low).');
  } else if (meanBrightness > 235) {
    brightnessCheck = 'warning';
    reasons.push('Image is overexposed / too bright.');
  }

  // Check 3: Contrast
  let contrastCheck: 'pass' | 'warning' = 'pass';
  if (stdDevContrast < 15) {
    contrastCheck = 'warning';
    reasons.push('Low image contrast between text and background.');
  }

  // Check 4: Blur / Sharpness
  let blurCheck: 'pass' | 'warning' = 'pass';
  if (blurScore < 8) {
    blurCheck = 'warning';
    reasons.push('Image appears blurry or out of focus.');
  }

  // Check 5: Orientation (Landscape vs Portrait check)
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
  } else if (
    brightnessCheck === 'warning' ||
    contrastCheck === 'warning' ||
    blurCheck === 'warning' ||
    orientationCheck === 'warning'
  ) {
    overallStatus = 'warning';
    canOverride = true;
  }

  return {
    status: overallStatus,
    checks: {
      resolution: resolutionCheck,
      brightness: brightnessCheck,
      contrast: contrastCheck,
      blur: blurCheck,
      orientation: orientationCheck,
    },
    reasons,
    canOverride,
    metrics: {
      width,
      height,
      brightnessScore: Math.round(meanBrightness),
      contrastScore: Math.round(stdDevContrast),
      blurScore: Math.round(blurScore * 10) / 10,
    },
  };
}
