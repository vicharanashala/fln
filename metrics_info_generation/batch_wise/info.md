# Batch-Wise Extraction — Complete Info

## Overview

Processes multiple FLN worksheet images in a single Kaggle run via **Gemma 4 12B Vision**.
Images uploaded via the **Add Data** button or inside `.zip` archives are analyzed batch-wise,
with results saved to structured per-image subfolders.

---

## Input Methods (Kaggle)

| Method | How |
|---|---|
| **Add Data button** | Top right → upload image(s) or `.zip` |
| **Direct upload** | Multiple images can be selected |
| **Zip archive** | `.zip` files are auto-extracted to `/kaggle/working/zip_extract/` |

All images are collected by walking `/kaggle/input/` and the extraction directory.

---

## Output Structure

```
/kaggle/working/FLN_Results/
│
├── image_name_1/                     ← folder named after each image (stem)
│   ├── image_name_1.png              ← enhanced/preprocessed version
│   └── image_name_1_result.json      ← Gemma analysis result
│
├── image_name_2/
│   ├── image_name_2.png
│   └── image_name_2_result.json
│
├── batch_manifest.json               ← summary of ALL processed images
FLN_Results.zip                        ← downloadable archive
```

### Why per-image subfolders?

- Match the enhanced image with its corresponding JSON result
- Cross-reference with external documents that reference the same filename
- Copy individual results without hunting through a flat directory

---

## Batch Manifest Schema

```json
{
  "batch": [
    {
      "file": "worksheet_a.png",
      "confidence": 95,
      "question_type": "Counting"
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `file` | string | Original filename |
| `confidence` | int or null | `confidence_score` from the model (0–100). `null` if parsing failed. |
| `question_type` | string or null | `question_type` from the model. `null` if parsing failed or missing. |

---

## Individual Result JSON Schema

```json
{
  "question_heading": "Count the objects and write the number",
  "question_type": "Counting",
  "learning_outcome": "Counting objects up to 10 with one-to-one correspondence",
  "student_action": "Write the number in the blank box",
  "answer_format": "write_number",
  "visual_elements": "Rows of fruits (apples, bananas, oranges) with empty boxes next to each row",
  "number_range": "1-10",
  "has_example": true,
  "worksheet_type": "numeracy",
  "difficulty": "easy",
  "concept": "Counting and Cardinality",
  "sub_concept": "Counting objects 1-10",
  "estimated_grade": "Kindergarten",
  "bloom_level": "Applying",
  "skills": [
    "One-to-one correspondence",
    "Number recognition",
    "Counting objects"
  ],
  "all_text_detected": "Count and write the number...",
  "confidence_score": 95,
  "reasoning": "The image shows rows of fruits with..."
}
```

---

## Preprocessing

Before Gemma inference, each image passes through quality detectors. Applied fixes are logged:

```
  Input: 1200x800
  Preprocessing: deskew 2.5 deg, CLAHE
```

| Detected Issue | Threshold | Fix Applied |
|---|---|---|
| Blurry | Laplacian variance < 80 | Unsharp mask (σ=3.0, strength 1.5) |
| Skewed | Absolute rotation > 3° | Affine deskew with border replication |
| Low contrast | Pixel range < 100 | CLAHE (clip limit 2.0, tile 8x8) |
| Small | Shortest side < 800px | Bicubic upscale 2x |

If none trigger:
```
  Preprocessing: none needed
```

---

## Run Locations & Persistence

### Kaggle
- **Output dir**: `/kaggle/working/FLN_Results/`
- **Model cache**: `/kaggle/working/gguf_cache/` (avoids re-downloading 8.6 GB)
- **Zip extraction**: `/kaggle/working/zip_extract/` (cleaned each run)
- **Persistence**: Within the same notebook version. Resets on new version. Download `FLN_Results.zip` before version changes.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `NO GPU DETECTED` | Runtime has no GPU | Settings → Accelerator → GPU, restart runtime |
| `HF_TOKEN not found` | Missing Hugging Face token | Add-ons → Secrets → Add HF_TOKEN |
| `libcudart.so.12` error | Wrong CUDA wheel | Auto-detected with cu124 fallback |
| `JSON PARSE FAILED` | Model output isn't valid JSON | Rare. Check raw output in logs. |
| Duplicate image processed | Image exists both standalone AND inside a zip | Upload only via one method |
| Model loading > 10 min | Slow internet or HF download | Ensure stable connection. Cached on subsequent runs. |
| Output reset between sessions | New Kaggle version | Download `FLN_Results.zip` before version changes. |

---

## File Index

```
IITRPR_INTERN/
└── batch_wise/
    ├── batch_wise_worksheet_analysis(GEMMA12B).ipynb  ← Main notebook
    ├── README.md                                       ← Quick start
    ├── PIPELINE.md                                     ← Architecture & details
    └── info.md                                         ← This file
```
