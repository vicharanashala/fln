# Pipeline: batch_wise_worksheet_analysis(GEMMA12B).ipynb

## Architecture

No OCR chain — full image sent directly to Gemma 4 12B Vision.

```
 ┌─────────────────────┐
 │   /kaggle/input/    │  Add Data → images + .zip files
 └────────┬────────────┘
          │
          ▼
 ┌─────────────────────┐
 │   Auto-extract      │  .zip → /kaggle/working/zip_extract/
 │   & Walk            │  Scans both input dirs for images
 └────────┬────────────┘
          │
          ▼
 ┌─────────────────────┐
 │   Preprocess        │  4 gated detectors:
 │   (only if needed)  │  blur → unsharp mask
 │                     │  skew → deskew
 │                     │  contrast → CLAHE
 │                     │  size → bicubic upscale
 └────────┬────────────┘
          │
          ▼
 ┌─────────────────────┐
 │   Gemma 4 12B       │  GGUF Q5_K_XL + mmproj-F16
 │   Vision             │  via llama-cpp-python (CUDA + flash_attn)
 │                     │  Prompt: expert FLN curriculum analyst
 └────────┬────────────┘
          │
          ▼
 ┌─────────────────────┐
 │   Per-image output  │  /FLN_Results/{stem}/
 │                     │  ├─ {stem}.png
 │                     │  └─ {stem}_result.json
 └────────┬────────────┘
          │
          ▼
 ┌─────────────────────┐
 │   Manifest + Zip    │  batch_manifest.json
 │                     │  FLN_Results.zip
 └─────────────────────┘
```

## Cell Breakdown

| Cell | Purpose |
|---|---|
| 0 (markdown) | Title + setup instructions |
| 1 | Clean `/kaggle/working/` |
| 2 | GPU check, imports, install opencv-python |
| 3 | Hugging Face login via `HF_TOKEN` (Kaggle Secrets → env var fallback) |
| 4 | CUDA wheel detection, install `llama-cpp-python`, load Gemma 4 model + mmproj |
| 5 | `preprocess()` — 4 gated detectors with cv2 |
| 6 | `SYSTEM_PROMPT` (20 question types) + `analyze_image()` with JSON post-processing |
| 7 | Main loop: collect → preprocess → analyze → save per-image → build manifest |
| 8 | `zip -r /kaggle/working/FLN_Results.zip` |

## Model Details

| Property | Value |
|---|---|
| Model repo | `unsloth/gemma-4-12b-it-GGUF` |
| Weights file | `gemma-4-12b-it-UD-Q5_K_XL.gguf` |
| MMProj file | `mmproj-F16.gguf` |
| Backend | `llama-cpp-python` (CUDA) |
| GPU layers | `-1` (all) |
| Context | 8192 tokens |
| Temperature | 0.1 |
| Flash attention | enabled |
| Download size | ~8.6 GB |

## Preprocessing Thresholds

| Detector | Metric | Threshold | Fix Applied |
|---|---|---|---|
| Blurry | Laplacian variance | < 80 | Unsharp mask (σ=3.0, +1.5 weight) |
| Skewed | Hough line angle | > 3° absolute | Affine deskew + border replication |
| Low contrast | Pixel range (max-min) | < 100 | CLAHE (clip 2.0, tile 8×8) |
| Small | Shortest side | < 800 px | Bicubic upscale 2× |

All fixes are **gated** — applied only when thresholds are exceeded. Clean images pass through untouched.

## Prompt: 20 Question Types

| Type | Category |
|---|---|
| Counting, Number Recognition, Missing Numbers | Number sense |
| Ascending Order, Descending Order, Skip Counting, Finger Counting | Sequencing |
| Addition, Subtraction, Word Problem | Operations |
| Shapes, Patterns, Matching, Classification, Comparison | Concepts |
| Logical Reasoning, Review Assessment | Reasoning |
| Tracing, Coloring, Writing Practice | Fine motor / literacy |

## Output Fields

| Field | Type | Description |
|---|---|---|
| `question_heading` | string | Exact instruction text from worksheet |
| `question_type` | enum | One of 20 types above |
| `learning_outcome` | string | Educational skill targeted |
| `student_action` | string | What the student does (e.g. "write number", "circle") |
| `answer_format` | enum | fill_in_blank, circle, match, draw, color, trace, cut_paste, write_number |
| `visual_elements` | string | Description of image layout |
| `number_range` | string | e.g. "1-10", "1-30", "none" |
| `has_example` | bool | Whether an example is shown |
| `worksheet_type` | enum | numeracy, literacy, fine_motor, mixed |
| `difficulty` | enum | easy, medium, hard |
| `concept` | string | Core educational concept |
| `sub_concept` | string | Specific sub-skill |
| `estimated_grade` | enum | Pre-K, Kindergarten, Grade 1, Grade 2 |
| `bloom_level` | enum | Remembering, Understanding, Applying, Analyzing |
| `skills` | string[] | List of targeted skills |
| `all_text_detected` | string | All text the model can read |
| `confidence_score` | int | 0–100 confidence |
| `reasoning` | string | Visual evidence summary |

## Confidence Guidelines

| Range | Meaning |
|---|---|
| 90–100 | Very clear visual evidence |
| 70–89 | Mostly clear |
| 50–69 | Partial evidence |
| < 50 | Uncertain or poor image quality |

## Error Handling

| Issue | Behavior |
|---|---|
| Cannot read image | Skipped with warning (corrupt / unsupported format) |
| JSON parse failure | Raw model output saved, error logged, `parsed` = `null` |
| `<think>` tags | Stripped before JSON parsing via regex |
| No GPU | `SystemExit` with message: enable GPU accelerator |
| No HF_TOKEN | `ValueError`: set in Kaggle Secrets |
| No images found | Prints upload instructions, skips analysis |
| Duplicate across folders | Possible if image in both `/input/` and inside a zip |
| Stale output | Cell 1 wipes `/kaggle/working/` completely each run |

## CUDA Wheel Mapping

| `torch.version.cuda` | Wheel suffix |
|---|---|
| 12.1 | cu121 |
| 12.2 | cu122 |
| 12.3 | cu123 |
| 12.4 | cu124 |
| 12.5 | cu125 |
| 12.6 | cu126 |
| `None` / unknown | cu124 (fallback) |

## Design Decisions

| Decision | Rationale |
|---|---|
| **No OCR pipeline** | Gemma 4 reads text visually — OCR adds failure points (numpy conflicts, model downloads, language limits) |
| **Auto-gated preprocessing** | Only applies enhancements when detectors confirm degradation — clean images pass through untouched |
| **Per-image subfolders** | Each image gets its own folder for easy matching with external documents |
| **`kaggle_secrets` over env var** | Kaggle Secrets is the standard way; `os.environ.get('HF_TOKEN')` as fallback |
| **`flash_attn=True`** | Reduces VRAM usage and speeds inference on T4 |

## Known Limitations

- **Model download**: ~8.6 GB on first run (~6 min on T4). Cached in `/kaggle/working/gguf_cache/` across sessions.
- **GPU required**: T4 or better. No CPU fallback.
- **Worksheet quality**: Extremely poor/faded worksheets may still be challenging. Preprocessing helps but is not guaranteed.
- **Kaggle output persistence**: `/kaggle/working/` persists within the same notebook version but resets on new versions. Download `FLN_Results.zip` before version changes.
