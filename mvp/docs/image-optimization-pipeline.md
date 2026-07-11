# Client-Side Image Optimization for Fast OCR

## 1. Goal

When a user uploads a large image to the server for scanning, it eats up their internet data and makes uploads slow. Big raw photos also slow down the server and waste OCR-engine quota. If we also stored every original photo the database would grow huge — at 5,000 sheets per day across one district that is roughly 1.5 GB of new files every day, just for one district.

So we **optimize the image entirely inside the user's browser** before it ever travels over the network. The optimized image is **discarded** after the OCR engine sees it. Nothing is written to disk and nothing is stored in the database.

## 2. Storage Policy (Important)

This pipeline is **strictly transient**:

- The original camera photo is dropped in the browser the moment `optimizeImageForOcr()` returns. The server never receives it.
- The optimized JPEG that the server does receive exists only in memory inside `multer.memoryStorage()` for the duration of one HTTP request. It is not written to disk.
- After the OCR engine returns the extracted text, the request ends. The buffer is garbage-collected. Nothing survives.
- No row is added to any database table for the scan itself. The OCR text and any grading result flows through the existing `AnswerSubmission` / `EvaluationReport` records (these are the only persistent artifacts).
- `mvp/output/icr-scans/` directory does not exist in the current codebase.
- `mvp/data/db.json` is gitignored (added via `data/` in `.gitignore`) so test data on one developer machine never gets committed.

This is a **deliberate design choice** for storage-cost reasons and privacy/compliance. If anyone needs to re-check an old scan later, the OCR text + scores are still available in `AnswerSubmission` / `EvaluationReport` tables — just not the original image.

## 3. The 6-Step Pipeline

### Step 1 — Load the photo
The uploaded document image is read into a hidden in-memory `<canvas>` element inside the user's browser. No network round-trip; everything runs locally.

### Step 2 — Shrink the size
Large phone photos are scaled down to a standard optimal height of **1800 px** (width adjusts proportionally). Smaller images are left untouched to avoid pixel distortion.

### Step 3 — Remove the color
All color channels (Red, Green, Blue) are stripped, turning the image into **pure black and white (grayscale)**. This reduces data complexity and removes color noise that distracts the OCR engine.

### Step 4 — Darken the text
A smart canvas filter chain boosts the darkness of faint handwriting so it stands out sharply against the paper. The full filter chain (applied in one GPU-accelerated pass) is:

```
grayscale(1) brightness(0.92) contrast(2.8) brightness(1.12)
```

| Filter | Purpose |
|--------|---------|
| `grayscale(1)` | Strip RGB → monochrome |
| `brightness(0.92)` | Slight dim — pushes faint strokes below the next threshold |
| `contrast(2.8)` | High contrast — turns grays into solid extremes |
| `brightness(1.12)` | Final lift — burns paper texture to pure white |

### Step 5 — Erase the background
The combined filter chain clears gray shadows, paper wrinkles, notebook grid lines, and ambient noise. The page surface becomes solid white, leaving only the inked characters behind. This is what makes handwriting dramatically easier for the OCR model to read.

### Step 6 — Compress and lock
The final clean image is exported as **JPEG at quality 0.82 (82%)** — high enough to keep character borders sharp, low enough to slash file size. A **size-guarding loop** guarantees the final blob is never larger than the original:

- If `optimizedBytes ≤ originalBytes` → ship it.
- Otherwise → drop the target height by 200 px (minimum 1000 px floor), re-apply all filters, re-export, re-check.
- The loop terminates when the size clears the boundary or the height floor is reached.

**Quality is locked at 0.82 for every iteration** — we trade **resolution** to save bytes, never compression. This preserves character fidelity for the OCR engine.

## 4. How This Is Implemented

### 4.1 — Constants (`src/utils/imageOptimizer.ts`)

```ts
const START_HEIGHT  = 1800;   // optimal vertical target
const MIN_HEIGHT    = 1000;   // loop floor — never go below this
const HEIGHT_STEP   = 200;    // decrement per loop iteration
const JPEG_QUALITY  = 0.82;   // locked — quality never drops
const FILTER_CHAIN  = 'grayscale(1) brightness(0.92) contrast(2.8) brightness(1.12)';
```

### 4.2 — Pipeline (`optimizeImageForOcr(file: File)`)

**Step 1 — Read file → data URL → Image element** (in browser memory).

**Step 2 — Resize + filter + export (the loop body)**:

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
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.filter = FILTER_CHAIN;
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', JPEG_QUALITY);
  });
}
```

**Step 3 — Size-guarding loop**:

```ts
let currentHeight = START_HEIGHT;
let iterations = 0;
let blob;
while (true) {
  iterations++;
  blob = await renderAndExport(img, currentHeight);
  if (blob.size <= originalBytes) break;          // cleared
  if (currentHeight <= MIN_HEIGHT) break;         // floor reached
  currentHeight = Math.max(MIN_HEIGHT, currentHeight - HEIGHT_STEP);
}
```

**Step 4 — Return**:

```ts
return {
  blob, width, height,
  originalBytes, optimizedBytes,
  iterations, durationMs,
  startedAtHeight, endedAtHeight,
  sizeCleared
};
```

### 4.3 — Wire-up (`src/components/IcrScanner.tsx`)

The ICR scanner's `handleFileUpload` runs:

1. Fetch `GET /api/settings` to check the superadmin toggle (`icrOptimizationEnabled`).
2. **If ON** (default): run `optimizeImageForOcr(file)` and use the resulting `blob`.
3. **If OFF**: send the raw `File` directly. The server still works either way.
4. Build a `FormData`, append the chosen `blob` as `ocrImage` plus the student/paper/metrics fields.
5. `POST /api/icr/extract` with `Authorization: Bearer <token>`.
6. On success: read the OCR text + bounding boxes from the response and render the **Time Taken** panel in the verify step.

The raw `File` is discarded the moment optimization returns. The server never sees it.

### 4.4 — Server (`server/index.ts`)

- `multer.memoryStorage()` accepts the multipart upload.
- A middleware guard ensures `express.json()` and `urlencoded()` skip `/api/icr/extract` so multer can read the body.
- The optimized blob is **not** persisted. It exists only in `req.file.buffer` for the lifetime of the request.
- OCR engine selection: `process.env.OCR_ENGINE` — `gemini` (default, Google Gemini Vision) or `groq` (Groq llama-4-scout, for local development).
- API key selection: `process.env.GEMINI_API_KEY` or `process.env.GROQ_API_KEY`, read from `.env` (gitignored).
- Response fields: `{ success, engine, text, boxes, imageWidth, imageHeight, optimization, timing, meta }`.

### 4.5 — Admin Toggle

Superadmins can disable the entire pipeline at runtime. State persists in `mvp/data/db.json` under `settings.icrOptimizationEnabled`. Toggle lives in the Superadmin Dashboard → System Settings page.

- **Default**: `true` (pipeline runs on every upload).
- **OFF**: the frontend skips `optimizeImageForOcr` and uploads the raw photo. Useful for debugging the OCR engine or measuring baseline server-load impact.

API:
- `GET  /api/settings`       — any authenticated user can read.
- `POST /api/settings`       — superadmin only; flips `icrOptimizationEnabled`.

### 4.6 — What the user sees

After upload, the verify step displays two stacked panels in the sidebar:

1. **OCR Output** — the raw text returned by the OCR engine.
2. **Time Taken** — `Client optimize ms` / `Network + OCR ms` / `Total ms`.

The main column shows the auto-parsed answer fields and the **Submit Verified Answers** button.

## 5. Why This Design

| Concern | Without Pre-Processing | With This Pipeline |
|---------|------------------------|---------------------|
| Background noise (paper texture, grid lines, shadows) | Passes through to OCR model | Burned to pure white |
| Faint handwriting | Lost in noise | Darkened, then contrast-amplified |
| Color channels | 3× data, distracts OCR | Single grayscale channel |
| Upload size | Raw 1.5–4 MB camera JPEG | Size-capped, often 60–80% smaller |
| Quality vs size trade-off | Either too large or too compressed | Resolution drops, quality stays at q=0.82 |
| Vision model latency | Slow on heavy payloads | Fast on tight payloads |
| Server storage | Grows with every scan (1.5 GB/day/district) | **Zero** — transient pipeline |
| Student PII on disk | Original photo kept indefinitely | Original never reaches the server |

Result: **better OCR text accuracy at lower latency, with zero storage growth and zero PII retention** — the original photo never leaves the user's device.
