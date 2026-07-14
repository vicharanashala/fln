# Bulk Diagnostic Workflow

Generate diagnostic papers for an entire class in bulk, with async job progress tracking.

---

## Step 1: Configure

- **Trigger:** Click **"Bulk Diagnostic Generator"** on dashboard sidebar
- Teacher selects:
  - **Baseline Class Level** (1–4)
  - **Number of Students** (1–1000)
- **API:** `POST /api/diagnostic/bulk`
- **Body:** `{ classNumber, count }`
- **Server logic:**
  1. Role-based authorization — teacher must be assigned to the class's school
  2. Creates placeholder students for paper generation
  3. Starts async Puppeteer `generateDiagnosticPaper()` job
  4. Returns `{ jobId, status: 'running', progressUrl }`

## Step 2: Poll Progress

- UI polls every 1.5 seconds
- **API:** `GET /api/diagnostic/bulk/:jobId/progress`
- Returns: `{ completed, totalStudents, status, pdfUrl, downloadUrl }`

## Step 3: Download / Print

When completed (status = "completed"):
- **"Download Merged PDF"** → `GET /api/diagnostic/bulk/:jobId/download`
- **"Print / Open PDF"** → opens `pdfUrl` in new tab
