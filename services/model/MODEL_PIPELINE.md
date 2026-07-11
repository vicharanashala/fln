# SmartFLN Model Pipeline

This document defines the production model pipeline we will build inside `services/model`.

## Core Principle

Do not use one OCR model for everything.

SmartFLN answer recognition should be a hybrid pipeline:

```text
QR + page detection -> OpenCV
page deskew/perspective correction -> OpenCV
template alignment -> geometry
answer ROI crop -> template coordinates
MCQ -> mark/circle detection
numeric -> digit recognition
matching -> line/shape detection
short handwritten text -> HTR model
doubtful cases -> OpenAI fallback + teacher review
```

## Model Inputs

The model service supports two MVP input modes.

### Full-Page Scan Input

Use this when testing the QR structured answer-paper workflow directly:

- `imageDataUrl`: full scanned page
- `qrText`: optional QR text already decoded by the browser/API
- `student_id`, `paper_id`, `test_id`: optional metadata fields, not validation overrides
- `template`: optional inline template

When `template` is not supplied, the service loads:

```text
services/model/templates/{paper_id}.json
```

This allows multiple paper formats in the same model service. Every generated
paper must put its own `paper_id` in the QR payload, and that `paper_id` must
match exactly one template JSON. Templates may define different answer-box
layouts, question counts, question types, marks, and answer keys.

The decoded QR `test_id` maps to the template `answer_key_id`. Full-page output
returns the resolved `answer_key` mapping so the teacher UI can display which
answer key was applied.

For stronger ROI safety, templates can enable `box_markers_required=true`.
Generated papers print a small dark marker and question label above each answer
box. The evaluator verifies this marker before OCR and returns
`provider_status=answer_box_marker_missing` for a question when the expected box
marker is absent.

Full-page scans have a strict validity gate before OCR. The model service
returns `error=invalid_paper` and skips OCR unless the uploaded page has a QR
payload with `student_id`, `paper_id`, and `test_id`, a known matching template,
and four detected black corner markers.

### Crop Input

The existing MERN backend can still send answer crops after it resolves paper identity and template.

Each crop must include:

- `scanPageId`
- `questionId`
- `questionType`
- `prompt`
- `answerKey`
- `imageDataUrl` or future object-storage URI

## Model Outputs

Each crop returns:

- `recognizedAnswer`
- `confidence`
- `modelName`
- `modelVersion`
- `providerStatus`
- `needsReview`
- `diagnostics`

Full-page output returns:

- `student_id`
- `paper_id`
- `test_id`
- `identity`
- `page`
- `answers[]`
- `total_marks`
- `awarded_marks`
- `percentage`
- `needs_teacher_review`
- `review_count`
- `final_confidence`
- `pipeline`

## Implemented MVP Stages

```text
HTTP /v1/infer
  -> app.pipeline.evaluator.infer
  -> preprocess.load_image_from_data_url
  -> vision.read_qr_text
  -> vision.parse_qr_payload
  -> vision.detect_page_markers
  -> evaluator SmartFLN paper validation
  -> templates.load_template
  -> vision.align_page
  -> roi.detect_answer_box_marker
  -> roi.crop_answer_roi
  -> preprocess.preprocess_roi
  -> recognition.recognize_answer
  -> scoring.score_answer
```

Current runtime behavior:

- QR reading uses supplied `qrText` immediately.
- QR image decoding becomes active when `opencv-python-headless` is installed.
- Marker detection and perspective correction become active when OpenCV is installed.
- Without OpenCV, the service resizes the page to the configured template size and marks marker status as fallback.
- OCR uses configured providers only; if none are available, answers are routed to teacher review.

## OCR Provider Strategy

Configured by `SMARTFLN_MODEL_OCR_PROVIDER`:

- `openai`: cloud pretrained vision OCR through the OpenAI Responses API
- `trocr`: local Microsoft TrOCR handwriting model through Hugging Face Transformers
- `paddleocr`: local pretrained PaddleOCR when installed
- `easyocr`: local pretrained EasyOCR when installed
- `tesseract`: local Tesseract wrapper when installed
- `template_assisted`: local constrained MVP fallback for fixed answer-key templates
- `auto`: first available local OCR engine

OpenAI is the fastest practical route for high-quality MVP validation with real school scans. TrOCR is the preferred free/local pretrained handwriting path for single-line answer crops. Local PaddleOCR/EasyOCR remain useful for cost control, offline pilots, and later fine-tuned models.

If no external provider is configured, SmartFLN uses the template-assisted fallback. It detects ink inside each answer box, returns the crop preview, and routes the answer to review/OCR-required status. It does not predict from the answer key. This keeps the QR, ROI, scoring, and review workflow testable without pretending to be production-grade handwriting recognition.

## Accuracy Targets

Pilot targets:

- QR identity: 99%+
- answer crop alignment: 95%+
- MCQ recognition: 95%+
- numeric recognition: 90%+
- short handwriting recognition: 75-85% before teacher correction
- low-confidence routing recall: 95%+

Production targets after labeled data:

- MCQ recognition: 98%+
- numeric recognition: 95%+
- short handwriting recognition: 90%+ for constrained answer formats
- no automatic finalization below confidence threshold

## Evaluation Data

Store locally during development:

```text
services/model/data/raw/
services/model/data/processed/
services/model/data/labels/
```

These folders are intentionally ignored in git except `.gitkeep` files. Real student data must not be committed.

## Integration Contract

The backend should call the model service through a stable HTTP contract. That lets us swap:

- OpenAI fallback
- local Python model service
- hosted GPU inference
- fine-tuned custom HTR model

without changing the teacher workflow.

## Local Service Contract

Development endpoint:

```text
POST http://127.0.0.1:8090/v1/infer
```

Sample request and response live in:

```text
services/model/app/contracts/sample_request.json
services/model/app/contracts/sample_response.json
services/model/app/contracts/full_scan_request.sample.json
```

Backend switch:

```text
SMARTFLN_OCR_PROVIDER=model_service
SMARTFLN_MODEL_SERVICE_URL=http://127.0.0.1:8090
```
