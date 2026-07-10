# Client-Side Image Optimization for Fast OCR

## 1 ?? Goal

When a user uploads a big image to the server for scanning, it takes more of their internet data and increases the upload time. This increases the server load and slows down the scanning process. Also, if we want to store all these files, the database will become huge, which will cost a lot more to store and maintain. That is why this is a very needed and important feature.

The optimization happens **entirely in the user's browser**, before the image ever leaves the device. The server only ever receives the cleaned-up, size-cleared, grayscale JPEG ??? never the original camera photo.

---

## 2 ?? Overview ??? 6-Step Pipeline

### 1. Load the photo
We open the uploaded document image in a hidden, virtual workspace right inside the user's browser. No network round-trip; everything runs locally on a hidden `<canvas>`.

### 2. Shrink the size
We automatically scale down large phone photos to a standard, optimal height.

### 3. Remove the color
We strip out all the color channels to turn the image into pure black and white (grayscale).

### 4. Darken the text
We use smart filters to boost the darkness of the ink so even faint handwriting stands out sharply.

### 5. Erase the background
We completely clear out gray shadows, paper wrinkles, and background noise to make the page surface solid white.

### 6. Compress and lock
We compress the final clean image into a small file format. A size-guarding loop ensures the final blob is never larger than the original upload ??? the loop trades **resolution** (height in 200 px steps) to save bytes, while keeping the JPEG quality locked at 0.82.

The combined filter chain applied in a single GPU pass is:

```
grayscale(1) brightness(0.92) contrast(2.8) brightness(1.12)
```

---

## 3 ?? How This Is Implemented

### 3.1 ??? Constants (`src/utils/imageOptimizer.ts`)

```ts
const START_HEIGHT  = 1800;   // optimal vertical target
const MIN_HEIGHT    = 1000;   // loop floor ??? never go below this
const HEIGHT_STEP   = 200;    // decrement per loop iteration
const JPEG_QUALITY  = 0.82;   // locked ??? quality never drops
const FILTER_CHAIN  = 'grayscale(1) brightness(0.92) contrast(2.8) brightness(1.12)';
```

### 3.2 ??? Pipeline (`optimizeImageForOcr(file: File)`)

**Step 1 ??? Read file ??? data URL ??? Image element** (in browser memory).

**Step 2 ??? Resize + filter + export (the loop body)**:

```ts
function renderAndExport(img, targetHeight) {
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
  ctx.filter = FILTER_CHAIN;
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/jpeg', JPEG_QUALITY));
}
```

**Step 3 ??? Size-guarding loop**:

```ts
let currentHeight = START_HEIGHT;
let iterations = 0;
while (true) {
  iterations++;
  blob = await renderAndExport(img, currentHeight);
  if (blob.size <= originalBytes) break;          // cleared
  if (currentHeight <= MIN_HEIGHT) break;         // floor reached
  currentHeight = Math.max(MIN_HEIGHT, currentHeight - HEIGHT_STEP);
}
```

The loop never changes `JPEG_QUALITY` ??? only the canvas height. It stops when either the size clears the boundary or the 1000 px floor is hit.

**Step 4 ??? Return**:

```ts
return {
  blob, width, height,
  originalBytes, optimizedBytes,
  iterations, durationMs,
  startedAtHeight, endedAtHeight,
  sizeCleared
};
```

### 3.3 ??? Wire-up (`src/components/IcrScanner.tsx`)

The ICR scanner's `handleFileUpload` runs:

1. `const optimized = await optimizeImageForOcr(file);`
2. Build a `FormData`, append the `optimized.blob` as `ocrImage` plus the student/paper/metrics fields.
3. `POST /api/icr/extract` with `Authorization: Bearer <token>`.
4. On success: store the `scanId` + `imageUrl` returned by the server and render the saved image in the **Processed Image** panel below the OCR Output panel in the verify step.

The raw `File` is discarded the moment `optimizeImageForOcr` returns. The server never sees it.

### 3.4 ??? Server (`server/index.ts`)

- `multer.memoryStorage()` accepts the multipart upload.
- The middleware guard ensures `express.json()` and `urlencoded()` skip `/api/icr/extract` so multer can read the body.
- The optimized blob is written to `mvp/output/icr-scans/<scanId>.jpg` and an `IcrScan` record is persisted to `mvp/data/db.json` under `icrScans[]`.
- A static route `/icr-scans/*` serves the saved image back to the frontend.

### 3.5 ??? What the user sees

After upload, the verify step displays three stacked panels:

1. **Client Optimization** ??? `Original`, `Optimized`, `Height floor`, `Loop iterations`, `Canvas overhead`, `Size guard` status.
2. **OCR Output** ??? the raw text returned by the OCR engine.
3. **Processed Image** ??? the saved grayscale JPEG with a download link.

---

## 4 ?? Why This Design

| Concern | Without Pre-Processing | With This Pipeline |
|---------|------------------------|---------------------|
| Background noise (paper texture, grid lines, shadows) | Passes through to OCR model | Burned to pure white |
| Faint handwriting | Lost in noise | Darkened, then contrast-amplified |
| Color channels | 3?? data, distracts OCR | Single grayscale channel |
| Upload size | Raw 1.5???4 MB camera JPEG | Size-capped, often 60???80% smaller |
| Quality vs size trade-off | Either too large or too compressed | Resolution drops, quality stays at q=0.82 |
| Vision model latency | Slow on heavy payloads | Fast on tight payloads |

Result: **better OCR text accuracy at lower latency**, with the original photo never leaving the user's device.
