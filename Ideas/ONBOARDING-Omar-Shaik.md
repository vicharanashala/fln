# Contributor Onboarding Document — Omar Shaik

**Contributor:** Omar Shaik  
**Target Area:** ICR Scanning Pipeline, Quality Assurance & Teacher UX  
**Contribution (PR):** Pre-OCR Scan Quality Validation Gate and UI Quality Feedback ([Commit `1582bd85`](https://github.com/vicharanashala/fln/commit/1582bd859be463a3b2559baba49738bbd568978f))  

---

## 1. What is FLN?

**FLN (Foundational Literacy and Numeracy)** refers to the core skills every child must master in early primary education (Preschool through Class 4, ages 3–9): reading simple text with comprehension, recognizing numbers, and performing basic arithmetic (counting, addition, subtraction, simple multiplication).

### The Educational Problem
In government schools across India, assessments like ASER consistently show that many children advance through grades without mastering basic numeracy or reading. The core problems on the ground are:
1. **Classroom Heterogeneity:** In one Class 3 classroom, one student is still counting on fingers while another is doing two-digit addition.
2. **Limited Teacher Time:** Teachers often handle multigrade classrooms and heavy admin work. Manually creating 40 different worksheets and hand-grading them every day is not feasible.
3. **No Student Screens:** Children in these schools do not have tablets or laptops. **All learning and test-taking has to happen on physical paper.**

The FLN platform solves this by diagnosing each student's genuine level on a 93-level math scale, generating printable personalized A4 worksheets, scanning completed papers with a phone camera, and evaluating answers automatically to advance children toward grade-level mastery.

---

## 2. What do you understand by FLN as a system?

The platform connects classrooms to administrators through a role-based workflow tailored to Indian school administration:

- **Students:** The subjects of the platform. They don't log in; their progress is tracked via unique masked IDs (`aadharMasked`), current levels (1–93), and assessment histories.
- **Teachers & Volunteers:** The primary field operators. Teachers manage class rosters, generate test papers, scan student answer sheets using phone cameras, and review results. Volunteers assist in low-connectivity or under-resourced schools.
- **School Principals & Admins (Block, District, State):** Monitor regional health, track school progress through the pipeline (Conducted $\rightarrow$ Scanned $\rightarrow$ Evaluated $\rightarrow$ Certified), and identify lagging schools.
- **Superadmins:** National oversight team (IIT Ropar / Vicharanashala Lab) managing the curriculum framework and review queues.

### End-to-End Workflow
1. **Generate:** Teacher generates personalized A4 PDF worksheets with student QR codes and answer boxes.
2. **Administer:** Students write their answers on physical paper.
3. **Scan & Ingest:** Teacher takes a photo of the completed sheet using the in-app scanner.
4. **Pre-OCR Quality Check:** The image is inspected before OCR for resolution, lighting, blur, and orientation.
5. **Evaluate:** Cloud vision OCR (`ollama-gemma4`) extracts student answers, which are scored against answer keys.
6. **Progress:** The student's level updates, certificates are awarded if the grade benchmark is cleared, or targeted remedial practice is scheduled.

---

## 3. Current State of the Repository — What Has Been Done So Far

Based on my hands-on work with the codebase while building my PR:

- **Frontend:** Single-page app built with **React 19**, **TypeScript**, **Vite**, and **Tailwind CSS**. Features dedicated dashboards for each role under `frontend/src/components/dashboards/` and scanning components like `IcrTwoStageScan.tsx`.
- **Backend:** **Node.js** and **Express** with routes modularized in `backend/src/routes/` (`evaluation.ts`, `students.ts`, `worksheets.ts`, `auth.ts`, etc.).
- **Database:** **MongoDB Atlas** with an automatic fallback to a local JSON database (`data/db.json`) for offline development.
- **Scanning & Evaluation (`ai-services/` & `evaluation.ts`):** Supports camera upload, blue-ink isolation, and cloud vision OCR using Ollama Gemma 4 (`/api/icr/evaluate-cloud`).

---

## 4. Gaps Observed in the Code

While working on the ICR scanning and evaluation flow, I identified the following concrete gaps:

### 1. No Pre-OCR Scan Quality Validation Gate
- **Where:** `backend/src/routes/evaluation.ts` (inside `/api/icr/evaluate-cloud`) and `frontend/src/components/IcrTwoStageScan.tsx`.
- **What:** The system took any uploaded image or PDF and sent it directly to the cloud vision OCR service (`ollama-gemma4`) without validating whether the image was actually readable, in focus, or properly oriented.
- **Why it matters:** In rural government classrooms, teachers use budget smartphones in poor lighting, with shaky hands, angled perspectives, or low resolution. Sending blurry, dark, or inverted images directly to cloud OCR caused hallucinated numbers, misread digits, and corrupted student diagnostic levels, while wasting expensive GPU and API compute on scans destined to fail.

### 2. Lack of Actionable Feedback and Guidance for Teachers
- **Where:** `frontend/src/components/IcrTwoStageScan.tsx`.
- **What:** When a scan failed or produced poor OCR results, the UI only showed a generic "OCR failed" error. There was zero indication of *why* it failed.
- **Why it matters:** Teachers had no way to know whether the room was too dark, the camera was out of focus, or the sheet was held sideways. This created frustration and repeated bad uploads.

### 3. Vulnerability to Corrupt, Undersized, or Unsupported Files
- **Where:** `backend/src/routes/evaluation.ts`.
- **What:** The backend lacked pre-flight sanity checks on buffer sizes and file formats before initiating base64 decoding and model payloads.
- **Why it matters:** Uploading corrupt files or tiny snippets (<5KB) resulted in unhandled backend errors and unnecessary memory allocations.

---

## 5. Ideas for the Project

### 1. Pre-OCR Scan Quality Validation Gate (Implemented in my PR)
- **What:** A fast, deterministic inspection layer that evaluates raw image buffers for resolution, brightness, contrast, blur, and orientation before triggering OCR.
- **Why:** Prevents garbage input from reaching the OCR model, saves latency and server costs, prevents inaccurate student placement, and gives teachers immediate feedback on how to fix their photo.
- **How:** Read image binary headers to check pixel dimensions ($\ge 600\times 600\text{px}$), sample buffer pixels to estimate brightness and contrast standard deviation, measure high-frequency adjacent differences for blur, and check aspect ratio for landscape rotation.

### 2. In-Browser Real-Time Framing & Edge Detection
- **What:** Add a live camera viewfinder overlay in the browser that highlights paper edges in green only when all 4 corners are visible and the angle is square.
- **Why:** Helps teachers frame the worksheet correctly before taking the shot, preventing cropped or skewed photos.
- **How:** Run a lightweight edge-detection filter inside an HTML5 Canvas / Web Worker on the client's video stream before capture.

### 3. Automatic Server-Side Image Normalization (Auto-Contrast & Deskew)
- **What:** For borderline images that trigger a quality warning (e.g. slight underexposure), apply automated contrast enhancement and deskewing before running OCR.
- **Why:** Reduces the number of retakes teachers have to perform in poorly-lit classrooms.
- **How:** Add an optional OpenCV / Sharp preprocessing step in the evaluation route that normalizes image histograms for scans with low contrast.

---

## 6. My Contribution

### Overview
For my onboarding contribution, I built and integrated the **Pre-OCR Scan Quality Validation Gate and UI Quality Feedback** system ([Commit `1582bd85`](https://github.com/vicharanashala/fln/commit/1582bd859be463a3b2559baba49738bbd568978f)).

### What I Built

#### 1. Core Scan Quality Engine (`backend/src/scanQuality.ts`)
A standalone, zero-heavy-dependency quality analyzer that inspects raw image buffers:
- **Header Resolution Check:** Inspects PNG `IHDR` and JPEG `SOF0`/`SOF2` segment markers to extract exact pixel dimensions without decompressing the full image. Enforces a strict minimum of $600\times 600\text{px}$.
- **Brightness Analysis:** Samples luminance across the buffer (flags $<45$ as underexposed, $>235$ as overexposed).
- **Contrast Analysis:** Calculates sample standard deviation (flags $<15$ as low contrast).
- **Blur & Sharpness Score:** Computes variance of adjacent sample differences (flags $<8$ as blurry/out-of-focus).
- **Orientation Check:** Detects landscape aspect ratios ($w > 1.25h$) for portrait worksheets.
- **Tri-State Status:** Returns `pass`, `warning` (non-fatal, overrideable), or `reject` (hard failure, cannot override) along with plain-language reason strings and metrics.

```typescript
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
  metrics: { width: number; height: number; brightnessScore: number; contrastScore: number; blurScore: number };
};
```

#### 2. Backend Routes & Quality Gate (`backend/src/routes/evaluation.ts`)
- Added `POST /api/icr/check-quality`: Allows the frontend to run an instant pre-flight quality check when a file is selected.
- Guarded `POST /api/icr/evaluate-cloud`:
  - Returns `400 Bad Request` if scan quality is `reject`.
  - Returns `422 Unprocessable Entity` if scan quality is `warning`, unless the client sends `proceedDespiteQualityWarning: true`.
  - Appends the `qualityResult` metrics to the final OCR response.

#### 3. Interactive Quality Feedback UI (`frontend/src/components/IcrTwoStageScan.tsx`)
- **Pre-Flight Scan Quality Card:** Displays immediate feedback as soon as a paper is photographed or uploaded.
- **Metric Badges:** Shows status tags for Resolution, Brightness, Contrast, Blur, and Orientation.
- **Clear Guidance:** Explains detected flaws (e.g. *"Image is too dark"*, *"Image appears blurry or out of focus"*).
- **Override Action:** Provides a `"Continue Anyway (Override)"` button for non-fatal warnings so teachers remain in control, while blocking unreadable corrupt files.

#### 4. Automated Boundary Test Suite (`backend/src/scanQuality.test.ts`)
Authored 8 automated boundary unit tests covering:
1. Clear valid image $\rightarrow$ `pass`.
2. Low resolution ($400\times 400\text{px}$) $\rightarrow$ `reject` (`canOverride: false`).
3. Dark / underexposed image $\rightarrow$ `warning` (`canOverride: true`).
4. Rotated landscape image $\rightarrow$ `warning`.
5. Corrupt / empty file $\rightarrow$ `reject`.
6. Unsupported MIME type $\rightarrow$ `reject`.
7. Overexposed bright image $\rightarrow$ `warning`.
8. Low-contrast image $\rightarrow$ `warning`.

### Verification & Test Results
- **Unit Tests:** Ran `npx tsx backend/src/scanQuality.test.ts` — all 8 boundary tests pass 100% cleanly.
- **TypeScript & Linting:** Verified `npm run lint` across both `@fln/frontend` and `@fln/backend` with zero compilation errors.
- **Build Verification:** Tested `npm run build` for both Vite frontend and backend esbuild bundles.

---

### Contributor Details
- **Name:** Omar Shaik
- **Commit:** [`1582bd85`](https://github.com/vicharanashala/fln/commit/1582bd859be463a3b2559baba49738bbd568978f)
