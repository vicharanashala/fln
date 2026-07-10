export interface OptimizedImage {
  blob: Blob;
  width: number;
  height: number;
  originalBytes: number;
  optimizedBytes: number;
  iterations: number;
  durationMs: number;
  startedAtHeight: number;
  endedAtHeight: number;
  sizeCleared: boolean;
}

const START_HEIGHT = 1800;
const MIN_HEIGHT = 1000;
const HEIGHT_STEP = 200;
const JPEG_QUALITY = 0.82;
const FILTER_CHAIN = 'grayscale(1) brightness(0.92) contrast(2.8) brightness(1.12)';

async function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve((ev.target?.result as string) || '');
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = src;
  });
}

async function renderAndExport(
  img: HTMLImageElement,
  targetHeight: number
): Promise<Blob> {
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (h > targetHeight) {
    const ratio = targetHeight / h;
    w = Math.round(w * ratio);
    h = targetHeight;
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.filter = FILTER_CHAIN;
  ctx.drawImage(img, 0, 0, w, h);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      JPEG_QUALITY
    );
  });
}

export async function optimizeImageForOcr(file: File): Promise<OptimizedImage> {
  const start = performance.now();
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const originalBytes = file.size;
  let currentHeight = START_HEIGHT;
  let iterations = 0;
  let blob: Blob;
  let finalWidth = img.naturalWidth;
  let finalHeight = img.naturalHeight;

  while (true) {
    iterations++;
    blob = await renderAndExport(img, currentHeight);
    finalWidth = img.naturalWidth;
    finalHeight = img.naturalHeight;

    if (currentHeight === START_HEIGHT && finalHeight <= START_HEIGHT) {
      finalWidth = img.naturalWidth;
      finalHeight = img.naturalHeight;
    } else {
      if (img.naturalHeight > currentHeight) {
        const ratio = currentHeight / img.naturalHeight;
        finalWidth = Math.round(img.naturalWidth * ratio);
      } else {
        finalWidth = img.naturalWidth;
      }
      finalHeight = Math.min(currentHeight, img.naturalHeight);
    }

    if (blob.size <= originalBytes) break;
    if (currentHeight <= MIN_HEIGHT) break;
    currentHeight = Math.max(MIN_HEIGHT, currentHeight - HEIGHT_STEP);
  }

  const durationMs = Math.round(performance.now() - start);
  const sizeCleared = blob.size <= originalBytes;

  return {
    blob,
    width: finalWidth,
    height: finalHeight,
    originalBytes,
    optimizedBytes: blob.size,
    iterations,
    durationMs,
    startedAtHeight: START_HEIGHT,
    endedAtHeight: currentHeight,
    sizeCleared
  };
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
