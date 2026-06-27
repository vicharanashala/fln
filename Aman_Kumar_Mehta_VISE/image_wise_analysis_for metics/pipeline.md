# Pipeline: Gemma 4 12B FLN Worksheet Analyzer

This document describes the end-to-end data pipeline — from raw worksheet image to structured analysis output.

---

## Pipeline Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        GOOGLE COLAB ENVIRONMENT                         │
│                                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────────┐  │
│  │  Cell 0   │    │  Cell 1   │    │  Cell 2   │    │    Cell 3        │  │
│  │ Free Disk │───▶│ Mount    │───▶│ HF Login  │───▶│ Download & Load │  │
│  │ Space     │    │ Drive    │    │           │    │ Gemma 4 12B     │  │
│  └──────────┘    └──────────┘    └──────────┘    └────────┬─────────┘  │
│                                                            │            │
│                     ┌──────────────────────────────────────┘            │
│                     ▼                                                    │
│              ┌─────────────────────────────────────────────────────┐    │
│              │                   Cell 4: Analysis                    │    │
│              │                                                       │    │
│              │  ┌──────────┐    ┌──────────┐    ┌───────────────┐  │    │
│              │  │ Upload   │───▶│ Encode   │───▶│ Model         │  │    │
│              │  │ Image    │    │ to Base64│    │ Inference     │  │    │
│              │  └──────────┘    └──────────┘    └───────┬───────┘  │    │
│              │                                           │          │    │
│              │  ┌────────────────────────────────────────┘          │    │
│              │  ▼                                                    │    │
│              │  ┌──────────┐    ┌──────────┐                        │    │
│              │  │ Raw JSON │───▶│ Parse &  │                        │    │
│              │  │ Response │    │ Display  │                        │    │
│              │  └──────────┘    └──────────┘                        │    │
│              └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Stage-by-Stage Breakdown

### Stage 0: Environment Preparation
**Cell 0 & 1 & 2** — One-time setup for the Colab runtime.

```
Input:  None (secrets configured by user)
Process:
  1. Delete all files in /content/ except /content/drive/
  2. Delete ~/.cache/pip
  3. Mount Google Drive to /content/drive/
  4. Create output directory: /content/drive/MyDrive/FLN_Analysis/
  5. Read HF_TOKEN from Colab Secrets
  6. Log into Hugging Face Hub
Output: Clean Colab environment, authenticated HF session
```

### Stage 1: Model Acquisition
**Cell 3** — Download and load the vision-language model onto GPU.

```
Input:  Hugging Face authentication
Process:
  1. Detect CUDA version (torch.version.cuda)
  2. Select matching pre-built wheel for llama-cpp-python
     (cu121 | cu122 | cu123 | cu124 | cu125)
  3. pip install llama-cpp-python with CUDA support
  4. Download mmproj-F16.gguf (175 MB) → vision projection weights
     Source: huggingface.co/unsloth/gemma-4-12b-it-GGUF
  5. Initialize Gemma4ChatHandler with mmproj
  6. Download gemma-4-12b-it-UD-Q5_K_XL.gguf (~8.6 GB)
  7. Load model onto GPU:
     - n_gpu_layers = -1 (all layers on GPU)
     - n_ctx = 8192 (context window)
     - flash_attn = True
Output: Llama object (llm) ready for inference
```

### Stage 2: Data Ingestion
**Cell 4 — Part 1** — User uploads a worksheet image.

```
Input:  User interaction via google.colab.files.upload()
Process:
  1. Display file picker widget
  2. User selects one image file (PNG/JPG)
  3. Save uploaded bytes to /content/{filename}
  4. Display image inline using IPython.display
Output:
  - img_path: /content/{filename}
  - img_data: raw bytes
  - mime_type: guessed MIME type
```

### Stage 3: Image Encoding
**Cell 4 — Part 2** — Convert image to model-compatible format.

```
Input:  img_path, mime_type
Process:
  1. Read image file as binary
  2. Base64-encode the binary data
  3. Construct data URI: data:{mime};base64,{encoded_string}
Output: Base64 data URI (ready for multimodal API)
```

### Stage 4: Model Inference
**Cell 4 — Part 3** — Send image + prompt to Gemma 4 for analysis.

```
Input:
  - Base64 data URI of the worksheet image
  - SYSTEM_PROMPT (structured JSON schema definition)
  - User query: "What is this worksheet asking?"

SYSTEM_PROMPT structure:
  ┌─────────────────────────────────────────────┐
  │ Role: FLN Worksheet Analyst                 │
  │ Target: Ages 3-7                            │
  │ Output: Strict JSON with fields:            │
  │  • question_heading                         │
  │  • question_type                            │
  │  • learning_outcome                         │
  │  • student_action                           │
  │  • answer_format                            │
  │  • visual_elements                          │
  │  • number_range                             │
  │  • has_example                              │
  │  • worksheet_type                           │
  │  • difficulty                               │
  │  • skills                                   │
  │  • all_text_detected                        │
  │  • confidence_score                         │
  │  • reasoning                                │
  └─────────────────────────────────────────────┘

Process:
  1. Construct messages array:
     [{role: "user", content: [
       {type: "image_url", image_url: {url: data_uri}},
       {type: "text", text: SYSTEM_PROMPT + "\n\nWhat is this worksheet asking?"}
     ]}]
  2. Call llm.create_chat_completion() with:
     - max_tokens = 4096
     - temperature = 0.1 (low randomness for structured output)
  3. Extract response text from choices[0].message.content

Output: Raw text (expected to contain JSON with possible markdown wrapping)
```

### Stage 5: Output Parsing
**Cell 4 — Part 4** — Clean and parse the model's response.

```
Input: Raw model response text
Process:
  1. Strip <think>...</think> blocks (reasoning traces)
  2. Strip ```json and ``` code fences
  3. Attempt json.loads() on cleaned text
  4. If successful → print formatted JSON
  5. If failed → print JSONDecodeError and first 500 chars of raw output

Output:
  ✅ Success: Structured JSON shown in notebook output
  ❌ Failure: Error message + raw text for manual inspection
```

---

## Data Flow Summary

```
                    ┌─────────────┐
                    │ Worksheet   │
                    │ Image (PNG) │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Base64      │
                    │ Encoding    │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Gemma 4 12B │
                    │ Vision LLM  │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Raw JSON    │
                    │ Text        │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ JSON Parser │
                    └──────┬──────┘
                           │
                           ▼
              ┌──────────────────────────┐
              │ Structured Analysis      │
              │ {                        │
              │   question_type: ...,    │
              │   difficulty: ...,       │
              │   skills: [...],         │
              │   ...                    │
              │ }                        │
              └──────────────────────────┘
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **GGUF quantization (Q5_K_XL)** | Reduces model size from ~24 GB to ~8.6 GB, fitting in T4 VRAM with acceptable quality loss |
| **llama-cpp-python** | Pure CPU/CUDA inference engine, no PyTorch model loading overhead, pre-built wheels for Colab |
| **temperature=0.1** | Low temperature ensures deterministic, consistent JSON output for reproducible analysis |
| **Base64 image encoding** | Standard approach for multimodal LLM APIs; no need to host images externally |
| **Gemma4ChatHandler** | Handles the multimodal chat template specific to Gemma 4's vision capabilities |
| **8192 context window** | Compromise between GPU memory limits and having enough context for image + instructions |
| **Colab T4 GPU** | Freely available GPU with 16 GB VRAM, sufficient for 12B parameter model at Q5 quantization |

---

## Edge Cases & Error Handling

| Scenario | Handling |
|---|---|
| No file uploaded | `SystemExit("No file uploaded")` — execution stops gracefully |
| HF_TOKEN missing | `ValueError` with instructions to add Colab Secret |
| JSON parse failure | Prints raw output for manual inspection; analysis still visible |
| CUDA version mismatch | Falls back to `cu124` wheel |
| Disk space insufficient | Cell 0 cleans aggressively; if still failing, user may need Factory Reset |
| Non-image file uploaded | `mimetypes.guess_type()` may return incorrect MIME; falls back to `image/png` |
