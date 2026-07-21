export const IMAGE_PIPELINE_CONFIG = {
  TARGET_HEIGHT_PX: 1800,
  HEIGHT_STEP_PX: 200,
  MIN_HEIGHT_PX: 1000,
  JPEG_QUALITY: 0.82,
  CANVAS_FILTER:
    'grayscale(1) brightness(0.92) contrast(2.8) brightness(1.12)',
  MAX_OUTPUT_TYPE: 'image/jpeg',
} as const;

export interface ImageOptimizationResult {
  blob: Blob;
  originalSize: number;
  optimizedSize: number;
  appliedHeight: number;
  appliedWidth: number;
  iterations: number;
  sizeReduced: boolean;
}

export interface ImageOptimizationOptions {
  signal?: AbortSignal;
  onProgress?: (iteration: number, currentHeight: number) => void;
}

export class ImageOptimizationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ImageOptimizationError';
  }
}

const SUPPORTED_INPUT_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/bmp',
]);

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageOptimizationError('Failed to decode image file.'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new ImageOptimizationError('Canvas export produced no blob.'));
      },
      type,
      quality,
    );
  });
}

function computeDimensions(
  naturalWidth: number,
  naturalHeight: number,
  targetHeight: number,
): { width: number; height: number } {
  if (naturalHeight <= 0 || naturalWidth <= 0) {
    throw new ImageOptimizationError('Image has invalid dimensions.');
  }
  if (naturalHeight <= targetHeight) {
    return { width: naturalWidth, height: naturalHeight };
  }
  const ratio = targetHeight / naturalHeight;
  return {
    width: Math.max(1, Math.round(naturalWidth * ratio)),
    height: targetHeight,
  };
}

function drawProcessed(
  img: HTMLImageElement,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new ImageOptimizationError('Could not acquire 2D canvas context.');
  }
  ctx.filter = IMAGE_PIPELINE_CONFIG.CANVAS_FILTER;
  ctx.drawImage(img, 0, 0, width, height);
  ctx.filter = 'none';
  return canvas;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new ImageOptimizationError('Image optimization aborted.');
  }
}

export function isSupportedImageType(file: File): boolean {
  if (file.type && SUPPORTED_INPUT_TYPES.has(file.type.toLowerCase())) return true;
  return /\.(jpe?g|png|webp|bmp)$/i.test(file.name);
}

export async function optimizeAnswerSheetImage(
  file: File,
  options: ImageOptimizationOptions = {},
): Promise<ImageOptimizationResult> {
  if (!isSupportedImageType(file)) {
    throw new ImageOptimizationError(
      `Unsupported image type: ${file.type || 'unknown'}. Use JPEG, PNG, WEBP, or BMP.`,
    );
  }

  throwIfAborted(options.signal);
  const img = await loadImage(file);
  throwIfAborted(options.signal);

  const originalSize = file.size;
  const { TARGET_HEIGHT_PX, HEIGHT_STEP_PX, MIN_HEIGHT_PX, JPEG_QUALITY } =
    IMAGE_PIPELINE_CONFIG;

  let currentHeight = Math.min(TARGET_HEIGHT_PX, img.naturalHeight);
  let iterations = 0;
  let blob: Blob | null = null;
  let appliedWidth = 0;

  while (true) {
    throwIfAborted(options.signal);
    iterations += 1;
    options.onProgress?.(iterations, currentHeight);

    const dims = computeDimensions(img.naturalWidth, img.naturalHeight, currentHeight);
    appliedWidth = dims.width;
    const canvas = drawProcessed(img, dims.width, dims.height);
    blob = await canvasToBlob(canvas, IMAGE_PIPELINE_CONFIG.MAX_OUTPUT_TYPE, JPEG_QUALITY);

    if (blob.size < originalSize) break;

    const nextHeight = currentHeight - HEIGHT_STEP_PX;
    if (nextHeight < MIN_HEIGHT_PX) break;
    if (nextHeight >= img.naturalHeight) break;
    currentHeight = nextHeight;
  }

  if (!blob) {
    throw new ImageOptimizationError('Optimization produced no output.');
  }

  return {
    blob,
    originalSize,
    optimizedSize: blob.size,
    appliedHeight: currentHeight,
    appliedWidth,
    iterations,
    sizeReduced: blob.size < originalSize,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}