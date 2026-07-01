# Pipeline: fln_image_info_extract(GEMMA 12B).ipynb

## Architecture

No OCR chain — single image sent directly to Gemma 4 12B Vision.

```
 ┌─────────────────────┐
 │   Google Colab      │  Runtime → T4 GPU
 │   Runtime           │
 └────────┬────────────┘
          │
          ▼
 ┌─────────────────────┐
 │   Cell 0            │  Free up /content/ disk space
 │   Cleanup           │
 └────────┬────────────┘
          │
          ▼
 ┌─────────────────────┐
 │   Cell 1            │  Mount Google Drive → FLN_Analysis/
 │   Drive Mount       │  Create output directory
 └────────┬────────────┘
          │
          ▼
 ┌─────────────────────┐
 │   Cell 2            │  Hugging Face login via HF_TOKEN
 │   HF Login          │  (Colab Secrets → env var fallback)
 └────────┬────────────┘
          │
          ▼
 ┌─────────────────────┐
 │   Cell 3            │  CUDA wheel → install llama-cpp-python
 │   Model Load        │  Load Gemma 4 12B GGUF + mmproj-F16
 │                     │  ~8.6 GB download, ~6 min on T4
 └────────┬────────────┘
          │
          ▼
 ┌─────────────────────┐
 │   Cell 4            │  Upload widget → select one image
 │   Upload & Analyze  │  Encode as base64 → send to model
 │                     │  Parse JSON → display + save to Drive
 └─────────────────────┘
```

## Cell Breakdown

| Cell | Purpose |
|---|---|
| 0 (code) | Clear `/content/`, free disk space |
| 1 | Mount Google Drive, create `/content/drive/MyDrive/FLN_Analysis/` |
| 2 | Hugging Face login via `HF_TOKEN` (Colab Secrets) |
| 3 | CUDA wheel detection, install `llama-cpp-python`, load Gemma 4 model + mmproj |
| 4 | File upload widget → base64 encode → `llm.create_chat_completion()` → parse JSON → display + save to Drive |

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
| No file uploaded | `SystemExit` with message |
| JSON parse failure | Raw model output displayed, error logged |
| `<think>` tags | Stripped before JSON parsing via regex |
| No GPU | SystemExit with message: enable GPU accelerator |
| No HF_TOKEN | `ValueError`: set in Colab Secrets |
| Stale files | Cell 0 wipes `/content/` completely each run |

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
| **Single image per run** | Designed for quick interactive testing and validation rather than batch production |
| **Google Drive persistence** | Results survive Colab session timeouts and VM recycling |
| **No preprocessing** | Assumes user uploads a reasonably clean image; Gemma 4 handles varied quality natively |
| **`kaggle_secrets` over env var** | Colab Secrets is the standard way; `os.environ.get('HF_TOKEN')` fallback not used here |

## Known Limitations

- **Model download**: ~8.6 GB on first run (~6 min on T4). Cached across sessions within same Colab VM.
- **GPU required**: T4 or better. No CPU fallback.
- **Single image only**: Upload widget accepts one file; for batch processing use the batch_wise Kaggle notebook.
- **Google Drive quota**: Ensure sufficient Drive space for saved results.
- **Colab session limits**: Free tier has runtime limits; results in Drive persist but model must reload each session.
