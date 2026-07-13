# SmartFLN Model Workspace

This workspace is the isolated home for SmartFLN computer vision, OCR, handwriting recognition, and model evaluation work.

The MERN product should not be edited directly when experimenting with recognition models. Model work should happen here first, behind stable contracts, then be integrated into `apps/api` only after the model path is tested.

## Purpose

- Build the paper image processing pipeline.
- Improve answer-region cropping and alignment.
- Test OCR/HTR models without changing the teacher web app.
- Store model contracts, evaluation scripts, and model artifacts separately.
- Collect teacher-corrected labels for future fine-tuning.

## Current Product Integration

The current API calls OpenAI vision OCR from `apps/api/src/modules/ocr/ocrService.js`.

The backend can also be switched to this local model service:

```text
SMARTFLN_OCR_PROVIDER=model_service
SMARTFLN_MODEL_SERVICE_URL=http://127.0.0.1:8090
```

Production target flow:

```text
apps/web camera capture
  -> apps/api scan endpoint
  -> services/model inference service
  -> apps/api scoring/review/result workflow
```

OpenAI can be used as a pretrained high-accuracy OCR/vision provider while we collect real SmartFLN answer crops. The long-term production model path should live in this workspace and improve from teacher-corrected labels.

## MVP Full-Page Flow

`POST /v1/infer` supports a full scanned answer sheet:

```text
uploaded scanned image
  -> QR read or supplied qrText
  -> student_id, paper_id, test_id extraction
  -> strict paper validation: QR identity, known template, four corner markers
  -> perspective correction or safe resize fallback
  -> A4 template coordinate normalization
  -> answer-box ROI crop per question
  -> ROI preprocessing
  -> OCR provider
  -> answer normalization and scoring
  -> confidence and teacher-review routing
  -> final result JSON
```

The same endpoint also keeps the older crop-level contract used by `apps/api`.

Full-page OCR is gated by SmartFLN paper validation. A page is rejected with
`error=invalid_paper` and `ocr_started=false` unless it has:

- one readable QR payload with `student_id`, `paper_id`, and `test_id`
- a matching template JSON for the QR `paper_id`
- four detected black page-corner markers

Manual `student_id`, `paper_id`, and `test_id` request fields do not make a
full-page scan valid. They are metadata only; identity must come from the QR.

Multiple paper formats are supported by adding one template JSON per paper:

```text
services/model/templates/{paper_id}.json
```

The QR `paper_id` selects the matching template at runtime. Each template can
use different question counts, layouts, ROI coordinates, marks, and answer
types. Regenerate samples after adding or changing templates.

The QR `test_id` maps to the template `answer_key_id`. The scan response
returns `student_id`, `paper_id`, `test_id`, and `answer_key_id` so the UI can
show exactly which student, paper, test, and answer key were used for scoring.

Templates may set `box_markers_required=true`. Generated papers then print a
small black answer-box marker with the question label above each ROI. During
inference, SmartFLN verifies that marker before OCR. If the marker is missing,
that ROI is not trusted and OCR is skipped for that question.

## OCR Providers

The service checks these providers:

- `SMARTFLN_MODEL_OCR_PROVIDER=openai`
- `SMARTFLN_MODEL_OCR_PROVIDER=trocr`
- `SMARTFLN_MODEL_OCR_PROVIDER=paddleocr`
- `SMARTFLN_MODEL_OCR_PROVIDER=easyocr`
- `SMARTFLN_MODEL_OCR_PROVIDER=tesseract`
- `SMARTFLN_MODEL_OCR_PROVIDER=auto`
- `SMARTFLN_MODEL_OCR_PROVIDER=template_assisted`

For OpenAI vision OCR:

```text
SMARTFLN_MODEL_OCR_PROVIDER=openai
SMARTFLN_OPENAI_API_KEY=<server-side key>
SMARTFLN_OPENAI_MODEL=gpt-5.5
```

Do not commit API keys. Keep them in local environment variables or deployment secrets.

For free local pretrained handwriting OCR:

```text
SMARTFLN_MODEL_OCR_PROVIDER=trocr
SMARTFLN_TROCR_MODEL=microsoft/trocr-base-handwritten
SMARTFLN_TROCR_LOCAL_FILES_ONLY=false
SMARTFLN_TROCR_BEAMS=2
```

TrOCR is the preferred free/local MVP model for handwritten answer boxes. It works best on single-line crops, so SmartFLN crops each answer ROI down to the detected ink line before inference.
The TrOCR path also removes pale answer-box ruling lines, uses beam search, and applies conservative type-specific cleanup for common primary-school OCR confusions.

On Windows, install and cache the local TrOCR stack from this folder:

```powershell
.\scripts\install_trocr.ps1 -Python "C:\Path\To\python.exe"
```

To keep the large virtual environment and model cache on another drive, pass a
runtime root (or set `SMARTFLN_MODEL_RUNTIME_DIR`):

```powershell
.\scripts\install_trocr.ps1 -Python "C:\Path\To\python.exe" -RuntimeRoot "D:\SmartFLN\model-runtime"
.\scripts\start_trocr_service.ps1 -RuntimeRoot "D:\SmartFLN\model-runtime"
```

Source code remains in the repository. Only generated runtime dependencies,
Hugging Face cache files, and model weights live under the runtime root.

Then run the model service:

```powershell
.\scripts\start_trocr_service.ps1
```

The MVP backend should be started with:

```text
SMARTFLN_MODEL_SERVICE_URL=http://127.0.0.1:8090
```

After the model is cached, `start_trocr_service.ps1` uses `SMARTFLN_TROCR_LOCAL_FILES_ONLY=true` so runtime OCR does not depend on downloading weights again.

When no external OCR engine is configured, the MVP uses a local template-assisted visual checker. It detects ink inside each fixed answer ROI and returns the cropped answer image for review. It does not use the answer key as a prediction. Production scoring must use OpenAI, PaddleOCR/EasyOCR, or a trained HTR model to read real student handwriting.

## Folder Structure

```text
services/model/
  README.md
  MODEL_PIPELINE.md
  pyproject.toml
  app/
    main.py
    contracts/
      inference.schema.json
      full_scan.schema.json
      full_scan_request.sample.json
    pipeline/
      preprocess.py
      vision.py
      templates.py
      roi.py
      recognition.py
      evaluator.py
      scoring.py
  templates/
    demo-paper.json
    demo-paper-compact.json
    demo-paper-language.json
  samples/
    manifest.json
    {paper_id}-blank.png
    {paper_id}-filled.png
    {paper_id}-qr.txt
  data/
    raw/
    processed/
    labels/
  models/
  notebooks/
  tests/
```

## Rules For Model Work

1. Do not change teacher UI or backend workflow while experimenting with models.
2. Add sample scans under ignored local folders, not git.
3. Keep crop input/output compatible with `app/contracts/inference.schema.json`.
4. Keep full-scan input compatible with `app/contracts/full_scan.schema.json`.
5. Track every model experiment with accuracy, latency, and failure cases.
6. Only promote a model into the backend after it beats the current fallback on real scan samples.

## First Model Milestones

1. Collect real printed-page photos.
2. Save answer-region crops and teacher-corrected labels.
3. Build OpenCV preprocessing: crop, deskew, shadow removal, contrast.
4. Add separate detectors for MCQ, numeric, matching, and short text.
5. Evaluate dedicated HTR models against OpenAI fallback.

## Run The Model Service

Use the bundled or system Python runtime:

```bash
cd services/model
python -m pip install -e ".[vision,ocr]"
python -m app.main
```

The `vision` extra installs `opencv-python-headless`, which is required for
backend QR decoding from uploaded paper images. Without OpenCV, full-page scans
can still pass only when `qrText` is supplied by the browser/API.

Endpoints:

- `GET /` browser test page
- `GET /health`
- `POST /v1/infer`

Open the local tester:

```text
http://127.0.0.1:8090/
```

Use it to paste, drop, or upload a scanned paper image and run the model pipeline directly.
Click `Use Filled Sample` on the page to load:

```text
services/model/samples/demo-paper-filled.png
```

Sample files:

- `services/model/samples/demo-paper-blank.png`
- `services/model/samples/demo-paper-filled.png`
- `services/model/samples/demo-paper-qr.txt`
- `services/model/samples/manifest.json`

Regenerate samples after template changes:

```bash
python services/model/scripts/generate_sample_papers.py
```

Example full-scan request:

```bash
curl -X POST http://127.0.0.1:8090/v1/infer \
  -H "Content-Type: application/json" \
  --data @services/model/app/contracts/full_scan_request.sample.json
```

If no OCR provider is installed or configured, the pipeline still crops, scores safely, and marks answers for teacher review with `providerStatus=ocr_engine_not_configured`.

Run tests:

```bash
python -m unittest discover services/model/tests
```
