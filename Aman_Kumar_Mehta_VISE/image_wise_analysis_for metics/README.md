# Gemma 4 12B Vision - FLN Image Analyzer

A **Google Colab** notebook that uses Google's **Gemma 4 12B Vision** model to analyze **FLN (Foundational Literacy and Numeracy) worksheets** for children ages 3–7. The model processes an uploaded worksheet image and returns a structured JSON analysis describing the question type, learning outcome, difficulty, skills, and all detected text.

---

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Setup Instructions](#setup-instructions)
- [Notebook Cells Explained](#notebook-cells-explained)
- [Output Format](#output-format)
- [Troubleshooting](#troubleshooting)
- [Technical Details](#technical-details)

---

## Overview

| Aspect | Detail |
|---|---|
| **Model** | Gemma 4 12B Vision (GGUF quantized by Unsloth) |
| **Inference Engine** | `llama-cpp-python` with CUDA acceleration |
| **Model Size** | ~8.6 GB (Q5_K_XL quantization) |
| **Runtime** | Google Colab (T4 GPU recommended) |
| **Purpose** | Analyze children's worksheets, extract structured metadata |

The notebook automates the entire pipeline:
1. Prepares the Colab environment (frees disk, mounts Drive, logs into Hugging Face)
2. Downloads and loads the Gemma 4 12B vision model
3. Accepts a user-uploaded image of a worksheet
4. Sends the image to the model with a structured system prompt
5. Parses the model's JSON response and displays it

---

## Prerequisites

- A **Google account** (for Colab)
- A **Hugging Face account** with a **User Access Token** (with `read` permission)
  - Create one at: https://huggingface.co/settings/tokens
- Access granted to the model repository: [unsloth/gemma-4-12b-it-GGUF](https://huggingface.co/unsloth/gemma-4-12b-it-GGUF)
  - Note: You may need to accept Google's license terms for Gemma models on Hugging Face.

---

## Setup Instructions

### Step 1: Open in Colab
Open the notebook in Google Colab.

### Step 2: Select GPU Runtime
Go to `Runtime → Change runtime type` and select **T4 GPU** (or any GPU accelerator).

### Step 3: Add Hugging Face Token
1. Click the **key icon** in the left sidebar (Colab Secrets)
2. Add a new secret with name `HF_TOKEN`
3. Paste your Hugging Face User Access Token as the value
4. Toggle the switch to make it available to the notebook

### Step 4: Run All Cells
Click `Runtime → Run all` and wait. The model download takes ~6 minutes on a T4 GPU.

### Step 5: Upload an Image
When Cell 4 executes, a file picker will appear. Select **one** FLN worksheet image (PNG/JPG).

---

## Notebook Cells Explained

### Cell 0 — Free Up Disk Space
Cleans up `/content/` on Colab (removes sample data, pip cache, etc.) to free disk space for the ~8.6 GB model download.

```python
# Removes all files/folders in /content/ except /content/drive/
# Deletes ~/.cache/pip
```

### Cell 1 — Mount Google Drive
Mounts Google Drive and creates a folder at `/content/drive/MyDrive/FLN_Analysis/` for storing results.

```python
drive.mount('/content/drive')
DRIVE_FOLDER = "/content/drive/MyDrive/FLN_Analysis"
```

### Cell 2 — Hugging Face Login
Retrieves `HF_TOKEN` from Colab Secrets and logs into Hugging Face Hub — required to download the gated Gemma model.

```python
token = userdata.get("HF_TOKEN")
login(token)
```

### Cell 3 — Install & Load Gemma 4 12B
Three-step process:

1. **Install `llama-cpp-python`** — Installs the pre-built CUDA wheel matching the Colab GPU's CUDA version (supports cu121–cu125, falls back to cu124).
2. **Load mmproj** — Downloads `mmproj-F16.gguf` (175 MB), the vision projection weights, via `Gemma4ChatHandler`.
3. **Download & load model** — Downloads `gemma-4-12b-it-UD-Q5_K_XL.gguf` (~8.6 GB) and loads it onto GPU with flash attention and 8192 context tokens.

```python
llm = Llama.from_pretrained(
    repo_id="unsloth/gemma-4-12b-it-GGUF",
    filename="gemma-4-12b-it-UD-Q5_K_XL.gguf",
    chat_handler=chat_handler,
    n_gpu_layers=-1,     # All layers on GPU
    n_ctx=8192,          # Context window
    flash_attn=True,     # Flash attention for speed
)
```

### Cell 4 — Upload & Analyze Image
The analysis cell:

1. **File upload** — Uses `google.colab.files.upload()` to let the user pick one image file.
2. **Display** — Shows the uploaded image inline.
3. **Encode** — Converts the image to a Base64 data URI.
4. **System prompt** — Sends a detailed system prompt instructing the model to output a specific JSON schema describing the worksheet.
5. **Model inference** — Calls `llm.create_chat_completion()` with the image + prompt, using `temperature=0.1` for deterministic output.
6. **Parse output** — Strips markdown code fences and `<think>` tags, then attempts to parse the model response as JSON. Displays both raw and parsed output.

---

## Output Format

The model responds with a JSON object following this schema:

| Field | Type | Description |
|---|---|---|
| `question_heading` | string | Exact instruction text on the worksheet |
| `question_type` | string | One of: `Counting`, `Number Recognition`, `Missing Numbers`, `Addition`, `Subtraction`, `Matching`, `Patterns`, `Classification`, `Tracing`, etc. |
| `learning_outcome` | string | Specific educational skill being taught |
| `student_action` | string | What the student physically does (e.g., "Draw lines to match") |
| `answer_format` | string | How the answer is given (e.g., `fill_in_blank`, `circle`, `match`) |
| `visual_elements` | string | Description of visual elements in the image |
| `number_range` | string | Range of numbers used (e.g., `1-10`, `none`) |
| `has_example` | boolean | Whether an example is provided on the worksheet |
| `worksheet_type` | string | `numeracy`, `literacy`, `fine_motor`, or `mixed` |
| `difficulty` | string | `easy`, `medium`, or `hard` |
| `skills` | array of strings | List of skills (e.g., `["Vocabulary building", "Antonym recognition"]`) |
| `all_text_detected` | string | All readable text found in the image |
| `confidence_score` | integer | 0–100 confidence in the analysis |
| `reasoning` | string | Explanation of visual evidence leading to the conclusions |

---

## Troubleshooting

### "HF_TOKEN not found"
- Ensure you added the `HF_TOKEN` secret in Colab Secrets (key icon in the left sidebar).
- Make sure the toggle is enabled so the notebook can access it.

### Model download fails / out of disk
- Run Cell 0 first to free up space.
- Ensure you have a T4 or better GPU runtime (not CPU-only).
- Check that your Hugging Face token has accepted the Gemma model license.

### JSON parse fails
- The raw model output is still printed above the error — you can manually extract the JSON.
- This sometimes happens with very complex or low-quality worksheet images.

### CUDA out of memory
- The T4 has 16 GB VRAM — if other processes are using GPU memory, try `Runtime → Factory reset runtime` and run again.

---

## Technical Details

### Model
- **Architecture**: Gemma 4 12B (Vision-Language)
- **Quantization**: Q5_K_XL (Unsloth's custom quantization)
- **Repository**: [unsloth/gemma-4-12b-it-GGUF](https://huggingface.co/unsloth/gemma-4-12b-it-GGUF)
- **Vision encoder**: SigLIP-based mmproj (model projection)

### Dependencies
- `llama-cpp-python` — Python bindings for llama.cpp with CUDA support
- `llama.cpp`'s `Gemma4ChatHandler` — handles multimodal (text + image) chat formatting

### Performance
- **Download time**: ~6 minutes on T4 GPU
- **Inference time**: ~10–30 seconds per image (depending on image complexity)
- **Context window**: 8192 tokens (limited from model's native 262K to fit GPU memory)
