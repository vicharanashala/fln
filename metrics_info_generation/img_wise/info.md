# Image-Wise Extraction — Complete Info

## Overview

Processes a single FLN worksheet image via **Gemma 4 12B Vision** in Google Colab.
The user uploads one image interactively, the model analyzes it, and results are
displayed inline and saved to Google Drive.

---

## Input Method (Colab)

| Method | How |
|---|---|
| **File upload widget** | Cell 4 displays an upload button; select one image (PNG/JPG/WebP/BMP) |

The image is saved to `/content/`, base64-encoded, and sent to the model.

---

## Output Structure

```
/content/drive/MyDrive/FLN_Analysis/
│
├── image_name_result.json      ← Gemma analysis result
└── image_name_original.png     ← copy of the uploaded image
```

The parsed JSON is also displayed in the notebook output for immediate inspection.

### Why Google Drive?

- Results persist across Colab session timeouts and VM recycling
- Easy to retrieve and share results without re-running
- Central location for all FLN analysis outputs

---

## Result JSON Schema

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

## Run Locations & Persistence

### Google Colab
- **Working dir**: `/content/` (cleaned each run)
- **Output dir**: `/content/drive/MyDrive/FLN_Analysis/`
- **Model cache**: Colab VM local storage (avoids re-downloading 8.6 GB)
- **Persistence**: Within the same Colab session. Results in Google Drive persist permanently.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `NO GPU DETECTED` | Runtime has no GPU | Runtime → Change runtime type → T4 GPU, restart runtime |
| `HF_TOKEN not found` | Missing Hugging Face token | Secrets (key icon) → Add HF_TOKEN |
| `libcudart.so.12` error | Wrong CUDA wheel | Auto-detected with cu124 fallback |
| `JSON PARSE FAILED` | Model output isn't valid JSON | Rare. Check raw output in notebook. |
| Model loading > 10 min | Slow internet or HF download | Ensure stable connection. Cached on subsequent runs. |
| Session disconnected | Colab free tier timeout | Reconnect and re-run; results in Drive are safe |

---

## File Index

```
IITRPR_INTERN/
└── img_wise/
    ├── fln_image_info_extract(GEMMA 12B).ipynb  ← Main notebook
    ├── README.md                                 ← Quick start
    ├── PIPELINE.md                               ← Architecture & details
    └── info.md                                   ← This file
```

## Key Differences from batch_wise

| Aspect | img_wise (Colab) | batch_wise (Kaggle) |
|---|---|---|
| **Environment** | Google Colab | Kaggle Notebook |
| **Images per run** | 1 (manual upload) | Many (auto-walk /kaggle/input/) |
| **Preprocessing** | None | Gated: blur, deskew, CLAHE, upscale |
| **Output** | Single JSON + image copy to Drive | Per-image subfolders + manifest + zip |
| **Persistence** | Google Drive | FLN_Results.zip download |
| **Use case** | Quick test / interactive analysis | Batch production processing |
