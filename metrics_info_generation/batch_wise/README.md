# batch_wise_worksheet_analysis(GEMMA12B).ipynb

Kaggle notebook for batch processing multiple FLN worksheet images using **Gemma 4 12B Vision** directly (no OCR pipeline).

## Quick Start

1. Open in [Kaggle](https://www.kaggle.com/)
2. Settings → Accelerator → **GPU**
3. Add-ons → Secrets → Add **HF_TOKEN** (Hugging Face read token)
4. **Add Data** button (top right) → upload image(s) or `.zip`
5. Cell → Run All

## Pipeline

| Stage | Description |
|---|---|
| **Image collection** | Walks `/kaggle/input/` for images + auto-extracts `.zip` archives |
| **Quality detection** | Laplacian blur check, Hough deskew, size & contrast analysis |
| **Auto-preprocessing** | Unsharp mask, CLAHE, deskew, bicubic upscale — only if detectors trigger |
| **Gemma 4 Vision** | Sends full image to Gemma 4 12B with expert FLN prompt |
| **Structured output** | Per-image subfolder: enhanced image + result JSON + batch manifest |
| **Archive** | Zips all results into `FLN_Results.zip` for download |

## Output

```
/kaggle/working/FLN_Results/
├── image_name_1/
│   ├── image_name_1.png          (enhanced)
│   └── image_name_1_result.json  (full model output)
├── image_name_2/
│   ├── image_name_2.png
│   └── image_name_2_result.json
├── ...
└── batch_manifest.json           (confidence + type summary)
FLN_Results.zip
```

## Requirements

- Kaggle account with **GPU** accelerator (T4+)
- Hugging Face account → **HF_TOKEN** with read permissions
- Worksheet images (PNG/JPG/WebP/BMP/TIFF) or `.zip` archives

## Notes

- **First run** downloads ~8.6 GB model (~6 min on T4). Cached in `/kaggle/working/gguf_cache/` for subsequent sessions.
- Notebook clears `/kaggle/working/` each run to avoid stale files.
- CUDA wheel auto-detected from `torch.version.cuda` with `cu124` fallback.
