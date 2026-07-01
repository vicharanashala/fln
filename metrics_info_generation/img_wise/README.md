# fln_image_info_extract(GEMMA 12B).ipynb

Colab notebook for analyzing a single FLN worksheet image using **Gemma 4 12B Vision** directly (no OCR pipeline).

## Quick Start

1. Open in [Google Colab](https://colab.research.google.com/)
2. Runtime → Change runtime type → **T4 GPU**
3. Secrets (key icon, left sidebar) → Add **HF_TOKEN** (Hugging Face read token)
4. Runtime → Run all
5. When prompted, upload one worksheet image to analyze

## Pipeline

| Stage | Description |
|---|---|
| **Drive mount** | Mounts Google Drive to `/content/drive/MyDrive/FLN_Analysis/` |
| **Model loading** | Downloads & loads Gemma 4 12B GGUF (~8.6 GB) via `llama-cpp-python` |
| **Image upload** | User picks a single image via Colab file widget |
| **Gemma 4 Vision** | Sends full image to Gemma 4 12B with expert FLN prompt |
| **JSON output** | Parsed result displayed inline + saved to Google Drive |

## Output

```
/content/drive/MyDrive/FLN_Analysis/
├── image_name_result.json   (full model output)
└── image_name_original.png  (copy of uploaded image)
```

Parsed JSON is also displayed in the notebook cell output.

## Requirements

- Google Colab with **GPU** accelerator (T4+)
- Hugging Face account → **HF_TOKEN** with read permissions
- One worksheet image (PNG/JPG/WebP/BMP)

## Notes

- **First run** downloads ~8.6 GB model (~6 min on T4). Cached in Colab's local storage for subsequent sessions.
- Notebook clears `/content/` each run to avoid stale files.
- CUDA wheel auto-detected from `torch.version.cuda` with `cu124` fallback.
- Results persist in Google Drive across sessions.
