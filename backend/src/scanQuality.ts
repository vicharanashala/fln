import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

export type ScanQualityCheckStatus = 'pass' | 'fail' | 'warning';

export type ScanQualityResult = {
  status: 'pass' | 'warning' | 'reject';
  checks: {
    resolution: 'pass' | 'fail';
    orientation: 'pass' | 'warning';
    brightness?: 'pass' | 'warning';
    contrast?: 'pass' | 'warning';
    blur?: 'pass' | 'warning';
  };
  reasons: string[];
  canOverride: boolean;
  metrics: {
    width: number;
    height: number;
    brightness?: number;
    contrast?: number;
    sharpness?: number;
  };
};

interface DecodedRaster {
  width: number;
  height: number;
  luminance: Float32Array;
}

/**
 * Decodes compressed image buffer (PNG or JPEG) to uncompressed grayscale luminance raster.
 * Luminance is computed per pixel as 0.299*R + 0.587*G + 0.114*B.
 */
function decodeToLuminanceRaster(imageBuffer: Buffer): DecodedRaster | null {
  try {
    // Try PNG decoding
    if (imageBuffer.length >= 8 && imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4e && imageBuffer[3] === 0x47) {
      const png = PNG.sync.read(imageBuffer);
      const width = png.width;
      const height = png.height;
      const data = png.data; // RGBA buffer
      const luminance = new Float32Array(width * height);
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        luminance[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      return { width, height, luminance };
    }

    // Try JPEG decoding
    if (imageBuffer.length >= 2 && imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8) {
      const decoded = jpeg.decode(imageBuffer, { useTArray: true, maxMemoryUsageInMB: 128 });
      const width = decoded.width;
      const height = decoded.height;
      const data = decoded.data; // RGBA Uint8Array
      const luminance = new Float32Array(width * height);
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        luminance[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      return { width, height, luminance };
    }
  } catch (_err) {
    // Return null if decode fails (e.g. partial/mock stream or unsupported subformat)
    return null;
  }

  return null;
}

/**
 * Computes brightness (mean luminance), contrast (standard deviation of luminance),
 * and focus/sharpness (discrete Laplacian variance) on decoded raster pixels.
 */
function analyzeRasterMetrics(raster: DecodedRaster): {
  brightness: number;
  contrast: number;
  sharpness: number;
} {
  const { width, height, luminance } = raster;
  const totalPixels = luminance.length;

  if (totalPixels === 0) {
    return { brightness: 0, contrast: 0, sharpness: 0 };
  }

  // 1. Mean luminance (Brightness)
  let sum = 0;
  for (let i = 0; i < totalPixels; i++) {
    sum += luminance[i];
  }
  const mean = sum / totalPixels;

  // 2. Standard deviation of luminance (Contrast)
  let sumSqDiff = 0;
  for (let i = 0; i < totalPixels; i++) {
    const diff = luminance[i] - mean;
    sumSqDiff += diff * diff;
  }
  const stdDev = Math.sqrt(sumSqDiff / totalPixels);

  // 3. Discrete Laplacian Variance (Sharpness / Focus)
  // For interior pixels: L(x, y) = Y(x+1, y) + Y(x-1, y) + Y(x, y+1) + Y(x, y-1) - 4*Y(x, y)
  let laplacianSum = 0;
  let laplacianSumSq = 0;
  let laplacianCount = 0;

  if (width >= 3 && height >= 3) {
    for (let y = 1; y < height - 1; y++) {
      const rowOffset = y * width;
      const prevRowOffset = (y - 1) * width;
      const nextRowOffset = (y + 1) * width;

      for (let x = 1; x < width - 1; x++) {
        const center = luminance[rowOffset + x];
        const right = luminance[rowOffset + x + 1];
        const left = luminance[rowOffset + x - 1];
        const down = luminance[nextRowOffset + x];
        const up = luminance[prevRowOffset + x];

        const lap = right + left + down + up - 4 * center;
        laplacianSum += lap;
        laplacianSumSq += lap * lap;
        laplacianCount++;
      }
    }
  }

  let laplacianVar = 0;
  if (laplacianCount > 0) {
    const lapMean = laplacianSum / laplacianCount;
    laplacianVar = laplacianSumSq / laplacianCount - lapMean * lapMean;
    if (laplacianVar < 0) laplacianVar = 0;
  }

  return {
    brightness: Math.round(mean * 10) / 10,
    contrast: Math.round(stdDev * 10) / 10,
    sharpness: Math.round(laplacianVar * 10) / 10,
  };
}

/**
 * Pre-OCR scan quality gate with header inspection and uncompressed pixel raster analysis.
 * - Inspects headers for dimensions, orientation, file size, and MIME type.
 * - When valid image raster can be decoded, performs pixel-level checks for brightness,
 *   contrast, and blur (Laplacian variance).
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

  // Header inspection for resolution & dimensions
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

  // Pixel-level checks on decoded raster
  let brightnessCheck: 'pass' | 'warning' | undefined = undefined;
  let contrastCheck: 'pass' | 'warning' | undefined = undefined;
  let blurCheck: 'pass' | 'warning' | undefined = undefined;
  let pixelMetrics: { brightness?: number; contrast?: number; sharpness?: number } = {};

  const raster = decodeToLuminanceRaster(imageBuffer);
  if (raster) {
    // If raster has accurate dimensions, use them
    if (raster.width > 0 && raster.height > 0) {
      width = raster.width;
      height = raster.height;
    }

    const { brightness, contrast, sharpness } = analyzeRasterMetrics(raster);
    pixelMetrics = { brightness, contrast, sharpness };

    // Brightness check: mean < 45 (dark) or > 235 (overexposed)
    if (brightness < 45) {
      brightnessCheck = 'warning';
      reasons.push(`Image is underexposed/too dark (brightness: ${brightness}/255, minimum recommended is 45).`);
    } else if (brightness > 235) {
      brightnessCheck = 'warning';
      reasons.push(`Image is overexposed/washed out (brightness: ${brightness}/255, maximum recommended is 235).`);
    } else {
      brightnessCheck = 'pass';
    }

    // Contrast check: std dev < 15
    if (contrast < 15) {
      contrastCheck = 'warning';
      reasons.push(`Image has very low contrast (contrast std dev: ${contrast}, minimum recommended is 15).`);
    } else {
      contrastCheck = 'pass';
    }

    // Blur / Sharpness check: discrete Laplacian variance < 50
    if (sharpness < 50) {
      blurCheck = 'warning';
      reasons.push(`Image appears blurry or out of focus (sharpness variance: ${sharpness}, minimum recommended is 50).`);
    } else {
      blurCheck = 'pass';
    }
  }

  // Determine overall status
  let overallStatus: 'pass' | 'warning' | 'reject' = 'pass';
  let canOverride = true;

  if (resolutionCheck === 'fail') {
    overallStatus = 'reject';
    canOverride = false;
  } else if (
    orientationCheck === 'warning' ||
    brightnessCheck === 'warning' ||
    contrastCheck === 'warning' ||
    blurCheck === 'warning'
  ) {
    overallStatus = 'warning';
    canOverride = true;
  }

  const checks: ScanQualityResult['checks'] = {
    resolution: resolutionCheck,
    orientation: orientationCheck,
  };

  if (brightnessCheck !== undefined) checks.brightness = brightnessCheck;
  if (contrastCheck !== undefined) checks.contrast = contrastCheck;
  if (blurCheck !== undefined) checks.blur = blurCheck;

  return {
    status: overallStatus,
    checks,
    reasons,
    canOverride,
    metrics: {
      width,
      height,
      ...pixelMetrics,
    },
  };
}
